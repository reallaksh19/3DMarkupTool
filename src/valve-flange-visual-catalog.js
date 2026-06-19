export const VALVE_FLANGE_VISUAL_CATALOG_SCHEMA = 'valve-flange-visual-catalog/v1';
export const LINEAR_COMPONENT_VISUAL_SPEC_SCHEMA = 'LinearComponentVisualSpec.v1';

// Canvas visual catalogue, not an ASME dimensional database.
// These profiles are intentionally over-readable at plant-view zoom levels:
// a valve/flange must read as the component itself, not as a small collar on a pipe.
export const VALVE_FLANGE_VISUAL_CATALOG = deepFreeze({
  schemaVersion: VALVE_FLANGE_VISUAL_CATALOG_SCHEMA,
  valveTypes: {
    VALVE_GENERIC: valveEntry('VALVE_GENERIC', 'valve-generic-symbol.v1', 'generic-valve', {
      bodyShape: 'capsule', bodyDiameterFactor: 3.0, bodyLengthFactor: 0.66, endCollarDiameterFactor: 2.18, endCollarLengthFactor: 0.14, bonnetHeightFactor: 1.45, handwheelRadiusFactor: 0.95, handleStyle: 'handwheel'
    }),
    VALVE_FLANGED: valveEntry('VALVE_FLANGED', 'valve-flanged-symbol.v1', 'flanged-valve', {
      bodyShape: 'capsule', bodyDiameterFactor: 3.2, bodyLengthFactor: 0.58, endCollarDiameterFactor: 2.85, endCollarLengthFactor: 0.18, bonnetHeightFactor: 1.55, handwheelRadiusFactor: 0.95, handleStyle: 'handwheel'
    }),
    VALVE_GATE: valveEntry('VALVE_GATE', 'valve-gate-symbol.v1', 'gate-valve', {
      bodyShape: 'wedge-body', bodyDiameterFactor: 3.25, bodyLengthFactor: 0.72, endCollarDiameterFactor: 2.28, endCollarLengthFactor: 0.14, bonnetHeightFactor: 2.15, handwheelRadiusFactor: 1.05, handleStyle: 'handwheel'
    }),
    VALVE_GLOBE: valveEntry('VALVE_GLOBE', 'valve-globe-symbol.v1', 'globe-valve', {
      bodyShape: 'round-body', bodyDiameterFactor: 3.35, bodyLengthFactor: 0.72, endCollarDiameterFactor: 2.22, endCollarLengthFactor: 0.14, bonnetHeightFactor: 1.9, handwheelRadiusFactor: 1.0, handleStyle: 'handwheel'
    }),
    VALVE_BALL: valveEntry('VALVE_BALL', 'valve-ball-symbol.v1', 'ball-valve', {
      bodyShape: 'ball-body', bodyDiameterFactor: 3.05, bodyLengthFactor: 0.62, endCollarDiameterFactor: 2.05, endCollarLengthFactor: 0.12, bonnetHeightFactor: 0.92, handwheelRadiusFactor: 0.0, handleStyle: 'lever'
    }),
    VALVE_CHECK: valveEntry('VALVE_CHECK', 'valve-check-symbol.v1', 'check-valve', {
      bodyShape: 'check-body', bodyDiameterFactor: 3.0, bodyLengthFactor: 0.72, endCollarDiameterFactor: 2.12, endCollarLengthFactor: 0.12, bonnetHeightFactor: 1.0, handwheelRadiusFactor: 0.0, handleStyle: 'flow-arrow'
    }),
    VALVE_BUTTERFLY: valveEntry('VALVE_BUTTERFLY', 'valve-butterfly-symbol.v1', 'butterfly-valve', {
      bodyShape: 'wafer-body', bodyDiameterFactor: 2.75, bodyLengthFactor: 0.44, endCollarDiameterFactor: 2.55, endCollarLengthFactor: 0.10, bonnetHeightFactor: 1.1, handwheelRadiusFactor: 0.0, handleStyle: 'lever'
    }),
    VALVE_CONTROL: valveEntry('VALVE_CONTROL', 'valve-control-symbol.v1', 'control-valve', {
      bodyShape: 'round-body', bodyDiameterFactor: 3.35, bodyLengthFactor: 0.74, endCollarDiameterFactor: 2.24, endCollarLengthFactor: 0.14, bonnetHeightFactor: 2.35, handwheelRadiusFactor: 0.0, handleStyle: 'actuator'
    })
  },
  flangeTypes: {
    FLANGE_GENERIC: flangeEntry('FLANGE_GENERIC', 'flange-pair-symbol.v1', 'flange-pair', {
      flangeDiameterFactor: 2.7, flangeThicknessFactor: 0.32, raisedFaceDiameterFactor: 1.72, raisedFaceThicknessFactor: 0.08, boltCircleFactor: 2.22, boltDiameterFactor: 0.16, boltCount: 8
    }),
    FLANGE_WELD_NECK: flangeEntry('FLANGE_WELD_NECK', 'flange-weld-neck-symbol.v1', 'weld-neck-flange-pair', {
      flangeDiameterFactor: 2.82, flangeThicknessFactor: 0.34, raisedFaceDiameterFactor: 1.78, raisedFaceThicknessFactor: 0.08, boltCircleFactor: 2.32, boltDiameterFactor: 0.16, boltCount: 8, neckDiameterFactor: 1.55, neckLengthFactor: 0.3
    }),
    FLANGE_BLIND: flangeEntry('FLANGE_BLIND', 'flange-blind-symbol.v1', 'blind-flange', {
      flangeDiameterFactor: 2.9, flangeThicknessFactor: 0.40, raisedFaceDiameterFactor: 1.86, raisedFaceThicknessFactor: 0.09, boltCircleFactor: 2.38, boltDiameterFactor: 0.16, boltCount: 8, blindCap: true
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
    const flangeThickness = clamp(pipeRadius * spec.profile.flangeThicknessFactor, length * 0.07, length * 0.24);
    const flangeOffset = Math.max(0, half - flangeThickness / 2);
    primitives.push({ role: 'FLANGE_DISC_A', kind: 'disc', axialOffset: -flangeOffset, radius: pipeRadius * spec.profile.flangeDiameterFactor, length: flangeThickness, replacesCenterlinePipe: true });
    primitives.push({ role: 'FLANGE_DISC_B', kind: 'disc', axialOffset: flangeOffset, radius: pipeRadius * spec.profile.flangeDiameterFactor, length: flangeThickness, replacesCenterlinePipe: true });
    primitives.push({ role: 'RAISED_FACE_A', kind: 'disc', axialOffset: -Math.max(0, half - flangeThickness - flangeThickness * 0.18), radius: pipeRadius * spec.profile.raisedFaceDiameterFactor, length: Math.max(flangeThickness * 0.28, length * 0.015), replacesCenterlinePipe: true });
    primitives.push({ role: 'RAISED_FACE_B', kind: 'disc', axialOffset: Math.max(0, half - flangeThickness - flangeThickness * 0.18), radius: pipeRadius * spec.profile.raisedFaceDiameterFactor, length: Math.max(flangeThickness * 0.28, length * 0.015), replacesCenterlinePipe: true });
    primitives.push({ role: 'BOLT_PATTERN', kind: 'bolt-pattern', boltCount: spec.profile.boltCount, boltCircleRadius: pipeRadius * spec.profile.boltCircleFactor, boltRadius: pipeRadius * spec.profile.boltDiameterFactor });
    if (spec.profile.neckLengthFactor) primitives.push({ role: 'WELD_NECK', kind: 'neck-pair', radius: pipeRadius * spec.profile.neckDiameterFactor, length: Math.min(length * 0.28, pipeRadius * spec.profile.neckLengthFactor * 2) });
    if (spec.profile.blindCap) primitives.push({ role: 'BLIND_CAP', kind: 'cap', axialOffset: 0, radius: pipeRadius * spec.profile.raisedFaceDiameterFactor, length: Math.min(length * 0.20, pipeRadius * 0.52), replacesCenterlinePipe: true });
    return primitives;
  }

  if (spec.componentClass === 'VALVE') {
    const bodyLength = clamp(length * spec.profile.bodyLengthFactor, pipeRadius * 2.0, length * 0.88);
    const collarLength = clamp(length * spec.profile.endCollarLengthFactor, pipeRadius * 0.5, length * 0.18);
    primitives.push({ role: 'VALVE_BODY', kind: spec.profile.bodyShape, axialOffset: 0, radius: pipeRadius * spec.profile.bodyDiameterFactor, length: bodyLength, replacesCenterlinePipe: true });
    primitives.push({ role: 'END_COLLAR_A', kind: 'disc', axialOffset: -Math.max(0, half - collarLength / 2), radius: pipeRadius * spec.profile.endCollarDiameterFactor, length: collarLength, replacesCenterlinePipe: true });
    primitives.push({ role: 'END_COLLAR_B', kind: 'disc', axialOffset: Math.max(0, half - collarLength / 2), radius: pipeRadius * spec.profile.endCollarDiameterFactor, length: collarLength, replacesCenterlinePipe: true });
    if (spec.profile.bonnetHeightFactor > 0) primitives.push({ role: 'BONNET_STEM', kind: 'stem', radialOffset: pipeRadius * spec.profile.bodyDiameterFactor * 0.62, length: pipeRadius * spec.profile.bonnetHeightFactor });
    if (spec.profile.handleStyle === 'handwheel') primitives.push({ role: 'HANDWHEEL', kind: 'torus', radius: pipeRadius * spec.profile.handwheelRadiusFactor });
    if (spec.profile.handleStyle === 'lever') primitives.push({ role: 'LEVER_HANDLE', kind: 'lever', length: pipeRadius * 3.0 });
    if (spec.profile.handleStyle === 'flow-arrow') primitives.push({ role: 'FLOW_ARROW', kind: 'arrow', length: bodyLength * 0.72 });
    if (spec.profile.handleStyle === 'actuator') primitives.push({ role: 'ACTUATOR', kind: 'actuator-cylinder', radius: pipeRadius * 1.25, length: pipeRadius * 1.25 });
  }

  return primitives;
}

export function normalizeVisualType(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
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
      proportionalFallback: true
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
