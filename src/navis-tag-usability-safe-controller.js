import * as THREE from 'three';
import { createTextPlane } from './geometry.js?v=professional-viewer-3';

const runtime = window.__3D_MARKUP_CLIP_RUNTIME__ || null;
const TAG_RED = 0xff2b2b;
const TAG_YELLOW = 0xffd166;
const TAG_IMPORT = 0xff8c42;

const state = {
  renderer: runtime?.renderer || null,
  scene: runtime?.scene || null,
  camera: runtime?.camera || null,
  listObserver: null,
  excluded: new Set(),
  overrides: new Map(),
  exportBound: false,
  enhanceQueued: false,
  styleInjected: false
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initTagUsabilitySafe, { once: true });
} else {
  initTagUsabilitySafe();
}

window.addEventListener('markup:render-context', (event) => {
  const { renderer, scene, camera } = event.detail || {};
  if (renderer) state.renderer = renderer;
  if (scene) state.scene = scene;
  if (camera) state.camera = camera;
  queueEnhance();
});

function initTagUsabilitySafe() {
  injectStyles();
  bindExportOnce();
  bindPanelOpenHooks();
  observePanelList();
  queueEnhance();
}

function bindPanelOpenHooks() {
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#navisTagViewsBtn, #navisIsonoteBtn, #navisImportTagsBtn, .navis-tag-view-row')) {
      window.setTimeout(() => {
        observePanelList();
        queueEnhance();
      }, 90);
    }
  }, true);
}

function observePanelList() {
  const list = document.querySelector('#navisTagViewPanel .navis-tag-view-list');
  if (!list || list.dataset.safeUsabilityObserved === '1') return;
  list.dataset.safeUsabilityObserved = '1';
  const observer = new MutationObserver(() => queueEnhance());
  observer.observe(list, { childList: true });
  state.listObserver = observer;
}

function queueEnhance() {
  if (state.enhanceQueued) return;
  state.enhanceQueued = true;
  window.requestAnimationFrame(() => {
    state.enhanceQueued = false;
    enhancePanel();
  });
}

function enhancePanel() {
  bindExportOnce();
  const panel = document.getElementById('navisTagViewPanel');
  const list = panel?.querySelector('.navis-tag-view-list');
  if (!panel || !list) return;
  observePanelList();
  ensureDetail(panel);

  const tags = collectTags();
  const rows = Array.from(list.querySelectorAll('.navis-tag-view-row'));
  rows.forEach((row) => enhanceRow(row, tags[Number(row.dataset.index)]));
}

function enhanceRow(row, tag) {
  if (!row || !tag || row.dataset.safeUsabilityEnhanced === '1') {
    updateRowContent(row, tag);
    return;
  }
  row.dataset.safeUsabilityEnhanced = '1';
  updateRowContent(row, tag);

  const actions = document.createElement('span');
  actions.className = 'navis-tag-row-actions-safe';
  actions.innerHTML = `
    <button type="button" data-safe-tag-action="fit" title="Fit this tag viewpoint">Fit</button>
    <button type="button" data-safe-tag-action="edit" title="Edit title/comment">Edit</button>
    <button type="button" data-safe-tag-action="clone" title="Clone as manual tag">Clone</button>
    <button type="button" data-safe-tag-action="delete" title="Exclude/delete this tag">Del</button>
  `;
  row.appendChild(actions);
  actions.addEventListener('click', (event) => {
    const action = event.target.closest('button')?.dataset.safeTagAction;
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const current = collectTags()[Number(row.dataset.index)];
    if (!current) return;
    if (action === 'fit') row.click();
    if (action === 'edit') editTag(current, row);
    if (action === 'clone') cloneTag(current);
    if (action === 'delete') deleteTag(current, row);
  });
}

function updateRowContent(row, tag) {
  if (!row || !tag) return;
  const key = tagKey(tag);
  row.dataset.safeTagKey = key;
  row.classList.toggle('excluded', state.excluded.has(key));
  const override = state.overrides.get(key);
  const title = override?.name || tag.name || 'Tag View';
  const body = state.excluded.has(key) ? '[excluded from export]' : (override?.body || tag.body || '');
  row.querySelector('.navis-tag-view-title')?.replaceChildren(document.createTextNode(title));
  row.querySelector('.navis-tag-view-body')?.replaceChildren(document.createTextNode(body));
}

