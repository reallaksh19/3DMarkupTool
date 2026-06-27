import { COMPONENT_CLASSES, GEOMETRY_KINDS, RESTRAINT_TYPES } from './piping-component-contract.js?v=bust-cache-4';

export const PIPING_COMPONENT_CATALOG_SCHEMA = 'piping-component-catalog/v1';

const COMPONENT_CLASS_SET = new Set(COMPONENT_CLASSES);
const GEOMETRY_KIND_SET = new Set(GEOMETRY_KINDS);
const RESTRAINT_TYPE_SET = new Set(RESTRAINT_TYPES);

export const RENDER_RECIPE_CATALOG = deepFreeze({
  schemaVersion: 'RenderRecipe.v1',
  recipes: {
    'pipe-cylinder-between-nodes.v1': recipe('pipe-cylinder-between-nodes.v1', 'PIPE', 'CYLINDER_BETWEEN_NODES', ['VIEWER', 'GLB', 'RVM_ATT']),
    'elbow-sweep.v1': recipe('elbow-sweep.v1', 'ELBOW', 'ELBOW_SWEEP', ['VIEWER', 'GLB', 'RVM_ATT']),
    'bend-sweep.v1': recipe('bend-sweep.v1', 'BEND', 'ELBOW_SWEEP', ['VIEWER', 'GLB', 'RVM_ATT']),
    'tee-composite.v1': recipe('tee-composite.v1', 'TEE', 'TEE_COMPOSITE', ['VIEWER', 'GLB', 'RVM_ATT']),
    'valve-symbolic.v1': recipe('valve-symbolic.v1', 'VALVE', 'VALVE_SYMBOLIC', ['VIEWER', 'GLB', 'RVM_ATT']),
    'flange-pair.v1': recipe('flange-pair.v1', 'FLANGE', 'FLANGE_PAIR', ['VIEWER', 'GLB', 'RVM_ATT']),
    'reducer-transition.v1': recipe('reducer-transition.v1', 'REDUCER', 'REDUCER_TRANSITION', ['VIEWER', 'GLB', 'RVM_ATT']),
    'restraint-symbol.v1': recipe('restraint-symbol.v1', 'RESTRAINT', 'RESTRAINT_SYMBOL', ['VIEWER', 'GLB', 'RVM_ATT']),
    'support-symbol.v1': recipe('support-symbol.v1', 'SUPPORT', 'RESTRAINT_SYMBOL', ['VIEWER', 'GLB', 'RVM_ATT']),
    'unknown-placeholder.v1': recipe('unknown-placeholder.v1', 'UNKNOWN', 'UNKNOWN_PLACEHOLDER', ['VIEWER', 'GLB', 'RVM_ATT']),
    'fallback-legacy.v1': recipe('fallback-legacy.v1', 'UNKNOWN', 'FALLBACK_LEGACY', ['VIEWER', 'GLB', 'RVM_ATT'], { fallbackOnly: true })
  }
});

export const PIPING_COMPONENT_CATALOG = deepFreeze({
  schema: PIPING_COMPONENT_CATALOG_SCHEMA,
  entries: {
    pipe: entry({ key: 'pipe', componentClass: 'PIPE', componentType: 'PIPE', geometryKind: 'CYLINDER_BETWEEN_NODES', renderRecipeId: 'pipe-cylinder-between-nodes.v1', requiredTopology: ['fromNode', 'toNode'], requiredDimensions: ['outerDiameter'] }),
    elbow: entry({ key: 'elbow', componentClass: 'ELBOW', componentType: 'ELBOW', geometryKind: 'ELBOW_SWEEP', renderRecipeId: 'elbow-sweep.v1', requiredTopology: ['ports[2]'], requiredDimensions: ['radius', 'angleDeg'] }),
    bend: entry({ key: 'bend', componentClass: 'BEND', componentType: 'BEND', geometryKind: 'ELBOW_SWEEP', renderRecipeId: 'bend-sweep.v1', requiredTopology: ['ports[2]'], requiredDimensions: ['radius', 'angleDeg'] }),
    tee: entry({ key: 'tee', componentClass: 'TEE', componentType: 'TEE', geometryKind: 'TEE_COMPOSITE', renderRecipeId: 'tee-composite.v1', requiredTopology: ['ports[3]'], requiredDimensions: ['mainDiameter', 'branchDiameter'] }),
    valve: entry({ key: 'valve', componentClass: 'VALVE', componentType: 'VALVE_GENERIC', geometryKind: 'VALVE_SYMBOLIC', renderRecipeId: 'valve-symbolic.v1', requiredTopology: ['fromNode', 'toNode'], requiredDimensions: ['faceToFaceLength'] }),
    flange: entry({ key: 'flange', componentClass: 'FLANGE', componentType: 'FLANGE_GENERIC', geometryKind: 'FLANGE_PAIR', renderRecipeId: 'flange-pair.v1', requiredTopology: ['fromNode', 'toNode'], requiredDimensions: ['outerDiameter', 'thickness'] }),
    reducer: entry({ key: 'reducer', componentClass: 'REDUCER', componentType: 'REDUCER_GENERIC', geometryKind: 'REDUCER_TRANSITION', renderRecipeId: 'reducer-transition.v1', requiredTopology: ['fromNode', 'toNode'], requiredDimensions: ['largeDiameter', 'smallDiameter'] }),
    support: entry({ key: 'support', componentClass: 'SUPPORT', componentType: 'UNKNOWN_RESTRAINT', geometryKind: 'RESTRAINT_SYMBOL', renderRecipeId: 'support-symbol.v1', requiredTopology: ['supportNode'], requiredDimensions: ['symbolScale'] }),
    restraint: entry({ key: 'restraint', componentClass: 'RESTRAINT', componentType: 'UNKNOWN_RESTRAINT', geometryKind: 'RESTRAINT_SYMBOL', renderRecipeId: 'restraint-symbol.v1', requiredTopology: ['supportNode'], requiredDimensions: ['symbolScale'] }),
    unknown: entry({ key: 'unknown', componentClass: 'UNKNOWN', componentType: 'UNKNOWN_COMPONENT', geometryKind: 'UNKNOWN_PLACEHOLDER', renderRecipeId: 'unknown-placeholder.v1', requiredTopology: [], requiredDimensions: ['size'] })
  }
});

