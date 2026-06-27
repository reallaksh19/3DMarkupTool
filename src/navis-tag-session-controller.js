import * as THREE from 'three';
import { createTextPlane } from './geometry.js?v=bust-cache-4';

const STORAGE_KEY = '3dmarkup.navisTagSession.v1';
const SESSION_LAYER_NAME = 'NAVIS_TAG_SESSION_DISPLAY_LAYER';
const SESSION_GROUP_PREFIX = 'NAVIS_MANUAL_TAG_SESSION_';
const SESSION_ORANGE = 0xffb020;
const SESSION_BLUE = 0x66c2ff;

const runtime = window.__3D_MARKUP_CLIP_RUNTIME__ || null;
const state = {
  renderer: runtime?.renderer || null,
  scene: runtime?.scene || null,
  camera: runtime?.camera || null,
  sessionLayer: null,
  restoredTags: [],
  activeHelper: null,
  lastAutosaveSignature: '',
  lastPanelSignature: '',
  autosaveTimer: null
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initNavisTagSession, { once: true });
} else {
  initNavisTagSession();
}

window.addEventListener('markup:render-context', (event) => {
  const { renderer, scene, camera } = event.detail || {};
  if (renderer) state.renderer = renderer;
  if (scene) state.scene = scene;
  if (camera) state.camera = camera;
  ensureSessionLayer(scene || state.scene);
  keepSessionLabelsFacingCamera();
  updateSessionPanel();
});

function initNavisTagSession() {
  injectStyles();
  injectButtons();
  ensureSessionPanel();
  ensureSessionLayer(getContext()?.scene);
  startAutosave();
  window.addEventListener('beforeunload', () => autosaveSession(true));
  setInterval(() => {
    keepSessionLabelsFacingCamera();
    updateSessionPanel();
  }, 1500);
}

function injectButtons() {
  const tagGroup = document.querySelector('.navis-tag-tools');
  if (!tagGroup || document.getElementById('navisSaveTagSessionBtn')) return;

  const saveBtn = document.createElement('button');
  saveBtn.id = 'navisSaveTagSessionBtn';
  saveBtn.type = 'button';
  saveBtn.className = 'tool-btn';
  saveBtn.title = 'Save current tag viewpoints in this browser session';
  saveBtn.textContent = 'Save Session';

  const restoreBtn = document.createElement('button');
  restoreBtn.id = 'navisRestoreTagSessionBtn';
  restoreBtn.type = 'button';
  restoreBtn.className = 'tool-btn';
  restoreBtn.title = 'Restore saved tag viewpoints from this browser session';
  restoreBtn.textContent = 'Restore';

  const clearBtn = document.createElement('button');
  clearBtn.id = 'navisClearTagSessionBtn';
  clearBtn.type = 'button';
  clearBtn.className = 'tool-btn';
  clearBtn.title = 'Clear saved/restored tag session data';
  clearBtn.textContent = 'Clear Session';

  const exportBtn = document.getElementById('navisExportTagsBtn');
  tagGroup.insertBefore(saveBtn, exportBtn || null);
  tagGroup.insertBefore(restoreBtn, exportBtn || null);
  tagGroup.insertBefore(clearBtn, exportBtn || null);

  saveBtn.addEventListener('click', () => saveSession(false));
  restoreBtn.addEventListener('click', restoreSession);
  clearBtn.addEventListener('click', clearSession);
}

function startAutosave() {
  if (state.autosaveTimer) return;
  state.autosaveTimer = setInterval(() => autosaveSession(false), 6000);
}

function autosaveSession(force) {
  const ctx = getContext();
  if (!ctx?.scene) return;
  const tags = collectSessionTags(ctx.scene);
  if (!tags.length) return;
  const signature = sessionSignature(tags);
  if (!force && signature === state.lastAutosaveSignature) return;
  state.lastAutosaveSignature = signature;
  persistTags(tags, 'autosave');
  updateSessionPanel();
}

