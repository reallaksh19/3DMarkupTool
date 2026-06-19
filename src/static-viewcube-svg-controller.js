// Static SVG ViewCube controller.
// Builds a clean floating vertical icon bar and proxies clicks to the original app.js view buttons.
// The original .view-pad is kept only as a hidden action source; it is not restyled into a bar.

const VERSION = 'static-viewcube-floating-icons-20260619';
const STYLE_ID = 'staticViewCubeSvgStyles';
const BAR_ID = 'staticViewCubeBar';

const VIEW_ORDER = ['top', 'iso', 'side', 'front', 'fit', 'fitSelection', 'zoom'];
const VIEW_DEFS = {
  top: { title: 'Top view', label: 'Top', icon: faceIcon('top') },
  iso: { title: 'Isometric view', label: 'ISO', icon: isoIcon(), active: true },
  side: { title: 'Right side view', label: 'Right', icon: faceIcon('right') },
  front: { title: 'Front view', label: 'Front', icon: faceIcon('front') },
  fit: { title: 'Fit all', label: 'Fit all', icon: cornersIcon(), group: 'nav' },
  fitSelection: { title: 'Fit selected object', label: 'Fit selected', icon: focusBoxIcon(), group: 'nav' },
  zoom: { title: 'Zoom tool', label: 'Zoom', icon: zoomIcon(), group: 'nav' }
};

runWhenReady(initViewCubeSvg);

function runWhenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function initViewCubeSvg() {
  injectStyles();
  ensureFloatingBar();
  window.addEventListener('viewer:ui-score-changed', ensureFloatingBar);
  window.addEventListener('resize', ensureFloatingBar, { passive: true });
  window.__3D_MARKUP_STATIC_VIEWCUBE_SVG__ = { version: VERSION, refresh: ensureFloatingBar };
}

function injectStyles() {
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Old square view pad remains in DOM only so app.js handlers stay available. */
    .view-pad {
      display: none !important;
    }

    .static-viewcube-bar {
      position: absolute;
      top: 18px;
      right: 18px;
      z-index: 18;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 7px;
      padding: 0;
      background: transparent;
      border: 0;
      box-shadow: none;
      pointer-events: none;
    }

    .static-viewcube-btn {
      width: 36px;
      height: 36px;
      min-width: 36px;
      min-height: 36px;
      padding: 0;
      display: inline-grid;
      place-items: center;
      border-radius: 10px;
      border: 1px solid rgba(110, 162, 225, .38);
      color: #dcefff;
      background: linear-gradient(180deg, rgba(20, 47, 81, .96), rgba(10, 27, 48, .96));
      box-shadow: inset 0 1px 0 rgba(255,255,255,.055), 0 3px 10px rgba(0,0,0,.24);
      cursor: pointer;
      pointer-events: auto;
      transition: transform .12s ease, border-color .12s ease, background .12s ease, color .12s ease, box-shadow .12s ease;
    }

    .static-viewcube-btn:hover,
    .static-viewcube-btn:focus-visible {
      transform: translateX(-1px);
      border-color: rgba(88, 166, 255, .80);
      color: #ffffff;
      background: linear-gradient(180deg, rgba(25, 91, 165, .98), rgba(14, 61, 119, .98));
      box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 0 0 2px rgba(88,166,255,.12), 0 6px 14px rgba(0,0,0,.28);
      outline: none;
    }

    .static-viewcube-btn.is-active {
      color: #ffffff;
      border-color: rgba(88, 166, 255, .88);
      background: linear-gradient(180deg, rgba(23, 108, 200, .98), rgba(15, 63, 130, .98));
      box-shadow: inset 0 1px 0 rgba(255,255,255,.10), 0 0 0 1px rgba(88,166,255,.10), 0 8px 18px rgba(16, 82, 164, .28);
    }

    .static-viewcube-btn[data-group="nav"] {
      margin-top: 7px;
    }

    .static-viewcube-btn[data-group="nav"] + .static-viewcube-btn[data-group="nav"] {
      margin-top: 0;
    }

    .static-viewcube-icon {
      width: 18px;
      height: 18px;
      display: block;
      pointer-events: none;
    }

    .static-viewcube-icon path,
    .static-viewcube-icon rect,
    .static-viewcube-icon polygon,
    .static-viewcube-icon circle,
    .static-viewcube-icon line,
    .static-viewcube-icon polyline {
      vector-effect: non-scaling-stroke;
    }

    .static-viewcube-sr {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    }

    @media (max-height: 720px) {
      .static-viewcube-bar {
        top: 12px;
        right: 12px;
        gap: 6px;
      }
      .static-viewcube-btn {
        width: 34px;
        height: 34px;
        min-width: 34px;
        min-height: 34px;
        border-radius: 9px;
      }
      .static-viewcube-icon {
        width: 17px;
        height: 17px;
      }
    }
  `;
  document.head.appendChild(style);
}

function ensureFloatingBar() {
  const viewer = document.getElementById('viewer') || document.querySelector('.viewer-shell') || document.body;
  if (!viewer) return null;

  const oldPad = document.querySelector('.view-pad');
  if (oldPad) oldPad.setAttribute('aria-hidden', 'true');

  let bar = document.getElementById(BAR_ID);
  if (!bar) {
    bar = document.createElement('nav');
    bar.id = BAR_ID;
    bar.className = 'static-viewcube-bar';
    bar.setAttribute('aria-label', 'View and navigation shortcuts');
    viewer.appendChild(bar);
  }

  renderBar(bar);
  return bar;
}

function renderBar(bar) {
  const existing = new Map(Array.from(bar.querySelectorAll('[data-viewcube-proxy]')).map((button) => [button.dataset.viewcubeProxy, button]));
  VIEW_ORDER.forEach((key) => {
    const def = VIEW_DEFS[key];
    if (!def) return;
    let button = existing.get(key);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'static-viewcube-btn';
      button.dataset.viewcubeProxy = key;
      button.addEventListener('click', () => triggerSourceView(key));
    }
    button.title = def.title;
    button.setAttribute('aria-label', def.title);
    button.dataset.group = def.group || 'view';
    button.classList.toggle('is-active', Boolean(def.active));
    button.innerHTML = `${def.icon}<span class="static-viewcube-sr">${escapeHtml(def.label)}</span>`;
    bar.appendChild(button);
  });
}

function triggerSourceView(key) {
  const source = document.querySelector(`.view-pad button[data-view="${cssEscape(key)}"]`)
    || document.querySelector(`button[data-view="${cssEscape(key)}"]`);
  if (source && source !== document.activeElement) {
    source.click();
    return;
  }
  if (source) source.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value);
  return String(value).replace(/"/g, '\\"');
}

function svg(content, viewBox = '0 0 24 24') {
  return `<svg class="static-viewcube-icon" viewBox="${viewBox}" aria-hidden="true" focusable="false" fill="none" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
}

