import * as THREE from 'three';
import { createTextPlane } from './geometry.js?v=professional-viewer-3';

const runtime = window.__3D_MARKUP_CLIP_RUNTIME__ || null;
const RAYCASTER = new THREE.Raycaster();
const MOUSE = new THREE.Vector2();
const TAG_RED = 0xff2b2b;
const TAG_YELLOW = 0xffd166;

const state = {
  renderer: runtime?.renderer || null,
  scene: runtime?.scene || null,
  camera: runtime?.camera || null,
  canvas: null,
  mode: 'idle',
  pointerDown: null,
  pendingAnchor: null,
  pendingMarker: null,
  manualTags: [],
  isonoteTags: [],
  displayGroup: null,
  counter: 1
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initNavisTagMarkup, { once: true });
} else {
  initNavisTagMarkup();
}

window.addEventListener('markup:render-context', (event) => {
  const { renderer, scene, camera } = event.detail || {};
  if (!renderer || !scene || !camera) return;
  state.renderer = renderer;
  state.scene = scene;
  state.camera = camera;
  bindCanvas(renderer.domElement);
  ensureDisplayGroup(scene);
  keepMarkupLabelsFacingCamera();
});

function initNavisTagMarkup() {
  injectStyles();
  injectToolbarButtons();
  bindCanvas((runtime || window.__3D_MARKUP_CLIP_RUNTIME__)?.renderer?.domElement);
}

function injectToolbarButtons() {
  if (document.getElementById('navisTagBtn')) return;
  const reviewGroup = document.querySelector('.toolbar-group[aria-label="Review tools"]');
  const toolbar = document.querySelector('.toolbar');
  if (!toolbar) return;

  const group = document.createElement('div');
  group.className = 'toolbar-group navis-tag-tools';
  group.setAttribute('aria-label', 'Navis tag markup tools');
  group.innerHTML = `
    <button id="navisTagBtn" type="button" class="tool-btn" title="Leader annotation: pick arrow center, then note box location (N)">Tag</button>
    <button id="navisIsonoteBtn" type="button" class="tool-btn" title="Convert sideloaded ISONOTE boards to Navis XML tag viewpoints">ISONOTE XML</button>
    <button id="navisExportTagsBtn" type="button" class="tool-btn accent" title="Export Navis-style tag XML">Export XML</button>
    <button id="navisClearTagsBtn" type="button" class="tool-btn" title="Clear manual tag markups">Clear Tags</button>
  `;

  if (reviewGroup?.nextSibling) {
    toolbar.insertBefore(group, reviewGroup.nextSibling);
  } else {
    toolbar.appendChild(group);
  }

  document.getElementById('navisTagBtn')?.addEventListener('click', startManualTag);
  document.getElementById('navisIsonoteBtn')?.addEventListener('click', convertIsonotesToTags);
  document.getElementById('navisExportTagsBtn')?.addEventListener('click', exportNavisTagXml);
  document.getElementById('navisClearTagsBtn')?.addEventListener('click', clearManualTags);

  window.addEventListener('keydown', (event) => {
    if (hasInputFocus()) return;
    if (event.key?.toLowerCase() === 'n') startManualTag();
    if (event.key === 'Escape' && state.mode !== 'idle') cancelManualTag();
  });
}

function bindCanvas(canvas) {
  if (!canvas || state.canvas === canvas) return;
  if (state.canvas) {
    state.canvas.removeEventListener('pointerdown', onMarkupPointerDown, true);
    state.canvas.removeEventListener('pointerup', onMarkupPointerUp, true);
  }
  state.canvas = canvas;
  canvas.addEventListener('pointerdown', onMarkupPointerDown, true);
  canvas.addEventListener('pointerup', onMarkupPointerUp, true);
}

function startManualTag() {
  if (!getContext()) {
    toast('Load or convert a model before adding tag markup.');
    return;
  }
  state.mode = 'pick-anchor';
  state.pendingAnchor = null;
  removePendingMarker();
  setTagButtonActive(true);
  toast('Tag: pick arrow center on model. Press Esc to cancel.');
}

function cancelManualTag() {
  state.mode = 'idle';
  state.pendingAnchor = null;
  removePendingMarker();
  setTagButtonActive(false);
  toast('Tag cancelled.');
}

function onMarkupPointerDown(event) {
  if (state.mode === 'idle') return;
  state.pointerDown = { x: event.clientX, y: event.clientY, button: event.button };
}

