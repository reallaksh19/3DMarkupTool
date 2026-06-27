import * as THREE from 'three';
import { createTextPlane } from './geometry.js?v=bust-cache-4';

const runtime = window.__3D_MARKUP_CLIP_RUNTIME__ || null;
const TAG_YELLOW = 0xffd166;
const TAG_IMPORT = 0xff8c42;
const TAG_RED = 0xff2b2b;

const state = {
  renderer: runtime?.renderer || null,
  scene: runtime?.scene || null,
  camera: runtime?.camera || null,
  selectedIndex: -1,
  excludedKeys: new Set(),
  overrides: new Map(),
  exportBound: false,
  styleInjected: false,
  lastRowsSignature: ''
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initTagUsability, { once: true });
} else {
  initTagUsability();
}

window.addEventListener('markup:render-context', (event) => {
  const { renderer, scene, camera } = event.detail || {};
  if (renderer) state.renderer = renderer;
  if (scene) state.scene = scene;
  if (camera) state.camera = camera;
  enrichTagPanelSoon();
});

function initTagUsability() {
  injectStyles();
  bindExportButton();
  setInterval(enrichTagPanel, 900);
  document.addEventListener('click', (event) => {
    const row = event.target.closest?.('.navis-tag-view-row');
    if (!row) return;
    state.selectedIndex = Number(row.dataset.index);
    setTimeout(enrichTagPanel, 40);
  }, true);
  enrichTagPanelSoon();
}

function enrichTagPanelSoon() {
  requestAnimationFrame(() => enrichTagPanel());
}

function bindExportButton() {
  const oldButton = document.getElementById('navisExportTagsBtn');
  if (!oldButton || state.exportBound) return;

  const newButton = oldButton.cloneNode(true);
  oldButton.replaceWith(newButton);
  newButton.addEventListener('click', exportCurrentTags, true);
  state.exportBound = true;
}

function enrichTagPanel() {
  bindExportButton();
  const panel = document.getElementById('navisTagViewPanel');
  const list = panel?.querySelector('.navis-tag-view-list');
  if (!panel || !list) return;

  const tags = collectTags();
  const rows = Array.from(list.querySelectorAll('.navis-tag-view-row'));
  const signature = rows.map((row) => row.textContent).join('|') + `:${tags.length}:${state.excludedKeys.size}:${state.overrides.size}`;
  if (signature === state.lastRowsSignature) return;
  state.lastRowsSignature = signature;

  ensureDetailPanel(panel);
  rows.forEach((row) => enrichRow(row, tags[Number(row.dataset.index)]));
  updateDetailPanel(tags[state.selectedIndex]);
}

function enrichRow(row, tag) {
  if (!tag) return;
  const key = tagKey(tag);
  const override = state.overrides.get(key);
  const title = override?.name || tag.name || 'Tag View';
  const body = override?.body || tag.body || '';

  row.dataset.tagKey = key;
  row.classList.toggle('excluded', state.excludedKeys.has(key));

  const titleEl = row.querySelector('.navis-tag-view-title');
  const bodyEl = row.querySelector('.navis-tag-view-body');
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.textContent = state.excludedKeys.has(key) ? '[excluded from export]' : body;

  let actions = row.querySelector('.navis-tag-row-actions');
  if (!actions) {
    actions = document.createElement('span');
    actions.className = 'navis-tag-row-actions';
    actions.innerHTML = `
      <button type="button" data-action="fit" title="Fit / restore this tag viewpoint">Fit</button>
      <button type="button" data-action="edit" title="Edit viewpoint title and tag text">Edit</button>
      <button type="button" data-action="clone" title="Duplicate as a manual tag viewpoint">Clone</button>
      <button type="button" data-action="delete" title="Delete or exclude this tag viewpoint">Del</button>
    `;
    row.appendChild(actions);
    actions.addEventListener('click', (event) => {
      const action = event.target.closest('button')?.dataset.action;
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      const currentTags = collectTags();
      const currentTag = currentTags[Number(row.dataset.index)];
      if (!currentTag) return;
      if (action === 'fit') fitTag(row, currentTag);
      if (action === 'edit') editTag(currentTag, row);
      if (action === 'clone') cloneTag(currentTag);
      if (action === 'delete') deleteTag(currentTag, row);
    });
  }
}

