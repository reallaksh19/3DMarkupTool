export const MANAGED_STAGE_SUPPORT_SYMBOL_CATALOGUE_SCHEMA = 'ManagedStageSupportSymbolCatalogue.v1';

const AXIAL_FAMILIES = new Set(['LINE_STOP', 'LIMIT_STOP']);
const PRINCIPAL_AXES = new Set(['X', 'Y', 'Z']);
const SIMPLE_SYMBOL_PRIMITIVE_BUDGET_MAX = 4;

export const MANAGED_STAGE_SUPPORT_SYMBOL_CATALOGUE_POLICY = Object.freeze({
  schema: MANAGED_STAGE_SUPPORT_SYMBOL_CATALOGUE_SCHEMA,
  primitiveBudgetMax: SIMPLE_SYMBOL_PRIMITIVE_BUDGET_MAX,
  rules: Object.freeze([
    'REST = one +Y upward arrow primitive',
    'HOLDDOWN = two vertical arrow primitives on +Y and -Y',
    'GUIDE = lateral primitives by resolved pipe orientation: X pipe -> +/-Z; Z pipe -> +/-X; vertical pipe -> +/-X and +/-Z',
    'LINE STOP / LIMIT / LIM = pipe-axial +/- pair unless an explicit signed source axis exists',
    'axis-only restraint without explicit +/- = warning marker with popupRequired=true',
    'Can Spring / Spring Can = compact warning coil below pipe',
    'axial restraints use no OD/2 radial contact; tips touch unless gap; positive gap = 10x gap visual separation',
    'ODx2/3 sizing is only eligible for final axial/pipe-parallel symbols'
  ])
});

export function resolveManagedStageSupportSymbolCatalogue(mapperRecord = {}, options = {}) {
  const attrs = mapperRecord.attrs || {};
  const family = normalizeFamily(mapperRecord.family || attrs.SUPPORT_KIND_MAPPED || 'UNKNOWN');
  const pipeAxisSigned = normalizeSignedAxis(options.pipeAxisSigned || options.pipeAxis || '+X') || '+X';
  const pipeAxis = axisLetter(pipeAxisSigned);
  const explicitAxisInfo = resolveExplicitAxisInfo(mapperRecord, attrs);
  const gapMm = parseMm(options.gapMm ?? mapperRecord.gap?.value ?? attrs.SUPPORT_GAP_MM ?? attrs.GAP_MM ?? attrs.GAP) || 0;
  const gapVisualSeparationMm = AXIAL_FAMILIES.has(family) && gapMm > 0
    ? round(gapMm * 10)
    : 0;

  if (isAxisOnlyWarning(mapperRecord, attrs, family, explicitAxisInfo)) {
    return symbolResult({
      mapperRecord,
      family: 'SINGLE_AXIS_WARNING',
      graphicsRule: 'warning-marker-popup-required',
      primitives: warningMarkerPrimitives(),
      popupRequired: true,
      warnings: ['single-axis restraint is missing explicit +/- sign'],
      gapMm,
      gapVisualSeparationMm: 0,
      odTwoThirdsEligible: false
    });
  }

  if (family === 'REST') {
    return symbolResult({
      mapperRecord,
      family,
      graphicsRule: 'positive-y-upward-arrow',
      primitives: [arrowPrimitive('+Y', 'rest-upward-arrow', { pointsTowardCenter: false })],
      gapMm,
      gapVisualSeparationMm: 0,
      odTwoThirdsEligible: false
    });
  }

  if (family === 'HOLDDOWN') {
    return symbolResult({
      mapperRecord,
      family,
      graphicsRule: 'double-vertical-y-arrows',
      primitives: [
        arrowPrimitive('+Y', 'holddown-upward-arrow', { pointsTowardCenter: false }),
        arrowPrimitive('-Y', 'holddown-downward-arrow', { pointsTowardCenter: false })
      ],
      gapMm,
      gapVisualSeparationMm: 0,
      odTwoThirdsEligible: false
    });
  }

  if (family === 'GUIDE') {
    const axes = guideAxesForPipeAxis(pipeAxis);
    return symbolResult({
      mapperRecord,
      family,
      graphicsRule: 'lateral-by-pipe-orientation',
      primitives: axes.map((axis) => arrowPrimitive(axis, 'guide-lateral-arrow', { pointsTowardCenter: true })),
      pipeAxis,
      gapMm,
      gapVisualSeparationMm: 0,
      odTwoThirdsEligible: false
    });
  }

  if (AXIAL_FAMILIES.has(family)) {
    const explicitSignedAxis = explicitAxisInfo.hasExplicitSign ? explicitAxisInfo.canvasAxis : '';
    const axes = explicitSignedAxis ? [explicitSignedAxis] : [pipeAxisSigned, invertAxis(pipeAxisSigned)];
    return symbolResult({
      mapperRecord,
      family,
      graphicsRule: 'axial-pair-or-explicit-sign',
      primitives: axes.map((axis) => arrowPrimitive(axis, 'axial-restraint-arrow', {
        pointsTowardCenter: true,
        axialPipeParallel: true,
        explicitSingle: Boolean(explicitSignedAxis),
        tipSeparationMm: explicitSignedAxis ? gapVisualSeparationMm : gapVisualSeparationMm / 2
      })),
      pipeAxis,
      gapMm,
      gapVisualSeparationMm,
      axialNoOdHalfRadialContact: true,
      axialTipsTouchUnlessGap: true,
      odTwoThirdsEligible: true
    });
  }

  if (family === 'SPRING_CAN') {
    return symbolResult({
      mapperRecord,
      family,
      graphicsRule: 'warning-coil-below-pipe',
      primitives: springCanCoilPrimitives(),
      popupRequired: true,
      warnings: ['spring can requires engineering resolution; warning coil below pipe only'],
      gapMm,
      gapVisualSeparationMm: 0,
      odTwoThirdsEligible: false
    });
  }

  return symbolResult({
    mapperRecord,
    family: 'UNKNOWN',
    graphicsRule: 'unknown-cross-warning',
    primitives: warningMarkerPrimitives(),
    popupRequired: true,
    warnings: ['unknown support kind; rendered as warning marker'],
    gapMm,
    gapVisualSeparationMm: 0,
    odTwoThirdsEligible: false
  });
}

