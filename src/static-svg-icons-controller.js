// Professional static SVG icon controller.
// Replaces glyph/text-only tool affordances with local inline SVGs. No external icon runtime required.

const VERSION = 'static-svg-icons-review-20260619';
const STYLE_ID = 'staticSvgIconStyles';
const SVG_NS = 'http://www.w3.org/2000/svg';

const ICONS = {
  select: '<path d="M5 3l12 11-6 1.5L8 21 5 3z"/><path d="M11 15.5l4 5"/>',
  orbit: '<circle cx="12" cy="12" r="3.25"/><path d="M3.5 12c2.7-5.2 14.3-5.2 17 0"/><path d="M20.5 12c-2.7 5.2-14.3 5.2-17 0"/><path d="M12 3v2.2M12 18.8V21"/>',
  pan: '<path d="M8 12V6a2 2 0 0 1 4 0v5"/><path d="M12 11V5a2 2 0 0 1 4 0v7"/><path d="M16 12V8a2 2 0 0 1 4 0v6c0 4-2.6 7-7 7h-1.3a7 7 0 0 1-5.5-2.7L3.8 15a2 2 0 0 1 3.1-2.5L8 14"/>',
  measure: '<path d="M4 17L17 4l3 3L7 20z"/><path d="M14 7l3 3M11 10l2 2M8 13l3 3"/>',
  cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5"/><path d="M12 12v9"/>',
  top: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M8 8h8v8H8z"/>',
  front: '<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 10h8M8 14h8"/>',
  side: '<path d="M7 5h9l3 3v11H7z"/><path d="M16 5v4h4"/><path d="M10 10h4M10 14h6"/>',
  fit: '<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/><path d="M9 9h6v6H9z"/>',
  fitSel: '<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/><circle cx="12" cy="12" r="3"/>',
  grid: '<path d="M4 4h16v16H4z"/><path d="M4 10h16M4 15h16M9 4v16M15 4v16"/>',
  clear: '<path d="M5 19l14-14"/><path d="M8 5h11v11"/><path d="M5 8v11h11"/>',
  eraser: '<path d="M4 16l8-8a3 3 0 0 1 4.2 0l2.8 2.8a3 3 0 0 1 0 4.2l-5 5H8z"/><path d="M10 20h10"/><path d="M9 11l6 6"/>',
  file3d: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/><path d="M12 11l4 2.2v4.6L12 20l-4-2.2v-4.6z"/><path d="M8 13.2l4 2.2 4-2.2M12 15.4V20"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  upload: '<path d="M12 21V9"/><path d="M7 14l5-5 5 5"/><path d="M5 3h14"/>',
  tag: '<path d="M4 5v7l7 7 8-8-7-7H4z"/><circle cx="9" cy="9" r="1.5"/>',
  xml: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/><path d="M9 14l-2 2 2 2M15 14l2 2-2 2M12 13l-1 6"/>',
  import: '<path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M4 21h16"/><path d="M5 5h5M14 5h5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  save: '<path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3"/><path d="M8 21v-7h8v7"/>',
  restore: '<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v6h6"/><path d="M12 8v5l4 2"/>',
  qa: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h5"/><path d="M8 16l2 2 5-6"/>',
  legend: '<path d="M5 5h14v14H5z"/><path d="M8 8h3v3H8zM8 13h3v3H8z"/><path d="M13 9.5h3M13 14.5h3"/>',
  input: '<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v5h5"/><path d="M8 14h7M12 10v8"/>',
  props: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.7 2.7 0 0 1 5.1 1.4c0 2-2.6 2.3-2.6 4.1"/><path d="M12 18h.01"/>',
  tree: '<path d="M6 4h5v5H6zM13 15h5v5h-5zM6 15h5v5H6z"/><path d="M8.5 9v3.5h7M8.5 12.5V15"/>',
  folder: '<path d="M3 6h7l2 2h9v11H3z"/><path d="M3 9h18"/>',
  folderX: '<path d="M3 6h7l2 2h9v11H3z"/><path d="M9 12l5 5M14 12l-5 5"/>',
  refresh: '<path d="M4 12a8 8 0 0 1 13.7-5.7L20 8"/><path d="M20 3v5h-5"/><path d="M20 12a8 8 0 0 1-13.7 5.7L4 16"/><path d="M4 21v-5h5"/>',
  rules: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h4"/><path d="M15 15l2 2 3-5"/>',
  copy: '<path d="M8 8h11v11H8z"/><path d="M5 16H4a1 1 0 0 1-1-1V4h11v1"/>',
  broom: '<path d="M14 4l6 6"/><path d="M12 6l6 6-7 7H5l-2-2z"/><path d="M5 19l4-4"/>'
};

