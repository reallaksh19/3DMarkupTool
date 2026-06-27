import * as THREE from 'three';

const MAX_GROUPS = 16;
const state = {
  scene: null,
  groups: [],
  signature: '',
  originals: new WeakMap(),
  applied: false,
  shownForSignature: '',
  panel: null,
  button: null
};

function byId(id) {
  return document.getElementById(id);
}

function runtime() {
  return window.__3D_MARKUP_CLIP_RUNTIME__ || {};
}

function installStyles() {
  if (byId('originManagerStyles')) return;
  const style = document.createElement('style');
  style.id = 'originManagerStyles';
  style.textContent = `
    #originManagerBtn { display: none; }
    #originManagerBtn.visible { display: inline-flex; }
    #originManagerBtn.active, #originManagerBtn[aria-expanded="true"] {
      border-color: rgba(255, 209, 102, 0.9) !important;
      background: rgba(255, 178, 54, 0.18) !important;
      color: #fff2c6 !important;
    }
    .origin-manager-panel {
      position: absolute;
      z-index: 8100;
      left: 22px;
      top: 88px;
      width: min(720px, calc(100vw - 56px));
      max-height: min(66vh, 620px);
      display: none;
      flex-direction: column;
      border: 1px solid rgba(114, 178, 245, 0.34);
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(10, 22, 34, 0.97), rgba(7, 14, 23, 0.94));
      box-shadow: 0 24px 70px rgba(0,0,0,0.46), inset 0 1px 0 rgba(255,255,255,0.06);
      color: #eaf4ff;
      backdrop-filter: blur(16px);
      overflow: hidden;
    }
    .origin-manager-panel.visible { display: flex; }
    .origin-manager-head { display:flex; justify-content:space-between; align-items:start; gap:12px; padding:14px 16px; border-bottom:1px solid rgba(148,185,230,0.16); }
    .origin-manager-head h3 { margin:0; font-size:14px; letter-spacing:.08em; text-transform:uppercase; }
    .origin-manager-head p { margin:4px 0 0; color:#9fb3c8; font-size:11px; line-height:1.4; }
    .origin-manager-actions { display:flex; flex-wrap:wrap; gap:8px; padding:12px 16px; border-bottom:1px solid rgba(148,185,230,0.12); }
    .origin-manager-actions button, .origin-row-fit, .origin-manager-close {
      appearance:none; border:1px solid rgba(150,190,232,.26); border-radius:10px; background:rgba(255,255,255,.045); color:#dbeafe; cursor:pointer; font-weight:800; font-size:11px; padding:7px 10px;
    }
    .origin-manager-actions button.primary { border-color:rgba(255,209,102,.76); background:rgba(255,178,54,.18); color:#fff2c6; }
    .origin-manager-body { overflow:auto; padding:0 16px 14px; }
    .origin-manager-table { width:100%; border-collapse:collapse; font-size:11px; }
    .origin-manager-table th { text-align:left; color:#9fb3c8; font-size:10px; letter-spacing:.07em; text-transform:uppercase; padding:10px 8px; position:sticky; top:0; background:rgba(7,14,23,.96); }
    .origin-manager-table td { border-top:1px solid rgba(148,185,230,.1); padding:8px; vertical-align:middle; }
    .origin-key { font-weight:900; color:#f5fbff; }
    .origin-sub { color:#83a0bc; font-size:10px; margin-top:2px; }
    .origin-vector { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color:#c9e4ff; white-space:nowrap; }
    .origin-delta { color:#ffd166; }
    .origin-manager-empty { padding:16px; color:#9fb3c8; font-size:12px; }
  `;
  document.head.appendChild(style);
}

function ensureButton() {
  if (state.button) return state.button;
  let button = byId('originManagerBtn');
  if (!button) {
    button = document.createElement('button');
    button.id = 'originManagerBtn';
    button.type = 'button';
    button.className = 'tool-btn icon-text';
    button.title = 'Origin Manager: review/apply proposed non-overlap model offsets';
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<span aria-hidden="true">â—Ž</span><span>Origins</span>';
    const anchor = byId('marqueeZoomBtn') || byId('fitSelectionBtn') || byId('resetCameraBtn');
    anchor?.insertAdjacentElement('afterend', button);
  }
  button.addEventListener('click', () => togglePanel());
  state.button = button;
  return button;
}