function ensureDetailPanel(panel) {
  if (panel.querySelector('.navis-tag-detail-actions')) return;
  const detail = document.createElement('div');
  detail.className = 'navis-tag-detail-actions';
  detail.innerHTML = `
    <strong>Selected Tag</strong>
    <span class="navis-tag-detail-text">Select a tag viewpoint to edit, clone, delete, or fit.</span>
  `;
  panel.appendChild(detail);
}

function updateDetailPanel(tag) {
  const detail = document.querySelector('.navis-tag-detail-actions .navis-tag-detail-text');
  if (!detail) return;
  if (!tag) {
    detail.textContent = 'Select a tag viewpoint to edit, clone, delete, or fit.';
    return;
  }
  const override = state.overrides.get(tagKey(tag));
  detail.textContent = `${override?.name || tag.name || 'Tag View'} â€” ${override?.body || tag.body || ''}`;
}

function fitTag(row, tag) {
  row.click();
  const ctx = getContext();
  if (!ctx || !tag?.bounds) return;
  fitBox(tag.bounds, ctx, tag.cameraSnapshot);
  toast(`Fit tag: ${tag.name || tag.body || 'viewpoint'}`);
}

function editTag(tag, row) {
  const key = tagKey(tag);
  const oldOverride = state.overrides.get(key) || {};
  const currentName = oldOverride.name || tag.name || 'Tag View';
  const currentBody = oldOverride.body || tag.body || '';
  const name = prompt('Viewpoint title', currentName);
  if (name === null) return;
  const body = prompt('Tag annotation text', currentBody);
  if (body === null) return;

  const next = { name: name.trim() || currentName, body: body.trim() || currentBody };
  state.overrides.set(key, next);
  applyOverrideToSceneTag(tag, next);
  row.querySelector('.navis-tag-view-title')?.replaceChildren(document.createTextNode(next.name));
  row.querySelector('.navis-tag-view-body')?.replaceChildren(document.createTextNode(next.body));
  updateDetailPanel({ ...tag, ...next });
  toast('Updated tag viewpoint text.');
}

function cloneTag(tag) {
  const ctx = getContext();
  if (!ctx?.scene || !tag?.anchor || !tag?.labelPoint) return;
  const layer = ensureUsabilityLayer(ctx.scene);
  const copy = {
    ...tag,
    source: 'MANUAL',
    name: `${tag.name || 'Tag View'} Copy`,
    body: tag.body || 'Manual tag copy',
    anchor: tag.anchor.clone(),
    labelPoint: tag.labelPoint.clone().add(new THREE.Vector3(markerRadius(tag.anchor) * 5, markerRadius(tag.anchor) * 3, 0)),
    bounds: boundsAround(tag.anchor, tag.labelPoint)
  };
  const group = createTagGroup(copy, `NAVIS_MANUAL_TAG_CLONE_${Date.now()}`);
  layer.add(group);
  toast('Duplicated tag viewpoint.');
  setTimeout(enrichTagPanel, 200);
}

function deleteTag(tag, row) {
  const key = tagKey(tag);
  if (!confirm(`Delete/exclude tag viewpoint "${tag.name || tag.body || 'Tag'}"?`)) return;
  if (tag.group && tag.group.parent && !tag.importedArrayOnly) {
    tag.group.parent.remove(tag.group);
    disposeObject(tag.group);
  }
  state.excludedKeys.add(key);
  row.classList.add('excluded');
  row.querySelector('.navis-tag-view-body')?.replaceChildren(document.createTextNode('[excluded from export]'));
  toast('Tag viewpoint excluded from re-export.');
  setTimeout(enrichTagPanel, 200);
}

