import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  ISONOTE_SUPPORT_SOURCE_OVERLAY_ROOT,
  STAGED_JSON_SUPPORT_SOURCE_OVERLAY_ROOT,
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

function makePipe() {
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
  return pipe;
}

function makeStagedSupport() {
  const stagedSupport = new THREE.Group();
  stagedSupport.name = 'MANAGED_STAGE_SUPPORT_STAGED_JSON_GUIDE';
  stagedSupport.userData = {
    TYPE: 'MANAGED_STAGE_SUPPORT_RESTRAINT_PREVIEW',
    primitiveKind: 'managed-stage-support-symbol',
    managedStageSupportVisual: true,
    supportSourceMode: MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON,
    sourceName: 'PS-001',
    sourcePath: '/BRANCH/PS-001',
    stagedType: 'SUPPORT',
    dtxr: 'SUPPORT',
    rawType: 'SUPPORT',
    previewPosMm: { x: 0, y: 0, z: 0 },
    supportVisual: {
      rawKind: 'REST',
      family: 'GUIDE',
      node: '10',
      popupRequired: false,
      gapRecordScoped: true,
      gapCarryForward: false,
      cluster: { offsetMagnitudeMm: 0 },
      gapVisualSeparationMm: 0
    }
  };
  return stagedSupport;
}

const scene = new THREE.Scene();
const pipe = makePipe();
scene.add(pipe);
const stagedSupport = makeStagedSupport();
scene.add(stagedSupport);

const pipeRecords = collectPreviewPipeRecordsFromScene(scene);
assert.equal(pipeRecords.length, 1);
assert.equal(pipeRecords[0].fromNode, '10');
assert.deepEqual(pipeRecords[0].source.apos, { x: 0, y: 0, z: 0 });

const noteText = 'NODE,ISONOTE\n10,"/PS-001:ISONOTE GUIDE, LINE STOP AXIS -X GAP 4mm"';
const customMapperConfig = {
  fieldMapper: {
    supportTagFields: ['SUPPORT_TAG'],
    supportKindFields: ['SUPPORT_KIND'],
    graphicsRuleFields: ['SUPPORT_GRAPHICS_RULE', 'SUPPORT_KIND'],
    axisFields: ['SUPPORT_AXIS'],
    signFields: ['SUPPORT_SIGN'],
    gapFields: ['SUPPORT_GAP_MM', '*GAP*']
  },
  axisBasis: {
    axes: {
      '-X': { engineeringDirection: 'NORTH', canvasAxis: '+Z' }
    }
  }
};
const isonoteRecords = buildIsonoteSupportPreviewRecords(noteText, pipeRecords, { mapperConfig: customMapperConfig });
assert.equal(isonoteRecords.length, 2);
assert.equal(isonoteRecords[0].source.supportCoord.x, 0);
assert.equal(isonoteRecords[0].source.supportCoord.y, 0);
assert.equal(isonoteRecords[0].source.supportCoord.z, 0);
assert.equal(isonoteRecords[0].isonoteMapperRecord.config.fieldMapper.supportKindFields[0], 'SUPPORT_KIND');
assert.equal(isonoteRecords[1].attrs.SUPPORT_GAP_MM, '4mm');
assert.equal(isonoteRecords[1].attrs.SUPPORT_GAP_CARRY_FORWARD, 'FALSE');
assert.equal(isonoteRecords[1].isonoteMapperRecord.axis.sourceAxis, '-X');
assert.equal(isonoteRecords[1].isonoteMapperRecord.axis.canvasAxis, '+Z');
assert.equal(isonoteRecords[1].attrs.AXIS, '+Z');
assert.equal(isonoteRecords[1].attrs.DIRECTION, '+Z');
assert.equal(isonoteRecords[1].attrs.RESTRAINT_AXIS, '+Z');
assert.equal(isonoteRecords[1].attrs.SUPPORT_AXIS_SOURCE_ORIGINAL, '-X');
assert.equal(isonoteRecords[1].attrs.SUPPORT_AXIS_CANVAS_APPLIED, 'TRUE');

