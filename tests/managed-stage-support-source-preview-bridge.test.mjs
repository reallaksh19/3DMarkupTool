import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  ISONOTE_SUPPORT_SOURCE_OVERLAY_ROOT,
  applyManagedStageSupportSourcePreview,
  buildIsonoteSupportPreviewRecords,
  collectManagedStageSupportSourcePreviewDiagnostics,
  collectPreviewPipeRecordsFromScene,
  normalizeSupportSourceMode
} from '../src/managed-stage-support-source-preview-bridge.js';
import { MANAGED_STAGE_SUPPORT_SOURCE_MODES } from '../src/managed-stage-support-mapper-config.js';

assert.equal(normalizeSupportSourceMode('off'), MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF);
assert.equal(normalizeSupportSourceMode('ISONOTE'), MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE);
assert.equal(normalizeSupportSourceMode('stagedJson'), MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON);

const scene = new THREE.Scene();
const pipe = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
pipe.name = 'PIPE_10_TO_20';
pipe.userData = {
  TYPE: 'MANAGED_STAGE_RAW_PREVIEW',
  primitiveKind: 'raw-staged-source-line',
  stagedType: 'PIPE',
  dtxr: 'PIPE',
  rawType: 'PIPE',
  sourceName: 'PIPE_10_TO_20',
  sourcePath: '/BRANCH/PIPE_10_TO_20',
  fromNode: '10',
  toNode: '20',
  sourceAposMm: { x: 0, y: 0, z: 0 },
  sourceLposMm: { x: 1000, y: 0, z: 0 }
};
scene.add(pipe);

const stagedSupport = new THREE.Group();
stagedSupport.name = 'MANAGED_STAGE_SUPPORT_STAGED_JSON_GUIDE';
stagedSupport.userData = {
  TYPE: 'MANAGED_STAGE_SUPPORT_RESTRAINT_PREVIEW',
  primitiveKind: 'managed-stage-support-symbol',
  managedStageSupportVisual: true,
  supportSourceMode: MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON,
  supportVisual: {
    family: 'GUIDE',
    popupRequired: false,
    gapRecordScoped: true,
    gapCarryForward: false,
    cluster: { offsetMagnitudeMm: 0 },
    gapVisualSeparationMm: 0
  }
};
scene.add(stagedSupport);

const pipeRecords = collectPreviewPipeRecordsFromScene(scene);
assert.equal(pipeRecords.length, 1);
assert.equal(pipeRecords[0].fromNode, '10');
assert.deepEqual(pipeRecords[0].source.apos, { x: 0, y: 0, z: 0 });

const noteText = 'NODE,ISONOTE\n10,"/PS-001:ISONOTE GUIDE, LINE STOP GAP 4mm"';
const isonoteRecords = buildIsonoteSupportPreviewRecords(noteText, pipeRecords);
assert.equal(isonoteRecords.length, 2);
assert.equal(isonoteRecords[0].source.supportCoord.x, 0);
assert.equal(isonoteRecords[0].source.supportCoord.y, 0);
assert.equal(isonoteRecords[0].source.supportCoord.z, 0);
assert.equal(isonoteRecords[1].attrs.SUPPORT_GAP_MM, '4mm');
assert.equal(isonoteRecords[1].attrs.SUPPORT_GAP_CARRY_FORWARD, 'FALSE');

const preDiagnostics = collectManagedStageSupportSourcePreviewDiagnostics(scene, { sourceMode: 'stagedJson', status: 'stagedJson' });
assert.equal(preDiagnostics.stagedJsonSymbolCount, 1);
assert.equal(preDiagnostics.isonoteSymbolCount, 0);
assert.equal(preDiagnostics.supportFamilyHistogram.GUIDE, 1);
assert.equal(preDiagnostics.activeSourceExclusive, true);
assert.equal(preDiagnostics.pass, true);

const isonoteResult = applyManagedStageSupportSourcePreview(scene, {
  sourceMode: 'isonote',
  isonoteText: noteText
});
assert.equal(isonoteResult.status, 'isonote');
assert.equal(isonoteResult.isonoteSupportRecordCount, 2);
assert.equal(isonoteResult.diagnostics.sourceMode, MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE);
assert.equal(isonoteResult.diagnostics.supportSymbolCount, 2);
assert.equal(isonoteResult.diagnostics.isonoteSymbolCount, 2);
assert.equal(isonoteResult.diagnostics.stagedJsonSymbolCount, 0);
assert.equal(isonoteResult.diagnostics.activeSourceExclusive, true);
assert.equal(isonoteResult.diagnostics.gapCarryForwardViolationCount, 0);
assert.equal(isonoteResult.diagnostics.pass, true);
assert.equal(scene.children.includes(stagedSupport), false, 'ISONOTE mode must remove stagedJson support symbols');
const overlay = scene.children.find((child) => child.name === ISONOTE_SUPPORT_SOURCE_OVERLAY_ROOT);
assert.ok(overlay, 'ISONOTE mode should create a dedicated support source overlay root');
assert.equal(overlay.children.length, 2);
assert.equal(overlay.userData.sourceMode, MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE);

const offResult = applyManagedStageSupportSourcePreview(scene, { sourceMode: 'off' });
assert.equal(offResult.status, 'off');
assert.equal(offResult.diagnostics.supportSymbolCount, 0);
assert.equal(offResult.diagnostics.pass, true);
assert.equal(scene.children.some((child) => child.name === ISONOTE_SUPPORT_SOURCE_OVERLAY_ROOT), false, 'Off mode should remove ISONOTE support overlay');

const stagedScene = new THREE.Scene();
stagedScene.add(pipe.clone());
const stagedOnlySupport = stagedSupport.clone();
stagedScene.add(stagedOnlySupport);
const stagedResult = applyManagedStageSupportSourcePreview(stagedScene, { sourceMode: 'stagedJson' });
assert.equal(stagedResult.status, 'stagedJson');
assert.equal(stagedResult.diagnostics.stagedJsonSymbolCount, 1);
assert.equal(stagedResult.diagnostics.isonoteSymbolCount, 0);
assert.equal(stagedResult.diagnostics.supportFamilyHistogram.GUIDE, 1);
assert.equal(stagedResult.diagnostics.pass, true);
assert.equal(stagedScene.children.includes(stagedOnlySupport), true, 'stagedJson mode should keep stagedJson support symbols');
console.log('managed-stage-support-source-preview-bridge tests passed');