function symbolResult({ mapperRecord, family, graphicsRule, primitives, pipeAxis = '', popupRequired = false, warnings = [], gapMm = 0, gapVisualSeparationMm = 0, axialNoOdHalfRadialContact = false, axialTipsTouchUnlessGap = false, odTwoThirdsEligible = false }) {
  const primitiveCount = primitives.length;
  return {
    schema: MANAGED_STAGE_SUPPORT_SYMBOL_CATALOGUE_SCHEMA,
    sourceMode: mapperRecord.sourceMode || mapperRecord.attrs?.SUPPORT_SOURCE_MODE || 'stagedJson',
    supportTag: mapperRecord.supportTag || mapperRecord.attrs?.SUPPORT_TAG_MAPPED || '',
    family,
    graphicsRule,
    pipeAxis,
    primitives,
    primitiveCount,
    primitiveBudgetMax: SIMPLE_SYMBOL_PRIMITIVE_BUDGET_MAX,
    primitiveBudgetOk: primitiveCount <= SIMPLE_SYMBOL_PRIMITIVE_BUDGET_MAX,
    popupRequired: Boolean(popupRequired),
    warnings,
    gapMm: round(gapMm),
    gapRecordScoped: true,
    gapCarryForward: false,
    gapVisualSeparationMm: round(gapVisualSeparationMm),
    axialNoOdHalfRadialContact: Boolean(axialNoOdHalfRadialContact),
    axialTipsTouchUnlessGap: Boolean(axialTipsTouchUnlessGap),
    odTwoThirdsResolverApplied: Boolean(odTwoThirdsEligible),
    odTwoThirdsRule: odTwoThirdsEligible
      ? 'ODx2/3 may apply only to this final axial/pipe-parallel symbol'
      : 'ODx2/3 is not applied to this non-axial or unresolved symbol'
  };
}

function arrowPrimitive(axis, role, extra = {}) {
  return {
    primitive: 'bar-arrow',
    role,
    axis: normalizeSignedAxis(axis) || '+X',
    canvasVector: axisTokenToVector(axis),
    pointsTowardCenter: extra.pointsTowardCenter !== false,
    axialPipeParallel: Boolean(extra.axialPipeParallel),
    explicitSingle: Boolean(extra.explicitSingle),
    tipSeparationMm: round(extra.tipSeparationMm || 0)
  };
}

function warningMarkerPrimitives() {
  return [
    { primitive: 'warning-bar', role: 'warning-cross-x', axis: '+X', canvasVector: axisTokenToVector('+X') },
    { primitive: 'warning-bar', role: 'warning-cross-z', axis: '+Z', canvasVector: axisTokenToVector('+Z') },
    { primitive: 'warning-dot', role: 'popup-required', axis: '+Y', canvasVector: axisTokenToVector('+Y') }
  ];
}

function springCanCoilPrimitives() {
  return [
    { primitive: 'coil-segment', role: 'spring-can-coil-1', axis: '-Y', canvasVector: axisTokenToVector('-Y') },
    { primitive: 'coil-segment', role: 'spring-can-coil-2', axis: '-Y', canvasVector: axisTokenToVector('-Y') },
    { primitive: 'coil-segment', role: 'spring-can-coil-3', axis: '-Y', canvasVector: axisTokenToVector('-Y') },
    { primitive: 'coil-segment', role: 'spring-can-coil-4', axis: '-Y', canvasVector: axisTokenToVector('-Y') }
  ];
}

