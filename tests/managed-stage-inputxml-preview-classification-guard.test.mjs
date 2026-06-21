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
  managedStageCoordinateAudit: { rows: [{ isBend: true, name: 'BEND_ROUTE_SEGMENT' }] }
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

const result = api.apply(scene, { sourceName: 'BM_CII_INPUT_managed_stage.json' });
assert.equal(result.patchedSourceLines, 1);
assert.equal(result.patchedElbowCues, 1);
assert.equal(bendSource.userData.visualIsBend, false);
assert.equal(bendSource.userData.inputXmlBendVisualClassificationSuppressed, true);
assert.equal(bendSource.material.color.getHex(), 0x3d74c5);
assert.equal(elbowCue.userData.cueKind, 'orthogonal-elbow-preview');
assert.equal(elbowCue.material.color.getHex(), 0x3d74c5);
assert.equal(scene.userData.managedStageCoordinateAudit.rows[0].visualIsBend, false);

console.log(JSON.stringify({
  schema: 'managed-stage-inputxml-preview-classification-guard-test',
  patchedSourceLines: result.patchedSourceLines,
  patchedElbowCues: result.patchedElbowCues,
  visualIsBend: bendSource.userData.visualIsBend,
  sourceColor: bendSource.material.color.getHexString()
}, null, 2));
