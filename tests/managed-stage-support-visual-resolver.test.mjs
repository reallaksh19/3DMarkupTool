import assert from 'node:assert/strict';
import { createBmCiiManagedStageSampleJson } from '../src/managed-stage-bm-cii-json-sample-data.js';
import { createManagedStagePreviewScene } from '../src/managed-stage-preview-scene.js';

const bmScene = createManagedStagePreviewScene(createBmCiiManagedStageSampleJson(), {
  sourceName: 'BM_CII_INPUT_managed_stage.json'
});
const bmAudit = bmScene.userData.managedStageCoordinateAudit;

assert.equal(bmAudit.supportPreviewOnlyCount, 12);
assert.equal(bmAudit.supportVisualPolicy.schema, 'ManagedStageSupportVisualResolver.v5');
assert.equal(bmAudit.supportVisualPolicy.previewGeometry, 'cone-and-can-support-glyphs');
assert.equal(bmAudit.supportVisualPolicy.supportConeCatalogue, true);
assert.equal(bmAudit.supportVisualPolicy.discCapsRemoved, true);
assert.equal(bmAudit.supportVisualPolicy.supportPreviewRaycastDisabled, true);
assert.match(bmAudit.supportVisualPolicy.ringArtifactPolicy, /torus geometry is allowed only for the five SPRING_CAN coils/i);
assert.ok(!bmAudit.supportVisualPolicy.blockedPreviewGeometry.includes('ConeGeometry'));
assert.equal(bmAudit.supportVisualPolicy.maxPrimitiveBudgetPerSupportKind, 5);
assert.equal(bmAudit.supportVisualCounts.total, 12);
assert.equal(bmAudit.supportVisualCounts.REST, 4);
assert.equal(bmAudit.supportVisualCounts.GUIDE, 4);
assert.equal(bmAudit.supportVisualCounts.LINE_STOP, 4);
assert.equal(bmAudit.supportPopupRequiredCount, 0);

const allowedPreviewGeometry = new Set(['directional-cones', 'five-coil-spring-can', 'open-can-below-pipe', 'hanger-above-pipe', 'warning-cone', 'fallback-cross-rods']);
const supportRows = bmAudit.rows.filter((row) => row.supportLike);
for (const row of supportRows) {
  assert.equal(row.exportedToRvm, false);
  assert.equal(row.previewOnly, true);
  assert.equal(row.supportVisual.gapRecordScoped, true);
  assert.equal(row.supportVisual.gapCarryForward, false);
  assert.ok(allowedPreviewGeometry.has(row.supportVisual.previewGlyphGeometry));
  assert.equal(row.supportVisual.previewPrimitiveBudgetLimit, 5);
  assert.equal(row.supportVisual.previewPrimitiveBudgetPass, true);
  assert.ok(row.supportVisual.previewPrimitiveBudgetCount <= 5);
  assert.equal(row.supportVisual.supportConeCatalogue, true);
  assert.equal(row.supportVisual.discCapsRemoved, true);
  assert.match(row.supportVisual.ringArtifactPolicy, /open-ended low-segment cones/i);
}

const rest = supportRows.find((row) => row.supportVisual.family === 'REST');
assert.ok(rest);
assert.equal(rest.supportVisual.coneCount, 1);
assert.equal(rest.supportVisual.coneSides[0].axis, '+Y');
assert.match(rest.supportVisual.coneSides[0].role, /rest-upward/);
assert.equal(rest.supportVisual.directionalGlyphCount, 1);
assert.equal(rest.supportVisual.previewPrimitiveBudgetCount, 1);
assert.equal(rest.supportVisual.odHalfRadialContactAppliedInResolver, true);

const guideOnZPipe = supportRows.find((row) => row.supportVisual.family === 'GUIDE' && row.supportVisual.pipeAxis === 'Z');
assert.ok(guideOnZPipe);
assert.deepEqual(guideOnZPipe.supportVisual.coneSides.map((side) => side.axis).sort(), ['+X', '-X'].sort());
assert.equal(guideOnZPipe.supportVisual.previewPrimitiveBudgetCount, 2);

const lineStop = supportRows.find((row) => row.supportVisual.family === 'LINE_STOP');
assert.ok(lineStop);
assert.equal(lineStop.supportVisual.coneCount, 2);
assert.equal(lineStop.supportVisual.explicitSignApplied, false);
assert.equal(lineStop.supportVisual.axialNoOdHalfRadialContact, true);
assert.equal(lineStop.supportVisual.axialOdTwoThirdsDisplayOffsetAppliedInResolver, true);
assert.equal(lineStop.supportVisual.axialTipsTouchUnlessGap, true);
assert.match(lineStop.supportVisual.axialPipeParallelResolver, /ODx2\/3/);
assert.ok(lineStop.supportVisual.coneSides.every((side) => side.axialPipeParallel === true));
assert.equal(lineStop.supportVisual.previewPrimitiveBudgetCount, 2);

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
assert.ok(supportRoots.every((object) => object.userData.supportPreviewNoCone === false));
assert.ok(supportRoots.every((object) => object.userData.supportPreviewUsesConeCatalogue === true));
assert.ok(supportRoots.every((object) => object.userData.supportPreviewPrimitiveBudgetPass === true));
assert.ok(supportRoots.every((object) => object.userData.supportPreviewPrimitiveBudgetCount <= 5));
assert.ok(supportRoots.every((object) => object.userData.supportPreviewRaycastDisabled === true));
assert.ok(supportRoots.every((object) => object.userData.discCapsRemoved === true));
assert.ok(supportParts.every((object) => object.userData.exportedRvmGeometry === false));
assert.ok(supportParts.every((object) => object.userData.supportPreviewRaycastDisabled === true));
assert.ok(supportParts.some((object) => object.geometry?.type === 'ConeGeometry'));
assert.ok(supportParts.some((object) => object.userData.supportDirectionalCone === true));
assert.ok(supportParts.filter((object) => object.geometry?.type === 'ConeGeometry').every((object) => object.geometry.parameters.openEnded === true));

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
        name: 'PIPE P2-VERTICAL',
        type: 'PIPE',
        attributes: {
          TYPE: 'PIPE', DTXR: 'PIPE', NAME: 'P2-VERTICAL', FROM_NODE: '3', TO_NODE: '4',
          APOS: { x: 500, y: 0, z: 0 }, LPOS: { x: 500, y: 1000, z: 0 },
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
      },
      {
        name: 'SUPPORT V-GUIDE',
        type: 'ATTA',
        attributes: {
          TYPE: 'ATTA', NAME: 'V-GUIDE', NODE: '3', POS: { x: 500, y: 0, z: 0 },
          SUPPORT_KIND: 'GUIDE'
        }
      }
    ]
  }]
};

