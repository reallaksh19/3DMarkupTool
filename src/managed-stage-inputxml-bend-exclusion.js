const EPS_MM = 1e-6;

export function applyManagedStageInputXmlBendExclusion(contracts = [], config = {}) {
  if (!config.excludeBendsWhileProcessingInputXmlBasedJson) {
    return {
      contracts,
      audit: emptyAudit(contracts, config, 'disabled')
    };
  }

  const bendContracts = contracts.filter((contract) => contract?.dtxr === 'BEND');
  const genericBends = [];
  const issues = [];

  for (const bend of bendContracts) {
    const segment = sourceRouteSegment(bend);
    if (!segment) {
      issues.push(`No source-route BEND cylinder could be built for ${bend.name}`);
      continue;
    }
    genericBends.push({
      name: bend.name,
      fromNode: bend.fromNode,
      toNode: bend.toNode,
      originalBendRadiusMm: bend.arc?.bendRadiusMm || null,
      genericBendRadiusMm: null,
      radiusMultiplier: config.genericInputXmlBendRadiusMultiplier,
      emittedAs: 'code8-source-route-cylinder',
      reconstructionMode: 'source-route-centerline-preserved',
      reconstructionNode: null,
      incomingSource: bend.name,
      outgoingSource: null,
      incomingDirection: null,
      outgoingDirection: null,
      tangentDot: null,
      segmentCount: 1,
      segments: [segment],
      trimEligibility: { ok: false, reason: 'InputXML BEND APOS/LPOS preserved as source route; no destructive source trim' },
      nodePlanTrimApplications: [],
      trimApplications: []
    });
  }

  const genericBendByName = new Map(genericBends.map((bend) => [bend.name, bend]));
  const adjusted = contracts.map((contract) => {
    if (contract?.dtxr !== 'BEND') return contract;
    const bendPlan = genericBendByName.get(contract.name);
    return {
      ...contract,
      excludeCode4Bend: true,
      genericInputXmlBend: {
        schema: 'ManagedStageInputXmlGenericBend.v5',
        mode: 'code8-source-route-cylinder',
        radiusMultiplier: config.genericInputXmlBendRadiusMultiplier,
        genericBendRadiusMm: null,
        trimLengthMm: 0,
        originalBendRadiusMm: contract.arc?.bendRadiusMm || null,
        reconstructionNode: null,
        reconstructionMode: 'source-route-centerline-preserved',
        incomingSource: contract.name,
        outgoingSource: null,
        incomingDirection: null,
        outgoingDirection: null,
        tangentDot: null,
        segments: bendPlan?.segments || [],
        trimEligibility: bendPlan?.trimEligibility || null,
        nodePlanTrimApplications: [],
        sourceRoutePreserved: true,
        reason: config.reason || 'InputXML-based JSON BEND APOS/LPOS is preserved as source-route RVM geometry'
      }
    };
  });

  return {
    contracts: adjusted,
    audit: {
      schema: 'ManagedStageInputXmlBendExclusionAudit.v1',
      enabled: true,
      inputXmlBasedJson: true,
      mode: 'inputxml-json-source-route-bend-cylinders',
      radiusMultiplier: config.genericInputXmlBendRadiusMultiplier,
      trimMaxContractFraction: config.inputXmlBendTrimMaxContractFraction,
      bendCount: bendContracts.length,
      code4BendsExcluded: bendContracts.length,
      genericCode8BendsPlanned: genericBends.length,
      genericCode8BendPrimitiveCount: genericBends.reduce((sum, bend) => sum + bend.segmentCount, 0),
      nodeBasedReconstructedBendCount: 0,
      chordFallbackBendCount: 0,
      sourceRouteBendCount: genericBends.length,
      trimmedContractCount: 0,
      trimApplicationCount: 0,
      skippedTrimSources: [],
      genericBends,
      trimApplications: [],
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
    sourceRouteBendCount: 0,
    trimmedContractCount: 0,
    trimApplicationCount: 0,
    skippedTrimSources: [],
    genericBends: [],
    trimApplications: [],
    issues: [],
    ok: true
  };
}

function sourceRouteSegment(bend) {
  if (!Array.isArray(bend?.startMm) || !Array.isArray(bend?.endMm)) return null;
  return segment('source-route', bend.startMm, bend.endMm);
}

function segment(role, startMm, endMm) {
  const lengthMm = distance(startMm, endMm);
  if (!(lengthMm > EPS_MM)) return null;
  return { role, startMm: startMm.map(round), endMm: endMm.map(round), lengthMm: round(lengthMm) };
}

function distance(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function round(value) { return Number(Number(value).toFixed(6)); }
