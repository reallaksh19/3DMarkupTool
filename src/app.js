import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createIcons, icons } from 'lucide';
import { runAppConversionController } from './app-run-conversion-controller.js?v=bust-cache-4';
import { createTextPlane } from './geometry.js?v=bust-cache-4';
import { DEFAULT_ISONOTE, DEFAULT_LINE_NO } from './parser.js?v=bust-cache-4';

const el = (id) => document.getElementById(id);
const hasInputFocus = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

const DEFAULT_VIEW = new THREE.Vector3(1.1, 0.78, 1.12);
const CLIP_PLANE = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
const DRAG_TOLERANCE_PX = 5;
const MATERIAL_COLORS = {
  default: null,
  pipe: 0xf0f4f8,
  valve: 0x21d4c4,
  bend: 0x67d4ef,
  rigid: 0x8fb2d8,
  supportActual: 0xffc857,
  supportExpected: 0x28e0c5,
  inputXml: 0x83b9ff,
  isonote: 0xffcc5c,
  unavailable: 0x6e7f91
};

const state = {
  xmlText: '',
  glb: null,
  rvm: null,
  att: null,
  audit: null,
  scene: null,
  glbScene: null,
  rvmScene: null,
  previewMode: 'glb',
  selected: null,
  selectedData: null,
  selectionHelper: null,
  objectUrls: [],
  activeTool: 'select',
  colorBy: 'default',
  clipEnabled: false,
  measurePoints: [],
  measureGroup: new THREE.Group(),
  originalMaterials: new WeakMap(),
  pointerDown: null
};

const viewer = el('viewer');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.localClippingEnabled = true;
viewer.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x30323a);
scene.add(state.measureGroup);

const camera = new THREE.PerspectiveCamera(48, viewer.clientWidth / viewer.clientHeight, 0.01, 10000);
camera.position.set(14, 10, 16);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.62;
controls.zoomSpeed = 0.82;
controls.panSpeed = 0.72;
controls.screenSpacePanning = true;
controls.target.set(0, 0, 0);
applyControlMode('select');

scene.add(new THREE.HemisphereLight(0xffffff, 0x242833, 1.55));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.75);
keyLight.position.set(8, 14, 9);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xbdd7ff, 0.72);
fillLight.position.set(-11, 7, -8);
scene.add(fillLight);
const rimLight = new THREE.DirectionalLight(0x79e5ff, 0.45);
rimLight.position.set(2, 6, -14);
scene.add(rimLight);

const grid = new THREE.GridHelper(48, 48, 0x4b6179, 0x2d3d50);
grid.name = 'grid';
grid.visible = true;
scene.add(grid);

const axes = new THREE.AxesHelper(2.5);
axes.name = 'axes';
scene.add(axes);

let modelRoot = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

publishViewerRuntime('app:renderer-created');
initUi();
publishViewerRuntime('app:ui-ready');
window.__3D_MARKUP_APP_READY__ = true;
publishViewerRuntime('app:ready');
window.dispatchEvent(new CustomEvent('markup:app-ready', { detail: { recoveryMode: Boolean(window.__3D_MARKUP_CORE_RECOVERY__) } }));
animate();

function publishViewerRuntime(reason = 'app') {
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
  const selectedData = state.selectedData || state.selected?.userData || null;
  const selectedId = selectedData ? displayTitle(selectedData, selectedData.TYPE || selectedData.type || 'Object') : '';
  const existingPlanes = Array.isArray(renderer.clippingPlanes) ? renderer.clippingPlanes : [];

  Object.assign(runtime, {
    renderer,
    scene,
    camera,
    controls,
    modelRoot: modelRoot || state.scene || scene,
    selectedObject: state.selected || null,
    selectedData,
    selectedId,
    clippingPlanes: existingPlanes,
    clippingMode: runtime.clippingMode || (existingPlanes.length ? (state.clipEnabled ? 'plane' : 'custom') : 'none'),
    source: reason,
    applyClipping(planes, meta = {}) {
      if (!renderer) {
        console.error('[3DMarkupTool:runtime] applyClipping failed: renderer missing', { ...meta, reason });
        return false;
      }
      const safePlanes = Array.isArray(planes) ? planes : [];
      renderer.localClippingEnabled = safePlanes.length > 0;
      renderer.clippingPlanes = safePlanes;
      runtime.clippingPlanes = renderer.clippingPlanes;
      runtime.clippingMode = meta.mode || (safePlanes.length ? 'custom' : 'none');
      runtime.source = meta.source || reason || 'runtime.applyClipping';
      requestRender(meta.source || 'runtime.applyClipping');
      window.dispatchEvent(new CustomEvent('viewer:clipping-changed', {
        detail: { ...meta, mode: runtime.clippingMode, planes: runtime.clippingPlanes, rendererReady: true }
      }));
      return true;
    },
    clearClipping(meta = {}) {
      if (renderer) {
        renderer.clippingPlanes = [];
        renderer.localClippingEnabled = false;
      }
      runtime.clippingPlanes = [];
      runtime.clippingMode = 'none';
      runtime.source = meta.source || reason || 'runtime.clearClipping';
      requestRender(meta.source || 'runtime.clearClipping');
      window.dispatchEvent(new CustomEvent('viewer:clipping-changed', {
        detail: { ...meta, mode: 'none', planes: [], rendererReady: Boolean(renderer) }
      }));
      return true;
    },
    renderOnce(renderReason = 'runtime') {
      requestRender(renderReason);
    },
    getModelRoot() {
      return window.__viewerApi?.getModelRoot() || modelRoot || state.scene || scene || null;
    },
    setModelRoot(root, options = {}) {
      return window.__viewerApi?.setModelRoot(root, options);
    },
    clearModelRoot() {
      return window.__viewerApi?.clearModelRoot();
    }
  });

  window.__3D_MARKUP_VIEWER_RUNTIME__ = runtime;
  window.__3D_MARKUP_CLIP_RUNTIME__ = runtime;

  const detail = {
    reason,
    renderer,
    scene,
    camera,
    controls,
    modelRoot: runtime.modelRoot,
    selectedObject: runtime.selectedObject,
    selectedData: runtime.selectedData,
    selectedId: runtime.selectedId,
    clippingPlanes: runtime.clippingPlanes,
    clippingMode: runtime.clippingMode,
    rendererReady: Boolean(renderer)
  };

  window.dispatchEvent(new CustomEvent('viewer:runtime-context', { detail }));
  window.dispatchEvent(new CustomEvent('markup:render-context', { detail }));
  return runtime;
}

