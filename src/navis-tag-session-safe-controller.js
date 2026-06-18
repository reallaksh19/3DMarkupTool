import * as THREE from 'three';
import { createTextPlane } from './geometry.js?v=professional-viewer-3';

const STORAGE_KEY = '3dmarkup.navisTagSession.safe.v1';
const SESSION_LAYER_NAME = 'NAVIS_TAG_SESSION_SAFE_LAYER';
const SESSION_PREFIX = 'NAVIS_MANUAL_TAG_SESSION_';
const TAG_ORANGE = 0xffb020;
const TAG_BLUE = 0x66c2ff;

const runtime = window.__3D_MARKUP_CLIP_RUNTIME__ || null;
const state = {
  renderer: runtime?.renderer || null,
  scene: runtime?.scene || null,
  camera: runtime?.camera || null,
  styleInjected: false
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initSafeTagSession, { once: true });
} else {
  initSafeTagSession();
}

window.addEventListener('markup:render-context', (event) => {
  const { renderer, scene, camera } = event.detail || {};
  if (renderer) state.renderer = renderer;
  if (scene) state.scene = scene;
  if (camera) state.camera = camera;
});

function initSafeTagSession() {
  injectStyles();
  injectButtons();
}

function injectButtons() {
  const group = document.querySelector('.navis-tag-tools');
  if (!group || document.getElementById('navisSaveTagSessionBtn')) return;

  const saveBtn = makeButton('navisSaveTagSessionBtn', 'Save Session', 'Save current tag viewpoints in this browser');
  const restoreBtn = makeButton('navisRestoreTagSessionBtn', 'Restore', 'Restore saved tag viewpoints from this browser');
  const clearBtn = makeButton('navisClearTagSessionBtn', 'Clear Session', 'Clear saved tag viewpoint session');

  const exportBtn = document.getElementById('navisExportTagsBtn');
  group.insertBefore(saveBtn, exportBtn || null);
  group.insertBefore(restoreBtn, exportBtn || null);
  group.insertBefore(clearBtn, exportBtn || null);

  saveBtn.addEventListener('click', saveSession);
  restoreBtn.addEventListener('click', restoreSession);
  clearBtn.addEventListener('click', clearSession);
}

function makeButton(id, text, title) {
  const button = document.createElement('button');
  button.id = id;
  button.type = 'button';
  button.className = 'tool-btn navis-tag-session-safe-btn';
  button.title = title;
  button.textContent = text;
  return button;
}

function saveSession() {
  const ctx = getContext();
  if (!ctx?.scene) {
    toast('Save Session: viewer is not ready.');
    return;
  }
  const tags = collectTags(ctx.scene).map(serializeTag).filter(Boolean);
  if (!tags.length) {
    toast('Save Session: no tag viewpoints found.');
    return;
  }
  const payload = {
    version: 1,
    savedAt: new Date().toISOString(),
    count: tags.length,
    tags
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    toast(`Saved ${tags.length} tag viewpoint(s).`);
  } catch (error) {
    console.warn('[3DMarkupTool] Failed to save tag session.', error);
    toast('Save Session failed. Browser storage may be blocked.');
  }
}

function restoreSession() {
  const ctx = getContext();
  if (!ctx?.scene) {
    toast('Restore: load/convert a model first.');
    return;
  }
  const payload = loadPayload();
  if (!payload?.tags?.length) {
    toast('Restore: no saved tag session found.');
    return;
  }

  clearRestoredDisplay(ctx.scene);
  const layer = ensureLayer(ctx.scene);
  let restored = 0;
  for (const raw of payload.tags) {
    const tag = deserializeTag(raw);
    if (!tag) continue;
    const group = renderSessionTag(tag, layer, ctx.camera);
    if (group) restored += 1;
  }
  toast(`Restored ${restored} tag viewpoint(s).`);
  refreshTagViewsIfOpen();
}

function clearSession() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('[3DMarkupTool] Failed to clear tag session.', error);
  }
  clearRestoredDisplay(getContext()?.scene);
  toast('Cleared saved tag session.');
  refreshTagViewsIfOpen();
}

function loadPayload() {
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.warn('[3DMarkupTool] Failed to read tag session.', error);
    return null;
  }
}

function ensureLayer(scene) {
  if (!scene) return null;
  let layer = scene.getObjectByName(SESSION_LAYER_NAME);
  if (!layer) {
    layer = new THREE.Group();
    layer.name = SESSION_LAYER_NAME;
    layer.userData = { isDisplayHelper: true, TYPE: 'NAVIS_TAG_SESSION_LAYER' };
    scene.add(layer);
  }
  return layer;
}

