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

  // Valve-vs-flange precedence matters. Tokens such as FLANGED_VALVE contain
  // both words, but the component is a valve with flanged ends, not a loose flange pair.
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
  const length = positiveNumber(metrics.length, positiveNumber(spec.dimensions.faceToFaceLength, 1));
  const pipeRadius = positiveNumber(metrics.pipeRadius, positiveNumber(spec.dimensions.bore, 100) / 2);
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

  return {
    ok: gaps.length === 0,
    length,
    tolerance,
    spans,
    gaps,
    overlaps
  };
}

function buildFlangePrimitivePlan(spec, length, pipeRadius, half) {
  if (spec.flangeTopology?.visualKind === 'SINGLE_ORIENTED_FLANGE') {
    return buildSingleFlangePrimitivePlan(spec, length, pipeRadius, half);
  }
  return buildFlangePairPrimitivePlan(spec, length, pipeRadius, half);
}

function flangeMetrics(spec, length, pipeRadius) {
  const flangeThickness = clamp(pipeRadius * spec.profile.flangeThicknessFactor, pipeRadius * 0.028, Math.min(length * 0.045, pipeRadius * 0.10));
  const raisedFaceThickness = clamp(pipeRadius * spec.profile.raisedFaceThicknessFactor, pipeRadius * 0.004, Math.min(flangeThickness * 0.14, length * 0.012));
  const gasketThickness = clamp(pipeRadius * 0.018, pipeRadius * 0.006, Math.min(flangeThickness * 0.22, length * 0.018));
  const plateRadius = pipeRadius * spec.profile.flangeDiameterFactor;
  const raisedFaceRadius = pipeRadius * spec.profile.raisedFaceDiameterFactor;
  const neckOuterRadius = Math.max(pipeRadius * positiveNumber(spec.profile.neckDiameterFactor, 1.08), pipeRadius * 1.06);
  return { flangeThickness, raisedFaceThickness, gasketThickness, plateRadius, raisedFaceRadius, neckOuterRadius };
}

