import assert from 'node:assert/strict';
import { createBmCiiManagedStageSampleJson } from '../src/managed-stage-bm-cii-json-sample-data.js';
import { createManagedStagePreviewScene } from '../src/managed-stage-preview-scene-explicit-bend.js';
import { buildManagedStageTopologyAudit } from '../src/managed-stage-uxml-topology-adapter.js';

const sourceText = createBmCiiManagedStageSampleJson();
const topologyAudit = buildManagedStageTopologyAudit(sourceText, { sourceName: 'BM_CII_INPUT_managed_stage.json' });
assert.equal(topologyAudit.summary.supportCount, 12);
assert.equal(topologyAudit.summary.supportContinuityEdgeCount, 0);

const scene = createManagedStagePreviewScene(sourceText, {
  sourceName: 'BM_CII_INPUT_managed_stage.json',
  topologyAudit
});

const audit = scene.userData.managedStageCoordinateAudit;
assert.ok(audit, 'preview scene should expose coordinate audit');
assert.equal(audit.topologyAuditOk, true);
assert.equal(audit.supportTopologyGatePass, true);
assert.equal(audit.supportTopologyBlockedCount, 0);
assert.equal(audit.supportAssociationOnlyCount, 12);
assert.equal(audit.supportContinuityEdgeCount, 0);
assert.equal(audit.supportInlineFaceCount, 0);
assert.equal(scene.userData.managedStageSupportTopologyGatePass, true);

const supportObjects = [];
scene.traverse((object) => {
  if (object.userData?.TYPE === 'MANAGED_STAGE_SUPPORT_RESTRAINT_PREVIEW') supportObjects.push(object);
});

assert.equal(supportObjects.length, 12);
for (const object of supportObjects) {
  assert.equal(object.userData.supportTopologyGateStatus, 'ok');
  assert.equal(object.userData.supportTopologyAssociationOnly, true);
  assert.equal(object.userData.supportContinuityEdgeBlocked, true);
  assert.equal(object.userData.supportInlineFaceBlocked, true);
  assert.equal(object.userData.exportedRvmGeometry, false);
  assert.equal(object.userData.previewOnly, true);
}

console.log(JSON.stringify({
  supportObjects: supportObjects.length,
  supportTopologyGatePass: audit.supportTopologyGatePass,
  supportAssociationOnlyCount: audit.supportAssociationOnlyCount,
  supportContinuityEdgeCount: audit.supportContinuityEdgeCount,
  supportInlineFaceCount: audit.supportInlineFaceCount
}, null, 2));
