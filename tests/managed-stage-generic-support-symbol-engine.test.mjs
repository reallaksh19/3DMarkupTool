import assert from 'node:assert/strict';

import { convertManagedStageJsonToRvmAtt } from '../src/managed-stage-rvm-converter.js';
import { createManagedStagePreviewScene } from '../src/managed-stage-preview-scene.js';

const fixture = {
  schema: 'inputxml-managed-stage/v1',
  profile: 'AVEVA_JSON_FOR_3D_RVM_VIEWER',
  source: 'GENERIC_SUPPORT_INPUT.XML',
  converter: 'INPUTXML->GLB',
  generatedAt: '2026-06-22T00:00:00.000Z',
  units: { length: 'mm' },
  stats: { components: 1, restraints: 3, branches: 1, children: 2 },
  hierarchy: [
    {
      name: '/INPUTXML/GENERIC/BRANCH-001',
      type: 'BRANCH',
      attributes: { TYPE: 'BRAN', NAME: '/INPUTXML/GENERIC/BRANCH-001' },
      children: [
        {
          name: 'PIPE PIPE_10_TO_20',
          type: 'PIPE',
          attributes: {
            TYPE: 'PIPE',
            RAW_TYPE: 'PIPE',
            NAME: 'PIPE_10_TO_20',
            FROM_NODE: '10',
            TO_NODE: '20',
            APOS: { x: 0, y: 0, z: 0 },
            LPOS: { x: 1000, y: 0, z: 0 },
            DIAMETER: '114.3mm',
            DTXR: 'PIPE'
          }
        },
        {
          name: 'SUPPORT_GROUP_WITH_NESTED_RECORDS',
          type: 'GROUP',
          attributes: { TYPE: 'GROUP', NAME: 'SUPPORT_GROUP_WITH_NESTED_RECORDS' },
          children: [
            support('INPUTXML-10-REST', 'ATTA', 'REST', '10', { x: 0, y: 0, z: 0 }, { SUPPORT_GAP_MM: '7mm' }),
            support('INPUTXML-20-GUIDE', 'ANCI', 'GUIDE', '20', { x: 1000, y: 0, z: 0 }),
            support('INPUTXML-20-LINESTOP', 'SUPPORT', 'LINESTOP', '20', { x: 1000, y: 0, z: 0 }, { SUPPORT_AXIAL_GAP_MM: '4mm' })
          ]
        }
      ]
    }
  ]
};

const result = convertManagedStageJsonToRvmAtt(JSON.stringify(fixture));
assert.equal(result.profile.recordDiscovery.schema, 'ManagedStageRecordDiscovery.v2');
assert.equal(result.profile.recordDiscovery.traversal, 'recursive-branch-children');
assert.equal(result.profile.recordDiscovery.supportGapMapperSchema, 'ManagedStageSupportGapMapper.v1');
assert.equal(result.profile.recordDiscovery.supportGapRecordScoped, true);
assert.equal(result.profile.recordDiscovery.supportGapCarryForward, false);
assert.equal(result.profile.geometryRecords.length, 1);
assert.equal(result.profile.supportRecords.length, 3);
assert.equal(result.audit.inputCounts.supportRecordsSkippedFromGeometry, 3);
assert.equal(result.audit.inputCounts.supportRecordsEmittedToRvm, 3);
assert.equal(result.audit.supportRvmExportAudit.supportRecordCount, 3);
assert.equal(result.audit.supportRvmExportAudit.supportFamilies.REST, 1);
assert.equal(result.audit.supportRvmExportAudit.supportFamilies.GUIDE, 1);
assert.equal(result.audit.supportRvmExportAudit.supportFamilies.LINE_STOP, 1);
assert.deepEqual(result.audit.supportRvmExportAudit.supportPrimitiveCodeHistogram, { 8: 12 });
assert.equal(result.audit.supportRvmExportAudit.supportConePrimitiveCount, 0);
assert.deepEqual(result.audit.supportRvmExportAudit.supportForbiddenPrimitiveCodesPresent, []);
assert.ok(result.att.includes('NEW INPUTXML-20-GUIDE'));
assert.ok(result.att.includes('SUPPORT_SYMBOL_POLICY CODE8_COMPACT_BAR_GLYPHS_NO_PYRAMIDS_NO_CONE_FAN'));