function requestRender(reason = 'app') {
  if (!renderer || !scene || !camera) return false;
  controls?.update?.();
  renderer.render(scene, camera);
  return true;
}

function dispatchSelectionChanged(reason = 'selection') {
  const runtime = publishViewerRuntime(reason);
  window.dispatchEvent(new CustomEvent('viewer:selection-changed', {
    detail: {
      reason,
      selectedObject: runtime.selectedObject,
      selectedData: runtime.selectedData,
      selectedId: runtime.selectedId,
      rendererReady: Boolean(runtime.renderer)
    }
  }));
}

function initUi() {
  createIcons({ icons });
  el('inputDrawer').scrollTop = 0;
  el('isonoteText').value = DEFAULT_ISONOTE;
  el('lineNoText').value = DEFAULT_LINE_NO;

  const xmlFile = el('xmlFile');
  if (xmlFile) xmlFile.addEventListener('change', onFile);
  
  const clearBtn = document.getElementById('clearBtn');
  if (el('clearBtn')) el('clearBtn').addEventListener('click', clearAll);
  
  const convertBtn = el('convertBtn');
  if (convertBtn) convertBtn.addEventListener('click', runConversion);
  
  const downloadGlbBtn = el('downloadGlbBtn');
  if (downloadGlbBtn) downloadGlbBtn.addEventListener('click', () => downloadBlob(state.glb, 'inputxml_converted.glb', 'model/gltf-binary'));
  
  const downloadRvmBtn = el('downloadRvmBtn');
  if (downloadRvmBtn) downloadRvmBtn.addEventListener('click', () => downloadBlob(state.rvm, 'inputxml_converted.rvm', 'application/octet-stream'));
  
  const downloadAttBtn = el('downloadAttBtn');
  if (downloadAttBtn) downloadAttBtn.addEventListener('click', () => downloadBlob(state.att, 'inputxml_converted.att', 'text/plain'));
  
  const downloadAuditBtn = el('downloadAuditBtn');
  if (downloadAuditBtn) downloadAuditBtn.addEventListener('click', () => downloadBlob(JSON.stringify(state.audit, null, 2), 'inputxml_conversion_audit.json', 'application/json'));

  el('previewGlbBtn').addEventListener('click', () => setModelScene(state.glbScene, 'glb'));
  el('previewRvmBtn').addEventListener('click', () => setModelScene(state.rvmScene, 'rvm'));
  el('colorBySelect').addEventListener('change', (event) => setColorBy(event.target.value));

  el('viewRulesBtn').addEventListener('click', () => el('rulesDialog').showModal());
  el('closeRulesBtn').addEventListener('click', () => el('rulesDialog').close());
  el('resetCameraBtn').addEventListener('click', fitView);
  el('fitSelectionBtn').addEventListener('click', fitSelection);
  el('viewIsoBtn').addEventListener('click', () => setCameraView(DEFAULT_VIEW));
  el('viewTopBtn').addEventListener('click', () => setCameraView(new THREE.Vector3(0, 1, 0.001)));
  el('viewFrontBtn').addEventListener('click', () => setCameraView(new THREE.Vector3(0, 0.08, 1)));
  el('viewSideBtn').addEventListener('click', () => setCameraView(new THREE.Vector3(1, 0.08, 0)));

  el('toggleInputBtn').addEventListener('click', () => toggleInputDrawer());
  el('closeInputBtn').addEventListener('click', () => setInputDrawer(false));
  el('togglePropsBtn').addEventListener('click', () => togglePropsDrawer());
  el('closePropsBtn').addEventListener('click', () => setPropsDrawer(false));
  el('measureBtn').addEventListener('click', () => setActiveTool(state.activeTool === 'measure' ? 'select' : 'measure'));
  el('clipBtn').addEventListener('click', toggleClip);
  el('selectToolBtn').addEventListener('click', () => setActiveTool('select'));
  el('orbitToolBtn').addEventListener('click', () => setActiveTool('orbit'));
  el('panToolBtn').addEventListener('click', () => setActiveTool('pan'));
  el('clearSelectionBtn').addEventListener('click', clearSelectionAndTool);

  document.querySelectorAll('.view-pad button').forEach((button) => {
    button.addEventListener('click', () => handleViewPad(button.dataset.view));
  });

  renderer.domElement.addEventListener('pointerdown', onCanvasPointerDown);
  renderer.domElement.addEventListener('pointerup', onCanvasPointerUp);
  renderer.domElement.addEventListener('pointermove', onCanvasPointerMove);
  renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize);
  window.addEventListener('viewer:request-render', (event) => requestRender(event.detail?.reason || event.detail?.source || 'viewer:request-render'));
  updateUiState();
  updateStatusBar();
}

async function onFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  state.xmlText = await file.text();
  log(`Loaded ${file.name} (${state.xmlText.length.toLocaleString()} chars)`);
  status('Input loaded');
}

