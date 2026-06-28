const EPS_MM = 1e-6;
const DEFAULT_SEGMENT_COUNT = 4;
const MIN_TURN_DEG = 5;
const MAX_TURN_DEG = 175;

export function applyManagedStageInputXmlNodeLocalElbows(contracts = [], config = {}) {
  if (!config.inputXmlBasedJson || !config.excludeBendsWhileProcessingInputXmlBasedJson) {
    return { contracts, audit: emptyAudit('disabled') };
  }

  const byNode = buildNodeIndex(contracts);
  const trimMap = new Map();
  const elbowByHost = new Map();
  const elbows = [];
  const skippedNodes = [];

  for (const [node, connections] of byNode.entries()) {
    const usable = connections.filter((entry) => isExportableCenterline(entry.contract));
    if (usable.length !== 2) continue;

    const planned = planNodeElbow(node, usable[0], usable[1], config);
    if (!planned.ok) {
      if (planned.reason !== 'straight-through-node') skippedNodes.push({ node, reason: planned.reason });
      continue;
    }

    applyTrim(trimMap, planned.entryA, planned.trimA);
    applyTrim(trimMap, planned.entryB, planned.trimB);

    const host = chooseHost(planned.entryA, planned.entryB);
    const current = elbowByHost.get(host.contract.name) || [];
    current.push(planned.elbow);
    elbowByHost.set(host.contract.name, current);

    elbows.push({
      node,
      hostContractName: host.contract.name,
      sourceContractNames: [planned.entryA.contract.name, planned.entryB.contract.name],
      sourceDtxrs: [planned.entryA.contract.dtxr, planned.entryB.contract.dtxr],
      turnAngleDeg: round(planned.turnAngleDeg),
      nominalTrimMm: round(planned.nominalTrimMm),
      trimA: trimSummary(planned.entryA, planned.trimA),
      trimB: trimSummary(planned.entryB, planned.trimB),
      segmentCount: planned.elbow.segments.length,
      code4Planned: true,
      code4StartMm: planned.elbow.code4.startMm,
      code4EndMm: planned.elbow.code4.endMm,
      code4BendRadiusMm: planned.elbow.code4.bendRadiusMm,
      startMm: planned.elbow.segments[0].startMm,
      endMm: planned.elbow.segments[planned.elbow.segments.length - 1].endMm
    });
  }

  const adjusted = contracts.map((contract) => {
    if (!contract?.name) return contract;
    const trims = trimMap.get(contract.name) || {};
    const additions = elbowByHost.get(contract.name) || [];
    const next = {
      ...contract,
      rvmTrimStartOffsetMm: maxNumber(contract.rvmTrimStartOffsetMm || 0, trims.start || 0),
      rvmTrimEndOffsetMm: maxNumber(contract.rvmTrimEndOffsetMm || 0, trims.end || 0)
    };
    if (additions.length) next.genericInputXmlNodeLocalElbows = [...(contract.genericInputXmlNodeLocalElbows || []), ...additions];
    if (next.dtxr === 'BEND' && next.genericInputXmlBend?.mode === 'code8-source-route-cylinder') {
      next.genericInputXmlBend = trimmedSourceRouteBend(next);
    }
    return next;
  });

  const trimmedContracts = adjusted.filter((contract) => Number(contract.rvmTrimStartOffsetMm || 0) > EPS_MM || Number(contract.rvmTrimEndOffsetMm || 0) > EPS_MM);
  return {
    contracts: adjusted,
    audit: {
      schema: 'ManagedStageInputXmlNodeLocalElbowAudit.v1',
      enabled: true,
      inputXmlBasedJson: true,
      mode: 'degree-2-node-local-code4-elbows-with-source-route-trim',
      segmentCountPerElbow: DEFAULT_SEGMENT_COUNT,
      nodeLocalElbowCount: elbows.length,
      genericNodeLocalElbowPrimitiveCount: elbows.reduce((sum, elbow) => sum + elbow.segmentCount, 0),
      code4NodeLocalElbowCount: elbows.length,
      trimmedContractCount: trimmedContracts.length,
      trimApplicationCount: [...trimMap.values()].reduce((sum, trim) => sum + (trim.start > EPS_MM ? 1 : 0) + (trim.end > EPS_MM ? 1 : 0), 0),
      radiusMultiplier: config.genericInputXmlBendRadiusMultiplier,
      trimMaxContractFraction: config.inputXmlBendTrimMaxContractFraction,
      elbows,
      skippedNodes,
      ok: skippedNodes.length === 0
    }
  };
}

