import {
  NAVIS_TO_CANVAS_SUPPORT_AXIS_BASIS,
  resolveSemanticNavisAxisToken,
  transformNavisAxisListToCanvas,
  transformNavisSourceAxisToCanvas
} from './support-axis-basis-config.js?v=bust-cache-4';

export const SUPPORT_AXIS_TRANSFORM_SCHEMA = 'SupportAxisTransform.v4';

const DEFAULT_AXIS_BASIS = NAVIS_TO_CANVAS_SUPPORT_AXIS_BASIS;

/**
 * Normalizes stagedJson/ISONOTE support axes into one canonical canvas-space contract.
 *
 * RCA for PR #452:
 *   The previous patch stored the observed Navis/canvas relationship but did not
 *   transform already-signed XYZ rows, so existing +Y/+Z/-X rows looked unchanged.
 *
 * Corrective transform now applied:
 *   source +Y / Navis N   -> canvas -X / canvas North
 *   source +Z / Navis Top -> canvas +Z
 *   source -X / Navis W   -> canvas -Y
 *
 * Matrix: source [x,y,z] -> canvas [-y, x, z].
 */
export function resolveSupportAxisTransform(input) {
  const options = input && typeof input === 'object' ? input : {};
  const diagnostics = [];
  const basis = mergeAxisBasis(DEFAULT_AXIS_BASIS, options.axisBasis || options.basis || {});
  const applySignedAxisTransform = options.applySignedAxisTransform !== false;
  const rawSourceAxis = options.sourceAxis || options.rawAxis || options.axis || '';
  const explicitCanvasAxisSource = normalizeSupportAxisToken(options.canvasAxis || '');
  const sourceAxis = normalizeSupportAxisToken(rawSourceAxis, options.sign || options.sourceSign || '');
  const family = normalizeSupportFamily(options.supportFamily || options.family || '');
  const requestedActionAxesSource = normalizeAxisList(options.supportActionAxes || options.actionAxes || []);
  const familyActionAxesSource = requestedActionAxesSource.length ? requestedActionAxesSource : supportFamilyActionAxes(family);
  let canvasAxis = '';
  let axisTransformApplied = false;
  let fallbackReason = '';

  if (explicitCanvasAxisSource) {
    canvasAxis = applySignedAxisTransform ? transformCanvasAxis(explicitCanvasAxisSource, basis) : explicitCanvasAxisSource;
    axisTransformApplied = Boolean(applySignedAxisTransform && canvasAxis && canvasAxis !== explicitCanvasAxisSource);
  }

  if (!canvasAxis && sourceAxis) {
    const entry = basis.axes[sourceAxis] || {};
    const configuredCanvasAxis = normalizeSupportAxisToken(entry.canvasAxis || sourceAxis);
    canvasAxis = applySignedAxisTransform ? transformCanvasAxis(sourceAxis, basis) : configuredCanvasAxis;
    axisTransformApplied = Boolean(canvasAxis && canvasAxis !== sourceAxis);
  }

  if (!canvasAxis && familyActionAxesSource.length && (family === 'REST' || family === 'HOLDDOWN')) {
    const familyCanvasAxes = applySignedAxisTransform ? transformNavisAxisListToCanvas(familyActionAxesSource, basis) : familyActionAxesSource;
    canvasAxis = familyCanvasAxes[0] || '';
    fallbackReason = 'family-rule-axis';
    axisTransformApplied = Boolean(applySignedAxisTransform && canvasAxis && canvasAxis !== familyActionAxesSource[0]);
    diagnostics.push(axisDiagnostic('family-rule-axis', 'info', `${family} uses a family-rule support action axis.`));
  }

  const pipeFallbackSource = normalizePipeAxis(options.pipeAxis || '');
  const pipeFallback = applySignedAxisTransform ? transformCanvasAxis(pipeFallbackSource, basis) : pipeFallbackSource;
  if (!canvasAxis && pipeFallback) {
    canvasAxis = pipeFallback;
    fallbackReason = 'pipe-axis-fallback';
    diagnostics.push(axisDiagnostic('pipe-axis-fallback', 'warning', 'Support axis was missing; transformed pipe axis fallback was used.'));
  }

  if (!canvasAxis) {
    canvasAxis = applySignedAxisTransform ? transformCanvasAxis('+X', basis) : '+X';
    fallbackReason = 'default-axis-fallback';
    diagnostics.push(axisDiagnostic('default-axis-fallback', 'warning', 'Support axis and pipe axis were missing; transformed +X fallback was used.'));
  }

  if (rawSourceAxis && !sourceAxis) {
    diagnostics.push(axisDiagnostic('unparsed-source-axis', 'warning', `Support axis could not be parsed: ${String(rawSourceAxis)}`));
  }

  const supportActionAxesSource = familyActionAxesSource.length ? familyActionAxesSource : [sourceAxis || explicitCanvasAxisSource || canvasAxis];
  const supportActionAxes = applySignedAxisTransform ? transformNavisAxisListToCanvas(supportActionAxesSource, basis) : normalizeAxisList(supportActionAxesSource);
  const vector = supportAxisVector(canvasAxis);
  return {
    schema: SUPPORT_AXIS_TRANSFORM_SCHEMA,
    sourceAxis,
    canvasAxis,
    sourceActionAxes: supportActionAxesSource,
    supportActionAxes,
    primarySupportActionAxis: supportActionAxes[0] || canvasAxis,
    matchedPipeAxis: pipeFallback,
    matchedPipeAxisSource: pipeFallbackSource,
    axisVector: vector,
    sign: canvasAxis.startsWith('-') ? '-' : '+',
    basisPreset: options.basisPreset || options.mapperPresetId || basis.name || '',
    axisBasis: basis,
    axisBasisName: basis.name || '',
    navisCanvasMapping: 'source +Y/Navis N -> canvas -X; source +Z/Navis Top -> canvas +Z; source -X/Navis W -> canvas -Y',
    signedAxisTransformApplied: applySignedAxisTransform,
    axisTransformApplied,
    fallbackReason,
    diagnostics
  };
}

