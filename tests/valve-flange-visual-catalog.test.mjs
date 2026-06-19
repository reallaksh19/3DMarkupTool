import assert from 'node:assert/strict';
import {
  VALVE_FLANGE_VISUAL_CATALOG,
  buildLinearVisualPrimitivePlan,
  getValveFlangeVisualSpec
} from '../src/valve-flange-visual-catalog.js';

function run() {
  assert.ok(VALVE_FLANGE_VISUAL_CATALOG.valveTypes.VALVE_GATE);
  assert.ok(VALVE_FLANGE_VISUAL_CATALOG.flangeTypes.FLANGE_GENERIC);

  const gate = getValveFlangeVisualSpec({ rawType: 'GATE_VALVE', props: { bore: '150' } });
  assert.equal(gate.componentClass, 'VALVE');
  assert.equal(gate.componentType, 'VALVE_GATE');
  assert.equal(gate.visualRecipeId, 'valve-gate-symbol.v1');
  assert.equal(gate.profile.handleStyle, 'handwheel');
  const gatePlan = buildLinearVisualPrimitivePlan(gate, { length: 4, pipeRadius: 0.75 });
  assert.ok(gatePlan.some((p) => p.role === 'VALVE_BODY'));
  assert.ok(gatePlan.some((p) => p.role === 'BONNET_STEM'));
  assert.ok(gatePlan.some((p) => p.role === 'HANDWHEEL'));

  const ball = getValveFlangeVisualSpec({ rawType: 'BALL VALVE', props: { bore: '100' } });
  assert.equal(ball.componentType, 'VALVE_BALL');
  assert.ok(buildLinearVisualPrimitivePlan(ball, { length: 3, pipeRadius: 0.5 }).some((p) => p.role === 'LEVER_HANDLE'));

  const flange = getValveFlangeVisualSpec({ rawType: 'FLANGE', props: { bore: '200' } });
  assert.equal(flange.componentClass, 'FLANGE');
  assert.equal(flange.visualRecipeId, 'flange-pair-symbol.v1');
  const flangePlan = buildLinearVisualPrimitivePlan(flange, { length: 2.5, pipeRadius: 1 });
  assert.ok(flangePlan.some((p) => p.role === 'FLANGE_DISC_A'));
  assert.ok(flangePlan.some((p) => p.role === 'FLANGE_DISC_B'));
  assert.ok(flangePlan.some((p) => p.role === 'BOLT_PATTERN'));

  const pipe = getValveFlangeVisualSpec({ rawType: 'PIPE', props: { bore: '100' } });
  assert.equal(pipe, null);

  console.log('Valve/flange visual catalog gates passed');
}

run();
