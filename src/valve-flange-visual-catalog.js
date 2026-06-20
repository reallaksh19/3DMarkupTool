export const VALVE_FLANGE_VISUAL_CATALOG_SCHEMA = 'valve-flange-visual-catalog/v1';
export const LINEAR_COMPONENT_VISUAL_SPEC_SCHEMA = 'LinearComponentVisualSpec.v1';

// Canvas visual catalogue, not an ASME dimensional database.
// The profiles are proportional fallbacks: exact valve/flange dimensions must come
// from a future rating/size DB when those data are available.
export const VALVE_FLANGE_VISUAL_CATALOG = deepFreeze({
  schemaVersion: VALVE_FLANGE_VISUAL_CATALOG_SCHEMA,
  valveTypes: {
    VALVE_GENERIC: valveEntry('VALVE_GENERIC', 'valve-generic-symbol.v1', 'generic-valve', {
      bodyShape: 'round-body', bodyDiameterFactor: 1.72, bodyLengthFactor: 0.50, endCollarDiameterFactor: 1.52, endCollarLengthFactor: 0.045, bonnetHeightFactor: 1.18, handwheelRadiusFactor: 0.76, handleStyle: 'handwheel'
    }),
    VALVE_FLANGED: valveEntry('VALVE_FLANGED', 'valve-flanged-symbol.v1', 'flanged-valve', {
      bodyShape: 'round-body', bodyDiameterFactor: 1.76, bodyLengthFactor: 0.50, endCollarDiameterFactor: 1.58, endCollarLengthFactor: 0.04, bonnetHeightFactor: 1.28, handwheelRadiusFactor: 0.78, handleStyle: 'handwheel', flangedEnds: true, taperedShoulders: true
    }),
    VALVE_GATE: valveEntry('VALVE_GATE', 'valve-gate-symbol.v1', 'gate-valve', {
      bodyShape: 'wedge-body', bodyDiameterFactor: 1.74, bodyLengthFactor: 0.50, endCollarDiameterFactor: 1.56, endCollarLengthFactor: 0.042, bonnetHeightFactor: 1.78, handwheelRadiusFactor: 0.78, handleStyle: 'handwheel', taperedShoulders: true
    }),
    VALVE_GLOBE: valveEntry('VALVE_GLOBE', 'valve-globe-symbol.v1', 'globe-valve', {
      bodyShape: 'round-body', bodyDiameterFactor: 1.78, bodyLengthFactor: 0.50, endCollarDiameterFactor: 1.56, endCollarLengthFactor: 0.042, bonnetHeightFactor: 1.52, handwheelRadiusFactor: 0.76, handleStyle: 'handwheel', taperedShoulders: true
    }),
    VALVE_BALL: valveEntry('VALVE_BALL', 'valve-ball-symbol.v1', 'ball-valve', {
      bodyShape: 'ball-body', bodyDiameterFactor: 1.68, bodyLengthFactor: 0.46, endCollarDiameterFactor: 1.46, endCollarLengthFactor: 0.04, bonnetHeightFactor: 0.66, handwheelRadiusFactor: 0.0, handleStyle: 'lever', taperedShoulders: true
    }),
    VALVE_CHECK: valveEntry('VALVE_CHECK', 'valve-check-symbol.v1', 'check-valve', {
      bodyShape: 'check-body', bodyDiameterFactor: 1.72, bodyLengthFactor: 0.50, endCollarDiameterFactor: 1.48, endCollarLengthFactor: 0.042, bonnetHeightFactor: 0.76, handwheelRadiusFactor: 0.0, handleStyle: 'flow-arrow', taperedShoulders: true
    }),
    VALVE_BUTTERFLY: valveEntry('VALVE_BUTTERFLY', 'valve-butterfly-symbol.v1', 'butterfly-valve', {
      bodyShape: 'wafer-body', bodyDiameterFactor: 1.82, bodyLengthFactor: 0.26, endCollarDiameterFactor: 1.72, endCollarLengthFactor: 0.038, bonnetHeightFactor: 0.8, handwheelRadiusFactor: 0.0, handleStyle: 'lever'
    }),
    VALVE_CONTROL: valveEntry('VALVE_CONTROL', 'valve-control-symbol.v1', 'control-valve', {
      bodyShape: 'round-body', bodyDiameterFactor: 1.78, bodyLengthFactor: 0.50, endCollarDiameterFactor: 1.56, endCollarLengthFactor: 0.042, bonnetHeightFactor: 1.78, handwheelRadiusFactor: 0.0, handleStyle: 'actuator', taperedShoulders: true
    })
  },
  flangeTypes: {
    FLANGE_GENERIC: flangeEntry('FLANGE_GENERIC', 'flange-pair-symbol.v1', 'flange-pair', {
      flangeDiameterFactor: 1.62, flangeThicknessFactor: 0.066, raisedFaceDiameterFactor: 1.18, raisedFaceThicknessFactor: 0.012, boltCircleFactor: 1.34, boltDiameterFactor: 0.045, boltCount: 8, neckDiameterFactor: 1.08, neckLengthFactor: 0.40
    }),
    FLANGE_WELD_NECK: flangeEntry('FLANGE_WELD_NECK', 'flange-weld-neck-symbol.v1', 'weld-neck-flange-pair', {
      flangeDiameterFactor: 1.68, flangeThicknessFactor: 0.07, raisedFaceDiameterFactor: 1.20, raisedFaceThicknessFactor: 0.013, boltCircleFactor: 1.38, boltDiameterFactor: 0.045, boltCount: 8, neckDiameterFactor: 1.10, neckLengthFactor: 0.72
    }),
    FLANGE_BLIND: flangeEntry('FLANGE_BLIND', 'flange-blind-symbol.v1', 'blind-flange', {
      flangeDiameterFactor: 1.72, flangeThicknessFactor: 0.078, raisedFaceDiameterFactor: 1.22, raisedFaceThicknessFactor: 0.014, boltCircleFactor: 1.42, boltDiameterFactor: 0.045, boltCount: 8, neckDiameterFactor: 1.08, neckLengthFactor: 0.32, blindCap: true
    })
  }
});

