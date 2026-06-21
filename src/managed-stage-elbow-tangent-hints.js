const EPSILON = 1e-9;

export function applyManagedStageElbowTangentHints(contracts = []) {
  const byNode = buildNodeIndex(contracts);
  return contracts.map((contract) => {
    if (contract?.schema !== 'ManagedStageGeometryContract.v1') return contract;
    if (contract.dtxr !== 'BEND' || contract.centerlineKind !== 'arc') return contract;

    const startHint = findTangentHint(byNode, contract, contract.fromNode, 'incoming');
    const endHint = findTangentHint(byNode, contract, contract.toNode, 'outgoing');
    const planeNormal = resolveHintPlaneNormal(contract, startHint?.tangent, endHint?.tangent);

    if (!planeNormal) {
      return {
        ...contract,
        arc: {
          ...contract.arc,
          tangentHintState: 'no-adjacent-plane-hint',
          tangentHintSources: {
            start: startHint?.sourceName || '',
            end: endHint?.sourceName || ''
          }
        }
      };
    }

    return {
      ...contract,
      arc: {
        ...contract.arc,
        planeNormal,
        startTangent: startHint?.tangent || null,
        endTangent: endHint?.tangent || null,
        tangentHintState: startHint && endHint ? 'adjacent-start-end' : startHint ? 'adjacent-start-only' : 'adjacent-end-only',
        tangentHintSources: {
          start: startHint?.sourceName || '',
          end: endHint?.sourceName || ''
        }
      }
    };
  });
}

export function auditManagedStageElbowTangentHints(contracts = []) {
  const bends = contracts.filter((contract) => contract?.dtxr === 'BEND');
  const stateHistogram = {};
  const missingPlaneNormal = [];
  const missingBothTangents = [];
  for (const bend of bends) {
    const state = bend.arc?.tangentHintState || 'none';
    stateHistogram[state] = (stateHistogram[state] || 0) + 1;
    if (!Array.isArray(bend.arc?.planeNormal)) missingPlaneNormal.push(bend.name);
    if (!Array.isArray(bend.arc?.startTangent) && !Array.isArray(bend.arc?.endTangent)) missingBothTangents.push(bend.name);
  }
  return {
    schema: 'ManagedStageElbowTangentHintAudit.v1',
    bendCount: bends.length,
    stateHistogram,
    missingPlaneNormal,
    missingBothTangents,
    allBendsHavePlaneHint: missingPlaneNormal.length === 0,
    allBendsHaveAtLeastOneAdjacentTangent: missingBothTangents.length === 0
  };
}

function buildNodeIndex(contracts) {
  const byNode = new Map();
  for (const contract of contracts) {
    if (contract?.schema !== 'ManagedStageGeometryContract.v1') continue;
    addNodeContract(byNode, contract.fromNode, contract);
    addNodeContract(byNode, contract.toNode, contract);
  }
  return byNode;
}

function addNodeContract(byNode, node, contract) {
  if (!node) return;
  const key = String(node);
  if (!byNode.has(key)) byNode.set(key, []);
  byNode.get(key).push(contract);
}

function findTangentHint(byNode, bend, node, role) {
  const candidates = (byNode.get(String(node)) || [])
    .filter((contract) => contract !== bend)
    .map((contract) => tangentAtNode(contract, node, role))
    .filter(Boolean)
    .sort(compareTangentCandidates);
  return candidates[0] || null;
}

function tangentAtNode(contract, node, role) {
  const axis = unitVector(contract.axis, `${contract.name}.axis`);
  const fromMatch = String(contract.fromNode) === String(node);
  const toMatch = String(contract.toNode) === String(node);
  if (!fromMatch && !toMatch) return null;

  let tangent;
  let preferredNodeSense = false;
  if (role === 'incoming') {
    tangent = toMatch ? axis : scale(axis, -1);
    preferredNodeSense = toMatch;
  } else {
    tangent = fromMatch ? axis : scale(axis, -1);
    preferredNodeSense = fromMatch;
  }

  return {
    tangent: roundVector(tangent),
    sourceName: contract.name,
    sourceElementId: contract.sourceElementId || contract.elementId || '',
    sourceDtxr: contract.dtxr,
    centerlineKind: contract.centerlineKind,
    preferredNodeSense,
    elementIndex: Number(contract.elementIndex || 0)
  };
}

