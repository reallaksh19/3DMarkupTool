// Runtime annotation visibility controller.
// Keeps GLB/RVM annotation boards readable during orbit/zoom without changing
// engineering geometry. The converter exports annotation boards as mesh planes;
// this viewer-side controller treats them as overlay callouts.

const CONTROLLER_VERSION = 'annotation-isonote-readable-v2-20260620';
const BOARD_TYPES = new Set(['ISONOTE_NAME_PLATE']);
const LEADER_TYPES = new Set(['ISONOTE_LEADER']);
const NODE_LABEL_PREFIX = 'NODE_LABEL_';
const ISONOTE_BOARD_PREFIX = 'ISONOTE_BOARD_';
const ISONOTE_LEADER_PREFIX = 'ISONOTE_LEADER_';

// Visual policy:
// - ISONOTE boards are primary review callouts and must remain readable.
//   Do not only scale the old GLB texture: replace its texture image with a
//   high-resolution callout canvas so close/overview views both remain sharp.
// - Node labels are secondary metadata: show fewer, larger labels with a minimum
//   screen-space separation instead of many tiny labels pasted onto components.
// - Labels are offset in camera screen space and slightly above the model so they
//   do not sit directly on valve/flange/pipe silhouettes.
// - Leaders should indicate attachment without becoming foreground wires.
const NODE_LABEL_MAX_VISIBLE = 10;
const NODE_LABEL_MIN_SCREEN_PX = 132;
const NODE_LABEL_GRID_PX = 190;
const NODE_LABEL_MAX_PER_GRID_CELL = 1;
const NODE_LABEL_VERTICAL_OFFSET_FACTOR = 3.6;
const NODE_LABEL_SCREEN_RIGHT_OFFSET_FACTOR = 0.92;
const NODE_LABEL_SCREEN_UP_OFFSET_FACTOR = 1.15;
const NODE_LABEL_TARGET_SCREEN_FRACTION = 0.056;
const ISONOTE_TARGET_SCREEN_FRACTION = 0.18;
const ISONOTE_MIN_SCALE = 0.48;
const ISONOTE_MAX_SCALE = 1.35;
const ISONOTE_SCREEN_RIGHT_OFFSET_FACTOR = 0.095;
const ISONOTE_SCREEN_UP_OFFSET_FACTOR = 0.048;
const ISONOTE_CANVAS_WIDTH = 1600;
const ISONOTE_CANVAS_HEIGHT = 480;
const ISONOTE_MAX_TEXT_LINES = 2;
const ISONOTE_MAX_VISIBLE = 3;
const ISONOTE_MIN_SCREEN_PX = 230;

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
      nodeMinScreenPx: NODE_LABEL_MIN_SCREEN_PX,
      isonoteMaxVisible: ISONOTE_MAX_VISIBLE,
      isonoteReadableCanvas: `${ISONOTE_CANVAS_WIDTH}x${ISONOTE_CANVAS_HEIGHT}`
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
  object.userData.annotationStableJitter = object.userData.annotationStableJitter ?? stableJitter(name || type || 'annotation');
  object.renderOrder = Math.max(object.renderOrder || 0, isIsonote ? 140 : 112);

  if (isIsonote) redrawIsonoteBoard(object);

  applyMaterial(object, (material) => {
    material.depthTest = false;
    material.depthWrite = false;
    material.transparent = true;
    material.opacity = 1.0;
    material.toneMapped = false;
    material.alphaTest = isIsonote ? 0.02 : material.alphaTest;
    material.needsUpdate = true;
    if (material.map) {
      material.map.generateMipmaps = false;
      material.map.needsUpdate = true;
    }
  });
}

function redrawIsonoteBoard(object) {
  const material = firstMappedMaterial(object) || firstMaterial(object);
  if (!material) return;
  const canvas = document.createElement('canvas');
  canvas.width = ISONOTE_CANVAS_WIDTH;
  canvas.height = ISONOTE_CANVAS_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const node = object.userData?.NODE || object.userData?.node || '';
  const rawText = object.userData?.BOARD_TEXT || object.userData?.SOURCE_NOTE_NAME || object.userData?.sourceNoteName || object.name || '';
  const bodyText = normalizeIsonoteText(rawText);
  const title = node ? `ISONOTE N${node}` : 'ISONOTE';

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawRoundRect(ctx, 8, 8, canvas.width - 16, canvas.height - 16, 34, 'rgba(7,9,18,0.995)', '#ffd463', 8);
  drawRoundRect(ctx, 36, 34, 360, 86, 22, '#ffd463', 'rgba(255,255,255,0.38)', 3);

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.font = '900 46px Arial, Helvetica, sans-serif';
  ctx.fillStyle = '#101318';
  ctx.fillText(title, 62, 52);

  ctx.font = '900 74px Arial, Helvetica, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.92)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 3;

  const maxWidth = canvas.width - 112;
  const lines = wrapCanvasText(ctx, bodyText, maxWidth, ISONOTE_MAX_TEXT_LINES);
  const lineHeight = 92;
  const y0 = lines.length > 1 ? 164 : 194;
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], 56, y0 + i * lineHeight);
  }

  installCanvasTexture(material, canvas);
}