const preDiagnostics = collectManagedStageSupportSourcePreviewDiagnostics(scene, { sourceMode: 'stagedJson', status: 'stagedJson' });
assert.equal(preDiagnostics.stagedJsonSymbolCount, 1);
assert.equal(preDiagnostics.isonoteSymbolCount, 0);
assert.equal(preDiagnostics.supportFamilyHistogram.GUIDE, 1);
assert.equal(preDiagnostics.supportRulePreviewRows.length, 1);
assert.equal(preDiagnostics.supportRulePreviewRows[0].supportTag, 'PS-001');
assert.equal(preDiagnostics.supportRulePreviewRows[0].family, 'GUIDE');
assert.equal(preDiagnostics.supportRulePreviewRows[0].graphicsRule, 'lateral-by-pipe-orientation');
assert.equal(preDiagnostics.activeSourceExclusive, true);
assert.equal(preDiagnostics.pass, true);

const issueScene = new THREE.Scene();
const issueSupport = makeStagedSupport();
issueSupport.userData.sourceName = 'PS-BAD';
issueSupport.userData.stagedJsonMapperRecord = {
  sourceMode: MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON,
  supportTag: 'PS-BAD',
  family: 'UNKNOWN',
  axis: { canvasAxis: '+X' },
  attrs: { NODE: '10', SUPPORT_KIND_SOURCE_FIELD: 'SUPPORT_KIND', SUPPORT_AXIS_SOURCE_FIELD: 'SUPPORT_AXIS' },
  preflight: {
    pass: true,
    popupRequired: true,
    issueCount: 1,
    warningCount: 1,
    errorCount: 0,
    issues: [{ code: 'unknown-support-family', severity: 'warning', message: 'Support kind did not match configured graphics rules.' }]
  }
};
issueScene.add(issueSupport);
const issueDiagnostics = collectManagedStageSupportSourcePreviewDiagnostics(issueScene, { sourceMode: 'stagedJson', status: 'stagedJson' });
assert.equal(issueDiagnostics.mapperPreflightIssueCount, 1);
assert.equal(issueDiagnostics.mapperPreflightWarningCount, 1);
assert.equal(issueDiagnostics.mapperPreflightPopupRequiredCount, 1);
assert.equal(issueDiagnostics.mapperPreflightIssues.length, 1);
assert.equal(issueDiagnostics.mapperPreflightIssues[0].code, 'unknown-support-family');
assert.equal(issueDiagnostics.mapperPreflightIssues[0].supportTag, 'PS-BAD');
assert.equal(issueDiagnostics.mapperPreflightIssues[0].axis, '+X');
assert.equal(issueDiagnostics.supportRulePreviewRows[0].supportTag, 'PS-BAD');
assert.equal(issueDiagnostics.supportRulePreviewRows[0].popupRequired, true);