function ensureDetail(panel) {
  if (panel.querySelector('.navis-tag-usability-safe-detail')) return;
  const detail = document.createElement('div');
  detail.className = 'navis-tag-usability-safe-detail';
  detail.textContent = 'Actions: Fit, Edit, Clone, Delete/Exclude. Export XML respects edits and exclusions.';
  panel.appendChild(detail);
}

function editTag(tag, row) {
  const key = tagKey(tag);
  const old = state.overrides.get(key) || {};
  const name = window.prompt('Viewpoint title', old.name || tag.name || 'Tag View');
  if (name === null) return;
  const body = window.prompt('Tag annotation text', old.body || tag.body || '');
  if (body === null) return;
  const next = {
    name: name.trim() || old.name || tag.name || 'Tag View',
    body: body.trim() || old.body || tag.body || ''
  };
  state.overrides.set(key, next);
  applyOverrideToScene(tag, next);
  updateRowContent(row, { ...tag, ...next });
  toast('Tag viewpoint updated.');
}

function cloneTag(tag) {
  const ctx = getContext();
  if (!ctx?.scene || !tag.anchor || !tag.labelPoint) return;
  const override = state.overrides.get(tagKey(tag));
  const copy = {
    ...tag,
    source: 'MANUAL',
    name: `${override?.name || tag.name || 'Tag View'} Copy`,
    body: override?.body || tag.body || 'Manual tag copy',
    labelPoint: tag.labelPoint.clone().add(offsetVector(tag.anchor, tag.labelPoint)),
    anchor: tag.anchor.clone()
  };
  addManualTagGroup(copy, ctx.scene, ctx.camera);
  toast('Tag viewpoint cloned as manual tag.');
  window.setTimeout(() => {
    clickTagViewsOpen();
    queueEnhance();
  }, 120);
}

function deleteTag(tag, row) {
  if (!window.confirm(`Delete/exclude tag viewpoint "${tag.name || tag.body || 'Tag'}"?`)) return;
  const key = tagKey(tag);
  if (tag.group && tag.source !== 'ISONOTE SIDELOAD') {
    tag.group.parent?.remove(tag.group);
    disposeObject(tag.group);
  }
  state.excluded.add(key);
  row?.classList.add('excluded');
  updateRowContent(row, tag);
  toast('Tag viewpoint excluded from export.');
}

function bindExportOnce() {
  const button = document.getElementById('navisExportTagsBtn');
  if (!button || state.exportBound) return;
  button.addEventListener('click', exportSafeTags, true);
  state.exportBound = true;
}

function exportSafeTags(event) {
  const ctx = getContext();
  const tags = collectTags()
    .filter((tag) => !state.excluded.has(tagKey(tag)))
    .map((tag) => ({ ...tag, ...(state.overrides.get(tagKey(tag)) || {}) }));
  if (!ctx || !tags.length) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  const xml = buildNavisXml(tags, ctx.camera, ctx.renderer);
  downloadText(xml, `3dmarkup_navis_tags_${timestampForFile()}.xml`, 'application/xml');
  toast(`Exported ${tags.length} tag viewpoint(s).`);
}

function collectTags() {
  const scene = getContext()?.scene;
  if (!scene) return [];
  return [...collectImported(scene), ...collectIsonote(scene), ...collectManual(scene)];
}

function collectImported(scene) {
  const tags = [];
  scene.traverse((object) => {
    if (!object.name?.startsWith('NAVIS_IMPORTED_TAG_')) return;
    if (!object.children?.length) return;
    const line = object.children.find((child) => child.name?.includes('TAG_LEADER'));
    const label = object.children.find((child) => child.name?.includes('TAG_TEXT'));
    const { anchor, labelPoint } = pointsFromLine(line, label || object);
    const body = label?.userData?.body || object.userData?.body || 'Imported tag';
    tags.push({ id: object.name, source: 'IMPORTED XML', name: object.userData?.viewName || object.name, body, anchor, labelPoint, bounds: boundsAround(anchor, labelPoint), group: object });
  });
  return tags;
}