export function normalizeSupportAxisToken(axisToken, signToken) {
  const text = String(axisToken || '').trim().toUpperCase();
  const signText = String(signToken || '').trim().toUpperCase();
  if (!text) return '';
  const directSemantic = resolveSemanticNavisAxisToken(text);
  if (directSemantic) return directSemantic;
  const signMatch = text.match(/(?:^|[^A-Z0-9])([+-])\s*([XYZ])(?:[^A-Z0-9]|$)/);
  if (signMatch) return `${signMatch[1]}${signMatch[2]}`;
  const axisMatch = text.match(/(?:^|[^A-Z0-9])([XYZ])(?:[^A-Z0-9]|$)|^([XYZ])$/);
  if (!axisMatch) return '';
  const axis = axisMatch[1] || axisMatch[2];
  if (/^-|MINUS|NEGATIVE|NEG|DOWN|WEST|NORTH/i.test(signText)) return `-${axis}`;
  if (/^\+|PLUS|POSITIVE|POS|UP|EAST|SOUTH/i.test(signText)) return `+${axis}`;
  if (/^-|MINUS|NEGATIVE/i.test(text)) return `-${axis}`;
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

function transformCanvasAxis(axis, basis) {
  const normalized = normalizeSupportAxisToken(axis);
  if (!normalized) return '';
  return transformNavisSourceAxisToCanvas(normalized, basis) || normalized;
}

function supportFamilyActionAxes(family) {
  if (family === 'REST' || family === 'SHOE' || family === 'CAN' || family === 'SPRING_CAN') return ['+Y'];
  if (family === 'HOLDDOWN' || family === 'U_BOLT') return ['+Y', '-Y'];
  if (family === 'HANGER' || family === 'SPRING_HANGER') return ['-Y'];
  return [];
}

function normalizeAxisList(value) {
  const entries = Array.isArray(value) ? value : String(value || '').split(/[|,\s]+/);
  const out = [];
  for (const entry of entries) {
    const axis = normalizeSupportAxisToken(entry);
    if (axis && !out.includes(axis)) out.push(axis);
  }
  return out;
}

function normalizeSupportFamily(value) {
  const raw = String(value || '').trim().toUpperCase().replace(/[\s\-]+/g, '_');
  if (!raw) return '';
  if (raw.includes('LINE_STOP') || raw.includes('LINESTOP')) return 'LINESTOP';
  if (raw.includes('LIMIT')) return 'LIMIT';
  if (raw.includes('HOLD') && raw.includes('DOWN')) return 'HOLDDOWN';
  if (raw.includes('SPRING_CAN') || /CAN.*SPRING|SPRING.*CAN/.test(raw)) return 'SPRING_CAN';
  if (raw.includes('SPRING_HANGER')) return 'SPRING_HANGER';
  if (raw.includes('HANGER')) return 'HANGER';
  if (raw.includes('GUIDE')) return 'GUIDE';
  if (raw.includes('REST')) return 'REST';
  return raw;
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
    observedAxes: { ...(base.observedAxes || {}), ...(override.observedAxes || {}) },
    axes,
    semanticAxes: { ...(base.semanticAxes || {}), ...(override.semanticAxes || {}) },
    matrix: override.matrix || base.matrix || [],
    signedAxisTransform: { ...(base.signedAxisTransform || {}), ...(override.signedAxisTransform || {}) }
  };
}

function axisDiagnostic(code, severity, message) {
  return { code, severity, message };
}