const VALVE_ALIAS_MAP = new Map([
  ['FLANGED_VALVE', 'VALVE_FLANGED'], ['FLANGEDVALVE', 'VALVE_FLANGED'], ['VALVE_FLANGED', 'VALVE_FLANGED'], ['FLANGED', 'VALVE_FLANGED'], ['VFLG', 'VALVE_FLANGED'], ['VFLS', 'VALVE_FLANGED'],
  ['GATE_VALVE', 'VALVE_GATE'], ['GATEVALVE', 'VALVE_GATE'], ['VALVE_GATE', 'VALVE_GATE'], ['GATE', 'VALVE_GATE'], ['VGAT', 'VALVE_GATE'], ['VGATE', 'VALVE_GATE'],
  ['GLOBE_VALVE', 'VALVE_GLOBE'], ['GLOBEVALVE', 'VALVE_GLOBE'], ['VALVE_GLOBE', 'VALVE_GLOBE'], ['GLOBE', 'VALVE_GLOBE'], ['VGLB', 'VALVE_GLOBE'], ['VGLO', 'VALVE_GLOBE'],
  ['BALL_VALVE', 'VALVE_BALL'], ['BALLVALVE', 'VALVE_BALL'], ['VALVE_BALL', 'VALVE_BALL'], ['BALL', 'VALVE_BALL'], ['VBAL', 'VALVE_BALL'], ['VBLL', 'VALVE_BALL'],
  ['CHECK_VALVE', 'VALVE_CHECK'], ['CHECKVALVE', 'VALVE_CHECK'], ['NON_RETURN_VALVE', 'VALVE_CHECK'], ['NRV', 'VALVE_CHECK'], ['VALVE_CHECK', 'VALVE_CHECK'], ['VCHK', 'VALVE_CHECK'], ['VNRV', 'VALVE_CHECK'],
  ['BUTTERFLY_VALVE', 'VALVE_BUTTERFLY'], ['BUTTERFLYVALVE', 'VALVE_BUTTERFLY'], ['VALVE_BUTTERFLY', 'VALVE_BUTTERFLY'], ['VBUT', 'VALVE_BUTTERFLY'], ['VBFV', 'VALVE_BUTTERFLY'],
  ['CONTROL_VALVE', 'VALVE_CONTROL'], ['CONTROLVALVE', 'VALVE_CONTROL'], ['VALVE_CONTROL', 'VALVE_CONTROL'], ['VCON', 'VALVE_CONTROL'], ['VCNT', 'VALVE_CONTROL'],
  ['VALVE', 'VALVE_GENERIC'], ['GENERIC_VALVE', 'VALVE_GENERIC'], ['VALVE_GENERIC', 'VALVE_GENERIC'], ['VVAL', 'VALVE_GENERIC']
]);

