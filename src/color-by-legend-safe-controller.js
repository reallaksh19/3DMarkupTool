const LEGEND_ID = 'colorByLegendPanel';
const MAX_ROWS = 18;

const MODE_LABELS = {
  default: 'Default',
  lineNo: 'Line No.',
  componentType: 'Component Type',
  supportSource: 'Support Source',
  sourceMode: 'Source Mode'
};

installSafeColorLegend();

function installSafeColorLegend() {
  if (window.__3D_MARKUP_SAFE_COLOR_LEGEND__) return;
  window.__3D_MARKUP_SAFE_COLOR_LEGEND__ = true;

  installStyles();
  ensurePanel();

  const select = document.getElementById('colorBySelect');
  select?.addEventListener('change', () => {
    const panel = ensurePanel();
    panel.dataset.userHidden = '';
    scheduleRender();
  });

  window.addEventListener('markup:render-context', () => {
    const selectMode = document.getElementById('colorBySelect')?.value || 'default';
    if (selectMode !== 'default') scheduleRender();
  });

  window.addEventListener('markup:app-ready', scheduleRender);
  window.setTimeout(scheduleRender, 350);
}

function installStyles() {
  if (document.getElementById('safeColorLegendStyles')) return;

  const style = document.createElement('style');
  style.id = 'safeColorLegendStyles';
  style.textContent = `
    .color-legend-panel {
      position: absolute;
      left: 18px;
      bottom: 64px;
      z-index: 58;
      width: min(310px, calc(100vw - 44px));
      max-height: min(48vh, 460px);
      display: none;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
      border: 1px solid rgba(114, 178, 245, 0.36);
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(10, 22, 34, 0.96), rgba(7, 14, 23, 0.94));
      box-shadow: 0 18px 44px rgba(0,0,0,.36), inset 0 1px 0 rgba(255,255,255,.06);
      color: #e9f3ff;
      backdrop-filter: blur(14px);
      pointer-events: auto;
    }
    .color-legend-panel.visible { display: flex; }
    .color-legend-head {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 10px;
      border-bottom: 1px solid rgba(148,185,230,.16);
      padding-bottom: 8px;
    }
    .color-legend-title { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .color-legend-title strong {
      font-size: 12px;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: #f5fbff;
    }
    .color-legend-title span { font-size: 11px; color: #9fb3c8; }
    .color-legend-close {
      appearance: none;
      border: 1px solid rgba(150,190,232,.24);
      background: rgba(255,255,255,.04);
      color: #dbeafe;
      border-radius: 9px;
      width: 26px;
      height: 26px;
      cursor: pointer;
    }
    .color-legend-list { display: flex; flex-direction: column; gap: 6px; overflow: auto; padding-right: 2px; }
    .color-legend-row {
      display: grid;
      grid-template-columns: 18px minmax(0,1fr) auto;
      align-items: center;
      gap: 8px;
      min-height: 24px;
      font-size: 11px;
    }
    .color-legend-swatch {
      width: 14px;
      height: 14px;
      border-radius: 5px;
      border: 1px solid rgba(255,255,255,.42);
      box-shadow: 0 0 0 2px rgba(0,0,0,.18);
    }
    .color-legend-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #eef7ff; }
    .color-legend-count { color: #8da3ba; font-variant-numeric: tabular-nums; }
    .color-legend-empty { color: #9fb3c8; font-size: 11px; line-height: 1.45; padding: 4px 0; }
    .color-legend-foot {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      color: #7f93a8;
      font-size: 10px;
      border-top: 1px solid rgba(148,185,230,.14);
      padding-top: 8px;
    }
    body.props-open .color-legend-panel { right: 372px; left: auto; }
    @media (max-width: 980px) {
      .color-legend-panel { left: 12px; bottom: 58px; width: min(280px, calc(100vw - 24px)); }
      body.props-open .color-legend-panel { left: 12px; right: auto; }
    }
  `;
  document.head.appendChild(style);
}

function ensurePanel() {
  let panel = document.getElementById(LEGEND_ID);
  if (panel) return panel;

  panel = document.createElement('aside');
  panel.id = LEGEND_ID;
  panel.className = 'color-legend-panel';
  panel.setAttribute('aria-live', 'polite');
  panel.innerHTML = `
    <div class="color-legend-head">
      <div class="color-legend-title">
        <strong>Color Legend</strong>
        <span data-color-legend-mode>Default</span>
      </div>
      <button class="color-legend-close" type="button" title="Hide legend" aria-label="Hide color legend">Ã—</button>
    </div>
    <div class="color-legend-list" data-color-legend-list></div>
    <div class="color-legend-foot">
      <span data-color-legend-summary>0 categories</span>
      <span>Color By</span>
    </div>
  `;

  const host = document.querySelector('.viewer-stage') || document.getElementById('viewer') || document.body;
  host.appendChild(panel);
  panel.querySelector('.color-legend-close')?.addEventListener('click', () => {
    panel.classList.remove('visible');
    panel.dataset.userHidden = 'true';
  });
  return panel;
}