function saveSession(manual = true) {
  const ctx = getContext();
  if (!ctx?.scene) {
    toast('Tag session save failed: viewer is not ready.');
    return;
  }
  const tags = collectSessionTags(ctx.scene);
  if (!tags.length) {
    toast('No tag viewpoints to save.');
    return;
  }
  persistTags(tags, 'manual');
  state.lastAutosaveSignature = sessionSignature(tags);
  updateSessionPanel();
  if (manual !== false) toast(`Saved ${tags.length} tag viewpoint(s) to browser session.`);
}

function persistTags(tags, mode) {
  const payload = {
    version: 1,
    mode,
    savedAt: new Date().toISOString(),
    count: tags.length,
    tags: tags.map(serializeTag).filter(Boolean)
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function restoreSession() {
  const ctx = getContext();
  if (!ctx?.scene) {
    toast('Restore failed: load/convert a model first.');
    return;
  }
  const payload = loadPayload();
  if (!payload?.tags?.length) {
    toast('No saved tag session found.');
    updateSessionPanel();
    return;
  }

  clearSessionDisplayOnly();
  const layer = ensureSessionLayer(ctx.scene);
  const restored = [];
  for (const raw of payload.tags) {
    const tag = deserializeTag(raw);
    if (!tag) continue;
    const group = renderSessionTag(tag, layer, ctx.camera);
    if (group) {
      tag.group = group;
      restored.push(tag);
    }
  }
  state.restoredTags = restored;
  window.__3D_MARKUP_NAVIS_SESSION_RESTORED__ = restored;
  updateSessionPanel(true);
  setTagViewsOpen(true);
  toast(`Restored ${restored.length} tag viewpoint(s) from session.`);
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
  clearSessionDisplayOnly();
  state.lastAutosaveSignature = '';
  updateSessionPanel(true);
  toast('Cleared saved tag session.');
}

function clearSessionDisplayOnly() {
  removeActiveHelper();
  for (const tag of state.restoredTags) {
    if (tag.group?.parent) tag.group.parent.remove(tag.group);
    disposeObject(tag.group);
  }
  state.restoredTags = [];
  const layer = state.sessionLayer;
  if (layer) {
    [...layer.children].forEach((child) => {
      if (child.name?.startsWith(SESSION_GROUP_PREFIX)) {
        layer.remove(child);
        disposeObject(child);
      }
    });
  }
}

function collectSessionTags(scene) {
  const tags = [];
  scene?.traverse?.((object) => {
    const name = object.name || '';
    const data = object.userData || {};

    if (name.startsWith('NAVIS_MANUAL_TAG_') || name.startsWith('NAVIS_IMPORTED_TAG_')) {
      const tag = tagFromMarkupGroup(object);
      if (tag) tags.push(tag);
      return;
    }

    if (data.TYPE === 'ISONOTE_NAME_PLATE') {
      const tag = tagFromIsonote(object, scene, tags.length + 1);
      if (tag) tags.push(tag);
    }
  });
  return uniqueTags(tags);
}

function tagFromMarkupGroup(object) {
  const source = object.name.startsWith('NAVIS_IMPORTED_TAG_') ? 'IMPORTED XML' : (object.userData?.sessionSource || object.userData?.source || 'MANUAL');
  const label = object.children.find((child) => child.name?.startsWith('NAVIS_TAG_TEXT_') || child.name?.startsWith('NAVIS_IMPORTED_TAG_TEXT_'));
  const line = object.children.find((child) => child.name?.startsWith('NAVIS_TAG_LEADER_') || child.name?.startsWith('NAVIS_IMPORTED_TAG_LEADER_'));
  const body = label?.userData?.body || object.userData?.body || object.userData?.comment || object.name;
  const title = object.userData?.title || object.userData?.name || readableName(object.name);
  const points = line?.geometry?.attributes?.position;
  let anchor = null;
  let labelPoint = null;
  if (points?.count >= 2) {
    anchor = new THREE.Vector3(points.getX(0), points.getY(0), points.getZ(0)).applyMatrix4(line.matrixWorld);
    labelPoint = new THREE.Vector3(points.getX(1), points.getY(1), points.getZ(1)).applyMatrix4(line.matrixWorld);
  } else {
    anchor = object.getWorldPosition(new THREE.Vector3());
    labelPoint = label?.getWorldPosition(new THREE.Vector3()) || anchor.clone().add(new THREE.Vector3(1, 1, 1));
  }
  if (!isFiniteVector(anchor) || !isFiniteVector(labelPoint)) return null;
  return {
    id: object.name,
    source,
    title,
    body: String(body || title || 'Tag').trim(),
    anchor,
    labelPoint,
    bounds: boundsAround(anchor, labelPoint)
  };
}

function tagFromIsonote(object, scene, index) {
  const data = object.userData || {};
  const body = String(data.BOARD_TEXT || data.SOURCE_NOTE_NAME || data.sourceNoteName || '').trim();
  if (!body) return null;
  const node = data.NODE || data.node || '';
  const labelPoint = object.getWorldPosition(new THREE.Vector3());
  const anchor = findIsonoteLeader(scene, node) || labelPoint.clone();
  if (!isFiniteVector(anchor) || !isFiniteVector(labelPoint)) return null;
  return {
    id: `isonote-session-${node || index}`,
    source: 'ISONOTE SIDELOAD',
    title: data.SOURCE_NOTE_NAME || data.sourceNoteName || `ISONOTE ${index}`,
    body,
    node,
    anchor,
    labelPoint,
    bounds: boundsAround(anchor, labelPoint)
  };
}

function findIsonoteLeader(scene, node) {
  let best = null;
  scene?.traverse?.((object) => {
    if (best) return;
    const data = object.userData || {};
    if (data.TYPE === 'ISONOTE_LEADER' && String(data.NODE || data.node || '') === String(node)) best = object.getWorldPosition(new THREE.Vector3());
  });
  return best;
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

function serializeTag(tag) {
  if (!tag || !isFiniteVector(tag.anchor) || !isFiniteVector(tag.labelPoint)) return null;
  return {
    id: String(tag.id || crypto.randomUUID?.() || Date.now()),
    source: tag.source || 'TAG',
    title: tag.title || tag.name || 'Tag View',
    body: tag.body || tag.title || 'Tag',
    node: tag.node || '',
    anchor: vecToArray(tag.anchor),
    labelPoint: vecToArray(tag.labelPoint),
    bounds: tag.bounds ? { min: vecToArray(tag.bounds.min), max: vecToArray(tag.bounds.max) } : null
  };
}

function deserializeTag(raw) {
  const anchor = arrayToVec(raw?.anchor);
  const labelPoint = arrayToVec(raw?.labelPoint) || anchor?.clone?.().add(new THREE.Vector3(1, 1, 1));
  if (!isFiniteVector(anchor) || !isFiniteVector(labelPoint)) return null;
  return {
    id: raw.id || `session-${Date.now()}`,
    source: raw.source || 'RESTORED SESSION',
    title: raw.title || raw.name || 'Restored Tag',
    body: raw.body || raw.title || 'Restored Tag',
    node: raw.node || '',
    anchor,
    labelPoint,
    bounds: raw.bounds ? new THREE.Box3(arrayToVec(raw.bounds.min), arrayToVec(raw.bounds.max)) : boundsAround(anchor, labelPoint)
  };
}

function renderSessionTag(tag, layer, camera) {
  if (!layer) return null;
  const group = new THREE.Group();
  group.name = `${SESSION_GROUP_PREFIX}${safeId(tag.id)}`;
  group.userData = {
    isDisplayHelper: true,
    TYPE: 'NAVIS_TAG_MARKUP',
    sessionSource: tag.source || 'RESTORED SESSION',
    source: tag.source || 'RESTORED SESSION',
    title: tag.title,
    body: tag.body
  };

  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([tag.anchor, tag.labelPoint]),
    new THREE.LineBasicMaterial({ color: SESSION_ORANGE, depthTest: false, depthWrite: false })
  );
  line.name = `NAVIS_TAG_LEADER_SESSION_${safeId(tag.id)}`;
  line.renderOrder = 1230;

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(markerRadius(tag.anchor), 18, 10),
    new THREE.MeshBasicMaterial({ color: SESSION_ORANGE, depthTest: false })
  );
  marker.name = `NAVIS_TAG_ANCHOR_SESSION_${safeId(tag.id)}`;
  marker.position.copy(tag.anchor);
  marker.renderOrder = 1231;

  const label = createTextPlane(tag.body || tag.title || 'Restored tag', {
    width: 760,
    height: 220,
    fontSize: 30,
    scale: Math.max(markerRadius(tag.anchor) * 12, 0.85),
    bg: 'rgba(11, 25, 42, 0.94)',
    border: '#66c2ff',
    name: `NAVIS_TAG_TEXT_SESSION_${safeId(tag.id)}`
  });
  label.position.copy(tag.labelPoint);
  label.renderOrder = 1232;
  label.material.depthTest = false;
  label.userData = { isDisplayHelper: true, TYPE: 'NAVIS_TAG_TEXT', source: tag.source || 'RESTORED SESSION', body: tag.body, title: tag.title };
  if (camera) label.lookAt(camera.position);

  group.add(line, marker, label);
  layer.add(group);
  return group;
}

function ensureSessionPanel() {
  const panel = document.getElementById('navisTagViewPanel');
  if (!panel) return null;
  let box = panel.querySelector('.navis-tag-session-box');
  if (box) return box;
  box = document.createElement('div');
  box.className = 'navis-tag-session-box';
  box.innerHTML = `
    <div class="navis-tag-session-title">Session</div>
    <div class="navis-tag-session-status">No saved tag session checked yet.</div>
    <div class="navis-tag-session-actions">
      <button type="button" data-session-action="save">Save</button>
      <button type="button" data-session-action="restore">Restore</button>
      <button type="button" data-session-action="clear">Clear</button>
    </div>
  `;
  const list = panel.querySelector('.navis-tag-view-list');
  panel.insertBefore(box, list || null);
  box.querySelector('[data-session-action="save"]')?.addEventListener('click', () => saveSession(true));
  box.querySelector('[data-session-action="restore"]')?.addEventListener('click', restoreSession);
  box.querySelector('[data-session-action="clear"]')?.addEventListener('click', clearSession);
  return box;
}

function updateSessionPanel(force = false) {
  const box = ensureSessionPanel();
  if (!box) return;
  const payload = loadPayload();
  const activeCount = collectSessionTags(getContext()?.scene).length;
  const savedCount = payload?.tags?.length || 0;
  const savedAt = payload?.savedAt ? new Date(payload.savedAt).toLocaleString() : 'not saved';
  const signature = `${activeCount}|${savedCount}|${savedAt}|${state.restoredTags.length}`;
  if (!force && signature === state.lastPanelSignature) return;
  state.lastPanelSignature = signature;
  const status = box.querySelector('.navis-tag-session-status');
  if (status) {
    status.innerHTML = `Active: <b>${activeCount}</b> Â· Saved: <b>${savedCount}</b> Â· Restored: <b>${state.restoredTags.length}</b><br><span>Saved at: ${escapeHtml(savedAt)}</span>`;
  }
}

function setTagViewsOpen(open) {
  const panel = document.getElementById('navisTagViewPanel');
  if (panel) panel.classList.toggle('open', Boolean(open));
  document.getElementById('navisTagViewsBtn')?.classList.toggle('tool-active', Boolean(open));
}

function loadPayload() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

function ensureSessionLayer(scene) {
  if (!scene) return null;
  if (state.sessionLayer && state.sessionLayer.parent === scene) return state.sessionLayer;
  let layer = scene.getObjectByName?.(SESSION_LAYER_NAME);
  if (!layer) {
    layer = new THREE.Group();
    layer.name = SESSION_LAYER_NAME;
    layer.userData = { isDisplayHelper: true, ignoreBounds: true };
    scene.add(layer);
  }
  state.sessionLayer = layer;
  return layer;
}

function keepSessionLabelsFacingCamera() {
  const camera = state.camera || runtime?.camera || window.__3D_MARKUP_CLIP_RUNTIME__?.camera;
  if (!camera || !state.sessionLayer) return;
  state.sessionLayer.traverse((object) => {
    if (object.name?.includes('TAG_TEXT_')) object.lookAt(camera.position);
  });
}

function markerRadius(point) {
  const ctx = getContext();
  if (!ctx?.camera || !point) return 0.08;
  return Math.max(ctx.camera.position.distanceTo(point) * 0.004, 0.04);
}

function boundsAround(a, b) {
  const box = new THREE.Box3().setFromPoints([a, b || a]);
  const pad = Math.max(a.distanceTo(b || a) * 0.08, markerRadius(a) * 2, 0.05);
  box.expandByScalar(pad);
  return box;
}

function getContext() {
  const live = window.__3D_MARKUP_CLIP_RUNTIME__ || runtime || {};
  const renderer = state.renderer || live.renderer;
  const scene = state.scene || live.scene;
  const camera = state.camera || live.camera;
  if (!renderer || !scene || !camera) return null;
  return { renderer, scene, camera };
}

function removeActiveHelper() {
  if (!state.activeHelper) return;
  if (state.activeHelper.parent) state.activeHelper.parent.remove(state.activeHelper);
  disposeObject(state.activeHelper);
  state.activeHelper = null;
}

function disposeObject(root) {
  if (!root) return;
  root.traverse?.((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((mat) => mat?.dispose?.());
    else object.material?.dispose?.();
  });
}

function vecToArray(v) {
  return [round(v.x), round(v.y), round(v.z)];
}

function arrayToVec(value) {
  if (!Array.isArray(value) || value.length < 3) return null;
  const v = new THREE.Vector3(Number(value[0]), Number(value[1]), Number(value[2]));
  return isFiniteVector(v) ? v : null;
}

function round(value) {
  return Number(Number(value || 0).toFixed(6));
}

function vectorSig(v) {
  return isFiniteVector(v) ? `${round(v.x)},${round(v.y)},${round(v.z)}` : 'none';
}

function isFiniteVector(v) {
  return Boolean(v) && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

function sessionSignature(tags) {
  return tags.map((tag) => `${tag.source}|${tag.title}|${tag.body}|${vectorSig(tag.anchor)}|${vectorSig(tag.labelPoint)}`).join('||');
}

function safeId(value) {
  return String(value || crypto.randomUUID?.() || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

function readableName(name) {
  return String(name || 'Tag View').replace(/^NAVIS_(MANUAL|IMPORTED)_TAG_?/, '').replace(/_/g, ' ');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function injectStyles() {
  if (document.getElementById('navisTagSessionStyles')) return;
  const style = document.createElement('style');
  style.id = 'navisTagSessionStyles';
  style.textContent = `
    .navis-tag-session-box {
      margin: 8px;
      padding: 9px 10px;
      border: 1px solid rgba(102, 194, 255, .38);
      border-radius: 11px;
      background: rgba(11, 25, 42, .82);
    }
    .navis-tag-session-title {
      color: #e8f6ff;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .08em;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .navis-tag-session-status {
      color: #c7d7e6;
      font-size: 11px;
      line-height: 1.4;
      margin-bottom: 8px;
    }
    .navis-tag-session-status b { color: #ffffff; }
    .navis-tag-session-status span { color: #91a5ba; }
    .navis-tag-session-actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .navis-tag-session-actions button {
      min-height: 26px;
      height: 26px;
      padding: 0 8px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 900;
      color: #dff4ff;
      border: 1px solid rgba(102, 194, 255, .42);
      background: rgba(14, 32, 54, .90);
    }
    .navis-tag-session-actions button:hover {
      color: #fff;
      border-color: rgba(255, 209, 102, .82);
      background: rgba(47, 36, 24, .92);
    }
  `;
  document.head.appendChild(style);
}

let toastTimer = null;
function toast(message) {
  let el = document.getElementById('navisTagToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'navisTagToast';
    el.className = 'navis-tag-toast';
    (document.querySelector('.viewer-stage') || document.body).appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3600);
}
