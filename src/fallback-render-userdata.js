export const LEGACY_FALLBACK_RENDER_RECIPE_ID = 'fallback-legacy.v1';
export const LEGACY_FALLBACK_REASON = 'legacy InputXML direct renderer retained as explicit fallback';

export function createLegacyFallbackUserData(input = {}, existingUserData = {}) {
  const componentId = sanitizeId(
    input.componentId
      || existingUserData.componentId
      || existingUserData.ID
      || existingUserData.id
      || supportRestraintId(existingUserData)
      || input.sourceId
      || input.id
      || 'UNKNOWN_COMPONENT'
  );
  const componentClass = normalizeComponentClass(
    input.componentClass
      || existingUserData.componentClass
      || existingUserData.engineeringType
      || existingUserData.family
      || existingUserData.TYPE
      || input.componentType
      || input.rawType
  );
  const sourceType = normalizeSourceType(input.sourceType || existingUserData.sourceType || existingUserData.source || existingUserData.SOURCE || 'INPUTXML');
  const sourceId = String(input.sourceId || existingUserData.sourceId || existingUserData.ID || existingUserData.id || supportRestraintId(existingUserData) || componentId);
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

export function stampLegacyFallbackSceneUserData(rootObject, input = {}, options = {}) {
  if (!rootObject || typeof rootObject !== 'object') return rootObject;
  const includeRoot = options.includeRoot === true;
  const sourceType = normalizeSourceType(input.sourceType || input.sourceKind || 'INPUTXML');

  const visit = (object, inherited = {}) => {
    if (!object || typeof object !== 'object') return;

    let nextInherited = inherited;
    const shouldStamp = (includeRoot || object !== rootObject) && isRenderableFallbackObject(object, options);
    if (shouldStamp) {
      const existing = object.userData && typeof object.userData === 'object' ? object.userData : {};
      const componentId = explicitComponentId(existing) || inherited.componentId || object.name || input.componentId;
      const componentClass = existing.componentClass || existing.engineeringType || existing.family || inherited.componentClass || input.componentClass;
      const sourceId = existing.sourceId || existing.ID || existing.id || supportRestraintId(existing) || inherited.sourceId || object.name || componentId;
      object.userData = createLegacyFallbackUserData(
        {
          ...input,
          componentId,
          componentClass,
          sourceType,
          sourceId,
          geometryContractId: inherited.geometryContractId,
          renderRecipeId: inherited.renderRecipeId,
          fallbackReason: inherited.fallbackReason || input.fallbackReason
        },
        existing
      );
      nextInherited = fallbackInheritanceFromUserData(object.userData);
    }

    const children = Array.isArray(object.children) ? object.children : [];
    for (const child of children) visit(child, nextInherited);
  };

  if (Array.isArray(rootObject.children)) {
    visit(rootObject, {});
  } else if (typeof rootObject.traverse === 'function') {
    rootObject.traverse((object) => {
      if (object !== rootObject || includeRoot) {
        stampLegacyFallbackUserData(object, { ...input, sourceType }, { recursive: false });
      }
    });
  }

  return rootObject;
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

function explicitComponentId(userData = {}) {
  return userData.componentId || userData.ID || userData.id || supportRestraintId(userData);
}

function supportRestraintId(userData = {}) {
  const node = userData.node || userData.NODE;
  const family = userData.family || userData.FAMILY;
  if (!node && !family) return '';
  return `SUPPORT_${node || 'UNKNOWN_NODE'}_${family || 'UNKNOWN_RESTRAINT'}`;
}

function fallbackInheritanceFromUserData(userData) {
  return {
    componentId: userData.componentId,
    componentClass: userData.componentClass,
    sourceType: userData.sourceRef?.sourceType,
    sourceId: userData.sourceRef?.sourceId,
    geometryContractId: userData.geometryContractId,
    renderRecipeId: userData.renderRecipeId,
    fallbackReason: userData.fallbackReason
  };
}

function isRenderableFallbackObject(object, options = {}) {
  if (options.includeAll === true) return true;
  const type = String(object.type || '').toUpperCase();
  if (type === 'SCENE') return false;
  if (object.isMesh || object.isGroup || object.isLine || object.isSprite) return true;
  if (type.includes('GROUP') || type.includes('MESH') || type.includes('LINE') || type.includes('SPRITE')) return true;
  return Boolean(object.name || object.userData);
}

function normalizeComponentClass(value) {
  const normalized = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized.includes('VALVE')) return 'VALVE';
  if (normalized.includes('FLANGE')) return 'FLANGE';
  if (normalized.includes('REDUCER')) return 'REDUCER';
  if (normalized.includes('TEE')) return 'TEE';
  if (normalized.includes('ELBOW')) return 'ELBOW';
  if (normalized.includes('BEND')) return 'BEND';
  if (normalized.includes('RESTRAINT') || normalized.includes('GUIDE') || normalized.includes('REST') || normalized.includes('STOP') || normalized.includes('ANCHOR')) return 'RESTRAINT';
  if (normalized.includes('SUPPORT')) return 'SUPPORT';
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
