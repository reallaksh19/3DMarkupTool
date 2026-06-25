import assert from 'node:assert/strict';
import { createBmCiiManagedStageSampleJson } from '../src/managed-stage-bm-cii-json-sample-data.js';
import { createManagedStagePreviewScene } from '../src/managed-stage-preview-scene-explicit-bend.js';
import { parseStagedJsonSourceContract } from '../src/stagedjson-source-contract.js';
import { summarizeExplicitBendRows } from '../src/managed-stage-explicit-bend-details.js';

const sourceText = createBmCiiManagedStageSampleJson();
const parsed = JSON.parse(sourceText);
const scene = createManagedStagePreviewScene(sourceText, { sourceName: 'BM_CII_INPUT_managed_stage.json' });
const audit = scene.userData.managedStageCoordinateAudit;

assert.equal(audit.explicitBendRecordCount, 7);
assert.equal(audit.explicitBendDetailCount, 7);
assert.equal(audit.missingExplicitBendDetailCount, 0);
assert.equal(audit.syntheticOrthogonalBendSkippedForExplicitBend, true);
assert.equal(audit.trimmedBendSourceLineCount, 0);
assert.match(audit.elbowRadiusPolicy, /BEND_RADIUS\/BEND_ANGLE are authoritative/i);

const bendRows = audit.rows.filter((row) => row.isBend);
assert.equal(bendRows.length, 7);
for (const row of bendRows) {
  assert.equal(row.explicitBendRecord, true);
  assert.equal(row.explicitBendDetailsPresent, true);
  assert.equal(row.intentionalPreviewTrim, false);
  assert.equal(row.previewTrim, null);
  assert.equal(row.deltaMm.max, 0);
  assert.equal(row.synthetic1p5DTrimBlocked, true);
  assert.ok(row.bendRadiusMm > 0, `${row.name} should expose bend radius`);
  assert.ok(row.bendAngleDeg > 0, `${row.name} should expose bend angle`);
  assert.equal(row.rendered.startMm.x, row.APOS.x);
  assert.equal(row.rendered.startMm.y, row.APOS.y);
  assert.equal(row.rendered.startMm.z, row.APOS.z);
  assert.equal(row.rendered.endMm.x, row.LPOS.x);
  assert.equal(row.rendered.endMm.y, row.LPOS.y);
  assert.equal(row.rendered.endMm.z, row.LPOS.z);
}

let bendMeshCount = 0;
scene.traverse((object) => {
  if (object?.userData?.explicitBendRecord) {
    bendMeshCount += 1;
    assert.equal(object.userData.previewTrimmedForOrthogonalElbow, false);
    assert.equal(object.userData.previewTrim, null);
    assert.ok(object.userData.bendRadiusMm > 0);
    assert.ok(object.userData.bendAngleDeg > 0);
    assert.match(object.userData.coordinatePolicy, /no synthetic 1\.5D corner trim/i);
  }
  if (object?.userData?.TYPE === 'MANAGED_STAGE_PREVIEW_CUE' && object.userData.cueKind === 'bend') {
    assert.ok(!String(object.userData.sourcePathA || '').includes('BEND'));
    assert.ok(!String(object.userData.sourcePathB || '').includes('BEND'));
  }
});
assert.equal(bendMeshCount, 7);

const contract = parseStagedJsonSourceContract(sourceText, { filename: 'BM_CII_INPUT_managed_stage.json' });
const bendSummary = summarizeExplicitBendRows(contract.managedStageProfile.geometryRecords);
assert.equal(bendSummary.explicitBendRecordCount, 7);
assert.equal(bendSummary.explicitBendDetailCount, 7);
assert.equal(parsed.stats.components, 40);

console.log(JSON.stringify({
  explicitBendRecordCount: audit.explicitBendRecordCount,
  explicitBendDetailCount: audit.explicitBendDetailCount,
  trimmedBendSourceLineCount: audit.trimmedBendSourceLineCount,
  bendMeshCount
}, null, 2));