function collectManual(scene) {
  const tags = [];
  scene.traverse((object) => {
    if (!object.name?.startsWith('NAVIS_MANUAL_TAG_')) return;
    const line = object.children.find((child) => child.name?.startsWith('NAVIS_TAG_LEADER_'));
    const label = object.children.find((child) => child.name?.startsWith('NAVIS_TAG_TEXT_'));
    const { anchor, labelPoint } = pointsFromLine(line, label || object);
    const body = label?.userData?.body || object.userData?.body || 'Manual tag';
    tags.push({ id: object.name, source: 'MANUAL', name: object.userData?.viewName || object.name, body, anchor, labelPoint, bounds: boundsAround(anchor, labelPoint), group: object });
  });
  return tags;
}

function collectIsonote(scene) {
  const tags = [];
  const nodePositions = new Map();
  scene.traverse((object) => {
    const data = object.userData || {};
    if (data.TYPE === 'NODE' && data.NODE !== undefined) nodePositions.set(String(data.NODE), worldPosition(object));
  });
  scene.traverse((object) => {
    const data = object.userData || {};
    if (data.TYPE !== 'ISONOTE_NAME_PLATE') return;
    const body = String(data.BOARD_TEXT || data.SOURCE_NOTE_NAME || data.sourceNoteName || '').trim();
    if (!body) return;
    const node = data.NODE || data.node || '';
    const labelPoint = worldPosition(object);
    const anchor = nodePositions.get(String(node)) || labelPoint.clone();
    tags.push({ id: `isonote-${tags.length + 1}-${node}`, source: 'ISONOTE SIDELOAD', name: data.SOURCE_NOTE_NAME || data.sourceNoteName || `ISONOTE ${tags.length + 1}`, body, anchor, labelPoint, bounds: boundsAround(anchor, labelPoint), sourceObject: object });
  });
  return tags;
}

function pointsFromLine(line, fallbackObject) {
  const pos = line?.geometry?.attributes?.position;
  if (pos?.count >= 2) {
    return {
      anchor: new THREE.Vector3(pos.getX(0), pos.getY(0), pos.getZ(0)).applyMatrix4(line.matrixWorld),
      labelPoint: new THREE.Vector3(pos.getX(1), pos.getY(1), pos.getZ(1)).applyMatrix4(line.matrixWorld)
    };
  }
  const anchor = worldPosition(fallbackObject);
  return { anchor, labelPoint: anchor.clone().add(new THREE.Vector3(1, 1, 1)) };
}

function applyOverrideToScene(tag, override) {
  const target = tag.group || tag.sourceObject;
  if (target) {
    target.userData.viewName = override.name;
    target.userData.body = override.body;
  }
  const label = tag.group?.children?.find((child) => child.name?.includes('TAG_TEXT'));
  if (!label) return;
  const parent = label.parent;
  const position = label.getWorldPosition(new THREE.Vector3());
  parent.remove(label);
  disposeObject(label);
  const replacement = createTextPlane(override.body, {
    width: 760,
    height: 220,
    fontSize: 30,
    scale: Math.max(markerRadius(tag.anchor) * 12, 0.85),
    bg: tag.source === 'IMPORTED XML' ? 'rgba(32,20,10,0.94)' : 'rgba(34,12,12,0.94)',
    border: tag.source === 'IMPORTED XML' ? '#ff8c42' : '#ff2b2b',
    name: label.name || `NAVIS_TAG_TEXT_${Date.now()}`
  });
  replacement.position.copy(position);
  replacement.renderOrder = label.renderOrder || 1242;
  replacement.material.depthTest = false;
  replacement.userData = { isDisplayHelper: true, TYPE: 'NAVIS_TAG_TEXT', source: tag.source, body: override.body };
  const camera = getContext()?.camera;
  if (camera) replacement.lookAt(camera.position);
  parent.add(replacement);
}