function onMarkupPointerUp(event) {
  if (state.mode === 'idle') return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();

  const down = state.pointerDown;
  state.pointerDown = null;
  if (!down || down.button !== 0) return;
  if (Math.abs(event.clientX - down.x) > 5 || Math.abs(event.clientY - down.y) > 5) return;

  if (state.mode === 'pick-anchor') {
    const pick = pickWorld(event);
    if (!pick) {
      toast('No model hit. Pick the arrow center on visible geometry.');
      return;
    }
    state.pendingAnchor = pick.point.clone();
    showPendingMarker(state.pendingAnchor);
    state.mode = 'pick-label';
    toast('Tag: pick annotation rectangle location.');
    return;
  }

  if (state.mode === 'pick-label') {
    if (!state.pendingAnchor) {
      cancelManualTag();
      return;
    }
    const labelPick = pickWorld(event);
    const labelPoint = labelPick?.point?.clone() || pointOnCameraPlane(event, state.pendingAnchor);
    if (!labelPoint) {
      toast('Could not place annotation rectangle. Try again.');
      return;
    }
    const body = window.prompt('Annotation text');
    if (!body || !body.trim()) {
      toast('Tag text empty; annotation not saved.');
      cancelManualTag();
      return;
    }
    addManualTag(body.trim(), state.pendingAnchor.clone(), labelPoint.clone());
    state.mode = 'idle';
    state.pendingAnchor = null;
    removePendingMarker();
    setTagButtonActive(false);
    toast('Leader annotation saved. Use Export XML to download Navis tag XML.');
  }
}

function convertIsonotesToTags() {
  const ctx = getContext();
  if (!ctx) {
    toast('Load or convert a model before converting ISONOTE to tags.');
    return;
  }

  const tags = collectIsonoteTags(ctx.scene);
  state.isonoteTags = tags;
  toast(tags.length ? `Prepared ${tags.length} ISONOTE tag viewpoint(s).` : 'No sideloaded ISONOTE boards found.');
}

function exportNavisTagXml() {
  const ctx = getContext();
  if (!ctx) {
    toast('Load or convert a model before exporting tag XML.');
    return;
  }

  if (!state.isonoteTags.length) state.isonoteTags = collectIsonoteTags(ctx.scene);
  const tags = [...state.isonoteTags, ...state.manualTags];
  if (!tags.length) {
    toast('No Navis tag markups to export. Add Tag or convert ISONOTE first.');
    return;
  }

  const xml = buildNavisXml(tags, ctx.camera, ctx.renderer);
  downloadText(xml, `3dmarkup_navis_tags_${timestampForFile()}.xml`, 'application/xml');
  toast(`Exported ${tags.length} Navis tag viewpoint(s).`);
}

function clearManualTags() {
  for (const tag of state.manualTags) {
    if (tag.group?.parent) tag.group.parent.remove(tag.group);
    disposeObject(tag.group);
  }
  state.manualTags = [];
  removePendingMarker();
  toast('Manual tag markups cleared. ISONOTE-derived tags can be regenerated.');
}

function addManualTag(body, anchor, labelPoint) {
  const ctx = getContext();
  const id = state.counter++;
  const group = new THREE.Group();
  group.name = `NAVIS_MANUAL_TAG_${id}`;
  group.userData = { isDisplayHelper: true, TYPE: 'NAVIS_TAG_MARKUP', source: 'MANUAL' };

  const lineGeometry = new THREE.BufferGeometry().setFromPoints([anchor, labelPoint]);
  const line = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: TAG_RED, depthTest: false, depthWrite: false }));
  line.name = `NAVIS_TAG_LEADER_${id}`;
  line.renderOrder = 1200;

  const anchorMarker = new THREE.Mesh(
    new THREE.SphereGeometry(markerRadius(anchor), 18, 10),
    new THREE.MeshBasicMaterial({ color: TAG_RED, depthTest: false })
  );
  anchorMarker.name = `NAVIS_TAG_ANCHOR_${id}`;
  anchorMarker.position.copy(anchor);
  anchorMarker.renderOrder = 1201;

  const label = createTextPlane(body, {
    width: 760,
    height: 220,
    fontSize: 30,
    scale: Math.max(markerRadius(anchor) * 12, 0.85),
    bg: 'rgba(28,16,18,0.94)',
    border: '#ff3b3b',
    name: `NAVIS_TAG_TEXT_${id}`
  });
  label.position.copy(labelPoint);
  label.renderOrder = 1202;
  label.material.depthTest = false;
  label.userData = { isDisplayHelper: true, TYPE: 'NAVIS_TAG_TEXT', body };
  if (ctx?.camera) label.lookAt(ctx.camera.position);

  group.add(line, anchorMarker, label);
  ensureDisplayGroup(ctx?.scene)?.add(group);

  state.manualTags.push({
    id,
    source: 'MANUAL',
    body,
    anchor: anchor.clone(),
    labelPoint: labelPoint.clone(),
    bounds: boundsAround(anchor, labelPoint),
    group
  });
}

