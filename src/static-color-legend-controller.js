// Static Color By legend for review mode.
// Pure UI overlay: does not alter model coloring logic.

const VERSION = 'static-color-legend-draggable-20260619';

const dragState = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  panelLeft: 0,
  panelTop: 0
};

const LEGENDS = {
  default: [
    ['#f0f4f8', 'Pipes / generic geometry'],
    ['#21d4c4', 'Valves'],
    ['#67d4ef', 'Bends / fittings'],
    ['#ffc857', 'Actual supports'],
    ['#28e0c5', 'Expected supports']
  ],
  lineNo: [
    ['#83b9ff', 'Line group A'],
    ['#28e0c5', 'Line group B'],
    ['#ffcc5c', 'Line group C'],
    ['#f97373', 'Other line numbers']
  ],
  componentType: [
    ['#f0f4f8', 'Pipe'],
    ['#21d4c4', 'Valve'],
    ['#67d4ef', 'Bend / fitting'],
    ['#ffc857', 'Support'],
    ['#8fb2d8', 'Rigid / node / annotation']
  ],
  supportSource: [
    ['#ffc857', 'Actual support from InputXML'],
    ['#28e0c5', 'Expected support from ISONOTE'],
    ['#6e7f91', 'Unavailable / unresolved']
  ],
  sourceMode: [
    ['#83b9ff', 'InputXML'],
    ['#ffcc5c', 'ISONOTE / sideload'],
    ['#6e7f91', 'Fallback / unavailable']
  ]
};

runWhenReady(initColorLegend);

function runWhenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function initColorLegend() {
  injectStyles();
  ensureButton();
  ensurePanel();
  bindColorSelect();
  updateLegend();
  window.__3D_MARKUP_COLOR_LEGEND__ = {
    version: VERSION,
    refresh: updateLegend,
    open: openLegend,
    close: closeLegend,
    toggle: toggleLegend,
    resetPosition: resetLegendPosition
  };
  window.dispatchEvent(new CustomEvent('viewer:color-legend-ready', { detail: { version: VERSION } }));
}

function injectStyles() {
  if (document.getElementById('staticColorLegendStyles')) return;
  const style = document.createElement('style');
  style.id = 'staticColorLegendStyles';
  style.textContent = `
    .color-legend-btn {
      min-height: 32px;
      border-radius: 9px;
      padding: 0 10px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .02em;
    }
    .color-legend-panel {
      position: absolute;
      z-index: 18;
      right: 14px;
      top: 14px;
      width: min(300px, calc(100% - 28px));
      display: grid;
      gap: 8px;
      padding: 12px;
      border: 1px solid rgba(116, 230, 255, .28);
      border-radius: 14px;
      background: rgba(5, 15, 29, .95);
      color: #eaf4ff;
      box-shadow: 0 18px 42px rgba(0,0,0,.36);
      backdrop-filter: blur(10px);
      user-select: none;
    }
    .color-legend-panel[hidden] { display: none; }
    .color-legend-panel.dragging { opacity: .92; cursor: grabbing; }
    .color-legend-head { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12px; font-weight:950; text-transform:uppercase; letter-spacing:.05em; cursor: grab; touch-action: none; }
    .color-legend-head:active { cursor: grabbing; }
    .color-legend-title-wrap { display:flex; align-items:center; gap:8px; min-width:0; }
    .color-legend-drag-dot { width:14px; height:14px; display:inline-grid; place-items:center; opacity:.82; font-size:13px; line-height:1; }
    .color-legend-close { width:26px; min-width:26px; height:26px; min-height:26px; padding:0; border-radius:8px; }
    .color-legend-row { display:grid; grid-template-columns:18px minmax(0, 1fr); gap:8px; align-items:center; font-size:11px; color:#bcd0e5; }
    .color-legend-chip { width:16px; height:16px; border-radius:5px; border:1px solid rgba(255,255,255,.35); box-shadow:0 0 12px rgba(255,255,255,.08); }
    .color-legend-note { color:#8ea6bd; font-size:10px; line-height:1.35; border-top:1px solid rgba(255,255,255,.08); padding-top:7px; }
  `;
  document.head.appendChild(style);
}

function ensureButton() {
  if (document.getElementById('colorLegendBtn')) return;
  const host = document.querySelector('.topbar-actions');
  const colorControl = document.querySelector('.color-control');
  if (!host || !colorControl) return;
  const button = document.createElement('button');
  button.id = 'colorLegendBtn';
  button.type = 'button';
  button.className = 'color-legend-btn';
  button.textContent = 'Legend';
  button.title = 'Show Color By legend';
  button.addEventListener('click', toggleLegend);
  colorControl.insertAdjacentElement('afterend', button);
}

