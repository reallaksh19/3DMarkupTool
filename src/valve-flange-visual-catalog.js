export const VALVE_FLANGE_VISUAL_CATALOG_SCHEMA = 'valve-flange-visual-catalog/v1';
export const LINEAR_COMPONENT_VISUAL_SPEC_SCHEMA = 'LinearComponentVisualSpec.v1';

// Canvas visual catalogue, not an ASME dimensional database.
// The profiles are proportional fallbacks: exact valve/flange dimensions must come
// from a future rating/size DB when those data are available.
export const VALVE_FLANGE_VISUAL_CATALOG = deepFreeze({
  schemaVersion: VALVE_FLANGE_VISUAL_CATALOG_SCHEMA,
  valveTypes: {
    VALVE_GENERIC: valveEntry('VALVE_GENERIC', 'valve-generic-symbol.v1', 'generic-valve', {
      bodyShape: 'round-body', bodyDiameterFactor: 1.92, bodyLengthFactor: 0.52, endCollarDiameterFactor: 2.0, endCollarLengthFactor: 0.05, bonnetHeightFactor: 1.28, handwheelRadiusFactor: 0.84, handleStyle: 'handwheel'
    }),
    VALVE_FLANGED: valveEntry('VALVE_FLANGED', 'valve-flanged-symbol.v1', 'flanged-valve', {
      bodyShape: 'round-body', bodyDiameterFactor: 2.0, bodyLengthFactor: 0.52, endCollarDiameterFactor: 2.14, endCollarLengthFactor: 0.042, bonnetHeightFactor: 1.38, handwheelRadiusFactor: 0.88, handleStyle: 'handwheel', flangedEnds: true, taperedShoulders: true
    }),
    VALVE_GATE: valveEntry('VALVE_GATE', 'valve-gate-symbol.v1', 'gate-valve', {
      bodyShape: 'wedge-body', bodyDiameterFactor: 1.92, bodyLengthFactor: 0.54, endCollarDiameterFactor: 2.04, endCollarLengthFactor: 0.045, bonnetHeightFactor: 1.95, handwheelRadiusFactor: 0.9, handleStyle: 'handwheel', taperedShoulders: true
    }),
    VALVE_GLOBE: valveEntry('VALVE_GLOBE', 'valve-globe-symbol.v1', 'globe-valve', {
      bodyShape: 'round-body', bodyDiameterFactor: 2.02, bodyLengthFactor: 0.54, endCollarDiameterFactor: 2.04, endCollarLengthFactor: 0.045, bonnetHeightFactor: 1.65, handwheelRadiusFactor: 0.86, handleStyle: 'handwheel', taperedShoulders: true
    }),
    VALVE_BALL: valveEntry('VALVE_BALL', 'valve-ball-symbol.v1', 'ball-valve', {
      bodyShape: 'ball-body', bodyDiameterFactor: 1.86, bodyLengthFactor: 0.50, endCollarDiameterFactor: 1.84, endCollarLengthFactor: 0.042, bonnetHeightFactor: 0.76, handwheelRadiusFactor: 0.0, handleStyle: 'lever', taperedShoulders: true
    }),
    VALVE_CHECK: valveEntry('VALVE_CHECK', 'valve-check-symbol.v1', 'check-valve', {
      bodyShape: 'check-body', bodyDiameterFactor: 1.92, bodyLengthFactor: 0.54, endCollarDiameterFactor: 1.88, endCollarLengthFactor: 0.045, bonnetHeightFactor: 0.86, handwheelRadiusFactor: 0.0, handleStyle: 'flow-arrow', taperedShoulders: true
    }),
    VALVE_BUTTERFLY: valveEntry('VALVE_BUTTERFLY', 'valve-butterfly-symbol.v1', 'butterfly-valve', {
      bodyShape: 'wafer-body', bodyDiameterFactor: 2.08, bodyLengthFactor: 0.26, endCollarDiameterFactor: 2.12, endCollarLengthFactor: 0.04, bonnetHeightFactor: 0.9, handwheelRadiusFactor: 0.0, handleStyle: 'lever'
    }),
    VALVE_CONTROL: valveEntry('VALVE_CONTROL', 'valve-control-symbol.v1', 'control-valve', {
      bodyShape: 'round-body', bodyDiameterFactor: 2.02, bodyLengthFactor: 0.54, endCollarDiameterFactor: 2.04, endCollarLengthFactor: 0.045, bonnetHeightFactor: 1.95, handwheelRadiusFactor: 0.0, handleStyle: 'actuator', taperedShoulders: true
    })
  },
  flangeTypes: {
    FLANGE_GENERIC: flangeEntry('FLANGE_GENERIC', 'flange-pair-symbol.v1', 'flange-pair', {
      flangeDiameterFactor: 2.05, flangeThicknessFactor: 0.075, raisedFaceDiameterFactor: 1.32, raisedFaceThicknessFactor: 0.014, boltCircleFactor: 1.72, boltDiameterFactor: 0.055, boltCount: 8, neckDiameterFactor: 1.08, neckLengthFactor: 0.40
    }),
    FLANGE_WELD_NECK: flangeEntry('FLANGE_WELD_NECK', 'flange-weld-neck-symbol.v1', 'weld-neck-flange-pair', {
      flangeDiameterFactor: 2.14, flangeThicknessFactor: 0.08, raisedFaceDiameterFactor: 1.34, raisedFaceThicknessFactor: 0.015, boltCircleFactor: 1.82, boltDiameterFactor: 0.055, boltCount: 8, neckDiameterFactor: 1.12, neckLengthFactor: 0.72
    }),
    FLANGE_BLIND: flangeEntry('FLANGE_BLIND', 'flange-blind-symbol.v1', 'blind-flange', {
      flangeDiameterFactor: 2.18, flangeThicknessFactor: 0.09, raisedFaceDiameterFactor: 1.38, raisedFaceThicknessFactor: 0.016, boltCircleFactor: 1.88, boltDiameterFactor: 0.055, boltCount: 8, neckDiameterFactor: 1.08, neckLengthFactor: 0.32, blindCap: true
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
  if (exactValveType) return buildValveSpec(exactValveType, element, props, tokens);

  const exactFlangeType = findExactMappedType(tokens, FLANGE_ALIAS_MAP);
  if (exactFlangeType) return buildFlangeSpec(exactFlangeType, element, props, tokens);

  const valveType = findContainsMappedType(tokens, VALVE_ALIAS_MAP, 'VALVE');
  if (valveType) return buildValveSpec(valveType, element, props, tokens);

  const flangeType = findContainsMappedType(tokens, FLANGE_ALIAS_MAP, 'FLANGE');
  if (flangeType) return buildFlangeSpec(flangeType, element, props, tokens);

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
  if (Number.isFinite(primitive.localAxisStart) && Number.isFinite(primitive.localAxisEnd)) {
    return [primitive.localAxisStart, primitive.localAxisEnd];
  }
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
  const flangeThickness = clamp(pipeRadius * spec.profile.flangeThicknessFactor, pipeRadius * 0.028, Math.min(length * 0.045, pipeRadius * 0.10));
  const raisedFaceThickness = clamp(pipeRadius * spec.profile.raisedFaceThicknessFactor, pipeRadius * 0.004, Math.min(flangeThickness * 0.14, length * 0.012));
  const gasketThickness = clamp(pipeRadius * 0.018, pipeRadius * 0.006, Math.min(flangeThickness * 0.22, length * 0.018));
  const plateRadius = pipeRadius * spec.profile.flangeDiameterFactor;
  const raisedFaceRadius = pipeRadius * spec.profile.raisedFaceDiameterFactor;
  const neckOuterRadius = Math.max(pipeRadius * positiveNumber(spec.profile.neckDiameterFactor, 1.08), pipeRadius * 1.06);
  const rawNeckLength = pipeRadius * positiveNumber(spec.profile.neckLengthFactor, 0.40);
  const maxNeckLength = Math.max(pipeRadius * 0.14, Math.min(length * 0.28, pipeRadius * 0.38));
  const neckLength = clamp(rawNeckLength, pipeRadius * 0.10, maxNeckLength);
  return { flangeThickness, raisedFaceThickness, gasketThickness, plateRadius, raisedFaceRadius, neckOuterRadius, neckLength };
}

function buildSingleFlangePrimitivePlan(spec, length, pipeRadius, half) {
  const { flangeThickness, raisedFaceThickness, plateRadius, raisedFaceRadius, neckOuterRadius, neckLength } = flangeMetrics(spec, length, pipeRadius);
  const raisedFaceAtTo = spec.flangeTopology.raisedFaceEndpoint === 'TO';
  const primitives = [];

  // Single InputXML flanges beside valves are oriented by endpoint topology:
  // pipe endpoint = weld-neck/taper side, opposite endpoint = raised-face side.
  // Keep the weld neck at the pipe endpoint. The remaining middle span is only
  // a same-bore filler so the taper is not visually reversed next to the valve.
  if (raisedFaceAtTo) {
    const neckEnd = Math.min(half, -half + neckLength);
    const raisedFaceStart = half - raisedFaceThickness;
    const plateStart = raisedFaceStart - flangeThickness;

    primitives.push(segmentPrimitive('WELD_NECK_PIPE_SIDE', 'disc', -half, neckEnd, {
      radius: neckOuterRadius,
      innerRadius: pipeRadius * 1.02,
      outerRadius: neckOuterRadius,
      radiusStart: pipeRadius * 1.02,
      radiusEnd: neckOuterRadius,
      replacesCenterlinePipe: true,
      proportionalShoulder: true,
      singleFlangePipeSide: 'FROM',
      boundedSingleFlangeNeck: true
    }));
    if (neckEnd < plateStart - 1e-8) {
      primitives.push(segmentPrimitive('PIPE_STUB_PIPE_SIDE', 'disc', neckEnd, plateStart, {
        radius: pipeRadius * 1.01,
        replacesCenterlinePipe: true,
        continuityFiller: true,
        visualMaterial: 'pipe-stub',
        singleFlangePipeSide: 'FROM'
      }));
    }
    primitives.push(segmentPrimitive('FLANGE_PLATE', 'disc', plateStart, raisedFaceStart, {
      radius: plateRadius,
      replacesCenterlinePipe: true,
      proportionalFlangeThickness: true,
      thinPlate: true
    }));
    primitives.push(segmentPrimitive('RAISED_FACE_VALVE_SIDE', 'disc', raisedFaceStart, half, {
      radius: raisedFaceRadius,
      replacesCenterlinePipe: true,
      thinRaisedFace: true,
      visualMaterial: 'raised-face',
      singleFlangeRaisedFaceSide: 'TO'
    }));
  } else {
    const raisedFaceEnd = -half + raisedFaceThickness;
    const plateEnd = raisedFaceEnd + flangeThickness;
    const neckStart = Math.max(-half, half - neckLength);

    primitives.push(segmentPrimitive('RAISED_FACE_VALVE_SIDE', 'disc', -half, raisedFaceEnd, {
      radius: raisedFaceRadius,
      replacesCenterlinePipe: true,
      thinRaisedFace: true,
      visualMaterial: 'raised-face',
      singleFlangeRaisedFaceSide: 'FROM'
    }));
    primitives.push(segmentPrimitive('FLANGE_PLATE', 'disc', raisedFaceEnd, plateEnd, {
      radius: plateRadius,
      replacesCenterlinePipe: true,
      proportionalFlangeThickness: true,
      thinPlate: true
    }));
    if (plateEnd < neckStart - 1e-8) {
      primitives.push(segmentPrimitive('PIPE_STUB_PIPE_SIDE', 'disc', plateEnd, neckStart, {
        radius: pipeRadius * 1.01,
        replacesCenterlinePipe: true,
        continuityFiller: true,
        visualMaterial: 'pipe-stub',
        singleFlangePipeSide: 'TO'
      }));
    }
    primitives.push(segmentPrimitive('WELD_NECK_PIPE_SIDE', 'disc', neckStart, half, {
      radius: neckOuterRadius,
      innerRadius: pipeRadius * 1.02,
      outerRadius: neckOuterRadius,
      radiusStart: neckOuterRadius,
      radiusEnd: pipeRadius * 1.02,
      replacesCenterlinePipe: true,
      proportionalShoulder: true,
      singleFlangePipeSide: 'TO',
      boundedSingleFlangeNeck: true
    }));
  }

  primitives.push({ role: 'BOLT_PATTERN', kind: 'bolt-pattern', boltCount: spec.profile.boltCount, boltCircleRadius: pipeRadius * spec.profile.boltCircleFactor, boltRadius: pipeRadius * spec.profile.boltDiameterFactor, flangeRoles: ['FLANGE_PLATE'] });
  return primitives;
}

function buildFlangePairPrimitivePlan(spec, length, pipeRadius, half) {
  const { flangeThickness, raisedFaceThickness, gasketThickness, plateRadius, raisedFaceRadius, neckOuterRadius } = flangeMetrics(spec, length, pipeRadius);
  const innerLeft = -gasketThickness / 2;
  const innerRight = gasketThickness / 2;
  const leftPlateStart = innerLeft - flangeThickness;
  const leftPlateEnd = innerLeft;
  const rightPlateStart = innerRight;
  const rightPlateEnd = innerRight + flangeThickness;
  const primitives = [];

  primitives.push(segmentPrimitive('WELD_NECK_A', 'disc', -half, leftPlateStart, {
    radius: neckOuterRadius, innerRadius: pipeRadius * 1.02, outerRadius: neckOuterRadius, radiusStart: pipeRadius * 1.02, radiusEnd: neckOuterRadius, replacesCenterlinePipe: true, continuityFiller: true, proportionalShoulder: true, weldNeckPlacement: 'inside-component-before-left-plate'
  }));
  primitives.push(segmentPrimitive('FLANGE_DISC_A', 'disc', leftPlateStart, leftPlateEnd, { radius: plateRadius, replacesCenterlinePipe: true, proportionalFlangeThickness: true, thinPlate: true }));
  primitives.push(segmentPrimitive('FLANGE_CENTER_BORE_FILL', 'disc', innerLeft, innerRight, { radius: pipeRadius * 0.46, replacesCenterlinePipe: true, continuityFiller: true, visibleBoreFill: true, subtleCenterFill: true }));
  primitives.push(segmentPrimitive('GASKET_CENTER', 'disc', innerLeft, innerRight, { radius: pipeRadius * 1.08, replacesCenterlinePipe: false, overlayOnly: true, subtleGasket: true, visualMaterial: 'gasket' }));
  primitives.push(segmentPrimitive('FLANGE_DISC_B', 'disc', rightPlateStart, rightPlateEnd, { radius: plateRadius, replacesCenterlinePipe: true, proportionalFlangeThickness: true, thinPlate: true }));
  primitives.push(segmentPrimitive('WELD_NECK_B', 'disc', rightPlateEnd, half, {
    radius: neckOuterRadius, innerRadius: pipeRadius * 1.02, outerRadius: neckOuterRadius, radiusStart: neckOuterRadius, radiusEnd: pipeRadius * 1.02, replacesCenterlinePipe: true, continuityFiller: true, proportionalShoulder: true, weldNeckPlacement: 'inside-component-after-right-plate'
  }));
  primitives.push(segmentPrimitive('RAISED_FACE_A', 'disc', leftPlateEnd - raisedFaceThickness, leftPlateEnd, { radius: raisedFaceRadius, replacesCenterlinePipe: false, overlayOnly: true, subtleRaisedFace: true, visualMaterial: 'raised-face' }));
  primitives.push(segmentPrimitive('RAISED_FACE_B', 'disc', rightPlateStart, rightPlateStart + raisedFaceThickness, { radius: raisedFaceRadius, replacesCenterlinePipe: false, overlayOnly: true, subtleRaisedFace: true, visualMaterial: 'raised-face' }));
  primitives.push({ role: 'BOLT_PATTERN', kind: 'bolt-pattern', boltCount: spec.profile.boltCount, boltCircleRadius: pipeRadius * spec.profile.boltCircleFactor, boltRadius: pipeRadius * spec.profile.boltDiameterFactor, flangeRoles: ['FLANGE_DISC_A', 'FLANGE_DISC_B'] });

  return primitives;
}

function buildValvePrimitivePlan(spec, length, pipeRadius, half) {
  const p = spec.profile;
  const collarRadius = pipeRadius * positiveNumber(p.endCollarDiameterFactor, 1.9);
  const bodyRadius = pipeRadius * positiveNumber(p.bodyDiameterFactor, 1.9);
  const collarLength = clamp(pipeRadius * positiveNumber(p.endCollarLengthFactor, 0.045), Math.min(length * 0.012, pipeRadius * 0.025), length * 0.08);
  const shoulderLength = clamp(pipeRadius * 0.22, length * 0.06, length * 0.16);
  const leftCollarEnd = -half + collarLength;
  const rightCollarStart = half - collarLength;
  const leftShoulderEnd = Math.min(rightCollarStart, leftCollarEnd + shoulderLength);
  const rightShoulderStart = Math.max(leftShoulderEnd, rightCollarStart - shoulderLength);
  const primitives = [];

  primitives.push(segmentPrimitive('END_COLLAR_A', 'disc', -half, leftCollarEnd, { radius: collarRadius, replacesCenterlinePipe: true, thinPlate: true }));
  primitives.push(segmentPrimitive('VALVE_NECK_A', 'disc', leftCollarEnd, leftShoulderEnd, { radius: bodyRadius, innerRadius: collarRadius, outerRadius: bodyRadius, radiusStart: collarRadius, radiusEnd: bodyRadius, replacesCenterlinePipe: true, proportionalShoulder: true }));
  primitives.push(segmentPrimitive('VALVE_BODY', p.bodyShape || 'round-body', leftShoulderEnd, rightShoulderStart, { radius: bodyRadius, replacesCenterlinePipe: true, valveBodyShape: p.bodyShape || 'round-body' }));
  primitives.push(segmentPrimitive('VALVE_NECK_B', 'disc', rightShoulderStart, rightCollarStart, { radius: bodyRadius, innerRadius: collarRadius, outerRadius: bodyRadius, radiusStart: bodyRadius, radiusEnd: collarRadius, replacesCenterlinePipe: true, proportionalShoulder: true }));
  primitives.push(segmentPrimitive('END_COLLAR_B', 'disc', rightCollarStart, half, { radius: collarRadius, replacesCenterlinePipe: true, thinPlate: true }));

  const bonnetHeight = pipeRadius * positiveNumber(p.bonnetHeightFactor, 1.0);
  if (bonnetHeight > pipeRadius * 0.15) {
    primitives.push({ role: 'BONNET_STEM', kind: 'stem', axialOffset: 0, radialOffset: bodyRadius * 0.55, length: bonnetHeight, radius: Math.max(pipeRadius * 0.16, 0.025) });
  }
  if (p.handleStyle === 'handwheel' && positiveNumber(p.handwheelRadiusFactor, 0) > 0) {
    primitives.push({ role: 'HANDWHEEL', kind: 'handwheel', axialOffset: 0, radius: pipeRadius * p.handwheelRadiusFactor });
  } else if (p.handleStyle === 'lever') {
    primitives.push({ role: 'LEVER_HANDLE', kind: 'lever', axialOffset: 0, length: pipeRadius * 2.2 });
  } else if (p.handleStyle === 'flow-arrow') {
    primitives.push({ role: 'FLOW_ARROW', kind: 'flow-arrow', axialOffset: 0, length: pipeRadius * 1.8 });
  } else if (p.handleStyle === 'actuator') {
    primitives.push({ role: 'ACTUATOR', kind: 'actuator', axialOffset: 0, length: pipeRadius * 0.9, radius: pipeRadius * 0.7 });
  }
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
  const fields = [
    element.rawType, element.type, element.componentType, element.id,
    props.rawType, props.type, props.meshRole, props.rigidType, props.id,
    rawAttributes.SKEY, rawAttributes.skey, rawAttributes.TYPE, rawAttributes.type
  ];
  const tokens = [];
  for (const field of fields) {
    const token = normalizeToken(field);
    if (token) tokens.push(token);
  }
  return [...new Set(tokens)];
}

function findExactMappedType(tokens, map) {
  for (const token of tokens) {
    if (map.has(token)) return map.get(token);
  }
  return '';
}

function findContainsMappedType(tokens, map, needle) {
  for (const token of tokens) {
    if (!token.includes(needle)) continue;
    for (const [alias, mapped] of map.entries()) {
      if (token.includes(alias)) return mapped;
    }
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
