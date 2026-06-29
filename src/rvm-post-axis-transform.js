export const RVM_POST_AXIS_TRANSFORM_SCHEMA = 'RvmPostAxisTransform.v1';

export const RVM_POST_AXIS_TRANSFORM_PRESETS = Object.freeze({
  off: Object.freeze({
    id: 'off',
    label: 'Off - no post-RVM geometry transform',
    enabled: false,
    matrix: Object.freeze([[1, 0, 0], [0, 1, 0], [0, 0, 1]]),
    description: 'Do not transform the generated RVM export model.'
  }),
  navisObservedWnt: Object.freeze({
    id: 'navisObservedWnt',
    label: 'Navis observed W/N/Top basis',
    enabled: true,
    matrix: Object.freeze([[-1, 0, 0], [0, 1, 0], [0, 0, 1]]),
    description: 'Post-RVM transform using observed relationship: Navis W = Canvas -X, Navis N = Canvas +Y, Navis Top = Canvas +Z. Matrix: [xPrime,yPrime,zPrime]=[-x,y,z].',
    observedMapping: Object.freeze({ navisN: 'canvas +Y', navisTop: 'canvas +Z', navisW: 'canvas -X' })
  }),
  canvasEngineeringToNavis: Object.freeze({
    id: 'canvasEngineeringToNavis',
    label: 'Canvas engineering axes to Navis N/Top/W',
    enabled: true,
    matrix: Object.freeze([[0, 0, 1], [-1, 0, 0], [0, 1, 0]]),
    description: 'Alternative full-basis reorientation: Canvas North -X -> Navis +Y, Canvas Vertical +Y -> Navis +Z, Canvas +Z -> Navis +X. Matrix: [xPrime,yPrime,zPrime]=[z,-x,y].',
    observedMapping: Object.freeze({ canvasNorth: '-X -> Navis +Y', canvasVertical: '+Y -> Navis +Z', canvasZ: '+Z -> Navis +X' })
  })
});

export const DEFAULT_RVM_POST_AXIS_TRANSFORM_CONFIG = Object.freeze({
  schema: RVM_POST_AXIS_TRANSFORM_SCHEMA,
  enabled: true,
  presetId: 'navisObservedWnt',
  applyStage: 'post-export-model-pre-writeRvm',
  transformScope: 'entire-export-model-with-supports'
});

export function resolveRvmPostAxisTransformConfig(options = {}, runtime = globalThis) {
  const explicit = options.postRvmAxisTransform || options.rvmPostAxisTransform || null;
  const globalConfig = runtime?.__3D_MARKUP_RVM_POST_AXIS_TRANSFORM_CONFIG__ || null;
  const stored = readStoredConfig(runtime);
  const merged = {
    ...DEFAULT_RVM_POST_AXIS_TRANSFORM_CONFIG,
    ...(stored || {}),
    ...(globalConfig || {}),
    ...(explicit || {})
  };
  const preset = RVM_POST_AXIS_TRANSFORM_PRESETS[merged.presetId] || RVM_POST_AXIS_TRANSFORM_PRESETS.navisObservedWnt;
  return {
    ...merged,
    enabled: merged.enabled !== false && preset.enabled !== false,
    presetId: preset.id,
    presetLabel: preset.label,
    description: preset.description,
    observedMapping: preset.observedMapping || {},
    matrix: normalizeMatrix(merged.matrix || preset.matrix || RVM_POST_AXIS_TRANSFORM_PRESETS.off.matrix),
    schema: RVM_POST_AXIS_TRANSFORM_SCHEMA
  };
}

export function applyRvmPostAxisTransform(exportModel, configInput = {}) {
  const config = resolveRvmPostAxisTransformConfig(configInput);
  if (!config.enabled) {
    return {
      exportModel,
      audit: buildAudit(config, { transformed: false, nodeCount: 0, primitiveCount: 0, sampleRows: [] })
    };
  }
  const stats = { nodeCount: 0, primitiveCount: 0, sampleRows: [] };
  const transformedRoot = transformNode(exportModel.root, config, stats, '/');
  const transformedModel = {
    ...exportModel,
    root: transformedRoot,
    audit: {
      ...(exportModel.audit || {}),
      postRvmAxisTransform: buildAudit(config, { transformed: true, ...stats })
    }
  };
  return {
    exportModel: transformedModel,
    audit: transformedModel.audit.postRvmAxisTransform
  };
}

export function transformPoint(point, configOrMatrix) {
  if (!Array.isArray(point) || point.length !== 3) return point;
  const matrix = Array.isArray(configOrMatrix?.matrix) ? configOrMatrix.matrix : normalizeMatrix(configOrMatrix);
  const x = Number(point[0]);
  const y = Number(point[1]);
  const z = Number(point[2]);
  if (![x, y, z].every(Number.isFinite)) return point;
  return [
    clean(matrix[0][0] * x + matrix[0][1] * y + matrix[0][2] * z),
    clean(matrix[1][0] * x + matrix[1][1] * y + matrix[1][2] * z),
    clean(matrix[2][0] * x + matrix[2][1] * y + matrix[2][2] * z)
  ];
}

export function transformVector(vector, configOrMatrix) {
  return transformPoint(vector, configOrMatrix);
}