function applyOverrideToSceneTag(tag, override) {
  if (!tag.group) return;
  tag.group.userData.body = override.body;
  tag.group.userData.viewName = override.name;
  const label = tag.group.children?.find((child) => /TAG_TEXT/i.test(child.name || ''));
  if (!label) return;
  const parent = label.parent;
  const position = label.getWorldPosition(new THREE.Vector3());
  parent.remove(label);
  disposeObject(label);
  const replacement = createTextPlane(override.body, {
    width: 760,
    height: 220,
    fontSize: 30,
    scale: Math.max(markerRadius(position) * 12, 0.85),
    bg: tag.source === 'IMPORTED XML' ? 'rgba(32,20,10,0.94)' : 'rgba(28,12,12,0.94)',
    border: tag.source === 'IMPORTED XML' ? '#ff8c42' : '#ff2b2b',
    name: label.name || `NAVIS_TAG_TEXT_${Date.now()}`
  });
  replacement.position.copy(position);
  replacement.renderOrder = label.renderOrder || 1212;
  replacement.material.depthTest = false;
  replacement.userData = { isDisplayHelper: true, TYPE: 'NAVIS_TAG_TEXT', source: tag.source, body: override.body };
  const ctx = getContext();
  if (ctx?.camera) replacement.lookAt(ctx.camera.position);
  parent.add(replacement);
}

