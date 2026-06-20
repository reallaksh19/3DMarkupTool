// Runtime annotation visibility controller.
// Keeps GLB/RVM annotation boards readable during orbit/zoom without changing
// engineering geometry. The converter exports annotation boards as mesh planes;
// this viewer-side controller treats them as overlay callouts.

const CONTROLLER_VERSION = 'annotation-density-lod-20260620';
const BOARD_TYPES = new Set(['ISONOTE_NAME_PLATE']);
const LEADER_TYPES = new Set(['ISONOTE_LEADER']);
const NODE_LABEL_PREFIX = 'NODE_LABEL_';
const ISONOTE_BOARD_PREFIX = 'ISONOTE_BOARD_';
const ISONOTE_LEADER_PREFIX = 'ISONOTE_LEADER_';

// Visual policy:
// - ISONOTE boards remain visible callouts, but smaller and camera-facing.
// - Node labels are diagnostic metadata, not primary geometry. Dense node stacks
//   around valves/flanges are culled by screen-space spacing and max count.
// - Leaders should not draw through the model as solid foreground geometry.
const NODE_LABEL_MAX_VISIBLE = 28;
const NODE_LABEL_MIN_SCREEN_PX = 56;
const NODE_LABEL_GRID_PX = 112;
const NODE_LABEL_MAX_PER_GRID_CELL = 1;
const NODE_LABEL_VERTICAL_OFFSET_FACTOR = 1.65;

let modelRoot = null;
let camera = null;
let trackedIsonoteBoards = [];
let trackedNodeLabels = [];
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
    updateAnnotationLod();
  };
  rafId = window.requestAnimationFrame(tick);
}

