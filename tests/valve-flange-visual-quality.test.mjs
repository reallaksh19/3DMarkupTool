import assert from 'node:assert/strict';
import {
  buildLinearVisualPrimitivePlan,
  getValveFlangeVisualSpec,
  primitiveLocalSpan,
  validateLinearVisualPrimitiveContinuity
} from '../src/valve-flange-visual-catalog.js';

const PIPE_RADIUS = 0.571499975;

function role(plan, name) {
  const primitive = plan.find((p) => p.role === name);
  assert.ok(primitive, `missing primitive role ${name}`);
  return primitive;
}

function spanLength(primitive) {
  const [start, end] = primitiveLocalSpan(primitive);
  return Math.abs(end - start);
}

function assertContinuous(plan, length, label) {
  const result = validateLinearVisualPrimitiveContinuity(plan, length, { tolerance: 1e-5 });
  assert.equal(result.ok, true, `${label} continuity gaps: ${JSON.stringify(result.gaps)}`);
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

function assertBoltPatternInsidePlate(plan, plateRole = 'FLANGE_DISC_A') {
  const plate = role(plan, plateRole);
  const bolts = role(plan, 'BOLT_PATTERN');
  assert.ok(bolts.boltCircleRadius < plate.radius, 'bolt circle must sit inside the visible flange plate');
  assert.ok(bolts.boltCircleRadius + bolts.boltRadius < plate.radius, 'bolt outside edge must not exceed flange plate radius');
}

function runFlangedValveQualityGate() {
  const length = 3.4;
  const spec = getValveFlangeVisualSpec({ rawType: 'FLANGED_VALVE', props: { bore: '114.299995', meshRole: 'Flanged Valve' } });
  const plan = buildLinearVisualPrimitivePlan(spec, { length, pipeRadius: PIPE_RADIUS });
  assertContinuous(plan, length, 'flanged valve');

  const collarA = role(plan, 'END_COLLAR_A');
  const collarB = role(plan, 'END_COLLAR_B');
  const neckA = role(plan, 'VALVE_NECK_A');
  const neckB = role(plan, 'VALVE_NECK_B');
  const body = role(plan, 'VALVE_BODY');

  assert.ok(body.compactBodyLengthFactorApplied, 'VALVE_BODY must use bodyLengthFactor instead of stretching through the full component');
  assert.ok(spanLength(body) <= length * 0.56, 'rounded valve body should remain compact along the pipe axis');
  assert.ok(spanLength(neckA) > spanLength(collarA) * 8, 'left tapered shoulder should visually connect thin flange to body');
  assert.ok(spanLength(neckB) > spanLength(collarB) * 8, 'right tapered shoulder should visually connect body to thin flange');
  assert.ok(collarA.radius < body.radius, 'left end flange/collar must not be larger than the rounded valve body');
  assert.ok(collarB.radius < body.radius, 'right end flange/collar must not be larger than the rounded valve body');
  assert.ok(collarA.radius <= body.radius * 0.93, 'left collar should read as a thin flange plate, not a detached body');
  assert.ok(collarB.radius <= body.radius * 0.93, 'right collar should read as a thin flange plate, not a detached body');
  assert.ok(neckA.radiusStart < neckA.radiusEnd, 'left valve shoulder must taper up from flange/collar into body');
  assert.ok(neckB.radiusStart > neckB.radiusEnd, 'right valve shoulder must taper down from body into flange/collar');
}

function runFlangePairQualityGate() {
  const length = 2.5;
  const spec = getValveFlangeVisualSpec({ rawType: 'WELD_NECK_FLANGE', type: 'FLANGE', props: { bore: '200', meshRole: 'Flange Pair' } });
  const plan = buildLinearVisualPrimitivePlan(spec, { length, pipeRadius: 1 });
  assertContinuous(plan, length, 'weld-neck flange pair');

  const plateA = role(plan, 'FLANGE_DISC_A');
  const plateB = role(plan, 'FLANGE_DISC_B');
  const raisedA = role(plan, 'RAISED_FACE_A');
  const raisedB = role(plan, 'RAISED_FACE_B');
  const gasket = role(plan, 'GASKET_CENTER');
  const neckA = role(plan, 'WELD_NECK_A');
  const neckB = role(plan, 'WELD_NECK_B');

  assert.ok(plateA.radius <= 1.72, 'fallback flange plate radius must stay compact');
  assert.equal(plateA.radius, plateB.radius, 'flange-pair plates should be visually symmetric');
  assert.ok(raisedA.radius < plateA.radius * 0.76, 'raised face should be smaller than the flange plate');
  assert.ok(raisedB.radius < plateB.radius * 0.76, 'raised face should be smaller than the flange plate');
  assert.ok(gasket.radius < plateA.radius * 0.66, 'gasket overlay should be subtle, not a full washer disc');
  assert.ok(neckA.radiusEnd < plateA.radius * 0.72, 'left weld neck should not look like a second flange disc');
  assert.ok(neckB.radiusStart < plateB.radius * 0.72, 'right weld neck should not look like a second flange disc');
  assertBoltPatternInsidePlate(plan, 'FLANGE_DISC_A');
}

function runSingleFlangeQualityGate() {
  const length = 0.85724998;
  const left = buildLinearVisualPrimitivePlan(singleFlangeSpec('PE_006_FLANGE_80_TO_83', 'FROM', 'TO'), { length, pipeRadius: PIPE_RADIUS });
  const right = buildLinearVisualPrimitivePlan(singleFlangeSpec('PE_008_FLANGE_86_TO_90', 'TO', 'FROM'), { length, pipeRadius: PIPE_RADIUS });

  for (const [label, plan] of [['left single flange', left], ['right single flange', right]]) {
    assertContinuous(plan, length, label);
    const plate = role(plan, 'FLANGE_PLATE');
    const face = role(plan, 'RAISED_FACE_VALVE_SIDE');
    const neck = role(plan, 'WELD_NECK_PIPE_SIDE');
    const bolts = role(plan, 'BOLT_PATTERN');

    assert.ok(plate.radius <= PIPE_RADIUS * 1.72, `${label}: flange plate must stay compact`);
    assert.ok(face.radius < plate.radius * 0.76, `${label}: raised face must be smaller than plate`);
    assert.ok(neck.outerRadius < plate.radius * 0.72, `${label}: weld-neck hub must not read as another washer`);
    assert.ok(bolts.boltCircleRadius + bolts.boltRadius < plate.radius, `${label}: bolt pattern must fit on the single flange plate`);
  }
}

runFlangedValveQualityGate();
runFlangePairQualityGate();
runSingleFlangeQualityGate();
console.log('Valve/flange visual quality gate passed');
