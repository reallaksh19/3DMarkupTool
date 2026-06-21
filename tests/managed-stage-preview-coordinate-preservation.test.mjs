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
assert.equal(audit.maxUnexplainedNonBendDeltaMm, 0);
assert.equal(audit.rvmExportPreviewSeparated, true);
assert.equal(audit.rvmExportPrimitiveCount, 91);
assert.ok(audit.branchCueCount >= 5);
assert.equal(audit.orthogonalElbowCount, 7);
assert.equal(audit.bendCueCount, audit.orthogonalElbowCount);
assert.ok(audit.trimmedSourceLineCount >= 10);
assert.match(audit.elbowRadiusPolicy, /1\.5D/);

const lineRows = audit.rows.filter((row) => row.sourceCoordinateKind === 'APOS_LPOS');
assert.equal(lineRows.length, 40);
for (const row of lineRows) {
  assert.deepEqual(row.beforePlanning.startMm, row.APOS);
  assert.deepEqual(row.beforePlanning.endMm, row.LPOS);
  assert.deepEqual(row.afterPlanning.startMm, row.APOS);
  assert.deepEqual(row.afterPlanning.endMm, row.LPOS);
  if (row.intentionalPreviewTrim) {
    assert.ok(row.deltaMm.max > 0);
    assert.match(row.deltaReason, /orthogonal 1\.5D elbow preview trim/);
    assert.ok(row.previewTrim.nodes.length >= 1);
  } else {
    assert.deepEqual(row.rendered.startMm, row.APOS);
    assert.deepEqual(row.rendered.endMm, row.LPOS);
    assert.equal(row.deltaMm.max, 0);
  }
}

assert.equal(lineRows.filter((row) => !row.isBend).length, 33);
assert.equal(lineRows.filter((row) => row.isBend).length, 7);
assert.ok(lineRows.some((row) => row.isBend && row.intentionalPreviewTrim));

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
const elbowCues = [];
const trimmedLineMeshes = [];
scene.traverse((object) => {
  if (object.userData?.previewAdditiveCue === true) additiveCues.push(object);
  if (object.userData?.cueKind === 'bend' && object.name.startsWith('MANAGED_STAGE_1_5D_ELBOW_NODE_')) elbowCues.push(object);
  if (object.userData?.previewTrimmedForOrthogonalElbow === true) trimmedLineMeshes.push(object);
});
assert.ok(additiveCues.length >= audit.branchCueCount + audit.bendCueCount);
assert.equal(elbowCues.length, audit.orthogonalElbowCount);
assert.equal(trimmedLineMeshes.length, audit.trimmedSourceLineCount);
for (const object of additiveCues) {
  assert.equal(object.userData.previewOnly, true);
  assert.equal(object.userData.exportedRvmGeometry, false);
}
for (const elbow of elbowCues) {
  assert.equal(elbow.userData.previewOnly, true);
  assert.equal(elbow.userData.exportedRvmGeometry, false);
  assert.ok(elbow.userData.centerlineRadiusMm > 0);
  assert.ok(elbow.userData.diameterMm > 0);
  assert.match(elbow.userData.coordinatePolicy, /1\.5D orthogonal elbow/);
}
for (const mesh of trimmedLineMeshes) {
  assert.equal(mesh.userData.exportedRvmGeometry, false);
  assert.match(mesh.userData.coordinatePolicy, /visible cylinder endpoint locally trimmed/);
}

console.log(JSON.stringify({
  schema: audit.schema,
  sourceLineCount: audit.sourceLineCount,
  supportPreviewOnlyCount: audit.supportPreviewOnlyCount,
  branchCueCount: audit.branchCueCount,
  orthogonalElbowCount: audit.orthogonalElbowCount,
  trimmedSourceLineCount: audit.trimmedSourceLineCount,
  maxUnexplainedNonBendDeltaMm: audit.maxUnexplainedNonBendDeltaMm,
  rvmExportPrimitiveCount: audit.rvmExportPrimitiveCount
}, null, 2));

await import('./managed-stage-geometry-ledger.test.mjs');
