import assert from 'node:assert/strict';

class TestCustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
}

global.CustomEvent = TestCustomEvent;
global.window = {
  addEventListener() {},
  dispatchEvent() {},
  __3D_MARKUP_VIEWER_RUNTIME__: { renderOnce() {} }
};
global.document = { body: { classList: { contains: () => false } } };

const { createBmCiiManagedStageSampleJson } = await import('../src/managed-stage-bm-cii-json-sample-data.js');
const { createManagedStagePreviewScene } = await import('../src/managed-stage-preview-scene.js');
const { installManagedStageInputXmlPreviewClassificationGuard } = await import('../src/managed-stage-inputxml-preview-classification-guard.js');
const { applyManagedStageGeometryLedger, assertManagedStageGeometryLedger } = await import('../src/managed-stage-geometry-ledger.js');

const sourceText = createBmCiiManagedStageSampleJson();
const scene = createManagedStagePreviewScene(sourceText, { sourceName: 'BM_CII_INPUT_managed_stage.json' });

const classificationGuard = installManagedStageInputXmlPreviewClassificationGuard();
classificationGuard.apply(scene, { sourceName: 'BM_CII_INPUT_managed_stage.json' });

const ledger = applyManagedStageGeometryLedger(scene, { sourceName: 'BM_CII_INPUT_managed_stage.json' });
assertManagedStageGeometryLedger(ledger);

assert.equal(ledger.schema, 'ManagedStageGeometryLedger.v1');
assert.equal(ledger.pass, true);
assert.equal(ledger.sourceRowCount, 40);
assert.equal(ledger.canvasSourceFoundCount, 40);
assert.equal(ledger.hiddenSourceRowCount, 0);
assert.equal(ledger.detachedElbowCueCount, 0);
assert.equal(ledger.branchNodeCount, 5);
assert.equal(ledger.branchCueNodeCount, 5);
assert.equal(ledger.missingBranchCueNodeCount, 0);
assert.equal(ledger.unresolvedBranchNodeCount, 0);
assert.equal(ledger.valveSourceRowCount, 6);
assert.equal(ledger.valveCueSourceRowCount, 6);
assert.equal(ledger.valveRowsWithoutCueCount, 0);

const byComponent = new Map(ledger.componentSummary.map((row) => [row.component, row]));
assert.equal(byComponent.get('PIPE').jsonSourceCount, 18);
assert.equal(byComponent.get('PIPE').canvasSourceFound, 18);
assert.equal(byComponent.get('BEND').jsonSourceCount, 7);
assert.equal(byComponent.get('BEND').canvasSourceFound, 7);
assert.equal(byComponent.get('BEND').generatedCueCount, 7);
assert.equal(byComponent.get('OLET_BRANCH').jsonSourceCount, 0);
assert.equal(byComponent.get('OLET_BRANCH').generatedCueCount, 5);
assert.equal(byComponent.get('FLANGE').jsonSourceCount, 8);
assert.equal(byComponent.get('FLANGE').canvasSourceFound, 8);
assert.equal(byComponent.get('VALVE').jsonSourceCount, 6);
assert.equal(byComponent.get('VALVE').canvasSourceFound, 6);
assert.equal(byComponent.get('VALVE').generatedCueCount, 6);
assert.equal(byComponent.get('RIGID').jsonSourceCount, 1);
assert.equal(byComponent.get('RIGID').canvasSourceFound, 1);

for (const node of ledger.branchNodes) {
  assert.equal(node.status, 'OK_INFERRED_OLET_BRANCH');
  assert.equal(node.hasMainRunPair, true);
  assert.equal(node.hasBranchCue, true);
  assert.equal(node.degree, 3);
  assert.ok(node.mainRun.length === 2);
  assert.ok(node.branchLegs.length === 1);
}

for (const row of ledger.sourceRows) {
  assert.equal(row.canvasSourceFound, true, row.sourceName);
  assert.equal(row.canvasVisible, true, row.sourceName);
}

assert.match(ledger.pasteableComponentBreakdown, /🟦\s+PIPE/);
assert.match(ledger.pasteableComponentBreakdown, /🟡\s+BEND/);
assert.match(ledger.pasteableComponentBreakdown, /🟣\s+OLET\/BRANCH/);
assert.match(ledger.pasteableComponentBreakdown, /◀▶\s+VALVE/);
assert.match(ledger.pasteableComponentBreakdown, /TOTAL GEOMETRY SOURCE ROWS = 40/);

assert.deepEqual(scene.userData.managedStageGeometryLedgerSummary.componentSummary, ledger.componentSummary);
assert.equal(scene.userData.managedStageGeometryLedgerSummary.pass, true);

console.log(ledger.pasteableComponentBreakdown);