function ensurePanel() {
  if (state.panel) return state.panel;
  const viewer = byId('viewer') || document.body;
  const panel = document.createElement('aside');
  panel.id = 'originManagerPanel';
  panel.className = 'origin-manager-panel';
  panel.innerHTML = `
    <div class="origin-manager-head">
      <div><h3>Origin Manager</h3><p>Multiple origin/model groups detected. Proposed display offsets are calculated to keep piping groups separated and non-overlapping.</p></div>
      <button type="button" class="origin-manager-close" title="Close">Ã—</button>
    </div>
    <div class="origin-manager-actions">
      <button type="button" class="primary" data-origin-apply>Apply Proposed Layout</button>
      <button type="button" data-origin-reset>Reset Display Offsets</button>
      <button type="button" data-origin-refresh>Refresh</button>
    </div>
    <div class="origin-manager-body" data-origin-body></div>
  `;
  viewer.appendChild(panel);
  panel.querySelector('.origin-manager-close')?.addEventListener('click', () => setPanel(false));
  panel.querySelector('[data-origin-apply]')?.addEventListener('click', applyProposedOffsets);
  panel.querySelector('[data-origin-reset]')?.addEventListener('click', resetOffsets);
  panel.querySelector('[data-origin-refresh]')?.addEventListener('click', () => analyze(true));
  panel.addEventListener('click', (event) => {
    const fitButton = event.target.closest?.('[data-origin-fit]');
    if (!fitButton) return;
    const group = state.groups.find((item) => item.id === fitButton.dataset.originFit);
    if (group) fitBox(group.box, 'Origin group fit');
  });
  state.panel = panel;
  return panel;
}

function setPanel(visible) {
  const panel = ensurePanel();
  panel.classList.toggle('visible', visible);
  ensureButton().classList.toggle('active', visible);
  ensureButton().setAttribute('aria-expanded', String(visible));
  if (visible) renderPanel();
}

function togglePanel() {
  setPanel(!ensurePanel().classList.contains('visible'));
}

function installOriginManager() {
  installStyles();
  ensureButton();
  ensurePanel();
  window.addEventListener('markup:render-context', (event) => {
    state.scene = event.detail?.scene || runtime().scene || state.scene;
    scheduleAnalyze();
  });
  scheduleAnalyze();
}

let analyzeTimer = null;
function scheduleAnalyze() {
  clearTimeout(analyzeTimer);
  analyzeTimer = setTimeout(() => analyze(false), 160);
}

function analyze(forceOpen) {
  const scene = state.scene || runtime().scene;
  if (!scene) return;
  state.scene = scene;
  const groups = collectOriginGroups(scene);
  state.groups = buildProposals(groups);
  const signature = state.groups.map((group) => `${group.id}:${group.count}:${formatVector(group.box.getCenter(new THREE.Vector3()))}`).join('|');
  const changed = signature && signature !== state.signature;
  state.signature = signature;

  const hasGroups = state.groups.length > 1;
  ensureButton().classList.toggle('visible', hasGroups);
  if (!hasGroups) {
    setPanel(false);
    return;
  }

  renderPanel();
  if ((forceOpen || changed) && state.shownForSignature !== signature) {
    state.shownForSignature = signature;
    setPanel(true);
    setStatus(`Origin Manager: ${state.groups.length} groups detected`);
  }
}

function collectOriginGroups(scene) {
  scene.updateMatrixWorld(true);
  const nodeToLine = new Map();
  scene.traverse((object) => {
    const data = object.userData || {};
    if ((data.TYPE || data.type) !== 'COMPONENT') return;
    const line = data.lineNo || data.LINE_NO;
    if (!line) return;
    [data.fromNode, data.FROM_NODE, data.toNode, data.TO_NODE].filter(Boolean).forEach((node) => nodeToLine.set(String(node), String(line)));
  });

  const groups = new Map();
  scene.traverse((object) => {
    if (!isTransformCandidate(object)) return;
    const data = object.userData || {};
    const key = groupKeyFor(data, nodeToLine);
    if (!key) return;
    const existing = groups.get(key) || { id: key, label: key, objects: [], box: new THREE.Box3(), count: 0 };
    const objectBox = new THREE.Box3().setFromObject(object);
    if (!isValidBox(objectBox)) return;
    existing.objects.push(object);
    existing.box.union(objectBox);
    existing.count += 1;
    groups.set(key, existing);
  });

  return [...groups.values()]
    .filter((group) => group.count && isValidBox(group.box))
    .sort((a, b) => a.box.min.x - b.box.min.x)
    .slice(0, MAX_GROUPS);
}

function isTransformCandidate(object) {
  if (!object || object.visible === false) return false;
  const data = object.userData || {};
  const type = data.TYPE || data.type;
  if (!type || type === 'RVM_PRIMITIVE') return false;
  if (String(object.name || '').toLowerCase().includes('helper')) return false;
  let parent = object.parent;
  while (parent) {
    const parentData = parent.userData || {};
    const parentType = parentData.TYPE || parentData.type;
    if (parentType && parentType !== 'RVM_PRIMITIVE' && groupKeyFor(parentData, new Map()) === groupKeyFor(data, new Map())) return false;
    parent = parent.parent;
  }
  return true;
}