const BUTTON_ICON_MAP = {
  selectToolBtn: 'select', orbitToolBtn: 'orbit', panToolBtn: 'pan', measureBtn: 'measure',
  viewIsoBtn: 'cube', viewTopBtn: 'top', viewFrontBtn: 'front', viewSideBtn: 'side', resetCameraBtn: 'fit', fitSelectionBtn: 'fitSel',
  gridToggleBtn: 'grid', clearSelectionBtn: 'eraser', previewGlbBtn: 'cube', previewRvmBtn: 'file3d',
  downloadGlbBtn: 'download', downloadRvmBtn: 'download', downloadAttBtn: 'download', downloadAuditBtn: 'qa',
  loadSampleBtn: 'folder', clearBtn: 'folderX', convertBtn: 'refresh', viewRulesBtn: 'rules',
  toggleInputBtn: 'input', togglePropsBtn: 'props', legendToggleBtn: 'legend', helpToggleBtn: 'help', treeToggleBtn: 'tree'
};

const TEXT_ICON_RULES = [
  [/tag/i, 'tag'], [/isonote|xml/i, 'xml'], [/import/i, 'import'], [/views?/i, 'list'], [/save/i, 'save'], [/restore/i, 'restore'],
  [/clear session/i, 'clear'], [/qa/i, 'qa'], [/export/i, 'download'], [/copy/i, 'copy'], [/fit/i, 'fitSel'], [/clear/i, 'eraser']
];

runWhenReady(initSvgIcons);

function runWhenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function initSvgIcons() {
  injectStyles();
  refreshSvgIcons('startup');
  const observer = new MutationObserver(() => scheduleRefresh('mutation'));
  observer.observe(document.body, { childList: true, subtree: true });
  ['viewer:ui-score-changed', 'viewer:static-markup-ready', 'viewer:quick-export-ready', 'viewer:color-legend-ready', 'viewer:properties-actions-ready'].forEach((name) => {
    window.addEventListener(name, () => scheduleRefresh(name));
  });
  window.__3D_MARKUP_STATIC_SVG_ICONS__ = { version: VERSION, refresh: refreshSvgIcons };
}

let refreshTimer = 0;
function scheduleRefresh(source) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => refreshSvgIcons(source), 60);
}

function refreshSvgIcons(source = 'manual') {
  Object.entries(BUTTON_ICON_MAP).forEach(([id, icon]) => applyIcon(document.getElementById(id), icon));
  document.querySelectorAll('button').forEach((button) => {
    if (button.dataset.svgIconApplied === '1') return;
    const text = button.textContent || '';
    const match = TEXT_ICON_RULES.find(([regex]) => regex.test(text));
    if (match) applyIcon(button, match[1]);
  });
  window.dispatchEvent(new CustomEvent('viewer:svg-icons-refreshed', { detail: { source, version: VERSION } }));
}

function applyIcon(button, iconName) {
  if (!button || !ICONS[iconName]) return;
  button.dataset.svgIconApplied = '1';
  button.dataset.svgIcon = iconName;

  const existingSvg = button.querySelector(':scope > svg.static-svg-icon');
  if (existingSvg) return;

  const oldIcon = button.querySelector(':scope > i, :scope > svg:not(.static-svg-icon), :scope > .fresh-clip-glyph');
  if (oldIcon) oldIcon.remove();

  const svg = createSvg(ICONS[iconName]);
  const span = button.querySelector(':scope > span');
  if (span) button.insertBefore(svg, span);
  else button.prepend(svg);
}

function createSvg(inner) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'static-svg-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = inner;
  return svg;
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    :root {
      --tool-icon-size: 19px;
      --tool-label-size: 10.5px;
      --tool-btn-w: 70px;
      --tool-btn-h: 56px;
      --tool-row-gap: 5px;
    }

    .static-svg-icon {
      width: var(--tool-icon-size);
      height: var(--tool-icon-size);
      min-width: var(--tool-icon-size);
      min-height: var(--tool-icon-size);
      display: block;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.85;
      stroke-linecap: round;
      stroke-linejoin: round;
      pointer-events: none;
      opacity: .98;
    }

    .main-ribbon .tool-btn {
      width: var(--tool-btn-w);
      min-width: var(--tool-btn-w);
      max-width: var(--tool-btn-w);
      min-height: var(--tool-btn-h);
      gap: var(--tool-row-gap);
      padding: 6px 5px;
      align-items: center;
      justify-content: center;
    }

    .main-ribbon .tool-btn span {
      font-size: var(--tool-label-size) !important;
      line-height: 1.05 !important;
      letter-spacing: -.03em;
      white-space: nowrap;
    }

    .markup-ribbon button .static-svg-icon,
    .icon-text .static-svg-icon,
    .download-grid button .static-svg-icon,
    .panel-toggle .static-svg-icon,
    .color-legend-toggle .static-svg-icon,
    .help-toggle .static-svg-icon {
      width: 16px;
      height: 16px;
      min-width: 16px;
      min-height: 16px;
      stroke-width: 1.9;
    }

    .viewer-topbar .panel-toggle,
    .viewer-topbar .color-legend-toggle,
    .viewer-topbar .help-toggle {
      gap: 7px;
    }

    .view-pad button .static-svg-icon {
      width: 15px;
      height: 15px;
      margin-inline: auto;
    }

    @media (max-width: 1400px) {
      :root {
        --tool-icon-size: 18px;
        --tool-label-size: 10px;
        --tool-btn-w: 66px;
        --tool-btn-h: 54px;
      }
    }
  `;
  document.head.appendChild(style);
}
