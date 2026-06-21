const EPS_MM = 1e-6;
const DEFAULT_RECONSTRUCTED_BEND_SEGMENTS = 5;
const PERPENDICULAR_DOT_TOLERANCE = 0.3;
const NODE_BEND_PARALLEL_DOT_LIMIT = 0.95;

export function applyManagedStageInputXmlBendExclusion(contracts = [], config = {}) {
  if (!config.excludeBendsWhileProcessingInputXmlBasedJson) {
    return {
      contracts,
      audit: emptyAudit(contracts, config, 'disabled')
    };
  }

  const bendContracts = contracts.filter((contract) => contract?.dtxr === 'BEND');
  const trims = new Map();
  const genericBends = [];
  const trimApplications = [];
  const skippedTrimSources = [];
  const issues = [];
  const byName = new Map(contracts.map((contract) => [contract?.name, contract]).filter(([name]) => name));
  const byNode = buildNodeIndex(contracts);
  const genericBendByName = new Map();

  for (const bend of bendContracts) {
    const trimLengthMm = bendTrimLengthMm(bend, config);
    const sources = bend.arc?.tangentHintSources || {};
    const applied = [];
    const trimEligibility = resolveSimplePerpendicularTrimEligibility(bend, sources, byName, byNode);
    const nodePlan = buildNodeBasedReconstructedBendPlan(bend, byNode, trimLengthMm, config);

    for (const [role, node] of [['start', bend.fromNode], ['end', bend.toNode]]) {
      const sourceName = sources[role] || '';
      const source = byName.get(sourceName);
      if (!source) {
        skippedTrimSources.push({ bendName: bend.name, bendRole: role, node: String(node), reason: 'no tangent source contract' });
        continue;
      }
      if (source.dtxr === 'BEND') {
        skippedTrimSources.push({ bendName: bend.name, bendRole: role, node: String(node), sourceName, reason: 'adjacent source is another BEND' });
        continue;
      }
      if (!trimEligibility.ok) {
        skippedTrimSources.push({
          bendName: bend.name,
          bendRole: role,
          node: String(node),
          sourceName,
          reason: trimEligibility.reason
        });
        continue;
      }
      const appliedTrim = addTrim(trims, source, node, trimLengthMm, config, bend, role);
      if (appliedTrim) {
        trimApplications.push(appliedTrim);
        applied.push(appliedTrim);
      }
    }

    const nodePlanTrimApplications = addNodePlanTrims(trims, nodePlan, byName, trimLengthMm, config, bend);
    for (const entry of nodePlanTrimApplications) {
      trimApplications.push(entry);
      applied.push(entry);
    }

    const segments = nodePlan?.segments || [];
    if (!nodePlan) {
      issues.push(`No node-based elbow reconstruction candidate found for ${bend.name}`);
    }
    const bendPlan = {
      name: bend.name,
      fromNode: bend.fromNode,
      toNode: bend.toNode,
      originalBendRadiusMm: bend.arc?.bendRadiusMm || null,
      genericBendRadiusMm: round(trimLengthMm),
      radiusMultiplier: config.genericInputXmlBendRadiusMultiplier,
      emittedAs: 'code8-node-based-1p5d-reconstructed-elbow-cylinders',
      reconstructionMode: nodePlan?.mode || 'missing-node-based-corner',
      reconstructionNode: nodePlan?.node || null,
      incomingSource: nodePlan?.incomingSource || bend.name,
      outgoingSource: nodePlan?.outgoingSource || null,
      incomingDirection: nodePlan?.incomingDirection || null,
      outgoingDirection: nodePlan?.outgoingDirection || null,
      tangentDot: nodePlan?.tangentDot ?? null,
      segmentCount: segments.length,
      segments: segments.map((segment) => ({ role: segment.role, startMm: segment.startMm, endMm: segment.endMm, lengthMm: segment.lengthMm })),
      trimEligibility,
      nodePlanTrimApplications: nodePlanTrimApplications.map((entry) => ({
        contractName: entry.contractName,
        node: entry.node,
        side: entry.side,
        trimMm: entry.trimMm,
        trimSource: entry.trimSource
      })),
      trimApplications: applied.map((entry) => ({
        contractName: entry.contractName,
        node: entry.node,
        side: entry.side,
        trimMm: entry.trimMm,
        bendRole: entry.bendRole
      }))
    };
    genericBends.push(bendPlan);
    genericBendByName.set(bend.name, bendPlan);
  }

  const adjusted = contracts.map((contract) => {
    if (contract?.dtxr === 'BEND') {
      const trimLengthMm = bendTrimLengthMm(contract, config);
      const bendPlan = genericBendByName.get(contract.name);
      return {
        ...contract,
        excludeCode4Bend: true,
        genericInputXmlBend: {
          schema: 'ManagedStageInputXmlGenericBend.v4',
          mode: 'code8-node-based-1p5d-reconstructed-elbow-cylinders',
          radiusMultiplier: config.genericInputXmlBendRadiusMultiplier,
          genericBendRadiusMm: round(trimLengthMm),
          trimLengthMm: round(trimLengthMm),
          originalBendRadiusMm: contract.arc?.bendRadiusMm || null,
          reconstructionNode: bendPlan?.reconstructionNode || null,
          reconstructionMode: bendPlan?.reconstructionMode || 'missing-node-based-corner',
          incomingSource: bendPlan?.incomingSource || contract.name,
          outgoingSource: bendPlan?.outgoingSource || null,
          incomingDirection: bendPlan?.incomingDirection || null,
          outgoingDirection: bendPlan?.outgoingDirection || null,
          tangentDot: bendPlan?.tangentDot ?? null,
          segments: bendPlan?.segments || [],
          trimEligibility: bendPlan?.trimEligibility || null,
          nodePlanTrimApplications: bendPlan?.nodePlanTrimApplications || [],
          reason: config.reason || 'InputXML-based JSON bend exclusion is ON'
        }
      };
    }
    const trim = trims.get(contract.name);
    if (!trim) return contract;
    return {
      ...contract,
      rvmTrimStartOffsetMm: round(trim.start),
      rvmTrimEndOffsetMm: round(trim.end),
      inputXmlBendTrimmed: true,
      inputXmlBendTrimSources: trim.sources
    };
  });

  return {
    contracts: adjusted,
    audit: {
      schema: 'ManagedStageInputXmlBendExclusionAudit.v1',
      enabled: true,
      inputXmlBasedJson: true,
      mode: 'inputxml-json-node-based-1p5d-reconstructed-elbows',
      radiusMultiplier: config.genericInputXmlBendRadiusMultiplier,
      trimMaxContractFraction: config.inputXmlBendTrimMaxContractFraction,
      bendCount: bendContracts.length,
      code4BendsExcluded: bendContracts.length,
      genericCode8BendsPlanned: genericBends.length,
      genericCode8BendPrimitiveCount: genericBends.reduce((sum, bend) => sum + bend.segmentCount, 0),
      nodeBasedReconstructedBendCount: genericBends.filter((bend) => bend.reconstructionMode === 'node-based-direction-change').length,
      chordFallbackBendCount: 0,
      trimmedContractCount: trims.size,
      trimApplicationCount: trimApplications.length,
      skippedTrimSources,
      genericBends,
      trimApplications,
      issues,
      ok: issues.length === 0
    }
  };
}

