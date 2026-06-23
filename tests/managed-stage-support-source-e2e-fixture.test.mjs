import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  ISONOTE_SUPPORT_SOURCE_OVERLAY_ROOT,
  STAGED_JSON_SUPPORT_SOURCE_OVERLAY_ROOT,
  applyManagedStageSupportSourcePreview
} from '../src/managed-stage-support-source-preview-bridge.js';
import {
  MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS,
  MANAGED_STAGE_SUPPORT_SOURCE_MODES
} from '../src/managed-stage-support-mapper-config.js';

const mapperConfig = {
  mapperPresetId: MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.STAGED_JSON_GENERIC,
  axisBasis: {
    axes: {
      '-X': { engineeringDirection: 'NORTH', canvasAxis: '+Z' }
    }
  }
};

function makePipe({ fromNode = '10', toNode = '20', apos = { x: 0, y: 0, z: 0 }, lpos = { x: 1000, y: 0, z: 0 } } = {}) {
  const pipe = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  pipe.name = `PIPE_${fromNode}_TO_${toNode}`;
  pipe.userData = {
    TYPE: 'MANAGED_STAGE_RAW_PREVIEW',
    primitiveKind: 'raw-staged-source-line',
    stagedType: 'PIPE',
    dtxr: 'PIPE',
    rawType: 'PIPE',
    sourceName: pipe.name,
    sourcePath: `/BRANCH/${pipe.name}`,
    fromNode,
    toNode,
    sourceAposMm: apos,
    sourceLposMm: lpos,
    attrs: { OUTSIDE_DIAMETER_MM: '100' }
  };
  return pipe;
}

function makeStagedSupport({
  name,
  sourceName,
  node,
  pos,
  sourceAttributes,
  initialFamily = 'UNKNOWN'
}) {
  const support = new THREE.Group();
  support.name = name;
  support.userData = {
    TYPE: 'MANAGED_STAGE_SUPPORT_RESTRAINT_PREVIEW',
    primitiveKind: 'managed-stage-support-symbol',
    managedStageSupportVisual: true,
    supportSourceMode: MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON,
    sourceName,
    sourcePath: `/BRANCH/${sourceName}`,
    stagedType: 'SUPPORT',
    dtxr: 'SUPPORT',
    rawType: 'SUPPORT',
    previewPosMm: pos,
    sourceAttributes: { ...sourceAttributes, NODE: node },
    supportVisual: {
      rawKind: 'SUPPORT',
      family: initialFamily,
      node,
      popupRequired: false,
      gapRecordScoped: true,
      gapCarryForward: false,
      cluster: { offsetMagnitudeMm: 0 },
      gapVisualSeparationMm: 0
    }
  };
  return support;
}

function findOverlay(scene, name) {
  return scene.children.find((child) => child.name === name) || null;
}

function findSupportByFamily(overlay, family) {
  return overlay?.children.find((child) => child.userData?.supportVisual?.family === family) || null;
}

const stagedScene = new THREE.Scene();
stagedScene.add(makePipe());
stagedScene.add(makeStagedSupport({
  name: 'STAGED_LINE_STOP_WITH_GAP',
  sourceName: 'PS-E2E-LS-020',
  node: '20',
  pos: { x: 1000, y: 0, z: 0 },
  sourceAttributes: {
    DTXR: 'LINE STOP',
    SUPPORT_TAG: 'PS-E2E-LS-020',
    SUPPORT_KIND: 'LINE STOP',
    SUPPORT_TYPE: 'LIMIT',
    SUPPORT_AXIS: '-X',
    SUPPORT_GAP_MM: '2mm'
  }
}));
stagedScene.add(makeStagedSupport({
  name: 'STAGED_GUIDE_NO_GAP',
  sourceName: 'PS-E2E-GD-010',
  node: '10',
  pos: { x: 0, y: 0, z: 0 },
  sourceAttributes: {
    DTXR: 'GUIDE',
    SUPPORT_TAG: 'PS-E2E-GD-010',
    SUPPORT_KIND: 'GUIDE',
    SUPPORT_AXIS: '+Y'
  },
  initialFamily: 'GUIDE'
}));

