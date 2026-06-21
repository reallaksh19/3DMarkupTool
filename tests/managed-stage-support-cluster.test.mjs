import assert from 'node:assert/strict';
import { createBmCiiManagedStageSampleJson } from '../src/managed-stage-bm-cii-json-sample-data.js';
import { createManagedStagePreviewScene } from '../src/managed-stage-preview-scene.js';

const scene = createManagedStagePreviewScene(createBmCiiManagedStageSampleJson(), {
  sourceName: 'BM_CII_INPUT_managed_stage.json'
});

const audit = scene.userData.managedStageCoordinateAudit;
const supportRows = audit.rows.filter((row) => row.supportLike);
assert.equal(supportRows.length, 12);

const byNode = new Map();
for (const row of supportRows) {
  const node = row.supportVisual?.node || '';
  if (!byNode.has(node)) byNode.set(node, []);
  byNode.get(node).push(row);
}

for (const [node, expectedCount] of [['35', 3], ['205', 3], ['255', 2]]) {
  const rows = byNode.get(node) || [];
  assert.equal(rows.length, expectedCount, `node ${node} support rows`);
  assert.ok(rows.every((row) => row.supportVisual.cluster?.schema === 'ManagedStageSupportCluster.v1'));
  assert.ok(rows.every((row) => row.supportVisual.cluster.clustered === true));
  assert.ok(rows.every((row) => row.supportVisual.cluster.count === expectedCount));
  assert.ok(rows.every((row) => row.supportVisual.cluster.offsetMagnitudeMm > 0));
  assert.equal(new Set(rows.map((row) => JSON.stringify(row.supportVisual.cluster.offsetMm))).size, expectedCount);
}

const supportRoots = [];
const supportParts = [];
scene.traverse((object) => {
  if (object.userData?.managedStageSupportVisual === true) supportRoots.push(object);
  if (object.userData?.managedStageSupportVisualPart === true) supportParts.push(object);
});
assert.equal(supportRoots.length, 12);
assert.equal(supportRoots.filter((object) => object.userData.supportCluster?.clustered === true).length, 8);
assert.equal(supportParts.filter((object) => object.userData.role === 'clusterOffsetConnector').length, 8);
assert.ok(supportParts.every((object) => object.userData.exportedRvmGeometry === false));

const unknownFixture = {
  schema: 'inputxml-managed-stage/v1',
  profile: 'AVEVA_JSON_FOR_3D_RVM_VIEWER',
  units: { length: 'mm' },
  hierarchy: [{
    name: '/INPUTXML/UNKNOWN-SUPPORT',
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
        name: 'SUPPORT UNKNOWN-FALLBACK',
        type: 'ATTA',
        attributes: {
          TYPE: 'ATTA', NAME: 'UNKNOWN-FALLBACK', NODE: '2', POS: { x: 1000, y: 0, z: 0 },
          SUPPORT_KIND: 'UNKNOWN_SUPPORT_KIND'
        }
      }
    ]
  }]
};
const unknownScene = createManagedStagePreviewScene(unknownFixture, { sourceName: 'unknown-support.json' });
const unknownRow = unknownScene.userData.managedStageCoordinateAudit.rows.find((row) => row.supportLike);
assert.equal(unknownRow.supportVisual.family, 'UNKNOWN_RESTRAINT');
assert.equal(unknownRow.supportVisual.fallbackCrossRods, true);
assert.equal(unknownRow.supportVisual.popupRequired, false);
let fallbackRodCount = 0;
unknownScene.traverse((object) => {
  if (object.userData?.role === 'fallbackCrossRod') fallbackRodCount += 1;
});
assert.equal(fallbackRodCount, 2);

console.log(JSON.stringify({
  supportRows: supportRows.length,
  clusteredNodes: { 35: byNode.get('35')?.length || 0, 205: byNode.get('205')?.length || 0, 255: byNode.get('255')?.length || 0 },
  clusteredSupportRoots: supportRoots.filter((object) => object.userData.supportCluster?.clustered === true).length,
  clusterConnectorCount: supportParts.filter((object) => object.userData.role === 'clusterOffsetConnector').length,
  unknownFallbackRodCount: fallbackRodCount
}, null, 2));
