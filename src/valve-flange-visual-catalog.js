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
      flangeDiameterFactor: 2.05, flangeThicknessFactor: 0.075, raisedFaceDiameterFactor: 1.32, raisedFaceThicknessFactor: 0.014, boltCircleFactor: 1.72, boltDiameterFactor: 0.055, boltCount: 8
    }),
    FLANGE_WELD_NECK: flangeEntry('FLANGE_WELD_NECK', 'flange-weld-neck-symbol.v1', 'weld-neck-flange-pair', {
      flangeDiameterFactor: 2.14, flangeThicknessFactor: 0.08, raisedFaceDiameterFactor: 1.34, raisedFaceThicknessFactor: 0.015, boltCircleFactor: 1.82, boltDiameterFactor: 0.055, boltCount: 8, neckDiameterFactor: 1.12, neckLengthFactor: 0.72
    }),
    FLANGE_BLIND: flangeEntry('FLANGE_BLIND', 'flange-blind-symbol.v1', 'blind-flange', {
      flangeDiameterFactor: 2.18, flangeThicknessFactor: 0.09, raisedFaceDiameterFactor: 1.38, raisedFaceThicknessFactor: 0.016, boltCircleFactor: 1.88, boltDiameterFactor: 0.055, boltCount: 8, blindCap: true
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
  ['FLANGE', 'FLANGE_GENERIC'], ['FLANGE_GENERIC', 'FLANGE_GENERIC'], ['PAIR_FLANGE', 'FLANGE_GENERIC'], ['FLG', 'FLANGE_GENERIC'], ['FL', 'FLANGE_GENERIC'],
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
  const primitives = [];

  if (spec.componentClass === 'FLANGE') {
    const flangeThickness = clamp(pipeRadius * spec.profile.flangeThicknessFactor, pipeRadius * 0.028, Math.min(length * 0.032, pipeRadius * 0.10));
    const raisedFaceThickness = clamp(pipeRadius * spec.profile.raisedFaceThicknessFactor, pipeRadius * 0.004, flangeThickness * 0.14);
    const seamThickness = clamp(pipeRadius * 0.006, pipeRadius * 0.003, Math.max(raisedFaceThickness * 0.45, pipeRadius * 0.004));
    const flangeOffset = Math.max(0, half - flangeThickness / 2);
    const raisedFaceOffset = Math.max(0, half - flangeThickness - raisedFaceThickness / 2);
    const seamOffset = Math.max(0, raisedFaceOffset - raisedFaceThickness / 2 - seamThickness / 2);
    const innerGap = Math.max(0, length - (flangeThickness + raisedFaceThickness + seamThickness) * 2);
    primitives.push({ role: 'FLANGE_CENTER_BORE_FILL', kind: 'disc', axialOffset: 0, radius: pipeRadius * 0.94, length: Math.max(innerGap, pipeRadius * 0.05), replacesCenterlinePipe: true, continuityFiller: true, hiddenBoreFill: true });
    primitives.push({ role: 'FLANGE_DISC_A', kind: 'disc', axialOffset: -flangeOffset, radius: pipeRadius * spec.profile.flangeDiameterFactor, length: flangeThickness, replacesCenterlinePipe: true, proportionalFlangeThickness: true, thinPlate: true });
    primitives.push({ role: 'FLANGE_DISC_B', kind: 'disc', axialOffset: flangeOffset, radius: pipeRadius * spec.profile.flangeDiameterFactor, length: flangeThickness, replacesCenterlinePipe: true, proportionalFlangeThickness: true, thinPlate: true });
    primitives.push({ role: 'RAISED_FACE_A', kind: 'disc', axialOffset: -raisedFaceOffset, radius: pipeRadius * spec.profile.raisedFaceDiameterFactor, length: raisedFaceThickness, replacesCenterlinePipe: true, thinRaisedFace: true });
    primitives.push({ role: 'RAISED_FACE_B', kind: 'disc', axialOffset: raisedFaceOffset, radius: pipeRadius * spec.profile.raisedFaceDiameterFactor, length: raisedFaceThickness, replacesCenterlinePipe: true, thinRaisedFace: true });
    primitives.push({ role: 'FLANGE_GASKET_SEAM_A', kind: 'seam-ring', axialOffset: -seamOffset, radius: pipeRadius * 1.06, length: seamThickness, darkSeam: true, subtleSeamBand: true, visualBoundary: 'raised-face-gasket' });
    primitives.push({ role: 'FLANGE_GASKET_SEAM_B', kind: 'seam-ring', axialOffset: seamOffset, radius: pipeRadius * 1.06, length: seamThickness, darkSeam: true, subtleSeamBand: true, visualBoundary: 'raised-face-gasket' });
    primitives.push({ role: 'BOLT_PATTERN', kind: 'bolt-pattern', boltCount: spec.profile.boltCount, boltCircleRadius: pipeRadius * spec.profile.boltCircleFactor, boltRadius: pipeRadius * spec.profile.boltDiameterFactor });
    if (spec.profile.neckLengthFactor) {
      const neckLength = Math.min(length * 0.18, pipeRadius * spec.profile.neckLengthFactor * 2);
      const neckOuterRadius = Math.max(pipeRadius * spec.profile.neckDiameterFactor, pipeRadius * 1.06);
      const neckCenterOffset = flangeOffset + flangeThickness / 2 + neckLength / 2;
      primitives.push({ role: 'WELD_NECK_A', kind: 'disc', axialOffset: -neckCenterOffset, radius: neckOuterRadius, innerRadius: pipeRadius * 1.02, outerRadius: neckOuterRadius, length: neckLength, replacesCenterlinePipe: true, continuityFiller: true, proportionalShoulder: true, weldNeckPlacement: 'outside-flange-plate' });
      primitives.push({ role: 'WELD_NECK_B', kind: 'disc', axialOffset: neckCenterOffset, radius: neckOuterRadius, innerRadius: pipeRadius * 1.02, outerRadius: neckOuterRadius, length: neckLength, replacesCenterlinePipe: true, continuityFiller: true, proportionalShoulder: true, weldNeckPlacement: 'outside-flange-plate' });
    }
    if (spec.profile.blindCap) primitives.push({ role: 'BLIND_CAP', kind: 'cap', axialOffset: 0, radius: pipeRadius * spec.profile.raisedFaceDiameterFactor, length: Math.min(length * 0.075, pipeRadius * 0.18), replacesCenterlinePipe: true });
    return primitives;
  }

  if (spec.componentClass === 'VALVE') {
    const collarLength = clamp(length * spec.profile.endCollarLengthFactor, pipeRadius * 0.035, Math.min(length * 0.045, pipeRadius * 0.12));
    const bodyRadius = pipeRadius * spec.profile.bodyDiameterFactor;
    const collarRadius = pipeRadius * spec.profile.endCollarDiameterFactor;
    const bodyEnvelopeTarget = Math.max(
      length * spec.profile.bodyLengthFactor / 2,
      Math.min(bodyRadius * 0.96, half - collarLength - pipeRadius * 0.22)
    );
    const bodyEnvelopeHalf = clamp(bodyEnvelopeTarget, pipeRadius * 0.62, Math.max(pipeRadius * 0.82, half - collarLength - pipeRadius * 0.08));
    const bodyLength = bodyEnvelopeHalf * 2;
    const collarOffset = Math.max(0, half - collarLength / 2);
    const leftInnerFace = -half + collarLength;
    const rightInnerFace = half - collarLength;
    const shoulderOverlap = Math.max(pipeRadius * 0.055, length * 0.010);
    const boreFillRadius = pipeRadius * 0.44;
    const shoulderOuterRadius = Math.max(pipeRadius * 1.28, Math.min(bodyRadius * 0.82, collarRadius * 0.76));
    const valveSeamThickness = clamp(pipeRadius * 0.006, pipeRadius * 0.003, Math.max(collarLength * 0.12, pipeRadius * 0.004));
    const valveSeamRadius = pipeRadius * 1.08;

    primitives.push({ role: 'VALVE_BORE_FILL', kind: 'disc', axialOffset: 0, radius: boreFillRadius, length: Math.max(length - collarLength * 2, pipeRadius * 0.18), replacesCenterlinePipe: true, continuityFiller: true, hiddenBoreFill: true });
    primitives.push({ role: 'VALVE_BODY', kind: spec.profile.bodyShape, axialOffset: 0, radius: bodyRadius, length: bodyLength, envelopeHalfLength: bodyEnvelopeHalf, replacesCenterlinePipe: true });
    addValveShoulderPrimitive(primitives, 'VALVE_NECK_A', leftInnerFace, -bodyEnvelopeHalf, -1, pipeRadius * 1.02, shoulderOuterRadius, shoulderOverlap);
    addValveShoulderPrimitive(primitives, 'VALVE_NECK_B', bodyEnvelopeHalf, rightInnerFace, 1, pipeRadius * 1.02, shoulderOuterRadius, shoulderOverlap);
    primitives.push({ role: 'END_COLLAR_A', kind: 'disc', axialOffset: -collarOffset, radius: collarRadius, length: collarLength, replacesCenterlinePipe: true, proportionalFlangeThickness: true, thinPlate: true });
    primitives.push({ role: 'END_COLLAR_B', kind: 'disc', axialOffset: collarOffset, radius: collarRadius, length: collarLength, replacesCenterlinePipe: true, proportionalFlangeThickness: true, thinPlate: true });
    primitives.push({ role: 'END_COLLAR_SEAM_A', kind: 'seam-ring', axialOffset: leftInnerFace + valveSeamThickness / 2, radius: valveSeamRadius, length: valveSeamThickness, darkSeam: true, subtleSeamBand: true, visualBoundary: 'valve-flange-neck' });
    primitives.push({ role: 'END_COLLAR_SEAM_B', kind: 'seam-ring', axialOffset: rightInnerFace - valveSeamThickness / 2, radius: valveSeamRadius, length: valveSeamThickness, darkSeam: true, subtleSeamBand: true, visualBoundary: 'valve-flange-neck' });
    if (spec.profile.bonnetHeightFactor > 0) primitives.push({ role: 'BONNET_STEM', kind: 'stem', radialOffset: bodyRadius * 0.62, length: pipeRadius * spec.profile.bonnetHeightFactor });
    if (spec.profile.handleStyle === 'handwheel') primitives.push({ role: 'HANDWHEEL', kind: 'torus', radius: pipeRadius * spec.profile.handwheelRadiusFactor, visualWeight: 'readable-operator' });
    if (spec.profile.handleStyle === 'lever') primitives.push({ role: 'LEVER_HANDLE', kind: 'lever', length: pipeRadius * 2.35 });
    if (spec.profile.handleStyle === 'flow-arrow') primitives.push({ role: 'FLOW_ARROW', kind: 'arrow', length: bodyLength * 0.72 });
    if (spec.profile.handleStyle === 'actuator') primitives.push({ role: 'ACTUATOR', kind: 'actuator-cylinder', radius: pipeRadius * 0.86, length: pipeRadius * 1.12 });
  }

  return primitives;
}

export function normalizeVisualType(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function addValveShoulderPrimitive(primitives, role, start, end, sign, innerRadius, outerRadius, overlap) {
  const rawLength = Math.abs(end - start);
  if (rawLength <= overlap * 0.35) return;
  const length = rawLength + overlap * 2;
  const center = (start + end) / 2 + sign * overlap * 0.08;
  primitives.push({
    role,
    kind: 'disc',
    axialOffset: center,
    radius: outerRadius,
    length,
    innerRadius,
    outerRadius,
    replacesCenterlinePipe: true,
    continuityFiller: true,
    proportionalShoulder: true,
    shoulderBasis: 'length-partitioned-valve-neck'
  });
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
  return {
    schemaVersion: LINEAR_COMPONENT_VISUAL_SPEC_SCHEMA,
    catalogSchemaVersion: VALVE_FLANGE_VISUAL_CATALOG_SCHEMA,
    componentClass,
    componentType,
    visualKey: profile.visualKey,
    visualRecipeId: profile.visualRecipeId,
    matchedTokens: tokens,
    profile: { ...profile.profile },
    visualPolicy: {
      replacesCenterlinePipe: true,
      pipeShouldNotPassThroughBody: true,
      proportionalFallback: true,
      continuityFillersRequired: true,
      lengthPartitionedSymbol: true
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