function collectAnnotations(root) {
  trackedIsonoteBoards = [];
  trackedNodeLabels = [];
  trackedLeaders = [];
  if (!root?.traverse) return;

  root.traverse((object) => {
    const data = object.userData || {};
    const type = String(data.TYPE || data.type || '');
    const name = String(object.name || '');

    if (isAnnotationBoard(type, name, object)) {
      prepareBoard(object, type, name);
      if (object.userData.annotationLodType === 'node-label') trackedNodeLabels.push(object);
      else trackedIsonoteBoards.push(object);
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
      isonoteBoards: trackedIsonoteBoards.length,
      nodeLabels: trackedNodeLabels.length,
      leaders: trackedLeaders.length,
      nodeMaxVisible: NODE_LABEL_MAX_VISIBLE,
      nodeMinScreenPx: NODE_LABEL_MIN_SCREEN_PX
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
  const isIsonote = BOARD_TYPES.has(type) || name.startsWith(ISONOTE_BOARD_PREFIX);
  object.userData.annotationLodManaged = true;
  object.userData.annotationLodType = isIsonote ? 'isonote-board' : 'node-label';
  object.userData.annotationOriginalVisible = object.visible !== false;
  object.userData.annotationBaseScale = object.userData.annotationBaseScale || [object.scale.x, object.scale.y, object.scale.z];
  object.userData.annotationBasePosition = object.userData.annotationBasePosition || [object.position.x, object.position.y, object.position.z];
  object.userData.annotationBaseHeight = object.userData.annotationBaseHeight || geometryHeight(object);
  object.renderOrder = Math.max(object.renderOrder || 0, isIsonote ? 90 : 84);

  if (object.material) {
    object.material.depthTest = false;
    object.material.depthWrite = false;
    object.material.transparent = true;
    object.material.opacity = isIsonote ? Math.min(Number.isFinite(object.material.opacity) ? object.material.opacity : 1, 0.88) : 0.92;
    object.material.needsUpdate = true;
  }
}

function prepareLeader(object) {
  object.renderOrder = Math.max(object.renderOrder || 0, 72);
  object.userData.annotationLodManaged = true;
  object.userData.annotationLodType = 'isonote-leader';
  applyMaterial(object, (material) => {
    // Leaders should not become foreground wires crossing the pipe run.
    material.depthTest = true;
    material.depthWrite = false;
    material.transparent = true;
    material.opacity = Math.min(Number.isFinite(material.opacity) ? material.opacity : 1, 0.18);
    material.needsUpdate = true;
  });
}

function updateAnnotationLod() {
  if (!camera) return;
  updateIsonoteBoards();
  updateNodeLabels();
}

function updateIsonoteBoards() {
  for (const object of trackedIsonoteBoards) {
    if (!object?.parent) continue;
    const distance = distanceToCamera(object);
    object.quaternion.copy(camera.quaternion);
    applyScreenStableScale(object, distance, 'isonote-board');
    setManagedVisible(object, true);
  }
}

function updateNodeLabels() {
  if (!trackedNodeLabels.length) return;
  const viewport = getViewportSize();
  const candidates = [];

  for (const object of trackedNodeLabels) {
    if (!object?.parent) continue;
    const screen = getScreenPosition(object, viewport);
    if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)) {
      setManagedVisible(object, false);
      continue;
    }
    candidates.push({ object, screen, distance: distanceToCamera(object) });
  }

  // Prefer near labels, but enforce screen spacing so valve/flange node stacks do
  // not form unreadable piles. This is deterministic for the same camera pose.
  candidates.sort((a, b) => a.distance - b.distance || String(a.object.name).localeCompare(String(b.object.name)));

  const accepted = [];
  const gridCounts = new Map();
  for (const candidate of candidates) {
    const key = gridKey(candidate.screen, NODE_LABEL_GRID_PX);
    const cellCount = gridCounts.get(key) || 0;
    const spaced = accepted.every((other) => screenDistanceSq(candidate.screen, other.screen) >= NODE_LABEL_MIN_SCREEN_PX * NODE_LABEL_MIN_SCREEN_PX);
    if (accepted.length < NODE_LABEL_MAX_VISIBLE && cellCount < NODE_LABEL_MAX_PER_GRID_CELL && spaced) {
      accepted.push(candidate);
      gridCounts.set(key, cellCount + 1);
      continue;
    }
    setManagedVisible(candidate.object, false);
  }

  for (const item of accepted) {
    const object = item.object;
    object.quaternion.copy(camera.quaternion);
    applyNodeLabelOffset(object);
    applyScreenStableScale(object, item.distance, 'node-label');
    setManagedVisible(object, true);
  }
}

function setManagedVisible(object, visible) {
  object.visible = (object.userData.annotationOriginalVisible !== false) && visible;
}

function applyNodeLabelOffset(object) {
  const basePosition = object.userData.annotationBasePosition || [object.position.x, object.position.y, object.position.z];
  const baseHeight = Math.max(Number(object.userData.annotationBaseHeight) || 1, 0.001);
  // Node labels belong above the inspected point, not directly pasted over pipe
  // cylinders or valve/flange plates. Keep this small so it remains local.
  const offset = clamp(baseHeight * NODE_LABEL_VERTICAL_OFFSET_FACTOR, 0.75, 8);
  object.position.set(basePosition[0], basePosition[1] + offset, basePosition[2]);
}

function getViewportSize() {
  return {
    width: Math.max(Number(window.innerWidth) || 1, 1),
    height: Math.max(Number(window.innerHeight) || 1, 1)
  };
}

function getScreenPosition(object, viewport) {
  const Vector3 = camera.position?.constructor;
  if (!Vector3 || typeof object.getWorldPosition !== 'function') return null;
  const point = new Vector3();
  object.getWorldPosition(point);
  if (typeof point.project !== 'function') return null;
  point.project(camera);
  if (point.z < -1 || point.z > 1) return null;
  return {
    x: (point.x * 0.5 + 0.5) * viewport.width,
    y: (-point.y * 0.5 + 0.5) * viewport.height,
    z: point.z
  };
}

function gridKey(screen, size) {
  return `${Math.floor(screen.x / size)}:${Math.floor(screen.y / size)}`;
}

function screenDistanceSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function distanceToCamera(object) {
  const Vector3 = camera.position?.constructor;
  if (!Vector3 || typeof object.getWorldPosition !== 'function') return 1;
  const worldPosition = new Vector3();
  object.getWorldPosition(worldPosition);
  return Math.max(camera.position.distanceTo(worldPosition), 0.001);
}

function applyScreenStableScale(object, distance, kind) {
  const baseScale = object.userData.annotationBaseScale || [1, 1, 1];
  const baseHeight = Math.max(Number(object.userData.annotationBaseHeight) || 1, 0.001);
  const fovRad = ((Number(camera.fov) || 48) * Math.PI) / 180;
  const visibleHeight = 2 * Math.tan(fovRad / 2) * distance;
  const desiredScreenFraction = kind === 'isonote-board' ? 0.048 : 0.026;
  const rawScale = (visibleHeight * desiredScreenFraction) / baseHeight;
  const scale = kind === 'isonote-board' ? clamp(rawScale, 0.075, 0.24) : clamp(rawScale, 0.22, 0.68);
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
