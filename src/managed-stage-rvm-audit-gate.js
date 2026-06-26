const FORBIDDEN_CODES = Object.freeze([2, 5, 6, 7, 11]);
const ALLOWED_CODES = Object.freeze([1, 4, 8]);
const SUPPORT_ALLOWED_CODES = Object.freeze([8]);
const SUPPORT_FORBIDDEN_CODES = Object.freeze([1, 5, 6, 7, 11]);
const DEFAULT_GAP_TOLERANCE_MM = 0.001;
const DEFAULT_SUPPORT_MAX_GLYPH_EXTENT_MM = 100;
const DEFAULT_SUPPORT_MAX_CLUSTER_OFFSET_MM = 30;
const DEFAULT_SUPPORT_MAX_PRIMITIVE_SPAN_MM = 60;
const DEFAULT_SUPPORT_MAX_BAR_RADIUS_MM = 3;

export function assertManagedStageRvmAuditGate(audit = {}, expectations = {}) {
  const issues = [];
  const primitiveHistogram = normalizeHistogram(audit.primitiveHistogram || {});
  const chunkHierarchy = audit.chunkHierarchy || {};
  const topology = audit.topology || {};
  const inputCounts = audit.inputCounts || {};
  const bbox = audit.boundingExtentsMm || {};
  const stitchManifest = audit.stitchManifest || {};
  const supportExport = audit.supportRvmExportAudit || {};
  const topologyProofGate = audit.managedStageTopologyProofGate || {};
  const toleranceMm = Number(expectations.maxCenterlineGapMm ?? DEFAULT_GAP_TOLERANCE_MM);

  requireEqual(audit.generationMode, 'managed-stage-cylinder-torus', 'generationMode', issues);
  requireEqual(audit.units, 'mm', 'units', issues);
  requirePositive(inputCounts.geometryComponents, 'geometryComponents', issues);
  requireAtLeast(inputCounts.supportRecordsSkippedFromGeometry, 0, 'supportRecordsSkippedFromGeometry', issues);
  requireArrayEmpty(topology.zeroLength, 'topology.zeroLength', issues);
  requireArrayEmpty(topology.warnings, 'topology.warnings', issues);
  requireMax(topology.maxCenterlineGapMm, toleranceMm, 'topology.maxCenterlineGapMm', issues);
  requireEqual(topologyProofGate.ok, true, 'managedStageTopologyProofGate.ok', issues);

  for (const code of Object.keys(primitiveHistogram).map(Number)) {
    if (!ALLOWED_CODES.includes(code)) issues.push(`primitiveHistogram contains non-managed-stage primitive code ${code}`);
  }
  for (const code of FORBIDDEN_CODES) {
    if ((primitiveHistogram[code] || 0) !== 0) issues.push(`forbidden primitive code ${code} was emitted`);
  }

  requireEqual(chunkHierarchy.headCount, 1, 'chunkHierarchy.headCount', issues);
  requireEqual(chunkHierarchy.modlCount, 1, 'chunkHierarchy.modlCount', issues);
  requireEqual(chunkHierarchy.endCount, 1, 'chunkHierarchy.endCount', issues);
  requireEqual(chunkHierarchy.cntbCount, chunkHierarchy.cnteCount, 'CNTB/CNTE balance', issues);
  requireTruthy(chunkHierarchy.primInsideCntbOnly, 'chunkHierarchy.primInsideCntbOnly', issues);
  requireTruthy(chunkHierarchy.cntbCnteBalanced, 'chunkHierarchy.cntbCnteBalanced', issues);
  requirePositive(chunkHierarchy.colrCount, 'chunkHierarchy.colrCount', issues);
  requireEqual(chunkHierarchy.primCount, sumHistogram(primitiveHistogram), 'PRIM count vs primitive histogram', issues);

  requireTruthy(Array.isArray(bbox.bboxMm) && bbox.bboxMm.length === 6, 'boundingExtentsMm.bboxMm', issues);
  requireEqual(bbox.cntbBboxFieldsWritten, false, 'boundingExtentsMm.cntbBboxFieldsWritten', issues);
  requireEqual((audit.torusOrientationAssumptions || []).length, primitiveHistogram[4] || 0, 'torus assumption count', issues);

  if (stitchManifest.schema !== undefined) {
    requireEqual(stitchManifest.schema, 'ManagedStageRvmStitchManifest.v1', 'stitchManifest.schema', issues);
    requireTruthy(stitchManifest.allElementsMapped, 'stitchManifest.allElementsMapped', issues);
    requireTruthy(stitchManifest.elementOrderStable, 'stitchManifest.elementOrderStable', issues);
    requireArrayEmpty(stitchManifest.issues, 'stitchManifest.issues', issues);
    requireEqual(stitchManifest.elementCount, inputCounts.geometryComponents, 'stitchManifest.elementCount', issues);
    requireEqual(stitchManifest.primitiveCount, chunkHierarchy.primCount, 'stitchManifest.primitiveCount', issues);
    requireEqual(stitchManifest.decodedPrimitiveCount, chunkHierarchy.primCount, 'stitchManifest.decodedPrimitiveCount', issues);
    requireEqual(sumHistogram(normalizeHistogram(stitchManifest.primitiveCodeHistogram || {})), chunkHierarchy.primCount, 'stitchManifest primitive histogram sum', issues);
  }

  assertSupportOverlayContract(supportExport, stitchManifest, expectations, issues);

  checkExpected(expectations.geometryComponents, inputCounts.geometryComponents, 'expected geometry components', issues);
  checkExpected(expectations.supportRecordsSkippedFromGeometry, inputCounts.supportRecordsSkippedFromGeometry, 'expected skipped support records', issues);
  checkExpected(expectations.supportRecordsEmittedToRvm, inputCounts.supportRecordsEmittedToRvm, 'expected support records emitted to RVM', issues);
  checkExpected(expectations.supportRvmPrimitiveCount, supportExport.supportPrimitiveCount, 'expected support RVM primitive count', issues);
  checkExpected(expectations.code1, primitiveHistogram[1] || 0, 'expected code 1 pyramid primitives', issues);
  checkExpected(expectations.code4, primitiveHistogram[4] || 0, 'expected code 4 torus primitives', issues);
  checkExpected(expectations.code8, primitiveHistogram[8] || 0, 'expected code 8 cylinder primitives', issues);
  checkExpected(expectations.cntbCount, chunkHierarchy.cntbCount, 'expected CNTB count', issues);
  checkExpected(expectations.primCount, chunkHierarchy.primCount, 'expected PRIM count', issues);

  const nonBlockingPatterns = (expectations.nonBlockingAuditIssuePatterns || []).map((pattern) => new RegExp(pattern));
  const nonBlockingIssues = [];
  const blockingIssues = [];
  for (const issue of issues) {
    if (nonBlockingPatterns.some((pattern) => pattern.test(issue))) nonBlockingIssues.push(issue);
    else blockingIssues.push(issue);
  }

  if (blockingIssues.length) throw new Error(`Managed-stage RVM audit gate failed: ${blockingIssues.join('; ')}`);
  return {
    schema: 'ManagedStageRvmAuditGate.v1',
    ok: true,
    failClosed: blockingIssues.length === 0,
    nonBlockingAuditIssues: nonBlockingIssues,
    nonBlockingAuditWarningCount: nonBlockingIssues.length,
    warningOnly: nonBlockingIssues.length > 0,
    topologyProofGateOk: topologyProofGate.ok === true,
    allowedPrimitiveCodes: [...ALLOWED_CODES],
    forbiddenPrimitiveCodes: [...FORBIDDEN_CODES],
    supportAllowedPrimitiveCodes: [...SUPPORT_ALLOWED_CODES],
    supportForbiddenPrimitiveCodes: [...SUPPORT_FORBIDDEN_CODES],
    maxCenterlineGapMm: Number(topology.maxCenterlineGapMm || 0),
    primitiveHistogram,
    supportPrimitiveCodeHistogram: normalizeHistogram(supportExport.supportPrimitiveCodeHistogram || {}),
    supportRecordsEmittedToRvm: Number(inputCounts.supportRecordsEmittedToRvm || 0),
    supportRvmPrimitiveCount: Number(supportExport.supportPrimitiveCount || 0),
    supportMaxGlyphExtentMm: Number(supportExport.supportMaxGlyphExtentMm || 0),
    supportMaxClusterOffsetMm: Number(supportExport.supportMaxClusterOffsetMm || 0),
    supportMaxPrimitiveSpanMm: Number(supportExport.supportMaxPrimitiveSpanMm || 0),
    supportMaxBarRadiusMm: Number(supportExport.supportMaxBarRadiusMm || 0),
    stitchManifestPresent: stitchManifest.schema === 'ManagedStageRvmStitchManifest.v1',
    chunkCounts: {
      HEAD: chunkHierarchy.headCount || 0,
      MODL: chunkHierarchy.modlCount || 0,
      CNTB: chunkHierarchy.cntbCount || 0,
      PRIM: chunkHierarchy.primCount || 0,
      CNTE: chunkHierarchy.cnteCount || 0,
      COLR: chunkHierarchy.colrCount || 0,
      'END:': chunkHierarchy.endCount || 0
    }
  };
}