function installCanvasTexture(material, canvas) {
  const existing = material.map;
  if (existing) {
    const texture = typeof existing.clone === 'function' ? existing.clone() : existing;
    texture.image = canvas;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    material.map = texture;
    material.needsUpdate = true;
    return;
  }

  // Fallback for non-textured imported materials. Three.Texture is not imported in
  // this browser-side controller, so reuse a compatible constructor when possible.
  material.userData = material.userData || {};
  material.userData.annotationCanvasFallback = canvas;
  material.needsUpdate = true;
}

function prepareLeader(object) {
  object.renderOrder = Math.max(object.renderOrder || 0, 54);
  object.userData.annotationLodManaged = true;
  object.userData.annotationLodType = 'isonote-leader';
  applyMaterial(object, (material) => {
    material.depthTest = true;
    material.depthWrite = false;
    material.transparent = true;
    material.opacity = Math.min(Number.isFinite(material.opacity) ? material.opacity : 1, 0.08);
    material.needsUpdate = true;
  });
}

function updateAnnotationLod() {
  if (!camera) return;
  updateIsonoteBoards();
  updateNodeLabels();
}

function updateIsonoteBoards() {
  if (!trackedIsonoteBoards.length) return;
  const viewport = getViewportSize();
  const candidates = [];
  for (const object of trackedIsonoteBoards) {
    if (!object?.parent) continue;
    const screen = getScreenPosition(object, viewport);
    if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)) {
      setManagedVisible(object, false);
      continue;
    }
    candidates.push({ object, screen, distance: distanceToCamera(object) });
  }

  candidates.sort((a, b) => a.distance - b.distance || String(a.object.name).localeCompare(String(b.object.name)));
  const accepted = [];
  for (const candidate of candidates) {
    const spaced = accepted.every((other) => screenDistanceSq(candidate.screen, other.screen) >= ISONOTE_MIN_SCREEN_PX * ISONOTE_MIN_SCREEN_PX);
    if (accepted.length < ISONOTE_MAX_VISIBLE && spaced) {
      accepted.push(candidate);
      continue;
    }
    setManagedVisible(candidate.object, false);
  }

  for (const item of accepted) {
    const object = item.object;
    object.quaternion.copy(camera.quaternion);
    applyIsonoteOffset(object, item.distance);
    applyScreenStableScale(object, item.distance, 'isonote-board');
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
    applyNodeLabelOffset(object, item.distance);
    applyScreenStableScale(object, item.distance, 'node-label');
    setManagedVisible(object, true);
  }
}

function setManagedVisible(object, visible) {
  object.visible = (object.userData.annotationOriginalVisible !== false) && visible;
}

function applyIsonoteOffset(object, distance) {
  const basePosition = object.userData.annotationBasePosition || [object.position.x, object.position.y, object.position.z];
  const baseHeight = Math.max(Number(object.userData.annotationBaseHeight) || 1, 0.001);
  const right = cameraRightVector();
  const verticalOffset = clamp(baseHeight * 2.4 + worldUnitsForScreenFraction(distance, ISONOTE_SCREEN_UP_OFFSET_FACTOR), 3.6, 34);
  const sideOffset = clamp(worldUnitsForScreenFraction(distance, ISONOTE_SCREEN_RIGHT_OFFSET_FACTOR), 3.0, 24) * stableSide(object);
  object.position.set(
    basePosition[0] + right.x * sideOffset,
    basePosition[1] + verticalOffset,
    basePosition[2] + right.z * sideOffset
  );
}