async function loadSample() {
  try {
    const [xml, iso, line] = await Promise.all([
      fetch('./samples/BM_CII_Enriched_v8_lite.XML').then((response) => response.text()),
      fetch('./samples/BM_CII_ISONOTE_sideload.csv').then((response) => response.text()).catch(() => DEFAULT_ISONOTE),
      fetch('./samples/BM_CII_LINE_NO_sideload.csv').then((response) => response.text()).catch(() => DEFAULT_LINE_NO)
    ]);
    state.xmlText = xml;
    el('isonoteText').value = iso;
    el('lineNoText').value = line;
    log(`Loaded BM_CII sample (${xml.length.toLocaleString()} chars)`);
    status('BM_CII sample loaded');
  } catch (err) {
    log(`ERROR loading sample: ${err.message}`);
    status('Sample load failed');
  }
}

async function runConversion() {
  await runAppConversionController({
    sourceText: state.xmlText,
    options: collectOptions(),
    state,
    ui: {
      status,
      log,
      onError: (err) => console.error(err),
      setConvertDisabled: (disabled) => { el('convertBtn').disabled = disabled; },
      setInputDrawer,
      setPropsDrawer,
      setDownloadButtons
    },
    actions: {
      clearMeasurement,
      clearSelection,
      publishViewerRuntime,
      setModelScene
    }
  });
}

function collectOptions() {
  return {
    supportMode: el('supportMode').value,
    singleAxisDecision: el('singleAxisDecision').value,
    nodeLabels: el('nodeLabels').checked,
    isonoteBoards: el('isonoteBoards').checked,
    supportLabels: el('supportLabels').checked,
    componentText: el('componentText').checked,
    compareColors: el('compareColors').checked,
    compactMode: el('compactMode').checked,
    isonoteText: el('isonoteText').value,
    lineNoText: el('lineNoText').value
  };
}

function setModelScene(newScene, mode) {
  if (!newScene) return;
  if (modelRoot) scene.remove(modelRoot);
  clearSelection();
  clearMeasurement();
  modelRoot = newScene;
  state.scene = newScene;
  state.previewMode = mode || state.previewMode;
  scene.add(modelRoot);
  updateUiState();
  fitView();
  applyColorBy();
  el('hint').style.display = 'none';
  updateStatusBar();
  const runtime = publishViewerRuntime(`model:${state.previewMode}`);
  window.dispatchEvent(new CustomEvent('viewer:model-loaded', {
    detail: {
      mode: state.previewMode,
      modelRoot,
      rendererReady: Boolean(runtime.renderer)
    }
  }));
}

function fitView() {
  if (!modelRoot) {
    log('[3DMarkupTool:Debug] fitView called with NO modelRoot');
    return;
  }
  const box = modelBox();
  log(`[3DMarkupTool:Debug] fitView modelBox: min(${box.min.x.toFixed(2)}, ${box.min.y.toFixed(2)}, ${box.min.z.toFixed(2)}) max(${box.max.x.toFixed(2)}, ${box.max.y.toFixed(2)}, ${box.max.z.toFixed(2)})`);
  setCameraView(DEFAULT_VIEW);
  log(`[3DMarkupTool:Debug] Camera after fitView: pos(${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)}) target(${controls.target.x.toFixed(2)}, ${controls.target.y.toFixed(2)}, ${controls.target.z.toFixed(2)}) near=${camera.near.toFixed(2)} far=${camera.far.toFixed(2)}`);
}

function fitSelection() {
  if (!state.selected) {
    fitView();
    return;
  }
  const box = new THREE.Box3().setFromObject(state.selected);
  if (!Number.isFinite(box.min.x)) {
    fitView();
    return;
  }
  fitBox(box, DEFAULT_VIEW);
}

function setCameraView(direction) {
  if (!modelRoot) return;
  fitBox(modelBox(), direction);
}

function fitBox(box, direction) {
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 1);
  const dir = direction.clone().normalize();
  camera.position.copy(center).add(dir.multiplyScalar(radius * 1.18));
  camera.near = Math.max(0.01, radius / 1200);
  camera.far = Math.max(1000, radius * 20);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
  updateClipPlane();
  publishViewerRuntime('camera:fit-box');
}

function modelBox() {
  const box = new THREE.Box3().setFromObject(modelRoot);
  if (!Number.isFinite(box.min.x)) return new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
  return box;
}

function handleViewPad(view) {
  if (view === 'iso') setCameraView(DEFAULT_VIEW);
  if (view === 'top') setCameraView(new THREE.Vector3(0, 1, 0.001));
  if (view === 'front') setCameraView(new THREE.Vector3(0, 0.08, 1));
  if (view === 'side') setCameraView(new THREE.Vector3(1, 0.08, 0));
  if (view === 'fit') fitView();
  if (view === 'fitSelection') fitSelection();
  if (view === 'zoom') zoomCamera(0.72);
  if (view === 'msr') setActiveTool(state.activeTool === 'measure' ? 'select' : 'measure');
  if (view === 'clip') toggleClip();
}

function zoomCamera(factor) {
  const target = controls.target.clone();
  camera.position.copy(target.clone().add(camera.position.clone().sub(target).multiplyScalar(factor)));
  controls.update();
  publishViewerRuntime('camera:zoom');
}

function setActiveTool(tool) {
  state.activeTool = tool;
  if (tool === 'measure') clearMeasurement();
  applyControlMode(tool);
  updateUiState();
  status(tool === 'measure' ? 'Measure' : `${tool[0].toUpperCase()}${tool.slice(1)} mode`);
  publishViewerRuntime(`tool:${tool}`);
}

function applyControlMode(tool) {
  controls.enableRotate = true;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.mouseButtons = {
    LEFT: tool === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: tool === 'pan' ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN
  };
}

function onCanvasPointerDown(event) {
  state.pointerDown = { x: event.clientX, y: event.clientY, button: event.button };
}

