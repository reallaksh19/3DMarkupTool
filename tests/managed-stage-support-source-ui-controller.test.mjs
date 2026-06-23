import assert from 'node:assert/strict';
import {
  buildManagedStageSupportSourceUiModel,
  applyManagedStageSupportSourceModeToLegacyFlags,
  normalizeManagedStageSupportSourceMode
} from '../src/managed-stage-support-source-ui-controller.js';
import { MANAGED_STAGE_SUPPORT_SOURCE_MODES } from '../src/managed-stage-support-mapper-config.js';

assert.equal(normalizeManagedStageSupportSourceMode('off'), MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF);
assert.equal(normalizeManagedStageSupportSourceMode('none'), MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF);
assert.equal(normalizeManagedStageSupportSourceMode('iso_note'), MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE);
assert.equal(normalizeManagedStageSupportSourceMode('ISONOTE'), MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE);
assert.equal(normalizeManagedStageSupportSourceMode('stagedJson'), MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON);
assert.equal(normalizeManagedStageSupportSourceMode('unknown'), MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON);

const offFlags = applyManagedStageSupportSourceModeToLegacyFlags('off');
assert.equal(offFlags.supportOverlayEnabled, false);
assert.equal(offFlags.renderActualSupport, false);
assert.equal(offFlags.renderExpectedSupport, false);

const stagedFlags = applyManagedStageSupportSourceModeToLegacyFlags('stagedJson');
assert.equal(stagedFlags.supportOverlayEnabled, true);
assert.equal(stagedFlags.renderActualSupport, true, 'stagedJson must drive actual/staged support records');
assert.equal(stagedFlags.renderExpectedSupport, false, 'stagedJson mode must not also render ISONOTE records');

const isonoteFlags = applyManagedStageSupportSourceModeToLegacyFlags('isonote');
assert.equal(isonoteFlags.supportOverlayEnabled, true);
assert.equal(isonoteFlags.renderActualSupport, false, 'ISONOTE mode must not also render stagedJson support records');
assert.equal(isonoteFlags.renderExpectedSupport, true, 'ISONOTE mode must drive side-loaded support records');

const defaultModel = buildManagedStageSupportSourceUiModel();
assert.equal(defaultModel.schema, 'ManagedStageSupportSourceUi.v1');
assert.deepEqual(defaultModel.sourceOptions.map((option) => option.value), ['off', 'stagedJson', 'isonote']);
assert.equal(defaultModel.axisBasis.up, '+Y');
assert.equal(defaultModel.axisBasis.down, '-Y');
assert.equal(defaultModel.axisBasis.northSourceAxis, '-X');
assert.equal(defaultModel.axisBasis.northEngineeringDirection, 'NORTH');
assert.equal(defaultModel.mapperColumns.includes('supportTag'), true);
assert.equal(defaultModel.mapperColumns.includes('graphicsRule'), true);
assert.equal(defaultModel.mapperColumns.includes('gap'), true);

const customNorth = buildManagedStageSupportSourceUiModel({ sourceMode: 'isonote', northSourceAxis: '+Z' });
assert.equal(customNorth.sourceMode, MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE);
assert.equal(customNorth.axisBasis.northSourceAxis, '+Z');
assert.equal(customNorth.axisBasis.northCanvasAxis, '+Z');
assert.equal(customNorth.legacyFlags.renderExpectedSupport, true);
assert.equal(customNorth.legacyFlags.renderActualSupport, false);

console.log('managed-stage support source UI controller: ok');