const FLANGE_ALIAS_MAP = new Map([
  ['FLANGE', 'FLANGE_GENERIC'], ['FLANGE_GENERIC', 'FLANGE_GENERIC'], ['FLANGE_PAIR', 'FLANGE_GENERIC'], ['PAIR_FLANGE', 'FLANGE_GENERIC'], ['FLG', 'FLANGE_GENERIC'], ['FL', 'FLANGE_GENERIC'],
  ['WELD_NECK_FLANGE', 'FLANGE_WELD_NECK'], ['WELDNECK_FLANGE', 'FLANGE_WELD_NECK'], ['WN_FLANGE', 'FLANGE_WELD_NECK'], ['FLANGE_WELD_NECK', 'FLANGE_WELD_NECK'], ['FLWN', 'FLANGE_WELD_NECK'], ['FWN', 'FLANGE_WELD_NECK'],
  ['BLIND_FLANGE', 'FLANGE_BLIND'], ['BLINDFLANGE', 'FLANGE_BLIND'], ['FLANGE_BLIND', 'FLANGE_BLIND'], ['FLBL', 'FLANGE_BLIND'], ['FBLD', 'FLANGE_BLIND']
]);

export function getValveFlangeVisualSpec(element = {}) {
  const props = element.props || {};
  const tokens = candidateTypeTokens(element, props);
  const exactValveType = findExactMappedType(tokens, VALVE_ALIAS_MAP);
  if (exactValveType) return buildValveSpec(exactValveType, element, props);
  const exactFlangeType = findExactMappedType(tokens, FLANGE_ALIAS_MAP);
  if (exactFlangeType) return buildFlangeSpec(exactFlangeType, element, props);
  const valveType = findContainsMappedType(tokens, VALVE_ALIAS_MAP, 'VALVE');
  if (valveType) return buildValveSpec(valveType, element, props);
  const flangeType = findContainsMappedType(tokens, FLANGE_ALIAS_MAP, 'FLANGE');
  if (flangeType) return buildFlangeSpec(flangeType, element, props);
  return null;
}

export function buildLinearVisualPrimitivePlan(spec, metrics = {}) {
  if (!spec) return [];
  const length = positiveNumber(metrics.length, positiveNumber(spec.dimensions?.faceToFaceLength, 1));
  const pipeRadius = positiveNumber(metrics.pipeRadius, positiveNumber(spec.dimensions?.bore, 100) / 2);
  const half = length / 2;
  if (spec.componentClass === 'FLANGE') return buildFlangePrimitivePlan(spec, length, pipeRadius, half);
  if (spec.componentClass === 'VALVE') return buildValvePrimitivePlan(spec, length, pipeRadius, half);
  return [];
}

export function primitiveLocalSpan(primitive = {}) {
  if (Number.isFinite(primitive.localAxisStart) && Number.isFinite(primitive.localAxisEnd)) return [primitive.localAxisStart, primitive.localAxisEnd];
  const length = positiveNumber(primitive.length, 0);
  const center = Number.isFinite(primitive.axialOffset) ? primitive.axialOffset : 0;
  return [center - length / 2, center + length / 2];
}

