import assert from 'node:assert/strict';
import * as THREE from 'three';

import { parseManagedStageProfile } from '../src/managed-stage-profile-parser.js';
import {
  STAGED_JSON_SUPPORT_SOURCE_OVERLAY_ROOT,
  applyManagedStageSupportSourcePreview
} from '../src/managed-stage-support-source-preview-bridge.js';
import {
  PROFILE_SUPPORT_SOURCE_RECORD_ROOT,
  ensureProfileSupportSourceRecords
} from '../src/managed-stage-profile-support-source-bridge.js';

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

const profileScene = new THREE.Scene();
profileScene.userData.managedStageProfileSupportRecords = profile.supportRecords;
const injectionAudit = ensureProfileSupportSourceRecords(profileScene, { requestedBy: 'test' });
assert.equal(injectionAudit.status, 'injected');
assert.equal(injectionAudit.profileSupportRecordCount, 2);
assert.equal(injectionAudit.injectedCount, 2);
assert.equal(injectionAudit.skippedNoPositionCount, 0);
assert.equal(injectionAudit.skippedNoTokenCount, 0);
const profileSourceRoot = profileScene.children.find((child) => child.name === PROFILE_SUPPORT_SOURCE_RECORD_ROOT);
assert.ok(profileSourceRoot, 'profile support source records should be injected into a non-rendered bridge root');
assert.equal(profileSourceRoot.visible, false);
assert.equal(profileSourceRoot.children.length, 2);
assert.equal(profileSourceRoot.children[0].userData.primitiveKind, 'raw-staged-source-point');
assert.deepEqual(profileSourceRoot.children[0].userData.previewPosMm, { x: 10, y: 20, z: 30 });

const profileOverlayResult = applyManagedStageSupportSourcePreview(profileScene, { sourceMode: 'stagedJson', mapperConfig: { fieldMapper: { supportTagFields: ['SUPPORT_TAG', 'NAME'], supportKindFields: ['SUPPORT_KIND', 'DTXR'], gapFields: ['SUPPORT_GAP_MM', '*GAP*'] } } });
assert.equal(profileOverlayResult.status, 'stagedJson');
assert.equal(profileOverlayResult.stagedJsonSupportRecordCount, 2, 'profile parser support records must feed stagedJson Canvas support overlay');
assert.equal(profileOverlayResult.diagnostics.stagedJsonSymbolCount, 2);
assert.equal(profileOverlayResult.diagnostics.supportFamilyHistogram.GUIDE, 1);
assert.equal(profileOverlayResult.diagnostics.supportFamilyHistogram.REST, 1);
const profileOverlay = profileScene.children.find((child) => child.name === STAGED_JSON_SUPPORT_SOURCE_OVERLAY_ROOT);
assert.ok(profileOverlay, 'stagedJson overlay should be built from profile support source records');
assert.equal(profileOverlay.children.length, 2);

console.log('managed-stage support source record discovery tests passed');
