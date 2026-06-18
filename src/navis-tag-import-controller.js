import * as THREE from 'three';
import { createTextPlane } from './geometry.js?v=professional-viewer-3';

const runtime = window.__3D_MARKUP_CLIP_RUNTIME__ || null;
const RAYCASTER = new THREE.Raycaster();
const MOUSE = new THREE.Vector2();
const TAG_RED = 0xff2b2b;
const TAG_YELLOW = 0xffd166;
const TAG_IMPORT = 0xff8c42;

const state = {
  renderer: runtime?.renderer || null,
  scene: runtime?.scene || null,
  camera: runtime?.camera || null,
  canvas: null,
  importedTags: [],
  activeHelper: null,
  importLayer: null,
  panel: null,
  lastListSignature: '',
  counter: 1
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initNavisTagImport, { once: true });
} else {
  initNavisTagImport();
}

window.addEventListener('markup:render-context', (event) => {
  const { renderer, scene, camera } = event.detail || {};
  if (renderer) state.renderer = renderer;
  if (scene) state.scene = scene;
  if (camera) state.camera = camera;
  if (renderer?.domElement) bindCanvas(renderer.domElement);
  ensureImportLayer(scene || state.scene);
  keepImportedLabelsFacingCamera();
});

function initNavisTagImport() {
  injectStyles();
  injectButtons();
  ensureViewpointPanel();
  bindCanvas((runtime || window.__3D_MARKUP_CLIP_RUNTIME__)?.renderer?.domElement);
  setInterval(updateViewpointList, 1200);
}

function injectButtons() {
  const tagGroup = document.querySelector('.navis-tag-tools');
  if (!tagGroup || document.getElementById('navisImportTagsBtn')) return;

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = 'navisImportTagsFile';
  fileInput.accept = '.xml,text/xml,application/xml';
  fileInput.hidden = true;
  tagGroup.appendChild(fileInput);

  const importBtn = document.createElement('button');
  importBtn.id = 'navisImportTagsBtn';
  importBtn.type = 'button';
  importBtn.className = 'tool-btn';
  importBtn.title = 'Import Navis XML tag viewpoints';
  importBtn.textContent = 'Import XML';

  const viewsBtn = document.createElement('button');
  viewsBtn.id = 'navisTagViewsBtn';
  viewsBtn.type = 'button';
  viewsBtn.className = 'tool-btn';
  viewsBtn.title = 'Show tag viewpoint list';
  viewsBtn.textContent = 'Tag Views';

  const exportBtn = document.getElementById('navisExportTagsBtn');
  tagGroup.insertBefore(importBtn, exportBtn || null);
  tagGroup.insertBefore(viewsBtn, exportBtn || null);

  importBtn.addEventListener('click', () => fileInput.click());
  viewsBtn.addEventListener('click', toggleViewpointPanel);
  fileInput.addEventListener('change', importFile);

  document.getElementById('navisExportTagsBtn')?.addEventListener('click', exportAllNavisTags, true);
  document.getElementById('navisIsonoteBtn')?.addEventListener('click', () => setTimeout(() => {
    setPanelOpen(true);
    updateViewpointList(true);
  }, 120), true);
  document.getElementById('navisClearTagsBtn')?.addEventListener('click', () => {
    clearImportedTags();
    setTimeout(() => updateViewpointList(true), 120);
  }, true);

  window.addEventListener('keydown', (event) => {
    if (isInputFocused()) return;
    if (event.key?.toLowerCase() === 'v' && event.shiftKey) {
      event.preventDefault();
      toggleViewpointPanel();
    }
  });
}

function bindCanvas(canvas) {
  if (!canvas || state.canvas === canvas) return;
  if (state.canvas) {
    state.canvas.removeEventListener('pointerdown', blockOrbitWhileTagging, true);
    state.canvas.removeEventListener('pointermove', blockOrbitWhileTagging, true);
    state.canvas.removeEventListener('pointerup', blockOrbitWhileTagging, true);
  }
  state.canvas = canvas;
  canvas.addEventListener('pointerdown', blockOrbitWhileTagging, true);
  canvas.addEventListener('pointermove', blockOrbitWhileTagging, true);
  canvas.addEventListener('pointerup', blockOrbitWhileTagging, true);
}