function buildSingleFlangePrimitivePlan(spec, length, pipeRadius, half) {
  const { flangeThickness, raisedFaceThickness, plateRadius, raisedFaceRadius, neckOuterRadius } = flangeMetrics(spec, length, pipeRadius);
  const raisedFaceAtTo = spec.flangeTopology.raisedFaceEndpoint === 'TO';
  const primitives = [];

  if (raisedFaceAtTo) {
    const raisedFaceStart = half - raisedFaceThickness;
    const plateStart = raisedFaceStart - flangeThickness;
    primitives.push(segmentPrimitive('WELD_NECK_PIPE_SIDE', 'disc', -half, plateStart, {
      radius: neckOuterRadius,
      innerRadius: pipeRadius * 1.02,
      outerRadius: neckOuterRadius,
      radiusStart: pipeRadius * 1.02,
      radiusEnd: neckOuterRadius,
      replacesCenterlinePipe: true,
      proportionalShoulder: true,
      singleFlangePipeSide: 'FROM'
    }));
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
    primitives.push(segmentPrimitive('WELD_NECK_PIPE_SIDE', 'disc', plateEnd, half, {
      radius: neckOuterRadius,
      innerRadius: pipeRadius * 1.02,
      outerRadius: neckOuterRadius,
      radiusStart: neckOuterRadius,
      radiusEnd: pipeRadius * 1.02,
      replacesCenterlinePipe: true,
      proportionalShoulder: true,
      singleFlangePipeSide: 'TO'
    }));
  }

  primitives.push({
    role: 'BOLT_PATTERN',
    kind: 'bolt-pattern',
    boltCount: spec.profile.boltCount,
    boltCircleRadius: pipeRadius * spec.profile.boltCircleFactor,
    boltRadius: pipeRadius * spec.profile.boltDiameterFactor,
    flangeRoles: ['FLANGE_PLATE']
  });
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
    radius: neckOuterRadius,
    innerRadius: pipeRadius * 1.02,
    outerRadius: neckOuterRadius,
    radiusStart: pipeRadius * 1.02,
    radiusEnd: neckOuterRadius,
    replacesCenterlinePipe: true,
    continuityFiller: true,
    proportionalShoulder: true,
    weldNeckPlacement: 'inside-component-before-left-plate'
  }));
  primitives.push(segmentPrimitive('FLANGE_DISC_A', 'disc', leftPlateStart, leftPlateEnd, {
    radius: plateRadius,
    replacesCenterlinePipe: true,
    proportionalFlangeThickness: true,
    thinPlate: true
  }));
  primitives.push(segmentPrimitive('FLANGE_CENTER_BORE_FILL', 'disc', innerLeft, innerRight, {
    radius: pipeRadius * 0.46,
    replacesCenterlinePipe: true,
    continuityFiller: true,
    visibleBoreFill: true,
    subtleCenterFill: true
  }));
  primitives.push(segmentPrimitive('GASKET_CENTER', 'disc', innerLeft, innerRight, {
    radius: pipeRadius * 1.08,
    replacesCenterlinePipe: false,
    overlayOnly: true,
    subtleGasket: true,
    visualMaterial: 'gasket'
  }));
  primitives.push(segmentPrimitive('FLANGE_DISC_B', 'disc', rightPlateStart, rightPlateEnd, {
    radius: plateRadius,
    replacesCenterlinePipe: true,
    proportionalFlangeThickness: true,
    thinPlate: true
  }));
  primitives.push(segmentPrimitive('WELD_NECK_B', 'disc', rightPlateEnd, half, {
    radius: neckOuterRadius,
    innerRadius: pipeRadius * 1.02,
    outerRadius: neckOuterRadius,
    radiusStart: neckOuterRadius,
    radiusEnd: pipeRadius * 1.02,
    replacesCenterlinePipe: true,
    continuityFiller: true,
    proportionalShoulder: true,
    weldNeckPlacement: 'inside-component-after-right-plate'
  }));
  primitives.push(segmentPrimitive('RAISED_FACE_A', 'disc', innerLeft - raisedFaceThickness, innerLeft, {
    radius: raisedFaceRadius,
    replacesCenterlinePipe: false,
    overlayOnly: true,
    thinRaisedFace: true,
    visualMaterial: 'raised-face'
  }));
  primitives.push(segmentPrimitive('RAISED_FACE_B', 'disc', innerRight, innerRight + raisedFaceThickness, {
    radius: raisedFaceRadius,
    replacesCenterlinePipe: false,
    overlayOnly: true,
    thinRaisedFace: true,
    visualMaterial: 'raised-face'
  }));
  primitives.push({
    role: 'BOLT_PATTERN',
    kind: 'bolt-pattern',
    boltCount: spec.profile.boltCount,
    boltCircleRadius: pipeRadius * spec.profile.boltCircleFactor,
    boltRadius: pipeRadius * spec.profile.boltDiameterFactor,
    flangeRoles: ['FLANGE_DISC_A', 'FLANGE_DISC_B']
  });
  if (spec.profile.blindCap) {
    primitives.push(segmentPrimitive('BLIND_CAP', 'cap', -gasketThickness / 2, gasketThickness / 2, {
      radius: pipeRadius * spec.profile.raisedFaceDiameterFactor,
      replacesCenterlinePipe: false,
      overlayOnly: true
    }));
  }
  return primitives;
}

