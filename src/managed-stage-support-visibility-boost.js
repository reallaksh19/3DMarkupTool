export const MANAGED_STAGE_SUPPORT_VISIBILITY_BOOST_SCHEMA = 'ManagedStageSupportVisibilityBoost.v3';
export const MANAGED_STAGE_SUPPORT_VISIBILITY_BOOST_CACHE_KEY = '20260624-support-od-offset-human-scale-1';

const DEFAULT_BOOST_POLICY = Object.freeze({
  minRadialScale: 50,
  maxRadialScale: 70,
  supportRenderOrder: 1350,
  supportRootRenderOrder: 1340,
  opacity: 1,
  emissiveIntensity: 0.58,
  depthTest: false,
  depthWrite: false,
  humanReadableScaleFactor: 50,
  odHalfContactOffsetFactor: 0.5,
  odTwoThirdsAxialDisplayOffsetFactor: 2 / 3
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
      supportVisibilityHumanScaleFactor: policy.humanReadableScaleFactor,
      supportOdOffsetPolicy: 'OD/2 radial contact for REST/GUIDE/HOLDDOWN; ODx2/3 display offset only for final axial/pipe-parallel LINE_STOP/LIMIT glyphs'
    };
  }

  let materialBoostedCount = 0;
  let radialScaleBoostedCount = 0;
  let odHalfContactOffsetCount = 0;
  let odTwoThirdsAxialOffsetCount = 0;
  let maxAppliedRadialScale = 1;
  let maxAppliedOdOffsetMm = 0;
  for (const part of parts) {
    part.visible = true;
    part.frustumCulled = false;
    part.renderOrder = Math.max(Number(part.renderOrder || 0), policy.supportRenderOrder);
    const offsetResult = applySupportOdOffset(part, policy);
    if (offsetResult?.kind === 'OD_HALF_RADIAL_CONTACT') odHalfContactOffsetCount += 1;
    if (offsetResult?.kind === 'OD_TWO_THIRDS_AXIAL_DISPLAY') odTwoThirdsAxialOffsetCount += 1;
    if (offsetResult) maxAppliedOdOffsetMm = Math.max(maxAppliedOdOffsetMm, Number(offsetResult.magnitudeMm || 0));
    if (part.material) {
      boostMaterial(part, policy);
      materialBoostedCount += 1;
    }
    if (shouldThickenSupportPart(part)) {
      const before = { x: Number(part.scale?.x || 1), z: Number(part.scale?.z || 1) };
      const targetScale = Math.max(
        Number(policy.humanReadableScaleFactor || 50),
        Number(policy.minRadialScale || 50),
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
      supportVisibilityBoostPolicy: 'render-order + depth-safe material + >=50x radial thickening + explicit OD/2 or ODx2/3 support display offset; no added primitives'
    };
  }

  const result = visibilityResult('applied', {
    rootCount: roots.length,
    partCount: parts.length,
    materialBoostedCount,
    radialScaleBoostedCount,
    odHalfContactOffsetCount,
    odTwoThirdsAxialOffsetCount,
    renderOrder: policy.supportRenderOrder,
    minRadialScale: policy.minRadialScale,
    maxRadialScale: policy.maxRadialScale,
    humanReadableScaleFactor: policy.humanReadableScaleFactor,
    odHalfContactOffsetFactor: policy.odHalfContactOffsetFactor,
    odTwoThirdsAxialDisplayOffsetFactor: policy.odTwoThirdsAxialDisplayOffsetFactor,
    maxAppliedRadialScale,
    maxAppliedOdOffsetMm
  });
  modelRoot.userData = {
    ...(modelRoot.userData || {}),
    managedStageSupportVisibilityBoost: result
  };
  return result;
}