function applyNodeLabelOffset(object, distance) {
  const basePosition = object.userData.annotationBasePosition || [object.position.x, object.position.y, object.position.z];
  const baseHeight = Math.max(Number(object.userData.annotationBaseHeight) || 1, 0.001);
  const worldPx = worldUnitsForScreenFraction(distance, 0.012);
  const verticalOffset = clamp(baseHeight * NODE_LABEL_VERTICAL_OFFSET_FACTOR + worldPx * NODE_LABEL_SCREEN_UP_OFFSET_FACTOR, 1.4, 16);
  const sideOffset = clamp(worldPx * NODE_LABEL_SCREEN_RIGHT_OFFSET_FACTOR, 0.6, 7.5) * stableSide(object);
  const right = cameraRightVector();
  object.position.set(
    basePosition[0] + right.x * sideOffset,
    basePosition[1] + verticalOffset,
    basePosition[2] + right.z * sideOffset
  );
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
  const dx = a.x;
  const dy = a.y;
  const ox = b.x;
  const oy = b.y;
  return (dx - ox) * (dx - ox) + (dy - oy) * (dy - oy);
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
  const desiredScreenFraction = kind === 'isonote-board' ? ISONOTE_TARGET_SCREEN_FRACTION : NODE_LABEL_TARGET_SCREEN_FRACTION;
  const rawScale = (visibleWorldHeightAtDistance(distance) * desiredScreenFraction) / baseHeight;
  const scale = kind === 'isonote-board' ? clamp(rawScale, ISONOTE_MIN_SCALE, ISONOTE_MAX_SCALE) : clamp(rawScale, 0.82, 1.65);
  object.scale.set(baseScale[0] * scale, baseScale[1] * scale, baseScale[2] * scale);
}

function visibleWorldHeightAtDistance(distance) {
  if (camera?.isOrthographicCamera) {
    const zoom = Math.max(Number(camera.zoom) || 1, 0.001);
    return Math.max(Math.abs((Number(camera.top) || 1) - (Number(camera.bottom) || -1)) / zoom, 0.001);
  }
  const fovRad = ((Number(camera?.fov) || 48) * Math.PI) / 180;
  return 2 * Math.tan(fovRad / 2) * Math.max(distance, 0.001);
}

function worldUnitsForScreenFraction(distance, fraction) {
  return visibleWorldHeightAtDistance(distance) * fraction;
}

function cameraRightVector() {
  const Vector3 = camera?.position?.constructor;
  if (!Vector3) return { x: 1, y: 0, z: 0 };
  const right = new Vector3(1, 0, 0);
  if (typeof right.applyQuaternion === 'function' && camera?.quaternion) right.applyQuaternion(camera.quaternion);
  right.y = 0;
  if (typeof right.normalize === 'function' && right.lengthSq?.() > 1e-8) right.normalize();
  return right;
}

function firstMaterial(object) {
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  return materials.find(Boolean) || null;
}

function firstMappedMaterial(object) {
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  return materials.find((material) => material?.map) || null;
}

function normalizeIsonoteText(value) {
  return String(value || '')
    .replace(/^ISONOTE[_\s-]*/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'DETAIL NOTE';
}

function wrapCanvasText(ctx, text, maxWidth, maxLines) {
  const words = normalizeIsonoteText(text).split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth || !line) {
      line = trial;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length >= maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  const usedWords = lines.join(' ').split(' ').filter(Boolean).length;
  if (words.length > usedWords && lines.length) {
    lines[lines.length - 1] = ellipsizeLine(ctx, lines[lines.length - 1], maxWidth);
  }
  return lines.length ? lines : ['DETAIL NOTE'];
}

function ellipsizeLine(ctx, line, maxWidth) {
  let text = String(line || '').trim();
  while (text.length > 1 && ctx.measureText(`${text} â€¦`).width > maxWidth) {
    text = text.replace(/\s*\S+$/, '').trim() || text.slice(0, -1).trim();
  }
  return `${text || line} â€¦`;
}

function drawRoundRect(ctx, x, y, w, h, r, fill, stroke, lineWidth) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function stableJitter(value) {
  let hash = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  return hash;
}

function stableSide(object) {
  const value = Number(object.userData.annotationStableJitter) || stableJitter(object.name || 'node-label');
  return (Math.abs(value) % 2) === 0 ? 1 : -1;
}

function geometryHeight(object) {
  const geometry = object.geometry;
  if (!geometry) return 1;
  if (!geometry.boundingBox && typeof geometry.computeBoundingBox === 'function') geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return 1;
  return Math.max(Math.abs(box.max.y - box.min.y), 0.001);
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}