function blockOrbitWhileTagging(event) {
  if (!isManualTagInProgress()) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.type === 'pointermove') event.stopImmediatePropagation?.();
}

function isManualTagInProgress() {
  const tagBtn = document.getElementById('navisTagBtn');
  return Boolean(tagBtn?.classList.contains('tool-active') || document.querySelector('[name="NAVIS_TAG_PENDING_ANCHOR"]'));
}

async function importFile(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  try {
    const text = await file.text();
    const tags = parseNavisTagXml(text, file.name);
    if (!tags.length) {
      toast('No Navis tag viewpoints found in XML.');
      return;
    }

    clearImportedTags();
    state.importedTags = tags;
    renderImportedTags(tags);
    setPanelOpen(true);
    updateViewpointList(true);
    toast(`Imported ${tags.length} Navis tag viewpoint(s).`);
  } catch (err) {
    console.error(err);
    toast(`Import XML failed: ${err.message}`);
  }
}

function parseNavisTagXml(xmlText, filename) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) throw new Error('Invalid XML file.');

  const views = Array.from(doc.querySelectorAll('view'));
  const tags = [];
  for (const view of views) {
    const commentBody = textOf(view.querySelector('comments comment body')) || textOf(view.querySelector('comment body')) || view.getAttribute('name') || 'Imported tag';
    const rltag = view.querySelector('redlines rltag') || view.querySelector('rltag');
    if (!rltag) continue;

    const anchor = parsePos3f(rltag.querySelector('pos3d pos3f')) || parseBoundsCenter(rltag.querySelector('bounds box3f')) || new THREE.Vector3();
    const bounds = parseBounds(rltag.querySelector('bounds box3f')) || boundsAround(anchor, anchor.clone().add(new THREE.Vector3(1, 1, 1)));
    const center = bounds.getCenter(new THREE.Vector3());
    let labelPoint = center.distanceTo(anchor) > 1e-6 ? center : anchor.clone().add(new THREE.Vector3(1, 1, 1));

    const cameraSnapshot = parseCameraSnapshot(view.querySelector('viewpoint camera'));
    tags.push({
      id: `imported-${state.counter++}`,
      source: 'IMPORTED XML',
      sourceFile: filename,
      name: view.getAttribute('name') || `Imported View ${tags.length + 1}`,
      body: commentBody.trim(),
      anchor,
      labelPoint,
      bounds,
      cameraSnapshot,
      imported: true,
      group: null
    });
  }
  return tags;
}

function renderImportedTags(tags) {
  const ctx = getContext();
  const layer = ensureImportLayer(ctx?.scene);
  if (!layer) return;

  for (const tag of tags) {
    const group = new THREE.Group();
    group.name = `NAVIS_IMPORTED_TAG_${tag.id}`;
    group.userData = { isDisplayHelper: true, TYPE: 'NAVIS_TAG_MARKUP', source: 'IMPORTED XML', body: tag.body };

    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([tag.anchor, tag.labelPoint]),
      new THREE.LineBasicMaterial({ color: TAG_IMPORT, depthTest: false, depthWrite: false })
    );
    line.name = `NAVIS_IMPORTED_TAG_LEADER_${tag.id}`;
    line.renderOrder = 1210;

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(markerRadius(tag.anchor), 18, 10),
      new THREE.MeshBasicMaterial({ color: TAG_IMPORT, depthTest: false })
    );
    marker.name = `NAVIS_IMPORTED_TAG_ANCHOR_${tag.id}`;
    marker.position.copy(tag.anchor);
    marker.renderOrder = 1211;

    const label = createTextPlane(tag.body, {
      width: 760,
      height: 220,
      fontSize: 30,
      scale: Math.max(markerRadius(tag.anchor) * 12, 0.85),
      bg: 'rgba(32,20,10,0.94)',
      border: '#ff8c42',
      name: `NAVIS_IMPORTED_TAG_TEXT_${tag.id}`
    });
    label.position.copy(tag.labelPoint);
    label.renderOrder = 1212;
    label.material.depthTest = false;
    label.userData = { isDisplayHelper: true, TYPE: 'NAVIS_TAG_TEXT', source: 'IMPORTED XML', body: tag.body };
    if (ctx?.camera) label.lookAt(ctx.camera.position);

    group.add(line, marker, label);
    layer.add(group);
    tag.group = group;
  }
}

