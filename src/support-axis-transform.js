export const SUPPORT_AXIS_TRANSFORM_SCHEMA = 'SupportAxisTransform.v1';

const DEFAULT_AXIS_BASIS = Object.freeze({
  schema: 'ManagedStageSupportAxisBasis.v1',
  name: 'CAESAR default axis basis',
  axes: Object.freeze({
    '+Y': Object.freeze({ engineeringDirection: 'UP', canvasAxis: '+Y' }),
    '-Y': Object.freeze({ engineeringDirection: 'DOWN', canvasAxis: '-Y' }),
    '-X': Object.freeze({ engineeringDirection: 'NORTH', canvasAxis: '-X' }),
    '+X': Object.freeze({ engineeringDirection: 'SOUTH', canvasAxis: '+X' }),
    '+Z': Object.freeze({ engineeringDirection: 'PROJECT_POSITIVE_Z', canvasAxis: '+Z' }),
    '-Z': Object.freeze({ engineeringDirection: 'PROJECT_NEGATIVE_Z', canvasAxis: '-Z' })
  })
});

/**
 * Normalizes stagedJson support axes into one canonical canvas-space contract.
 * Parameters: raw/source axis text, optional mapper basis, optional resolved canvas axis, and pipe axis fallback.
 * Output: SupportAxisTransform.v1 with source/canvas signed axes, vector, sign, basis, and diagnostics.
 * Fallback: missing support axes use the signed pipe axis when available, then +X with a diagnostic.
 */
export function resolveSupportAxisTransform(input) {
  const options = input && typeof input === 'object' ? input : {};
  const diagnostics = [];
  const basis = mergeAxisBasis(DEFAULT_AXIS_BASIS, options.axisBasis || options.basis || {});
  const rawSourceAxis = options.sourceAxis || options.rawAxis || options.axis || '';
  const explicitCanvasAxis = normalizeSupportAxisToken(options.canvasAxis || '');
  const sourceAxis = normalizeSupportAxisToken(rawSourceAxis, options.sign || options.sourceSign || '');
  let canvasAxis = explicitCanvasAxis;
  let axisTransformApplied = false;

  if (!canvasAxis && sourceAxis) {
    const entry = basis.axes[sourceAxis] || {};
    canvasAxis = normalizeSupportAxisToken(entry.canvasAxis || sourceAxis);
    axisTransformApplied = Boolean(canvasAxis && canvasAxis !== sourceAxis);
  }

  if (explicitCanvasAxis && sourceAxis && explicitCanvasAxis !== sourceAxis) {
    axisTransformApplied = true;
  }

  const pipeFallback = normalizePipeAxis(options.pipeAxis || '');
  if (!canvasAxis && pipeFallback) {
    canvasAxis = pipeFallback;
    diagnostics.push(axisDiagnostic('pipe-axis-fallback', 'warning', 'Support axis was missing; pipe axis fallback was used.'));
  }

  if (!canvasAxis) {
    canvasAxis = '+X';
    diagnostics.push(axisDiagnostic('default-axis-fallback', 'warning', 'Support axis and pipe axis were missing; +X fallback was used.'));
  }

  if (rawSourceAxis && !sourceAxis) {
    diagnostics.push(axisDiagnostic('unparsed-source-axis', 'warning', `Support axis could not be parsed: ${String(rawSourceAxis)}`));
  }

  const vector = supportAxisVector(canvasAxis);
  return {
    schema: SUPPORT_AXIS_TRANSFORM_SCHEMA,
    sourceAxis,
    canvasAxis,
    axisVector: vector,
    sign: canvasAxis.startsWith('-') ? '-' : '+',
    basisPreset: options.basisPreset || options.mapperPresetId || basis.name || '',
    axisTransformApplied,
    diagnostics
  };
}

export function normalizeSupportAxisToken(axisToken, signToken) {
  const text = String(axisToken || '').trim().toUpperCase();
  const signText = String(signToken || '').trim().toUpperCase();
  if (!text) return '';
  const signMatch = text.match(/(?:^|[^A-Z0-9])([+-])\s*([XYZ])(?:[^A-Z0-9]|$)/);
  if (signMatch) return `${signMatch[1]}${signMatch[2]}`;
  const axisMatch = text.match(/(?:^|[^A-Z0-9])([XYZ])(?:[^A-Z0-9]|$)|^([XYZ])$/);
  if (!axisMatch) return '';
  const axis = axisMatch[1] || axisMatch[2];
  if (/^-|MINUS|NEGATIVE|NEG|DOWN|WEST|NORTH/i.test(signText)) return `-${axis}`;
  if (/^\+|PLUS|POSITIVE|POS|UP|EAST|SOUTH/i.test(signText)) return `+${axis}`;
  if (/^-|MINUS|NEGATIVE|DOWN|WEST|NORTH/i.test(text)) return `-${axis}`;
  return `+${axis}`;
}

export function supportAxisVector(axisToken) {
  const axis = normalizeSupportAxisToken(axisToken) || '+X';
  const sign = axis.startsWith('-') ? -1 : 1;
  const dim = axis.replace(/[+-]/g, '');
  if (dim === 'Y') return { x: 0, y: sign, z: 0 };
  if (dim === 'Z') return { x: 0, y: 0, z: sign };
  return { x: sign, y: 0, z: 0 };
}

export function invertSupportAxis(axisToken) {
  const axis = normalizeSupportAxisToken(axisToken) || '+X';
  return `${axis.startsWith('-') ? '+' : '-'}${axis.replace(/[+-]/g, '')}`;
}

function normalizePipeAxis(pipeAxis) {
  const axis = normalizeSupportAxisToken(pipeAxis);
  if (axis) return axis;
  const text = String(pipeAxis || '').trim().toUpperCase();
  if (text === 'X' || text === 'Y' || text === 'Z') return `+${text}`;
  return '';
}

function mergeAxisBasis(base, override) {
  const axes = { ...(base.axes || {}) };
  for (const [key, value] of Object.entries(override.axes || {})) {
    const normalizedKey = normalizeSupportAxisToken(key);
    if (!normalizedKey) continue;
    axes[normalizedKey] = { ...(axes[normalizedKey] || {}), ...(value || {}) };
  }
  return {
    schema: override.schema || base.schema,
    name: override.name || base.name,
    description: override.description || base.description || '',
    axes
  };
}

function axisDiagnostic(code, severity, message) {
  return { code, severity, message };
}