const customScene = createManagedStagePreviewScene(customStage, { sourceName: 'support-rule-fixture.json' });
const customRows = customScene.userData.managedStageCoordinateAudit.rows.filter((row) => row.supportLike);
assert.equal(customRows.length, 4);
assert.ok(customRows.every((row) => row.supportVisual.previewPrimitiveBudgetPass === true));
assert.ok(customRows.every((row) => row.supportVisual.previewPrimitiveBudgetCount <= 5));

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
assert.equal(missingSign.supportVisual.previewPrimitiveBudgetCount, 1);
assert.match(missingSign.supportVisual.popupReason, /single-axis restraint/i);

const springCan = customRows.find((row) => row.name === 'SPRING-CAN');
assert.equal(springCan.supportVisual.family, 'SPRING_CAN');
assert.equal(springCan.supportVisual.popupRequired, true);
assert.equal(springCan.supportVisual.previewPrimitiveBudgetCount, 5);
assert.equal(springCan.supportVisual.springCoilCount, 5);
assert.equal(springCan.supportVisual.previewGlyphGeometry, 'five-coil-spring-can');
assert.match(springCan.supportVisual.popupReason, /five coils/i);

const verticalGuide = customRows.find((row) => row.name === 'V-GUIDE');
assert.equal(verticalGuide.supportVisual.family, 'GUIDE');
assert.equal(verticalGuide.supportVisual.pipeAxis, 'Y');
assert.deepEqual(verticalGuide.supportVisual.coneSides.map((side) => side.axis).sort(), ['+X', '-X', '+Z', '-Z'].sort());
assert.equal(verticalGuide.supportVisual.previewPrimitiveBudgetCount, 4);
assert.equal(verticalGuide.supportVisual.previewPrimitiveBudgetPass, true);

const customParts = [];
const customRoots = [];
customScene.traverse((object) => {
  if (object.userData?.managedStageSupportVisual === true) customRoots.push(object);
  if (object.userData?.managedStageSupportVisualPart === true) customParts.push(object);
});
assert.ok(customParts.some((object) => object.userData.role === 'popupRequiredWarningCone'));
assert.equal(customParts.filter((object) => object.userData.role === 'springCanFiveCoilBelowPipe').length, 5);
assert.equal(customParts.filter((object) => object.userData.supportSpringCanCoil === true).length, 5);
assert.ok(customParts.some((object) => object.geometry?.type === 'ConeGeometry'));
const customAxialTips = [...new Set(customParts
  .filter((object) => object.userData.axialPipeParallel === true)
  .map((object) => object.userData.tipMm.x)
  .sort((a, b) => a - b))];
assert.deepEqual(customAxialTips, [-25, 25]);
assert.ok(customParts.filter((object) => object.userData.axialPipeParallel === true).every((object) => object.userData.odTwoThirdsResolverApplied === true));

const verticalGuideRoot = customRoots.find((object) => object.name.includes('V-GUIDE'));
assert.ok(verticalGuideRoot);
const verticalGuideBudgetParts = [];
verticalGuideRoot.traverse((object) => {
  if (object.userData?.supportPrimitiveBudgetCounted === true) verticalGuideBudgetParts.push(object);
});
assert.equal(verticalGuideBudgetParts.length, 4);
assert.ok(verticalGuideBudgetParts.every((object) => object.userData.supportDirectionalCone === true));
assert.equal(verticalGuideRoot.userData.supportPreviewPrimitiveBudgetCount, 4);
assert.equal(verticalGuideRoot.userData.supportPreviewPrimitiveBudgetPass, true);
assert.equal(verticalGuideRoot.userData.supportPreviewRaycastDisabled, true);

console.log(JSON.stringify({
  schema: bmAudit.supportVisualPolicy.schema,
  previewGeometry: bmAudit.supportVisualPolicy.previewGeometry,
  maxPrimitiveBudgetPerSupportKind: bmAudit.supportVisualPolicy.maxPrimitiveBudgetPerSupportKind,
  bmCiiSupportVisualCounts: bmAudit.supportVisualCounts,
  gappedLineStopSeparationMm: gapped.supportVisual.gapVisualSeparationMm,
  gappedLineStopTipXs: customAxialTips,
  singleAxisPopupRequired: missingSign.supportVisual.popupRequired,
  springCanPopupRequired: springCan.supportVisual.popupRequired,
  springCanPrimitiveBudgetCount: springCan.supportVisual.previewPrimitiveBudgetCount,
  verticalGuidePrimitiveBudgetCount: verticalGuide.supportVisual.previewPrimitiveBudgetCount
}, null, 2));