export function validateLinearVisualPrimitiveContinuity(plan, length, options = {}) {
  const tolerance = positiveNumber(options.tolerance, Math.max(length * 1e-4, 1e-5));
  const half = length / 2;
  const spans = plan
    .filter((p) => p.replacesCenterlinePipe && !p.overlayOnly && !p.hiddenBoreFill && Number.isFinite(p.length))
    .map((p) => ({ role: p.role, span: primitiveLocalSpan(p) }))
    .sort((a, b) => a.span[0] - b.span[0]);
  const gaps = [];
  const overlaps = [];
  let cursor = -half;
  for (const entry of spans) {
    const [start, end] = entry.span;
    if (start > cursor + tolerance) gaps.push({ from: cursor, to: start, beforeRole: entry.role });
    if (start < cursor - tolerance) overlaps.push({ from: start, to: cursor, role: entry.role });
    cursor = Math.max(cursor, end);
  }
  if (cursor < half - tolerance) gaps.push({ from: cursor, to: half, beforeRole: 'END' });
  return { ok: gaps.length === 0, length, tolerance, spans, gaps, overlaps };
}

function buildFlangePrimitivePlan(spec, length, pipeRadius, half) {
  if (spec.flangeTopology?.visualKind === 'SINGLE_ORIENTED_FLANGE') return buildSingleFlangePrimitivePlan(spec, length, pipeRadius, half);
  return buildFlangePairPrimitivePlan(spec, length, pipeRadius, half);
}

function flangeMetrics(spec, length, pipeRadius) {
  const flangeThickness = clamp(pipeRadius * spec.profile.flangeThicknessFactor, pipeRadius * 0.026, Math.min(length * 0.04, pipeRadius * 0.085));
  const raisedFaceThickness = clamp(pipeRadius * spec.profile.raisedFaceThicknessFactor, pipeRadius * 0.0035, Math.min(flangeThickness * 0.13, length * 0.01));
  const gasketThickness = clamp(pipeRadius * 0.014, pipeRadius * 0.005, Math.min(flangeThickness * 0.18, length * 0.014));
  const plateRadius = clamp(pipeRadius * spec.profile.flangeDiameterFactor, pipeRadius * 1.34, pipeRadius * 1.72);
  const raisedFaceRadius = clamp(pipeRadius * spec.profile.raisedFaceDiameterFactor, pipeRadius * 1.06, Math.min(plateRadius * 0.74, pipeRadius * 1.24));
  const neckOuterRadius = clamp(pipeRadius * positiveNumber(spec.profile.neckDiameterFactor, 1.08), pipeRadius * 1.04, Math.min(plateRadius * 0.72, pipeRadius * 1.18));
  const rawNeckLength = pipeRadius * positiveNumber(spec.profile.neckLengthFactor, 0.40);
  const maxNeckLength = Math.max(pipeRadius * 0.14, Math.min(length * 0.28, pipeRadius * 0.38));
  const neckLength = clamp(rawNeckLength, pipeRadius * 0.10, maxNeckLength);
  const boltCircleRadius = clamp(pipeRadius * positiveNumber(spec.profile.boltCircleFactor, 1.34), pipeRadius * 1.12, Math.max(pipeRadius * 1.14, plateRadius * 0.80));
  const boltRadius = clamp(pipeRadius * positiveNumber(spec.profile.boltDiameterFactor, 0.045), pipeRadius * 0.032, plateRadius * 0.036);
  return { flangeThickness, raisedFaceThickness, gasketThickness, plateRadius, raisedFaceRadius, neckOuterRadius, neckLength, boltCircleRadius, boltRadius };
}

