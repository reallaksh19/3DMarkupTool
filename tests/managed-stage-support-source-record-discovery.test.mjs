import assert from 'node:assert/strict';
import * as THREE from 'three';

import { parseManagedStageProfile } from '../src/managed-stage-profile-parser.js';
import {
  STAGED_JSON_SUPPORT_SOURCE_OVERLAY_ROOT,
  applyManagedStageSupportSourcePreview
} from '../src/managed-stage-support-source-preview-bridge.js';

const profile = parseManagedStageProfile({
  schema: 'inputxml-managed-stage/v1',
  profile: 'AVEVA_JSON_FOR_3D_RVM_VIEWER',
  units: { length: 'mm' },
  hierarchy: [{
    name: '/TEST',
    type: 'BRAN',
    children: [{
      name: 'PS-GUIDE-RAW',
      type: 'GENERIC',
      attributes: {
        NAME: 'PS-GUIDE-RAW',
        DTXR: 'GUIDE',
        SUPPORT_TAG: 'PS-GUIDE-RAW',
        SUPPORTCOORD: 'E 10 N 20 U 30',
        SUPPORT_GAP_MM: '10mm'
      }
    }, {
      name: 'PS-REST-ARRAY',
      type: 'GENERIC',
      attributes: {
        NAME: 'PS-REST-ARRAY',
        SUPPORT_KIND: 'REST',
        SUPPORT_COORD: [100, 200, 300]
      }
    }]
  }]
});
assert.equal(profile.supportRecords.length, 2, 'GUIDE/REST records must be treated as support records');
assert.equal(profile.geometryRecords.length, 0, 'support-family records must not leak into normal geometry records');
assert.equal(profile.supportRecords[0].attributes.SUPPORT_GAP_MM, 10);
assert.deepEqual(profile.supportRecords[0].attributes.SUPPORTCOORD, { x: 10, y: 20, z: 30 });
assert.equal(profile.supportRecords[0].attributes.SUPPORT_COORDINATE_SOURCE_FIELD, 'SUPPORTCOORD');
assert.equal(profile.supportRecords[0].attributes.SUPPORT_COORDINATE_NORMALIZED, 'TRUE');
assert.deepEqual(profile.supportRecords[1].attributes.SUPPORTCOORD, { x: 100, y: 200, z: 300 });
assert.equal(profile.supportRecords[1].attributes.SUPPORT_COORDINATE_SOURCE_FIELD, 'SUPPORT_COORD');
assert.equal(profile.recordDiscovery.schema, 'ManagedStageRecordDiscovery.v3');
assert.match(profile.recordDiscovery.supportCoordinateNormalization, /directional E-N-U strings/);

const scene = new THREE.Scene();
const rawSupportLine = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
rawSupportLine.name = 'RAW_GUIDE_SOURCE_LINE';
rawSupportLine.userData = {
  TYPE: 'MANAGED_STAGE_RAW_PREVIEW',
  primitiveKind: 'raw-staged-source-line',
  stagedType: 'GENERIC',
  rawType: 'GENERIC',
  dtxr: 'GUIDE',
  sourceName: 'PS-GUIDE-LINE',
  sourcePath: '/TEST/PS-GUIDE-LINE',
  fromNode: '10',
  toNode: '20',
  sourceAposMm: { x: 0, y: 0, z: 0 },
  sourceLposMm: { x: 100, y: 0, z: 0 },
  sourceAttributes: {
    DTXR: 'GUIDE',
    SUPPORT_TAG: 'PS-GUIDE-LINE',
    SUPPORT_KIND: 'GUIDE',
    SUPPORT_GAP_MM: '5mm'
  }
};
scene.add(rawSupportLine);

const result = applyManagedStageSupportSourcePreview(scene, { sourceMode: 'stagedJson', mapperConfig: { fieldMapper: { supportTagFields: ['SUPPORT_TAG'], supportKindFields: ['SUPPORT_KIND', 'DTXR'], gapFields: ['SUPPORT_GAP_MM', '*GAP*'] } } });
assert.equal(result.status, 'stagedJson');
assert.equal(result.stagedJsonSupportRecordCount, 1, 'raw staged source support line must feed the support overlay');
assert.equal(result.diagnostics.stagedJsonSymbolCount, 1);
assert.equal(result.diagnostics.supportFamilyHistogram.GUIDE, 1);
const overlay = scene.children.find((child) => child.name === STAGED_JSON_SUPPORT_SOURCE_OVERLAY_ROOT);
assert.ok(overlay, 'stagedJson support overlay root must be created from raw source records');
assert.equal(overlay.children.length, 1);
assert.equal(overlay.children[0].userData.stagedJsonMapperRecord.supportTag, 'PS-GUIDE-LINE');

console.log('managed-stage support source record discovery tests passed');