export function assertManagedStageInputXmlNodeLocalElbowAudit(audit = {}, expectations = {}) {
  if (audit.schema !== 'ManagedStageInputXmlNodeLocalElbowAudit.v1') throw new Error('Invalid InputXML node-local elbow audit schema');
  if (audit.enabled && audit.ok !== true) {
    throw new Error(`InputXML node-local elbow audit failed: ${(audit.skippedNodes || []).map((entry) => `${entry.node}:${entry.reason}`).join('; ')}`);
  }
  for (const [key, expected] of Object.entries(expectations)) {
    if (expected !== undefined && audit[key] !== expected) {
      throw new Error(`InputXML node-local elbow ${key} expected ${expected}, got ${audit[key]}`);
    }
  }
  return true;
}

function emptyAudit(state) {
  return {
    schema: 'ManagedStageInputXmlNodeLocalElbowAudit.v1',
    enabled: false,
    inputXmlBasedJson: false,
    mode: state,
    segmentCountPerElbow: DEFAULT_SEGMENT_COUNT,
    nodeLocalElbowCount: 0,
    genericNodeLocalElbowPrimitiveCount: 0,
    code4NodeLocalElbowCount: 0,
    trimmedContractCount: 0,
    trimApplicationCount: 0,
    radiusMultiplier: null,
    trimMaxContractFraction: null,
    elbows: [],
    skippedNodes: [],
    ok: true
  };
}