function scheduleRender() {
  window.requestAnimationFrame(renderLegend);
}

function renderLegend() {
  const select = document.getElementById('colorBySelect');
  const panel = ensurePanel();
  const mode = select?.value || 'default';

  if (mode === 'default') {
    panel.classList.remove('visible');
    panel.dataset.userHidden = '';
    return;
  }

  const rows = collectRows(mode);
  const visibleRows = rows.slice(0, MAX_ROWS);
  const hiddenCount = Math.max(0, rows.length - visibleRows.length);
  const list = panel.querySelector('[data-color-legend-list]');
  const modeLabel = panel.querySelector('[data-color-legend-mode]');
  const summary = panel.querySelector('[data-color-legend-summary]');

  modeLabel.textContent = MODE_LABELS[mode] || mode;
  summary.textContent = `${rows.length} categor${rows.length === 1 ? 'y' : 'ies'} / ${rows.reduce((sum, row) => sum + row.count, 0)} meshes`;

  if (!rows.length) {
    list.innerHTML = '<div class="color-legend-empty">Color mode is active. Load/convert a model or orbit once to refresh the legend.</div>';
  } else {
    list.innerHTML = visibleRows.map((row) => `
      <div class="color-legend-row" title="${escapeHtml(row.label)}">
        <span class="color-legend-swatch" style="background:${hexToCss(row.color)}"></span>
        <span class="color-legend-label">${escapeHtml(row.label)}</span>
        <span class="color-legend-count">${row.count}</span>
      </div>
    `).join('') + (hiddenCount ? `<div class="color-legend-empty">+ ${hiddenCount} more categor${hiddenCount === 1 ? 'y' : 'ies'} not shown</div>` : '');
  }

  if (panel.dataset.userHidden !== 'true') panel.classList.add('visible');
}

function collectRows(mode) {
  const scene = window.__3D_MARKUP_CLIP_RUNTIME__?.scene;
  if (!scene || mode === 'default') return [];

  const groups = new Map();
  scene.traverse((object) => {
    if (shouldSkipObject(object)) return;
    const data = findUserData(object);
    const label = labelFor(data, mode);
    if (!label) return;

    const color = materialColor(object) || colorFromString(label);
    const key = `${mode}:${label}`;
    const row = groups.get(key) || { label, color, count: 0 };
    row.count += 1;
    groups.set(key, row);
  });

  return [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function shouldSkipObject(object) {
  if (!object?.isMesh) return true;
  if (!object.visible) return true;
  const name = String(object.name || '').toUpperCase();
  return name.includes('SELECTION_BOX_HELPER')
    || name.includes('MEASURE')
    || name.includes('TAG_MARKUP')
    || name.includes('NAVIS_TAG')
    || name.includes('COLOR_LEGEND');
}

function findUserData(object) {
  let current = object;
  let fallback = null;
  while (current) {
    const data = current.userData || {};
    if (Object.keys(data).length) {
      const type = data.TYPE || data.type;
      if (type && type !== 'RVM_PRIMITIVE') return normalizeLegacyUserData(data);
      if (!fallback) fallback = normalizeLegacyUserData(data);
    }
    current = current.parent;
  }
  return fallback || {};
}

function normalizeLegacyUserData(data) {
  if (data.type === 'NODE') return { TYPE: 'NODE', NODE: data.node, LABEL: `N${data.node}`, SOURCE: 'InputXML' };
  return data;
}

function labelFor(data, mode) {
  const type = String(data.TYPE || data.type || 'Object');
  if (mode === 'lineNo') return data.lineNo || data.LINE_NO || data.node || data.NODE || 'Unavailable / No Line';
  if (mode === 'componentType') return data.engineeringType || data.ENGINEERING_TYPE || data.meshRole || data.MESH_ROLE || type;
  if (mode === 'supportSource') return data.sourceClass || data.SOURCE_CLASS || data.source || data.SOURCE || (type === 'SUPPORT_RESTRAINT' ? 'Support / Restraint' : 'Component / Pipe');
  if (mode === 'sourceMode') return data.sourceMode || data.SOURCE_MODE || data.source || data.SOURCE || type;
  return null;
}

function materialColor(object) {
  const material = Array.isArray(object.material) ? object.material[0] : object.material;
  return material?.color?.getHex?.() || null;
}

function colorFromString(value) {
  const palette = [0x50c4ff, 0x30e0b4, 0xffc857, 0xff7c7c, 0xb48cff, 0x9ad86d, 0xf49f5a, 0x70d6ff];
  const text = String(value || 'unavailable');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

function hexToCss(hex) {
  return `#${Number(hex || 0x6e7f91).toString(16).padStart(6, '0')}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