export const INPUTXML_ELEMENT_TYPE_MAP = deepFreeze({
  PIPE: { componentClass: 'PIPE', componentType: 'PIPE', catalogKey: 'pipe' },
  BEND: { componentClass: 'BEND', componentType: 'BEND', catalogKey: 'bend' },
  ELBOW: { componentClass: 'ELBOW', componentType: 'ELBOW', catalogKey: 'elbow' },
  TEE: { componentClass: 'TEE', componentType: 'TEE', catalogKey: 'tee' },
  VALVE: { componentClass: 'VALVE', componentType: 'VALVE_GENERIC', catalogKey: 'valve' },
  GATE_VALVE: { componentClass: 'VALVE', componentType: 'VALVE_GATE', catalogKey: 'valve' },
  GLOBE_VALVE: { componentClass: 'VALVE', componentType: 'VALVE_GLOBE', catalogKey: 'valve' },
  BALL_VALVE: { componentClass: 'VALVE', componentType: 'VALVE_BALL', catalogKey: 'valve' },
  CHECK_VALVE: { componentClass: 'VALVE', componentType: 'VALVE_CHECK', catalogKey: 'valve' },
  FLANGE: { componentClass: 'FLANGE', componentType: 'FLANGE_GENERIC', catalogKey: 'flange' },
  REDUCER: { componentClass: 'REDUCER', componentType: 'REDUCER_GENERIC', catalogKey: 'reducer' }
});

export const INPUTXML_RESTRAINT_TYPE_MAP = deepFreeze({
  '1': 'ANCHOR',
  '2': 'REST',
  '3': 'LINESTOP',
  '4': 'LIMIT_STOP',
  '7': 'GUIDE',
  REST: 'REST',
  RESTRAINT: 'REST',
  GUIDE: 'GUIDE',
  LINESTOP: 'LINESTOP',
  LINE_STOP: 'LINESTOP',
  'LINE STOP': 'LINESTOP',
  LIMIT: 'LIMIT_STOP',
  LIMIT_STOP: 'LIMIT_STOP',
  LIMITSTOP: 'LIMIT_STOP',
  ANCHOR: 'ANCHOR',
  HANGER: 'HANGER',
  SPRING: 'SPRING',
  DIRECTIONAL_X: 'DIRECTIONAL_X',
  DIRECTIONAL_Y: 'DIRECTIONAL_Y',
  DIRECTIONAL_Z: 'DIRECTIONAL_Z'
});

export function getCatalogEntry(keyOrClass, componentType = '') {
  const key = normalizeKey(keyOrClass);
  if (PIPING_COMPONENT_CATALOG.entries[key]) return PIPING_COMPONENT_CATALOG.entries[key];

  const byClass = Object.values(PIPING_COMPONENT_CATALOG.entries).find((candidate) => candidate.componentClass === keyOrClass);
  if (byClass) return byClass;

  const type = normalizeType(componentType);
  const mapped = INPUTXML_ELEMENT_TYPE_MAP[type];
  if (mapped) return PIPING_COMPONENT_CATALOG.entries[mapped.catalogKey];

  return PIPING_COMPONENT_CATALOG.entries.unknown;
}

