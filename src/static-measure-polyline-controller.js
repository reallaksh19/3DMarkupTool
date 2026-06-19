import * as THREE from 'three';

// Adds a self-contained Measure Polyline tool to the in-canvas right-side view pad.
// Tool: ME = Measure. Click multiple model/canvas points to accumulate segment length.
// This intentionally avoids src/app.js so conversion/selection/runtime seams remain stable.

const VERSION = 'measure-polyline-viewpad-20260619';
const TOOL_VIEW = 'measurePolyline';
const TOOL_LABEL = 'ME';
const TOOL_TITLE = 'Measure Polyline: click points/components to measure cumulative length';
const STYLE_ID = 'static-measure-polyline-style';
const PANEL_ID = 'staticMeasurePolylinePanel';
const HELPER_GROUP_NAME = '__MEASURE_POLYLINE_HELPERS__';
const MIN_HIT_DISTANCE = 0.001;

let active = false;
let points = [];
let button = null;
let helperGroup = null;

installMeasurePolylineTool();

function installMeasurePolylineTool() {
  const start = () => {
    injectStyles();
    ensureButton();
    ensurePanel();
    attachCanvasListeners();
    installApi();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

function ensureButton() {
  const pad = document.querySelector('.view-pad');
  if (!pad) return;
  pad.classList.add('view-pad-with-measure-polyline');

  button = pad.querySelector(`[data-view="${TOOL_VIEW}"]`);
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.dataset.view = TOOL_VIEW;
    button.className = 'viewpad-measure-polyline-btn';
    button.textContent = TOOL_LABEL;
    const anchor = pad.querySelector('[data-view="componentSearch"]')
      || pad.querySelector('[data-view="savedViews"]')
      || pad.querySelector('[data-view="areaSelect"]')
      || pad.querySelector('[data-view="marqueeZoom"]')
      || pad.querySelector('[data-view="zoom"]')
      || null;
    pad.insertBefore(button, anchor);
  }

  button.title = TOOL_TITLE;
  button.setAttribute('aria-label', TOOL_TITLE);
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
  if (!button.__measurePolylineClickBound) {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      active ? finishMeasure() : activateMeasure();
    });
    button.__measurePolylineClickBound = true;
  }
}

function ensurePanel() {
  let panel = document.getElementById(PANEL_ID);
  if (panel) return panel;
  const host = document.getElementById('viewer') || document.querySelector('.viewer-wrap') || document.body;
  panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.className = 'measure-polyline-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Measure Polyline');
  host.appendChild(panel);
  renderPanel(panel);
  return panel;
}

function renderPanel(panel = document.getElementById(PANEL_ID)) {
  if (!panel) return;
  const segments = segmentLengths(points);
  const total = totalLength(points);
  panel.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'measure-polyline-panel__header';
  header.innerHTML = '<strong>Measure</strong><span>polyline length</span>';
  panel.appendChild(header);

  const stats = document.createElement('div');
  stats.className = 'measure-polyline-panel__stats';
  stats.innerHTML = `
    <div><span>Points</span><strong>${points.length}</strong></div>
    <div><span>Segments</span><strong>${segments.length}</strong></div>
    <div><span>Total</span><strong>${formatLength(total)}</strong></div>
  `;
  panel.appendChild(stats);

  const list = document.createElement('div');
  list.className = 'measure-polyline-panel__segments';
  if (!segments.length) {
    const empty = document.createElement('div');
    empty.className = 'measure-polyline-panel__empty';
    empty.textContent = active ? 'Click model points to start measuring.' : 'Click ME to start measuring.';
    list.appendChild(empty);
  } else {
    segments.forEach((length, index) => {
      const row = document.createElement('div');
      row.className = 'measure-polyline-panel__segment';
      row.innerHTML = `<span>S${index + 1}</span><strong>${formatLength(length)}</strong>`;
      list.appendChild(row);
    });
  }
  panel.appendChild(list);

  const actions = document.createElement('div');
  actions.className = 'measure-polyline-panel__actions';
  actions.appendChild(panelButton('Undo', 'Undo last point', undoPoint));
  actions.appendChild(panelButton('Clear', 'Clear measurement', clearMeasure));
  actions.appendChild(panelButton(active ? 'Finish' : 'Start', active ? 'Finish measurement' : 'Start measurement', () => active ? finishMeasure() : activateMeasure()));
  panel.appendChild(actions);
}

function panelButton(text, title, handler) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = text;
  btn.title = title;
  btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handler();
  });
  return btn;
}

function attachCanvasListeners() {
  const canvas = runtimeCanvas();
  if (!canvas || canvas.__measurePolylineAttached) return;
  canvas.__measurePolylineAttached = true;
  canvas.addEventListener('pointerdown', onPointerDown, true);
  canvas.addEventListener('dblclick', onDoubleClick, true);
  window.addEventListener('keydown', onKeyDown, true);
}

