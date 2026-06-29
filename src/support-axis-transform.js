import {
  NAVIS_TO_CANVAS_SUPPORT_AXIS_BASIS,
  resolveSemanticNavisAxisToken
} from './support-axis-basis-config.js?v=bust-cache-4';

export const SUPPORT_AXIS_TRANSFORM_SCHEMA = 'SupportAxisTransform.v3';

const DEFAULT_AXIS_BASIS = NAVIS_TO_CANVAS_SUPPORT_AXIS_BASIS;

/**
 * Normalizes stagedJson support axes into one canonical canvas-space contract.
 *
 * Observed Navis/canvas basis:
 *   Navis N   -> Canvas +Y
 *   Navis Top -> Canvas +Z
 *   Navis W   -> Canvas -X
 *
 * Fallback rules:
 *   - REST uses family-rule +Y when no explicit source/canvas axis exists.
 *   - HOLDDOWN uses family-rule +Y/-Y and reports +Y as the primary display axis.
 *   - GUIDE/LINESTOP/LIMIT/ANCHOR may use pipe axis fallback when no explicit source/canvas axis exists.
 *   - Missing everything falls back to +X with a diagnostic.
 */
export function resolveSupportAxisTransform(input) {
  const options = input && typeof input === 'object' ? input : {};
  const diagnostics = [];
  const basis = mergeAxisBasis(DEFAULT_AXIS_BASIS, options.axisBasis || options.basis || {});
  const rawSourceAxis = options.sourceAxis || options.rawAxis || options.axis || '';
  const explicitCanvasAxis = normalizeSupportAxisToken(options.canvasAxis || '');
  const sourceAxis = normalizeSupportAxisToken(rawSourceAxis, options.sign || options.sourceSign || '');
  const family = normalizeSupportFamily(options.supportFamily || options.family || '');
  const requestedActionAxes = normalizeAxisList(options.supportActionAxes || options.actionAxes || []);
  const familyActionAxes = requestedActionAxes.length ? requestedActionAxes : supportFamilyActionAxes(family);
  let canvasAxis = explicitCanvasAxis;
  let axisTransformApplied = false;
  let fallbackReason = '';

  if (!canvasAxis && sourceAxis) {
    const entry = basis.axes[sourceAxis] || {};
    canvasAxis = normalizeSupportAxisToken(entry.canvasAxis || sourceAxis);
    axisTransformApplied = Boolean(canvasAxis && canvasAxis !== sourceAxis);
  }

  if (explicitCanvasAxis && sourceAxis && explicitCanvasAxis !== sourceAxis) {
    axisTransformApplied = true;
  }

  if (!canvasAxis && familyActionAxes.length && (family === 'REST' || family === 'HOLDDOWN')) {
    canvasAxis = familyActionAxes[0];
    fallbackReason = 'family-rule-axis';
    diagnostics.push(axisDiagnostic('family-rule-axis', 'info', `${family} uses a family-rule support action axis.`));
  }

  const pipeFallback = normalizePipeAxis(options.pipeAxis || '');
  if (!canvasAxis && pipeFallback) {
    canvasAxis = pipeFallback;
    fallbackReason = 'pipe-axis-fallback';
    diagnostics.push(axisDiagnostic('pipe-axis-fallback', 'warning', 'Support axis was missing; pipe axis fallback was used.'));
  }

  if (!canvasAxis) {
    canvasAxis = '+X';
    fallbackReason = 'default-axis-fallback';
    diagnostics.push(axisDiagnostic('default-axis-fallback', 'warning', 'Support axis and pipe axis were missing; +X fallback was used.'));
  }

  if (rawSourceAxis && !sourceAxis) {
    diagnostics.push(axisDiagnostic('unparsed-source-axis', 'warning', `Support axis could not be parsed: ${String(rawSourceAxis)}`));
  }

  const supportActionAxes = familyActionAxes.length ? familyActionAxes : [canvasAxis];
  const vector = supportAxisVector(canvasAxis);
  return {
    schema: SUPPORT_AXIS_TRANSFORM_SCHEMA,
    sourceAxis,
    canvasAxis,
    supportActionAxes,
    primarySupportActionAxis: supportActionAxes[0] || canvasAxis,
    matchedPipeAxis: pipeFallback,
    axisVector: vector,
    sign: canvasAxis.startsWith('-') ? '-' : '+',
    basisPreset: options.basisPreset || options.mapperPresetId || basis.name || '',
    axisBasis: basis,
    axisBasisName: basis.name || '',
    navisCanvasMapping: 'N->+Y, TOP->+Z, W->-X',
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
    axes,
    semanticAxes: { ...(base.semanticAxes || {}), ...(override.semanticAxes || {}) }
  };
}

function axisDiagnostic(code, severity, message) {
  return { code, severity, message };
}