export function classifyInputXmlElementRecord(record = {}) {
  const raw = normalizeType(record.rawKind || record.rawType || record.type || record.componentType || record.props?.rigidType || '');
  const rigid = normalizeType(record.props?.rigidType || '');
  const candidates = [raw, rigid].filter(Boolean);

  for (const candidate of candidates) {
    const direct = INPUTXML_ELEMENT_TYPE_MAP[candidate];
    if (direct) return withCatalog(direct, candidate);
    if (candidate.includes('VALVE')) return withCatalog(INPUTXML_ELEMENT_TYPE_MAP.VALVE, candidate);
    if (candidate.includes('FLANGE')) return withCatalog(INPUTXML_ELEMENT_TYPE_MAP.FLANGE, candidate);
    if (candidate.includes('REDUCER')) return withCatalog(INPUTXML_ELEMENT_TYPE_MAP.REDUCER, candidate);
    if (candidate.includes('BEND')) return withCatalog(INPUTXML_ELEMENT_TYPE_MAP.BEND, candidate);
    if (candidate.includes('ELBOW')) return withCatalog(INPUTXML_ELEMENT_TYPE_MAP.ELBOW, candidate);
    if (candidate.includes('TEE')) return withCatalog(INPUTXML_ELEMENT_TYPE_MAP.TEE, candidate);
    if (candidate === 'PIPE') return withCatalog(INPUTXML_ELEMENT_TYPE_MAP.PIPE, candidate);
  }

  return {
    componentClass: 'UNKNOWN',
    componentType: 'UNKNOWN_COMPONENT',
    catalogKey: 'unknown',
    geometryKind: 'UNKNOWN_PLACEHOLDER',
    renderRecipeId: 'unknown-placeholder.v1',
    classifierReason: raw ? `unmapped InputXML element type: ${raw}` : 'missing InputXML element type'
  };
}

export function classifyInputXmlRestraintRecord(record = {}) {
  const raw = String(record.rawTypeCode ?? record.typeCode ?? record.rawKind ?? record.family ?? '').trim();
  const normalized = normalizeType(raw);
  const mapped = INPUTXML_RESTRAINT_TYPE_MAP[raw] || INPUTXML_RESTRAINT_TYPE_MAP[normalized];
  if (mapped && RESTRAINT_TYPE_SET.has(mapped)) {
    return {
      componentClass: 'RESTRAINT',
      componentType: mapped,
      catalogKey: 'restraint',
      geometryKind: 'RESTRAINT_SYMBOL',
      renderRecipeId: 'restraint-symbol.v1',
      classifierReason: `InputXML restraint type ${raw || '<blank>'} mapped to ${mapped}`
    };
  }

  return {
    componentClass: 'RESTRAINT',
    componentType: 'UNKNOWN_RESTRAINT',
    catalogKey: 'restraint',
    geometryKind: 'RESTRAINT_SYMBOL',
    renderRecipeId: 'restraint-symbol.v1',
    classifierReason: raw ? `unmapped InputXML restraint type: ${raw}` : 'missing InputXML restraint type'
  };
}

export function normalizeType(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

export function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function withCatalog(mapping, matchedRawType) {
  const catalog = PIPING_COMPONENT_CATALOG.entries[mapping.catalogKey] || PIPING_COMPONENT_CATALOG.entries.unknown;
  return {
    ...mapping,
    geometryKind: catalog.geometryKind,
    renderRecipeId: catalog.renderRecipeId,
    classifierReason: `InputXML element type ${matchedRawType} mapped to ${mapping.componentClass}`
  };
}

function recipe(renderRecipeId, componentClass, geometryKind, targets, options = {}) {
  if (!COMPONENT_CLASS_SET.has(componentClass)) throw new Error(`invalid componentClass in recipe ${renderRecipeId}: ${componentClass}`);
  if (!GEOMETRY_KIND_SET.has(geometryKind)) throw new Error(`invalid geometryKind in recipe ${renderRecipeId}: ${geometryKind}`);
  return {
    schemaVersion: 'RenderRecipe.v1',
    renderRecipeId,
    componentClass,
    geometryKind,
    targets,
    primitiveStrategy: geometryKind,
    fallbackOnly: Boolean(options.fallbackOnly),
    notes: options.notes || ''
  };
}

function entry(config) {
  if (!COMPONENT_CLASS_SET.has(config.componentClass)) throw new Error(`invalid catalog componentClass: ${config.componentClass}`);
  if (!GEOMETRY_KIND_SET.has(config.geometryKind)) throw new Error(`invalid catalog geometryKind: ${config.geometryKind}`);
  return {
    schemaVersion: 'PipingComponentCatalogEntry.v1',
    ...config,
    requiredTopology: config.requiredTopology || [],
    requiredDimensions: config.requiredDimensions || [],
    aliases: config.aliases || []
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