function onCanvasPointerUp(event) {
  if (!modelRoot || !state.pointerDown) return;
  const dx = Math.abs(event.clientX - state.pointerDown.x);
  const dy = Math.abs(event.clientY - state.pointerDown.y);
  const wasClick = dx <= DRAG_TOLERANCE_PX && dy <= DRAG_TOLERANCE_PX;
  const wasLeftClick = state.pointerDown.button === 0;
  state.pointerDown = null;
  if (!wasClick || !wasLeftClick) return;

  const hit = raycastModel(event);
  if (state.activeTool === 'measure') {
    if (hit) addMeasurePoint(hit.point);
    return;
  }
  if (state.activeTool !== 'select') return;
  if (!hit) {
    clearSelection();
    return;
  }
  selectHit(hit);
}

function onCanvasPointerMove(event) {
  if (!modelRoot) {
    el('coordStatus').textContent = 'XYZ: -';
    return;
  }
  const hit = raycastModel(event);
  if (!hit) {
    el('coordStatus').textContent = 'XYZ: -';
    return;
  }
  el('coordStatus').textContent = `XYZ: ${formatPoint(hit.point)}`;
}

function onKeyDown(event) {
  if (hasInputFocus()) return;
  const key = event.key.toLowerCase();
  if (key === 's') setActiveTool('select');
  if (key === 'o') setActiveTool('orbit');
  if (key === 'p') setActiveTool('pan');
  if (key === 'm') setActiveTool(state.activeTool === 'measure' ? 'select' : 'measure');
  if (key === 'h') fitView();
  if (key === 'f') fitSelection();
  if (key === 'c') toggleClip();
  if (event.key === 'Escape') clearSelectionAndTool();
}

function raycastModel(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(modelRoot, true);
  return hits.find((hit) => Object.keys(findUserData(hit.object)).length) || hits[0] || null;
}

function selectHit(hit) {
  const selectable = findSelectableObject(hit.object) || hit.object;
  const data = findUserData(selectable);
  if (!Object.keys(data).length) return;
  state.selected = selectable;
  state.selectedData = data;
  setPropsDrawer(true);
  showProperties(data);
  updateSelectionHelper(selectable);
  updateStatusBar();
  dispatchSelectionChanged('selection:select');
}

function findSelectableObject(obj) {
  let cur = obj;
  while (cur) {
    const data = cur.userData || {};
    if (Object.keys(data).length) {
      if (data.TYPE === 'SUPPORT_MARKER_PART') {
        // Skip parts, we want to select the parent SUPPORT_MARKER
      } else if (data.TYPE && data.TYPE !== 'RVM_PRIMITIVE') {
        return cur;
      } else if (data.type && data.type !== 'RVM_PRIMITIVE') {
        return cur;
      }
    }
    cur = cur.parent;
  }
  return obj;
}

function findUserData(obj) {
  let cur = obj;
  let fallback = {};
  while (cur) {
    if (cur.userData && Object.keys(cur.userData).length) {
      if (cur.userData.TYPE && cur.userData.TYPE !== 'RVM_PRIMITIVE') return cur.userData;
      if (cur.userData.type && cur.userData.type !== 'RVM_PRIMITIVE') return normalizeLegacyUserData(cur.userData);
      if (!Object.keys(fallback).length) fallback = cur.userData;
    }
    cur = cur.parent;
  }
  return fallback;
}

function normalizeLegacyUserData(data) {
  if (data.type === 'NODE') return { TYPE: 'NODE', NODE: data.node, LABEL: `N${data.node}`, SOURCE: 'InputXML' };
  return data;
}

function updateSelectionHelper(object) {
  removeSelectionHelper();
  const box = new THREE.Box3().setFromObject(object);
  if (!Number.isFinite(box.min.x)) return;
  state.selectionHelper = new THREE.Box3Helper(box, 0xffd166);
  state.selectionHelper.name = 'SELECTION_BOX_HELPER';
  state.selectionHelper.renderOrder = 60;
  state.selectionHelper.material.depthTest = false;
  scene.add(state.selectionHelper);
}

function removeSelectionHelper() {
  if (!state.selectionHelper) return;
  scene.remove(state.selectionHelper);
  state.selectionHelper.geometry?.dispose?.();
  state.selectionHelper.material?.dispose?.();
  state.selectionHelper = null;
}

function clearSelection() {
  state.selected = null;
  state.selectedData = null;
  removeSelectionHelper();
  el('propertiesBody').classList.add('empty-state');
  el('propertiesBody').textContent = 'Select an object in the viewer.';
  updateStatusBar();
  dispatchSelectionChanged('selection:clear');
}

function clearSelectionAndTool() {
  clearSelection();
  clearMeasurement();
  setActiveTool('select');
}

function showProperties(data) {
  const body = el('propertiesBody');
  body.classList.remove('empty-state');
  const normalized = normalizeDisplayData(data);
  body.innerHTML = [
    selectedCard(normalized),
    ...propertySections(normalized)
  ].join('');
}

function normalizeDisplayData(data) {
  const type = data.TYPE || data.type || 'Object';
  return {
    raw: data,
    type,
    title: displayTitle(data, type),
    subtitle: displaySubtitle(data, type),
    badges: badgesFor(data, type)
  };
}

function displayTitle(data, type) {
  if (type === 'COMPONENT') return data.ID || data.id || data.REF_NO || 'Component';
  if (type === 'SUPPORT_MARKER') return `${data.family || data.FAMILY || 'Support'} marker at node ${data.node || data.NODE || 'N/A'}`;
  if (type === 'SUPPORT_RESTRAINT') return `${data.family || data.FAMILY || 'Support'} at node ${data.node || data.NODE || 'N/A'}`;
  if (type === 'ISONOTE_NAME_PLATE') return 'ISONOTE Annotation';
  if (type === 'NODE') return `Node ${data.NODE || data.node || 'N/A'}`;
  if (type === 'ISONOTE_LEADER') return 'ISONOTE Leader';
  return type;
}

