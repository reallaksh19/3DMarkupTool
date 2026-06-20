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

const LENGTH = 0.85724998;
const RADIUS = 0.571499975;

function span(plan, role) {
  const primitive = plan.find((p) => p.role === role);
  assert.ok(primitive, `missing ${role}`);
  return primitiveLocalSpan(primitive);
}

function orderedRoles(plan) {
  return plan
    .filter((p) => p.replacesCenterlinePipe && !p.overlayOnly && !p.hiddenBoreFill)
    .sort((a, b) => span(plan, a.role)[0] - span(plan, b.role)[0])
    .map((p) => p.role);
}

function assertContinuous(plan, length, label) {
  const check = validateLinearVisualPrimitiveContinuity(plan, length, { tolerance: 1e-5 });
  assert.equal(check.ok, true, `${label}: ${JSON.stringify(check.gaps)}`);
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

function assertNoPairPieces(plan, label) {
  const forbidden = ['FLANGE_DISC_A', 'FLANGE_DISC_B', 'FLANGE_CENTER_BORE_FILL', 'GASKET_CENTER', 'WELD_NECK_A', 'WELD_NECK_B'];
  assert.ok(!plan.some((p) => forbidden.includes(p.role)), `${label}: must not emit flange-pair primitives`);
}

function run() {
  assert.ok(VALVE_FLANGE_VISUAL_CATALOG.valveTypes.VALVE_GATE);
  assert.ok(VALVE_FLANGE_VISUAL_CATALOG.valveTypes.VALVE_FLANGED);
  assert.ok(VALVE_FLANGE_VISUAL_CATALOG.flangeTypes.FLANGE_GENERIC);

  const valve = getValveFlangeVisualSpec({ rawType: 'FLANGED_VALVE', props: { bore: '114.299995', meshRole: 'Flanged Valve' } });
  assert.equal(valve.componentClass, 'VALVE');
  const valvePlan = buildLinearVisualPrimitivePlan(valve, { length: 3.4, pipeRadius: RADIUS });
  assert.deepEqual(orderedRoles(valvePlan), ['END_COLLAR_A', 'VALVE_NECK_A', 'VALVE_BODY', 'VALVE_NECK_B', 'END_COLLAR_B']);
  assertContinuous(valvePlan, 3.4, 'flanged valve');

  const pair = getValveFlangeVisualSpec({ rawType: 'Flange Pair', type: 'FLANGE_PAIR', props: { bore: '200', meshRole: 'Flange Pair' } });
  const pairPlan = buildLinearVisualPrimitivePlan(pair, { length: 2.5, pipeRadius: 1 });
  assert.deepEqual(orderedRoles(pairPlan), ['WELD_NECK_A', 'FLANGE_DISC_A', 'FLANGE_CENTER_BORE_FILL', 'FLANGE_DISC_B', 'WELD_NECK_B']);
  assert.ok(pairPlan.some((p) => p.role === 'GASKET_CENTER'));

  const left = buildLinearVisualPrimitivePlan(singleFlangeSpec('PE_006_FLANGE_80_TO_83', 'FROM', 'TO'), { length: LENGTH, pipeRadius: RADIUS });
  assertNoPairPieces(left, 'BM_CII 80->83');
  assert.deepEqual(orderedRoles(left), ['PIPE_STUB_PIPE_SIDE', 'WELD_NECK_PIPE_SIDE', 'FLANGE_PLATE', 'RAISED_FACE_VALVE_SIDE']);
  assertContinuous(left, LENGTH, 'BM_CII 80->83');
  assert.ok(Math.abs(span(left, 'PIPE_STUB_PIPE_SIDE')[0] + LENGTH / 2) < 1e-5, '80->83 pipe stub starts at pipe endpoint');
  assert.ok(Math.abs(span(left, 'WELD_NECK_PIPE_SIDE')[1] - span(left, 'FLANGE_PLATE')[0]) < 1e-5, '80->83 weld neck must directly touch flange plate');
  assert.ok(Math.abs(span(left, 'RAISED_FACE_VALVE_SIDE')[1] - LENGTH / 2) < 1e-5, '80->83 raised face ends at valve endpoint');
  assert.ok(left.find((p) => p.role === 'WELD_NECK_PIPE_SIDE').radiusStart < left.find((p) => p.role === 'WELD_NECK_PIPE_SIDE').radiusEnd);

  const right = buildLinearVisualPrimitivePlan(singleFlangeSpec('PE_008_FLANGE_86_TO_90', 'TO', 'FROM'), { length: LENGTH, pipeRadius: RADIUS });
  assertNoPairPieces(right, 'BM_CII 86->90');
  assert.deepEqual(orderedRoles(right), ['RAISED_FACE_VALVE_SIDE', 'FLANGE_PLATE', 'WELD_NECK_PIPE_SIDE', 'PIPE_STUB_PIPE_SIDE']);
  assertContinuous(right, LENGTH, 'BM_CII 86->90');
  assert.ok(Math.abs(span(right, 'RAISED_FACE_VALVE_SIDE')[0] + LENGTH / 2) < 1e-5, '86->90 raised face starts at valve endpoint');
  assert.ok(Math.abs(span(right, 'WELD_NECK_PIPE_SIDE')[0] - span(right, 'FLANGE_PLATE')[1]) < 1e-5, '86->90 weld neck must directly touch flange plate');
  assert.ok(Math.abs(span(right, 'PIPE_STUB_PIPE_SIDE')[1] - LENGTH / 2) < 1e-5, '86->90 pipe stub ends at pipe endpoint');
  assert.ok(right.find((p) => p.role === 'WELD_NECK_PIPE_SIDE').radiusStart > right.find((p) => p.role === 'WELD_NECK_PIPE_SIDE').radiusEnd);

  assert.ok(orthogonal(new THREE.Vector3(0, 0, -1)).distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-8);
  assert.ok(orthogonal(new THREE.Vector3(1, 0, 0)).distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-8);
  assert.equal(getValveFlangeVisualSpec({ rawType: 'PIPE', props: { bore: '100' } }), null);

  console.log('Valve/flange visual catalog gates passed');
}

run();
