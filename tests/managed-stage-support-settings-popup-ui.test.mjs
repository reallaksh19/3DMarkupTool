import assert from 'node:assert/strict';
import { MANAGED_STAGE_SUPPORT_SETTINGS_POPUP_SCHEMA, buildManagedStageSupportSettingsPopupModel } from '../src/managed-stage-support-settings-popup-ui.js';

const stagedModel = buildManagedStageSupportSettingsPopupModel({
  supportUi: {
    sourceMode: 'stagedJson',
    legacyFlags: { sourceLabel: 'stagedJson' },
    mapperPresetLabel: 'CAESAR default',
    axisBasis: { northSourceAxis: '-X', northCanvasAxis: '-X' }
  }
});
assert.equal(stagedModel.schema, MANAGED_STAGE_SUPPORT_SETTINGS_POPUP_SCHEMA);
assert.equal(stagedModel.modal, true);
assert.equal(stagedModel.mainPanelMode, 'workflow-card-summary-only');
assert.equal(stagedModel.summaryText, 'Support mapping: stagedJson • CAESAR default • North -X→-X');
assert.deepEqual(stagedModel.retiredStageSettingIds, ['renderActualSupport', 'renderExpectedSupport']);

const isonoteModel = buildManagedStageSupportSettingsPopupModel({
  supportUi: {
    sourceMode: 'isonote',
    legacyFlags: { sourceLabel: 'ISONOTE side-load' },
    mapperPresetLabel: 'ISONOTE generic',
    axisBasis: { northSourceAxis: '+Z', northCanvasAxis: '+Z' }
  },
  isonoteWorkflow: { statusLabel: 'Ready', supportRecordCount: 5, issueCount: 0 }
});
assert.equal(isonoteModel.summaryText, 'Support mapping: ISONOTE side-load • ISONOTE generic • North +Z→+Z');
assert.equal(isonoteModel.isonoteSummaryText, 'ISONOTE: Ready • 5 support record(s) • 0 issue(s)');
assert.equal(isonoteModel.isonoteSupportRecordCount, 5);
assert.equal(isonoteModel.isonoteIssueCount, 0);

const offModel = buildManagedStageSupportSettingsPopupModel({ supportUi: { sourceMode: 'off', mapperPresetLabel: 'CAESAR default' } });
assert.equal(offModel.disabled, true);
assert.equal(offModel.summaryText, 'Support mapping: Off • CAESAR default');

console.log('managed-stage support settings popup UI: ok');