const stagedResult = applyManagedStageSupportSourcePreview(stagedScene, {
  sourceMode: 'stagedJson',
  mapperConfig
});
assert.equal(stagedResult.status, MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON);
assert.equal(stagedResult.diagnostics.sourceMode, MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON);
assert.equal(stagedResult.diagnostics.stagedJsonSymbolCount, 2);
assert.equal(stagedResult.diagnostics.isonoteSymbolCount, 0);
assert.equal(stagedResult.diagnostics.activeSourceExclusive, true);
assert.equal(stagedResult.diagnostics.gapCarryForwardViolationCount, 0);
assert.equal(stagedResult.diagnostics.supportCanvasAxisHistogram['+Z'], 1);
assert.equal(Boolean(findOverlay(stagedScene, ISONOTE_SUPPORT_SOURCE_OVERLAY_ROOT)), false);
const stagedOverlay = findOverlay(stagedScene, STAGED_JSON_SUPPORT_SOURCE_OVERLAY_ROOT);
assert.ok(stagedOverlay, 'stagedJson-only mode should create the stagedJson support overlay');
assert.equal(stagedOverlay.children.length, 2);
const stagedLineStop = findSupportByFamily(stagedOverlay, 'LINE_STOP');
assert.ok(stagedLineStop, 'stagedJson fixture should emit the mapped line-stop support');
assert.equal(stagedLineStop.userData.stagedJsonMapperRecord.supportTag, 'PS-E2E-LS-020');
assert.equal(stagedLineStop.userData.stagedJsonMapperRecord.axis.sourceAxis, '-X');
assert.equal(stagedLineStop.userData.stagedJsonMapperRecord.axis.canvasAxis, '+Z');
assert.equal(stagedLineStop.userData.supportVisual.explicitAxis.axis, 'Z');
assert.equal(stagedLineStop.userData.supportVisual.explicitAxis.sign, '+');
assert.equal(stagedLineStop.userData.supportVisual.gapMm, 2);
assert.equal(stagedLineStop.userData.supportVisual.gapVisualSeparationMm, 20, 'positive axial gap should produce 10x visual separation when below the cap');
assert.equal(stagedLineStop.children.some((part) => part.userData?.supportGapVisualSeparationRawMm === 20), true);
assert.equal(stagedLineStop.children.some((part) => part.userData?.supportGapVisualSeparationExportMm === 20), true);
const stagedGuide = findSupportByFamily(stagedOverlay, 'GUIDE');
assert.ok(stagedGuide, 'stagedJson fixture should emit the guide support');
assert.equal(stagedGuide.userData.supportVisual.gapMm, 0, 'gap must not carry forward from the line stop record');
assert.equal(stagedGuide.userData.supportVisual.gapCarryForward, false);
assert.equal(stagedGuide.userData.stagedJsonMapperRecord.gap.carryForward, false);

const isonoteScene = new THREE.Scene();
isonoteScene.add(makePipe());
isonoteScene.add(makeStagedSupport({
  name: 'STAGED_SUPPORT_SHOULD_BE_REMOVED_IN_ISONOTE_MODE',
  sourceName: 'PS-STAGED-REMOVED',
  node: '20',
  pos: { x: 1000, y: 0, z: 0 },
  sourceAttributes: {
    DTXR: 'GUIDE',
    SUPPORT_TAG: 'PS-STAGED-REMOVED',
    SUPPORT_KIND: 'GUIDE'
  },
  initialFamily: 'GUIDE'
}));
const isonoteText = 'NODE,ISONOTE\n20,"/PS-E2E-ISONOTE:ISONOTE LINE STOP AXIS -X GAP 2mm"';
const isonoteResult = applyManagedStageSupportSourcePreview(isonoteScene, {
  sourceMode: 'isonote',
  isonoteText,
  mapperConfig: {
    ...mapperConfig,
    mapperPresetId: MANAGED_STAGE_SUPPORT_MAPPER_PRESET_IDS.ISONOTE_GENERIC
  }
});
assert.equal(isonoteResult.status, MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE);
assert.equal(isonoteResult.diagnostics.sourceMode, MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE);
assert.equal(isonoteResult.diagnostics.stagedJsonSymbolCount, 0);
assert.equal(isonoteResult.diagnostics.isonoteSymbolCount, 1);
assert.equal(isonoteResult.diagnostics.activeSourceExclusive, true);
assert.equal(isonoteResult.diagnostics.axisBasisAppliedCount, 1);
assert.equal(isonoteResult.diagnostics.supportCanvasAxisHistogram['+Z'], 1);
assert.equal(isonoteResult.diagnostics.gapCarryForwardViolationCount, 0);
assert.equal(Boolean(findOverlay(isonoteScene, STAGED_JSON_SUPPORT_SOURCE_OVERLAY_ROOT)), false);
const isonoteOverlay = findOverlay(isonoteScene, ISONOTE_SUPPORT_SOURCE_OVERLAY_ROOT);
assert.ok(isonoteOverlay, 'ISONOTE-only mode should create the ISONOTE overlay');
assert.equal(isonoteOverlay.children.length, 1);
const isonoteLineStop = findSupportByFamily(isonoteOverlay, 'LINE_STOP');
assert.ok(isonoteLineStop, 'ISONOTE fixture should emit the mapped line-stop support');
assert.equal(isonoteLineStop.userData.isonoteMapperRecord.axis.sourceAxis, '-X');
assert.equal(isonoteLineStop.userData.isonoteMapperRecord.axis.canvasAxis, '+Z');
assert.equal(isonoteLineStop.userData.supportVisual.explicitAxis.axis, 'Z');
assert.equal(isonoteLineStop.userData.supportVisual.explicitAxis.sign, '+');
assert.equal(isonoteLineStop.userData.supportVisual.gapMm, 2);
assert.equal(isonoteLineStop.userData.supportVisual.gapVisualSeparationMm, 20);

const offResult = applyManagedStageSupportSourcePreview(isonoteScene, { sourceMode: 'off' });
assert.equal(offResult.status, MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF);
assert.equal(offResult.diagnostics.sourceMode, MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF);
assert.equal(offResult.diagnostics.supportSymbolCount, 0);
assert.equal(offResult.diagnostics.supportRulePreviewRows.length, 0);
assert.equal(offResult.diagnostics.pass, true);
assert.equal(Boolean(findOverlay(isonoteScene, ISONOTE_SUPPORT_SOURCE_OVERLAY_ROOT)), false);
assert.equal(Boolean(findOverlay(isonoteScene, STAGED_JSON_SUPPORT_SOURCE_OVERLAY_ROOT)), false);

console.log('managed-stage-support-source-e2e-fixture tests passed');
