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
  const issues = [];
  const byName = new Map(contracts.map((contract) => [contract?.name, contract]).filter(([name]) => name));

  for (const bend of bendContracts) {
    const trimLengthMm = bendTrimLengthMm(bend, config);
    const sources = bend.arc?.tangentHintSources || {};
    const applied = [];
    for (const [role, node] of [['start', bend.fromNode], ['end', bend.toNode]]) {
      const sourceName = sources[role] || '';
      const source = byName.get(sourceName);
      if (!source) {
        issues.push(`${bend.name}: no ${role} tangent source contract to trim`);
        continue;
      }
      if (source.dtxr === 'BEND') {
        issues.push(`${bend.name}: ${role} tangent source is another BEND (${sourceName})`);
        continue;
      }
      const appliedTrim = addTrim(trims, source, node, trimLengthMm, config, bend, role);
      if (appliedTrim) {
        trimApplications.push(appliedTrim);
        applied.push(appliedTrim);
      }
    }
    genericBends.push({
      name: bend.name,
      fromNode: bend.fromNode,
      toNode: bend.toNode,
      originalBendRadiusMm: bend.arc?.bendRadiusMm || null,
      genericBendRadiusMm: round(trimLengthMm),
      radiusMultiplier: config.genericInputXmlBendRadiusMultiplier,
      emittedAs: 'code8-generic-1p5d-chord-cylinder',
      trimApplications: applied.map((entry) => ({
        contractName: entry.contractName,
        node: entry.node,
        side: entry.side,
        trimMm: entry.trimMm
      }))
    });
  }

  const adjusted = contracts.map((contract) => {
    if (contract?.dtxr === 'BEND') {
      const trimLengthMm = bendTrimLengthMm(contract, config);
      return {
        ...contract,
        excludeCode4Bend: true,
        genericInputXmlBend: {
          schema: 'ManagedStageInputXmlGenericBend.v1',
          mode: 'code8-generic-1p5d-chord-cylinder',
          radiusMultiplier: config.genericInputXmlBendRadiusMultiplier,
          genericBendRadiusMm: round(trimLengthMm),
          trimLengthMm: round(trimLengthMm),
          originalBendRadiusMm: contract.arc?.bendRadiusMm || null,
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
      mode: 'inputxml-json-generic-1p5d-bends',
      radiusMultiplier: config.genericInputXmlBendRadiusMultiplier,
      trimMaxContractFraction: config.inputXmlBendTrimMaxContractFraction,
      bendCount: bendContracts.length,
      code4BendsExcluded: bendContracts.length,
      genericCode8BendsPlanned: genericBends.length,
      trimmedContractCount: trims.size,
      trimApplicationCount: trimApplications.length,
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
    trimmedContractCount: 0,
    trimApplicationCount: 0,
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

function round(value) {
  return Number(Number(value).toFixed(6));
}