const [restRecord, guideRecord, lineStopRecord] = result.profile.supportRecords;
assert.equal(restRecord.attributes.SUPPORT_GAP_MM, '7mm');
assert.equal(restRecord.attributes.SUPPORT_GAP_SOURCE_FIELD, 'SUPPORT_GAP_MM');
assert.equal(restRecord.attributes.SUPPORT_GAP_RECORD_SCOPED, 'TRUE');
assert.equal(restRecord.attributes.SUPPORT_GAP_CARRY_FORWARD, 'FALSE');
assert.equal(guideRecord.attributes.SUPPORT_GAP_SOURCE_FIELD, '', 'GUIDE must not inherit REST gap');
assert.equal(guideRecord.attributes.SUPPORT_GAP_RECORD_SCOPED, 'TRUE');
assert.equal(guideRecord.attributes.SUPPORT_GAP_CARRY_FORWARD, 'FALSE');
assert.equal(lineStopRecord.attributes.GAP, '4mm');
assert.equal(lineStopRecord.attributes.SUPPORT_GAP_MM, '4mm');
assert.equal(lineStopRecord.attributes.SUPPORT_GAP_SOURCE_FIELD, 'SUPPORT_AXIAL_GAP_MM');

const supportNodes = result.exportModel.audit.supportRvmExportAudit.nodes;
const lineStopNode = supportNodes.find((node) => node.name === 'INPUTXML-20-LINESTOP');
assert.ok(lineStopNode, 'LINESTOP support node should be exported');
assert.ok(lineStopNode.primitives.every((primitive) => primitive.supportGapMm === 4), 'LINESTOP primitives should use record-local wildcard *GAP* value');
const guideNode = supportNodes.find((node) => node.name === 'INPUTXML-20-GUIDE');
assert.ok(guideNode.primitives.every((primitive) => primitive.supportGapMm === 0), 'GUIDE must not carry forward REST or LINESTOP gap');

const preview = createManagedStagePreviewScene(fixture, { sourceName: 'GENERIC_SUPPORT_INPUT_managed_stage.json', exportModel: result.exportModel });
const audit = preview.userData.managedStageCoordinateAudit;
assert.equal(audit.supportVisualCounts.total, 3);
assert.equal(audit.supportVisualCounts.REST, 1);
assert.equal(audit.supportVisualCounts.GUIDE, 1);
assert.equal(audit.supportVisualCounts.LINE_STOP, 1);
assert.equal(audit.supportVisualPolicy.previewGeometry, 'compact-code8-equivalent-cylinder-bars-no-cones');
assert.equal(audit.pass, true);

for (const node of supportNodes) {
  for (const primitive of node.primitives) {
    assert.equal(primitive.kind, 'cylinder');
    assert.equal(primitive.supportPrimitiveCode, 8);
    assert.notEqual(primitive.kind, 'pyramid');
    assert.ok(primitive.length <= 60, `${primitive.name} must stay compact`);
    assert.ok(primitive.radius <= 3, `${primitive.name} radius must stay compact`);
  }
}

console.log('generic managed-stage support symbol engine: ok');

function support(name, type, kind, node, pos, extraAttrs = {}) {
  return {
    name: `SUPPORT ${name}`,
    type,
    attributes: {
      TYPE: type,
      RAW_TYPE: type,
      NAME: name,
      SOURCE_RESTRAINT_ID: `${name}_RESTRAINT`,
      SUPPORT_KIND: kind,
      SUPPORT_TYPE: kind,
      NODE: node,
      POS: pos,
      SUPPORTCOORD: pos,
      GAP: '',
      ...extraAttrs
    }
  };
}
