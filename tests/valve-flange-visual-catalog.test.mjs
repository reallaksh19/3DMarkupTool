import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  VALVE_FLANGE_VISUAL_CATALOG,
  buildLinearVisualPrimitivePlan,
  getValveFlangeVisualSpec,
  primitiveLocalSpan,
  validateLinearVisualPrimitiveContinuity
} from '../src/valve-flange-visual-catalog.js';
import { orthogonal } from '../src/geometry.js';

function spanOf(plan, role) {
  const primitive = plan.find((entry) => entry.role === role);
  assert.ok(primitive, `missing ${role}`);
  return primitiveLocalSpan(primitive);
}

function assertNoFilledSeamRings(plan, message) {
  assert.ok(!plan.some((p) => p.kind === 'seam-ring'), `${message}: seam-ring primitives render as filled cylinders and must not be emitted`);
}

function assertOrderedContinuous(plan, roles, length, message, tolerance = 1e-4) {
  const spans = roles.map((role) => {
    const primitive = plan.find((p) => p.role === role);
    assert.ok(primitive, `${message}: missing ${role}`);
    const [start, end] = primitiveLocalSpan(primitive);
    return { role, start, end, primitive };
  });

  assert.ok(Math.abs(spans[0].start + length / 2) <= tolerance, `${message}: ${spans[0].role} must start at -L/2`);
  for (let i = 1; i < spans.length; i += 1) {
    assert.ok(spans[i].start >= spans[i - 1].start, `${message}: ${spans[i].role} is out of local-axis order`);
    assert.ok(Math.abs(spans[i].start - spans[i - 1].end) <= tolerance, `${message}: gap/overlap between ${spans[i - 1].role} and ${spans[i].role}`);
  }
  assert.ok(Math.abs(spans[spans.length - 1].end - length / 2) <= tolerance, `${message}: ${spans[spans.length - 1].role} must end at +L/2`);

  const continuity = validateLinearVisualPrimitiveContinuity(plan, length, { tolerance });
  assert.equal(continuity.ok, true, `${message}: continuity gaps ${JSON.stringify(continuity.gaps)}`);
  return spans;
}

function singleFlangeSpec(id, pipeEndpoint, raisedFaceEndpoint) {
  return getValveFlangeVisualSpec({
    id,
    rawType: 'Flange',
    type: 'FLANGE',
    props: {
      id,
      bore: '114.299995',
      meshRole: 'Flange',
      flangeVisualKind: 'SINGLE_ORIENTED_FLANGE',
      singleFlangePipeEndpoint: pipeEndpoint,
      singleFlangeRaisedFaceEndpoint: raisedFaceEndpoint
    }
  });
}

function assertSingleFlange(plan, length, message) {
  assertNoFilledSeamRings(plan, message);
  assert.ok(!plan.some((p) => ['FLANGE_DISC_A', 'FLANGE_DISC_B', 'FLANGE_CENTER_BORE_FILL', 'GASKET_CENTER', 'WELD_NECK_A', 'WELD_NECK_B'].includes(p.role)), `${message}: must not emit symmetric flange-pair pieces`);
  assertOrderedContinuous(plan, ['WELD_NECK_PIPE_SIDE', 'FLANGE_PLATE', 'RAISED_FACE_VALVE_SIDE'].sort((a, b) => spanOf(plan, a)[0] - spanOf(plan, b)[0]), length, message, 1e-5);
}