function clearRestoredDisplay(scene) {
  if (!scene) return;
  const layer = scene.getObjectByName(SESSION_LAYER_NAME);
  if (!layer) return;
  [...layer.children].forEach((child) => {
    layer.remove(child);
    disposeObject(child);
  });
}

function collectTags(scene) {
  const tags = [];
  if (!scene?.traverse) return tags;
  const nodePositions = collectNodePositions(scene);

  scene.traverse((object) => {
    const name = object.name || '';
    const data = object.userData || {};

    if (name.startsWith('NAVIS_IMPORTED_TAG_') || name.startsWith('NAVIS_MANUAL_TAG_')) {
      const tag = tagFromMarkup(object);
      if (tag) tags.push(tag);
      return;
    }

    if (data.TYPE === 'ISONOTE_NAME_PLATE') {
      const tag = tagFromIsonote(object, nodePositions, tags.length + 1);
      if (tag) tags.push(tag);
    }
  });

  return uniqueTags(tags);
}

function collectNodePositions(scene) {
  const positions = new Map();
  scene.traverse((object) => {
    const data = object.userData || {};
    if (data.TYPE === 'NODE' && data.NODE !== undefined) positions.set(String(data.NODE), worldPosition(object));
  });
  return positions;
}

function tagFromMarkup(object) {
  const line = object.children?.find((child) => child.name?.includes('TAG_LEADER'));
  const label = object.children?.find((child) => child.name?.includes('TAG_TEXT'));
  const { anchor, labelPoint } = pointsFromLine(line, label || object);
  if (!isFiniteVector(anchor) || !isFiniteVector(labelPoint)) return null;
  const body = label?.userData?.body || object.userData?.body || object.userData?.comment || object.name;
  const title = object.userData?.viewName || object.userData?.title || object.name;
  const source = object.name.startsWith('NAVIS_IMPORTED_TAG_') ? 'IMPORTED XML' : (object.userData?.source || 'MANUAL');
  return { id: object.name, source, title, body, anchor, labelPoint };
}

function tagFromIsonote(object, nodePositions, index) {
  const data = object.userData || {};
  const body = String(data.BOARD_TEXT || data.SOURCE_NOTE_NAME || data.sourceNoteName || '').trim();
  if (!body) return null;
  const node = String(data.NODE || data.node || '');
  const labelPoint = worldPosition(object);
  const anchor = nodePositions.get(node) || labelPoint.clone();
  if (!isFiniteVector(anchor) || !isFiniteVector(labelPoint)) return null;
  return {
    id: `isonote-session-${node || index}`,
    source: 'ISONOTE SIDELOAD',
    title: data.SOURCE_NOTE_NAME || data.sourceNoteName || `ISONOTE ${index}`,
    body,
    anchor,
    labelPoint
  };
}

function pointsFromLine(line, fallbackObject) {
  let anchor = null;
  let labelPoint = null;
  const points = line?.geometry?.attributes?.position;
  if (points?.count >= 2) {
    anchor = new THREE.Vector3(points.getX(0), points.getY(0), points.getZ(0)).applyMatrix4(line.matrixWorld);
    labelPoint = new THREE.Vector3(points.getX(1), points.getY(1), points.getZ(1)).applyMatrix4(line.matrixWorld);
  }
  if (!anchor || !labelPoint) {
    anchor = fallbackObject ? worldPosition(fallbackObject) : new THREE.Vector3();
    labelPoint = anchor.clone().add(new THREE.Vector3(1, 1, 1));
  }
  return { anchor, labelPoint };
}

function serializeTag(tag) {
  if (!tag || !isFiniteVector(tag.anchor) || !isFiniteVector(tag.labelPoint)) return null;
  return {
    id: String(tag.id || `tag-${Date.now()}`),
    source: String(tag.source || 'TAG'),
    title: String(tag.title || 'Tag View'),
    body: String(tag.body || tag.title || 'Tag'),
    anchor: vecToArray(tag.anchor),
    labelPoint: vecToArray(tag.labelPoint)
  };
}

function deserializeTag(raw) {
  const anchor = arrayToVec(raw?.anchor);
  const labelPoint = arrayToVec(raw?.labelPoint);
  if (!isFiniteVector(anchor) || !isFiniteVector(labelPoint)) return null;
  return {
    id: raw.id || `restored-${Date.now()}`,
    source: raw.source || 'RESTORED SESSION',
    title: raw.title || 'Restored Tag',
    body: raw.body || raw.title || 'Restored Tag',
    anchor,
    labelPoint
  };
}