function groupKeyFor(data, nodeToLine) {
  const explicit = data.ORIGIN || data.origin || data.ORIGIN_ID || data.originId || data.inputOrigin || data.INPUT_ORIGIN;
  if (explicit) return `Origin ${explicit}`;
  const node = data.NODE || data.node || data.fromNode || data.FROM_NODE || data.toNode || data.TO_NODE;
  const line = data.lineNo || data.LINE_NO || (node ? nodeToLine.get(String(node)) : null);
  if (line) return `Line ${line}`;
  return null;
}

function buildProposals(groups) {
  if (groups.length < 2) return groups;
  const all = groups.reduce((box, group) => box.union(group.box), new THREE.Box3());
  const allSize = all.getSize(new THREE.Vector3());
  const maxWidth = Math.max(...groups.map((group) => group.box.getSize(new THREE.Vector3()).x), 1);
  const spacing = Math.max(maxWidth * 0.35, allSize.length() * 0.035, 5);
  let cursor = groups[0].box.min.x;
  return groups.map((group, index) => {
    const size = group.box.getSize(new THREE.Vector3());
    const currentCenter = group.box.getCenter(new THREE.Vector3());
    const delta = index === 0 ? new THREE.Vector3() : new THREE.Vector3(cursor - group.box.min.x, 0, 0);
    const proposedCenter = currentCenter.clone().add(delta);
    cursor += size.x + spacing;
    return { ...group, currentCenter, proposedCenter, delta };
  });
}

function renderPanel() {
  const body = ensurePanel().querySelector('[data-origin-body]');
  if (!body) return;
  if (state.groups.length < 2) {
    body.innerHTML = '<div class="origin-manager-empty">No multiple-origin/model groups detected in the current view.</div>';
    return;
  }
  body.innerHTML = `
    <table class="origin-manager-table">
      <thead><tr><th>Group</th><th>Current center</th><th>Proposed center</th><th>Î” display offset</th><th></th></tr></thead>
      <tbody>${state.groups.map((group) => `
        <tr>
          <td><div class="origin-key">${escapeHtml(group.label)}</div><div class="origin-sub">${group.count} objects / display-only</div></td>
          <td class="origin-vector">${formatVector(group.currentCenter)}</td>
          <td class="origin-vector">${formatVector(group.proposedCenter)}</td>
          <td class="origin-vector origin-delta">${formatVector(group.delta)}</td>
          <td><button type="button" class="origin-row-fit" data-origin-fit="${escapeHtml(group.id)}">Fit</button></td>
        </tr>
      `).join('')}</tbody>
    </table>`;
}

function applyProposedOffsets() {
  for (const group of state.groups) {
    if (!group.delta || group.delta.lengthSq() < 1e-10) continue;
    for (const object of group.objects) {
      if (!state.originals.has(object)) state.originals.set(object, object.position.clone());
      object.position.add(group.delta);
      object.updateMatrixWorld(true);
    }
  }
  state.applied = true;
  setStatus('Origin Manager: proposed layout applied');
  analyze(false);
}

function resetOffsets() {
  for (const group of state.groups) {
    for (const object of group.objects) {
      const original = state.originals.get(object);
      if (!original) continue;
      object.position.copy(original);
      object.updateMatrixWorld(true);
    }
  }
  state.originals = new WeakMap();
  state.applied = false;
  setStatus('Origin Manager: display offsets reset');
  analyze(false);
}

function fitBox(box, message) {
  const camera = runtime().camera;
  const renderer = runtime().renderer;
  if (!camera || !renderer || !isValidBox(box)) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.length() * 0.5, 0.001);
  const aspect = renderer.domElement.clientWidth && renderer.domElement.clientHeight ? renderer.domElement.clientWidth / renderer.domElement.clientHeight : camera.aspect || 1;
  const fov = Math.max(THREE.MathUtils.degToRad(camera.fov || 48), THREE.MathUtils.degToRad(10));
  const distance = Math.max(radius / Math.sin(Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * aspect)) / 2), radius * 2.4) * 1.08;
  const direction = camera.position.clone().sub(center).normalize();
  if (direction.lengthSq() < 1e-8) direction.set(1.1, .78, 1.12).normalize();
  camera.position.copy(center).add(direction.multiplyScalar(distance));
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  setStatus(message);
}

function isValidBox(box) {
  return Boolean(box) && Number.isFinite(box.min.x) && Number.isFinite(box.min.y) && Number.isFinite(box.min.z) && Number.isFinite(box.max.x) && Number.isFinite(box.max.y) && Number.isFinite(box.max.z);
}

function formatVector(v) {
  return `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function setStatus(message) {
  const pill = byId('runtimeStatus');
  if (pill) pill.textContent = message;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installOriginManager, { once: true });
} else {
  installOriginManager();
}