function buildSingleFlangePrimitivePlan(spec, length, pipeRadius, half) {
  const { flangeThickness, raisedFaceThickness, plateRadius, raisedFaceRadius, neckOuterRadius, neckLength, boltCircleRadius, boltRadius } = flangeMetrics(spec, length, pipeRadius);
  const raisedFaceAtTo = spec.flangeTopology.raisedFaceEndpoint === 'TO';
  const primitives = [];
  if (raisedFaceAtTo) {
    const raisedFaceStart = half - raisedFaceThickness;
    const plateStart = raisedFaceStart - flangeThickness;
    const neckStart = Math.max(-half, plateStart - neckLength);
    if (-half < neckStart - 1e-8) primitives.push(segmentPrimitive('PIPE_STUB_PIPE_SIDE', 'disc', -half, neckStart, { radius: pipeRadius * 1.01, replacesCenterlinePipe: true, continuityFiller: true, visualMaterial: 'pipe-stub', singleFlangePipeSide: 'FROM' }));
    primitives.push(segmentPrimitive('WELD_NECK_PIPE_SIDE', 'disc', neckStart, plateStart, { radius: neckOuterRadius, innerRadius: pipeRadius * 1.02, outerRadius: neckOuterRadius, radiusStart: pipeRadius * 1.02, radiusEnd: neckOuterRadius, replacesCenterlinePipe: true, proportionalShoulder: true, singleFlangePipeSide: 'FROM', boundedSingleFlangeNeck: true }));
    primitives.push(segmentPrimitive('FLANGE_PLATE', 'disc', plateStart, raisedFaceStart, { radius: plateRadius, replacesCenterlinePipe: true, proportionalFlangeThickness: true, thinPlate: true }));
    primitives.push(segmentPrimitive('RAISED_FACE_VALVE_SIDE', 'disc', raisedFaceStart, half, { radius: raisedFaceRadius, replacesCenterlinePipe: true, thinRaisedFace: true, visualMaterial: 'raised-face', singleFlangeRaisedFaceSide: 'TO' }));
  } else {
    const raisedFaceEnd = -half + raisedFaceThickness;
    const plateEnd = raisedFaceEnd + flangeThickness;
    const neckEnd = Math.min(half, plateEnd + neckLength);
    primitives.push(segmentPrimitive('RAISED_FACE_VALVE_SIDE', 'disc', -half, raisedFaceEnd, { radius: raisedFaceRadius, replacesCenterlinePipe: true, thinRaisedFace: true, visualMaterial: 'raised-face', singleFlangeRaisedFaceSide: 'FROM' }));
    primitives.push(segmentPrimitive('FLANGE_PLATE', 'disc', raisedFaceEnd, plateEnd, { radius: plateRadius, replacesCenterlinePipe: true, proportionalFlangeThickness: true, thinPlate: true }));
    primitives.push(segmentPrimitive('WELD_NECK_PIPE_SIDE', 'disc', plateEnd, neckEnd, { radius: neckOuterRadius, innerRadius: pipeRadius * 1.02, outerRadius: neckOuterRadius, radiusStart: neckOuterRadius, radiusEnd: pipeRadius * 1.02, replacesCenterlinePipe: true, proportionalShoulder: true, singleFlangePipeSide: 'TO', boundedSingleFlangeNeck: true }));
    if (neckEnd < half - 1e-8) primitives.push(segmentPrimitive('PIPE_STUB_PIPE_SIDE', 'disc', neckEnd, half, { radius: pipeRadius * 1.01, replacesCenterlinePipe: true, continuityFiller: true, visualMaterial: 'pipe-stub', singleFlangePipeSide: 'TO' }));
  }
  primitives.push({ role: 'BOLT_PATTERN', kind: 'bolt-pattern', boltCount: spec.profile.boltCount, boltCircleRadius, boltRadius, flangeRoles: ['FLANGE_PLATE'] });
  return primitives;
}

