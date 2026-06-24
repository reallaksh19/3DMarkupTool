export const MANAGED_STAGE_SUPPORT_VISIBILITY_BOOST_SCHEMA = 'ManagedStageSupportVisibilityBoost.v1';
export const MANAGED_STAGE_SUPPORT_VISIBILITY_BOOST_CACHE_KEY = '20260624-support-visibility-boost-1';

const DEFAULT_BOOST_POLICY = Object.freeze({
  minRadialScale: 2.8,
  maxRadialScale: 4.5,
  supportRenderOrder: 850,
  supportRootRenderOrder: 840,
  opacity: 1,
  emissiveIntensity: 0.28,
  depthTest: false,
  depthWrite: false
});

export function boostManagedStageSupportVisibility(modelRoot, options = {}) {
  if (!modelRoot?.traverse) {
    return visibilityResult('skipped', { reason: 'missing modelRoot' });
  }

  const policy = { ...DEFAULT_BOOST_POLICY, ...(options.policy || {}) };
  const roots = [];
  const parts = [];
  modelRoot.traverse((object) => {
    if (object?.userData?.managedStageSupportVisual === true) roots.push(object);
    if (object?.userData?.managedStageSupportVisualPart === true) parts.push(object);
  });

  for (const root of roots) {
    root.renderOrder = Math.max(Number(root.renderOrder || 0), policy.supportRootRenderOrder);
    root.visible = true;
    root.userData = {
      ...(root.userData || {}),
      supportVisibilityBoostApplied: true,
      supportVisibilityBoostSchema: MANAGED_STAGE_SUPPORT_VISIBILITY_BOOST_SCHEMA,
      supportVisibilityBoostCacheKey: MANAGED_STAGE_SUPPORT_VISIBILITY_BOOST_CACHE_KEY
    };
  }

  let materialBoostedCount = 0;
  let radialScaleBoostedCount = 0;
  for (const part of parts) {
    part.visible = true;
    part.frustumCulled = false;
    part.renderOrder = Math.max(Number(part.renderOrder || 0), policy.supportRenderOrder);
    if (part.material) {
      boostMaterial(part, policy);
      materialBoostedCount += 1;
    }
    if (shouldThickenSupportPart(part)) {
      const before = { x: Number(part.scale?.x || 1), z: Number(part.scale?.z || 1) };
      const nextScale = clampScale(Math.max(policy.minRadialScale, before.x, before.z), policy.maxRadialScale);
      part.scale.x = Math.max(part.scale.x || 1, nextScale);
      part.scale.z = Math.max(part.scale.z || 1, nextScale);
      radialScaleBoostedCount += 1;
      part.userData = {
        ...(part.userData || {}),
        supportVisibilityRadialScaleBefore: before,
        supportVisibilityRadialScaleApplied: nextScale
      };
    }
    part.userData = {
      ...(part.userData || {}),
      supportVisibilityBoostApplied: true,
      supportVisibilityBoostSchema: MANAGED_STAGE_SUPPORT_VISIBILITY_BOOST_SCHEMA,
      supportVisibilityBoostCacheKey: MANAGED_STAGE_SUPPORT_VISIBILITY_BOOST_CACHE_KEY,
      supportVisibilityBoostPolicy: 'render-order + depth-safe material + radial thickening; no added primitives'
    };
  }

  const result = visibilityResult('applied', {
    rootCount: roots.length,
    partCount: parts.length,
    materialBoostedCount,
    radialScaleBoostedCount,
    renderOrder: policy.supportRenderOrder,
    minRadialScale: policy.minRadialScale,
    maxRadialScale: policy.maxRadialScale
  });
  modelRoot.userData = {
    ...(modelRoot.userData || {}),
    managedStageSupportVisibilityBoost: result
  };
  return result;
}

function boostMaterial(object, policy) {
  const current = object.material;
  const material = current?.clone ? current.clone() : current;
  if (!material) return;
  material.depthTest = Boolean(policy.depthTest);
  material.depthWrite = Boolean(policy.depthWrite);
  material.transparent = true;
  material.opacity = policy.opacity;
  if ('emissive' in material && material.emissive?.copy) {
    material.emissive.copy(material.color || material.emissive);
    material.emissiveIntensity = policy.emissiveIntensity;
  }
  material.needsUpdate = true;
  object.material = material;
}

function shouldThickenSupportPart(object) {
  const data = object?.userData || {};
  return data.supportDirectionalGlyphBar === true
    || data.supportGlyphStemBar === true
    || data.supportGlyphTipTick === true
    || data.clusterOffsetConnector === true
    || data.fallbackCrossRod === true;
}

function clampScale(value, max) {
  return Math.max(1, Math.min(Number(value) || 1, Number(max) || 4.5));
}

function visibilityResult(status, details = {}) {
  return {
    schema: MANAGED_STAGE_SUPPORT_VISIBILITY_BOOST_SCHEMA,
    cacheKey: MANAGED_STAGE_SUPPORT_VISIBILITY_BOOST_CACHE_KEY,
    status,
    ...details
  };
}