export function assertManagedStageInputXmlBendExclusionAudit(audit = {}, expectations = {}) {
  if (audit.schema !== 'ManagedStageInputXmlBendExclusionAudit.v1') throw new Error('Invalid InputXML bend exclusion audit schema');
  if (audit.enabled && !audit.ok) throw new Error(`InputXML bend exclusion audit failed: ${(audit.issues || []).join('; ')}`);
  if (expectations.enabled !== undefined && audit.enabled !== expectations.enabled) {
    throw new Error(`InputXML bend exclusion enabled expected ${expectations.enabled}, got ${audit.enabled}`);
  }
  if (expectations.code4BendsExcluded !== undefined && audit.code4BendsExcluded !== expectations.code4BendsExcluded) {
    throw new Error(`InputXML code4 excluded count expected ${expectations.code4BendsExcluded}, got ${audit.code4BendsExcluded}`);
  }
  if (expectations.genericCode8BendsPlanned !== undefined && audit.genericCode8BendsPlanned !== expectations.genericCode8BendsPlanned) {
    throw new Error(`Generic code8 bend count expected ${expectations.genericCode8BendsPlanned}, got ${audit.genericCode8BendsPlanned}`);
  }
  if (expectations.genericCode8BendPrimitiveCount !== undefined && audit.genericCode8BendPrimitiveCount !== expectations.genericCode8BendPrimitiveCount) {
    throw new Error(`Generic code8 bend primitive count expected ${expectations.genericCode8BendPrimitiveCount}, got ${audit.genericCode8BendPrimitiveCount}`);
  }
  if (expectations.nodeBasedReconstructedBendCount !== undefined && audit.nodeBasedReconstructedBendCount !== expectations.nodeBasedReconstructedBendCount) {
    throw new Error(`Node-based reconstructed bend count expected ${expectations.nodeBasedReconstructedBendCount}, got ${audit.nodeBasedReconstructedBendCount}`);
  }
  if (expectations.chordFallbackBendCount !== undefined && audit.chordFallbackBendCount !== expectations.chordFallbackBendCount) {
    throw new Error(`Chord fallback bend count expected ${expectations.chordFallbackBendCount}, got ${audit.chordFallbackBendCount}`);
  }
  return true;
}

