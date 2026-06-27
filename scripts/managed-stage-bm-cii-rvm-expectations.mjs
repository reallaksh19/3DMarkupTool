export const BM_CII_MANAGED_STAGE_RVM_PRIMITIVE_HISTOGRAM = Object.freeze({
  4: 7,
  7: 6,
  8: 110,
  9: 6
});

export function bmCiiManagedStageRvmExpectations() {
  return {
    geometryComponents: 40,
    supportRecordsSkippedFromGeometry: 12,
    supportRecordsEmittedToRvm: 12,
    supportRvmPrimitiveCount: 42,
    topologyComponentCount: 52,
    topologyGeometryComponentCount: 40,
    topologySupportCount: 12,
    explicitBendRecordCount: 7,
    explicitBendDetailCount: 7,
    missingExplicitBendDetailCount: 0,
    synthetic1p5DTrimBlockedCount: 7,
    supportAssociationOnlyCount: 12,
    supportTopologyBlockedCount: 0,
    supportContinuityEdgeCount: 0,
    supportInlineFaceCount: 0,
    code1: 0,
    code4: 7,
    code7: 6,
    code8: 110,
    code9: 6,
    cntbCount: 56,
    primCount: 129,
    supportMaxGlyphExtentMm: 100,
    supportMaxClusterOffsetMm: 30,
    supportMaxPrimitiveSpanMm: 60,
    supportMaxBarRadiusMm: 3
  };
}

export function assertBmCiiManagedStageRvmHistogram(histogram = {}) {
  const expected = BM_CII_MANAGED_STAGE_RVM_PRIMITIVE_HISTOGRAM;
  const keys = new Set([...Object.keys(expected), ...Object.keys(histogram)].map(String));
  const issues = [];
  for (const key of keys) {
    const actualValue = Number(histogram[key] || 0);
    const expectedValue = Number(expected[key] || 0);
    if (actualValue !== expectedValue) issues.push(`code ${key}: expected ${expectedValue}, got ${actualValue}`);
  }
  if (issues.length) throw new Error(`BM_CII managed-stage RVM primitive histogram mismatch: ${issues.join('; ')}`);
  return true;
}