function collectIsonoteTags(scene) {
  const tags = [];
  if (!scene) return tags;
  const nodePositions = collectNodePositions(scene);

  scene.traverse((object) => {
    const data = object.userData || {};
    if (data.TYPE !== 'ISONOTE_NAME_PLATE') return;
    const body = String(data.BOARD_TEXT || data.SOURCE_NOTE_NAME || data.sourceNoteName || '').trim();
    if (!body) return;
    const node = data.NODE || data.node || '';
    const labelPoint = worldPosition(object);
    const anchor = nodePositions.get(String(node)) || findLeaderAnchor(scene, node) || labelPoint.clone();
    tags.push({
      id: tags.length + 1,
      source: 'ISONOTE SIDELOAD',
      body,
      node,
      anchor,
      labelPoint,
      bounds: boundsAround(anchor, labelPoint),
      sourceObjectName: object.name || ''
    });
  });

  return tags;
}

function collectNodePositions(scene) {
  const out = new Map();
  scene.traverse((object) => {
    const data = object.userData || {};
    if (data.TYPE === 'NODE' && data.NODE !== undefined) out.set(String(data.NODE), worldPosition(object));
  });
  return out;
}

function findLeaderAnchor(scene, node) {
  let best = null;
  scene.traverse((object) => {
    if (best) return;
    const data = object.userData || {};
    if (data.TYPE === 'ISONOTE_LEADER' && String(data.NODE || data.node || '') === String(node)) {
      best = worldPosition(object);
    }
  });
  return best;
}

function pickWorld(event) {
  const ctx = getContext();
  if (!ctx) return null;
  const rect = ctx.renderer.domElement.getBoundingClientRect();
  MOUSE.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  MOUSE.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  RAYCASTER.setFromCamera(MOUSE, ctx.camera);
  const hits = RAYCASTER.intersectObjects(ctx.scene.children, true);
  return hits.find((hit) => isPickable(hit.object)) || null;
}

function pointOnCameraPlane(event, anchor) {
  const ctx = getContext();
  if (!ctx) return null;
  const rect = ctx.renderer.domElement.getBoundingClientRect();
  MOUSE.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  MOUSE.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  RAYCASTER.setFromCamera(MOUSE, ctx.camera);
  const normal = ctx.camera.getWorldDirection(new THREE.Vector3()).normalize();
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, anchor);
  return RAYCASTER.ray.intersectPlane(plane, new THREE.Vector3());
}

function isPickable(object) {
  if (!object || object.visible === false) return false;
  if (object.isLight || object.isCamera) return false;
  if (object.userData?.isDisplayHelper || object.userData?.ignoreBounds) return false;
  const name = String(object.name || '').toLowerCase();
  if (name === 'grid' || name === 'axes') return false;
  if (name.includes('helper') || name.includes('measure') || name.includes('clip_plane_preview')) return false;
  let parent = object.parent;
  while (parent) {
    if (parent.userData?.isDisplayHelper || parent.userData?.ignoreBounds) return false;
    parent = parent.parent;
  }
  return Boolean(object.geometry || object.isMesh || object.isLine);
}

function showPendingMarker(point) {
  const ctx = getContext();
  if (!ctx) return;
  removePendingMarker();
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(markerRadius(point) * 1.15, 18, 10),
    new THREE.MeshBasicMaterial({ color: TAG_YELLOW, depthTest: false })
  );
  marker.name = 'NAVIS_TAG_PENDING_ANCHOR';
  marker.position.copy(point);
  marker.renderOrder = 1199;
  marker.userData = { isDisplayHelper: true };
  ensureDisplayGroup(ctx.scene)?.add(marker);
  state.pendingMarker = marker;
}

function removePendingMarker() {
  if (!state.pendingMarker) return;
  if (state.pendingMarker.parent) state.pendingMarker.parent.remove(state.pendingMarker);
  disposeObject(state.pendingMarker);
  state.pendingMarker = null;
}

function ensureDisplayGroup(scene) {
  if (!scene) return null;
  if (state.displayGroup && state.displayGroup.parent === scene) return state.displayGroup;
  const group = new THREE.Group();
  group.name = 'NAVIS_TAG_MARKUP_DISPLAY_LAYER';
  group.userData = { isDisplayHelper: true, ignoreBounds: true };
  scene.add(group);
  state.displayGroup = group;
  return group;
}