function displaySubtitle(data, type) {
  if (type === 'COMPONENT') return `${data.engineeringType || data.ENGINEERING_TYPE || 'N/A'} / ${data.meshRole || data.MESH_ROLE || 'geometry'}`;
  if (type === 'SUPPORT_MARKER') return `${data.isonoteRawText || data.ISONOTE_RAW_TEXT || 'stagedJson support marker'}`;
  if (type === 'SUPPORT_RESTRAINT') return `${data.sourceClass || data.SOURCE_CLASS || 'N/A'} / ${data.sourceMode || data.SOURCE_MODE || 'N/A'}`;
  if (type === 'ISONOTE_NAME_PLATE') return data.sourceNoteName || data.SOURCE_NOTE_NAME || data.BOARD_TEXT || '';
  if (type === 'NODE') return data.LABEL || data.label || '';
  return '';
}

function badgesFor(data, type) {
  const badges = [];
  if (type === 'SUPPORT_RESTRAINT') {
    badges.push(data.sourceClass || data.SOURCE_CLASS || 'Support');
    badges.push(data.source || data.SOURCE || 'Input');
  }
  if (type === 'SUPPORT_MARKER') {
    badges.push('stagedJson');
    badges.push(data.family || data.FAMILY || 'Support');
  }
  if (type === 'COMPONENT') {
    badges.push(data.source || data.SOURCE || 'InputXML');
    if ((data.lineNoSource || data.LINE_NO_SOURCE || '').toLowerCase().includes('sideload')) badges.push('Sideloaded');
  }
  if (type === 'ISONOTE_NAME_PLATE') badges.push('Sideloaded');
  if (String(data.lineNoSource || data.LINE_NO_SOURCE || '').toLowerCase().includes('fallback')) badges.push('Fallback');
  if (Object.values(data).some((value) => value === 'N/A' || value === 'Unavailable')) badges.push('Unavailable');
  return badges.filter(Boolean);
}

function selectedCard(info) {
  return `<div class="selected-card">
    <div class="selected-card-title">
      <span>${escapeHtml(info.title)}</span>
      <span class="badge">${escapeHtml(info.type)}</span>
    </div>
    <div class="selected-card-subtitle">${escapeHtml(info.subtitle || 'Selected object')}</div>
    <div class="badge-row">${info.badges.map((badgeText) => `<span class="badge">${escapeHtml(badgeText)}</span>`).join('')}</div>
  </div>`;
}

