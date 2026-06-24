export const MANAGED_STAGE_SUPPORT_VISIBILITY_BOOST_SCHEMA = 'ManagedStageSupportVisibilityBoost.v2';
export const MANAGED_STAGE_SUPPORT_VISIBILITY_BOOST_CACHE_KEY = '20260624-support-human-visible-scale-1';

const DEFAULT_BOOST_POLICY = Object.freeze({
  minRadialScale: 10,
  maxRadialScale: 14,
  supportRenderOrder: 1250,
  supportRootRenderOrder: 1240,
  opacity: 1,
  emissiveIntensity: 0.42,
  depthTest: false,
  depthWrite: false,
  humanReadableScaleFactor: 10
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
      supportVisibilityBoostCacheKey: MANAGED_STAGE_SUPPORT_VISIBILITY_BOOST_CACHE_KEY,
      supportVisibilityHumanScaleFactor: policy.humanReadableScaleFactor
    };
  }

  let materialBoostedCount = 0;
  let radialScaleBoostedCount = 0;
  let maxAppliedRadialScale = 1;
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
      const targetScale = Math.max(
        Number(policy.humanReadableScaleFactor || 10),
        Number(policy.minRadialScale || 10),
        before.x,
        before.z
      );
      const nextScale = clampScale(targetScale, policy.maxRadialScale);
      part.scale.x = Math.max(part.scale.x || 1, nextScale);
      part.scale.z = Math.max(part.scale.z || 1, nextScale);
      maxAppliedRadialScale = Math.max(maxAppliedRadialScale, nextScale);
      radialScaleBoostedCount += 1;
      part.userData = {
        ...(part.userData || {}),
        supportVisibilityRadialScaleBefore: before,
        supportVisibilityRadialScaleApplied: nextScale,
        supportVisibilityHumanScaleFactor: policy.humanReadableScaleFactor
      };
    }
    part.userData = {
      ...(part.userData || {}),
      supportVisibilityBoostApplied: true,
      supportVisibilityBoostSchema: MANAGED_STAGE_SUPPORT_VISIBILITY_BOOST_SCHEMA,
      supportVisibilityBoostCacheKey: MANAGED_STAGE_SUPPORT_VISIBILITY_BOOST_CACHE_KEY,
      supportVisibilityBoostPolicy: 'render-order + depth-safe material + >=10x radial thickening; no added primitives'
    };
  }

  const result = visibilityResult('applied', {
    rootCount: roots.length,
    partCount: parts.length,
    materialBoostedCount,
    radialScaleBoostedCount,
    renderOrder: policy.supportRenderOrder,
    minRadialScale: policy.minRadialScale,
    maxRadialScale: policy.maxRadialScale,
    humanReadableScaleFactor: policy.humanReadableScaleFactor,
    maxAppliedRadialScale
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
  return Math.max(1, Math.min(Number(value) || 1, Number(max) || 14));
}

function visibilityResult(status, details = {}) {
  return {
    schema: MANAGED_STAGE_SUPPORT_VISIBILITY_BOOST_SCHEMA,
    cacheKey: MANAGED_STAGE_SUPPORT_VISIBILITY_BOOST_CACHE_KEY,
    status,
    ...details
  };
}
