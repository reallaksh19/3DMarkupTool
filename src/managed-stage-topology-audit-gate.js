import { assertManagedStageTopologyQualityGate } from './managed-stage-topology-quality-gate.js?v=bust-cache-4';

export const MANAGED_STAGE_TOPOLOGY_PROOF_GATE_SCHEMA = 'ManagedStageTopologyProofGate.v2';

export function assertManagedStageTopologyProofGate(audit = {}, expectations = {}) {
  const issues = [];
  const topologyAudit = audit.supportTopologyAudit || audit.topologyAudit || {};
  const topologySummary = topologyAudit.summary || {};
  const validation = topologyAudit.validation || {};
  const faceSummary = topologyAudit.faceModel?.summary || {};
  const supportExport = audit.supportRvmExportAudit || {};
  const supportGateSummary = supportExport.supportTopologyGateSummary || {};
  let qualityGate = null;

  try {
    qualityGate = assertManagedStageTopologyQualityGate(topologyAudit, expectations);
  } catch (error) {
    issues.push(error.message);
    qualityGate = error?.gate || null;
  }

  requireTruthy(topologyAudit.schema, 'supportTopologyAudit.schema', issues);
  requireTruthy(validation.ready === true, 'supportTopologyAudit.validation.ready', issues);
  requireEqual(topologySummary.supportContinuityEdgeCount || 0, 0, 'topology support continuity edge count', issues);
  requireEqual(faceSummary.supportInlineFaceCount || 0, 0, 'topology support inline face count', issues);
  requireEqual(supportExport.supportTopologyGatePass, true, 'support RVM topology gate pass', issues);
  requireEqual(supportExport.supportTopologyBlockedCount || 0, 0, 'support RVM topology blocked count', issues);
  requireEqual(supportExport.supportContinuityEdgeCount || 0, 0, 'support RVM continuity edge count', issues);
  requireEqual(supportExport.supportInlineFaceCount || 0, 0, 'support RVM inline face count', issues);

  checkExpected(expectations.topologyComponentCount, topologySummary.componentCount, 'expected topology component count', issues);
  checkExpected(expectations.topologyGeometryComponentCount, topologySummary.geometryComponentCount, 'expected topology geometry component count', issues);
  checkExpected(expectations.topologySupportCount, topologySummary.supportCount, 'expected topology support count', issues);
  checkExpected(expectations.explicitBendRecordCount, topologySummary.explicitBendRecordCount, 'expected explicit BEND record count', issues);
  checkExpected(expectations.explicitBendDetailCount, topologySummary.explicitBendDetailCount, 'expected explicit BEND detail count', issues);
  checkExpected(expectations.missingExplicitBendDetailCount, topologySummary.missingExplicitBendDetailCount, 'expected missing explicit BEND detail count', issues);
  checkExpected(expectations.synthetic1p5DTrimBlockedCount, topologySummary.synthetic1p5DTrimBlockedCount, 'expected synthetic 1.5D trim blocked count', issues);
  checkExpected(expectations.supportAssociationOnlyCount, supportExport.supportAssociationOnlyCount, 'expected support association-only count', issues);
  checkExpected(expectations.supportTopologyBlockedCount, supportExport.supportTopologyBlockedCount || 0, 'expected support topology blocked count', issues);
  checkExpected(expectations.supportContinuityEdgeCount, supportExport.supportContinuityEdgeCount || 0, 'expected support continuity edge count', issues);
  checkExpected(expectations.supportInlineFaceCount, supportExport.supportInlineFaceCount || 0, 'expected support inline face count', issues);
  checkExpected(expectations.internalDisconnectedRequiredPortCount, qualityGate?.internalDisconnectedRequiredPortCount || 0, 'expected internal disconnected required port count', issues);
  checkExpected(expectations.highDegreeTopologyNodeCount, qualityGate?.highDegreeTopologyNodeCount || 0, 'expected high-degree topology node count', issues);
  checkExpected(expectations.nodeCoordinateConflictCount, qualityGate?.nodeCoordinateConflictCount || 0, 'expected node coordinate conflict count', issues);
  checkExpected(expectations.invalidBranchNodeDegreeCount, qualityGate?.invalidBranchNodeDegreeCount || 0, 'expected invalid branch node degree count', issues);

  if (issues.length) throw new Error(`Managed-stage topology proof gate failed: ${issues.join('; ')}`);

  return {
    schema: MANAGED_STAGE_TOPOLOGY_PROOF_GATE_SCHEMA,
    ok: true,
    topologyAuditSchema: topologyAudit.schema,
    topologyReady: validation.ready === true,
    topologyQualityGate: qualityGate,
    topologyQualityGateOk: qualityGate?.ok === true,
    topologyComponentCount: Number(topologySummary.componentCount || 0),
    topologyGeometryComponentCount: Number(topologySummary.geometryComponentCount || 0),
    topologySupportCount: Number(topologySummary.supportCount || 0),
    explicitBendRecordCount: Number(topologySummary.explicitBendRecordCount || 0),
    explicitBendDetailCount: Number(topologySummary.explicitBendDetailCount || 0),
    missingExplicitBendDetailCount: Number(topologySummary.missingExplicitBendDetailCount || 0),
    synthetic1p5DTrimBlockedCount: Number(topologySummary.synthetic1p5DTrimBlockedCount || 0),
    supportAssociationOnlyCount: Number(supportExport.supportAssociationOnlyCount || supportGateSummary.associationOnlyCount || 0),
    supportTopologyBlockedCount: Number(supportExport.supportTopologyBlockedCount || supportGateSummary.blockedCount || 0),
    supportContinuityEdgeCount: Number(supportExport.supportContinuityEdgeCount || supportGateSummary.supportContinuityEdgeCount || 0),
    supportInlineFaceCount: Number(supportExport.supportInlineFaceCount || supportGateSummary.supportInlineFaceCount || 0),
    supportTopologyGatePass: supportExport.supportTopologyGatePass === true
  };
}

function checkExpected(expected, actual, label, issues) {
  if (expected !== undefined && Number(actual) !== Number(expected)) issues.push(`${label}: expected ${expected}, got ${actual}`);
}

function requireEqual(actual, expected, label, issues) {
  if (actual !== expected) issues.push(`${label}: expected ${expected}, got ${actual}`);
}

function requireTruthy(value, label, issues) {
  if (!value) issues.push(`${label}: expected truthy value`);
}