function clearImportedTags() {
  for (const tag of state.importedTags) {
    if (tag.group?.parent) tag.group.parent.remove(tag.group);
    disposeObject(tag.group);
  }
  state.importedTags = [];
  removeActiveHelper();
  updateViewpointList(true);
}

function exportAllNavisTags(event) {
  const ctx = getContext();
  if (!ctx) return;

  const tags = collectAllTags(ctx.scene);
  if (!tags.length) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();

  const xml = buildNavisXml(tags, ctx.camera, ctx.renderer);
  downloadText(xml, `3dmarkup_navis_tags_${timestampForFile()}.xml`, 'application/xml');
  toast(`Exported ${tags.length} Navis tag viewpoint(s).`);
}

function collectAllTags(scene) {
  const imported = [...state.importedTags];
  const isonote = collectIsonoteTags(scene);
  const manual = collectManualTags(scene);
  return [...imported, ...isonote, ...manual];
}

function collectManualTags(scene) {
  const out = [];
  scene?.traverse?.((object) => {
    if (!object.name?.startsWith('NAVIS_MANUAL_TAG_')) return;
    const label = object.children.find((child) => child.name?.startsWith('NAVIS_TAG_TEXT_'));
    const line = object.children.find((child) => child.name?.startsWith('NAVIS_TAG_LEADER_'));
    const body = label?.userData?.body || object.userData?.body || 'Manual tag';
    const points = line?.geometry?.attributes?.position;
    let anchor = null;
    let labelPoint = null;
    if (points?.count >= 2) {
      anchor = new THREE.Vector3(points.getX(0), points.getY(0), points.getZ(0)).applyMatrix4(line.matrixWorld);
      labelPoint = new THREE.Vector3(points.getX(1), points.getY(1), points.getZ(1)).applyMatrix4(line.matrixWorld);
    } else {
      anchor = object.getWorldPosition(new THREE.Vector3());
      labelPoint = label?.getWorldPosition(new THREE.Vector3()) || anchor.clone();
    }

    out.push({
      id: object.name,
      source: 'MANUAL',
      name: object.name,
      body,
      anchor,
      labelPoint,
      bounds: boundsAround(anchor, labelPoint),
      group: object
    });
  });
  return out;
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
      id: `isonote-${tags.length + 1}`,
      source: 'ISONOTE SIDELOAD',
      name: data.SOURCE_NOTE_NAME || data.sourceNoteName || `ISONOTE ${tags.length + 1}`,
      body,
      node,
      anchor,
      labelPoint,
      bounds: boundsAround(anchor, labelPoint),
      sourceObject: object
    });
  });
  return tags;
}

function updateViewpointList(force = false) {
  const panel = ensureViewpointPanel();
  const list = panel?.querySelector('.navis-tag-view-list');
  const countEl = panel?.querySelector('.navis-tag-view-count');
  if (!list) return;

  const tags = collectAllTags(getContext()?.scene);
  const signature = tags.map((tag) => `${tag.source}:${tag.name}:${tag.body}:${vectorSig(tag.anchor)}:${vectorSig(tag.labelPoint)}`).join('|');
  if (!force && signature === state.lastListSignature) return;
  state.lastListSignature = signature;

  if (countEl) countEl.textContent = `${tags.length} viewpoint${tags.length === 1 ? '' : 's'}`;
  if (!tags.length) {
    list.innerHTML = '<div class="navis-tag-empty">No tag viewpoints yet. Use ISONOTE XML, Import XML, or Tag.</div>';
    return;
  }

  list.innerHTML = tags.map((tag, index) => `
    <button type="button" class="navis-tag-view-row" data-index="${index}">
      <span class="navis-tag-view-title">${escapeHtml(tag.name || `Tag View ${index + 1}`)}</span>
      <span class="navis-tag-view-body">${escapeHtml(tag.body || '')}</span>
      <span class="navis-tag-view-source">${escapeHtml(tag.source || 'TAG')}</span>
    </button>
  `).join('');

  list.querySelectorAll('.navis-tag-view-row').forEach((row) => {
    row.addEventListener('click', () => {
      const tag = tags[Number(row.dataset.index)];
      if (!tag) return;
      selectAndFitTag(tag);
      list.querySelectorAll('.navis-tag-view-row').forEach((item) => item.classList.remove('active'));
      row.classList.add('active');
    });
  });
}

