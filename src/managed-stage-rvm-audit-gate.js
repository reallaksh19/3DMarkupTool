const FORBIDDEN_CODES = Object.freeze([2, 5, 6, 7, 11]);
const ALLOWED_CODES = Object.freeze([4, 8]);
const DEFAULT_GAP_TOLERANCE_MM = 0.001;

export function assertManagedStageRvmAuditGate(audit = {}, expectations = {}) {
  const issues = [];
  const primitiveHistogram = normalizeHistogram(audit.primitiveHistogram || {});
  const chunkHierarchy = audit.chunkHierarchy || {};
  const topology = audit.topology || {};
  const inputCounts = audit.inputCounts || {};
  const bbox = audit.boundingExtentsMm || {};
  const stitchManifest = audit.stitchManifest || {};
  const supportExport = audit.supportRvmExportAudit || {};
  const toleranceMm = Number(expectations.maxCenterlineGapMm ?? DEFAULT_GAP_TOLERANCE_MM);

  requireEqual(audit.generationMode, 'managed-stage-cylinder-torus', 'generationMode', issues);
  requireEqual(audit.units, 'mm', 'units', issues);
  requirePositive(inputCounts.geometryComponents, 'geometryComponents', issues);
  requireAtLeast(inputCounts.supportRecordsSkippedFromGeometry, 0, 'supportRecordsSkippedFromGeometry', issues);
  requireArrayEmpty(topology.zeroLength, 'topology.zeroLength', issues);
  requireArrayEmpty(topology.warnings, 'topology.warnings', issues);
  requireMax(topology.maxCenterlineGapMm, toleranceMm, 'topology.maxCenterlineGapMm', issues);

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

  checkExpected(expectations.geometryComponents, inputCounts.geometryComponents, 'expected geometry components', issues);
  checkExpected(expectations.supportRecordsSkippedFromGeometry, inputCounts.supportRecordsSkippedFromGeometry, 'expected skipped support records', issues);
  checkExpected(expectations.supportRecordsEmittedToRvm, inputCounts.supportRecordsEmittedToRvm, 'expected support records emitted to RVM', issues);
  checkExpected(expectations.supportRvmPrimitiveCount, supportExport.supportPrimitiveCount, 'expected support RVM primitive count', issues);
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
    allowedPrimitiveCodes: [...ALLOWED_CODES],
    forbiddenPrimitiveCodes: [...FORBIDDEN_CODES],
    maxCenterlineGapMm: Number(topology.maxCenterlineGapMm || 0),
    primitiveHistogram,
    supportRecordsEmittedToRvm: Number(inputCounts.supportRecordsEmittedToRvm || 0),
    supportRvmPrimitiveCount: Number(supportExport.supportPrimitiveCount || 0),
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

function normalizeHistogram(histogram) {
  const out = {};
  for (const [key, value] of Object.entries(histogram)) out[Number(key)] = Number(value);
  return out;
}

function sumHistogram(histogram) {
  return Object.values(histogram).reduce((sum, value) => sum + Number(value || 0), 0);
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