function propertySections(info) {
  const data = info.raw;
  if (info.type === 'COMPONENT') {
    return [
      section('Identity', true, rows([
        ['ID', data.ID || data.id],
        ['Ref No.', data.refNo || data.REF_NO],
        ['Source', data.source || data.SOURCE],
        ['Mesh Role', data.meshRole || data.MESH_ROLE]
      ])),
      section('Line / Node', true, rows([
        ['Line No.', data.lineNo || data.LINE_NO, chip(data.lineNoSource || data.LINE_NO_SOURCE)],
        ['From Node', data.fromNode || data.FROM_NODE],
        ['To Node', data.toNode || data.TO_NODE]
      ])),
      section('Component', true, rows([
        ['Type', data.engineeringType || data.ENGINEERING_TYPE],
        ['Bore', data.bore || data.BORE],
        ['Wall Thickness', data.wallThickness || data.WALL_THICKNESS, chip(data.wallThicknessSource || data.WALL_THICKNESS_SOURCE)],
        ['Material Thickness', data.materialThickness || data.MATERIAL_THICKNESS, chip(data.materialThicknessSource || data.MATERIAL_THICKNESS_SOURCE)],
        ['Bend Radius', data.bendRadius || data.BEND_RADIUS],
        ['Bend Angle', data.bendAngle || data.BEND_ANGLE]
      ])),
      section('Process / Analysis', false, rows([
        ['Material', data.material || data.MATERIAL, chip(data.materialSource || data.MATERIAL_SOURCE)],
        ['Pressure', data.pressure || data.PRESSURE, chip(data.pressureSource || data.PRESSURE_SOURCE)],
        ['Hydro Pressure', data.hydroPressure || data.HYDRO_PRESSURE, chip(data.hydroPressureSource || data.HYDRO_PRESSURE_SOURCE)],
        ['Temp1', data.temp1 || data.TEMP1, chip(data.temp1Source || data.TEMP1_SOURCE)],
        ['Temp2', data.temp2 || data.TEMP2, chip(data.temp2Source || data.TEMP2_SOURCE)],
        ['Temp3', data.temp3 || data.TEMP3, chip(data.temp3Source || data.TEMP3_SOURCE)]
      ])),
      section('Raw Metadata', false, rows(Object.entries(data)))
    ];
  }

  if (info.type === 'SUPPORT_RESTRAINT') {
    return [
      section('Identity', true, rows([
        ['Node', data.node || data.NODE],
        ['Family', data.family || data.FAMILY],
        ['Source', data.source || data.SOURCE],
        ['Source Class', data.sourceClass || data.SOURCE_CLASS]
      ])),
      section('Support / Restraint', true, rows([
        ['Axis', data.axis || data.AXIS],
        ['Sign', data.sign || data.SIGN],
        ['Load', data.loadText || data.LOAD_TEXT || 'N/A'],
        ['Gap mm', data.gapMm ?? data.GAP_MM ?? 'N/A'],
        ['Visual Resolver', data.visualResolver || (data.visualResolverApplied ? 'applied' : 'not applied')]
      ])),
      section('ISONOTE Annotation', false, rows([
        ['Source Note', data.sourceNoteName || data.SOURCE_NOTE_NAME || 'N/A'],
        ['Warning', data.warningText || data.WARNING_TEXT || 'N/A'],
        ['Popup Required', String(Boolean(data.popupRequired || data.POPUP_REQUIRED === 'true'))]
      ])),
      section('Raw Metadata', false, rows(Object.entries(data)))
    ];
  }

  if (info.type === 'SUPPORT_MARKER') {
    const axisTransform = data.axisTransform || parseJsonOrNull(data.AXIS_TRANSFORM_JSON) || {};
    const sourceAttributes = data.sourceAttributes || parseJsonOrNull(data.SOURCE_ATTRIBUTES_JSON) || {};
    const diagnostics = data.diagnostics || parseJsonOrNull(data.DIAGNOSTICS_JSON) || [];
    return [
      section('Summary', true, rows([
        ['Marker ID', data.supportMarkerId || data.SUPPORT_MARKER_ID || data.ID],
        ['Node', data.node || data.NODE],
        ['Family', data.family || data.FAMILY],
        ['Axis', data.axis || data.AXIS],
        ['Matched Pipe', data.matchedPipeRef || data.MATCHED_PIPE_REF || 'N/A']
      ])),
      section('Matched ISONOTE', true, rows([
        ['ISONOTE Text', data.isonoteText || data.ISONOTE_TEXT || 'N/A'],
        ['Raw Text', data.isonoteRawText || data.ISONOTE_RAW_TEXT || 'N/A'],
        ['Note Name', data.isonoteNoteName || data.ISONOTE_NOTE_NAME || 'N/A'],
        ['Match Method', data.matchMethod || data.ISONOTE_MATCH_METHOD || 'none'],
        ['Confidence', data.confidence ?? data.ISONOTE_MATCH_CONFIDENCE ?? '0']
      ])),
      section('stagedJson Source', true, rows([
        ['Source Path', data.sourcePath || data.SOURCE_PATH || 'N/A'],
        ['Source Kind', data.sourceKind || data.SOURCE_KIND || data.source || data.SOURCE || 'stagedJson'],
        ['Attributes', jsonPreview(sourceAttributes)]
      ])),
      section('Axis Transform', true, rows([
        ['Schema', axisTransform.schema || 'SupportAxisTransform.v1'],
        ['Source Axis', data.axisRaw || data.AXIS_RAW || axisTransform.sourceAxis || 'N/A'],
        ['Canvas Axis', data.axisCanvas || data.AXIS_CANVAS || axisTransform.canvasAxis || 'N/A'],
        ['Vector', vectorPreview(axisTransform.axisVector)],
        ['Applied', String(Boolean(data.axisTransformApplied || data.AXIS_TRANSFORM_APPLIED === 'TRUE' || axisTransform.axisTransformApplied))]
      ])),
      section('Diagnostics', false, rows([
        ['Warnings', diagnosticsText(diagnostics)],
        ['Warning Code', data.warningCode || data.WARNING_CODE || 'N/A'],
        ['Warning Message', data.warningMessage || data.WARNING_MESSAGE || 'N/A']
      ])),
      section('Raw Metadata', false, rows(Object.entries(data)))
    ];
  }

  if (info.type === 'NODE') {
    return [
      section('Identity', true, rows([
        ['Node', data.NODE || data.node],
        ['Label', data.LABEL || data.label],
        ['Source', data.SOURCE || data.source]
      ])),
      section('Line / Node', true, rows([
        ['X', data.X],
        ['Y', data.Y],
        ['Z', data.Z]
      ])),
      section('Raw Metadata', false, rows(Object.entries(data)))
    ];
  }

  if (info.type === 'ISONOTE_NAME_PLATE' || info.type === 'ISONOTE_LEADER') {
    return [
      section('ISONOTE Annotation', true, rows([
        ['Node', data.NODE || data.node],
        ['Source', data.SOURCE || data.source],
        ['Note', data.BOARD_TEXT || data.sourceNoteName || data.SOURCE_NOTE_NAME]
      ])),
      section('Raw Metadata', false, rows(Object.entries(data)))
    ];
  }

  return [section(info.type, true, rows(Object.entries(data)))];
}

function section(title, open, html) {
  return `<details class="prop-section" ${open ? 'open' : ''}><summary>${escapeHtml(title)}</summary><div class="prop-grid">${html}</div></details>`;
}

function rows(items) {
  return items.map((row) => {
    const [key, value, extra = ''] = Array.isArray(row) ? row : row;
    return `<div class="prop-key">${escapeHtml(key)}</div><div class="prop-value">${escapeHtml(value ?? 'N/A')}${extra || ''}</div>`;
  }).join('');
}

function chip(text) {
  if (!text) return '';
  return `<span class="chip">${escapeHtml(labelForSource(text))}</span>`;
}