function renderSessionTag(tag, layer, camera) {
  if (!layer) return null;
  const id = safeId(tag.id || `${Date.now()}`);
  const group = new THREE.Group();
  group.name = `${SESSION_PREFIX}${id}`;
  group.userData = {
    isDisplayHelper: true,
    TYPE: 'NAVIS_TAG_MARKUP',
    source: 'MANUAL',
    sessionSource: tag.source,
    viewName: tag.title,
    title: tag.title,
    body: tag.body
  };

  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([tag.anchor, tag.labelPoint]),
    new THREE.LineBasicMaterial({ color: TAG_ORANGE, depthTest: false, depthWrite: false })
  );
  line.name = `NAVIS_TAG_LEADER_SESSION_${id}`;
  line.renderOrder = 1230;

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(markerRadius(tag.anchor), 16, 8),
    new THREE.MeshBasicMaterial({ color: TAG_ORANGE, depthTest: false, depthWrite: false })
  );
  marker.name = `NAVIS_TAG_ANCHOR_SESSION_${id}`;
  marker.position.copy(tag.anchor);
  marker.renderOrder = 1231;

  const label = createTextPlane(tag.body || tag.title || 'Restored tag', {
    width: 760,
    height: 220,
    fontSize: 30,
    scale: Math.max(markerRadius(tag.anchor) * 12, 0.85),
    bg: 'rgba(11, 25, 42, 0.94)',
    border: '#66c2ff',
    name: `NAVIS_TAG_TEXT_SESSION_${id}`
  });
  label.position.copy(tag.labelPoint);
  label.renderOrder = 1232;
  label.userData = { isDisplayHelper: true, TYPE: 'NAVIS_TAG_TEXT', body: tag.body, title: tag.title };
  if (label.material) {
    label.material.depthTest = false;
    label.material.depthWrite = false;
  }
  if (camera) label.quaternion.copy(camera.quaternion);

  group.add(line, marker, label);
  layer.add(group);
  return group;
}

function uniqueTags(tags) {
  const seen = new Set();
  return tags.filter((tag) => {
    const key = `${tag.source}|${tag.title}|${tag.body}|${vectorSig(tag.anchor)}|${vectorSig(tag.labelPoint)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function refreshTagViewsIfOpen() {
  const panel = document.getElementById('navisTagViewPanel');
  const button = document.getElementById('navisTagViewsBtn');
  if (!panel || !button) return;
  window.setTimeout(() => {
    button.click();
    window.setTimeout(() => button.click(), 60);
  }, 80);
}

function getContext() {
  const runtimeState = window.__3D_MARKUP_CLIP_RUNTIME__ || {};
  return {
    renderer: runtimeState.renderer || state.renderer,
    scene: runtimeState.scene || state.scene,
    camera: runtimeState.camera || state.camera
  };
}

function worldPosition(object) {
  return object.getWorldPosition(new THREE.Vector3());
}

function markerRadius(position) {
  const camera = getContext()?.camera;
  if (!camera || !position) return 0.18;
  return Math.max(position.distanceTo(camera.position) * 0.007, 0.12);
}

function vecToArray(vec) {
  return [round(vec.x), round(vec.y), round(vec.z)];
}

function arrayToVec(value) {
  if (!Array.isArray(value) || value.length < 3) return null;
  const vec = new THREE.Vector3(Number(value[0]), Number(value[1]), Number(value[2]));
  return isFiniteVector(vec) ? vec : null;
}

function isFiniteVector(vec) {
  return !!vec && Number.isFinite(vec.x) && Number.isFinite(vec.y) && Number.isFinite(vec.z);
}

function vectorSig(vec) {
  return isFiniteVector(vec) ? `${round(vec.x)}:${round(vec.y)}:${round(vec.z)}` : 'invalid';
}

function round(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

function safeId(value) {
  return String(value || 'tag').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 80);
}

function disposeObject(object) {
  if (!object) return;
  object.traverse?.((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((mat) => mat?.dispose?.());
    else child.material?.dispose?.();
  });
}

function toast(message) {
  const status = document.getElementById('runtimeStatus');
  if (status) status.textContent = message;
  console.info(`[3DMarkupTool] ${message}`);
}

function injectStyles() {
  if (state.styleInjected || document.getElementById('navisTagSessionSafeStyles')) return;
  state.styleInjected = true;
  const style = document.createElement('style');
  style.id = 'navisTagSessionSafeStyles';
  style.textContent = `
    .navis-tag-session-safe-btn { white-space: nowrap; }
    .navis-tag-tools .navis-tag-session-safe-btn { min-width: 104px; }
  `;
  document.head.appendChild(style);
}