function buildValvePrimitivePlan(spec, length, pipeRadius, half) {
  const collarLength = clamp(length * spec.profile.endCollarLengthFactor, pipeRadius * 0.035, Math.min(length * 0.045, pipeRadius * 0.12));
  const bodyRadius = pipeRadius * spec.profile.bodyDiameterFactor;
  const collarRadius = pipeRadius * spec.profile.endCollarDiameterFactor;
  const innerLength = Math.max(length - collarLength * 2, pipeRadius * 0.2);
  const bodyLength = clamp(length * spec.profile.bodyLengthFactor, pipeRadius * 0.95, Math.max(pipeRadius * 1.05, innerLength * 0.74));
  const bodyHalf = Math.min(bodyLength / 2, half - collarLength);
  const shoulderOuterRadius = Math.max(pipeRadius * 1.28, Math.min(bodyRadius * 0.82, collarRadius * 0.76));
  const boreFillRadius = pipeRadius * 0.44;
  const leftCollarEnd = -half + collarLength;
  const rightCollarStart = half - collarLength;
  const primitives = [];

  primitives.push(segmentPrimitive('VALVE_BORE_FILL', 'disc', -half, half, {
    radius: boreFillRadius,
    replacesCenterlinePipe: true,
    continuityFiller: true,
    hiddenBoreFill: true
  }));
  primitives.push(segmentPrimitive('END_COLLAR_A', 'disc', -half, leftCollarEnd, {
    radius: collarRadius,
    replacesCenterlinePipe: true,
    proportionalFlangeThickness: true,
    thinPlate: true
  }));
  addValveShoulderPrimitive(primitives, 'VALVE_NECK_A', leftCollarEnd, -bodyHalf, pipeRadius * 1.02, shoulderOuterRadius);
  primitives.push(segmentPrimitive('VALVE_BODY', spec.profile.bodyShape, -bodyHalf, bodyHalf, {
    radius: bodyRadius,
    envelopeHalfLength: bodyHalf,
    replacesCenterlinePipe: true,
    bodyVisual: 'compact-rounded-body'
  }));
  addValveShoulderPrimitive(primitives, 'VALVE_NECK_B', bodyHalf, rightCollarStart, shoulderOuterRadius, pipeRadius * 1.02);
  primitives.push(segmentPrimitive('END_COLLAR_B', 'disc', rightCollarStart, half, {
    radius: collarRadius,
    replacesCenterlinePipe: true,
    proportionalFlangeThickness: true,
    thinPlate: true
  }));
  if (spec.profile.bonnetHeightFactor > 0) primitives.push({ role: 'BONNET_STEM', kind: 'stem', radialOffset: bodyRadius * 0.62, length: pipeRadius * spec.profile.bonnetHeightFactor });
  if (spec.profile.handleStyle === 'handwheel') primitives.push({ role: 'HANDWHEEL', kind: 'torus', radius: pipeRadius * spec.profile.handwheelRadiusFactor, visualWeight: 'readable-operator' });
  if (spec.profile.handleStyle === 'lever') primitives.push({ role: 'LEVER_HANDLE', kind: 'lever', length: pipeRadius * 2.35 });
  if (spec.profile.handleStyle === 'flow-arrow') primitives.push({ role: 'FLOW_ARROW', kind: 'arrow', length: bodyLength * 0.72 });
  if (spec.profile.handleStyle === 'actuator') primitives.push({ role: 'ACTUATOR', kind: 'actuator-cylinder', radius: pipeRadius * 0.86, length: pipeRadius * 1.12 });
  return primitives;
}

