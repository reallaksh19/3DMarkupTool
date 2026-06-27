export function summarizeManagedStageRvmAudit(audit = {}) {
  const payload = audit.rvmPrimitivePayloadSemanticsAudit || {};
  const geometry = audit.rvmGeometryAudit || {};
  const segment = audit.rvmSegmentAudit || {};
  const support = audit.supportRvmExportAudit || {};
  const stitch = audit.stitchManifest || {};
  const payloadIssueCount = Number(payload.issueCount || 0);
  const geometryIssueCount = Number(geometry.issueCount || 0);
  const segmentIssueCount = Number(segment.issueCount || 0);
  const supportForbiddenCount = Array.isArray(support.supportForbiddenPrimitiveCodesPresent) ? support.supportForbiddenPrimitiveCodesPresent.length : 0;
  const strictGateOk = audit.managedStageStrictGate?.ok !== false;
  const topologyGateOk = audit.managedStageTopologyProofGate?.ok !== false;
  const stitchGateOk = audit.stitchManifestGate?.ok !== false;
  const segmentOk = segment.ok !== false;
  const ready = payloadIssueCount === 0 && geometryIssueCount === 0 && segmentIssueCount === 0 && supportForbiddenCount === 0 && strictGateOk && topologyGateOk && stitchGateOk && segmentOk;

  return {
    schema: 'ManagedStageRvmAuditSummary.v1',
    ready,
    readinessFlags: { payloadSemanticsOk: payloadIssueCount === 0, geometrySeparationOk: geometryIssueCount === 0, segmentAuditOk: segmentOk && segmentIssueCount === 0, supportOverlayOk: supportForbiddenCount === 0, strictGateOk, topologyGateOk, stitchManifestOk: stitchGateOk },
    counts: { geometryComponents: audit.inputCounts?.geometryComponents || 0, supportRecords: audit.inputCounts?.supportRecordsEmittedToRvm || 0, cntb: audit.chunkHierarchy?.cntbCount || 0, prim: audit.chunkHierarchy?.primCount || 0, rvmBytes: audit.rvmBytes || 0, attBytes: audit.attBytes || 0 },
    primitiveHistogram: audit.primitiveHistogram || {},
    payloadIssues: { total: payloadIssueCount, code4: payload.code4?.issueCount || 0, code7: payload.code7?.issueCount || 0, code9: payload.code9?.issueCount || 0 },
    geometry: { primitiveCount: geometry.geometry?.primitiveCount || stitch.geometryPrimitiveCount || 0, primitiveCodeHistogram: geometry.geometry?.primitiveCodeHistogram || {}, primitiveRoleTagCounts: geometry.geometry?.primitiveRoleTagCounts || {}, code4Count: geometry.geometry?.code4Elbows?.count || 0, code7Count: geometry.geometry?.code7Snouts?.count || 0, code8Count: geometry.geometry?.code8Cylinders?.count || 0, code9Count: geometry.geometry?.code9Spheres?.count || 0 },
    segmentAudit: { issueCount: segmentIssueCount, cleanElementCount: segment.cleanElementCount || 0, maxEndpointGapMm: segment.maxEndpointGapMm || 0 },
    supportOverlay: { primitiveCount: geometry.supportOverlay?.primitiveCount || stitch.supportOverlayPrimitiveCount || 0, primitiveCodeHistogram: geometry.supportOverlay?.primitiveCodeHistogram || support.supportPrimitiveCodeHistogram || {}, allowedPrimitiveCodes: geometry.supportOverlay?.allowedPrimitiveCodes || stitch.supportOverlayAllowedPrimitiveCodes || [], isolatedFromPipeFittingCodes: geometry.supportOverlay?.isolatedFromPipeFittingCodes !== false, nonCode8PrimitiveCount: geometry.supportOverlay?.nonCode8PrimitiveCount || 0 },
    artifacts: { rvmBytes: audit.rvmBytes || 0, attBytes: audit.attBytes || 0, cntbCoordinatePolicy: audit.cntbCoordinatePolicy || '', generationMode: audit.generationMode || '' }
  };
}