function exportCurrentTags(event) {
  const ctx = getContext();
  const tags = collectTags().filter((tag) => !state.excludedKeys.has(tagKey(tag))).map((tag) => {
    const override = state.overrides.get(tagKey(tag));
    return override ? { ...tag, ...override } : tag;
  });
  if (!ctx || !tags.length) {
    toast('No tag viewpoints available for export.');
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  const xml = buildNavisXml(tags, ctx.camera, ctx.renderer);
  downloadText(xml, `3dmarkup_navis_tags_${timestampForFile()}.xml`, 'application/xml');
  toast(`Exported ${tags.length} edited Navis tag viewpoint(s).`);
}

function collectTags() {
  const ctx = getContext();
  const scene = ctx?.scene;
  if (!scene) return [];
  return [...collectImported(scene), ...collectIsonote(scene), ...collectManual(scene)];
}

function collectImported(scene) {
  const tags = [];
  scene.traverse((object) => {
    if (!object.name?.startsWith('NAVIS_IMPORTED_TAG_')) return;
    const line = object.children.find((child) => child.name?.startsWith('NAVIS_IMPORTED_TAG_LEADER_'));
    const label = object.children.find((child) => child.name?.startsWith('NAVIS_IMPORTED_TAG_TEXT_'));
    const points = line?.geometry?.attributes?.position;
    if (!points || points.count < 2) return;
    const anchor = new THREE.Vector3(points.getX(0), points.getY(0), points.getZ(0)).applyMatrix4(line.matrixWorld);
    const labelPoint = new THREE.Vector3(points.getX(1), points.getY(1), points.getZ(1)).applyMatrix4(line.matrixWorld);
    tags.push({
      source: 'IMPORTED XML',
      name: object.userData?.viewName || object.name.replace('NAVIS_IMPORTED_TAG_', 'Imported '),
      body: object.userData?.body || label?.userData?.body || 'Imported tag',
      anchor,
      labelPoint,
      bounds: boundsAround(anchor, labelPoint),
      group: object
    });
  });
  return tags;
}

function collectManual(scene) {
  const tags = [];
  scene.traverse((object) => {
    if (!object.name?.startsWith('NAVIS_MANUAL_TAG_')) return;
    const line = object.children.find((child) => child.name?.startsWith('NAVIS_TAG_LEADER_'));
    const label = object.children.find((child) => child.name?.startsWith('NAVIS_TAG_TEXT_'));
    const points = line?.geometry?.attributes?.position;
    const anchor = points?.count >= 2 ? new THREE.Vector3(points.getX(0), points.getY(0), points.getZ(0)).applyMatrix4(line.matrixWorld) : object.getWorldPosition(new THREE.Vector3());
    const labelPoint = points?.count >= 2 ? new THREE.Vector3(points.getX(1), points.getY(1), points.getZ(1)).applyMatrix4(line.matrixWorld) : label?.getWorldPosition(new THREE.Vector3()) || anchor.clone();
    tags.push({
      source: 'MANUAL',
      name: object.userData?.viewName || object.name,
      body: object.userData?.body || label?.userData?.body || 'Manual tag',
      anchor,
      labelPoint,
      bounds: boundsAround(anchor, labelPoint),
      group: object
    });
  });
  return tags;
}

function collectIsonote(scene) {
  const tags = [];
  scene.traverse((object) => {
    const data = object.userData || {};
    if (data.TYPE !== 'ISONOTE_NAME_PLATE') return;
    const body = String(data.BOARD_TEXT || data.SOURCE_NOTE_NAME || data.sourceNoteName || '').trim();
    if (!body) return;
    const labelPoint = worldPosition(object);
    const anchor = findNodeOrLeader(scene, data.NODE || data.node) || labelPoint.clone();
    tags.push({
      source: 'ISONOTE SIDELOAD',
      name: data.SOURCE_NOTE_NAME || data.sourceNoteName || `ISONOTE ${tags.length + 1}`,
      body,
      anchor,
      labelPoint,
      bounds: boundsAround(anchor, labelPoint),
      sourceObject: object
    });
  });
  return tags;
}

function findNodeOrLeader(scene, node) {
  if (node === undefined || node === null) return null;
  let found = null;
  scene.traverse((object) => {
    if (found) return;
    const data = object.userData || {};
    if ((data.TYPE === 'NODE' || data.TYPE === 'ISONOTE_LEADER') && String(data.NODE || data.node || '') === String(node)) {
      found = worldPosition(object);
    }
  });
  return found;
}

function createTagGroup(tag, name) {
  const group = new THREE.Group();
  group.name = name;
  group.userData = { isDisplayHelper: true, TYPE: 'NAVIS_TAG_MARKUP', source: tag.source, body: tag.body, viewName: tag.name };
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([tag.anchor, tag.labelPoint]),
    new THREE.LineBasicMaterial({ color: TAG_RED, depthTest: false, depthWrite: false })
  );
  line.name = `NAVIS_TAG_LEADER_${Date.now()}`;
  line.renderOrder = 1210;
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(markerRadius(tag.anchor), 18, 10),
    new THREE.MeshBasicMaterial({ color: TAG_RED, depthTest: false })
  );
  marker.position.copy(tag.anchor);
  marker.renderOrder = 1211;
  const label = createTextPlane(tag.body, {
    width: 760,
    height: 220,
    fontSize: 30,
    scale: Math.max(markerRadius(tag.anchor) * 12, 0.85),
    bg: 'rgba(28,12,12,0.94)',
    border: '#ff2b2b',
    name: `NAVIS_TAG_TEXT_${Date.now()}`
  });
  label.position.copy(tag.labelPoint);
  label.material.depthTest = false;
  label.renderOrder = 1212;
  label.userData = { isDisplayHelper: true, TYPE: 'NAVIS_TAG_TEXT', source: tag.source, body: tag.body };
  const ctx = getContext();
  if (ctx?.camera) label.lookAt(ctx.camera.position);
  group.add(line, marker, label);
  return group;
}

function ensureUsabilityLayer(scene) {
  let layer = scene.getObjectByName('NAVIS_TAG_USABILITY_LAYER');
  if (!layer) {
    layer = new THREE.Group();
    layer.name = 'NAVIS_TAG_USABILITY_LAYER';
    layer.userData = { isDisplayHelper: true, ignoreBounds: true };
    scene.add(layer);
  }
  return layer;
}