function parseJsonOrNull(value) {
  if (!value || value === 'N/A') return null;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

function jsonPreview(value) {
  if (!value || typeof value !== 'object') return 'N/A';
  return JSON.stringify(value);
}

function vectorPreview(value) {
  if (!value || typeof value !== 'object') return 'N/A';
  return [value.x, value.y, value.z].map((entry) => entry ?? 0).join(', ');
}

function diagnosticsText(value) {
  if (!Array.isArray(value) || !value.length) return 'None';
  return value.map((entry) => `${entry.code || 'diagnostic'}: ${entry.message || entry.severity || ''}`).join(' | ');
}

function labelForSource(text) {
  const value = String(text);
  if (/sideload/i.test(value)) return 'Sideloaded';
  if (/inherited/i.test(value)) return 'Inherited';
  if (/unavailable|N\/A/i.test(value)) return 'Unavailable';
  return value;
}

function setColorBy(value) {
  state.colorBy = value;
  applyColorBy();
}

function applyColorBy() {
  if (!modelRoot) return;
  if (state.colorBy === 'default') {
    restoreMaterials(modelRoot);
    return;
  }

  modelRoot.traverse((object) => {
    if (!object.isMesh || !object.material || object.material.map) return;
    const data = findUserData(object);
    const color = colorForData(data, state.colorBy);
    if (!color) return;
    makeMaterialUnique(object);
    object.material.color.setHex(color);
  });
}

function restoreMaterials(root) {
  root.traverse((object) => {
    const original = state.originalMaterials.get(object);
    if (original) object.material = original;
  });
  state.originalMaterials = new WeakMap();
}

function makeMaterialUnique(object) {
  if (state.originalMaterials.has(object)) return;
  state.originalMaterials.set(object, object.material);
  object.material = object.material.clone();
}

function colorForData(data, mode) {
  const type = data.TYPE || data.type;
  if (mode === 'lineNo') return colorFromString(data.lineNo || data.LINE_NO || data.node || data.NODE || 'unavailable');
  if (mode === 'componentType') {
    const componentType = String(data.engineeringType || data.ENGINEERING_TYPE || data.meshRole || data.MESH_ROLE || type || '').toUpperCase();
    if (componentType.includes('VALVE')) return MATERIAL_COLORS.valve;
    if (componentType.includes('BEND')) return MATERIAL_COLORS.bend;
    if (componentType.includes('RIGID') || componentType.includes('FLANGE')) return MATERIAL_COLORS.rigid;
    if (type === 'SUPPORT_RESTRAINT' || type === 'SUPPORT_MARKER') return MATERIAL_COLORS.supportExpected;
    return MATERIAL_COLORS.pipe;
  }
  if (mode === 'supportSource') {
    const sourceClass = String(data.sourceClass || data.SOURCE_CLASS || data.source || data.SOURCE || '').toUpperCase();
    if (sourceClass.includes('ACTUAL') || sourceClass.includes('INPUTXML')) return MATERIAL_COLORS.supportActual;
    if (sourceClass.includes('EXPECTED') || sourceClass.includes('ISONOTE')) return MATERIAL_COLORS.supportExpected;
    if (type === 'SUPPORT_MARKER') return MATERIAL_COLORS.supportActual;
    return type === 'COMPONENT' ? MATERIAL_COLORS.pipe : MATERIAL_COLORS.unavailable;
  }
  if (mode === 'sourceMode') return colorFromString(data.sourceMode || data.SOURCE_MODE || data.source || data.SOURCE || type || 'source');
  return null;
}

function colorFromString(value) {
  const palette = [0x50c4ff, 0x30e0b4, 0xffc857, 0xff7c7c, 0xb48cff, 0x9ad86d, 0xf49f5a, 0x70d6ff];
  const text = String(value || 'unavailable');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

function addMeasurePoint(point) {
  state.measurePoints.push(point.clone());
  if (state.measurePoints.length === 1) {
    drawMeasureMarker(point);
    el('measureReadout').hidden = false;
    el('measureReadout').textContent = 'Measure: select second point';
    return;
  }
  if (state.measurePoints.length >= 2) {
    const [a, b] = state.measurePoints;
    drawMeasurement(a, b);
    state.measurePoints = [];
  }
}

function drawMeasureMarker(point) {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(measureMarkerRadius(), 16, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd166, depthTest: false })
  );
  marker.position.copy(point);
  marker.renderOrder = 50;
  state.measureGroup.add(marker);
}

function drawMeasurement(a, b) {
  state.measureGroup.clear();
  drawMeasureMarker(a);
  drawMeasureMarker(b);

  const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffd166, depthTest: false }));
  line.renderOrder = 50;
  state.measureGroup.add(line);

  const distanceScene = a.distanceTo(b);
  const distanceMm = sceneDistanceToMm(distanceScene);
  const text = `Distance: ${formatNumber(distanceMm)} mm (${formatNumber(distanceMm / 1000)} m)`;
  const label = createTextPlane(text, {
    width: 420,
    height: 86,
    fontSize: 28,
    scale: Math.max(measureMarkerRadius() * 7, state.previewMode === 'glb' ? 0.75 : 70),
    bg: 'rgba(13,19,28,0.92)',
    border: '#ffd166',
    name: 'MEASURE_LABEL'
  });
  label.position.copy(a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, measureMarkerRadius() * 6, 0)));
  label.lookAt(camera.position);
  label.material.depthTest = false;
  label.renderOrder = 51;
  state.measureGroup.add(label);
  el('measureReadout').hidden = false;
  el('measureReadout').textContent = text;
}

function measureMarkerRadius() {
  if (!modelRoot) return 0.08;
  const box = modelBox();
  const size = box.getSize(new THREE.Vector3());
  return Math.max(Math.max(size.x, size.y, size.z) * 0.006, state.previewMode === 'glb' ? 0.06 : 8);
}

function clearMeasurement() {
  state.measureGroup.clear();
  state.measurePoints = [];
  el('measureReadout').hidden = true;
}

function sceneDistanceToMm(value) {
  return state.previewMode === 'glb' ? value / 0.01 : value;
}

function formatPoint(point) {
  const x = sceneDistanceToMm(point.x);
  const y = sceneDistanceToMm(point.y);
  const z = sceneDistanceToMm(point.z);
  return `${formatNumber(x)}, ${formatNumber(y)}, ${formatNumber(z)} mm`;
}

function toggleClip() {
  state.clipEnabled = !state.clipEnabled;
  updateClipPlane();
  const runtime = publishViewerRuntime('clip-toolbar:before-toggle');
  if (state.clipEnabled) runtime.applyClipping([CLIP_PLANE], { mode: 'plane', source: 'app-toolbar' });
  else runtime.clearClipping({ source: 'app-toolbar' });
  updateUiState();
  publishViewerRuntime('clip-toolbar:after-toggle');
}

