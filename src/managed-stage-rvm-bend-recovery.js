export function recoverManagedStageCode4Bends(contracts = [], config = {}) {
  const bendCount = contracts.filter((contract) => contract?.dtxr === 'BEND').length;
  const existing = contracts.reduce((sum, contract) => sum + (contract.genericInputXmlNodeLocalElbows || []).filter((elbow) => elbow.code4).length, 0);
  if (!bendCount || existing > 0) return { contracts, audit: audit(bendCount, existing, 0, 'not-needed', []) };

  const byNode = buildNodeIndex(contracts);
  const recovered = [];
  const byHost = new Map();
  const trimByContract = new Map();

  for (const bend of contracts.filter((contract) => contract?.dtxr === 'BEND')) {
    const candidate = bestBendTurnCandidate(bend, byNode, config);
    if (!candidate) continue;
    const list = byHost.get(candidate.host.name) || [];
    list.push(candidate.elbow);
    byHost.set(candidate.host.name, list);
    applyTrim(trimByContract, candidate.bend, candidate.bendSide, candidate.trimMm);
    applyTrim(trimByContract, candidate.other, candidate.otherSide, candidate.trimMm);
    recovered.push({
      bendName: bend.name,
      node: candidate.node,
      hostName: candidate.host.name,
      otherName: candidate.other.name,
      turnAngleDeg: round(candidate.turnAngleDeg),
      trimMm: round(candidate.trimMm),
      radiusMm: round(candidate.radiusMm),
      startMm: candidate.elbow.code4.startMm,
      endMm: candidate.elbow.code4.endMm
    });
  }

  const adjusted = contracts.map((contract) => {
    const trims = trimByContract.get(contract.name) || {};
    const additions = byHost.get(contract.name) || [];
    if (!additions.length && !trims.start && !trims.end) return contract;
    const next = {
      ...contract,
      rvmTrimStartOffsetMm: Math.max(Number(contract.rvmTrimStartOffsetMm || 0), Number(trims.start || 0)),
      rvmTrimEndOffsetMm: Math.max(Number(contract.rvmTrimEndOffsetMm || 0), Number(trims.end || 0))
    };
    if (additions.length) next.genericInputXmlNodeLocalElbows = [...(contract.genericInputXmlNodeLocalElbows || []), ...additions];
    if (next.dtxr === 'BEND' && next.genericInputXmlBend?.mode === 'code8-source-route-cylinder') next.genericInputXmlBend = trimmedSourceRouteBend(next);
    return next;
  });

  return { contracts: adjusted, audit: audit(bendCount, existing, recovered.length, 'explicit-bend-turn-recovery', recovered) };
}

function audit(bendCount, existing, recovered, mode, recoveredBends) {
  return { schema: 'ManagedStageRvmBendRecoveryAudit.v1', mode, explicitBendCount: bendCount, preExistingCode4NodeLocalElbowCount: existing, recoveredCode4BendCount: recovered, recoveredBends, ok: true };
}

function bestBendTurnCandidate(bend, byNode, config) {
  const candidates = [];
  for (const side of ['start', 'end']) {
    const node = side === 'start' ? bend.fromNode : bend.toNode;
    const connections = (byNode.get(String(node)) || []).filter((entry) => entry.contract.name !== bend.name);
    for (const otherEntry of connections) {
      const bendDirOut = side === 'start' ? unit(bend.axis) : scale(unit(bend.axis), -1);
      const otherDirOut = otherEntry.directionOut;
      const dot = clamp(dotProduct(bendDirOut, otherDirOut), -1, 1);
      const angle = Math.acos(dot);
      const angleDeg = angle * 180 / Math.PI;
      if (angleDeg < 5 || angleDeg > 175) continue;
      candidates.push(makeCandidate(bend, side, node, otherEntry.contract, otherEntry.side, bendDirOut, otherDirOut, angle, angleDeg, config));
    }
  }
  return candidates.filter(Boolean).sort((a, b) => bendHostScore(b) - bendHostScore(a))[0] || null;
}

