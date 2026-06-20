const EPS_MM = 0.001;

export function auditManagedStageTopology(records = []) {
  const nodeMap = new Map();
  const warnings = [];
  const zeroLength = [];
  const componentEndpointList = [];
  const typeHistogram = {};
  const dtxrHistogram = {};
  let maxNodeCoordinateMismatchMm = 0;

  for (const record of records) {
    const a = record.attributes || {};
    const start = point3(a.APOS, `${record.name}.APOS`);
    const end = point3(a.LPOS, `${record.name}.LPOS`);
    const lengthMm = distance(start, end);
    const dtxr = a.DTXR || record.type || 'UNKNOWN';
    typeHistogram[record.type || 'UNKNOWN'] = (typeHistogram[record.type || 'UNKNOWN'] || 0) + 1;
    dtxrHistogram[dtxr] = (dtxrHistogram[dtxr] || 0) + 1;
    if (!(lengthMm > 0)) zeroLength.push(record.name);
    const fromMismatch = addNode(nodeMap, a.FROM_NODE, start, record.name, warnings);
    const toMismatch = addNode(nodeMap, a.TO_NODE, end, record.name, warnings);
    maxNodeCoordinateMismatchMm = Math.max(maxNodeCoordinateMismatchMm, fromMismatch, toMismatch);
    componentEndpointList.push({
      name: record.name,
      type: record.type,
      dtxr,
      fromNode: a.FROM_NODE || '',
      toNode: a.TO_NODE || '',
      startMm: start,
      endMm: end,
      lengthMm: round(lengthMm)
    });
  }

  for (const record of records) {
    const a = record.attributes || {};
    if (nodeMap.has(a.FROM_NODE)) nodeMap.get(a.FROM_NODE).degree += 1;
    if (nodeMap.has(a.TO_NODE)) nodeMap.get(a.TO_NODE).degree += 1;
  }

  const branchNodes = [];
  const terminalNodes = [];
  for (const [nodeId, node] of nodeMap.entries()) {
    if (node.degree === 1) terminalNodes.push(nodeId);
    if (node.degree > 2) branchNodes.push(nodeId);
  }

  return {
    schema: 'ManagedStageTopologyAudit.v1',
    toleranceMm: EPS_MM,
    nodeCount: nodeMap.size,
    branchNodes: branchNodes.sort(nodeSort),
    terminalNodes: terminalNodes.sort(nodeSort),
    zeroLength,
    warnings,
    maxNodeCoordinateMismatchMm: round(maxNodeCoordinateMismatchMm),
    maxCenterlineGapMm: round(maxNodeCoordinateMismatchMm),
    typeHistogram,
    dtxrHistogram,
    componentEndpointList
  };
}

function addNode(nodeMap, nodeId, point, owner, warnings) {
  if (!nodeId) return 0;
  const previous = nodeMap.get(nodeId);
  if (!previous) {
    nodeMap.set(nodeId, { point, owners: [owner], degree: 0 });
    return 0;
  }
  const deltaMm = distance(previous.point, point);
  previous.owners.push(owner);
  if (deltaMm > EPS_MM) warnings.push({ type: 'NODE_COORDINATE_MISMATCH', nodeId, owner, deltaMm: round(deltaMm) });
  return deltaMm;
}

export function point3(value, context = 'point') {
  const point = [Number(value?.x), Number(value?.y), Number(value?.z)];
  if (point.some((entry) => !Number.isFinite(entry))) throw new Error(`Invalid managed-stage ${context}`);
  return point;
}

export function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function nodeSort(a, b) {
  const an = Number(a);
  const bn = Number(b);
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  return String(a).localeCompare(String(b));
}

function round(value) {
  return Number(Number(value).toFixed(6));
}
