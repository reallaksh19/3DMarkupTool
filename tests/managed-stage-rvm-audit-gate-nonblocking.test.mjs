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
  managedStageTopologyProofGate: {
    ok: true,
    topologyQualityGateOk: true,
    topologyQualityGate: {
      internalDisconnectedRequiredPortCount: 0,
      classifiedOpenTerminalPortCount: 2,
      highDegreeTopologyNodeCount: 0,
      nodeCoordinateConflictCount: 0,
      invalidBranchNodeDegreeCount: 0
    }
  },
  boundingExtentsMm: {
    bboxMm: [0, 0, 0, 1, 1, 1],
    cntbBboxFieldsWritten: false
  },
  supportRvmExportAudit: {
    supportPrimitiveCount: 30,
    supportPrimitiveCodeHistogram: { 8: 30 },
    supportMaxGlyphExtentMm: 60,
    supportMaxClusterOffsetMm: 20,
    supportMaxPrimitiveSpanMm: 55,
    supportMaxBarRadiusMm: 2.5
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
assert.equal(warningGate.topologyProofGateOk, true);
assert.equal(warningGate.topologyQualityGateOk, true);
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

assert.throws(
  () => assertManagedStageRvmAuditGate({
    ...baseAudit,
    managedStageTopologyProofGate: {
      ...baseAudit.managedStageTopologyProofGate,
      ok: false
    }
  }),
  /managedStageTopologyProofGate\.ok: expected true, got false/
);

assert.throws(
  () => assertManagedStageRvmAuditGate({
    ...baseAudit,
    supportRvmExportAudit: {
      ...baseAudit.supportRvmExportAudit,
      supportPrimitiveCodeHistogram: { 1: 1, 8: 29 }
    }
  }),
  /support overlay contains non-code8 primitive code 1/
);

assert.throws(
  () => assertManagedStageRvmAuditGate({
    ...baseAudit,
    supportRvmExportAudit: {
      ...baseAudit.supportRvmExportAudit,
      supportMaxGlyphExtentMm: 101
    }
  }),
  /supportMaxGlyphExtentMm: expected <= 100, got 101/
);

console.log('managed-stage audit gate nonblocking warning test passed');