function assertSupportOverlayContract(supportExport = {}, stitchManifest = {}, expectations = {}, issues = []) {
  const supportPrimitiveCount = Number(supportExport.supportPrimitiveCount || 0);
  const supportHistogram = normalizeHistogram(supportExport.supportPrimitiveCodeHistogram || {});
  const manifestSupportHistogram = histogram((stitchManifest.supportOverlayPrimitives || []).map((primitive) => primitive.emittedCode));

  if (supportPrimitiveCount > 0) {
    requireEqual(sumHistogram(supportHistogram), supportPrimitiveCount, 'support primitive histogram sum', issues);
    for (const code of Object.keys(supportHistogram).map(Number)) {
      if (!SUPPORT_ALLOWED_CODES.includes(code)) issues.push(`support overlay contains non-code8 primitive code ${code}`);
    }
    for (const code of SUPPORT_FORBIDDEN_CODES) {
      if ((supportHistogram[code] || 0) !== 0) issues.push(`support overlay emitted forbidden primitive code ${code}`);
    }
    if (stitchManifest.schema === 'ManagedStageRvmStitchManifest.v1') {
      requireEqual(stitchManifest.supportOverlayPrimitiveCount || 0, supportPrimitiveCount, 'support stitch/export primitive count', issues);
      compareHistogram(supportHistogram, manifestSupportHistogram, 'support primitive histogram vs stitch manifest', issues);
    }
    requireMax(supportExport.supportMaxGlyphExtentMm, expectations.supportMaxGlyphExtentMm ?? DEFAULT_SUPPORT_MAX_GLYPH_EXTENT_MM, 'supportMaxGlyphExtentMm', issues);
    requireMax(supportExport.supportMaxClusterOffsetMm, expectations.supportMaxClusterOffsetMm ?? DEFAULT_SUPPORT_MAX_CLUSTER_OFFSET_MM, 'supportMaxClusterOffsetMm', issues);
    requireMax(supportExport.supportMaxPrimitiveSpanMm, expectations.supportMaxPrimitiveSpanMm ?? DEFAULT_SUPPORT_MAX_PRIMITIVE_SPAN_MM, 'supportMaxPrimitiveSpanMm', issues);
    requireMax(supportExport.supportMaxBarRadiusMm, expectations.supportMaxBarRadiusMm ?? DEFAULT_SUPPORT_MAX_BAR_RADIUS_MM, 'supportMaxBarRadiusMm', issues);
  }
}

