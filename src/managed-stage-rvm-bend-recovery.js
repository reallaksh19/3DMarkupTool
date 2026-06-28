const EPS = 1e-9;

export function recoverManagedStageCode4Bends(contracts = [], config = {}) {
  const explicitBends = contracts.filter((contract) => contract?.dtxr === 'BEND');
  const byNode = buildNodeIndex(contracts);
  const plans = [];
  const issues = [];
  const planByBend = new Map();
  const trimByContract = new Map();

  for (const bend of explicitBends) {
    const plan = buildExplicitBendCode4Plan(bend, byNode, config);
    if (!plan) {
      issues.push({ bendName: bend.name, code: 'NO_TURN_CANDIDATE', message: 'No non-collinear adjacent centerline connection found for explicit BEND.' });
      continue;
    }
    planByBend.set(bend.name, plan);
    applyTrim(trimByContract, bend.name, plan.bendSide, plan.trimMm);
    applyTrim(trimByContract, plan.adjacentName, plan.adjacentSide, plan.trimMm);
    plans.push(plan);
  }

  const adjusted = contracts.map((contract) => {
    if (!contract?.name) return contract;
    const trims = trimByContract.get(contract.name) || {};
    const plan = planByBend.get(contract.name) || null;
    if (!plan && !trims.start && !trims.end) return contract;
    const next = {
      ...contract,
      rvmTrimStartOffsetMm: Math.max(Number(contract.rvmTrimStartOffsetMm || 0), Number(trims.start || 0)),
      rvmTrimEndOffsetMm: Math.max(Number(contract.rvmTrimEndOffsetMm || 0), Number(trims.end || 0))
    };
    if (plan) next.managedStageCode4BendPlan = plan;
    if (next.dtxr === 'BEND' && next.genericInputXmlBend?.mode === 'code8-source-route-cylinder') {
      next.genericInputXmlBend = trimmedSourceRouteBend(next);
    }
    return next;
  });

  return {
    contracts: adjusted,
    audit: {
      schema: 'ManagedStageRvmBendRecoveryAudit.v2',
      mode: 'explicit-bend-contract-code4-plan',
      explicitBendCount: explicitBends.length,
      plannedCode4BendCount: plans.length,
      missingCode4BendPlanCount: Math.max(0, explicitBends.length - plans.length),
      trimApplicationCount: [...trimByContract.values()].reduce((sum, trim) => sum + (trim.start > 0 ? 1 : 0) + (trim.end > 0 ? 1 : 0), 0),
      plans,
      issues,
      ok: issues.length === 0
    }
  };
}

function buildExplicitBendCode4Plan(bend, byNode, config) {
  const candidates = [];
  for (const side of ['start', 'end']) {
    const node = side === 'start' ? bend.fromNode : bend.toNode;
    const corner = side === 'start' ? bend.startMm : bend.endMm;
    const bendOut = side === 'start' ? unit(bend.axis) : scale(unit(bend.axis), -1);
    const adjacent = (byNode.get(String(node)) || []).filter((entry) => entry.contract.name !== bend.name && isCenterline(entry.contract));
    for (const entry of adjacent) {
      const dot = clamp(dotProduct(bendOut, entry.directionOut), -1, 1);
      const turnAngleRad = Math.acos(dot);
      const turnAngleDeg = turnAngleRad * 180 / Math.PI;
      if (turnAngleDeg < 5 || turnAngleDeg > 175) continue;
      const candidate = makePlan(bend, side, String(node), corner, bendOut, entry.contract, entry.side, entry.directionOut, turnAngleRad, turnAngleDeg, config);
      if (candidate) candidates.push(candidate);
    }
  }
  return candidates.sort((a, b) => scorePlan(b) - scorePlan(a))[0] || null;
}

