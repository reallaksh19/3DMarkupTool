import assert from 'node:assert/strict';
import { createBmCiiManagedStageSampleJson } from '../src/managed-stage-bm-cii-json-sample-data.js';
import { createManagedStagePreviewScene } from '../src/managed-stage-preview-scene.js';

const bmScene = createManagedStagePreviewScene(createBmCiiManagedStageSampleJson(), {
  sourceName: 'BM_CII_INPUT_managed_stage.json'
});
const bmAudit = bmScene.userData.managedStageCoordinateAudit;

assert.equal(bmAudit.supportPreviewOnlyCount, 12);
assert.equal(bmAudit.supportVisualPolicy.schema, 'ManagedStageSupportVisualResolver.v1');
assert.equal(bmAudit.supportVisualCounts.total, 12);
assert.equal(bmAudit.supportVisualCounts.REST, 4);
assert.equal(bmAudit.supportVisualCounts.GUIDE, 4);
assert.equal(bmAudit.supportVisualCounts.LINE_STOP, 4);
assert.equal(bmAudit.supportPopupRequiredCount, 0);

const supportRows = bmAudit.rows.filter((row) => row.supportLike);
for (const row of supportRows) {
  assert.equal(row.exportedToRvm, false);
  assert.equal(row.previewOnly, true);
  assert.equal(row.supportVisual.gapRecordScoped, true);
  assert.equal(row.supportVisual.gapCarryForward, false);
}

const rest = supportRows.find((row) => row.supportVisual.family === 'REST');
assert.ok(rest);
assert.equal(rest.supportVisual.coneCount, 1);
assert.equal(rest.supportVisual.coneSides[0].axis, '+Y');
assert.match(rest.supportVisual.coneSides[0].role, /rest-upward/);

const guideOnZPipe = supportRows.find((row) => row.supportVisual.family === 'GUIDE' && row.supportVisual.pipeAxis === 'Z');
assert.ok(guideOnZPipe);
assert.deepEqual(guideOnZPipe.supportVisual.coneSides.map((side) => side.axis).sort(), ['+X', '-X'].sort());

const lineStop = supportRows.find((row) => row.supportVisual.family === 'LINE_STOP');
assert.ok(lineStop);
assert.equal(lineStop.supportVisual.coneCount, 2);
assert.equal(lineStop.supportVisual.explicitSignApplied, false);
assert.equal(lineStop.supportVisual.axialNoOdHalfRadialContact, true);
assert.equal(lineStop.supportVisual.axialTipsTouchUnlessGap, true);
assert.match(lineStop.supportVisual.axialPipeParallelResolver, /ODx2\/3/);
assert.ok(lineStop.supportVisual.coneSides.every((side) => side.axialPipeParallel === true));

const supportRoots = [];
const supportParts = [];
bmScene.traverse((object) => {
  if (object.userData?.managedStageSupportVisual === true) supportRoots.push(object);
  if (object.userData?.managedStageSupportVisualPart === true) supportParts.push(object);
});
assert.equal(supportRoots.length, 12);
assert.ok(supportParts.length >= 20);
assert.ok(supportRoots.every((object) => object.userData.TYPE === 'MANAGED_STAGE_SUPPORT_RESTRAINT_PREVIEW'));
assert.ok(supportRoots.every((object) => object.userData.exportedRvmGeometry === false));
assert.ok(supportParts.every((object) => object.userData.exportedRvmGeometry === false));

const customStage = {
  schema: 'inputxml-managed-stage/v1',
  profile: 'AVEVA_JSON_FOR_3D_RVM_VIEWER',
  source: 'support-rule-fixture.xml',
  units: { length: 'mm' },
  hierarchy: [{
    name: '/INPUTXML/SUPPORT-RULES',
    type: 'BRANCH',
    children: [
      {
        name: 'PIPE P1',
        type: 'PIPE',
        attributes: {
          TYPE: 'PIPE', DTXR: 'PIPE', NAME: 'P1', FROM_NODE: '1', TO_NODE: '2',
          APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 1000, y: 0, z: 0 },
          DIAMETER: '100mm', BORE: '100mm'
        }
      },
      {
        name: 'SUPPORT LS-GAP',
        type: 'ATTA',
        attributes: {
          TYPE: 'ATTA', NAME: 'LS-GAP', NODE: '1', POS: { x: 0, y: 0, z: 0 },
          SUPPORT_KIND: 'LINE STOP', GAP: '5mm'
        }
      },
      {
        name: 'SUPPORT AXIS-MISSING-SIGN',
        type: 'ATTA',
        attributes: {
          TYPE: 'ATTA', NAME: 'AXIS-MISSING-SIGN', NODE: '1', POS: { x: 0, y: 0, z: 0 },
          SUPPORT_KIND: 'X'
        }
      },
      {
        name: 'SUPPORT SPRING-CAN',
        type: 'ATTA',
        attributes: {
          TYPE: 'ATTA', NAME: 'SPRING-CAN', NODE: '1', POS: { x: 0, y: 0, z: 0 },
          SUPPORT_KIND: 'Spring Can'
        }
      }
    ]
  }]
};

const customScene = createManagedStagePreviewScene(customStage, { sourceName: 'support-rule-fixture.json' });
const customRows = customScene.userData.managedStageCoordinateAudit.rows.filter((row) => row.supportLike);
assert.equal(customRows.length, 3);

const gapped = customRows.find((row) => row.name === 'LS-GAP');
assert.equal(gapped.supportVisual.family, 'LINE_STOP');
assert.equal(gapped.supportVisual.gapMm, 5);
assert.equal(gapped.supportVisual.gapSource, 'record');
assert.equal(gapped.supportVisual.gapRecordScoped, true);
assert.equal(gapped.supportVisual.gapCarryForward, false);
assert.equal(gapped.supportVisual.gapVisualSeparationMm, 50);
assert.equal(gapped.supportVisual.coneCount, 2);
assert.deepEqual(gapped.supportVisual.coneSides.map((side) => side.axis).sort(), ['+X', '-X'].sort());

const missingSign = customRows.find((row) => row.name === 'AXIS-MISSING-SIGN');
assert.equal(missingSign.supportVisual.family, 'SINGLE_AXIS_WARNING');
assert.equal(missingSign.supportVisual.popupRequired, true);
assert.match(missingSign.supportVisual.popupReason, /missing explicit \+\/- sign/);

const springCan = customRows.find((row) => row.name === 'SPRING-CAN');
assert.equal(springCan.supportVisual.family, 'SPRING_CAN');
assert.equal(springCan.supportVisual.popupRequired, true);
assert.match(springCan.supportVisual.popupReason, /spring can/i);

const customParts = [];
customScene.traverse((object) => {
  if (object.userData?.managedStageSupportVisualPart === true) customParts.push(object);
});
assert.ok(customParts.some((object) => object.userData.role === 'popupRequired'));
assert.ok(customParts.some((object) => object.userData.role === 'warningCoilBelowPipe'));
assert.ok(customParts.filter((object) => object.userData.axialPipeParallel === true).every((object) => object.userData.odTwoThirdsResolverApplied === true));

console.log(JSON.stringify({
  schema: bmAudit.supportVisualPolicy.schema,
  bmCiiSupportVisualCounts: bmAudit.supportVisualCounts,
  gappedLineStopSeparationMm: gapped.supportVisual.gapVisualSeparationMm,
  singleAxisPopupRequired: missingSign.supportVisual.popupRequired,
  springCanPopupRequired: springCan.supportVisual.popupRequired
}, null, 2));