function runtimeCanvas() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__?.renderer?.domElement
    || document.querySelector('#viewer canvas');
}

function runtime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || null;
}

function modelRoot(rt = runtime()) {
  return rt?.getModelRoot?.() || rt?.modelRoot || null;
}

function activateMeasure() {
  active = true;
  ensurePanel().hidden = false;
  document.body.classList.add('measure-polyline-active');
  if (button) {
    button.classList.add('tool-active');
    button.setAttribute('aria-pressed', 'true');
  }
  setStatus('Measure polyline: click points, double-click or press Enter to finish');
  renderPanel();
  dispatchMeasure('activate');
}

function finishMeasure() {
  active = false;
  document.body.classList.remove('measure-polyline-active');
  if (button) {
    button.classList.remove('tool-active');
    button.setAttribute('aria-pressed', 'false');
  }
  setStatus(points.length > 1 ? `Measurement total: ${formatLength(totalLength(points))}` : 'Measure polyline off');
  renderPanel();
  dispatchMeasure('finish');
}

function clearMeasure() {
  points = [];
  clearHelpers();
  renderPanel();
  requestRender('measure-polyline-clear');
  dispatchMeasure('clear');
}

function undoPoint() {
  if (!points.length) return;
  points = points.slice(0, -1);
  rebuildHelpers();
  renderPanel();
  requestRender('measure-polyline-undo');
  dispatchMeasure('undo');
}

function onPointerDown(event) {
  if (!active || event.button !== 0) return;
  const rt = runtime();
  if (!rt?.camera) {
    setStatus('Measure unavailable: viewer runtime missing');
    finishMeasure();
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();

  const point = pickWorldPoint(event);
  if (!point) {
    setStatus('Measure: no point found');
    return;
  }
  addPoint(point);
}

function onDoubleClick(event) {
  if (!active) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  finishMeasure();
}

function onKeyDown(event) {
  if (!active) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    finishMeasure();
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    finishMeasure();
  }
  if ((event.key === 'Backspace' || event.key.toLowerCase() === 'z') && (event.ctrlKey || event.metaKey || event.key === 'Backspace')) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    undoPoint();
  }
}

function pickWorldPoint(event) {
  const rt = runtime();
  const camera = rt?.camera;
  const canvas = runtimeCanvas();
  if (!camera || !canvas) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -(((event.clientY - rect.top) / rect.height) * 2 - 1)
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const root = modelRoot(rt);
  const candidates = [];
  root?.traverse?.((object) => {
    if (!object || object.userData?.measurePolylineHelper) return;
    if (object.isMesh || object.isLine || object.isPoints) candidates.push(object);
  });
  const hits = candidates.length ? raycaster.intersectObjects(candidates, false) : [];
  const valid = hits.find((hit) => hit?.point && hit.distance >= MIN_HIT_DISTANCE);
  if (valid) return valid.point.clone();

  const target = rt.controls?.target?.clone?.() || new THREE.Vector3();
  const direction = camera.getWorldDirection(new THREE.Vector3()).normalize();
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(direction, target);
  const point = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, point) ? point : null;
}

function addPoint(point) {
  points = points.concat([point.clone ? point.clone() : new THREE.Vector3(point.x, point.y, point.z)]);
  rebuildHelpers();
  renderPanel();
  setStatus(`Measurement total: ${formatLength(totalLength(points))}`);
  requestRender('measure-polyline-point');
  dispatchMeasure('point', { point: vectorToArray(points[points.length - 1]) });
}

function ensureHelperGroup() {
  const rt = runtime();
  const scene = rt?.scene || modelRoot(rt)?.parent;
  if (!scene?.add) return null;
  if (helperGroup?.parent) return helperGroup;
  helperGroup = new THREE.Group();
  helperGroup.name = HELPER_GROUP_NAME;
  helperGroup.userData = { measurePolylineHelper: true, selectable: false };
  scene.add(helperGroup);
  return helperGroup;
}

function rebuildHelpers() {
  clearHelpers();
  const group = ensureHelperGroup();
  if (!group) return;
  const material = new THREE.LineBasicMaterial({ color: 0xffd166, linewidth: 2, depthTest: false });
  for (let i = 1; i < points.length; i += 1) {
    const geometry = new THREE.BufferGeometry().setFromPoints([points[i - 1], points[i]]);
    const line = new THREE.Line(geometry, material.clone());
    line.name = `MEASURE_SEGMENT_${i}`;
    line.renderOrder = 9998;
    line.userData = { measurePolylineHelper: true, segmentIndex: i - 1, length: points[i - 1].distanceTo(points[i]) };
    group.add(line);
  }
  const sphereGeometry = new THREE.SphereGeometry(pointMarkerRadius(), 12, 8);
  points.forEach((point, index) => {
    const marker = new THREE.Mesh(sphereGeometry.clone(), new THREE.MeshBasicMaterial({ color: 0xffd166, depthTest: false }));
    marker.name = `MEASURE_POINT_${index + 1}`;
    marker.position.copy(point);
    marker.renderOrder = 9999;
    marker.userData = { measurePolylineHelper: true, pointIndex: index };
    group.add(marker);
  });
}