function keepMarkupLabelsFacingCamera() {
  const camera = state.camera || runtime?.camera;
  if (!camera || !state.displayGroup) return;
  state.displayGroup.traverse((object) => {
    if (object.name?.startsWith('NAVIS_TAG_TEXT_')) object.lookAt(camera.position);
  });
}

function buildNavisXml(tags, camera, renderer) {
  const now = new Date();
  const views = tags.map((tag, index) => viewXml(tag, index + 1, camera, renderer, now)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8" ?>\n\n<exchange xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://download.autodesk.com/us/navisworks/schemas/nw-exchange-12.0.xsd" units="m" filename="3DMarkupTool.nwd" filepath="">\n  <viewpoints>\n${views}\n  </viewpoints>\n</exchange>\n`;
}

function viewXml(tag, viewIndex, camera, renderer, date) {
  const commentId = viewIndex;
  const tagId = viewIndex;
  const guid = crypto.randomUUID?.() || fallbackGuid(viewIndex);
  const cam = cameraSnapshotFor(tag, camera, renderer);
  const anchor2d = projectTo2f(tag.anchor, camera);
  const label2d = projectTo2f(tag.labelPoint || tag.anchor, camera);
  const bounds = tag.bounds || boundsAround(tag.anchor, tag.labelPoint || tag.anchor);
  return `    <view name="Tag View ${viewIndex}" guid="${guid}">
      <viewpoint tool="none" render="shaded" lighting="headlight" focal="${fmt(cam.focal)}" linear="18.9306050001" angular="0.7853981634">
        <camera projection="persp" near="${fmt(cam.near)}" far="${fmt(cam.far)}" aspect="${fmt(cam.aspect)}" height="0.7853980000">
          <position>
            ${pos3f(cam.position)}
          </position>
          <rotation>
            ${quat(cam.quaternion)}
          </rotation>
        </camera>
        <viewer radius="0.3000000000" height="1.8000000000" actual_height="1.8000000000" eye_height="0.1500000000" avatar="construction_worker" camera_mode="first" first_to_third_angle="0.0000000000" first_to_third_distance="3.0000000000" first_to_third_param="1.0000000000" first_to_third_correction="1" collision_detection="0" auto_crouch="0" gravity="0" gravity_value="9.8000000000" terminal_velocity="50.0000000000"/>
        <up>
          <vec3f x="0.0000000000" y="0.0000000000" z="1.0000000000"/>
        </up>
      </viewpoint>
${clipPlaneSetXml()}
      <comments>
        <comment id="${commentId}" status="new">
          <user>3DMarkupTool</user>
          <body>${escapeXml(tag.body)}</body>
          <createddate>
            <date year="${date.getFullYear()}" month="${date.getMonth() + 1}" day="${date.getDate()}" hour="${date.getHours()}" minute="${date.getMinutes()}" second="${date.getSeconds()}"/>
          </createddate>
        </comment>
      </comments>
      <redlines>
        <rltag thickness="3" pattern="65535" id="${tagId}" commentid="${commentId}">
          <colour red="1.0000000000" green="0.0000000000" blue="0.0000000000"/>
          <pos1>
            <pos2f x="${fmt(anchor2d.x)}" y="${fmt(anchor2d.y)}"/>
          </pos1>
          <pos2>
            <pos2f x="${fmt(label2d.x)}" y="${fmt(label2d.y)}"/>
          </pos2>
          <pos3d>
            ${pos3f(tag.anchor)}
          </pos3d>
          <bounds>
            <box3f>
              <min>
                ${pos3f(bounds.min)}
              </min>
              <max>
                ${pos3f(bounds.max)}
              </max>
            </box3f>
          </bounds>
        </rltag>
      </redlines>
    </view>`;
}

function cameraSnapshotFor(tag, camera, renderer) {
  const anchor = tag.anchor || new THREE.Vector3();
  const label = tag.labelPoint || anchor;
  const center = anchor.clone().add(label).multiplyScalar(0.5);
  const distance = Math.max(anchor.distanceTo(label) * 3.5, 8);
  const dir = camera?.position ? camera.position.clone().sub(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(0)).sub(center).normalize() : new THREE.Vector3(1, 0.8, 1).normalize();
  if (!Number.isFinite(dir.x) || dir.lengthSq() < 1e-8) dir.set(1, 0.8, 1).normalize();
  const position = center.clone().add(dir.multiplyScalar(distance));
  const tempCamera = camera?.clone?.() || new THREE.PerspectiveCamera(48, 1.78, 0.1, 1000);
  tempCamera.position.copy(position);
  tempCamera.lookAt(center);
  tempCamera.updateMatrixWorld(true);
  return {
    position,
    quaternion: tempCamera.quaternion.clone(),
    near: Math.max(0.01, distance / 1000),
    far: Math.max(1000, distance * 25),
    focal: Math.max(distance, 1),
    aspect: renderer?.domElement ? renderer.domElement.clientWidth / Math.max(renderer.domElement.clientHeight, 1) : 1.7777777778
  };
}

function clipPlaneSetXml() {
  const plane = '              <vec3f x="0.0000000000" y="1.0000000000" z="0.0000000000"/>';
  const clips = ['top', 'bottom', 'front', 'back', 'left', 'right'].map((alignment) => `          <clipplane state="default" distance="0.0000000000" alignment="${alignment}">
            <plane distance="0.0000000000">
${plane}
            </plane>
          </clipplane>`).join('\n');
  return `      <clipplaneset linked="0" current="0" mode="planes" enabled="0">
        <range>
          <box3f>
            <min>
              <pos3f x="1.0000000000" y="1.0000000000" z="1.0000000000"/>
            </min>
            <max>
              <pos3f x="0.0000000000" y="0.0000000000" z="0.0000000000"/>
            </max>
          </box3f>
        </range>
        <clipplanes>
${clips}
        </clipplanes>
        <box>
          <box3f>
            <min>
              <pos3f x="1.0000000000" y="1.0000000000" z="1.0000000000"/>
            </min>
            <max>
              <pos3f x="0.0000000000" y="0.0000000000" z="0.0000000000"/>
            </max>
          </box3f>
        </box>
        <box-rotation>
          <rotation>
            <quaternion a="0.0000000000" b="0.0000000000" c="0.0000000000" d="1.0000000000"/>
          </rotation>
        </box-rotation>
      </clipplaneset>`;
}

function projectTo2f(point, camera) {
  if (!point || !camera) return { x: 0, y: 0 };
  const projected = point.clone().project(camera);
  return {
    x: Number.isFinite(projected.x) ? clamp(projected.x, -1, 1) : 0,
    y: Number.isFinite(projected.y) ? clamp(projected.y, -1, 1) : 0
  };
}

function pos3f(point) {
  return `<pos3f x="${fmt(point?.x || 0)}" y="${fmt(point?.y || 0)}" z="${fmt(point?.z || 0)}"/>`;
}

function quat(q) {
  return `<quaternion a="${fmt(q?.x || 0)}" b="${fmt(q?.y || 0)}" c="${fmt(q?.z || 0)}" d="${fmt(q?.w ?? 1)}"/>`;
}

function boundsAround(a, b) {
  const box = new THREE.Box3().setFromPoints([a, b || a]);
  const pad = Math.max(a.distanceTo(b || a) * 0.08, markerRadius(a) * 2, 0.05);
  box.expandByScalar(pad);
  return box;
}

function markerRadius(point) {
  const ctx = getContext();
  if (!ctx?.camera || !point) return 0.08;
  return Math.max(ctx.camera.position.distanceTo(point) * 0.004, 0.04);
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

function setTagButtonActive(active) {
  const btn = document.getElementById('navisTagBtn');
  btn?.classList.toggle('tool-active', active);
}

function injectStyles() {
  if (document.getElementById('navisTagMarkupStyles')) return;
  const style = document.createElement('style');
  style.id = 'navisTagMarkupStyles';
  style.textContent = `
    .navis-tag-tools .tool-btn { min-width: 54px; }
    .navis-tag-toast {
      position: absolute;
      left: 50%;
      bottom: 48px;
      z-index: 80;
      transform: translateX(-50%);
      max-width: min(620px, calc(100vw - 48px));
      padding: 9px 13px;
      border: 1px solid rgba(255, 209, 102, .58);
      border-radius: 999px;
      color: #fff4cf;
      background: rgba(15, 23, 42, .90);
      box-shadow: 0 10px 28px rgba(0, 0, 0, .35);
      font-size: 12px;
      font-weight: 850;
      pointer-events: none;
      opacity: 0;
      transition: opacity .15s ease;
    }
    .navis-tag-toast.show { opacity: 1; }
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

function downloadText(text, filename, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function disposeObject(root) {
  if (!root) return;
  root.traverse?.((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((mat) => mat?.dispose?.());
    else object.material?.dispose?.();
  });
}

function hasInputFocus() {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
}

function escapeXml(value) {
  return String(value ?? '').replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]));
}

function fmt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(10) : '0.0000000000';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}

function fallbackGuid(index) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}