function emptyAudit(contracts, config, state) {
  const bendCount = contracts.filter((contract) => contract?.dtxr === 'BEND').length;
  return {
    schema: 'ManagedStageInputXmlBendExclusionAudit.v1',
    enabled: false,
    inputXmlBasedJson: Boolean(config.inputXmlBasedJson),
    mode: state,
    radiusMultiplier: config.genericInputXmlBendRadiusMultiplier,
    trimMaxContractFraction: config.inputXmlBendTrimMaxContractFraction,
    bendCount,
    code4BendsExcluded: 0,
    genericCode8BendsPlanned: 0,
    genericCode8BendPrimitiveCount: 0,
    nodeBasedReconstructedBendCount: 0,
    chordFallbackBendCount: 0,
    trimmedContractCount: 0,
    trimApplicationCount: 0,
    skippedTrimSources: [],
    genericBends: [],
    trimApplications: [],
    issues: [],
    ok: true
  };
}

function addTrim(trims, source, node, requestedTrimMm, config, bend, role) {
  const side = trimSideForNode(source, node);
  if (!side) return null;
  const maxTrim = Math.max(0, source.lengthMm * config.inputXmlBendTrimMaxContractFraction);
  const trimMm = round(Math.min(requestedTrimMm, maxTrim));
  if (!(trimMm > EPS_MM)) return null;
  const entry = trims.get(source.name) || { start: 0, end: 0, sources: [] };
  if (side === 'start') entry.start = Math.max(entry.start, trimMm);
  else entry.end = Math.max(entry.end, trimMm);
  const application = {
    bendName: bend.name,
    bendRole: role,
    contractName: source.name,
    contractDtxr: source.dtxr,
    node: String(node),
    side,
    requestedTrimMm: round(requestedTrimMm),
    trimMm,
    cappedByContractLength: trimMm < requestedTrimMm
  };
  entry.sources.push(application);
  trims.set(source.name, entry);
  return application;
}

function addNodePlanTrims(trims, nodePlan, byName, requestedTrimMm, config, bend) {
  if (!nodePlan?.node) return [];
  const applications = [];
  const sourceNames = [nodePlan.incomingSource, nodePlan.outgoingSource]
    .filter((sourceName) => sourceName && sourceName !== bend.name);
  for (const sourceName of new Set(sourceNames)) {
    const source = byName.get(sourceName);
    if (!source || source.dtxr === 'BEND' || source.emitGeometry === false) continue;
    const application = addTrim(trims, source, nodePlan.node, requestedTrimMm, config, bend, 'node-plan');
    if (application) applications.push({ ...application, trimSource: 'node-based-reconstructed-elbow' });
  }
  return applications;
}

