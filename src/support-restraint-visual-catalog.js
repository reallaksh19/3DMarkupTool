export const SUPPORT_RESTRAINT_CATALOG_SCHEMA_VERSION = 'SupportRestraintVisualCatalog.v1.proportional-fallback';

export const SUPPORT_RESTRAINT_VISUAL_PROFILES = Object.freeze({
  REST: {
    visualKey: 'REST',
    recipeId: 'support.rest.v1',
    label: 'Rest support',
    primitiveRecipe: 'single_vertical_arrow',
    symbolLengthFactor: 1.2,
    arrowRadiusFactor: 0.08,
    minimumSymbolLength: 80,
    minimumArrowRadius: 8
  },
  GUIDE: {
    visualKey: 'GUIDE',
    recipeId: 'support.guide.v1',
    label: 'Guide restraint',
    primitiveRecipe: 'opposed_lateral_arrows',
    symbolLengthFactor: 1.2,
    arrowRadiusFactor: 0.08,
    minimumSymbolLength: 80,
    minimumArrowRadius: 8
  },
  LINE_STOP: {
    visualKey: 'LINE_STOP',
    recipeId: 'support.line-stop.v1',
    label: 'Line stop',
    primitiveRecipe: 'opposed_axial_arrows',
    symbolLengthFactor: 1.2,
    arrowRadiusFactor: 0.08,
    minimumSymbolLength: 80,
    minimumArrowRadius: 8
  },
  LIMIT_STOP: {
    visualKey: 'LIMIT_STOP',
    recipeId: 'support.limit-stop.v1',
    label: 'Limit stop',
    primitiveRecipe: 'opposed_axial_arrows',
    symbolLengthFactor: 1.2,
    arrowRadiusFactor: 0.08,
    minimumSymbolLength: 80,
    minimumArrowRadius: 8
  },
  ANCHOR: {
    visualKey: 'ANCHOR',
    recipeId: 'support.anchor.v1',
    label: 'Anchor',
    primitiveRecipe: 'axial_and_lateral_arrows',
    symbolLengthFactor: 1.2,
    arrowRadiusFactor: 0.08,
    minimumSymbolLength: 80,
    minimumArrowRadius: 8
  },
  HOLDDOWN: {
    visualKey: 'HOLDDOWN',
    recipeId: 'support.holddown.v1',
    label: 'Hold-down restraint',
    primitiveRecipe: 'opposed_vertical_arrows',
    symbolLengthFactor: 1.2,
    arrowRadiusFactor: 0.08,
    minimumSymbolLength: 80,
    minimumArrowRadius: 8
  },
  SPRING: {
    visualKey: 'SPRING',
    recipeId: 'support.spring.v1',
    label: 'Spring or hanger',
    primitiveRecipe: 'spring_stack_marker',
    symbolLengthFactor: 1.2,
    arrowRadiusFactor: 0.06,
    minimumSymbolLength: 80,
    minimumArrowRadius: 6,
    coilCount: 5
  },
  AXIS_RESTRAINT: {
    visualKey: 'AXIS_RESTRAINT',
    recipeId: 'support.axis-restraint.v1',
    label: 'Directional restraint',
    primitiveRecipe: 'single_axis_arrow',
    symbolLengthFactor: 1.2,
    arrowRadiusFactor: 0.08,
    minimumSymbolLength: 80,
    minimumArrowRadius: 8
  },
  UNKNOWN_RESTRAINT: {
    visualKey: 'UNKNOWN_RESTRAINT',
    recipeId: 'support.unknown-restraint.v1',
    label: 'Unknown restraint',
    primitiveRecipe: 'warning_box',
    symbolLengthFactor: 0.8,
    arrowRadiusFactor: 0.08,
    minimumSymbolLength: 60,
    minimumArrowRadius: 8
  }
});

const FAMILY_ALIASES = Object.freeze({
  REST: 'REST',
  RESTRAINT_REST: 'REST',
  GUIDE: 'GUIDE',
  LINESTOP: 'LINE_STOP',
  LINE_STOP: 'LINE_STOP',
  LIMIT: 'LIMIT_STOP',
  LIMIT_STOP: 'LIMIT_STOP',
  ANCHOR: 'ANCHOR',
  HOLD_DOWN: 'HOLDDOWN',
  HOLDDOWN: 'HOLDDOWN',
  HANGER: 'SPRING',
  SPRING: 'SPRING',
  SPRING_WARNING: 'SPRING',
  AXIS: 'AXIS_RESTRAINT',
  AXIS_RESTRAINT: 'AXIS_RESTRAINT',
  DIRECTIONAL_X: 'AXIS_RESTRAINT',
  DIRECTIONAL_Y: 'AXIS_RESTRAINT',
  DIRECTIONAL_Z: 'AXIS_RESTRAINT',
  UNKNOWN: 'UNKNOWN_RESTRAINT',
  UNKNOWN_RESTRAINT: 'UNKNOWN_RESTRAINT'
});

export function normalizeSupportRestraintFamily(value) {
  const raw = String(value || '').trim().toUpperCase().replace(/[\s\-]+/g, '_');
  if (!raw) return 'UNKNOWN_RESTRAINT';
  if (FAMILY_ALIASES[raw]) return FAMILY_ALIASES[raw];
  if (raw.includes('GUIDE')) return 'GUIDE';
  if (raw.includes('ANCHOR')) return 'ANCHOR';
  if (raw.includes('HANGER') || raw.includes('SPRING')) return 'SPRING';
  if (raw.includes('HOLD') && raw.includes('DOWN')) return 'HOLDDOWN';
  if (raw.includes('LIMIT')) return 'LIMIT_STOP';
  if (raw.includes('STOP')) return 'LINE_STOP';
  if (raw === '+X' || raw === '-X' || raw === '+Y' || raw === '-Y' || raw === '+Z' || raw === '-Z') return 'AXIS_RESTRAINT';
  return 'UNKNOWN_RESTRAINT';
}

export function resolveSupportRestraintVisualSpec(input) {
  const familyInput = typeof input === 'string'
    ? input
    : input?.family || input?.restraintType || input?.type || input?.typeCode || input?.rawType || input?.axis;
  const family = normalizeSupportRestraintFamily(familyInput);
  const profile = SUPPORT_RESTRAINT_VISUAL_PROFILES[family] || SUPPORT_RESTRAINT_VISUAL_PROFILES.UNKNOWN_RESTRAINT;
  return Object.freeze({
    ...profile,
    family,
    componentClass: 'SUPPORT_RESTRAINT',
    catalogSchemaVersion: SUPPORT_RESTRAINT_CATALOG_SCHEMA_VERSION,
    proportionalFallback: true,
    vendorDimensionalDbBacked: false,
    writerSafePrimitiveKinds: ['cylinder', 'pyramid', 'box', 'sphere']
  });
}

export function listSupportRestraintVisualProfiles() {
  return Object.entries(SUPPORT_RESTRAINT_VISUAL_PROFILES).map(([family, profile]) => ({
    family,
    ...profile,
    componentClass: 'SUPPORT_RESTRAINT',
    catalogSchemaVersion: SUPPORT_RESTRAINT_CATALOG_SCHEMA_VERSION,
    proportionalFallback: true,
    vendorDimensionalDbBacked: false
  }));
}