function buildFlangePairPrimitivePlan(spec, length, pipeRadius, half) {
  const { flangeThickness, raisedFaceThickness, gasketThickness, plateRadius, raisedFaceRadius, neckOuterRadius, boltCircleRadius, boltRadius } = flangeMetrics(spec, length, pipeRadius);
  const innerLeft = -gasketThickness / 2;
  const innerRight = gasketThickness / 2;
  const leftPlateStart = innerLeft - flangeThickness;
  const leftPlateEnd = innerLeft;
  const rightPlateStart = innerRight;
  const rightPlateEnd = innerRight + flangeThickness;
  return [
    segmentPrimitive('WELD_NECK_A', 'disc', -half, leftPlateStart, { radius: neckOuterRadius, innerRadius: pipeRadius * 1.02, outerRadius: neckOuterRadius, radiusStart: pipeRadius * 1.02, radiusEnd: neckOuterRadius, replacesCenterlinePipe: true, continuityFiller: true, proportionalShoulder: true, weldNeckPlacement: 'inside-component-before-left-plate' }),
    segmentPrimitive('FLANGE_DISC_A', 'disc', leftPlateStart, leftPlateEnd, { radius: plateRadius, replacesCenterlinePipe: true, proportionalFlangeThickness: true, thinPlate: true }),
    segmentPrimitive('FLANGE_CENTER_BORE_FILL', 'disc', innerLeft, innerRight, { radius: pipeRadius * 0.42, replacesCenterlinePipe: true, continuityFiller: true, visibleBoreFill: true, subtleCenterFill: true }),
    segmentPrimitive('GASKET_CENTER', 'disc', innerLeft, innerRight, { radius: pipeRadius * 1.03, replacesCenterlinePipe: false, overlayOnly: true, subtleGasket: true, visualMaterial: 'gasket' }),
    segmentPrimitive('FLANGE_DISC_B', 'disc', rightPlateStart, rightPlateEnd, { radius: plateRadius, replacesCenterlinePipe: true, proportionalFlangeThickness: true, thinPlate: true }),
    segmentPrimitive('WELD_NECK_B', 'disc', rightPlateEnd, half, { radius: neckOuterRadius, innerRadius: pipeRadius * 1.02, outerRadius: neckOuterRadius, radiusStart: neckOuterRadius, radiusEnd: pipeRadius * 1.02, replacesCenterlinePipe: true, continuityFiller: true, proportionalShoulder: true, weldNeckPlacement: 'inside-component-after-right-plate' }),
    segmentPrimitive('RAISED_FACE_A', 'disc', leftPlateEnd - raisedFaceThickness, leftPlateEnd, { radius: raisedFaceRadius, replacesCenterlinePipe: false, overlayOnly: true, subtleRaisedFace: true, visualMaterial: 'raised-face' }),
    segmentPrimitive('RAISED_FACE_B', 'disc', rightPlateStart, rightPlateStart + raisedFaceThickness, { radius: raisedFaceRadius, replacesCenterlinePipe: false, overlayOnly: true, subtleRaisedFace: true, visualMaterial: 'raised-face' }),
    { role: 'BOLT_PATTERN', kind: 'bolt-pattern', boltCount: spec.profile.boltCount, boltCircleRadius, boltRadius, flangeRoles: ['FLANGE_DISC_A', 'FLANGE_DISC_B'] }
  ];
}