function makePlan(bend, bendSide, node, corner, bendOut, adjacent, adjacentSide, adjacentOut, turnAngleRad, turnAngleDeg, config) {
  const pipeRadiusMm = Math.min(Number(bend.radiusMm || 0), Number(adjacent.radiusMm || bend.radiusMm || 0));
  if (!(pipeRadiusMm > EPS)) return null;
  const requestedRadiusMm = Number(bend.arc?.bendRadiusMm || bend.diameterMm * Number(config.genericInputXmlBendRadiusMultiplier || 1.5));
  const maxFraction = Number(config.inputXmlBendTrimMaxContractFraction || 0.35);
  const requestedTrimMm = requestedRadiusMm * Math.tan(turnAngleRad / 2);
  const trimMm = Math.min(requestedTrimMm, Number(bend.lengthMm || 0) * maxFraction, Number(adjacent.lengthMm || 0) * maxFraction);
  if (!(trimMm > EPS)) return null;
  const bendRadiusMm = trimMm / Math.tan(turnAngleRad / 2);
  if (!(bendRadiusMm > EPS)) return null;

  const startMm = add(corner, scale(bendOut, trimMm));
  const endMm = add(corner, scale(adjacentOut, trimMm));
  const startTangent = scale(bendOut, -1);
  const endTangent = adjacentOut;
  const planeNormal = unit(cross(startTangent, endTangent));

  return {
    schema: 'ManagedStageExplicitCode4BendPlan.v1',
    bendName: bend.name,
    node,
    bendSide,
    adjacentName: adjacent.name,
    adjacentSide,
    adjacentDtxr: adjacent.dtxr,
    turnAngleDeg: round(turnAngleDeg),
    sweepAngleRad: round(turnAngleRad),
    requestedRadiusMm: round(requestedRadiusMm),
    bendRadiusMm: round(bendRadiusMm),
    pipeRadiusMm: round(pipeRadiusMm),
    trimMm: round(trimMm),
    radiusCappedByTrim: Math.abs(bendRadiusMm - requestedRadiusMm) > 0.001,
    startMm: startMm.map(round),
    endMm: endMm.map(round),
    startTangent: startTangent.map(round),
    endTangent: endTangent.map(round),
    planeNormal: planeNormal.map(round),
    sourceElementId: bend.sourceElementId || bend.elementId || bend.name,
    policy: 'explicit BEND owns one code4 primitive; APOS/LPOS source-route cylinder is trimmed to tangent point for continuity'
  };
}

function buildNodeIndex(contracts) {
  const byNode = new Map();
  for (const contract of contracts) {
    if (!isCenterline(contract)) continue;
    addConnection(byNode, contract, contract.fromNode, contract.startMm, contract.axis, 'start');
    addConnection(byNode, contract, contract.toNode, contract.endMm, scale(contract.axis, -1), 'end');
  }
  return byNode;
}

function addConnection(byNode, contract, node, pointMm, directionOut, side) {
  if (!node || !Array.isArray(pointMm)) return;
  const key = String(node);
  if (!byNode.has(key)) byNode.set(key, []);
  byNode.get(key).push({ contract, node: key, pointMm, directionOut: unit(directionOut), side });
}

function isCenterline(contract) {
  return Boolean(contract?.schema === 'ManagedStageGeometryContract.v1' && contract.emitGeometry !== false && contract.fromNode && contract.toNode && Array.isArray(contract.startMm) && Array.isArray(contract.endMm) && Array.isArray(contract.axis));
}

function applyTrim(map, name, side, trimMm) {
  const current = map.get(name) || { start: 0, end: 0 };
  if (side === 'start') current.start = Math.max(current.start, trimMm);
  else current.end = Math.max(current.end, trimMm);
  map.set(name, current);
}

function trimmedSourceRouteBend(contract) {
  const axis = unit(contract.axis);
  const startTrim = Number(contract.rvmTrimStartOffsetMm || 0);
  const endTrim = Number(contract.rvmTrimEndOffsetMm || 0);
  const startMm = add(contract.startMm, scale(axis, startTrim));
  const endMm = add(contract.endMm, scale(axis, -endTrim));
  const lengthMm = distance(startMm, endMm);
  return {
    ...(contract.genericInputXmlBend || {}),
    mode: 'code8-source-route-cylinder',
    sourceRouteTrimmedForCode4Bend: Boolean(contract.managedStageCode4BendPlan),
    sourceRouteTrimmedForNodeLocalElbows: startTrim > EPS || endTrim > EPS,
    segments: lengthMm > EPS ? [{
      role: 'source-route',
      startMm: startMm.map(round),
      endMm: endMm.map(round),
      lengthMm: round(lengthMm),
      trimmedForCode4Bend: Boolean(contract.managedStageCode4BendPlan),
      startTrimMm: round(startTrim),
      endTrimMm: round(endTrim)
    }] : []
  };
}

function scorePlan(plan) {
  let score = 0;
  if (plan.adjacentDtxr === 'PIPE' || plan.adjacentDtxr === 'UNSPECIFIED') score += 1000;
  if (plan.adjacentDtxr === 'BEND') score += 500;
  score += plan.trimMm;
  return score;
}

function dotProduct(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function unit(v) { const len = Math.hypot(v?.[0] || 0, v?.[1] || 0, v?.[2] || 0); return len > EPS ? v.map((x) => x / len) : [0, 0, 1]; }
function scale(v, f) { return [v[0] * f, v[1] * f, v[2] * f]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function distance(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function round(value) { return Number(Number(value || 0).toFixed(6)); }