function addManualTagGroup(tag, scene, camera) {
  const layer = ensureLayer(scene);
  if (!layer) return;
  const id = `safe-clone-${Date.now()}`;
  const group = new THREE.Group();
  group.name = `NAVIS_MANUAL_TAG_${id}`;
  group.userData = { isDisplayHelper: true, TYPE: 'NAVIS_TAG_MARKUP', source: 'MANUAL', body: tag.body, viewName: tag.name };
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([tag.anchor, tag.labelPoint]),
    new THREE.LineBasicMaterial({ color: TAG_RED, depthTest: false, depthWrite: false })
  );
  line.name = `NAVIS_TAG_LEADER_${id}`;
  line.renderOrder = 1240;
  const marker = new THREE.Mesh(new THREE.SphereGeometry(markerRadius(tag.anchor), 18, 10), new THREE.MeshBasicMaterial({ color: TAG_RED, depthTest: false }));
  marker.name = `NAVIS_TAG_ANCHOR_${id}`;
  marker.position.copy(tag.anchor);
  marker.renderOrder = 1241;
  marker.userData = { isDisplayHelper: true, TYPE: 'NAVIS_TAG_ANCHOR', source: 'MANUAL' };
  const label = createTextPlane(tag.body, { width: 760, height: 220, fontSize: 30, scale: Math.max(markerRadius(tag.anchor) * 12, 0.85), bg: 'rgba(34,12,12,0.94)', border: '#ff2b2b', name: `NAVIS_TAG_TEXT_${id}` });
  label.position.copy(tag.labelPoint);
  label.renderOrder = 1242;
  label.material.depthTest = false;
  label.userData = { isDisplayHelper: true, TYPE: 'NAVIS_TAG_TEXT', source: 'MANUAL', body: tag.body };
  if (camera) label.lookAt(camera.position);
  group.add(line, marker, label);
  layer.add(group);
}

function ensureLayer(scene) {
  if (!scene) return null;
  let layer = scene.getObjectByName('NAVIS_MANUAL_TAG_DISPLAY_LAYER');
  if (!layer) {
    layer = new THREE.Group();
    layer.name = 'NAVIS_MANUAL_TAG_DISPLAY_LAYER';
    layer.userData = { isDisplayHelper: true, ignoreBounds: true };
    scene.add(layer);
  }
  return layer;
}

function offsetVector(anchor, labelPoint) {
  const delta = labelPoint.clone().sub(anchor);
  if (delta.lengthSq() < 1e-6) return new THREE.Vector3(1, 1, 0);
  return delta.normalize().multiplyScalar(Math.max(markerRadius(anchor) * 6, 1));
}