function buildValvePrimitivePlan(spec, length, pipeRadius, half) {
  const p = spec.profile;
  const rawBodyRadius = pipeRadius * positiveNumber(p.bodyDiameterFactor, 1.72);
  const bodyRadius = clamp(rawBodyRadius, pipeRadius * 1.38, pipeRadius * 1.86);
  const rawCollarRadius = pipeRadius * positiveNumber(p.endCollarDiameterFactor, 1.52);
  const collarRadius = clamp(rawCollarRadius, pipeRadius * 1.22, bodyRadius * 0.92);
  const collarLength = clamp(pipeRadius * positiveNumber(p.endCollarLengthFactor, 0.04), Math.min(length * 0.012, pipeRadius * 0.02), Math.min(length * 0.06, pipeRadius * 0.065));
  const availableBetweenCollars = Math.max(length - 2 * collarLength, length * 0.2);
  const profileBodyLength = length * positiveNumber(p.bodyLengthFactor, 0.5);
  const minBodyLength = Math.min(availableBetweenCollars * 0.34, Math.max(pipeRadius * 0.55, length * 0.24));
  const maxBodyLength = Math.max(minBodyLength, availableBetweenCollars * 0.68);
  const bodyLength = clamp(profileBodyLength, minBodyLength, maxBodyLength);
  const bodyStart = -bodyLength / 2;
  const bodyEnd = bodyLength / 2;
  const leftCollarEnd = -half + collarLength;
  const rightCollarStart = half - collarLength;
  const primitives = [
    segmentPrimitive('END_COLLAR_A', 'disc', -half, leftCollarEnd, { radius: collarRadius, replacesCenterlinePipe: true, thinPlate: true, compactFlangedValvePlate: true }),
    segmentPrimitive('VALVE_NECK_A', 'disc', leftCollarEnd, bodyStart, { radius: bodyRadius, innerRadius: collarRadius, outerRadius: bodyRadius, radiusStart: collarRadius, radiusEnd: bodyRadius, replacesCenterlinePipe: true, proportionalShoulder: true, elongatedTaperedShoulder: true }),
    segmentPrimitive('VALVE_BODY', p.bodyShape || 'round-body', bodyStart, bodyEnd, { radius: bodyRadius, replacesCenterlinePipe: true, valveBodyShape: p.bodyShape || 'round-body', compactBodyLengthFactorApplied: true }),
    segmentPrimitive('VALVE_NECK_B', 'disc', bodyEnd, rightCollarStart, { radius: bodyRadius, innerRadius: collarRadius, outerRadius: bodyRadius, radiusStart: bodyRadius, radiusEnd: collarRadius, replacesCenterlinePipe: true, proportionalShoulder: true, elongatedTaperedShoulder: true }),
    segmentPrimitive('END_COLLAR_B', 'disc', rightCollarStart, half, { radius: collarRadius, replacesCenterlinePipe: true, thinPlate: true, compactFlangedValvePlate: true })
  ];
  const bonnetHeight = pipeRadius * positiveNumber(p.bonnetHeightFactor, 1.0);
  if (bonnetHeight > pipeRadius * 0.15) primitives.push({ role: 'BONNET_STEM', kind: 'stem', axialOffset: 0, radialOffset: bodyRadius * 0.55, length: bonnetHeight, radius: Math.max(pipeRadius * 0.16, 0.025) });
  if (p.handleStyle === 'handwheel' && positiveNumber(p.handwheelRadiusFactor, 0) > 0) primitives.push({ role: 'HANDWHEEL', kind: 'handwheel', axialOffset: 0, radius: pipeRadius * p.handwheelRadiusFactor });
  else if (p.handleStyle === 'lever') primitives.push({ role: 'LEVER_HANDLE', kind: 'lever', axialOffset: 0, length: pipeRadius * 2.2 });
  else if (p.handleStyle === 'flow-arrow') primitives.push({ role: 'FLOW_ARROW', kind: 'flow-arrow', axialOffset: 0, length: pipeRadius * 1.8 });
  else if (p.handleStyle === 'actuator') primitives.push({ role: 'ACTUATOR', kind: 'actuator', axialOffset: 0, length: pipeRadius * 0.9, radius: pipeRadius * 0.7 });
  return primitives;
}

function segmentPrimitive(role, kind, start, end, extra = {}) {
  const localAxisStart = Number(start);
  const localAxisEnd = Number(end);
  const length = Math.max(Math.abs(localAxisEnd - localAxisStart), 0.0001);
  return { role, kind, localAxisStart, localAxisEnd, axialOffset: (localAxisStart + localAxisEnd) / 2, length, ...extra };
}