function planNodeElbow(node, entryA, entryB, config) {
  const dot = clamp(dotProduct(entryA.directionOut, entryB.directionOut), -1, 1);
  const turnAngleRad = Math.acos(dot);
  const turnAngleDeg = turnAngleRad * 180 / Math.PI;
  if (turnAngleDeg < MIN_TURN_DEG || turnAngleDeg > MAX_TURN_DEG) return { ok: false, reason: 'straight-through-node' };

  const corner = entryA.pointMm;
  if (distance(corner, entryB.pointMm) > 1e-3) return { ok: false, reason: 'node coordinate mismatch' };

  const diameter = Math.min(Number(entryA.contract.diameterMm || 0), Number(entryB.contract.diameterMm || 0));
  const radius = Math.min(Number(entryA.contract.radiusMm || 0), Number(entryB.contract.radiusMm || 0));
  if (!(diameter > EPS_MM) || !(radius > EPS_MM)) return { ok: false, reason: 'missing diameter/radius' };

  const explicitRadius = explicitBendRadius(entryA.contract, entryB.contract);
  const centerlineRadiusMm = explicitRadius > EPS_MM
    ? explicitRadius
    : diameter * positiveNumber(config.genericInputXmlBendRadiusMultiplier || 1.5, 'genericInputXmlBendRadiusMultiplier');
  const nominalTrimMm = centerlineRadiusMm * Math.tan(turnAngleRad / 2);
  const trimA = cappedTrim(entryA.contract, nominalTrimMm, config);
  const trimB = cappedTrim(entryB.contract, nominalTrimMm, config);
  if (!(trimA > EPS_MM) || !(trimB > EPS_MM)) return { ok: false, reason: 'trim collapsed' };

  const start = vadd(corner, scale(entryA.directionOut, trimA));
  const end = vadd(corner, scale(entryB.directionOut, trimB));
  const startTangent = scale(entryA.directionOut, -1);
  const endTangent = entryB.directionOut;
  const planeNormal = unitVector(cross(startTangent, endTangent));
  const points = quadraticCornerCurve(start, corner, end, DEFAULT_SEGMENT_COUNT);
  const segments = [];
  for (let index = 0; index < DEFAULT_SEGMENT_COUNT; index += 1) {
    const startMm = points[index];
    const endMm = points[index + 1];
    const lengthMm = distance(startMm, endMm);
    if (lengthMm > EPS_MM) {
      segments.push({
        role: `node-local-elbow-${index + 1}`,
        startMm: startMm.map(round),
        endMm: endMm.map(round),
        lengthMm: round(lengthMm),
        radiusMm: round(radius),
        sourceNode: String(node)
      });
    }
  }
  if (segments.length !== DEFAULT_SEGMENT_COUNT) return { ok: false, reason: 'degenerate elbow segments' };

  return {
    ok: true,
    entryA,
    entryB,
    turnAngleDeg,
    nominalTrimMm,
    trimA,
    trimB,
    elbow: {
      schema: 'ManagedStageInputXmlNodeLocalElbow.v2',
      node: String(node),
      name: `INPUTXML_NODE_LOCAL_ELBOW_NODE_${node}`,
      fittingClass: 'ELBOW_CODE4',
      centerlineRadiusMm: round(centerlineRadiusMm),
      turnAngleDeg: round(turnAngleDeg),
      parentSourceContractNames: [entryA.contract.name, entryB.contract.name],
      parentSourceDtxrs: [entryA.contract.dtxr, entryB.contract.dtxr],
      trimApplications: [trimSummary(entryA, trimA), trimSummary(entryB, trimB)],
      code4: {
        schema: 'ManagedStageInputXmlNodeLocalCode4Elbow.v1',
        startMm: start.map(round),
        endMm: end.map(round),
        bendRadiusMm: round(centerlineRadiusMm),
        tubeRadiusMm: round(radius),
        sweepAngleRad: round(turnAngleRad),
        bendAngleDeg: round(turnAngleDeg),
        startTangent: startTangent.map(round),
        endTangent: endTangent.map(round),
        planeNormal: planeNormal.map(round),
        sourceNode: String(node)
      },
      segments
    }
  };
}

function buildNodeIndex(contracts) {
  const byNode = new Map();
  for (const contract of contracts) {
    if (contract?.schema !== 'ManagedStageGeometryContract.v1') continue;
    addConnection(byNode, contract, contract.fromNode, contract.startMm, contract.axis, 'start');
    addConnection(byNode, contract, contract.toNode, contract.endMm, scale(contract.axis, -1), 'end');
  }
  return byNode;
}

function addConnection(byNode, contract, node, pointMm, directionOut, side) {
  if (!node || !Array.isArray(pointMm)) return;
  const key = String(node);
  if (!byNode.has(key)) byNode.set(key, []);
  byNode.get(key).push({ contract, node: key, pointMm, directionOut: unitVector(directionOut), side });
}

function isExportableCenterline(contract) {
  if (!contract || contract.emitGeometry === false) return false;
  if (!Array.isArray(contract.startMm) || !Array.isArray(contract.endMm) || !Array.isArray(contract.axis)) return false;
  return ['PIPE', 'BEND', 'FLANGE', 'FLANGE_PAIR', 'VALVE', 'FLANGED_VALVE', 'UNSPECIFIED'].includes(contract.dtxr);
}

function chooseHost(entryA, entryB) {
  const aIsBend = entryA.contract.dtxr === 'BEND';
  const bIsBend = entryB.contract.dtxr === 'BEND';
  if (aIsBend && !bIsBend) return entryA;
  if (bIsBend && !aIsBend) return entryB;
  return Number(entryA.contract.elementIndex || 0) <= Number(entryB.contract.elementIndex || 0) ? entryA : entryB;
}