function updateClipPlane() {
  if (!modelRoot) return;
  const center = modelBox().getCenter(new THREE.Vector3());
  CLIP_PLANE.constant = center.x;
}

function toggleInputDrawer() {
  setInputDrawer(!document.body.classList.contains('input-open'));
}

function setInputDrawer(open) {
  document.body.classList.toggle('input-open', Boolean(open));
  if (open) el('inputDrawer').scrollTop = 0;
  updateUiState();
}

function togglePropsDrawer() {
  setPropsDrawer(!document.body.classList.contains('props-open'));
}

function setPropsDrawer(open) {
  document.body.classList.toggle('props-open', Boolean(open));
  updateUiState();
}

function updateUiState() {
  el('previewGlbBtn').classList.toggle('active', state.previewMode === 'glb');
  el('previewRvmBtn').classList.toggle('active', state.previewMode === 'rvm');
  el('selectToolBtn').classList.toggle('tool-active', state.activeTool === 'select');
  el('orbitToolBtn').classList.toggle('tool-active', state.activeTool === 'orbit');
  el('panToolBtn').classList.toggle('tool-active', state.activeTool === 'pan');
  el('measureBtn').classList.toggle('tool-active', state.activeTool === 'measure');
  el('clipBtn').classList.toggle('tool-active', state.clipEnabled);
  el('clipBtn').querySelector('span').textContent = state.clipEnabled ? 'Clip On' : 'Clip Off';
  el('toggleInputBtn').classList.toggle('active', document.body.classList.contains('input-open'));
  el('togglePropsBtn').classList.toggle('active', document.body.classList.contains('props-open'));
  updateStatusBar();
}

function updateStatusBar() {
  el('selectedStatus').textContent = state.selectedData ? `Selected: ${displayTitle(state.selectedData, state.selectedData.TYPE || state.selectedData.type || 'Object')}` : 'Selected: none';
  el('componentStatus').textContent = `Objects: ${countSelectableObjects()}`;
}

function countSelectableObjects() {
  if (!modelRoot) return 0;
  let count = 0;
  modelRoot.traverse((object) => {
    const data = object.userData || {};
    if ((data.TYPE && data.TYPE !== 'RVM_PRIMITIVE') || (data.type && data.type !== 'RVM_PRIMITIVE')) count += 1;
  });
  return count;
}

function setDownloadButtons(enabled) {
  el('downloadGlbBtn').disabled = !enabled;
  el('downloadRvmBtn').disabled = !enabled;
  el('downloadAttBtn').disabled = !enabled;
  el('downloadAuditBtn').disabled = !enabled;
  el('previewGlbBtn').disabled = !enabled;
  el('previewRvmBtn').disabled = !enabled;
}

function clearAll() {
  state.xmlText = '';
  state.glb = null;
  state.rvm = null;
  state.att = null;
  state.audit = null;
  state.glbScene = null;
  state.rvmScene = null;
  state.previewMode = 'glb';
  state.activeTool = 'select';
  state.clipEnabled = false;
  state.colorBy = 'default';
  el('colorBySelect').value = 'default';
  clearMeasurement();
  clearSelection();
  renderer.clippingPlanes = [];
  renderer.localClippingEnabled = false;

  if (modelRoot) scene.remove(modelRoot);
  modelRoot = null;
  setDownloadButtons(false);
  updateUiState();
  el('hint').style.display = 'block';
  publishViewerRuntime('app:clear');
  window.dispatchEvent(new CustomEvent('viewer:model-loaded', { detail: { mode: 'clear', modelRoot: null, rendererReady: Boolean(renderer) } }));
  log('Cleared');
  status('Ready');
}

function downloadBlob(content, name, type) {
  if (!content) return;
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  state.objectUrls.push(url);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function log(message) {
  const ts = new Date().toLocaleTimeString();
  el('log').textContent += `[${ts}] ${message}\n`;
  el('log').scrollTop = el('log').scrollHeight;
}

function status(message) {
  el('runtimeStatus').textContent = message;
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return 'N/A';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return 'N/A';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function onResize() {
  if (!camera || !renderer || !viewer) return;
  const width = viewer.clientWidth || window.innerWidth;
  const height = viewer.clientHeight || window.innerHeight;
  if (width === 0 || height === 0) return;
  
  if (camera.aspect !== width / height) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    publishViewerRuntime('resize');
  }
}

// Ensure the viewer element is observed for resizes (e.g. late CSS loading)
if (window.ResizeObserver && viewer) {
  const resizeObserver = new ResizeObserver(() => onResize());
  resizeObserver.observe(viewer);
}

var animateErrorLogged = false;
var frameCounter = 0;
function animate() {
  requestAnimationFrame(animate);
  try {
    controls.update();
    renderer.render(scene, camera);
    
    frameCounter++;
    if (frameCounter % 300 === 0 && modelRoot) {
      log(`[3DMarkupTool:FrameDebug] scene.children=${scene.children.length}, modelRoot.parent=${modelRoot.parent ? modelRoot.parent.type : 'null'}, camera=${camera.position.x.toFixed(0)},${camera.position.y.toFixed(0)},${camera.position.z.toFixed(0)}`);
    }
  } catch (err) {
    if (!animateErrorLogged) {
      animateErrorLogged = true;
      console.error('[3DMarkupTool:Error] animate crashed:', err);
      log(`[3DMarkupTool:Error] animate crashed: ${err.message}`);
    }
  }
}

function escapeHtml(value) {
  return String(value ?? 'N/A')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.__viewerApi = {
  schema: '3DMarkupViewerApi.v1',
  setModelRoot(root, options = {}) {
    setModelScene(root, options.mode || 'api');
  },
  clearModelRoot() {
    clearAll();
  },
  getModelRoot() {
    return modelRoot || state.scene || scene || null;
  }
};
window.__THREED_MARKUP_VIEWER__ = window.__viewerApi;
