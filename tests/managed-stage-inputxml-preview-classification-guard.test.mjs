import assert from 'node:assert/strict';
import * as THREE from 'three';

global.window = {
  addEventListener() {},
  __3D_MARKUP_VIEWER_RUNTIME__: { renderOnce() {} }
};
global.document = { body: { classList: { contains: () => false } } };

const { installManagedStageInputXmlPreviewClassificationGuard } = await import('../src/managed-stage-inputxml-preview-classification-guard.js');
const api = installManagedStageInputXmlPreviewClassificationGuard();

const scene = new THREE.Scene();
scene.userData = {
  SOURCE_FORMAT: 'inputxml-managed-stage/v1',
  managedStageCoordinateAudit: {
    rows: [
      { isBend: true, name: 'BEND_ROUTE_SEGMENT' },
      { isBend: false, dtxr: 'VALVE', name: 'VALVE_SOURCE' },
      { supportVisual: { family: 'UNKNOWN_RESTRAINT' }, name: 'SUPPORT_UNKNOWN' }
    ]
  }
};

const bendSource = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial({ color: 0xaa55aa })
);
bendSource.userData = { TYPE: 'MANAGED_STAGE_RAW_PREVIEW', dtxr: 'BEND', stagedType: 'BEND' };
scene.add(bendSource);

const elbowCue = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial({ color: 0xaa55aa })
);
elbowCue.userData = { TYPE: 'MANAGED_STAGE_PREVIEW_CUE', cueKind: 'bend' };
scene.add(elbowCue);

const valveSource = new THREE.Mesh(
  new THREE.CylinderGeometry(8, 8, 120, 12),
  new THREE.MeshStandardMaterial({ color: 0xcc2222 })
);
valveSource.name = 'VALVE_SOURCE_LINE';
valveSource.userData = {
  TYPE: 'MANAGED_STAGE_RAW_PREVIEW',
  dtxr: 'VALVE',
  stagedType: 'VALVE',
  sourceStartMm: { x: 0, y: 0, z: 0 },
  sourceEndMm: { x: 120, y: 0, z: 0 }
};
scene.add(valveSource);

const supportFallback = new THREE.Group();
supportFallback.name = 'SUPPORT_UNKNOWN';
supportFallback.userData = {
  TYPE: 'MANAGED_STAGE_SUPPORT_RESTRAINT_PREVIEW',
  previewPosMm: { x: 10, y: 0, z: 20 },
  supportVisual: { family: 'UNKNOWN_RESTRAINT', popupRequired: true, pipeDiameterMm: 100 }
};
const oldWarning = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0xff00ff }));
supportFallback.add(oldWarning);
scene.add(supportFallback);

const result = api.apply(scene, { sourceName: 'BM_CII_INPUT_managed_stage.json' });
assert.equal(result.patchedSourceLines, 1);
assert.equal(result.patchedElbowCues, 1);
assert.equal(result.patchedValveConePairs, 1);
assert.equal(result.patchedSupportFallbackCrossRods, 1);
assert.equal(bendSource.userData.visualIsBend, false);
assert.equal(bendSource.userData.inputXmlBendVisualClassificationSuppressed, true);
assert.equal(bendSource.material.color.getHex(), 0x3d74c5);
assert.equal(elbowCue.userData.cueKind, 'orthogonal-elbow-preview');
assert.equal(elbowCue.material.color.getHex(), 0x3d74c5);
assert.equal(valveSource.userData.inputXmlValveConePairApplied, true);
assert.equal(valveSource.material.transparent, true);
assert.ok(valveSource.material.opacity < 0.3);
assert.equal(supportFallback.userData.supportFallbackCrossRodsApplied, true);
assert.equal(oldWarning.visible, false);
assert.equal(scene.userData.managedStageCoordinateAudit.rows[0].visualIsBend, false);
assert.equal(scene.userData.managedStageCoordinateAudit.rows[1].valvePreviewSymbol, 'opposed-cone-pair');
assert.equal(scene.userData.managedStageCoordinateAudit.rows[2].supportFallbackSymbol, 'translucent-x-rods');

let valveCueCount = 0;
let crossRodCount = 0;
scene.traverse((object) => {
  if (object.userData?.cueKind === 'valve-opposed-cone-pair') valveCueCount += 1;
  if (object.userData?.supportFallbackCrossRods) crossRodCount += 1;
});
assert.equal(valveCueCount, 3); // parent cue group plus two cone parts
assert.equal(crossRodCount, 3); // parent X group plus two rods

console.log(JSON.stringify({
  schema: 'managed-stage-inputxml-preview-classification-guard-test',
  patchedSourceLines: result.patchedSourceLines,
  patchedElbowCues: result.patchedElbowCues,
  patchedValveConePairs: result.patchedValveConePairs,
  patchedSupportFallbackCrossRods: result.patchedSupportFallbackCrossRods,
  visualIsBend: bendSource.userData.visualIsBend,
  sourceColor: bendSource.material.color.getHexString(),
  valveCueCount,
  crossRodCount
}, null, 2));
