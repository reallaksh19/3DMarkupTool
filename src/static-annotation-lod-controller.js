// Runtime annotation visibility controller.
// Keeps GLB/RVM annotation boards readable during orbit/zoom without changing
// engineering geometry. The converter exports annotation boards as mesh planes;
// this viewer-side controller treats them as overlay callouts.

const CONTROLLER_VERSION = 'annotation-billboard-lod-20260620';
const BOARD_TYPES = new Set(['ISONOTE_NAME_PLATE']);
const LEADER_TYPES = new Set(['ISONOTE_LEADER']);
const NODE_LABEL_PREFIX = 'NODE_LABEL_';
const ISONOTE_BOARD_PREFIX = 'ISONOTE_BOARD_';
const ISONOTE_LEADER_PREFIX = 'ISONOTE_LEADER_';

let modelRoot = null;
let camera = null;
let trackedBoards = [];
let trackedLeaders = [];
let rafId = 0;

bootstrapAnnotationController();

function bootstrapAnnotationController() {
  window.__3D_MARKUP_ANNOTATION_LOD_VERSION__ = CONTROLLER_VERSION;
  window.addEventListener('viewer:runtime-context', (event) => updateRuntime(event.detail || {}));
  window.addEventListener('markup:render-context', (event) => updateRuntime(event.detail || {}));
  window.addEventListener('viewer:model-loaded', (event) => {
    updateRuntime({ ...(event.detail || {}), ...(window.__3D_MARKUP_VIEWER_RUNTIME__ || {}) });
  });
  window.setTimeout(() => updateRuntime(window.__3D_MARKUP_VIEWER_RUNTIME__ || {}), 0);
  window.setTimeout(() => updateRuntime(window.__3D_MARKUP_VIEWER_RUNTIME__ || {}), 1000);
}

function updateRuntime(detail = {}) {
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || {};
  camera = detail.camera || runtime.camera || camera;
  const nextRoot = detail.modelRoot || runtime.modelRoot || null;
  if (nextRoot && nextRoot !== modelRoot) {
    modelRoot = nextRoot;
    collectAnnotations(modelRoot);
  }
  ensureLoop();
}

function ensureLoop() {
  if (rafId || !camera) return;
  const tick = () => {
    rafId = window.requestAnimationFrame(tick);
    updateAnnotationBillboards();
  };
  rafId = window.requestAnimationFrame(tick);
}

function collectAnnotations(root) {
  trackedBoards = [];
  trackedLeaders = [];
  if (!root?.traverse) return;

  root.traverse((object) => {
    const data = object.userData || {};
    const type = String(data.TYPE || data.type || '');
    const name = String(object.name || '');

    if (isAnnotationBoard(type, name, object)) {
      prepareBoard(object, type, name);
      trackedBoards.push(object);
      return;
    }

    if (isAnnotationLeader(type, name)) {
      prepareLeader(object);
      trackedLeaders.push(object);
    }
  });

  window.dispatchEvent(new CustomEvent('viewer:annotations-lod-ready', {
    detail: {
      version: CONTROLLER_VERSION,
      boards: trackedBoards.length,
      leaders: trackedLeaders.length
    }
  }));
}

function isAnnotationBoard(type, name, object) {
  if (!object?.isMesh) return false;
  if (BOARD_TYPES.has(type)) return true;
  if (name.startsWith(ISONOTE_BOARD_PREFIX)) return true;
  if (name.startsWith(NODE_LABEL_PREFIX)) return true;
  return false;
}

function isAnnotationLeader(type, name) {
  return LEADER_TYPES.has(type) || name.startsWith(ISONOTE_LEADER_PREFIX);
}

function prepareBoard(object, type, name) {
  object.userData.annotationLodManaged = true;
  object.userData.annotationLodType = BOARD_TYPES.has(type) || name.startsWith(ISONOTE_BOARD_PREFIX) ? 'isonote-board' : 'node-label';
  object.userData.annotationBaseScale = object.userData.annotationBaseScale || [object.scale.x, object.scale.y, object.scale.z];
  object.userData.annotationBaseHeight = object.userData.annotationBaseHeight || geometryHeight(object);
  object.renderOrder = Math.max(object.renderOrder || 0, object.userData.annotationLodType === 'isonote-board' ? 90 : 85);

  if (object.material) {
    object.material.depthTest = false;
    object.material.depthWrite = false;
    object.material.transparent = true;
    if (object.userData.annotationLodType === 'isonote-board') object.material.opacity = 0.92;
    object.material.needsUpdate = true;
  }
}

function prepareLeader(object) {
  object.renderOrder = Math.max(object.renderOrder || 0, 82);
  object.userData.annotationLodManaged = true;
  object.userData.annotationLodType = 'isonote-leader';
  applyMaterial(object, (material) => {
    material.depthTest = false;
    material.depthWrite = false;
    material.transparent = true;
    material.opacity = Math.min(Number.isFinite(material.opacity) ? material.opacity : 1, 0.32);
    material.needsUpdate = true;
  });
}

function updateAnnotationBillboards() {
  if (!camera || !trackedBoards.length) return;
  const Vector3 = camera.position?.constructor;
  if (!Vector3) return;
  const worldPosition = new Vector3();

  for (const object of trackedBoards) {
    if (!object?.parent) continue;
    object.getWorldPosition(worldPosition);
    const distance = Math.max(camera.position.distanceTo(worldPosition), 0.001);
    object.quaternion.copy(camera.quaternion);
    applyScreenStableScale(object, distance);
  }
}

function applyScreenStableScale(object, distance) {
  const baseScale = object.userData.annotationBaseScale || [1, 1, 1];
  const baseHeight = Math.max(Number(object.userData.annotationBaseHeight) || 1, 0.001);
  const isBoard = object.userData.annotationLodType === 'isonote-board';
  const fovRad = ((Number(camera.fov) || 48) * Math.PI) / 180;
  const visibleHeight = 2 * Math.tan(fovRad / 2) * distance;
  const desiredScreenFraction = isBoard ? 0.072 : 0.034;
  const rawScale = (visibleHeight * desiredScreenFraction) / baseHeight;
  const scale = isBoard ? clamp(rawScale, 0.10, 0.34) : clamp(rawScale, 0.34, 1.10);
  object.scale.set(baseScale[0] * scale, baseScale[1] * scale, baseScale[2] * scale);
}

function geometryHeight(object) {
  const geometry = object.geometry;
  if (!geometry) return 1;
  if (!geometry.boundingBox && typeof geometry.computeBoundingBox === 'function') geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return 1;
  return Math.max(Math.abs(box.max.y - box.min.y), 0.001);
}

function applyMaterial(object, callback) {
  if (object.material) {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material && callback(material));
  }
  object.children?.forEach?.((child) => applyMaterial(child, callback));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
