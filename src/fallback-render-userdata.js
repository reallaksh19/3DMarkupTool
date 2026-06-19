export const LEGACY_FALLBACK_RENDER_RECIPE_ID = 'fallback-legacy.v1';
export const LEGACY_FALLBACK_REASON = 'legacy InputXML direct renderer retained as explicit fallback';

export function createLegacyFallbackUserData(input = {}, existingUserData = {}) {
  const componentId = sanitizeId(
    input.componentId
      || existingUserData.componentId
      || existingUserData.ID
      || existingUserData.id
      || input.sourceId
      || input.id
      || 'UNKNOWN_COMPONENT'
  );
  const componentClass = normalizeComponentClass(
    input.componentClass
      || existingUserData.componentClass
      || existingUserData.engineeringType
      || existingUserData.TYPE
      || input.componentType
      || input.rawType
  );
  const sourceType = normalizeSourceType(input.sourceType || existingUserData.sourceType || existingUserData.source || existingUserData.SOURCE || 'INPUTXML');
  const sourceId = String(input.sourceId || existingUserData.sourceId || existingUserData.ID || existingUserData.id || componentId);
  const geometryContractId = String(input.geometryContractId || existingUserData.geometryContractId || `GC_FALLBACK_LEGACY_${componentId}`);
  const renderRecipeId = String(input.renderRecipeId || existingUserData.renderRecipeId || LEGACY_FALLBACK_RENDER_RECIPE_ID);

  return {
    ...existingUserData,
    objectRole: 'component-render',
    componentId,
    componentClass,
    sourceRef: { sourceType, sourceId },
    geometryContractId,
    renderRecipeId,
    fallbackRendered: true,
    fallbackReason: input.fallbackReason || existingUserData.fallbackReason || LEGACY_FALLBACK_REASON
  };
}

export function stampLegacyFallbackUserData(object3d, input = {}, options = {}) {
  if (!object3d || typeof object3d !== 'object') return object3d;
  const stampOne = (target, inherited = {}) => {
    const existing = target.userData && typeof target.userData === 'object' ? target.userData : {};
    target.userData = createLegacyFallbackUserData({ ...input, ...inherited }, existing);
    return target.userData;
  };

  const rootUserData = stampOne(object3d);
  if (options.recursive === false || typeof object3d.traverse !== 'function') return object3d;

  object3d.traverse((child) => {
    if (!child || child === object3d) return;
    stampOne(child, {
      componentId: rootUserData.componentId,
      componentClass: rootUserData.componentClass,
      sourceType: rootUserData.sourceRef.sourceType,
      sourceId: rootUserData.sourceRef.sourceId,
      geometryContractId: rootUserData.geometryContractId,
      renderRecipeId: rootUserData.renderRecipeId,
      fallbackReason: rootUserData.fallbackReason
    });
  });

  return object3d;
}

export function isContractStampedFallback(object3d) {
  const userData = object3d?.userData;
  return Boolean(
    userData
      && userData.objectRole === 'component-render'
      && typeof userData.componentId === 'string'
      && typeof userData.componentClass === 'string'
      && userData.sourceRef?.sourceType
      && userData.sourceRef?.sourceId
      && typeof userData.geometryContractId === 'string'
      && typeof userData.renderRecipeId === 'string'
      && userData.fallbackRendered === true
      && typeof userData.fallbackReason === 'string'
      && userData.fallbackReason.length > 0
  );
}

function normalizeComponentClass(value) {
  const normalized = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized.includes('VALVE')) return 'VALVE';
  if (normalized.includes('FLANGE')) return 'FLANGE';
  if (normalized.includes('REDUCER')) return 'REDUCER';
  if (normalized.includes('TEE')) return 'TEE';
  if (normalized.includes('ELBOW')) return 'ELBOW';
  if (normalized.includes('BEND')) return 'BEND';
  if (normalized.includes('SUPPORT')) return 'SUPPORT';
  if (normalized.includes('RESTRAINT') || normalized.includes('GUIDE') || normalized.includes('REST') || normalized.includes('STOP') || normalized.includes('ANCHOR')) return 'RESTRAINT';
  if (normalized.includes('PIPE')) return 'PIPE';
  if (normalized.includes('UNKNOWN') || normalized.includes('UNRESOLVED') || normalized.includes('UNMAPPED')) return 'UNKNOWN';
  return 'UNKNOWN';
}

function normalizeSourceType(value) {
  const normalized = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!normalized) return 'INPUTXML';
  if (normalized === 'INPUT_XML') return 'INPUTXML';
  return normalized;
}

function sanitizeId(value) {
  return String(value || 'UNKNOWN_COMPONENT').trim().replace(/[^A-Za-z0-9_:-]+/g, '_').replace(/:+/g, '_');
}
