export const VALVE_FLANGE_VISUAL_CATALOG_SCHEMA = 'valve-flange-visual-catalog/v1';
export const LINEAR_COMPONENT_VISUAL_SPEC_SCHEMA = 'LinearComponentVisualSpec.v1';

export const VALVE_FLANGE_VISUAL_CATALOG = deepFreeze({
  schemaVersion: VALVE_FLANGE_VISUAL_CATALOG_SCHEMA,
  valveTypes: {
    VALVE_GENERIC: valveEntry('VALVE_GENERIC', 'valve-generic-symbol.v1', 'generic-valve', {
      bodyShape: 'capsule', bodyDiameterFactor: 2.0, bodyLengthFactor: 0.34, endCollarDiameterFactor: 1.45, endCollarLengthFactor: 0.12, bonnetHeightFactor: 1.1, handwheelRadiusFactor: 0.62, handleStyle: 'handwheel'
    }),
    VALVE_GATE: valveEntry('VALVE_GATE', 'valve-gate-symbol.v1', 'gate-valve', {
      bodyShape: 'wedge-body', bodyDiameterFactor: 2.15, bodyLengthFactor: 0.36, endCollarDiameterFactor: 1.55, endCollarLengthFactor: 0.12, bonnetHeightFactor: 1.65, handwheelRadiusFactor: 0.78, handleStyle: 'handwheel'
    }),
    VALVE_GLOBE: valveEntry('VALVE_GLOBE', 'valve-globe-symbol.v1', 'globe-valve', {
      bodyShape: 'round-body', bodyDiameterFactor: 2.35, bodyLengthFactor: 0.42, endCollarDiameterFactor: 1.5, endCollarLengthFactor: 0.12, bonnetHeightFactor: 1.42, handwheelRadiusFactor: 0.7, handleStyle: 'handwheel'
    }),
    VALVE_BALL: valveEntry('VALVE_BALL', 'valve-ball-symbol.v1', 'ball-valve', {
      bodyShape: 'ball-body', bodyDiameterFactor: 2.05, bodyLengthFactor: 0.3, endCollarDiameterFactor: 1.42, endCollarLengthFactor: 0.1, bonnetHeightFactor: 0.72, handwheelRadiusFactor: 0.0, handleStyle: 'lever'
    }),
    VALVE_CHECK: valveEntry('VALVE_CHECK', 'valve-check-symbol.v1', 'check-valve', {
      bodyShape: 'check-body', bodyDiameterFactor: 2.05, bodyLengthFactor: 0.38, endCollarDiameterFactor: 1.46, endCollarLengthFactor: 0.1, bonnetHeightFactor: 0.88, handwheelRadiusFactor: 0.0, handleStyle: 'flow-arrow'
    }),
    VALVE_BUTTERFLY: valveEntry('VALVE_BUTTERFLY', 'valve-butterfly-symbol.v1', 'butterfly-valve', {
      bodyShape: 'wafer-body', bodyDiameterFactor: 1.8, bodyLengthFactor: 0.22, endCollarDiameterFactor: 1.68, endCollarLengthFactor: 0.08, bonnetHeightFactor: 0.9, handwheelRadiusFactor: 0.0, handleStyle: 'lever'
    }),
    VALVE_CONTROL: valveEntry('VALVE_CONTROL', 'valve-control-symbol.v1', 'control-valve', {
      bodyShape: 'round-body', bodyDiameterFactor: 2.4, bodyLengthFactor: 0.44, endCollarDiameterFactor: 1.52, endCollarLengthFactor: 0.12, bonnetHeightFactor: 1.95, handwheelRadiusFactor: 0.0, handleStyle: 'actuator'
    })
  },
  flangeTypes: {
    FLANGE_GENERIC: flangeEntry('FLANGE_GENERIC', 'flange-pair-symbol.v1', 'flange-pair', {
      flangeDiameterFactor: 1.82, flangeThicknessFactor: 0.18, raisedFaceDiameterFactor: 1.22, raisedFaceThicknessFactor: 0.045, boltCircleFactor: 1.54, boltDiameterFactor: 0.12, boltCount: 8
    }),
    FLANGE_WELD_NECK: flangeEntry('FLANGE_WELD_NECK', 'flange-weld-neck-symbol.v1', 'weld-neck-flange-pair', {
      flangeDiameterFactor: 1.9, flangeThicknessFactor: 0.2, raisedFaceDiameterFactor: 1.22, raisedFaceThicknessFactor: 0.045, boltCircleFactor: 1.6, boltDiameterFactor: 0.12, boltCount: 8, neckDiameterFactor: 1.28, neckLengthFactor: 0.18
    }),
    FLANGE_BLIND: flangeEntry('FLANGE_BLIND', 'flange-blind-symbol.v1', 'blind-flange', {
      flangeDiameterFactor: 1.95, flangeThicknessFactor: 0.24, raisedFaceDiameterFactor: 1.24, raisedFaceThicknessFactor: 0.045, boltCircleFactor: 1.64, boltDiameterFactor: 0.12, boltCount: 8, blindCap: true
    })
  }
});