function clearHelpers() {
  if (!helperGroup) return;
  while (helperGroup.children.length) {
    const child = helperGroup.children.pop();
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  }
}

function pointMarkerRadius() {
  const rt = runtime();
  const box = new THREE.Box3();
  const root = modelRoot(rt);
  if (root) box.setFromObject(root);
  const size = box.isEmpty() ? 1000 : box.getSize(new THREE.Vector3()).length();
  return Math.max(size * 0.003, 5);
}

function segmentLengths(list = points) {
  const out = [];
  for (let i = 1; i < list.length; i += 1) out.push(list[i - 1].distanceTo(list[i]));
  return out;
}

function totalLength(list = points) {
  return segmentLengths(list).reduce((sum, length) => sum + length, 0);
}

function formatLength(length) {
  if (!Number.isFinite(length)) return '—';
  if (Math.abs(length) >= 1000) return `${(length / 1000).toFixed(3)} m`;
  return `${length.toFixed(1)} mm`;
}

function vectorToArray(v) {
  return [Number(v.x), Number(v.y), Number(v.z)];
}

function requestRender(reason) {
  const rt = runtime();
  if (rt?.renderOnce) return rt.renderOnce(reason);
  window.dispatchEvent(new CustomEvent('viewer:request-render', { detail: { reason } }));
  return true;
}

function dispatchMeasure(action, extra = {}) {
  window.dispatchEvent(new CustomEvent('viewer:measure-polyline', {
    detail: {
      action,
      active,
      pointCount: points.length,
      segmentCount: Math.max(points.length - 1, 0),
      totalLength: totalLength(points),
      formattedTotal: formatLength(totalLength(points)),
      ...extra
    }
  }));
}

function setStatus(message) {
  const status = document.getElementById('statusText') || document.getElementById('coreStatus');
  if (status) status.textContent = message;
}

function installApi() {
  window.__3D_MARKUP_MEASURE_POLYLINE__ = {
    version: VERSION,
    activate: activateMeasure,
    finish: finishMeasure,
    clear: clearMeasure,
    undo: undoPoint,
    isActive: () => active,
    points: () => points.map(vectorToArray),
    segments: () => segmentLengths(points),
    total: () => totalLength(points),
    debug: () => ({ active, pointCount: points.length, segmentCount: Math.max(points.length - 1, 0), totalLength: totalLength(points), formattedTotal: formatLength(totalLength(points)) })
  };
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .viewpad-measure-polyline-btn.tool-active { outline: 2px solid rgba(255, 209, 102, 0.95); }
    body.measure-polyline-active #viewer canvas { cursor: crosshair; }
    .measure-polyline-panel {
      position: absolute;
      right: 68px;
      top: 136px;
      z-index: 35;
      width: 220px;
      border: 1px solid rgba(148, 163, 184, 0.35);
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.92);
      color: #e5e7eb;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
      padding: 10px;
      font: 12px/1.35 system-ui, -apple-system, Segoe UI, sans-serif;
    }
    .measure-polyline-panel[hidden] { display: none; }
    .measure-polyline-panel__header { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .measure-polyline-panel__header span { color: #94a3b8; font-size: 11px; }
    .measure-polyline-panel__stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 8px; }
    .measure-polyline-panel__stats div { background: rgba(30, 41, 59, 0.9); border-radius: 8px; padding: 6px; }
    .measure-polyline-panel__stats span { display: block; color: #94a3b8; font-size: 10px; }
    .measure-polyline-panel__stats strong { display: block; margin-top: 2px; font-size: 11px; }
    .measure-polyline-panel__segments { max-height: 120px; overflow: auto; border-top: 1px solid rgba(148, 163, 184, 0.2); border-bottom: 1px solid rgba(148, 163, 184, 0.2); padding: 4px 0; }
    .measure-polyline-panel__segment { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; }
    .measure-polyline-panel__segment span, .measure-polyline-panel__empty { color: #94a3b8; }
    .measure-polyline-panel__actions { display: flex; gap: 6px; justify-content: flex-end; margin-top: 8px; }
    .measure-polyline-panel__actions button { border: 1px solid rgba(148, 163, 184, 0.35); background: rgba(30, 41, 59, 0.9); color: #e5e7eb; border-radius: 8px; padding: 4px 8px; cursor: pointer; }
    .measure-polyline-panel__actions button:hover { background: rgba(51, 65, 85, 0.95); }
  `;
  document.head.appendChild(style);
}
