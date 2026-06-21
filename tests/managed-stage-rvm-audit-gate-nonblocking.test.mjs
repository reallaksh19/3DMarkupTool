import assert from 'node:assert/strict';
import { assertManagedStageRvmAuditGate } from '../src/managed-stage-rvm-audit-gate.js';

const baseAudit = {
  generationMode: 'managed-stage-cylinder-torus',
  units: 'mm',
  primitiveHistogram: { 8: 121 },
  inputCounts: {
    geometryComponents: 40,
    supportRecordsSkippedFromGeometry: 12,
    supportRecordsEmittedToRvm: 12
  },
  topology: {
    zeroLength: [],
    warnings: [],
    maxCenterlineGapMm: 0
  },
  boundingExtentsMm: {
    bboxMm: [0, 0, 0, 1, 1, 1],
    cntbBboxFieldsWritten: false
  },
  supportRvmExportAudit: {
    supportPrimitiveCount: 30
  },
  chunkHierarchy: {
    headCount: 1,
    modlCount: 1,
    endCount: 1,
    cntbCount: 61,
    cnteCount: 61,
    primInsideCntbOnly: true,
    cntbCnteBalanced: true,
    colrCount: 1,
    primCount: 121
  },
  torusOrientationAssumptions: []
};

const warningGate = assertManagedStageRvmAuditGate(baseAudit, {
  geometryComponents: 40,
  supportRvmPrimitiveCount: 25,
  code8: 116,
  primCount: 116,
  nonBlockingAuditIssuePatterns: [
    '^expected support RVM primitive count:',
    '^expected code 8 cylinder primitives:',
    '^expected PRIM count:'
  ]
});

assert.equal(warningGate.ok, true);
assert.equal(warningGate.warningOnly, true);
assert.equal(warningGate.nonBlockingAuditWarningCount, 3);
assert.deepEqual(warningGate.nonBlockingAuditIssues, [
  'expected support RVM primitive count: expected 25, got 30',
  'expected code 8 cylinder primitives: expected 116, got 121',
  'expected PRIM count: expected 116, got 121'
]);

assert.throws(
  () => assertManagedStageRvmAuditGate(baseAudit, {
    geometryComponents: 39,
    supportRvmPrimitiveCount: 25,
    nonBlockingAuditIssuePatterns: ['^expected support RVM primitive count:']
  }),
  /expected geometry components: expected 39, got 40/
);

console.log('managed-stage audit gate permits UI-only non-geometry warnings without unblocking geometry failures');