function makeCandidate(bend, bendSide, node, other, otherSide, bendDirOut, otherDirOut, angle, angleDeg, config) {
  const radius = Math.min(Number(bend.radiusMm || 0), Number(other.radiusMm || bend.radiusMm || 0));
  if (!(radius > 0)) return null;
  const requestedRadius = Number(bend.arc?.bendRadiusMm || bend.genericInputXmlBend?.originalBendRadiusMm || bend.diameterMm * (config.genericInputXmlBendRadiusMultiplier || 1.5));
  const nominalTrim = requestedRadius * Math.tan(angle / 2);
  const maxFraction = Number(config.inputXmlBendTrimMaxContractFraction || 0.35);
  const trim = Math.min(nominalTrim, Number(bend.lengthMm || 0) * maxFraction, Number(other.lengthMm || 0) * maxFraction);
  if (!(trim > 1e-6)) return null;
  const effectiveRadius = trim / Math.tan(angle / 2);
  const corner = bendSide === 'start' ? bend.startMm : bend.endMm;
  const bendTangentPoint = add(corner, scale(bendDirOut, trim));
  const otherTangentPoint = add(corner, scale(otherDirOut, trim));
  const startTangent = scale(bendDirOut, -1);
  const endTangent = otherDirOut;
  const planeNormal = unit(cross(startTangent, endTangent));
  const host = bend;
  return {
    bend,
    other,
    host,
    bendSide,
    otherSide,
    node: String(node),
    turnAngleDeg: angleDeg,
    trimMm: trim,
    radiusMm: effectiveRadius,
    elbow: {
      schema: 'ManagedStageInputXmlNodeLocalElbow.v2',
      node: String(node),
      name: `INPUTXML_RECOVERED_CODE4_BEND_${bend.name}_NODE_${node}`,
      fittingClass: 'ELBOW_CODE4',
      parentSourceContractNames: [bend.name, other.name],
      code4: {
        schema: 'ManagedStageInputXmlNodeLocalCode4Elbow.v1',
        startMm: bendTangentPoint.map(round),
        endMm: otherTangentPoint.map(round),
        bendRadiusMm: round(effectiveRadius),
        tubeRadiusMm: round(radius),
        sweepAngleRad: round(angle),
        bendAngleDeg: round(angleDeg),
        startTangent: startTangent.map(round),
        endTangent: endTangent.map(round),
        planeNormal: planeNormal.map(round),
        sourceNode: String(node)
      },
      segments: []
    }
  };
}

function buildNodeIndex(contracts) {
  const byNode = new Map();
  for (const contract of contracts) {
    if (!contract?.fromNode || !contract?.toNode) continue;
    addConnection(byNode, contract, contract.fromNode, contract.startMm, contract.axis, 'start');
    addConnection(byNode, contract, contract.toNode, contract.endMm, scale(contract.axis, -1), 'end');
  }
  return byNode;
}
function addConnection(byNode, contract, node, pointMm, directionOut, side) { if (!node || !Array.isArray(pointMm)) return; const key = String(node); if (!byNode.has(key)) byNode.set(key, []); byNode.get(key).push({ contract, node: key, pointMm, directionOut: unit(directionOut), side }); }
function applyTrim(map, contract, side, trim) { const current = map.get(contract.name) || { start: 0, end: 0 }; if (side === 'start') current.start = Math.max(current.start, trim); else current.end = Math.max(current.end, trim); map.set(contract.name, current); }
function trimmedSourceRouteBend(contract) { const startTrim = Number(contract.rvmTrimStartOffsetMm || 0); const endTrim = Number(contract.rvmTrimEndOffsetMm || 0); const startMm = add(contract.startMm, scale(unit(contract.axis), startTrim)); const endMm = add(contract.endMm, scale(unit(contract.axis), -endTrim)); return { ...(contract.genericInputXmlBend || {}), mode: 'code8-source-route-cylinder', sourceRouteTrimmedForNodeLocalElbows: true, segments: [{ role: 'source-route', startMm: startMm.map(round), endMm: endMm.map(round), trimmedForNodeLocalElbow: true, startTrimMm: round(startTrim), endTrimMm: round(endTrim) }] }; }
function bendHostScore(candidate) { return candidate.other.dtxr === 'PIPE' ? 1000 : candidate.other.dtxr === 'BEND' ? 100 : 10; }
function dotProduct(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function unit(v) { const len = Math.hypot(v?.[0] || 0, v?.[1] || 0, v?.[2] || 0); return len > 1e-9 ? v.map((x) => x / len) : [0, 0, 1]; }
function scale(v, f) { return [v[0] * f, v[1] * f, v[2] * f]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function round(value) { return Number(Number(value || 0).toFixed(6)); }