function applyTrim(trimMap, entry, trimMm) {
  const current = trimMap.get(entry.contract.name) || { start: 0, end: 0 };
  if (entry.side === 'start') current.start = Math.max(current.start || 0, trimMm);
  if (entry.side === 'end') current.end = Math.max(current.end || 0, trimMm);
  trimMap.set(entry.contract.name, current);
}

function cappedTrim(contract, nominalTrimMm, config) {
  const maxFraction = Number(config.inputXmlBendTrimMaxContractFraction || 0.35);
  const maxByContract = Math.max(0, Number(contract.lengthMm || 0) * maxFraction);
  return round(Math.min(nominalTrimMm, maxByContract));
}

function trimmedSourceRouteBend(contract) {
  const axis = unitVector(contract.axis);
  const startTrim = Number(contract.rvmTrimStartOffsetMm || 0);
  const endTrim = Number(contract.rvmTrimEndOffsetMm || 0);
  const startMm = pointAlong(contract.startMm, axis, startTrim);
  const endMm = pointAlong(contract.endMm, axis, -endTrim);
  const lengthMm = distance(startMm, endMm);
  const meta = contract.genericInputXmlBend || {};
  return {
    ...meta,
    schema: meta.schema || 'ManagedStageInputXmlGenericBend.v5',
    mode: 'code8-source-route-cylinder',
    sourceRoutePreserved: true,
    sourceRouteTrimmedForNodeLocalElbows: startTrim > EPS_MM || endTrim > EPS_MM,
    segments: lengthMm > EPS_MM ? [{
      role: 'source-route',
      startMm: startMm.map(round),
      endMm: endMm.map(round),
      lengthMm: round(lengthMm),
      trimmedForNodeLocalElbow: true,
      startTrimMm: round(startTrim),
      endTrimMm: round(endTrim)
    }] : []
  };
}

function trimSummary(entry, trimMm) {
  const pointMm = entry.side === 'start'
    ? pointAlong(entry.contract.startMm, entry.contract.axis, trimMm)
    : pointAlong(entry.contract.endMm, entry.contract.axis, -trimMm);
  return {
    sourceName: entry.contract.name,
    sourceDtxr: entry.contract.dtxr,
    side: entry.side,
    trimMm: round(trimMm),
    tangentPointMm: pointMm.map(round)
  };
}

function explicitBendRadius(contractA, contractB) {
  for (const contract of [contractA, contractB]) {
    const radius = Number(contract?.arc?.bendRadiusMm || contract?.genericInputXmlBend?.originalBendRadiusMm || 0);
    if (Number.isFinite(radius) && radius > EPS_MM) return radius;
  }
  return 0;
}

function quadraticCornerCurve(start, corner, end, count) {
  const points = [];
  for (let index = 0; index <= count; index += 1) {
    const t = index / count;
    const a = scale(start, (1 - t) * (1 - t));
    const b = scale(corner, 2 * (1 - t) * t);
    const c = scale(end, t * t);
    points.push([a[0] + b[0] + c[0], a[1] + b[1] + c[1], a[2] + b[2] + c[2]].map(round));
  }
  return points;
}

function pointAlong(point, axis, offset) { return [point[0] + axis[0] * offset, point[1] + axis[1] * offset, point[2] + axis[2] * offset]; }
function positiveNumber(value, fieldName) { const parsed = Number(value); if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid ${fieldName}: expected positive number`); return parsed; }
function maxNumber(a, b) { return Math.max(Number(a) || 0, Number(b) || 0); }
function distance(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function scale(v, factor) { return [v[0] * factor, v[1] * factor, v[2] * factor]; }
function vadd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function dotProduct(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function unitVector(v) { const len = Math.hypot(v[0], v[1], v[2]); return len > EPS_MM ? v.map((entry) => entry / len) : [0, 0, 1]; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function round(value) { return Number(Number(value).toFixed(6)); }
