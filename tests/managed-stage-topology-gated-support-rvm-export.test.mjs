import assert from 'node:assert/strict';
import { createBmCiiManagedStageSampleJson } from '../src/managed-stage-bm-cii-json-sample-data.js';
import { convertManagedStageJsonToRvmAtt } from '../src/managed-stage-rvm-converter.js';

const sourceText = createBmCiiManagedStageSampleJson();
const result = convertManagedStageJsonToRvmAtt(sourceText, {
  warningOnlyManagedStageGates: true,
  nonBlockingGeometryGates: true
});

const supportAudit = result.audit.supportRvmExportAudit;
assert.ok(supportAudit, 'support RVM export audit should exist');
assert.equal(supportAudit.schema, 'ManagedStageTopologyGatedSupportRvmExport.v1');
assert.equal(supportAudit.supportRecordCount, 12);
assert.equal(supportAudit.supportTopologyGatePass, true);
assert.equal(supportAudit.supportTopologyBlockedCount, 0);
assert.equal(supportAudit.supportAssociationOnlyCount, 12);
assert.equal(supportAudit.supportContinuityEdgeCount, 0);
assert.equal(supportAudit.supportInlineFaceCount, 0);
assert.ok(supportAudit.supportPrimitiveCount > 0);
assert.ok(supportAudit.nodes.length === 12);

for (const node of supportAudit.nodes) {
  assert.equal(node.attributes.SUPPORT_TOPOLOGY_GATE, 'ok');
  assert.equal(node.attributes.SUPPORT_TOPOLOGY_ASSOCIATION_ONLY, 'TRUE');
  assert.equal(node.attributes.SUPPORT_CONTINUITY_EDGE_BLOCKED, 'TRUE');
  assert.equal(node.attributes.SUPPORT_INLINE_FACE_BLOCKED, 'TRUE');
  for (const primitive of node.primitives) {
    assert.equal(primitive.supportTopologyGate, 'ok');
    assert.equal(primitive.supportTopologyAssociationOnly, true);
    assert.equal(primitive.supportContinuityEdgeBlocked, true);
    assert.equal(primitive.supportInlineFaceBlocked, true);
  }
}

assert.equal(result.exportModel.audit.supportTopologyAudit.summary.supportCount, 12);
assert.equal(result.exportModel.audit.supportTopologyAudit.summary.supportContinuityEdgeCount, 0);
assert.equal(result.exportModel.audit.componentPrimitiveSymbolExportAudit.supportTopologyGatePass, true);

console.log(JSON.stringify({
  supportRecordCount: supportAudit.supportRecordCount,
  supportPrimitiveCount: supportAudit.supportPrimitiveCount,
  supportTopologyGatePass: supportAudit.supportTopologyGatePass,
  supportAssociationOnlyCount: supportAudit.supportAssociationOnlyCount,
  supportContinuityEdgeCount: supportAudit.supportContinuityEdgeCount
}, null, 2));
