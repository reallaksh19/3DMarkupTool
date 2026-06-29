const SUPPORT_CANVAS_AXIS_ORBIT_SCHEMA = 'SupportCanvasAxisOrbitController.v1';

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', installSupportCanvasAxisOrbitController, { once: true });
} else {
  installSupportCanvasAxisOrbitController();
}

export function installSupportCanvasAxisOrbitController() {
  if (window.__3D_MARKUP_SUPPORT_CANVAS_AXIS_ORBIT__?.schema === SUPPORT_CANVAS_AXIS_ORBIT_SCHEMA) return window.__3D_MARKUP_SUPPORT_CANVAS_AXIS_ORBIT__;
  const api = { schema: SUPPORT_CANVAS_AXIS_ORBIT_SCHEMA, install: renderShell, update: updateEnrichedAxisHud };
  window.__3D_MARKUP_SUPPORT_CANVAS_AXIS_ORBIT__ = api;
  renderShell();
  window.addEventListener('viewer:selection-changed', (event) => updateEnrichedAxisHud(event.detail?.data || event.detail?.selectedData || null));
  window.addEventListener('viewer:managed-stage-json-loaded', () => updateEnrichedAxisHud(null));
  window.addEventListener('viewer:runtime-context', renderShell);
  window.addEventListener('markup:app-ready', renderShell);
  return api;
}

function renderShell() {
  const viewer = document.getElementById('viewer');
  if (!viewer) return;
  viewer.style.position = viewer.style.position || 'relative';
  ensureAxisHud(viewer);
  ensureOrbitButton(viewer);
}

function ensureAxisHud(viewer) {
  if (document.getElementById('enrichedAxisHud')) return;
  const hud = document.createElement('div');
  hud.id = 'enrichedAxisHud';
  hud.className = 'enriched-axis-hud';
  hud.textContent = 'Enriched axis: N/A';
  hud.title = 'Selected support enriched axis resolution';
  viewer.appendChild(hud);
  injectStyles();
}

function ensureOrbitButton(viewer) {
  let cluster = document.getElementById('canvasToolIconRail');
  if (!cluster) {
    cluster = document.createElement('div');
    cluster.id = 'canvasToolIconRail';
    cluster.className = 'canvas-tool-icon-rail';
    viewer.appendChild(cluster);
  }
  if (document.getElementById('canvasOrbitToolBtn')) return;
  const button = document.createElement('button');
  button.id = 'canvasOrbitToolBtn';
  button.type = 'button';
  button.className = 'canvas-tool-icon-btn';
  button.title = 'Orbit mode';
  button.setAttribute('aria-label', 'Orbit mode');
  button.textContent = '⟳';
  button.addEventListener('click', () => {
    const orbit = document.getElementById('orbitToolBtn');
    if (orbit) orbit.click();
    else window.__3D_MARKUP_VIEWER_RUNTIME__?.controls && enableOrbitFallback();
  });
  cluster.appendChild(button);
}

function enableOrbitFallback() {
  const controls = window.__3D_MARKUP_VIEWER_RUNTIME__?.controls;
  if (!controls) return;
  controls.enableRotate = true;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.update?.();
}

function updateEnrichedAxisHud(data = null) {
  const hud = document.getElementById('enrichedAxisHud');
  if (!hud) return;
  const selected = data || window.__3D_MARKUP_VIEWER_RUNTIME__?.selectedData || null;
  const attrs = selected?.sourceAttributes || selected?.rawAttributes || selected || {};
  const axis = selected?.axisTransform?.canvasAxis
    || selected?.axisCanvas
    || selected?.AXIS_CANVAS
    || attrs.SUPPORT_AXIS_CANVAS
    || attrs.SUPPORT_RESTRAINT_TYPE_CANVAS_AXIS
    || attrs.SUPPORT_AXIS
    || '';
  const action = selected?.axisTransform?.supportActionAxes?.join?.('/')
    || selected?.axisTransform?.actionAxis
    || selected?.restraintTypeRule?.actionAxis
    || attrs.SUPPORT_RESTRAINT_TYPE_ACTION_AXIS
    || axis;
  const family = selected?.supportFamily || selected?.family || attrs.SUPPORT_KIND_MAPPED || attrs.SUPPORT_KIND || '';
  const node = selected?.nodeNumber || selected?.node || selected?.NODE || attrs.NODE || '';
  hud.textContent = axis ? `Enriched axis: canvas ${axis} / action ${action || axis}${family ? ` / ${family}` : ''}${node ? ` @ ${node}` : ''}` : 'Enriched axis: N/A';
}

function injectStyles() {
  if (document.getElementById('supportCanvasAxisOrbitStyles')) return;
  const style = document.createElement('style');
  style.id = 'supportCanvasAxisOrbitStyles';
  style.textContent = `
    .enriched-axis-hud{position:absolute;right:12px;bottom:12px;z-index:30;background:rgba(15,23,42,.86);border:1px solid rgba(148,163,184,.38);border-radius:10px;color:#e5e7eb;font:12px/1.3 ui-monospace,SFMono-Regular,Consolas,monospace;padding:8px 10px;max-width:min(460px,42vw);pointer-events:none;box-shadow:0 8px 30px rgba(0,0,0,.25)}
    .canvas-tool-icon-rail{position:absolute;right:12px;top:96px;z-index:31;display:flex;flex-direction:column;gap:8px}.canvas-tool-icon-btn{width:36px;height:36px;border-radius:10px;border:1px solid rgba(148,163,184,.38);background:rgba(15,23,42,.88);color:#e5e7eb;font-size:20px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.22)}.canvas-tool-icon-btn:hover{background:rgba(30,41,59,.96)}
  `;
  document.head.appendChild(style);
}
