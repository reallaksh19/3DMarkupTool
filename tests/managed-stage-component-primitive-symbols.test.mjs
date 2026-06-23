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

const { createManagedStagePreviewScene, assertManagedStagePreviewCoordinatePreservation } = await import('../src/managed-stage-preview-scene.js');
const { applyManagedStageComponentPrimitiveSymbols } = await import('../src/managed-stage-component-primitive-symbols.js');

const fixture = {
  source: 'flange-valve-primitive-symbol-fixture',
  hierarchy: [{
    name: 'ROOT',
    type: 'ROOT',
    attributes: { NAME: 'ROOT' },
    children: [
      lineRecord('WN-FLANGE-001', 'FLAN', 'FLANGE', 'N1', 'N2', { x: 0, y: 0, z: 0 }, { x: 220, y: 0, z: 0 }),
      lineRecord('BALL-VALVE-001', 'VALV', 'VALVE', 'N2', 'N3', { x: 260, y: 0, z: 0 }, { x: 620, y: 0, z: 0 })
    ]
  }]
};

const scene = createManagedStagePreviewScene(fixture, { sourceName: 'flange-valve-primitive-symbol-fixture.json' });
assertManagedStagePreviewCoordinatePreservation(scene.userData.managedStageCoordinateAudit);

const result = applyManagedStageComponentPrimitiveSymbols(scene, { sourceName: 'flange-valve-primitive-symbol-fixture.json' });
assert.equal(result.schema, 'ManagedStageComponentPrimitiveSymbols.v1');
assert.equal(result.flangeSymbolCount, 1);
assert.equal(result.valveSymbolCount, 1);

const flange = findCue(scene, 'WELDNECK_FLANGE');
assert.ok(flange, 'expected WeldNeck flange primitive symbol');
assert.equal(flange.userData.cueKind, 'flange-weldneck-primitive-symbol');
assert.equal(flange.userData.primitiveCount, 2);
assert.equal(flange.userData.primitiveBudgetLimit, 2);
assert.equal(flange.children.length, 2);
assert.deepEqual(flange.children.map((child) => child.userData.componentPrimitivePart), ['raised-face-disk', 'weld-neck-hub']);
assert.ok(flange.children.every((child) => child.userData.componentPrimitiveBudgetCounted === true));

const valve = findCue(scene, 'BALL_VALVE');
assert.ok(valve, 'expected ball valve primitive symbol');
// Keep the legacy cue kind so the existing geometry ledger continues counting VALVE cues.
assert.equal(valve.userData.cueKind, 'valve-opposed-cone-pair');
assert.equal(valve.userData.primitiveCount, 5);
assert.equal(valve.userData.primitiveBudgetLimit, 6);
assert.equal(valve.children.length, 5);
assert.deepEqual(valve.children.map((child) => child.userData.componentPrimitivePart), [
  'central-ball-body',
  'left-seat',
  'right-seat',
  'left-end-flange',
  'right-end-flange'
]);
assert.ok(valve.children.every((child) => child.userData.componentPrimitiveBudgetCounted === true));
assert.ok(valve.children.every((child) => !/stem|handwheel|wheel/i.test(child.name)), 'ball valve preview must not add stem/handwheel geometry');

const valveSource = findSource(scene, 'BALL-VALVE-001');
assert.equal(valveSource.userData.managedStageValvePrimitiveSymbolApplied, true);
assert.equal(valveSource.userData.inputXmlValveConePairApplied, true, 'new ball-valve symbol suppresses obsolete cone-pair overlay');

const cueCountBefore = countPrimitiveSymbolGroups(scene);
const second = applyManagedStageComponentPrimitiveSymbols(scene, { sourceName: 'flange-valve-primitive-symbol-fixture.json' });
assert.equal(second.flangeSymbolCount, 0);
assert.equal(second.valveSymbolCount, 0);
assert.equal(countPrimitiveSymbolGroups(scene), cueCountBefore, 'component primitive symbol application is idempotent');

assertManagedStagePreviewCoordinatePreservation(scene.userData.managedStageCoordinateAudit);

function lineRecord(name, type, dtxr, fromNode, toNode, apos, lpos) {
  return {
    name,
    type,
    attributes: {
      NAME: name,
      TYPE: type,
      DTXR: dtxr,
      FROM_NODE: fromNode,
      TO_NODE: toNode,
      APOS: apos,
      LPOS: lpos,
      DIAMETER: '100mm'
    }
  };
}

function findCue(root, componentSymbol) {
  let found = null;
  root.traverse((object) => {
    if (!found && object.userData?.componentSymbol === componentSymbol) found = object;
  });
  return found;
}

function findSource(root, sourceName) {
  let found = null;
  root.traverse((object) => {
    if (!found && object.userData?.TYPE === 'MANAGED_STAGE_RAW_PREVIEW' && object.userData?.sourceName === sourceName) found = object;
  });
  return found;
}

function countPrimitiveSymbolGroups(root) {
  let count = 0;
  root.traverse((object) => {
    if (object.userData?.componentPrimitiveSymbol === true && !object.userData?.cuePart) count += 1;
  });
  return count;
}