function run() {
  assert.ok(VALVE_FLANGE_VISUAL_CATALOG.valveTypes.VALVE_GATE);
  assert.ok(VALVE_FLANGE_VISUAL_CATALOG.valveTypes.VALVE_FLANGED);
  assert.ok(VALVE_FLANGE_VISUAL_CATALOG.flangeTypes.FLANGE_GENERIC);

  const flangedValve = getValveFlangeVisualSpec({
    id: 'PE_007_FLANGED_VALVE_83_TO_86',
    rawType: 'FLANGED_VALVE',
    type: 'FLANGED_VALVE',
    props: { id: 'PE_007_FLANGED_VALVE_83_TO_86', bore: '114.299995', meshRole: 'Flanged Valve' }
  });
  assert.equal(flangedValve.componentClass, 'VALVE');
  assert.equal(flangedValve.componentType, 'VALVE_FLANGED');
  const flangedValvePlan = buildLinearVisualPrimitivePlan(flangedValve, { length: 3.4, pipeRadius: 0.5715 });
  assertNoFilledSeamRings(flangedValvePlan, 'flanged valve');
  assertOrderedContinuous(flangedValvePlan, ['END_COLLAR_A', 'VALVE_NECK_A', 'VALVE_BODY', 'VALVE_NECK_B', 'END_COLLAR_B'], 3.4, 'PE_007_FLANGED_VALVE_83_TO_86 visible axial stack');
  assert.ok(flangedValvePlan.some((p) => p.role === 'VALVE_BODY'));
  assert.ok(flangedValvePlan.some((p) => p.role === 'HANDWHEEL'));
  assert.ok(!flangedValvePlan.some((p) => p.role === 'FLANGE_DISC_A'), 'flanged valve must not be classified as loose flange pair');

  const gate = getValveFlangeVisualSpec({ rawType: 'GATE_VALVE', props: { bore: '150' } });
  assert.equal(gate.componentType, 'VALVE_GATE');
  const gatePlan = buildLinearVisualPrimitivePlan(gate, { length: 4, pipeRadius: 0.75 });
  assertOrderedContinuous(gatePlan, ['END_COLLAR_A', 'VALVE_NECK_A', 'VALVE_BODY', 'VALVE_NECK_B', 'END_COLLAR_B'], 4, 'gate valve visible axial stack');
  assert.ok(gatePlan.find((p) => p.role === 'VALVE_BODY').radius >= 0.75 * 1.85);

  const ball = getValveFlangeVisualSpec({ rawType: 'BALL VALVE', props: { bore: '100' } });
  assert.equal(ball.componentType, 'VALVE_BALL');
  const ballPlan = buildLinearVisualPrimitivePlan(ball, { length: 3, pipeRadius: 0.5 });
  assertOrderedContinuous(ballPlan, ['END_COLLAR_A', 'VALVE_NECK_A', 'VALVE_BODY', 'VALVE_NECK_B', 'END_COLLAR_B'], 3, 'ball valve visible axial stack');
  assert.ok(ballPlan.some((p) => p.role === 'LEVER_HANDLE'));

  const pair = getValveFlangeVisualSpec({ rawType: 'Flange Pair', type: 'FLANGE_PAIR', props: { bore: '200', meshRole: 'Flange Pair' } });
  assert.equal(pair.componentClass, 'FLANGE');
  assert.equal(pair.visualRecipeId, 'flange-pair-symbol.v1');
  const pairPlan = buildLinearVisualPrimitivePlan(pair, { length: 2.5, pipeRadius: 1 });
  assertOrderedContinuous(pairPlan, ['WELD_NECK_A', 'FLANGE_DISC_A', 'FLANGE_CENTER_BORE_FILL', 'FLANGE_DISC_B', 'WELD_NECK_B'], 2.5, 'flange pair visible axial stack');
  assert.ok(pairPlan.some((p) => p.role === 'GASKET_CENTER'));
  assert.ok(pairPlan.some((p) => p.role === 'RAISED_FACE_A'));
  assert.ok(pairPlan.some((p) => p.role === 'RAISED_FACE_B'));

  const leftSingle = singleFlangeSpec('PE_006_FLANGE_80_TO_83', 'FROM', 'TO');
  assert.equal(leftSingle.visualKey, 'single-oriented-flange');
  assert.equal(leftSingle.flangeTopology.pipeEndpoint, 'FROM');
  assert.equal(leftSingle.flangeTopology.raisedFaceEndpoint, 'TO');
  const leftPlan = buildLinearVisualPrimitivePlan(leftSingle, { length: 0.85724998, pipeRadius: 0.571499975 });
  assertSingleFlange(leftPlan, 0.85724998, 'BM_CII 80->83 single flange');
  assert.ok(Math.abs(spanOf(leftPlan, 'WELD_NECK_PIPE_SIDE')[0] + 0.85724998 / 2) < 1e-5, '80->83 weld neck must start at FROM pipe side');
  assert.ok(Math.abs(spanOf(leftPlan, 'RAISED_FACE_VALVE_SIDE')[1] - 0.85724998 / 2) < 1e-5, '80->83 raised face must end at TO valve side');
  assert.ok(leftPlan.find((p) => p.role === 'WELD_NECK_PIPE_SIDE').radiusStart < leftPlan.find((p) => p.role === 'WELD_NECK_PIPE_SIDE').radiusEnd);

  const rightSingle = singleFlangeSpec('PE_008_FLANGE_86_TO_90', 'TO', 'FROM');
  assert.equal(rightSingle.flangeTopology.pipeEndpoint, 'TO');
  assert.equal(rightSingle.flangeTopology.raisedFaceEndpoint, 'FROM');
  const rightPlan = buildLinearVisualPrimitivePlan(rightSingle, { length: 0.85724998, pipeRadius: 0.571499975 });
  assertSingleFlange(rightPlan, 0.85724998, 'BM_CII 86->90 single flange');
  assert.ok(Math.abs(spanOf(rightPlan, 'RAISED_FACE_VALVE_SIDE')[0] + 0.85724998 / 2) < 1e-5, '86->90 raised face must start at FROM valve side');
  assert.ok(Math.abs(spanOf(rightPlan, 'WELD_NECK_PIPE_SIDE')[1] - 0.85724998 / 2) < 1e-5, '86->90 weld neck must end at TO pipe side');
  assert.ok(rightPlan.find((p) => p.role === 'WELD_NECK_PIPE_SIDE').radiusStart > rightPlan.find((p) => p.role === 'WELD_NECK_PIPE_SIDE').radiusEnd);

  assert.ok(orthogonal(new THREE.Vector3(0, 0, -1)).distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-8, 'horizontal Z pipe valve stem must be world-vertical');
  assert.ok(orthogonal(new THREE.Vector3(1, 0, 0)).distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-8, 'horizontal X pipe valve stem must be world-vertical');

  const blind = getValveFlangeVisualSpec({ rawType: 'RIGID', props: { rawAttributes: { SKEY: 'FLBL' } } });
  assert.equal(blind.componentType, 'FLANGE_BLIND');
  assert.equal(getValveFlangeVisualSpec({ rawType: 'PIPE', props: { bore: '100' } }), null);

  console.log('Valve/flange visual catalog gates passed');
}

run();