function applySupportOdOffset(part, policy) {
  const data = part?.userData || {};
  if (!isDirectionalSupportGlyph(data) || data.supportVisibilityOdOffsetApplied === true) return null;
  const root = findSupportRoot(part);
  const visual = root?.userData?.supportVisual || {};
  const odMm = Math.max(Number(visual.pipeDiameterMm || 0), 0);
  if (!Number.isFinite(odMm) || odMm <= 0) return null;

  const axis = String(data.axis || '').trim() || '+Y';
  const axisVec = axisVector(axis);
  let kind = '';
  let offset = null;
  let factor = 0;

  if (data.axialPipeParallel === true) {
    factor = Number(policy.odTwoThirdsAxialDisplayOffsetFactor || (2 / 3));
    offset = axialDisplayOffsetVector(visual.pipeDirection, axisVec).multiplyScalar(odMm * factor);
    kind = 'OD_TWO_THIRDS_AXIAL_DISPLAY';
  } else {
    factor = Number(policy.odHalfContactOffsetFactor || 0.5);
    const sign = data.pointsTowardCenter === false ? -1 : 1;
    offset = axisVec.multiplyScalar(odMm * factor * sign);
    kind = 'OD_HALF_RADIAL_CONTACT';
  }

  if (!offset || offset.lengthSq() <= 0) return null;
  part.position?.add?.(offset);
  const roundedOffset = vecToRoundedPoint(offset);
  const magnitudeMm = round(offset.length());
  part.userData = {
    ...(part.userData || {}),
    supportVisibilityOdOffsetApplied: true,
    supportVisibilityOdOffsetKind: kind,
    supportVisibilityOdOffsetMm: roundedOffset,
    supportVisibilityOdOffsetMagnitudeMm: magnitudeMm,
    supportVisibilityOdOffsetPipeDiameterMm: round(odMm),
    supportVisibilityOdOffsetFactor: round(factor),
    supportVisibilityOdOffsetPolicy: kind === 'OD_TWO_THIRDS_AXIAL_DISPLAY'
      ? 'ODx2/3 display offset is applied only to final axial/pipe-parallel support glyphs; OD/2 radial contact is intentionally not used for axial glyphs'
      : 'OD/2 radial contact offset moves REST/GUIDE/HOLDDOWN glyph tips to pipe outside surface before the visibility scale is applied'
  };
  return { kind, offsetMm: roundedOffset, magnitudeMm };
}

function findSupportRoot(object) {
  let current = object;
  while (current) {
    if (current.userData?.managedStageSupportVisual === true) return current;
    current = current.parent;
  }
  return null;
}

function isDirectionalSupportGlyph(data = {}) {
  return data.supportDirectionalGlyphBar === true
    || data.supportGlyphStemBar === true
    || data.supportGlyphTipTick === true;
}

function axialDisplayOffsetVector(pipeDirection, fallbackAxis) {
  const pipe = vectorFromPoint(pipeDirection, fallbackAxis || [1, 0, 0]).normalize();
  const preferred = Math.abs(pipe.y) < 0.88 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const seed = vectorFromPoint(preferred, [0, 1, 0]);
  const offset = new Vector3().crossVectors(pipe, seed);
  if (offset.lengthSq() <= 1e-9) return new Vector3(0, 0, 1);
  return offset.normalize();
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

function axisVector(axis) {
  const src = String(axis || '+X').trim().toUpperCase();
  const sign = src.startsWith('-') ? -1 : 1;
  const a = src.replace(/[+-]/g, '');
  if (a === 'Y') return new Vector3(0, sign, 0);
  if (a === 'Z') return new Vector3(0, 0, sign);
  return new Vector3(sign, 0, 0);
}

function vectorFromPoint(value, fallback = [0, 1, 0]) {
  if (value?.x !== undefined || value?.y !== undefined || value?.z !== undefined) {
    return new Vector3(Number(value.x) || 0, Number(value.y) || 0, Number(value.z) || 0);
  }
  if (Array.isArray(value)) return new Vector3(Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0);
  return new Vector3(Number(fallback[0]) || 0, Number(fallback[1]) || 0, Number(fallback[2]) || 0);
}

function clampScale(value, max) {
  return Math.max(1, Math.min(Number(value) || 1, Number(max) || 70));
}

function vecToRoundedPoint(vec) {
  return { x: round(vec.x), y: round(vec.y), z: round(vec.z) };
}

function round(value) {
  if (!Number.isFinite(value)) return null;
  return Number(Number(value).toFixed(9));
}

function visibilityResult(status, details = {}) {
  return {
    schema: MANAGED_STAGE_SUPPORT_VISIBILITY_BOOST_SCHEMA,
    cacheKey: MANAGED_STAGE_SUPPORT_VISIBILITY_BOOST_CACHE_KEY,
    status,
    ...details
  };
}

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  length() {
    return Math.sqrt(this.lengthSq());
  }

  normalize() {
    const len = this.length();
    if (len > 1e-9) {
      this.x /= len;
      this.y /= len;
      this.z /= len;
    }
    return this;
  }

  multiplyScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }

  crossVectors(a, b) {
    const ax = Number(a.x) || 0;
    const ay = Number(a.y) || 0;
    const az = Number(a.z) || 0;
    const bx = Number(b.x) || 0;
    const by = Number(b.y) || 0;
    const bz = Number(b.z) || 0;
    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;
    return this;
  }
}