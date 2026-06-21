const EPS_MM = 1e-6;

export function applyManagedStageInputXmlBranchFittingInference(contracts = [], config = {}) {
  if (!config.inputXmlBasedJson) {
    return { contracts, audit: emptyAudit('disabled') };
  }

  const byNode = buildNodeIndex(contracts);
  const additionsByContract = new Map();
  const inferredFittings = [];
  const skippedNodes = [];

  for (const [node, connections] of byNode.entries()) {
    const usable = connections.filter((entry) => entry.contract?.dtxr !== 'ATTA' && entry.contract?.emitGeometry !== false);
    if (usable.length < 3) continue;

    const nodePoint = usable[0].pointMm;
    const maxDiameter = Math.max(...usable.map((entry) => Number(entry.contract.diameterMm || 0)));
    const minDiameter = Math.min(...usable.map((entry) => Number(entry.contract.diameterMm || maxDiameter)));
    const fittingClass = minDiameter < maxDiameter * 0.8 ? 'OLET' : 'TEE';
    const host = chooseHostConnection(usable);
    if (!host) {
      skippedNodes.push({ node, reason: 'no host connection' });
      continue;
    }

    const segments = usable.map((entry, index) => branchSegment(nodePoint, entry, fittingClass, index)).filter(Boolean);
    if (segments.length < 3) {
      skippedNodes.push({ node, reason: 'fewer than three valid branch fitting segments' });
      continue;
    }

    const fitting = {
      schema: 'ManagedStageInputXmlBranchFitting.v1',
      node,
      fittingClass,
      name: `INPUTXML_GENERIC_${fittingClass}_NODE_${node}`,
      hostContractName: host.contract.name,
      connectionCount: usable.length,
      maxDiameterMm: round(maxDiameter),
      minDiameterMm: round(minDiameter),
      segments
    };
    const current = additionsByContract.get(host.contract.name) || [];
    current.push(fitting);
    additionsByContract.set(host.contract.name, current);
    inferredFittings.push({
      node,
      fittingClass,
      hostContractName: host.contract.name,
      connectionCount: usable.length,
      segmentCount: segments.length,
      maxDiameterMm: round(maxDiameter),
      minDiameterMm: round(minDiameter)
    });
  }

  return {
    contracts: contracts.map((contract) => {
      const additions = additionsByContract.get(contract.name);
      if (!additions?.length) return contract;
      return {
        ...contract,
        genericInputXmlBranchFittings: [...(contract.genericInputXmlBranchFittings || []), ...additions]
      };
    }),
    audit: {
      schema: 'ManagedStageInputXmlBranchFittingInferenceAudit.v1',
      enabled: true,
      inputXmlBasedJson: true,
      mode: 'infer-generic-tee-olet-from-branch-nodes',
      branchNodeCount: inferredFittings.length,
      genericBranchFittingCount: inferredFittings.length,
      genericBranchFittingPrimitiveCount: inferredFittings.reduce((sum, fitting) => sum + fitting.segmentCount, 0),
      fittingClassHistogram: histogram(inferredFittings.map((fitting) => fitting.fittingClass)),
      inferredFittings,
      skippedNodes,
      ok: skippedNodes.length === 0
    }
  };
}

export function assertManagedStageInputXmlBranchFittingInferenceAudit(audit = {}, expectations = {}) {
  if (audit.schema !== 'ManagedStageInputXmlBranchFittingInferenceAudit.v1') throw new Error('Invalid InputXML branch fitting inference audit schema');
  if (audit.enabled && !audit.ok) throw new Error(`InputXML branch fitting inference failed: ${(audit.skippedNodes || []).map((entry) => `${entry.node}:${entry.reason}`).join('; ')}`);
  if (expectations.genericBranchFittingCount !== undefined && audit.genericBranchFittingCount !== expectations.genericBranchFittingCount) {
    throw new Error(`Generic branch fitting count expected ${expectations.genericBranchFittingCount}, got ${audit.genericBranchFittingCount}`);
  }
  if (expectations.genericBranchFittingPrimitiveCount !== undefined && audit.genericBranchFittingPrimitiveCount !== expectations.genericBranchFittingPrimitiveCount) {
    throw new Error(`Generic branch fitting primitive count expected ${expectations.genericBranchFittingPrimitiveCount}, got ${audit.genericBranchFittingPrimitiveCount}`);
  }
  return true;
}

function emptyAudit(state) {
  return {
    schema: 'ManagedStageInputXmlBranchFittingInferenceAudit.v1',
    enabled: false,
    inputXmlBasedJson: false,
    mode: state,
    branchNodeCount: 0,
    genericBranchFittingCount: 0,
    genericBranchFittingPrimitiveCount: 0,
    fittingClassHistogram: {},
    inferredFittings: [],
    skippedNodes: [],
    ok: true
  };
}

function buildNodeIndex(contracts) {
  const byNode = new Map();
  for (const contract of contracts) {
    if (contract?.schema !== 'ManagedStageGeometryContract.v1') continue;
    addConnection(byNode, contract, contract.fromNode, contract.startMm, contract.axis);
    addConnection(byNode, contract, contract.toNode, contract.endMm, scale(contract.axis, -1));
  }
  return byNode;
}

function addConnection(byNode, contract, node, pointMm, directionOut) {
  if (!node || !Array.isArray(pointMm)) return;
  const key = String(node);
  if (!byNode.has(key)) byNode.set(key, []);
  byNode.get(key).push({ contract, node: key, pointMm, directionOut: unitVector(directionOut) });
}

function chooseHostConnection(connections) {
  return [...connections].sort((a, b) => hostScore(b) - hostScore(a) || Number(a.contract.elementIndex || 0) - Number(b.contract.elementIndex || 0))[0] || null;
}

function hostScore(entry) {
  let score = Number(entry.contract.diameterMm || 0);
  if (entry.contract.centerlineKind === 'line') score += 10000;
  if (entry.contract.dtxr === 'PIPE' || entry.contract.dtxr === 'UNSPECIFIED') score += 1000;
  return score;
}

function branchSegment(nodePoint, entry, fittingClass, index) {
  const diameter = Number(entry.contract.diameterMm || 0);
  const radius = Number(entry.contract.radiusMm || 0);
  const length = Math.min(Math.max(diameter * 1.5, diameter), Math.max(entry.contract.lengthMm * 0.25, diameter));
  if (!(length > EPS_MM) || !(radius > EPS_MM)) return null;
  const sleeveFactor = fittingClass === 'OLET' && diameter < entry.contract.diameterMm * 1.01 ? 1.12 : 1.08;
  return {
    name: `${fittingClass}_NODE_${entry.node}_LEG_${index + 1}_${entry.contract.name}`,
    sourceContractName: entry.contract.name,
    sourceDtxr: entry.contract.dtxr,
    startMm: nodePoint.map(round),
    endMm: vadd(nodePoint, scale(entry.directionOut, length)).map(round),
    radiusMm: round(radius * sleeveFactor),
    lengthMm: round(length),
    direction: entry.directionOut.map(round)
  };
}

function histogram(values) {
  return values.reduce((out, value) => {
    out[value] = (out[value] || 0) + 1;
    return out;
  }, {});
}

function unitVector(vector) {
  const len = Math.hypot(vector?.[0] || 0, vector?.[1] || 0, vector?.[2] || 0);
  if (!(len > EPS_MM)) return [1, 0, 0];
  return vector.map((value) => value / len);
}

function vadd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scale(v, factor) { return [v[0] * factor, v[1] * factor, v[2] * factor]; }
function round(value) { return Number(Number(value).toFixed(6)); }