function buildNavisXml(tags, camera, renderer) {
  const date = new Date();
  const views = tags.map((tag, index) => viewXml(tag, index + 1, camera, renderer, date)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8" ?>\n\n<exchange xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://download.autodesk.com/us/navisworks/schemas/nw-exchange-12.0.xsd" units="m" filename="3DMarkupTool.nwd" filepath="">\n  <viewpoints>\n${views}\n  </viewpoints>\n</exchange>\n`;
}

function viewXml(tag, index, camera, renderer, date) {
  const cam = cameraData(camera, renderer);
  const bounds = tag.bounds || boundsAround(tag.anchor, tag.labelPoint || tag.anchor);
  return `    <view name="${escapeXml(tag.name || `Tag View ${index}`)}" guid="${guid(index)}">\n      <viewpoint tool="none" render="shaded" lighting="headlight" focal="${fmt(cam.focal)}" linear="18.9306050001" angular="0.7853981634">\n        <camera projection="persp" near="${fmt(cam.near)}" far="${fmt(cam.far)}" aspect="${fmt(cam.aspect)}" height="0.7853980000">\n          <position>${pos3f(cam.position)}</position>\n          <rotation>${quat(cam.quaternion)}</rotation>\n        </camera>\n        <up><vec3f x="0.0000000000" y="0.0000000000" z="1.0000000000"/></up>\n      </viewpoint>\n      <comments><comment id="${index}" status="new"><user>3DMarkupTool</user><body>${escapeXml(tag.body || '')}</body><createddate><date year="${date.getFullYear()}" month="${date.getMonth() + 1}" day="${date.getDate()}" hour="${date.getHours()}" minute="${date.getMinutes()}" second="${date.getSeconds()}"/></createddate></comment></comments>\n      <redlines><rltag><pos3d>${pos3f(tag.anchor || new THREE.Vector3())}</pos3d><text>${escapeXml(tag.body || '')}</text><bounds>${box3f(bounds)}</bounds></rltag></redlines>\n    </view>`;
}

function cameraData(camera, renderer) {
  const rect = renderer?.domElement?.getBoundingClientRect?.();
  return {
    position: camera?.position?.clone?.() || new THREE.Vector3(0, 0, 10),
    quaternion: camera?.quaternion?.clone?.() || new THREE.Quaternion(),
    near: camera?.near || 0.1,
    far: camera?.far || 10000,
    aspect: camera?.aspect || (rect?.width && rect?.height ? rect.width / rect.height : 1.7777777778),
    focal: camera?.fov ? THREE.MathUtils.degToRad(camera.fov) : 0.7853981634
  };
}

function box3f(box) {
  const min = box?.min || new THREE.Vector3();
  const max = box?.max || new THREE.Vector3();
  return `<box3f min="${fmt(min.x)} ${fmt(min.y)} ${fmt(min.z)}" max="${fmt(max.x)} ${fmt(max.y)} ${fmt(max.z)}"/>`;
}

function pos3f(vector) {
  return `<pos3f x="${fmt(vector?.x || 0)}" y="${fmt(vector?.y || 0)}" z="${fmt(vector?.z || 0)}"/>`;
}

function quat(q) {
  return `<quat x="${fmt(q?.x || 0)}" y="${fmt(q?.y || 0)}" z="${fmt(q?.z || 0)}" w="${fmt(q?.w ?? 1)}"/>`;
}

function boundsAround(a, b) {
  const box = new THREE.Box3();
  box.expandByPoint(a || new THREE.Vector3());
  box.expandByPoint(b || a || new THREE.Vector3());
  const pad = Math.max(markerRadius(a || new THREE.Vector3()) * 5, 0.25);
  box.expandByScalar(pad);
  return box;
}

function markerRadius(point) {
  const scale = Math.max(Math.abs(point?.x || 0), Math.abs(point?.y || 0), Math.abs(point?.z || 0), 1);
  return Math.max(scale * 0.0025, 0.08);
}

function worldPosition(object) {
  return object?.getWorldPosition?.(new THREE.Vector3()) || new THREE.Vector3();
}

function tagKey(tag) {
  return `${tag.source || 'TAG'}:${tag.id || tag.name || ''}:${vectorSig(tag.anchor)}:${tag.body || ''}`;
}

function vectorSig(v) {
  return v ? `${fmt(v.x)},${fmt(v.y)},${fmt(v.z)}` : 'none';
}

function getContext() {
  const live = window.__3D_MARKUP_CLIP_RUNTIME__ || runtime;
  if (!live?.scene || !live?.camera || !live?.renderer) return null;
  return live;
}

function disposeObject(object) {
  object?.traverse?.((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((mat) => mat?.dispose?.());
    else child.material?.dispose?.();
  });
}

function clickTagViewsOpen() {
  const panel = document.getElementById('navisTagViewPanel');
  if (!panel?.classList.contains('open')) document.getElementById('navisTagViewsBtn')?.click();
}

function toast(message) {
  const status = document.getElementById('runtimeStatus');
  if (status) status.textContent = message;
}

function downloadText(text, filename, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function guid(index) {
  return crypto.randomUUID?.() || `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

function fmt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(10) : '0.0000000000';
}

function escapeXml(value) {
  return String(value ?? '').replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]));
}

function injectStyles() {
  if (state.styleInjected || document.getElementById('navisTagUsabilitySafeStyles')) return;
  state.styleInjected = true;
  const style = document.createElement('style');
  style.id = 'navisTagUsabilitySafeStyles';
  style.textContent = `
    .navis-tag-view-row { position: relative; padding-right: 160px !important; }
    .navis-tag-row-actions-safe { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); display: flex; gap: 4px; }
    .navis-tag-row-actions-safe button { border: 1px solid rgba(133,190,255,.35); border-radius: 8px; background: rgba(16,36,58,.9); color: #dcecff; font-size: 10px; font-weight: 800; padding: 3px 6px; cursor: pointer; }
    .navis-tag-row-actions-safe button:hover { border-color: #ffd166; color: #ffd166; }
    .navis-tag-view-row.excluded { opacity: .55; text-decoration: line-through; }
    .navis-tag-usability-safe-detail { margin: 8px 12px 12px; padding: 8px 10px; border: 1px solid rgba(133,190,255,.22); border-radius: 10px; color: #9fb3c8; font-size: 11px; background: rgba(4,14,26,.6); }
  `;
  document.head.appendChild(style);
}
