import assert from 'node:assert/strict';
import {
  DEFAULT_MANAGED_STAGE_ISONOTE_SIDELOAD_SAMPLE,
  MANAGED_STAGE_ISONOTE_TEXT_WORKFLOW_SCHEMA,
  applyManagedStageIsonoteTextWorkflowToCanvas,
  buildIsonoteWorkflowSummary,
  buildManagedStageIsonoteTextWorkflowModel
} from '../src/managed-stage-isonote-workflow-ui.js';
import { MANAGED_STAGE_SUPPORT_SOURCE_MODES } from '../src/managed-stage-support-mapper-config.js';

const sampleModel = buildManagedStageIsonoteTextWorkflowModel(DEFAULT_MANAGED_STAGE_ISONOTE_SIDELOAD_SAMPLE);
assert.equal(sampleModel.schema, MANAGED_STAGE_ISONOTE_TEXT_WORKFLOW_SCHEMA);
assert.equal(sampleModel.status, 'ready');
assert.equal(sampleModel.rowCount, 3);
assert.equal(sampleModel.supportRecordCount, 5);
assert.equal(sampleModel.canApply, true);
assert.equal(sampleModel.supportFamilyHistogram.REST, 1);
assert.equal(sampleModel.supportFamilyHistogram.GUIDE, 1);
assert.equal(sampleModel.supportFamilyHistogram.LINESTOP, 1);
assert.equal(sampleModel.supportFamilyHistogram.HOLDDOWN, 1);
assert.equal(sampleModel.supportFamilyHistogram.SPRING_CAN, 1);
assert.equal(sampleModel.previewRows.find((row) => row.family === 'LINESTOP')?.sourceAxis, '-X');
assert.equal(sampleModel.previewRows.find((row) => row.family === 'GUIDE')?.gapMm, 10);
assert.equal(buildIsonoteWorkflowSummary(sampleModel), 'Ready: 3 row(s), 5 support record(s), 0 issue(s).');

const emptyModel = buildManagedStageIsonoteTextWorkflowModel('');
assert.equal(emptyModel.status, 'empty');
assert.equal(emptyModel.supportRecordCount, 0);
assert.equal(emptyModel.canApply, false);

const noSupportModel = buildManagedStageIsonoteTextWorkflowModel('NODE,ISONOTE\n100,"/PS-100:ISONOTE NO REST WITHOUT GUIDE"');
assert.equal(noSupportModel.status, 'no-support-records');
assert.equal(noSupportModel.issueCount, 1);
assert.equal(noSupportModel.issues[0].code, 'NO_SUPPORT_RECORDS');

let changed = false;
let bridgeOptions = null;
const fakeSupportMode = {
  value: '',
  ownerDocument: { defaultView: { Event: class { constructor(type, init) { this.type = type; this.bubbles = Boolean(init?.bubbles); } } } },
  dispatchEvent(event) { if (event.type === 'change') changed = true; }
};
const fakeDoc = {
  getElementById(id) {
    if (id === 'isonoteText') return { value: DEFAULT_MANAGED_STAGE_ISONOTE_SIDELOAD_SAMPLE };
    if (id === 'supportMode') return fakeSupportMode;
    return null;
  }
};
const fakeWin = {
  __3D_MARKUP_SUPPORT_SOURCE_UI__: { mapperConfig: {} },
  __3D_MARKUP_VIEWER_RUNTIME__: { modelRoot: { name: 'modelRoot' }, renderOnce(reason) { this.reason = reason; } },
  __3D_MARKUP_SUPPORT_SOURCE_PREVIEW_BRIDGE__: { apply(root, options) { bridgeOptions = { root, options }; return { status: 'isonote' }; } },
  dispatchEvent() {}
};
const applied = applyManagedStageIsonoteTextWorkflowToCanvas({ doc: fakeDoc, win: fakeWin });
assert.equal(changed, true);
assert.equal(fakeSupportMode.value, MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE);
assert.equal(applied.appliedToCanvas, true);
assert.equal(bridgeOptions.options.sourceMode, MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE);
assert.equal(bridgeOptions.options.isonoteText.includes('LINE STOP'), true);

console.log('managed-stage ISONOTE workflow UI: ok');