function selectAndFitTag(tag) {
  const ctx = getContext();
  if (!ctx || !tag) return;
  removeActiveHelper();

  const box = tag.bounds || boundsAround(tag.anchor, tag.labelPoint || tag.anchor);
  const helper = new THREE.Box3Helper(box, TAG_YELLOW);
  helper.name = 'NAVIS_TAG_ACTIVE_HELPER';
  helper.renderOrder = 1300;
  helper.material.depthTest = false;
  ensureImportLayer(ctx.scene)?.add(helper);
  state.activeHelper = helper;

  window.__3D_MARKUP_SELECTED_OBJECT__ = tag.group || tag.sourceObject || helper;
  window.dispatchEvent(new CustomEvent('markup:selected-object-changed', { detail: { object: window.__3D_MARKUP_SELECTED_OBJECT__, source: 'navis-tag-viewpoint' } }));

  fitTagBounds(box, ctx, tag.cameraSnapshot);
  setStatus(`Tag viewpoint: ${tag.name || tag.body || 'selected'}`);
}

function fitTagBounds(box, ctx, cameraSnapshot) {
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
  const distance = Math.max(radius / Math.sin(fov / 2), radius * 2.8) * 1.12;

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

function ensureViewpointPanel() {
  if (state.panel) return state.panel;
  const host = document.querySelector('.viewer-stage') || document.body;
  const panel = document.createElement('aside');
  panel.id = 'navisTagViewPanel';
  panel.className = 'navis-tag-view-panel';
  panel.innerHTML = `
    <div class="navis-tag-view-head">
      <div>
        <strong>Tag Viewpoints</strong>
        <span class="navis-tag-view-count">0 viewpoints</span>
      </div>
      <button type="button" class="navis-tag-view-close" title="Close tag viewpoints">×</button>
    </div>
    <div class="navis-tag-view-hint">Click a tag to select and fit/zoom.</div>
    <div class="navis-tag-view-list"></div>
  `;
  host.appendChild(panel);
  panel.querySelector('.navis-tag-view-close')?.addEventListener('click', () => setPanelOpen(false));
  state.panel = panel;
  return panel;
}

function toggleViewpointPanel() {
  const panel = ensureViewpointPanel();
  const open = !panel.classList.contains('open');
  setPanelOpen(open);
  if (open) updateViewpointList(true);
}

function setPanelOpen(open) {
  ensureViewpointPanel()?.classList.toggle('open', Boolean(open));
  document.getElementById('navisTagViewsBtn')?.classList.toggle('tool-active', Boolean(open));
  if (open) updateViewpointList(true);
}

function ensureImportLayer(scene) {
  if (!scene) return null;
  if (state.importLayer && state.importLayer.parent === scene) return state.importLayer;
  const group = new THREE.Group();
  group.name = 'NAVIS_TAG_IMPORT_DISPLAY_LAYER';
  group.userData = { isDisplayHelper: true, ignoreBounds: true };
  scene.add(group);
  state.importLayer = group;
  return group;
}

function keepImportedLabelsFacingCamera() {
  const camera = state.camera || runtime?.camera;
  if (!camera || !state.importLayer) return;
  state.importLayer.traverse((object) => {
    if (object.name?.includes('TAG_TEXT_')) object.lookAt(camera.position);
  });
}

function collectNodePositions(scene) {
  const out = new Map();
  scene?.traverse?.((object) => {
    const data = object.userData || {};
    if (data.TYPE === 'NODE' && data.NODE !== undefined) out.set(String(data.NODE), worldPosition(object));
  });
  return out;
}

function findLeaderAnchor(scene, node) {
  let best = null;
  scene?.traverse?.((object) => {
    if (best) return;
    const data = object.userData || {};
    if (data.TYPE === 'ISONOTE_LEADER' && String(data.NODE || data.node || '') === String(node)) best = worldPosition(object);
  });
  return best;
}

function buildNavisXml(tags, camera, renderer) {
  const now = new Date();
  const views = tags.map((tag, index) => viewXml(tag, index + 1, camera, renderer, now)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8" ?>\n\n<exchange xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://download.autodesk.com/us/navisworks/schemas/nw-exchange-12.0.xsd" units="m" filename="3DMarkupTool.nwd" filepath="">\n  <viewpoints>\n${views}\n  </viewpoints>\n</exchange>\n`;
}

function viewXml(tag, viewIndex, camera, renderer, date) {
  const guid = crypto.randomUUID?.() || fallbackGuid(viewIndex);
  const cam = cameraSnapshotFor(tag, camera, renderer);
  const anchor2d = projectTo2f(tag.anchor, camera);
  const label2d = projectTo2f(tag.labelPoint || tag.anchor, camera);
  const bounds = tag.bounds || boundsAround(tag.anchor, tag.labelPoint || tag.anchor);
  return `    <view name="${escapeXml(tag.name || `Tag View ${viewIndex}`)}" guid="${guid}">
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
        <comment id="${viewIndex}" status="new">
          <user>3DMarkupTool</user>
          <body>${escapeXml(tag.body)}</body>
          <createddate>
            <date year="${date.getFullYear()}" month="${date.getMonth() + 1}" day="${date.getDate()}" hour="${date.getHours()}" minute="${date.getMinutes()}" second="${date.getSeconds()}"/>
          </createddate>
        </comment>
      </comments>
      <redlines>
        <rltag thickness="3" pattern="65535" id="${viewIndex}" commentid="${viewIndex}">
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
  if (tag.cameraSnapshot?.position && tag.cameraSnapshot?.quaternion) {
    const distance = tag.cameraSnapshot.position.distanceTo(tag.anchor || new THREE.Vector3());
    return {
      position: tag.cameraSnapshot.position.clone(),
      quaternion: tag.cameraSnapshot.quaternion.clone(),
      near: tag.cameraSnapshot.near || Math.max(0.01, distance / 1000),
      far: tag.cameraSnapshot.far || Math.max(1000, distance * 25),
      focal: Math.max(distance, 1),
      aspect: tag.cameraSnapshot.aspect || rendererAspect(renderer)
    };
  }

  const anchor = tag.anchor || new THREE.Vector3();
  const label = tag.labelPoint || anchor;
  const center = anchor.clone().add(label).multiplyScalar(0.5);
  const distance = Math.max(anchor.distanceTo(label) * 3.5, 8);
  let dir = camera?.position ? camera.position.clone().sub(center).normalize() : new THREE.Vector3(1, 0.8, 1).normalize();
  if (!Number.isFinite(dir.x) || dir.lengthSq() < 1e-8) dir = new THREE.Vector3(1, 0.8, 1).normalize();
  const position = center.clone().add(dir.multiplyScalar(distance));
  const tempCamera = camera?.clone?.() || new THREE.PerspectiveCamera(48, rendererAspect(renderer), 0.1, 1000);
  tempCamera.position.copy(position);
  tempCamera.lookAt(center);
  tempCamera.updateMatrixWorld(true);
  return {
    position,
    quaternion: tempCamera.quaternion.clone(),
    near: Math.max(0.01, distance / 1000),
    far: Math.max(1000, distance * 25),
    focal: Math.max(distance, 1),
    aspect: rendererAspect(renderer)
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
      </clipplaneset>`;
}

function parseCameraSnapshot(cameraNode) {
  if (!cameraNode) return null;
  const pos = parsePos3f(cameraNode.querySelector('position pos3f'));
  const qNode = cameraNode.querySelector('rotation quaternion');
  if (!pos || !qNode) return null;
  const quat = new THREE.Quaternion(
    numAttr(qNode, 'a', 0),
    numAttr(qNode, 'b', 0),
    numAttr(qNode, 'c', 0),
    numAttr(qNode, 'd', 1)
  );
  return {
    position: pos,
    quaternion: quat,
    near: numAttr(cameraNode, 'near', 0.01),
    far: numAttr(cameraNode, 'far', 1000),
    aspect: numAttr(cameraNode, 'aspect', 1.7777777778)
  };
}

function parseBounds(boxNode) {
  if (!boxNode) return null;
  const min = parsePos3f(boxNode.querySelector('min pos3f'));
  const max = parsePos3f(boxNode.querySelector('max pos3f'));
  if (!min || !max) return null;
  const box = new THREE.Box3(min, max);
  return isValidBox(box) ? box : null;
}

function parseBoundsCenter(boxNode) {
  const box = parseBounds(boxNode);
  return box ? box.getCenter(new THREE.Vector3()) : null;
}

function parsePos3f(node) {
  if (!node) return null;
  return new THREE.Vector3(numAttr(node, 'x', 0), numAttr(node, 'y', 0), numAttr(node, 'z', 0));
}

function numAttr(node, name, fallback) {
  const value = Number(node?.getAttribute?.(name));
  return Number.isFinite(value) ? value : fallback;
}

function isValidBox(box) {
  return Boolean(box) && Number.isFinite(box.min.x) && Number.isFinite(box.min.y) && Number.isFinite(box.min.z) && Number.isFinite(box.max.x) && Number.isFinite(box.max.y) && Number.isFinite(box.max.z) && box.max.x >= box.min.x && box.max.y >= box.min.y && box.max.z >= box.min.z;
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

function worldPosition(object) {
  return object.getWorldPosition(new THREE.Vector3());
}

function rendererAspect(renderer) {
  return renderer?.domElement ? renderer.domElement.clientWidth / Math.max(renderer.domElement.clientHeight, 1) : 1.7777777778;
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

function injectStyles() {
  if (document.getElementById('navisTagImportStyles')) return;
  const style = document.createElement('style');
  style.id = 'navisTagImportStyles';
  style.textContent = `
    .navis-tag-view-panel {
      position: absolute;
      right: 18px;
      top: 232px;
      z-index: 24;
      width: 330px;
      max-height: calc(100vh - 330px);
      display: none;
      flex-direction: column;
      border: 1px solid rgba(88, 124, 160, .72);
      border-radius: 14px;
      background: rgba(8, 17, 31, .94);
      box-shadow: 0 18px 44px rgba(0, 0, 0, .38);
      backdrop-filter: blur(12px);
      color: #eef6ff;
      overflow: hidden;
    }
    body.props-open .navis-tag-view-panel { right: 360px; }
    .navis-tag-view-panel.open { display: flex; }
    .navis-tag-view-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      padding: 11px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, .09);
      background: rgba(18, 35, 58, .86);
    }
    .navis-tag-view-head strong { display: block; font-size: 14px; }
    .navis-tag-view-count { display: block; margin-top: 3px; color: #9fb0c5; font-size: 11px; }
    .navis-tag-view-close {
      min-width: 28px;
      width: 28px;
      height: 28px;
      min-height: 28px;
      padding: 0;
      border-radius: 8px;
    }
    .navis-tag-view-hint {
      padding: 8px 12px;
      color: #b9c9db;
      font-size: 11px;
      border-bottom: 1px solid rgba(255, 255, 255, .07);
    }
    .navis-tag-view-list { overflow: auto; padding: 8px; }
    .navis-tag-empty { padding: 12px; color: #b9c9db; font-size: 12px; }
    .navis-tag-view-row {
      display: grid;
      gap: 4px;
      width: 100%;
      min-height: 0;
      margin: 0 0 7px;
      padding: 9px 10px;
      text-align: left;
      border-radius: 10px;
      background: rgba(11, 22, 38, .90);
      border: 1px solid rgba(69, 98, 127, .82);
    }
    .navis-tag-view-row:hover,
    .navis-tag-view-row.active {
      border-color: rgba(255, 209, 102, .86);
      background: rgba(47, 36, 24, .94);
    }
    .navis-tag-view-title { color: #fff; font-size: 12px; font-weight: 900; }
    .navis-tag-view-body { color: #d5e2f0; font-size: 11px; line-height: 1.35; max-height: 46px; overflow: hidden; }
    .navis-tag-view-source { justify-self: start; color: #ffe9b4; border: 1px solid rgba(215, 167, 52, .75); border-radius: 999px; padding: 1px 6px; font-size: 9px; font-weight: 900; }
    @media (max-width: 940px) {
      .navis-tag-view-panel,
      body.props-open .navis-tag-view-panel {
        right: 12px;
        left: 12px;
        width: auto;
        max-height: 44vh;
      }
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

function textOf(node) {
  return String(node?.textContent || '').trim();
}

function isInputFocused() {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
}

function setStatus(message) {
  const pill = document.getElementById('runtimeStatus');
  if (pill) pill.textContent = message;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function escapeXml(value) {
  return String(value ?? '').replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]));
}

function vectorSig(point) {
  return point ? `${point.x.toFixed(3)},${point.y.toFixed(3)},${point.z.toFixed(3)}` : '';
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
