// Camera-facing correction for imported ISONOTE boards.
// The LOD controller redraws/scales the boards; this late controller fixes the
// remaining orientation defect caused by applying a world camera quaternion as a
// local quaternion under rotated model roots.

const FACING_VERSION = 'annotation-isonote-world-facing-20260620';
const BOARD_TYPES = new Set(['ISONOTE_NAME_PLATE']);
const ISONOTE_BOARD_PREFIX = 'ISONOTE_BOARD_';

let modelRoot = null;
let camera = null;
let trackedBoards = [];
let rafId = 0;

bootstrapIsonoteFacingController();

function bootstrapIsonoteFacingController() {
  window.__3D_MARKUP_ISONOTE_FACING_VERSION__ = FACING_VERSION;
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
    collectBoards(modelRoot);
  }
  ensureLoop();
}

function ensureLoop() {
  if (rafId || !camera) return;
  const tick = () => {
    rafId = window.requestAnimationFrame(tick);
    updateFacing();
  };
  rafId = window.requestAnimationFrame(tick);
}

function collectBoards(root) {
  trackedBoards = [];
  if (!root?.traverse) return;

  root.traverse((object) => {
    const data = object.userData || {};
    const type = String(data.TYPE || data.type || '');
    const name = String(object.name || '');
    if (!object?.isMesh) return;
    if (!BOARD_TYPES.has(type) && !name.startsWith(ISONOTE_BOARD_PREFIX)) return;
    prepareBoard(object);
    trackedBoards.push(object);
  });

  window.dispatchEvent(new CustomEvent('viewer:isonote-facing-ready', {
    detail: { version: FACING_VERSION, boards: trackedBoards.length }
  }));
}

function prepareBoard(object) {
  object.userData.annotationFacingManaged = true;
  object.renderOrder = Math.max(object.renderOrder || 0, 150);
  applyMaterial(object, (material) => {
    // THREE.DoubleSide is numeric value 2. Avoid importing Three.js into this
    // controller and keep the board readable even if its original plane normal
    // points away from the camera.
    material.side = 2;
    material.depthTest = false;
    material.depthWrite = false;
    material.transparent = true;
    material.toneMapped = false;
    material.needsUpdate = true;
  });
}

function updateFacing() {
  if (!camera || !trackedBoards.length) return;
  for (const object of trackedBoards) {
    if (!object?.parent || object.visible === false) continue;
    faceCameraInWorldSpace(object);
  }
}

function faceCameraInWorldSpace(object) {
  const Quaternion = camera.quaternion?.constructor;
  if (!Quaternion || !object?.quaternion) return;

  const targetWorldQuaternion = new Quaternion().copy(camera.quaternion);
  const parentWorldQuaternion = new Quaternion();
  if (typeof object.parent?.getWorldQuaternion === 'function') {
    object.parent.getWorldQuaternion(parentWorldQuaternion);
  } else if (typeof parentWorldQuaternion.identity === 'function') {
    parentWorldQuaternion.identity();
  }

  const parentInverse = new Quaternion().copy(parentWorldQuaternion);
  if (typeof parentInverse.invert === 'function') parentInverse.invert();
  else if (typeof parentInverse.inverse === 'function') parentInverse.inverse();

  object.quaternion.copy(parentInverse.multiply(targetWorldQuaternion));
}

function applyMaterial(object, visitor) {
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  for (const material of materials) {
    if (material) visitor(material);
  }
}
