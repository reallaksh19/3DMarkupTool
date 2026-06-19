import assert from 'node:assert/strict';
import {
  VALVE_FLANGE_VISUAL_CATALOG,
  buildLinearVisualPrimitivePlan,
  getValveFlangeVisualSpec,
  primitiveLocalSpan,
  validateLinearVisualPrimitiveContinuity
} from '../src/valve-flange-visual-catalog.js';

function spanOf(primitive) {
  return primitiveLocalSpan(primitive);
}

function assertCoverage(plan, length, message) {
  const spans = plan
    .filter((p) => p.replacesCenterlinePipe && Number.isFinite(p.axialOffset) && Number.isFinite(p.length))
    .map(spanOf)
    .sort((a, b) => a[0] - b[0]);
  assert.ok(spans.length >= 4, `${message}: expected multiple replacement spans`);
  let coveredTo = -length / 2;
  for (const [start, end] of spans) {
    assert.ok(start <= coveredTo + 0.03, `${message}: visual gap from ${coveredTo.toFixed(4)} to ${start.toFixed(4)}`);
    coveredTo = Math.max(coveredTo, end);
  }
  assert.ok(coveredTo >= length / 2 - 0.03, `${message}: visual does not reach component end`);
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
    assert.ok(
      Math.abs(spans[i].start - spans[i - 1].end) <= tolerance,
      `${message}: gap/overlap between ${spans[i - 1].role} and ${spans[i].role}: ${spans[i - 1].end.toFixed(4)} -> ${spans[i].start.toFixed(4)}`
    );
  }
  assert.ok(Math.abs(spans[spans.length - 1].end - length / 2) <= tolerance, `${message}: ${spans[spans.length - 1].role} must end at +L/2`);

  const continuity = validateLinearVisualPrimitiveContinuity(plan, length, { tolerance });
  assert.equal(continuity.ok, true, `${message}: continuity gaps ${JSON.stringify(continuity.gaps)}`);
  return spans;
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
  assert.equal(flangedValve.visualRecipeId, 'valve-flanged-symbol.v1');
  assert.equal(flangedValve.visualPolicy.lengthPartitionedSymbol, true);
  const flangedPipeRadius = 0.5715;
  const flangedValvePlan = buildLinearVisualPrimitivePlan(flangedValve, { length: 3.4, pipeRadius: flangedPipeRadius });
  assertNoFilledSeamRings(flangedValvePlan, 'flanged valve');
  assertOrderedContinuous(flangedValvePlan, ['END_COLLAR_A', 'VALVE_NECK_A', 'VALVE_BODY', 'VALVE_NECK_B', 'END_COLLAR_B'], 3.4, 'PE_007_FLANGED_VALVE_83_TO_86 visible axial stack');
  assert.ok(flangedValvePlan.some((p) => p.role === 'VALVE_BODY'), 'flanged valve must include a central valve body');
  assert.ok(flangedValvePlan.some((p) => p.role === 'VALVE_BORE_FILL'), 'flanged valve must include a bore fill planning span so there is no open pipe gap');
  assert.ok(flangedValvePlan.some((p) => p.role === 'END_COLLAR_A'));
  assert.ok(flangedValvePlan.some((p) => p.role === 'END_COLLAR_B'));
  const leftNeck = flangedValvePlan.find((p) => p.role === 'VALVE_NECK_A');
  const rightNeck = flangedValvePlan.find((p) => p.role === 'VALVE_NECK_B');
  assert.ok(leftNeck, 'left direct valve neck/shoulder filler must close catalogue gap');
  assert.ok(rightNeck, 'right direct valve neck/shoulder filler must close catalogue gap');
  assert.equal(leftNeck.shoulderBasis, 'continuous-length-partitioned-valve-neck');
  assert.ok(leftNeck.length >= 0.25, 'valve neck must be a real shoulder span, not a tiny marker');
  assert.ok(leftNeck.length <= 3.4 * 0.24, 'valve neck must not become a long barrel-like run');
  assert.ok(leftNeck.outerRadius > leftNeck.innerRadius * 1.15, 'valve neck must remain a visible taper');
  assert.ok(leftNeck.radiusStart < leftNeck.radiusEnd, 'left valve neck must expand toward the valve body');
  assert.ok(rightNeck.radiusStart > rightNeck.radiusEnd, 'right valve neck must contract toward the pipe');
  const valveBoreFill = flangedValvePlan.find((p) => p.role === 'VALVE_BORE_FILL');
  assert.ok(valveBoreFill.hiddenBoreFill, 'bore fill is a continuity planning span only, not visible geometry');
  assert.ok(valveBoreFill.radius <= flangedPipeRadius * 0.5, 'bore fill must stay hidden and not read as a centerline pipe');
  const endCollar = flangedValvePlan.find((p) => p.role === 'END_COLLAR_A');
  assert.ok(endCollar.length <= flangedPipeRadius * 0.13, 'flanged valve end collar must read as a thin plate, not a thick washer');
  assert.equal(endCollar.thinPlate, true);
  const handwheel = flangedValvePlan.find((p) => p.role === 'HANDWHEEL');
  assert.ok(handwheel.radius >= flangedPipeRadius * 0.85, 'handwheel must remain large enough to read in the 3D view');
  assert.equal(handwheel.visualWeight, 'readable-operator');
  assert.ok(!flangedValvePlan.some((p) => p.role === 'FLANGE_DISC_A'), 'flanged valve must not be classified as a loose flange pair');
  assertCoverage(flangedValvePlan, 3.4, 'flanged valve visual replacement coverage');

  const gate = getValveFlangeVisualSpec({ rawType: 'GATE_VALVE', props: { bore: '150' } });
  assert.equal(gate.componentClass, 'VALVE');
  assert.equal(gate.componentType, 'VALVE_GATE');
  assert.equal(gate.visualRecipeId, 'valve-gate-symbol.v1');
  assert.equal(gate.profile.handleStyle, 'handwheel');
  assert.equal(gate.visualPolicy.pipeShouldNotPassThroughBody, true);
  const gatePlan = buildLinearVisualPrimitivePlan(gate, { length: 4, pipeRadius: 0.75 });
  assertNoFilledSeamRings(gatePlan, 'gate valve');
  assertOrderedContinuous(gatePlan, ['END_COLLAR_A', 'VALVE_NECK_A', 'VALVE_BODY', 'VALVE_NECK_B', 'END_COLLAR_B'], 4, 'gate valve visible axial stack');
  const gateBody = gatePlan.find((p) => p.role === 'VALVE_BODY');
  assert.ok(gateBody);
  assert.ok(gatePlan.some((p) => p.role === 'BONNET_STEM'));
  assert.ok(gatePlan.some((p) => p.role === 'HANDWHEEL'));
  assert.ok(gateBody.radius >= 0.75 * 1.85, 'gate valve body must visually dominate pipe OD without becoming an oversized barrel');
  assert.ok(gateBody.length >= 4 * 0.42, 'gate valve body must occupy the central body partition');
  assert.equal(gateBody.replacesCenterlinePipe, true);
  const gateNeck = gatePlan.find((p) => p.role === 'VALVE_NECK_A');
  assert.ok(gateNeck.length <= 4 * 0.24, 'gate valve shoulder must stay compact');
  assertCoverage(gatePlan, 4, 'gate valve visual replacement coverage');

  const ball = getValveFlangeVisualSpec({ rawType: 'BALL VALVE', props: { bore: '100' } });
  assert.equal(ball.componentType, 'VALVE_BALL');
  const ballPlan = buildLinearVisualPrimitivePlan(ball, { length: 3, pipeRadius: 0.5 });
  assertNoFilledSeamRings(ballPlan, 'ball valve');
  assertOrderedContinuous(ballPlan, ['END_COLLAR_A', 'VALVE_NECK_A', 'VALVE_BODY', 'VALVE_NECK_B', 'END_COLLAR_B'], 3, 'ball valve visible axial stack');
  assert.ok(ballPlan.some((p) => p.role === 'LEVER_HANDLE'));
  assert.ok(ballPlan.find((p) => p.role === 'VALVE_BODY').radius >= 0.5 * 1.75);
  assertCoverage(ballPlan, 3, 'ball valve visual replacement coverage');

  const skeyGate = getValveFlangeVisualSpec({ rawType: 'RIGID', props: { bore: '100', rawAttributes: { SKEY: 'VGAT' } } });
  assert.equal(skeyGate.componentType, 'VALVE_GATE');

  const flange = getValveFlangeVisualSpec({ rawType: 'FLANGE', props: { bore: '200' } });
  assert.equal(flange.componentClass, 'FLANGE');
  assert.equal(flange.visualRecipeId, 'flange-pair-symbol.v1');
  const flangePlan = buildLinearVisualPrimitivePlan(flange, { length: 2.5, pipeRadius: 1 });
  assertNoFilledSeamRings(flangePlan, 'flange pair');
  assertOrderedContinuous(flangePlan, ['WELD_NECK_A', 'FLANGE_DISC_A', 'FLANGE_CENTER_BORE_FILL', 'FLANGE_DISC_B', 'WELD_NECK_B'], 2.5, 'flange pair visible axial stack');
  const flangeDisc = flangePlan.find((p) => p.role === 'FLANGE_DISC_A');
  const raisedFace = flangePlan.find((p) => p.role === 'RAISED_FACE_A');
  const gasket = flangePlan.find((p) => p.role === 'GASKET_CENTER');
  const boltPattern = flangePlan.find((p) => p.role === 'BOLT_PATTERN');
  assert.ok(flangeDisc);
  assert.ok(flangePlan.some((p) => p.role === 'FLANGE_DISC_B'));
  assert.ok(boltPattern);
  assert.ok(flangePlan.some((p) => p.role === 'FLANGE_CENTER_BORE_FILL'), 'flange pair needs direct center bore fill, not detached washers');
  assert.ok(gasket, 'flange pair should include a subtle gasket/face marker');
  assert.equal(gasket.overlayOnly, true, 'gasket is a visual overlay, not a replacement span');
  assert.ok(gasket.radius < flangeDisc.radius * 0.60, 'gasket must not render as a full flange-size black plate');
  assert.ok(flangeDisc.radius >= 2.0, 'flange disc must read larger than pipe OD');
  assert.ok(flangeDisc.length <= 0.105, 'flange thickness must stay thin/proportional to bore, not long component span');
  assert.equal(flangeDisc.thinPlate, true);
  assert.ok(raisedFace.length <= flangeDisc.length * 0.16, 'raised face/gasket marker must be a thin visual detail');
  assert.equal(raisedFace.thinRaisedFace, true);
  assert.equal(raisedFace.overlayOnly, true, 'raised face should overlay the flange plate rather than replacing centerline span');
  assert.ok(boltPattern.boltRadius <= 0.06, 'bolt pattern must not dominate the thin flange plate');
  assert.equal(flangeDisc.replacesCenterlinePipe, true);
  assertCoverage(flangePlan, 2.5, 'flange pair visual replacement coverage');

  const weldNeck = getValveFlangeVisualSpec({ rawType: 'WELD_NECK_FLANGE', props: { bore: '200' } });
  assert.equal(weldNeck.componentType, 'FLANGE_WELD_NECK');
  const weldNeckPlan = buildLinearVisualPrimitivePlan(weldNeck, { length: 2.5, pipeRadius: 1 });
  assertNoFilledSeamRings(weldNeckPlan, 'weld-neck flange');
  assertOrderedContinuous(weldNeckPlan, ['WELD_NECK_A', 'FLANGE_DISC_A', 'FLANGE_CENTER_BORE_FILL', 'FLANGE_DISC_B', 'WELD_NECK_B'], 2.5, 'weld-neck flange visible axial stack');
  const weldNeckA = weldNeckPlan.find((p) => p.role === 'WELD_NECK_A');
  const weldNeckB = weldNeckPlan.find((p) => p.role === 'WELD_NECK_B');
  const weldDiscA = weldNeckPlan.find((p) => p.role === 'FLANGE_DISC_A');
  const weldDiscB = weldNeckPlan.find((p) => p.role === 'FLANGE_DISC_B');
  assert.ok(weldNeckA, 'weld-neck flange must emit an explicit left taper primitive');
  assert.ok(weldNeckB, 'weld-neck flange must emit an explicit right taper primitive');
  assert.ok(!weldNeckPlan.some((p) => p.role === 'WELD_NECK' && p.kind === 'neck-pair'), 'weld-neck flange must not rely on the old renderer-side neck-pair orientation');
  assert.equal(weldNeckA.weldNeckPlacement, 'inside-component-before-left-plate');
  assert.equal(weldNeckB.weldNeckPlacement, 'inside-component-after-right-plate');
  assert.ok(weldNeckA.axialOffset < weldDiscA.axialOffset, 'left weld neck must sit on the pipe/outboard side of the left flange plate');
  assert.ok(weldNeckB.axialOffset > weldDiscB.axialOffset, 'right weld neck must sit on the pipe/outboard side of the right flange plate');
  assert.ok(weldNeckA.innerRadius < weldNeckA.outerRadius, 'left weld neck must taper from pipe radius to flange radius');
  assert.ok(weldNeckB.innerRadius < weldNeckB.outerRadius, 'right weld neck must taper from flange radius to pipe radius');
  assertCoverage(weldNeckPlan, 2.5, 'weld-neck flange visual replacement coverage');

  const blind = getValveFlangeVisualSpec({ rawType: 'RIGID', props: { rawAttributes: { SKEY: 'FLBL' } } });
  assert.equal(blind.componentType, 'FLANGE_BLIND');

  const pipe = getValveFlangeVisualSpec({ rawType: 'PIPE', props: { bore: '100' } });
  assert.equal(pipe, null);

  console.log('Valve/flange visual catalog gates passed');
}

run();