function ensurePanel() {
  let panel = document.getElementById('colorLegendPanel');
  if (panel) return panel;
  const viewer = document.getElementById('viewer');
  if (!viewer) return null;
  panel = document.createElement('aside');
  panel.id = 'colorLegendPanel';
  panel.className = 'color-legend-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Color By legend');
  panel.innerHTML = `
    <div class="color-legend-head" id="colorLegendDragHandle" title="Drag legend inside canvas">
      <span class="color-legend-title-wrap"><span class="color-legend-drag-dot">⋮⋮</span><span id="colorLegendTitle">Color Legend</span></span>
      <button id="colorLegendCloseBtn" type="button" class="color-legend-close" title="Close legend">×</button>
    </div>
    <div id="colorLegendBody"></div>
    <div class="color-legend-note">Legend follows the active Color By mode. Drag this panel by its header.</div>
  `;
  viewer.appendChild(panel);
  panel.querySelector('#colorLegendCloseBtn')?.addEventListener('click', closeLegend);
  bindLegendDrag(panel);
  restoreLegendPosition(panel);
  return panel;
}

function bindColorSelect() {
  const select = document.getElementById('colorBySelect');
  if (!select || select.dataset.boundColorLegend === '1') return;
  select.dataset.boundColorLegend = '1';
  select.addEventListener('change', () => {
    updateLegend();
    openLegend({ reason: 'color-change' });
  });
}

function bindLegendDrag(panel) {
  const handle = panel.querySelector('#colorLegendDragHandle');
  if (!handle || handle.dataset.boundLegendDrag === '1') return;
  handle.dataset.boundLegendDrag = '1';
  handle.addEventListener('pointerdown', (event) => {
    if (event.target?.closest?.('button')) return;
    const rect = panel.getBoundingClientRect();
    dragState.active = true;
    dragState.pointerId = event.pointerId;
    dragState.startX = event.clientX;
    dragState.startY = event.clientY;
    dragState.panelLeft = rect.left;
    dragState.panelTop = rect.top;
    panel.classList.add('dragging');
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  handle.addEventListener('pointermove', (event) => {
    if (!dragState.active || dragState.pointerId !== event.pointerId) return;
    moveLegendPanel(panel, dragState.panelLeft + event.clientX - dragState.startX, dragState.panelTop + event.clientY - dragState.startY);
    event.preventDefault();
  });
  const finish = (event) => {
    if (!dragState.active || dragState.pointerId !== event.pointerId) return;
    dragState.active = false;
    dragState.pointerId = null;
    panel.classList.remove('dragging');
    saveLegendPosition(panel);
  };
  handle.addEventListener('pointerup', finish);
  handle.addEventListener('pointercancel', finish);
}

function modeLabel(value) {
  const select = document.getElementById('colorBySelect');
  const option = Array.from(select?.options || []).find((item) => item.value === value);
  return option?.textContent?.trim() || value || 'Default';
}

function updateLegend() {
  const mode = document.getElementById('colorBySelect')?.value || 'default';
  const rows = LEGENDS[mode] || LEGENDS.default;
  const title = document.getElementById('colorLegendTitle');
  const body = document.getElementById('colorLegendBody');
  if (title) title.textContent = `Color By: ${modeLabel(mode)}`;
  if (body) {
    body.innerHTML = rows.map(([color, label]) => `<div class="color-legend-row"><span class="color-legend-chip" style="background:${color}"></span><span>${escapeHtml(label)}</span></div>`).join('');
  }
}

function toggleLegend() {
  const panel = document.getElementById('colorLegendPanel') || ensurePanel();
  if (!panel) return;
  updateLegend();
  panel.hidden ? openLegend({ reason: 'button' }) : closeLegend();
}

function openLegend() {
  const panel = document.getElementById('colorLegendPanel') || ensurePanel();
  if (!panel) return;
  updateLegend();
  restoreLegendPosition(panel);
  panel.hidden = false;
}

function closeLegend() {
  const panel = document.getElementById('colorLegendPanel');
  if (panel) panel.hidden = true;
}

function resetLegendPosition() {
  window.localStorage.removeItem('3dmarkup.colorLegendPos');
  const panel = document.getElementById('colorLegendPanel');
  if (panel) {
    panel.style.left = '';
    panel.style.top = '';
    panel.style.right = '14px';
  }
}

function restoreLegendPosition(panel) {
  const raw = window.localStorage.getItem('3dmarkup.colorLegendPos');
  if (!raw) return;
  try {
    const pos = JSON.parse(raw);
    if (Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
      requestAnimationFrame(() => moveLegendPanel(panel, pos.left, pos.top));
    }
  } catch {
    window.localStorage.removeItem('3dmarkup.colorLegendPos');
  }
}

function saveLegendPosition(panel) {
  const rect = panel.getBoundingClientRect();
  const viewer = document.getElementById('viewer')?.getBoundingClientRect();
  if (!viewer) return;
  window.localStorage.setItem('3dmarkup.colorLegendPos', JSON.stringify({
    left: rect.left,
    top: rect.top
  }));
}

function moveLegendPanel(panel, pageLeft, pageTop) {
  const viewerEl = document.getElementById('viewer');
  const viewer = viewerEl?.getBoundingClientRect();
  if (!viewer) return;
  const width = panel.offsetWidth || 300;
  const height = panel.offsetHeight || 180;
  const margin = 8;
  const left = clamp(pageLeft, viewer.left + margin, viewer.right - width - margin) - viewer.left;
  const top = clamp(pageTop, viewer.top + margin, viewer.bottom - height - margin) - viewer.top;
  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
  panel.style.right = 'auto';
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