const VALVE_ALIAS_MAP = new Map([
  ['GATE_VALVE', 'VALVE_GATE'], ['GATEVALVE', 'VALVE_GATE'], ['VALVE_GATE', 'VALVE_GATE'], ['GATE', 'VALVE_GATE'],
  ['GLOBE_VALVE', 'VALVE_GLOBE'], ['GLOBEVALVE', 'VALVE_GLOBE'], ['VALVE_GLOBE', 'VALVE_GLOBE'], ['GLOBE', 'VALVE_GLOBE'],
  ['BALL_VALVE', 'VALVE_BALL'], ['BALLVALVE', 'VALVE_BALL'], ['VALVE_BALL', 'VALVE_BALL'], ['BALL', 'VALVE_BALL'],
  ['CHECK_VALVE', 'VALVE_CHECK'], ['CHECKVALVE', 'VALVE_CHECK'], ['NON_RETURN_VALVE', 'VALVE_CHECK'], ['NRV', 'VALVE_CHECK'], ['VALVE_CHECK', 'VALVE_CHECK'],
  ['BUTTERFLY_VALVE', 'VALVE_BUTTERFLY'], ['BUTTERFLYVALVE', 'VALVE_BUTTERFLY'], ['VALVE_BUTTERFLY', 'VALVE_BUTTERFLY'],
  ['CONTROL_VALVE', 'VALVE_CONTROL'], ['CONTROLVALVE', 'VALVE_CONTROL'], ['VALVE_CONTROL', 'VALVE_CONTROL'],
  ['VALVE', 'VALVE_GENERIC'], ['GENERIC_VALVE', 'VALVE_GENERIC'], ['VALVE_GENERIC', 'VALVE_GENERIC']
]);

const FLANGE_ALIAS_MAP = new Map([
  ['FLANGE', 'FLANGE_GENERIC'], ['FLANGE_GENERIC', 'FLANGE_GENERIC'], ['PAIR_FLANGE', 'FLANGE_GENERIC'],
  ['WELD_NECK_FLANGE', 'FLANGE_WELD_NECK'], ['WELDNECK_FLANGE', 'FLANGE_WELD_NECK'], ['WN_FLANGE', 'FLANGE_WELD_NECK'], ['FLANGE_WELD_NECK', 'FLANGE_WELD_NECK'],
  ['BLIND_FLANGE', 'FLANGE_BLIND'], ['BLINDFLANGE', 'FLANGE_BLIND'], ['FLANGE_BLIND', 'FLANGE_BLIND']
]);

export function getValveFlangeVisualSpec(element = {}) {
  const props = element.props || {};
  const tokens = candidateTypeTokens(element, props);
  const flangeType = findMappedType(tokens, FLANGE_ALIAS_MAP, 'FLANGE');
  if (flangeType) return buildFlangeSpec(flangeType, element, props, tokens);

  const valveType = findMappedType(tokens, VALVE_ALIAS_MAP, 'VALVE');
  if (valveType) return buildValveSpec(valveType, element, props, tokens);

  return null;
}