function faceIcon(face) {
  const fill = 'rgba(116, 201, 255, .22)';
  const stroke = 'currentColor';
  if (face === 'top') {
    return svg(`
      <polygon points="6 8 12 4 18 8 12 12" fill="${fill}" stroke="${stroke}" stroke-width="1.7" stroke-linejoin="round"/>
      <path d="M6 8v6l6 4 6-4V8" stroke="${stroke}" stroke-width="1.45" stroke-linejoin="round" opacity=".70"/>
      <path d="M12 12v6" stroke="${stroke}" stroke-width="1.25" opacity=".50"/>
    `);
  }
  if (face === 'front') {
    return svg(`
      <rect x="6" y="7" width="12" height="10" rx="1.5" fill="${fill}" stroke="${stroke}" stroke-width="1.7"/>
      <path d="M8 10h8M8 14h8" stroke="${stroke}" stroke-width="1.15" opacity=".55"/>
    `);
  }
  return svg(`
    <polygon points="8 6 17 9 17 18 8 15" fill="${fill}" stroke="${stroke}" stroke-width="1.7" stroke-linejoin="round"/>
    <path d="M8 6l-2 3v9l2-3M6 9l9 3" stroke="${stroke}" stroke-width="1.15" opacity=".55"/>
  `);
}

function isoIcon() {
  return svg(`
    <polygon points="12 3.8 19 7.7 12 11.7 5 7.7" fill="rgba(116,201,255,.28)" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
    <polygon points="5 7.7 12 11.7 12 20 5 16" fill="rgba(88,166,255,.18)" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/>
    <polygon points="19 7.7 12 11.7 12 20 19 16" fill="rgba(255,199,96,.16)" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/>
  `);
}

function cornersIcon() {
  return svg(`
    <path d="M7 4H4v3M17 4h3v3M7 20H4v-3M17 20h3v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="8" y="8" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.35" opacity=".65"/>
  `);
}

function focusBoxIcon() {
  return svg(`
    <rect x="6" y="6" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.5" opacity=".65"/>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="12" cy="12" r="2" fill="currentColor" opacity=".55"/>
  `);
}

function zoomIcon() {
  return svg(`
    <circle cx="10.5" cy="10.5" r="5.4" stroke="currentColor" stroke-width="1.8"/>
    <path d="M15 15l5 5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
    <path d="M8.3 10.5h4.4M10.5 8.3v4.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>
  `);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