function buildNodeBasedReconstructedBendPlan(bend, byNode, trimLengthMm, config = {}) {
  const segmentCount = Math.max(3, Math.floor(Number(config.genericInputXmlBendSegmentCount) || DEFAULT_RECONSTRUCTED_BEND_SEGMENTS));
  const preferredNodes = [bend.toNode, bend.fromNode].filter((node) => node !== undefined && node !== null && node !== '');
  for (const node of preferredNodes) {
    const plan = buildNodeBasedBendAtNode(bend, node, byNode, trimLengthMm, segmentCount);
    if (plan) return plan;
  }
  return null;
}

function buildNodeBasedBendAtNode(bend, node, byNode, trimLengthMm, segmentCount) {
  const corner = nodePointForContract(bend, node);
  const incomingAway = tangentAwayFromNode(bend, node);
  if (!corner || !incomingAway) return null;

  const candidates = (byNode.get(String(node)) || [])
    .filter((contract) => contract?.name !== bend.name && contract?.dtxr !== 'ATTA' && contract?.emitGeometry !== false)
    .map((contract) => ({ contract, away: tangentAwayFromNode(contract, node) }))
    .filter((candidate) => candidate.away);

  const usable = candidates
    .map((candidate) => ({
      ...candidate,
      tangentDot: dot(incomingAway, candidate.away),
      absDot: Math.abs(dot(incomingAway, candidate.away))
    }))
    .filter((candidate) => candidate.absDot < NODE_BEND_PARALLEL_DOT_LIMIT)
    .sort((a, b) => a.absDot - b.absDot);

  const selected = usable[0];
  if (!selected) return null;

  const start = vadd(corner, scale(incomingAway, trimLengthMm));
  const end = vadd(corner, scale(selected.away, trimLengthMm));
  const curvePoints = quadraticCornerCurve(start, corner, end, segmentCount);
  const segments = segmentsFromPoints(curvePoints, 'node-arc');
  if (segments.length < 3) return null;

  return {
    mode: 'node-based-direction-change',
    node: String(node),
    incomingSource: bend.name,
    outgoingSource: selected.contract.name,
    incomingDirection: incomingAway.map(round),
    outgoingDirection: selected.away.map(round),
    tangentDot: round(selected.tangentDot),
    segments
  };
}

function quadraticCornerCurve(start, corner, end, segmentCount) {
  const points = [];
  for (let index = 0; index <= segmentCount; index += 1) {
    const t = index / segmentCount;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    points.push([
      a * start[0] + b * corner[0] + c * end[0],
      a * start[1] + b * corner[1] + c * end[1],
      a * start[2] + b * corner[2] + c * end[2]
    ]);
  }
  return points;
}

function segmentsFromPoints(points, prefix) {
  const out = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const built = segment(`${prefix}-${index + 1}`, points[index], points[index + 1]);
    if (built) out.push(built);
  }
  return out;
}

function resolveSimplePerpendicularTrimEligibility(bend, sources, byName, byNode) {
  const startSource = byName.get(sources.start || '');
  const endSource = byName.get(sources.end || '');
  if (!startSource || !endSource) return { ok: false, reason: 'missing start/end tangent source' };
  if (!isPipeLikeLine(startSource) || !isPipeLikeLine(endSource)) return { ok: false, reason: 'trim source is not two pipe-only line contracts' };
  if (!isSimpleTwoConnectionNode(byNode, bend.fromNode, bend.name, startSource.name)) return { ok: false, reason: 'start node is not a 2-pipe-only intersection' };
  if (!isSimpleTwoConnectionNode(byNode, bend.toNode, bend.name, endSource.name)) return { ok: false, reason: 'end node is not a 2-pipe-only intersection' };
  const startTangent = tangentFromSourceAtNode(startSource, bend.fromNode, 'start');
  const endTangent = tangentFromSourceAtNode(endSource, bend.toNode, 'end');
  if (!startTangent || !endTangent) return { ok: false, reason: 'missing trim tangent vector' };
  const tangentDot = Math.abs(dot(unitOrNull(startTangent), unitOrNull(endTangent)));
  if (tangentDot > PERPENDICULAR_DOT_TOLERANCE) return { ok: false, reason: 'adjacent pipe tangents are not perpendicular' };
  return { ok: true, reason: 'simple perpendicular 2-pipe bend intersection', tangentDot: round(tangentDot) };
}