export function buildLinearVisualPrimitivePlan(spec, metrics = {}) {
  if (!spec) return [];
  const length = positiveNumber(metrics.length, positiveNumber(spec.dimensions.faceToFaceLength, 1));
  const pipeRadius = positiveNumber(metrics.pipeRadius, positiveNumber(spec.dimensions.bore, 100) / 2);
  const half = length / 2;
  const primitives = [];

  if (spec.componentClass === 'FLANGE') {
    const flangeThickness = clamp(pipeRadius * spec.profile.flangeThicknessFactor * 2, length * 0.04, length * 0.18);
    const flangeOffset = Math.max(0, half - flangeThickness / 2);
    primitives.push({ role: 'FLANGE_DISC_A', kind: 'disc', axialOffset: -flangeOffset, radius: pipeRadius * spec.profile.flangeDiameterFactor, length: flangeThickness });
    primitives.push({ role: 'FLANGE_DISC_B', kind: 'disc', axialOffset: flangeOffset, radius: pipeRadius * spec.profile.flangeDiameterFactor, length: flangeThickness });
    primitives.push({ role: 'RAISED_FACE_A', kind: 'disc', axialOffset: -Math.max(0, half - flangeThickness - flangeThickness * 0.12), radius: pipeRadius * spec.profile.raisedFaceDiameterFactor, length: Math.max(flangeThickness * 0.24, length * 0.01) });
    primitives.push({ role: 'RAISED_FACE_B', kind: 'disc', axialOffset: Math.max(0, half - flangeThickness - flangeThickness * 0.12), radius: pipeRadius * spec.profile.raisedFaceDiameterFactor, length: Math.max(flangeThickness * 0.24, length * 0.01) });
    primitives.push({ role: 'BOLT_PATTERN', kind: 'bolt-pattern', boltCount: spec.profile.boltCount, boltCircleRadius: pipeRadius * spec.profile.boltCircleFactor, boltRadius: pipeRadius * spec.profile.boltDiameterFactor });
    if (spec.profile.neckLengthFactor) primitives.push({ role: 'WELD_NECK', kind: 'neck-pair', radius: pipeRadius * spec.profile.neckDiameterFactor, length: Math.min(length * 0.22, pipeRadius * spec.profile.neckLengthFactor * 2) });
    if (spec.profile.blindCap) primitives.push({ role: 'BLIND_CAP', kind: 'cap', axialOffset: 0, radius: pipeRadius * spec.profile.raisedFaceDiameterFactor, length: Math.min(length * 0.16, pipeRadius * 0.35) });
    return primitives;
  }

  if (spec.componentClass === 'VALVE') {
    const bodyLength = clamp(length * spec.profile.bodyLengthFactor, pipeRadius * 1.15, length * 0.68);
    const collarLength = clamp(length * spec.profile.endCollarLengthFactor, pipeRadius * 0.38, length * 0.18);
    primitives.push({ role: 'VALVE_BODY', kind: spec.profile.bodyShape, axialOffset: 0, radius: pipeRadius * spec.profile.bodyDiameterFactor, length: bodyLength });
    primitives.push({ role: 'END_COLLAR_A', kind: 'disc', axialOffset: -Math.max(0, half - collarLength / 2), radius: pipeRadius * spec.profile.endCollarDiameterFactor, length: collarLength });
    primitives.push({ role: 'END_COLLAR_B', kind: 'disc', axialOffset: Math.max(0, half - collarLength / 2), radius: pipeRadius * spec.profile.endCollarDiameterFactor, length: collarLength });
    if (spec.profile.bonnetHeightFactor > 0) primitives.push({ role: 'BONNET_STEM', kind: 'stem', radialOffset: pipeRadius * spec.profile.bodyDiameterFactor * 0.58, length: pipeRadius * spec.profile.bonnetHeightFactor });
    if (spec.profile.handleStyle === 'handwheel') primitives.push({ role: 'HANDWHEEL', kind: 'torus', radius: pipeRadius * spec.profile.handwheelRadiusFactor });
    if (spec.profile.handleStyle === 'lever') primitives.push({ role: 'LEVER_HANDLE', kind: 'lever', length: pipeRadius * 2.2 });
    if (spec.profile.handleStyle === 'flow-arrow') primitives.push({ role: 'FLOW_ARROW', kind: 'arrow', length: bodyLength * 0.68 });
    if (spec.profile.handleStyle === 'actuator') primitives.push({ role: 'ACTUATOR', kind: 'actuator-cylinder', radius: pipeRadius * 0.9, length: pipeRadius * 0.9 });
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

function findMappedType(tokens, aliasMap, containsNeedle) {
  for (const token of tokens) {
    if (aliasMap.has(token)) return aliasMap.get(token);
  }
  for (const token of tokens) {
    if (token.includes(containsNeedle)) {
      const direct = aliasMap.get(token);
      if (direct) return direct;
      if (containsNeedle === 'VALVE') return 'VALVE_GENERIC';
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