const isonoteResult = applyManagedStageSupportSourcePreview(scene, {
  sourceMode: 'isonote',
  isonoteText: noteText,
  mapperConfig: customMapperConfig
});
assert.equal(isonoteResult.status, 'isonote');
assert.equal(isonoteResult.mapperConfigApplied, true);
assert.equal(isonoteResult.isonoteSupportRecordCount, 2);
assert.equal(isonoteResult.diagnostics.sourceMode, MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE);
assert.equal(isonoteResult.diagnostics.mapperConfigApplied, true);
assert.equal(isonoteResult.diagnostics.supportSymbolCount, 2);
assert.equal(isonoteResult.diagnostics.isonoteSymbolCount, 2);
assert.equal(isonoteResult.diagnostics.stagedJsonSymbolCount, 0);
assert.equal(isonoteResult.diagnostics.activeSourceExclusive, true);
assert.equal(isonoteResult.diagnostics.gapCarryForwardViolationCount, 0);
assert.equal(isonoteResult.diagnostics.axisBasisAppliedCount, 1);
assert.equal(isonoteResult.diagnostics.supportCanvasAxisHistogram['+Z'], 1);
assert.equal(isonoteResult.diagnostics.supportRulePreviewRows.length, 2);
const lineStopRuleRow = isonoteResult.diagnostics.supportRulePreviewRows.find((row) => row.family === 'LINE_STOP');
assert.ok(lineStopRuleRow, 'rule preview should include ISONOTE line stop');
assert.equal(lineStopRuleRow.sourceAxis, '-X');
assert.equal(lineStopRuleRow.canvasAxis, '+Z');
assert.equal(lineStopRuleRow.sign, '+');
assert.equal(lineStopRuleRow.gapMm, 4);
assert.equal(lineStopRuleRow.graphicsRule, 'axial-pair-or-explicit-sign');
assert.equal(lineStopRuleRow.emittedSymbolCount, 2);
assert.equal(isonoteResult.diagnostics.pass, true);
assert.equal(scene.children.includes(stagedSupport), false, 'ISONOTE mode must remove stagedJson support symbols');
const overlay = scene.children.find((child) => child.name === ISONOTE_SUPPORT_SOURCE_OVERLAY_ROOT);
assert.ok(overlay, 'ISONOTE mode should create a dedicated support source overlay root');
assert.equal(overlay.children.length, 2);
assert.equal(overlay.userData.sourceMode, MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE);
assert.equal(overlay.userData.mapperConfigApplied, true);
const lineStopOverlay = overlay.children.find((child) => child.userData?.isonoteMapperRecord?.family === 'LINE_STOP');
assert.ok(lineStopOverlay, 'ISONOTE line stop should be present');
assert.deepEqual(lineStopOverlay.userData.supportVisual.coneSides.map((side) => side.axis), ['+Z']);
assert.equal(lineStopOverlay.userData.supportVisual.explicitAxis.axis, 'Z');
assert.equal(lineStopOverlay.userData.supportVisual.explicitAxis.sign, '+');

const offResult = applyManagedStageSupportSourcePreview(scene, { sourceMode: 'off' });
assert.equal(offResult.status, 'off');
assert.equal(offResult.diagnostics.supportSymbolCount, 0);
assert.equal(offResult.diagnostics.supportRulePreviewRows.length, 0);
assert.equal(offResult.diagnostics.pass, true);
assert.equal(scene.children.some((child) => child.name === ISONOTE_SUPPORT_SOURCE_OVERLAY_ROOT), false, 'Off mode should remove ISONOTE support overlay');

const stagedScene = new THREE.Scene();
stagedScene.add(makePipe());
const stagedOnlySupport = makeStagedSupport();
stagedScene.add(stagedOnlySupport);
const stagedResult = applyManagedStageSupportSourcePreview(stagedScene, { sourceMode: 'stagedJson', mapperConfig: customMapperConfig });
assert.equal(stagedResult.status, 'stagedJson');
assert.equal(stagedResult.mapperConfigApplied, true);
assert.equal(stagedResult.stagedJsonSupportRecordCount, 1);
assert.equal(stagedResult.diagnostics.mapperConfigApplied, true);
assert.equal(stagedResult.diagnostics.stagedJsonSymbolCount, 1);
assert.equal(stagedResult.diagnostics.isonoteSymbolCount, 0);
assert.equal(stagedResult.diagnostics.supportFamilyHistogram.REST, 1, 'mapper rebuild should use SUPPORT_KIND/rawKind for stagedJson support family');
assert.equal(stagedResult.diagnostics.supportRulePreviewRows.length, 1);
assert.equal(stagedResult.diagnostics.supportRulePreviewRows[0].sourceMode, MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON);
assert.equal(stagedResult.diagnostics.supportRulePreviewRows[0].family, 'REST');
assert.equal(stagedResult.diagnostics.supportRulePreviewRows[0].graphicsRule, 'positive-y-upward-arrow');
assert.equal(stagedResult.diagnostics.pass, true);
assert.equal(stagedScene.children.includes(stagedOnlySupport), false, 'mapper-enabled stagedJson mode should rebuild stagedJson support symbols through the mapper contract');
const stagedOverlay = stagedScene.children.find((child) => child.name === STAGED_JSON_SUPPORT_SOURCE_OVERLAY_ROOT);
assert.ok(stagedOverlay, 'stagedJson mode should create a dedicated mapper-applied overlay when mapper config is active');
assert.equal(stagedOverlay.children.length, 1);
assert.equal(stagedOverlay.userData.sourceMode, MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON);
assert.equal(stagedOverlay.userData.mapperConfigApplied, true);