function buildNodeIndex(contracts) {
  const byNode = new Map();
  for (const contract of contracts) {
    if (contract?.schema !== 'ManagedStageGeometryContract.v1') continue;
    addConnection(byNode, contract, contract.fromNode);
    addConnection(byNode, contract.toNode ? contract : null, contract.toNode);
  }
  return byNode;
}

function addConnection(byNode, contract, node) {
  if (!contract || !node) return;
  const key = String(node);
  if (!byNode.has(key)) byNode.set(key, []);
  byNode.get(key).push(contract);
}

function isSimpleTwoConnectionNode(byNode, node, bendName, sourceName) {
  const usable = (byNode.get(String(node)) || []).filter((contract) => contract?.dtxr !== 'ATTA' && contract?.emitGeometry !== false);
  if (usable.length !== 2) return false;
  if (!usable.some((contract) => contract.name === bendName)) return false;
  const source = usable.find((contract) => contract.name === sourceName);
  return isPipeLikeLine(source);
}

function isPipeLikeLine(contract) {
  if (!contract || contract.centerlineKind !== 'line') return false;
  return contract.dtxr === 'PIPE' || contract.dtxr === 'UNSPECIFIED';
}

function nodePointForContract(contract, node) {
  if (String(contract.fromNode) === String(node)) return contract.startMm;
  if (String(contract.toNode) === String(node)) return contract.endMm;
  return null;
}

function tangentAwayFromNode(contract, node) {
  const axis = unitOrNull(contract?.axis);
  if (!axis) return null;
  if (String(contract.fromNode) === String(node)) return axis;
  if (String(contract.toNode) === String(node)) return scale(axis, -1);
  return null;
}

function tangentFromSourceAtNode(source, node, role) {
  const axis = unitOrNull(source.axis);
  if (!axis) return null;
  const fromMatch = String(source.fromNode) === String(node);
  const toMatch = String(source.toNode) === String(node);
  if (role === 'start') return toMatch ? axis : scale(axis, -1);
  return fromMatch ? axis : scale(axis, -1);
}

function segment(role, startMm, endMm) {
  const lengthMm = distance(startMm, endMm);
  if (!(lengthMm > EPS_MM)) return null;
  return { role, startMm: startMm.map(round), endMm: endMm.map(round), lengthMm: round(lengthMm) };
}

function trimSideForNode(contract, node) {
  if (String(contract.fromNode) === String(node)) return 'start';
  if (String(contract.toNode) === String(node)) return 'end';
  return '';
}

function bendTrimLengthMm(bend, config) {
  return positiveNumber(bend.diameterMm, `${bend.name}.diameterMm`) * positiveNumber(config.genericInputXmlBendRadiusMultiplier, 'genericInputXmlBendRadiusMultiplier');
}

function positiveNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid ${fieldName}: expected positive number`);
  return parsed;
}

function unitOrNull(vector) {
  if (!Array.isArray(vector) || vector.length !== 3) return null;
  const len = Math.hypot(vector[0], vector[1], vector[2]);
  if (!(len > EPS_MM)) return null;
  return vector.map((value) => value / len);
}

function distance(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function scale(v, factor) { return [v[0] * factor, v[1] * factor, v[2] * factor]; }
function vadd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function round(value) { return Number(Number(value).toFixed(6)); }
