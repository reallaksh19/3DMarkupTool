import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  buildLinearVisualPrimitivePlan,
  getValveFlangeVisualSpec,
  primitiveLocalSpan,
  validateLinearVisualPrimitiveContinuity
} from '../src/valve-flange-visual-catalog.js';
import { orthogonal } from '../src/geometry.js';

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

function span(plan, role) {
  const primitive = plan.find((entry) => entry.role === role);
  assert.ok(primitive, `missing ${role}`);
  return primitiveLocalSpan(primitive);
}

function assertNoPairOnlyPieces(plan, label) {
  for (const role of ['FLANGE_DISC_A', 'FLANGE_DISC_B', 'FLANGE_CENTER_BORE_FILL', 'GASKET_CENTER', 'WELD_NECK_A', 'WELD_NECK_B']) {
    assert.equal(plan.some((entry) => entry.role === role), false, `${label}: ${role} must not be emitted for a single oriented flange`);
  }
}

function assertSingleFlangeContinuity(plan, length, label) {
  assert.deepEqual(
    plan.filter((entry) => entry.replacesCenterlinePipe).map((entry) => entry.role),
    ['WELD_NECK_PIPE_SIDE', 'FLANGE_PLATE', 'RAISED_FACE_VALVE_SIDE'].sort((a, b) => span(plan, a)[0] - span(plan, b)[0]),
    `${label}: replacement stack should be exactly neck/plate/raised-face in local axis order`
  );
  const continuity = validateLinearVisualPrimitiveContinuity(plan, length, { tolerance: 1e-5 });
  assert.equal(continuity.ok, true, `${label}: single flange must cover its full From/To span`);
}

function run() {
  const leftSpec = singleFlangeSpec('PE_006_FLANGE_80_TO_83', 'FROM', 'TO');
  assert.equal(leftSpec.componentClass, 'FLANGE');
  assert.equal(leftSpec.visualKey, 'single-oriented-flange');
  assert.equal(leftSpec.flangeTopology.pipeEndpoint, 'FROM');
  assert.equal(leftSpec.flangeTopology.raisedFaceEndpoint, 'TO');
  const leftPlan = buildLinearVisualPrimitivePlan(leftSpec, { length: 0.85724998, pipeRadius: 0.571499975 });
  assertNoPairOnlyPieces(leftPlan, 'BM_CII 80->83');
  assertSingleFlangeContinuity(leftPlan, 0.85724998, 'BM_CII 80->83');
  assert.ok(Math.abs(span(leftPlan, 'WELD_NECK_PIPE_SIDE')[0] + 0.85724998 / 2) < 1e-5, '80->83 weld neck must start at FROM pipe side');
  assert.ok(Math.abs(span(leftPlan, 'RAISED_FACE_VALVE_SIDE')[1] - 0.85724998 / 2) < 1e-5, '80->83 raised face must end at TO valve side');
  assert.ok(leftPlan.find((entry) => entry.role === 'WELD_NECK_PIPE_SIDE').radiusStart < leftPlan.find((entry) => entry.role === 'WELD_NECK_PIPE_SIDE').radiusEnd, 'left single flange neck must expand away from pipe');

  const rightSpec = singleFlangeSpec('PE_008_FLANGE_86_TO_90', 'TO', 'FROM');
  assert.equal(rightSpec.flangeTopology.pipeEndpoint, 'TO');
  assert.equal(rightSpec.flangeTopology.raisedFaceEndpoint, 'FROM');
  const rightPlan = buildLinearVisualPrimitivePlan(rightSpec, { length: 0.85724998, pipeRadius: 0.571499975 });
  assertNoPairOnlyPieces(rightPlan, 'BM_CII 86->90');
  assertSingleFlangeContinuity(rightPlan, 0.85724998, 'BM_CII 86->90');
  assert.ok(Math.abs(span(rightPlan, 'RAISED_FACE_VALVE_SIDE')[0] + 0.85724998 / 2) < 1e-5, '86->90 raised face must start at FROM valve side');
  assert.ok(Math.abs(span(rightPlan, 'WELD_NECK_PIPE_SIDE')[1] - 0.85724998 / 2) < 1e-5, '86->90 weld neck must end at TO pipe side');
  assert.ok(rightPlan.find((entry) => entry.role === 'WELD_NECK_PIPE_SIDE').radiusStart > rightPlan.find((entry) => entry.role === 'WELD_NECK_PIPE_SIDE').radiusEnd, 'right single flange neck must contract toward pipe');

  const pairSpec = getValveFlangeVisualSpec({ rawType: 'Flange Pair', type: 'FLANGE_PAIR', props: { bore: '114.299995', meshRole: 'Flange Pair' } });
  const pairPlan = buildLinearVisualPrimitivePlan(pairSpec, { length: 1.07999992, pipeRadius: 0.571499975 });
  assert.ok(pairPlan.some((entry) => entry.role === 'FLANGE_DISC_A'));
  assert.ok(pairPlan.some((entry) => entry.role === 'FLANGE_DISC_B'));

  const stemUpForZPipe = orthogonal(new THREE.Vector3(0, 0, -1));
  assert.ok(stemUpForZPipe.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-8, 'horizontal Z pipe valve stem must use world vertical');
  const stemUpForXPipe = orthogonal(new THREE.Vector3(1, 0, 0));
  assert.ok(stemUpForXPipe.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-8, 'horizontal X pipe valve stem must use world vertical');

  console.log('BM_CII single flange catalogue gates passed');
}

run();