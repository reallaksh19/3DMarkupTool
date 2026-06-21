const EPS_MM = 1e-6;

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
  const genericBendByName = new Map();

  for (const bend of bendContracts) {
    const trimLengthMm = bendTrimLengthMm(bend, config);
    const sources = bend.arc?.tangentHintSources || {};
    const applied = [];
    const tangentHints = {};
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
      tangentHints[role] = tangentFromSourceAtNode(source, node, role);
      const appliedTrim = addTrim(trims, source, node, trimLengthMm, config, bend, role);
      if (appliedTrim) {
        trimApplications.push(appliedTrim);
        applied.push(appliedTrim);
      }
    }

    const segments = buildGenericTwoLegBendSegments(bend, tangentHints, trimLengthMm);
    const bendPlan = {
      name: bend.name,
      fromNode: bend.fromNode,
      toNode: bend.toNode,
      originalBendRadiusMm: bend.arc?.bendRadiusMm || null,
      genericBendRadiusMm: round(trimLengthMm),
      radiusMultiplier: config.genericInputXmlBendRadiusMultiplier,
      emittedAs: 'code8-generic-1p5d-two-leg-cylinders',
      segmentCount: segments.length,
      segments: segments.map((segment) => ({ role: segment.role, startMm: segment.startMm, endMm: segment.endMm, lengthMm: segment.lengthMm })),
      trimApplications: applied.map((entry) => ({
        contractName: entry.contractName,
        node: entry.node,
        side: entry.side,
        trimMm: entry.trimMm
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
          schema: 'ManagedStageInputXmlGenericBend.v2',
          mode: 'code8-generic-1p5d-two-leg-cylinders',
          radiusMultiplier: config.genericInputXmlBendRadiusMultiplier,
          genericBendRadiusMm: round(trimLengthMm),
          trimLengthMm: round(trimLengthMm),
          originalBendRadiusMm: contract.arc?.bendRadiusMm || null,
          segments: bendPlan?.segments || [],
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
      mode: 'inputxml-json-generic-1p5d-two-leg-bends',
      radiusMultiplier: config.genericInputXmlBendRadiusMultiplier,
      trimMaxContractFraction: config.inputXmlBendTrimMaxContractFraction,
      bendCount: bendContracts.length,
      code4BendsExcluded: bendContracts.length,
      genericCode8BendsPlanned: genericBends.length,
      genericCode8BendPrimitiveCount: genericBends.reduce((sum, bend) => sum + bend.segmentCount, 0),
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

function buildGenericTwoLegBendSegments(bend, tangentHints, trimLengthMm) {
  const start = bend.startMm;
  const end = bend.endMm;
  const startTangent = unitOrNull(tangentHints.start);
  const endTangent = unitOrNull(tangentHints.end);
  let corner = null;
  if (startTangent && endTangent) {
    corner = closestCornerPoint(start, startTangent, end, scale(endTangent, -1), trimLengthMm);
  }
  if (!corner) corner = midpoint(start, end);
  let segments = [
    segment('start-leg', start, corner),
    segment('end-leg', corner, end)
  ].filter(Boolean);
  if (segments.length < 2) {
    const mid = midpoint(start, end);
    segments = [segment('start-leg', start, mid), segment('end-leg', mid, end)].filter(Boolean);
  }
  return segments;
}

function closestCornerPoint(p, d, q, e, trimLengthMm) {
  const r = vsub(p, q);
  const a = dot(d, d);
  const b = dot(d, e);
  const c = dot(e, e);
  const dd = dot(d, r);
  const ee = dot(e, r);
  const denom = a * c - b * b;
  if (Math.abs(denom) < EPS_MM) return null;
  const t = (b * ee - c * dd) / denom;
  const u = (a * ee - b * dd) / denom;
  const p1 = vadd(p, scale(d, t));
  const p2 = vadd(q, scale(e, u));
  const skewGap = distance(p1, p2);
  const corner = midpoint(p1, p2);
  const chord = distance(p, q);
  const maxLeg = Math.max(chord * 2.5, trimLengthMm * 4);
  if (skewGap > Math.max(trimLengthMm, chord)) return null;
  if (distance(p, corner) > maxLeg || distance(corner, q) > maxLeg) return null;
  return corner;
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
function midpoint(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }
function scale(v, factor) { return [v[0] * factor, v[1] * factor, v[2] * factor]; }
function vadd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function round(value) { return Number(Number(value).toFixed(6)); }