export function matrixSummary(matrix) {
  const normalized = normalizeMatrix(matrix);
  const expr = ['x', 'y', 'z'].map((_, row) => rowExpression(normalized[row])).join(', ');
  return `[xPrime,yPrime,zPrime]=[${expr}]`;
}

function transformNode(node, config, stats, path) {
  if (!node || typeof node !== 'object') return node;
  stats.nodeCount += 1;
  const nextPath = `${path}/${node.reviewName || node.name || 'node'}`;
  const position = transformPointIfPresent(node.position, config);
  const primitives = (node.primitives || []).map((primitive) => transformPrimitive(primitive, config, stats, nextPath));
  const children = (node.children || []).map((child) => transformNode(child, config, stats, nextPath));
  const attributes = transformAttributes(node.attributes, config);
  if (stats.sampleRows.length < 8 && Array.isArray(node.position)) {
    stats.sampleRows.push({ type: 'node', name: node.reviewName || node.name || '', before: node.position, after: position });
  }
  return {
    ...node,
    position,
    attributes,
    primitives,
    children,
    postRvmAxisTransformApplied: true,
    postRvmAxisTransformSchema: RVM_POST_AXIS_TRANSFORM_SCHEMA,
    postRvmAxisTransformPreset: config.presetId
  };
}

function transformPrimitive(primitive, config, stats, path) {
  if (!primitive || typeof primitive !== 'object') return primitive;
  stats.primitiveCount += 1;
  const out = { ...primitive };
  const beforeCenter = Array.isArray(primitive.center) ? primitive.center : null;
  for (const key of ['center', 'startMm', 'endMm', 'parentStartMm', 'parentEndMm', 'startTangent', 'endTangent', 'direction']) {
    if (Array.isArray(out[key]) && out[key].length === 3) out[key] = transformPoint(out[key], config);
  }
  if (primitive.basis && typeof primitive.basis === 'object') {
    out.basis = {
      x: transformVector(primitive.basis.x, config),
      y: transformVector(primitive.basis.y, config),
      z: transformVector(primitive.basis.z, config)
    };
  }
  out.attributes = transformAttributes(primitive.attributes, config);
  out.postRvmAxisTransformApplied = true;
  out.postRvmAxisTransformPreset = config.presetId;
  if (stats.sampleRows.length < 8 && beforeCenter) {
    stats.sampleRows.push({ type: 'primitive', name: primitive.name || path, before: beforeCenter, after: out.center });
  }
  return out;
}

function transformAttributes(attributes, config) {
  if (!attributes || typeof attributes !== 'object') return attributes;
  return {
    ...attributes,
    RVM_POST_AXIS_TRANSFORM_APPLIED: 'YES',
    RVM_POST_AXIS_TRANSFORM_PRESET: config.presetId,
    RVM_POST_AXIS_TRANSFORM_MATRIX: matrixSummary(config.matrix),
    RVM_POST_AXIS_TRANSFORM_STAGE: config.applyStage || 'post-export-model-pre-writeRvm'
  };
}

function transformPointIfPresent(value, config) {
  return Array.isArray(value) && value.length === 3 ? transformPoint(value, config) : value;
}

function buildAudit(config, stats) {
  return {
    schema: RVM_POST_AXIS_TRANSFORM_SCHEMA,
    enabled: Boolean(config.enabled),
    transformed: Boolean(stats.transformed),
    presetId: config.presetId,
    presetLabel: config.presetLabel,
    description: config.description,
    observedMapping: config.observedMapping || {},
    matrix: config.matrix,
    matrixSummary: matrixSummary(config.matrix),
    applyStage: config.applyStage || 'post-export-model-pre-writeRvm',
    transformScope: config.transformScope || 'entire-export-model-with-supports',
    nodeCount: stats.nodeCount || 0,
    primitiveCount: stats.primitiveCount || 0,
    sampleRows: stats.sampleRows || []
  };
}

function readStoredConfig(runtime) {
  try {
    const text = runtime?.localStorage?.getItem?.('managedStage.rvmPostAxisTransform.v1');
    return text ? JSON.parse(text) : null;
  } catch (_) {
    return null;
  }
}

function normalizeMatrix(value) {
  const matrix = Array.isArray(value) ? value : RVM_POST_AXIS_TRANSFORM_PRESETS.off.matrix;
  if (!Array.isArray(matrix) || matrix.length !== 3) return RVM_POST_AXIS_TRANSFORM_PRESETS.off.matrix;
  const out = matrix.map((row) => Array.isArray(row) && row.length === 3 ? row.map(Number) : [0, 0, 0]);
  if (out.flat().some((entry) => !Number.isFinite(entry))) return RVM_POST_AXIS_TRANSFORM_PRESETS.off.matrix;
  return out;
}

function rowExpression(row) {
  const terms = [];
  const names = ['x', 'y', 'z'];
  for (let i = 0; i < 3; i += 1) {
    const value = Number(row[i] || 0);
    if (!value) continue;
    const name = names[i];
    if (value === 1) terms.push(name);
    else if (value === -1) terms.push(`-${name}`);
    else terms.push(`${value}*${name}`);
  }
  return terms.join('+').replace(/\+-/g, '-') || '0';
}

function clean(value) {
  return Math.abs(value) < 1e-9 ? 0 : value;
}