export function normalizeVisualType(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function segmentPrimitive(role, kind, start, end, extra = {}) {
  const orderedStart = Math.min(start, end);
  const orderedEnd = Math.max(start, end);
  const length = Math.max(orderedEnd - orderedStart, 0);
  return {
    role,
    kind,
    localAxisStart: orderedStart,
    localAxisEnd: orderedEnd,
    axialOffset: (orderedStart + orderedEnd) / 2,
    length,
    ...extra
  };
}

function addValveShoulderPrimitive(primitives, role, start, end, radiusStart, radiusEnd) {
  const rawLength = Math.abs(end - start);
  if (rawLength <= 1e-6) return;
  primitives.push(segmentPrimitive(role, 'disc', start, end, {
    radius: Math.max(radiusStart, radiusEnd),
    innerRadius: Math.min(radiusStart, radiusEnd),
    outerRadius: Math.max(radiusStart, radiusEnd),
    radiusStart,
    radiusEnd,
    replacesCenterlinePipe: true,
    continuityFiller: true,
    proportionalShoulder: true,
    shoulderBasis: 'continuous-length-partitioned-valve-neck'
  }));
}

function buildValveSpec(type, element, props, tokens) {
  const profile = VALVE_FLANGE_VISUAL_CATALOG.valveTypes[type] || VALVE_FLANGE_VISUAL_CATALOG.valveTypes.VALVE_GENERIC;
  return buildSpec({ componentClass: 'VALVE', componentType: profile.componentType, profile, element, props, tokens });
}

function buildFlangeSpec(type, element, props, tokens) {
  const profile = VALVE_FLANGE_VISUAL_CATALOG.flangeTypes[type] || VALVE_FLANGE_VISUAL_CATALOG.flangeTypes.FLANGE_GENERIC;
  return buildSpec({ componentClass: 'FLANGE', componentType: profile.componentType, profile, element, props, tokens });
}

function buildSpec({ componentClass, componentType, profile, element, props, tokens }) {
  const bore = positiveNumber(props.bore || props.startBore || props.endBore || element.bore, 100);
  const flangeTopology = componentClass === 'FLANGE' ? {
    visualKind: props.flangeVisualKind || 'PAIR_FLANGE',
    pipeEndpoint: props.singleFlangePipeEndpoint || null,
    raisedFaceEndpoint: props.singleFlangeRaisedFaceEndpoint || null,
    fromHasValve: props.singleFlangeFromHasValve === true,
    toHasValve: props.singleFlangeToHasValve === true
  } : null;
  return {
    schemaVersion: LINEAR_COMPONENT_VISUAL_SPEC_SCHEMA,
    catalogSchemaVersion: VALVE_FLANGE_VISUAL_CATALOG_SCHEMA,
    componentClass,
    componentType,
    visualKey: flangeTopology?.visualKind === 'SINGLE_ORIENTED_FLANGE' ? 'single-oriented-flange' : profile.visualKey,
    visualRecipeId: flangeTopology?.visualKind === 'SINGLE_ORIENTED_FLANGE' ? 'single-oriented-flange-symbol.v1' : profile.visualRecipeId,
    matchedTokens: tokens,
    profile: { ...profile.profile },
    flangeTopology,
    visualPolicy: {
      replacesCenterlinePipe: true,
      pipeShouldNotPassThroughBody: true,
      proportionalFallback: true,
      continuityFillersRequired: true,
      lengthPartitionedSymbol: true,
      continuousAxialAssembly: true
    },
    dimensions: {
      bore,
      faceToFaceLength: positiveNumber(props.faceToFaceLength || props.length || props.rigidLength || element.length, null)
    }
  };
}

function candidateTypeTokens(element, props) {
  const raw = [
    element.rawType,
    element.type,
    props.rigidType,
    props.type,
    props.componentType,
    props.uxmlNormalizedType,
    props.meshRole,
    props.skey,
    props.SKEY,
    props.rawAttributes?.TYPE,
    props.rawAttributes?.COMPONENT_TYPE,
    props.rawAttributes?.RIGID_TYPE,
    props.rawAttributes?.SKEY
  ];
  const out = [];
  for (const value of raw) {
    const token = normalizeVisualType(value);
    if (token && !out.includes(token)) out.push(token);
  }
  return out;
}

function findExactMappedType(tokens, aliasMap) {
  for (const token of tokens) {
    if (aliasMap.has(token)) return aliasMap.get(token);
  }
  return null;
}

function findContainsMappedType(tokens, aliasMap, containsNeedle) {
  for (const token of tokens) {
    if (token.includes(containsNeedle)) {
      const direct = aliasMap.get(token);
      if (direct) return direct;
      if (containsNeedle === 'VALVE') return token.includes('FLANGED') ? 'VALVE_FLANGED' : 'VALVE_GENERIC';
      if (containsNeedle === 'FLANGE') return 'FLANGE_GENERIC';
    }
  }
  return null;
}

function valveEntry(componentType, visualRecipeId, visualKey, profile) {
  return { componentType, visualRecipeId, visualKey, profile };
}

function flangeEntry(componentType, visualRecipeId, visualKey, profile) {
  return { componentType, visualRecipeId, visualKey, profile };
}

function positiveNumber(value, fallback) {
  if (value && typeof value === 'object' && 'value' in value) value = value.value;
  const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return fallback;
  const n = Number(match[0]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}