function buildValveSpec(type, element, props) {
  const entry = VALVE_FLANGE_VISUAL_CATALOG.valveTypes[type] || VALVE_FLANGE_VISUAL_CATALOG.valveTypes.VALVE_GENERIC;
  return {
    schemaVersion: LINEAR_COMPONENT_VISUAL_SPEC_SCHEMA,
    catalogSchemaVersion: VALVE_FLANGE_VISUAL_CATALOG_SCHEMA,
    componentClass: 'VALVE',
    componentType: entry.componentType,
    visualRecipeId: entry.visualRecipeId,
    visualKey: entry.visualKey,
    profile: { ...entry.profile },
    dimensions: dimensionsFromProps(props),
    sourceElementId: element.id || props.id || ''
  };
}

function buildFlangeSpec(type, element, props) {
  const entry = VALVE_FLANGE_VISUAL_CATALOG.flangeTypes[type] || VALVE_FLANGE_VISUAL_CATALOG.flangeTypes.FLANGE_GENERIC;
  const topology = flangeTopologyFromProps(props);
  return {
    schemaVersion: LINEAR_COMPONENT_VISUAL_SPEC_SCHEMA,
    catalogSchemaVersion: VALVE_FLANGE_VISUAL_CATALOG_SCHEMA,
    componentClass: 'FLANGE',
    componentType: entry.componentType,
    visualRecipeId: topology ? 'single-oriented-flange-symbol.v1' : entry.visualRecipeId,
    visualKey: topology ? 'single-oriented-flange' : entry.visualKey,
    profile: { ...entry.profile },
    dimensions: dimensionsFromProps(props),
    flangeTopology: topology,
    sourceElementId: element.id || props.id || ''
  };
}

function flangeTopologyFromProps(props = {}) {
  if (String(props.flangeVisualKind || '').toUpperCase() !== 'SINGLE_ORIENTED_FLANGE') return null;
  const pipeEndpoint = normalizedEndpoint(props.singleFlangePipeEndpoint);
  const raisedFaceEndpoint = normalizedEndpoint(props.singleFlangeRaisedFaceEndpoint);
  if (!pipeEndpoint || !raisedFaceEndpoint || pipeEndpoint === raisedFaceEndpoint) return null;
  return { visualKind: 'SINGLE_ORIENTED_FLANGE', pipeEndpoint, raisedFaceEndpoint };
}

function normalizedEndpoint(value) {
  const token = String(value || '').trim().toUpperCase();
  if (token === 'FROM' || token === 'TO') return token;
  return '';
}

function dimensionsFromProps(props = {}) {
  const bore = positiveNumber(props.bore, 100);
  return { bore, faceToFaceLength: positiveNumber(props.faceToFaceLength, bore / 100) };
}

function candidateTypeTokens(element = {}, props = {}) {
  const rawAttributes = props.rawAttributes || {};
  const fields = [element.rawType, element.type, element.componentType, element.id, props.rawType, props.type, props.meshRole, props.rigidType, props.id, rawAttributes.SKEY, rawAttributes.skey, rawAttributes.TYPE, rawAttributes.type];
  const tokens = [];
  for (const field of fields) {
    const token = normalizeToken(field);
    if (token) tokens.push(token);
  }
  return [...new Set(tokens)];
}

function findExactMappedType(tokens, map) {
  for (const token of tokens) if (map.has(token)) return map.get(token);
  return '';
}

function findContainsMappedType(tokens, map, needle) {
  for (const token of tokens) {
    if (!token.includes(needle)) continue;
    for (const [alias, mapped] of map.entries()) if (token.includes(alias)) return mapped;
  }
  return '';
}

function normalizeToken(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function valveEntry(componentType, visualRecipeId, visualKey, profile) {
  return { componentClass: 'VALVE', componentType, visualRecipeId, visualKey, profile };
}

function flangeEntry(componentType, visualRecipeId, visualKey, profile) {
  return { componentClass: 'FLANGE', componentType, visualRecipeId, visualKey, profile };
}

function positiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