function buildNavisXml(tags, camera, renderer) {
  const now = new Date();
  const views = tags.map((tag, index) => viewXml(tag, index + 1, camera, renderer, now)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8" ?>\n\n<exchange xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://download.autodesk.com/us/navisworks/schemas/nw-exchange-12.0.xsd" units="m" filename="3DMarkupTool.nwd" filepath="">\n  <viewpoints>\n${views}\n  </viewpoints>\n</exchange>\n`;
}

function viewXml(tag, index, camera, renderer, date) {
  const cam = cameraSnapshotFor(tag, camera, renderer);
  const anchor2d = projectTo2f(tag.anchor, camera);
  const label2d = projectTo2f(tag.labelPoint || tag.anchor, camera);
  const bounds = tag.bounds || boundsAround(tag.anchor, tag.labelPoint || tag.anchor);
  const guid = crypto.randomUUID?.() || `3dmarkup-${Date.now()}-${index}`;
  return `    <view name="${escapeXml(tag.name || `Tag View ${index}`)}" guid="${guid}">
      <viewpoint tool="none" render="shaded" lighting="headlight" focal="${fmt(cam.focal)}" linear="18.9306050001" angular="0.7853981634">
        <camera projection="persp" near="${fmt(cam.near)}" far="${fmt(cam.far)}" aspect="${fmt(cam.aspect)}" height="0.7853980000">
          <position>${pos3f(cam.position)}</position>
          <rotation>${quat(cam.quaternion)}</rotation>
        </camera>
      </viewpoint>
      <comments>
        <comment id="${index}" status="new"><user>3DMarkupTool</user><body>${escapeXml(tag.body || '')}</body><createddate><date year="${date.getFullYear()}" month="${date.getMonth() + 1}" day="${date.getDate()}" hour="${date.getHours()}" minute="${date.getMinutes()}" second="${date.getSeconds()}"/></createddate></comment>
      </comments>
      <redlines>
        <rltag thickness="3" pattern="65535" id="${index}" commentid="${index}">
          <colour red="1.0000000000" green="0.0000000000" blue="0.0000000000"/>
          <pos1><pos2f x="${fmt(anchor2d.x)}" y="${fmt(anchor2d.y)}"/></pos1>
          <pos2><pos2f x="${fmt(label2d.x)}" y="${fmt(label2d.y)}"/></pos2>
          <pos3d>${pos3f(tag.anchor)}</pos3d>
          <bounds><box3f><min>${pos3f(bounds.min)}</min><max>${pos3f(bounds.max)}</max></box3f></bounds>
        </rltag>
      </redlines>
    </view>`;
}

function cameraSnapshotFor(tag, camera, renderer) {
  const position = camera?.position?.clone?.() || new THREE.Vector3(8, 6, 8);
  const quaternion = camera?.quaternion?.clone?.() || new THREE.Quaternion();
  return {
    position,
    quaternion,
    near: camera?.near || 0.01,
    far: camera?.far || 10000,
    aspect: renderer?.domElement ? renderer.domElement.clientWidth / Math.max(renderer.domElement.clientHeight, 1) : camera?.aspect || 1.7777777778,
    focal: tag?.bounds ? Math.max(tag.bounds.getSize(new THREE.Vector3()).length(), 1) : 1
  };
}

function fitBox(box, ctx, cameraSnapshot) {
  const { renderer, camera } = ctx;
  if (cameraSnapshot?.position && cameraSnapshot?.quaternion) {
    camera.position.copy(cameraSnapshot.position);
    camera.quaternion.copy(cameraSnapshot.quaternion);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    return;
  }
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.length() * 0.5, 0.1);
  const rect = renderer.domElement.getBoundingClientRect();
  const aspect = rect.width && rect.height ? rect.width / rect.height : camera.aspect || 1.7777777778;
  const verticalFov = THREE.MathUtils.degToRad(camera.fov || 48);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const fov = Math.max(Math.min(verticalFov, horizontalFov), THREE.MathUtils.degToRad(10));
  const distance = Math.max(radius / Math.sin(fov / 2), radius * 2.8) * 1.16;
  let direction = camera.position.clone().sub(center);
  if (!Number.isFinite(direction.lengthSq()) || direction.lengthSq() < 1e-8) direction = new THREE.Vector3(1.1, 0.78, 1.12);
  direction.normalize();
  camera.position.copy(center).add(direction.multiplyScalar(distance));
  camera.near = Math.max(0.01, distance / 5000);
  camera.far = Math.max(1000, distance + radius * 20);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

function projectTo2f(point, camera) {
  const projected = point.clone().project(camera);
  return { x: clamp(projected.x, -1, 1), y: clamp(projected.y, -1, 1) };
}

function pos3f(v) {
  return `<pos3f x="${fmt(v.x)}" y="${fmt(v.y)}" z="${fmt(v.z)}"/>`;
}

function quat(q) {
  return `<quaternion a="${fmt(q.w)}" b="${fmt(q.x)}" c="${fmt(q.y)}" d="${fmt(q.z)}"/>`;
}

function boundsAround(a, b) {
  const box = new THREE.Box3().setFromPoints([a, b]);
  const pad = Math.max(a.distanceTo(b) * 0.08, 0.1);
  box.expandByScalar(pad);
  return box;
}

function markerRadius(point) {
  const ctx = getContext();
  if (!ctx?.camera) return 0.08;
  return Math.max(ctx.camera.position.distanceTo(point) * 0.006, 0.05);
}

function worldPosition(object) {
  return object.getWorldPosition(new THREE.Vector3());
}

function getContext() {
  const live = window.__3D_MARKUP_CLIP_RUNTIME__ || runtime || {};
  const renderer = state.renderer || live.renderer;
  const scene = state.scene || live.scene;
  const camera = state.camera || live.camera;
  if (!renderer || !scene || !camera) return null;
  return { renderer, scene, camera };
}

function tagKey(tag) {
  return `${tag.source || ''}|${tag.name || ''}|${tag.body || ''}|${vectorSig(tag.anchor)}|${vectorSig(tag.labelPoint || tag.anchor)}`;
}

function vectorSig(v) {
  if (!v) return 'none';
  return `${Number(v.x).toFixed(3)},${Number(v.y).toFixed(3)},${Number(v.z).toFixed(3)}`;
}

function disposeObject(object) {
  if (!object) return;
  object.traverse?.((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material?.dispose?.());
    else child.material?.dispose?.();
  });
}

function downloadText(text, filename, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

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
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function injectStyles() {
  if (state.styleInjected || document.getElementById('navisTagUsabilityStyles')) return;
  const style = document.createElement('style');
  style.id = 'navisTagUsabilityStyles';
  style.textContent = `
    .navis-tag-view-row { position: relative; padding-bottom: 36px !important; }
    .navis-tag-view-row.excluded { opacity: .48; border-style: dashed; }
    .navis-tag-row-actions {
      position: absolute;
      left: 10px;
      right: 10px;
      bottom: 7px;
      display: flex;
      gap: 5px;
      pointer-events: auto;
    }
    .navis-tag-row-actions button {
      min-height: 22px;
      padding: 3px 6px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 900;
      background: rgba(20, 36, 56, .92);
      border: 1px solid rgba(86, 130, 174, .82);
      color: #e9f5ff;
    }
    .navis-tag-row-actions button:hover { border-color: #ffd166; color: #fff1c2; }
    .navis-tag-detail-actions {
      margin: 10px;
      padding: 10px;
      border: 1px solid rgba(255, 209, 102, .42);
      border-radius: 10px;
      background: rgba(10, 20, 34, .92);
      color: #dce9f6;
      font-size: 11px;
    }
    .navis-tag-detail-actions strong { display: block; margin-bottom: 4px; color: #ffd166; }
    .navis-tag-detail-text { display: block; overflow-wrap: anywhere; }
  `;
  document.head.appendChild(style);
  state.styleInjected = true;
}

function fmt(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(10) : '0.0000000000';
}

function escapeXml(value) {
  return String(value ?? '').replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
}
