import * as THREE from 'three';

const runtime = window.__3D_MARKUP_CLIP_RUNTIME__ || null;

const state = {
  scene: runtime?.scene || null,
  panel: null,
  lastSignature: ''
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initRoundtripStatus, { once: true });
} else {
  initRoundtripStatus();
}

window.addEventListener('markup:render-context', (event) => {
  if (event.detail?.scene) state.scene = event.detail.scene;
  updateRoundtripStatus(true);
});

function initRoundtripStatus() {
  injectStyles();
  attachExportValidation();
  window.setInterval(updateRoundtripStatus, 1000);
  updateRoundtripStatus(true);
}

function attachExportValidation() {
  const exportBtn = document.getElementById('navisExportTagsBtn');
  if (!exportBtn || exportBtn.dataset.roundtripValidation === 'true') return;
  exportBtn.dataset.roundtripValidation = 'true';
  exportBtn.addEventListener('click', () => {
    const summary = collectTagSummary();
    if (!summary.total) {
      toast('No tag viewpoints available. Use ISONOTE XML, Import XML, or Tag first.');
      return;
    }
    if (summary.invalid) {
      toast(`Export warning: ${summary.invalid} tag viewpoint(s) have incomplete coordinates.`);
      return;
    }
    toast(`Export ready: ${summary.total} viewpoint(s) = ${summary.imported} imported, ${summary.isonote} ISONOTE, ${summary.manual} manual.`);
  }, true);
}

function updateRoundtripStatus(force = false) {
  const panel = ensureStatusHost();
  if (!panel) return;
  const summary = collectTagSummary();
  const signature = JSON.stringify(summary);
  if (!force && signature === state.lastSignature) return;
  state.lastSignature = signature;

  panel.innerHTML = `
    <div class="navis-roundtrip-title">XML Round-trip</div>
    <div class="navis-roundtrip-grid">
      <span>Imported</span><b>${summary.imported}</b>
      <span>ISONOTE</span><b>${summary.isonote}</b>
      <span>Manual</span><b>${summary.manual}</b>
      <span>Total</span><b>${summary.total}</b>
    </div>
    <div class="navis-roundtrip-status ${summary.invalid ? 'warn' : 'ok'}">
      ${summary.total ? (summary.invalid ? `${summary.invalid} invalid coordinate set(s)` : 'Ready for XML export') : 'No tag viewpoints yet'}
    </div>
  `;
}

function ensureStatusHost() {
  let panel = document.querySelector('#navisTagViewPanel .navis-roundtrip-status-panel');
  if (panel) return panel;

  const tagPanel = document.getElementById('navisTagViewPanel');
  if (!tagPanel) return null;
  panel = document.createElement('div');
  panel.className = 'navis-roundtrip-status-panel';
  const list = tagPanel.querySelector('.navis-tag-view-list');
  tagPanel.insertBefore(panel, list || null);
  state.panel = panel;
  return panel;
}

function collectTagSummary() {
  const scene = state.scene || window.__3D_MARKUP_CLIP_RUNTIME__?.scene;
  const summary = { imported: 0, isonote: 0, manual: 0, invalid: 0, total: 0 };
  if (!scene?.traverse) return summary;

  const seenImported = new Set();
  const seenManual = new Set();
  scene.traverse((object) => {
    const data = object.userData || {};
    const name = String(object.name || '');

    if (data.TYPE === 'ISONOTE_NAME_PLATE') {
      summary.isonote += 1;
      if (!hasFiniteWorldPosition(object)) summary.invalid += 1;
      return;
    }

    if (name.startsWith('NAVIS_IMPORTED_TAG_') && !seenImported.has(name)) {
      seenImported.add(name);
      summary.imported += 1;
      if (!hasValidTagGroup(object)) summary.invalid += 1;
      return;
    }

    if (name.startsWith('NAVIS_MANUAL_TAG_') && !seenManual.has(name)) {
      seenManual.add(name);
      summary.manual += 1;
      if (!hasValidTagGroup(object)) summary.invalid += 1;
    }
  });

  summary.total = summary.imported + summary.isonote + summary.manual;
  return summary;
}

function hasValidTagGroup(group) {
  if (!group?.children?.length) return false;
  const hasTagChild = group.children.some((child) => /TAG_(LEADER|TEXT|ANCHOR)/i.test(child.name || ''));
  return hasTagChild && hasFiniteWorldPosition(group);
}

function hasFiniteWorldPosition(object) {
  try {
    const position = object.getWorldPosition?.(new THREE.Vector3());
    return Boolean(position) && Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z);
  } catch {
    return false;
  }
}

function toast(message) {
  let el = document.getElementById('navisTagToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'navisTagToast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  window.clearTimeout(el._timer);
  el._timer = window.setTimeout(() => el.classList.remove('show'), 2400);
}

function injectStyles() {
  if (document.getElementById('navisTagRoundtripStyles')) return;
  const style = document.createElement('style');
  style.id = 'navisTagRoundtripStyles';
  style.textContent = `
    .navis-roundtrip-status-panel {
      margin: 8px 10px 10px;
      padding: 9px 10px;
      border: 1px solid rgba(101, 213, 255, .22);
      border-radius: 10px;
      background: rgba(6, 14, 25, .68);
      color: #dcecff;
      font-size: 11px;
    }
    .navis-roundtrip-title {
      margin-bottom: 6px;
      color: #65d5ff;
      font-weight: 950;
      letter-spacing: .7px;
      text-transform: uppercase;
      font-size: 9px;
    }
    .navis-roundtrip-grid {
      display: grid;
      grid-template-columns: 1fr auto 1fr auto;
      gap: 5px 9px;
      align-items: center;
    }
    .navis-roundtrip-grid span { color: rgba(220, 236, 255, .74); }
    .navis-roundtrip-grid b { color: #fff1c7; }
    .navis-roundtrip-status { margin-top: 7px; font-weight: 850; }
    .navis-roundtrip-status.ok { color: #5ee0a0; }
    .navis-roundtrip-status.warn { color: #ffb86b; }
  `;
  document.head.appendChild(style);
}