function normalizeHistogram(histogram) {
  const out = {};
  for (const [key, value] of Object.entries(histogram)) out[Number(key)] = Number(value);
  return out;
}

function sumHistogram(histogram) {
  return Object.values(histogram).reduce((sum, value) => sum + Number(value || 0), 0);
}

function histogram(values) {
  return values.reduce((out, value) => {
    const key = Number(value);
    if (Number.isFinite(key)) out[key] = (out[key] || 0) + 1;
    return out;
  }, {});
}

function compareHistogram(actual, expected, label, issues) {
  const keys = new Set([...Object.keys(actual), ...Object.keys(expected)].map(String));
  for (const key of keys) requireEqual(Number(actual[key] || 0), Number(expected[key] || 0), `${label} code ${key}`, issues);
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

function requirePositive(value, label, issues) {
  if (!(Number(value) > 0)) issues.push(`${label}: expected positive value, got ${value}`);
}

function requireAtLeast(value, min, label, issues) {
  if (!(Number(value) >= min)) issues.push(`${label}: expected >= ${min}, got ${value}`);
}

function requireMax(value, max, label, issues) {
  if (!(Number(value) <= max)) issues.push(`${label}: expected <= ${max}, got ${value}`);
}

function requireArrayEmpty(value, label, issues) {
  if (!Array.isArray(value)) issues.push(`${label}: expected array`);
  else if (value.length !== 0) issues.push(`${label}: expected empty array, got ${value.length}`);
}
