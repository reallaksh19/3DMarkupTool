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
  assert.equal(gate.visualPolicy.pipeShouldNotPassThroughBody, true);
  const gatePlan = buildLinearVisualPrimitivePlan(gate, { length: 4, pipeRadius: 0.75 });
  const gateBody = gatePlan.find((p) => p.role === 'VALVE_BODY');
  assert.ok(gateBody);
  assert.ok(gatePlan.some((p) => p.role === 'BONNET_STEM'));
  assert.ok(gatePlan.some((p) => p.role === 'HANDWHEEL'));
  assert.ok(gateBody.radius >= 0.75 * 3.0, 'gate valve body must visually dominate pipe OD');
  assert.ok(gateBody.length >= 4 * 0.6, 'gate valve body must occupy most of the component length');
  assert.equal(gateBody.replacesCenterlinePipe, true);

  const ball = getValveFlangeVisualSpec({ rawType: 'BALL VALVE', props: { bore: '100' } });
  assert.equal(ball.componentType, 'VALVE_BALL');
  const ballPlan = buildLinearVisualPrimitivePlan(ball, { length: 3, pipeRadius: 0.5 });
  assert.ok(ballPlan.some((p) => p.role === 'LEVER_HANDLE'));
  assert.ok(ballPlan.find((p) => p.role === 'VALVE_BODY').radius >= 0.5 * 2.8);

  const skeyGate = getValveFlangeVisualSpec({ rawType: 'RIGID', props: { bore: '100', rawAttributes: { SKEY: 'VGAT' } } });
  assert.equal(skeyGate.componentType, 'VALVE_GATE');

  const flange = getValveFlangeVisualSpec({ rawType: 'FLANGE', props: { bore: '200' } });
  assert.equal(flange.componentClass, 'FLANGE');
  assert.equal(flange.visualRecipeId, 'flange-pair-symbol.v1');
  const flangePlan = buildLinearVisualPrimitivePlan(flange, { length: 2.5, pipeRadius: 1 });
  const flangeDisc = flangePlan.find((p) => p.role === 'FLANGE_DISC_A');
  assert.ok(flangeDisc);
  assert.ok(flangePlan.some((p) => p.role === 'FLANGE_DISC_B'));
  assert.ok(flangePlan.some((p) => p.role === 'BOLT_PATTERN'));
  assert.ok(flangeDisc.radius >= 2.5, 'flange disc must read larger than pipe OD');
  assert.equal(flangeDisc.replacesCenterlinePipe, true);

  const blind = getValveFlangeVisualSpec({ rawType: 'RIGID', props: { rawAttributes: { SKEY: 'FLBL' } } });
  assert.equal(blind.componentType, 'FLANGE_BLIND');

  const pipe = getValveFlangeVisualSpec({ rawType: 'PIPE', props: { bore: '100' } });
  assert.equal(pipe, null);

  console.log('Valve/flange visual catalog gates passed');
}

run();