const rawFieldScene = new THREE.Scene();
rawFieldScene.add(makePipe());
const rawFieldSupport = makeStagedSupport();
rawFieldSupport.userData.sourceName = 'GENERIC_SUPPORT_OBJECT';
rawFieldSupport.userData.sourcePath = '/BRANCH/GENERIC_SUPPORT_OBJECT';
rawFieldSupport.userData.previewPosMm = { x: 1000, y: 0, z: 0 };
rawFieldSupport.userData.sourceAttributes = {
  DTXR: 'LINE STOP',
  SUPPORT_TAG: 'PS-RAW-010',
  SUPPORT_KIND: 'LINE STOP',
  SUPPORT_TYPE: 'LIMIT',
  SUPPORT_AXIS: '-X',
  SUPPORT_GAP_MM: '10mm',
  NODE: '20'
};
rawFieldSupport.userData.supportVisual = {
  rawKind: 'SUPPORT',
  family: 'UNKNOWN',
  node: '20',
  popupRequired: false,
  gapRecordScoped: true,
  gapCarryForward: false,
  cluster: { offsetMagnitudeMm: 0 },
  gapVisualSeparationMm: 0
};
rawFieldScene.add(rawFieldSupport);
const rawFieldResult = applyManagedStageSupportSourcePreview(rawFieldScene, { sourceMode: 'stagedJson', mapperConfig: customMapperConfig });
assert.equal(rawFieldResult.status, 'stagedJson');
assert.equal(rawFieldResult.stagedJsonSupportRecordCount, 1);
assert.equal(rawFieldResult.diagnostics.supportFamilyHistogram.LINE_STOP, 1, 'stagedJson source fields should drive family extraction');
assert.equal(rawFieldResult.diagnostics.supportCanvasAxisHistogram['+Z'], 1);
const rawFieldRow = rawFieldResult.diagnostics.supportRulePreviewRows[0];
assert.equal(rawFieldRow.supportTag, 'PS-RAW-010');
assert.equal(rawFieldRow.family, 'LINE_STOP');
assert.equal(rawFieldRow.sourceAxis, '-X');
assert.equal(rawFieldRow.canvasAxis, '+Z');
assert.equal(rawFieldRow.gapMm, 10);
assert.equal(rawFieldRow.graphicsRule, 'axial-pair-or-explicit-sign');
const rawFieldOverlay = rawFieldScene.children.find((child) => child.name === STAGED_JSON_SUPPORT_SOURCE_OVERLAY_ROOT);
assert.ok(rawFieldOverlay, 'source-attribute stagedJson support should rebuild into the staged overlay');
const rebuiltLineStop = rawFieldOverlay.children[0];
assert.equal(rebuiltLineStop.userData.stagedJsonMapperRecord.supportTag, 'PS-RAW-010');
assert.equal(rebuiltLineStop.userData.stagedJsonMapperRecord.attrs.SUPPORT_TAG_SOURCE_FIELD, 'SUPPORT_TAG');
assert.equal(rebuiltLineStop.userData.stagedJsonMapperRecord.attrs.SUPPORT_KIND_SOURCE_FIELD, 'SUPPORT_KIND');
assert.equal(rebuiltLineStop.userData.stagedJsonMapperRecord.attrs.SUPPORT_AXIS_SOURCE_FIELD, 'SUPPORT_AXIS');
assert.equal(rebuiltLineStop.userData.stagedJsonMapperRecord.attrs.SUPPORT_GAP_SOURCE_FIELD, 'SUPPORT_GAP_MM');
assert.equal(rebuiltLineStop.userData.supportVisual.explicitAxis.axis, 'Z');
assert.equal(rebuiltLineStop.userData.supportVisual.explicitAxis.sign, '+');

console.log('managed-stage-support-source-preview-bridge tests passed');
