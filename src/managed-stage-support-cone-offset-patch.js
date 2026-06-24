export const MANAGED_STAGE_SUPPORT_CONE_OFFSET_PATCH_SCHEMA = 'ManagedStageSupportConeOffsetPatch.v1';
export const MANAGED_STAGE_SUPPORT_CONE_OFFSET_PATCH_CACHE_KEY = '20260624-support-cone-can-catalogue-1';

installManagedStageSupportConeOffsetPatch();

export function installManagedStageSupportConeOffsetPatch({ win = globalThis.window } = {}) {
  if (!win || win.__3D_MARKUP_SUPPORT_CONE_OFFSET_PATCH__?.schema === MANAGED_STAGE_SUPPORT_CONE_OFFSET_PATCH_SCHEMA) {
    return win?.__3D_MARKUP_SUPPORT_CONE_OFFSET_PATCH__ || null;
  }

  const api = {
    schema: MANAGED_STAGE_SUPPORT_CONE_OFFSET_PATCH_SCHEMA,
    cacheKey: MANAGED_STAGE_SUPPORT_CONE_OFFSET_PATCH_CACHE_KEY,
    apply: (modelRoot = null, reason = 'manual') => applyConeOffsets(resolveModelRoot(win, modelRoot), reason)
  };
  win.__3D_MARKUP_SUPPORT_CONE_OFFSET_PATCH__ = api;

  win.addEventListener?.('managed-stage:support-preview-auto-apply-result', (event) => {
    api.apply(event?.detail?.modelRoot, 'support-preview-auto-apply-result');
  });
  win.addEventListener?.('viewer:managed-stage-json-loaded', (event) => {
    win.setTimeout?.(() => api.apply(event?.detail?.modelRoot, 'managed-stage-json-loaded'), 0);
  });
  win.setTimeout?.(() => api.apply(null, 'install'), 0);
  return api;
}

export function applyConeOffsets(modelRoot, reason = 'manual') {
  if (!modelRoot?.traverse) return coneOffsetResult('skipped', { reason: 'missing modelRoot', requestedBy: reason });
  const cones = [];
  modelRoot.traverse((object) => {
    const data = object?.userData || {};
    if (data.supportDirectionalCone === true && data.supportWarningCone !== true && data.supportConeCatalogueOdOffsetApplied !== true) {
      cones.push(object);
    }
  });

  let odHalfCount = 0;
  let odTwoThirdsCount = 0;
  let maxOffsetMm = 0;
  for (const cone of cones) {
    const root = findSupportRoot(cone);
    const visual = root?.userData?.supportVisual || {};
    const data = cone.userData || {};
    const odMm = Math.max(Number(visual.pipeDiameterMm || 0), 0);
    if (!Number.isFinite(odMm) || odMm <= 0) continue;
    const axisVec = axisVector(data.axis || '+Y');
    let offset;
    let kind;
    if (data.axialPipeParallel === true) {
      offset = axialDisplayOffsetVector(visual.pipeDirection, axisVec).multiplyScalar(odMm * (2 / 3));
      kind = 'OD_TWO_THIRDS_AXIAL_DISPLAY';
      odTwoThirdsCount += 1;
    } else {
      const sign = data.pointsTowardCenter === false ? -1 : 1;
      const gapMm = Math.max(Number(data.gapMm || visual.gapMm || 0), 0);
      offset = axisVec.multiplyScalar(((odMm * 0.5) + gapMm) * sign);
      kind = 'OD_HALF_RADIAL_CONTACT';
      odHalfCount += 1;
    }
    if (!offset || offset.lengthSq() <= 0) continue;
    cone.position?.add?.(offset);
    maxOffsetMm = Math.max(maxOffsetMm, offset.length());
    cone.userData = {
      ...cone.userData,
      supportConeCatalogueOdOffsetApplied: true,
      supportConeCatalogueOdOffsetKind: kind,
      supportConeCatalogueOdOffsetMm: vecToRoundedPoint(offset),
      supportConeCatalogueOdOffsetMagnitudeMm: round(offset.length()),
      supportConeCatalogueOdOffsetPolicy: kind === 'OD_TWO_THIRDS_AXIAL_DISPLAY'
        ? 'ODx2/3 display offset applied only to final axial/pipe-parallel cone glyphs'
        : 'OD/2 radial contact offset applied to REST/GUIDE/HOLDDOWN cone glyphs; record-local gap is added after OD/2'
    };
  }

  const result = coneOffsetResult('applied', {
    requestedBy: reason,
    coneCount: cones.length,
    odHalfContactOffsetCount: odHalfCount,
    odTwoThirdsAxialOffsetCount: odTwoThirdsCount,
    maxAppliedOffsetMm: round(maxOffsetMm)
  });
  modelRoot.userData = {
    ...(modelRoot.userData || {}),
    managedStageSupportConeOffsetPatch: result
  };
  return result;
}

function resolveModelRoot(win, explicitRoot) {
  if (explicitRoot?.traverse) return explicitRoot;
  const runtime = win?.__3D_MARKUP_VIEWER_RUNTIME__ || win?.__3D_MARKUP_CLIP_RUNTIME__ || {};
  return runtime.getModelRoot?.() || runtime.modelRoot || null;
}

function findSupportRoot(object) {
  let current = object;
  while (current) {
    if (current.userData?.managedStageSupportVisual === true) return current;
    current = current.parent;
  }
  return null;
}

function axialDisplayOffsetVector(pipeDirection, fallbackAxis) {
  const pipe = vectorFromPoint(pipeDirection, fallbackAxis || [1, 0, 0]).normalize();
  const preferred = Math.abs(pipe.y) < 0.88 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const seed = vectorFromPoint(preferred, [0, 1, 0]);
  const offset = new Vector3().crossVectors(pipe, seed);
  if (offset.lengthSq() <= 1e-9) return new Vector3(0, 0, 1);
  return offset.normalize();
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

function vecToRoundedPoint(vec) {
  return { x: round(vec.x), y: round(vec.y), z: round(vec.z) };
}

function round(value) {
  if (!Number.isFinite(value)) return null;
  return Number(Number(value).toFixed(9));
}

function coneOffsetResult(status, details = {}) {
  return {
    schema: MANAGED_STAGE_SUPPORT_CONE_OFFSET_PATCH_SCHEMA,
    cacheKey: MANAGED_STAGE_SUPPORT_CONE_OFFSET_PATCH_CACHE_KEY,
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
    const len = this.length() || 1;
    this.x /= len;
    this.y /= len;
    this.z /= len;
    return this;
  }

  multiplyScalar(value) {
    this.x *= value;
    this.y *= value;
    this.z *= value;
    return this;
  }

  crossVectors(a, b) {
    const ax = a.x;
    const ay = a.y;
    const az = a.z;
    const bx = b.x;
    const by = b.y;
    const bz = b.z;
    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;
    return this;
  }
}