function resolveExplicitAxisInfo(mapperRecord, attrs) {
  const rawAxisField = attrs.SUPPORT_AXIS_SOURCE_FIELD || '';
  const rawAxisValue = rawAxisField && attrs[rawAxisField] !== undefined ? String(attrs[rawAxisField]).trim() : String(mapperRecord.axis?.sourceAxis || attrs.SUPPORT_AXIS_SOURCE || '').trim();
  const rawSignField = attrs.SUPPORT_SIGN_SOURCE_FIELD || '';
  const rawSignValue = rawSignField && attrs[rawSignField] !== undefined ? String(attrs[rawSignField]).trim() : String(attrs.SUPPORT_SIGN_MAPPED || '').trim();
  const hasSignInAxis = /^[+-]/.test(rawAxisValue);
  const hasSignField = /^(\+|-|PLUS|MINUS|POS|NEG)/i.test(rawSignValue);
  const sourceAxis = normalizeSignedAxis(rawAxisValue, rawSignValue);
  const canvasAxis = normalizeSignedAxis(mapperRecord.axis?.canvasAxis || attrs.SUPPORT_AXIS_CANVAS || sourceAxis);
  return {
    rawAxisField,
    rawAxisValue,
    rawSignField,
    rawSignValue,
    sourceAxis,
    canvasAxis,
    hasExplicitSign: Boolean(sourceAxis && (hasSignInAxis || hasSignField)),
    hasAxis: Boolean(sourceAxis)
  };
}

function isAxisOnlyWarning(mapperRecord, attrs, family, explicitAxisInfo) {
  if (family !== 'UNKNOWN' && family !== '') return false;
  if (!explicitAxisInfo.hasAxis || explicitAxisInfo.hasExplicitSign) return false;
  const raw = `${mapperRecord.rawKind || ''} ${attrs.SUPPORT_KIND_MAPPED || ''} ${attrs.SUPPORT_AXIS_SOURCE || ''}`.toUpperCase();
  return /(^|[^A-Z0-9])(X|Y|Z)([^A-Z0-9]|$)/.test(raw);
}

function guideAxesForPipeAxis(axis) {
  if (axis === 'X') return ['+Z', '-Z'];
  if (axis === 'Z') return ['+X', '-X'];
  return ['+X', '-X', '+Z', '-Z'];
}

function normalizeFamily(value) {
  const raw = String(value || '').toUpperCase().replace(/[\s\-]+/g, '_');
  if (raw.includes('LIMIT')) return 'LIMIT_STOP';
  if (raw.includes('LINE_STOP') || raw.includes('LINESTOP') || /(^|_)LIM($|_)/.test(raw)) return 'LINE_STOP';
  if (raw.includes('SPRING_CAN') || /CAN.*SPRING|SPRING.*CAN/.test(raw)) return 'SPRING_CAN';
  if (raw.includes('HOLDDOWN') || (raw.includes('HOLD') && raw.includes('DOWN'))) return 'HOLDDOWN';
  if (raw.includes('GUIDE')) return 'GUIDE';
  if (raw.includes('REST')) return 'REST';
  return raw || 'UNKNOWN';
}

function normalizeSignedAxis(axisToken, signToken = '') {
  const axisText = String(axisToken || '').toUpperCase().trim();
  const signText = String(signToken || '').toUpperCase().trim();
  const axisMatch = axisText.match(/([+-]?)(X|Y|Z)/);
  if (!axisMatch) return '';
  let sign = axisMatch[1] || '';
  if (!sign && signText) {
    if (/^-|MINUS|NEG/.test(signText)) sign = '-';
    if (/^\+|PLUS|POS/.test(signText)) sign = '+';
  }
  return `${sign || '+'}${axisMatch[2]}`;
}

function axisLetter(axisToken) {
  const normalized = normalizeSignedAxis(axisToken) || '+X';
  const axis = normalized.replace(/[+-]/g, '');
  return PRINCIPAL_AXES.has(axis) ? axis : 'X';
}

function invertAxis(axis) {
  const normalized = normalizeSignedAxis(axis) || '+X';
  return normalized.startsWith('-') ? normalized.replace('-', '+') : normalized.replace('+', '-');
}

function axisTokenToVector(axisToken) {
  const axis = normalizeSignedAxis(axisToken) || '+X';
  const sign = axis.startsWith('-') ? -1 : 1;
  const dim = axis.replace(/[+-]/g, '');
  if (dim === 'Y') return { x: 0, y: sign, z: 0 };
  if (dim === 'Z') return { x: 0, y: 0, z: sign };
  return { x: sign, y: 0, z: 0 };
}

function parseMm(value) {
  if (value === undefined || value === null) return 0;
  const match = String(value).match(/[-+]?\d*\.?\d+/);
  return match ? Number(match[0]) : 0;
}

function round(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}