function compareTangentCandidates(a, b) {
  return candidateScore(b) - candidateScore(a) || a.elementIndex - b.elementIndex || String(a.sourceName).localeCompare(String(b.sourceName));
}

function candidateScore(candidate) {
  let score = 0;
  if (candidate.preferredNodeSense) score += 100;
  if (candidate.centerlineKind === 'line') score += 20;
  if (candidate.sourceDtxr === 'PIPE' || candidate.sourceDtxr === 'UNSPECIFIED') score += 10;
  if (candidate.sourceDtxr === 'BEND') score -= 5;
  return score;
}

function resolveHintPlaneNormal(contract, startTangent, endTangent) {
  const chord = unitVector(contract.axis, `${contract.name}.axis`);
  const sweep = positiveNumber(contract.arc?.sweepAngleRad, `${contract.name}.arc.sweepAngleRad`);
  const candidates = [];
  if (startTangent && endTangent) candidates.push(cross(startTangent, endTangent));
  if (startTangent) candidates.push(cross(startTangent, chord));
  if (endTangent) candidates.push(cross(chord, endTangent));

  let best = null;
  for (const candidate of candidates) {
    const normal = projectNormalAwayFromChord(candidate, chord);
    if (!normal) continue;
    const oriented = orientPlaneNormal(normal, chord, sweep, startTangent, endTangent);
    const score = planeNormalScore(oriented, chord, sweep, startTangent, endTangent);
    if (!best || score > best.score) best = { normal: oriented, score };
  }
  return best?.normal ? roundVector(best.normal) : null;
}

function orientPlaneNormal(normal, chord, sweep, startTangent, endTangent) {
  const plusScore = planeNormalScore(normal, chord, sweep, startTangent, endTangent);
  const minus = scale(normal, -1);
  const minusScore = planeNormalScore(minus, chord, sweep, startTangent, endTangent);
  return minusScore > plusScore + 1e-9 ? minus : normal;
}

function planeNormalScore(normal, chord, sweep, startTangent, endTangent) {
  const basis = basisForPlaneNormal(chord, normal, sweep);
  if (!basis) return Number.NEGATIVE_INFINITY;
  let score = 0;
  if (startTangent) score += dot(basis.startTangent, unitVector(startTangent, 'startTangent'));
  if (endTangent) score += dot(basis.endTangent, unitVector(endTangent, 'endTangent'));
  return score;
}

function basisForPlaneNormal(chord, normal, sweep) {
  const radialMid = unitOrNull(cross(chord, normal));
  if (!radialMid) return null;
  const halfSweep = sweep / 2;
  const xAxis = unitOrNull(vsub(scale(radialMid, Math.cos(halfSweep)), scale(chord, Math.sin(halfSweep))));
  if (!xAxis) return null;
  const yAxis = unitOrNull(cross(normal, xAxis));
  if (!yAxis) return null;
  const endTangent = unitOrNull(vadd(scale(xAxis, -Math.sin(sweep)), scale(yAxis, Math.cos(sweep))));
  if (!endTangent) return null;
  return { startTangent: yAxis, endTangent };
}

function projectNormalAwayFromChord(candidate, chord) {
  const raw = unitOrNull(candidate);
  if (!raw) return null;
  return unitOrNull(vsub(raw, scale(chord, dot(raw, chord))));
}

function unitVector(vector, fieldName) {
  const out = unitOrNull(vector);
  if (!out) throw new Error(`Invalid ${fieldName}: expected non-zero vector`);
  return out;
}

function unitOrNull(vector) {
  if (!Array.isArray(vector) || vector.length !== 3) return null;
  const parsed = vector.map(Number);
  if (parsed.some((entry) => !Number.isFinite(entry))) return null;
  const len = Math.hypot(parsed[0], parsed[1], parsed[2]);
  if (!(len > EPSILON)) return null;
  return parsed.map((entry) => entry / len);
}

function positiveNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid ${fieldName}: expected positive number`);
  return parsed;
}

function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function scale(v, factor) { return [v[0] * factor, v[1] * factor, v[2] * factor]; }
function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function vadd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function round(value) { return Number(Number(value).toFixed(9)); }
function roundVector(vector) { return vector.map(round); }
