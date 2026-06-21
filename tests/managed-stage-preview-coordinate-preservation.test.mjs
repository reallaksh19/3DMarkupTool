import assert from 'node:assert/strict';
import { createBmCiiManagedStageSampleJson } from '../src/managed-stage-bm-cii-json-sample-data.js';
import { convertManagedStageJsonToRvmAtt } from '../src/managed-stage-rvm-converter.js';
import { assertManagedStagePreviewCoordinatePreservation, createManagedStagePreviewScene } from '../src/managed-stage-preview-scene.js';

const sourceText = createBmCiiManagedStageSampleJson();
const exportResult = convertManagedStageJsonToRvmAtt(sourceText, {
  strictAuditExpectations: {
    geometryComponents: 40,
    supportRecordsSkippedFromGeometry: 12,
    primitiveCodeCounts: { 4: 0, 8: 91 },
    cntbCount: 43,
    primCount: 91,
    forbiddenPrimitiveCodesPresent: []
  }
});

const scene = createManagedStagePreviewScene(sourceText, {
  sourceName: 'BM_CII_INPUT_managed_stage.json',
  exportModel: exportResult.exportModel
});
const audit = scene.userData.managedStageCoordinateAudit;

assertManagedStagePreviewCoordinatePreservation(audit);
assert.equal(scene.userData.previewSource, 'raw-managed-stage-json');
assert.equal(audit.sourceLineCount, 40);
assert.equal(audit.supportPreviewOnlyCount, 12);
assert.equal(audit.mutatedNonBendRowCount, 0);
assert.equal(audit.maxNonBendDeltaMm, 0);
assert.equal(audit.rvmExportPreviewSeparated, true);
assert.equal(audit.rvmExportPrimitiveCount, 91);
assert.ok(audit.branchCueCount >= 5);
assert.ok(audit.bendCueCount >= 7);

const lineRows = audit.rows.filter((row) => row.sourceCoordinateKind === 'APOS_LPOS');
assert.equal(lineRows.length, 40);
for (const row of lineRows) {
  assert.deepEqual(row.rendered.startMm, row.APOS);
  assert.deepEqual(row.rendered.endMm, row.LPOS);
  assert.deepEqual(row.beforePlanning.startMm, row.APOS);
  assert.deepEqual(row.beforePlanning.endMm, row.LPOS);
  assert.deepEqual(row.afterPlanning.startMm, row.APOS);
  assert.deepEqual(row.afterPlanning.endMm, row.LPOS);
}

const nonBendRows = lineRows.filter((row) => !row.isBend);
assert.equal(nonBendRows.length, 33);
for (const row of nonBendRows) {
  assert.equal(row.deltaMm.max, 0);
  assert.equal(row.deltaReason, '');
}

const bendRows = lineRows.filter((row) => row.isBend);
assert.equal(bendRows.length, 7);
for (const row of bendRows) assert.equal(row.deltaMm.max, 0);

const supportRows = audit.rows.filter((row) => row.supportLike);
assert.equal(supportRows.length, 12);
for (const row of supportRows) {
  assert.equal(row.exportedToRvm, false);
  assert.equal(row.previewOnly, true);
}

assert.equal(exportResult.audit.inputCounts.supportRecordsSkippedFromGeometry, 12);
assert.equal(exportResult.audit.primitiveHistogram[8], 91);
assert.equal(exportResult.audit.primitiveHistogram[4] || 0, 0);
assert.equal(exportResult.audit.managedStageStrictGate?.ok, true);

const additiveCues = [];
scene.traverse((object) => {
  if (object.userData?.previewAdditiveCue === true) additiveCues.push(object);
});
assert.ok(additiveCues.length >= audit.branchCueCount + audit.bendCueCount);
for (const object of additiveCues) {
  assert.equal(object.userData.previewOnly, true);
  assert.equal(object.userData.exportedRvmGeometry, false);
}

console.log(JSON.stringify({
  schema: audit.schema,
  sourceLineCount: audit.sourceLineCount,
  supportPreviewOnlyCount: audit.supportPreviewOnlyCount,
  branchCueCount: audit.branchCueCount,
  bendCueCount: audit.bendCueCount,
  maxNonBendDeltaMm: audit.maxNonBendDeltaMm,
  rvmExportPrimitiveCount: audit.rvmExportPrimitiveCount
}, null, 2));
