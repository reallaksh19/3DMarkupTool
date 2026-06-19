// Static SVG ViewCube controller.
// Converts the canvas view pad into a compact vertical SVG icon bar.
// It preserves the existing data-view buttons and app.js click handlers.

const VERSION = 'static-viewcube-vertical-icons-20260619';
const STYLE_ID = 'staticViewCubeSvgStyles';

const VIEW_ORDER = ['top', 'iso', 'side', 'front', 'fit', 'fitSelection', 'zoom'];
const VIEW_DEFS = {
  top: { title: 'Top view', label: 'Top', icon: faceIcon('top') },
  iso: { title: 'Isometric view', label: 'ISO', icon: isoIcon() },
  side: { title: 'Right side view', label: 'Right', icon: faceIcon('right') },
  front: { title: 'Front view', label: 'Front', icon: faceIcon('front') },
  fit: { title: 'Fit all', label: 'Fit all', icon: cornersIcon() },
  fitSelection: { title: 'Fit selected object', label: 'Fit selected', icon: focusBoxIcon() },
  zoom: { title: 'Zoom tool', label: 'Zoom', icon: zoomIcon() },
  msr: { title: 'Measure tool', label: 'Measure', icon: measureIcon() }
};

runWhenReady(initViewCubeSvg);

function runWhenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function initViewCubeSvg() {
  injectStyles();
  normalizeViewPad();
  window.addEventListener('viewer:ui-score-changed', normalizeViewPad);
  window.addEventListener('resize', normalizeViewPad, { passive: true });
  window.__3D_MARKUP_STATIC_VIEWCUBE_SVG__ = { version: VERSION, refresh: normalizeViewPad };
}

function injectStyles() {
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .view-pad {
      position: absolute !important;
      top: 18px !important;
      right: 18px !important;
      z-index: 14 !important;
      width: auto !important;
      min-width: 0 !important;
      max-width: none !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      gap: 6px !important;
      padding: 8px 7px !important;
      border-radius: 18px !important;
      background: rgba(7, 18, 34, .90) !important;
      border: 1px solid rgba(91, 145, 210, .36) !important;
      box-shadow: 0 16px 36px rgba(0,0,0,.34) !important;
      backdrop-filter: blur(10px);
    }

    .view-pad::before {
      content: 'VIEW';
      display: block;
      writing-mode: vertical-rl;
      text-orientation: mixed;
      margin: 0 0 2px;
      color: rgba(184, 213, 244, .62);
      font-size: 8px;
      line-height: 1;
      font-weight: 950;
      letter-spacing: .16em;
    }

    .view-pad button {
      width: 38px !important;
      min-width: 38px !important;
      max-width: 38px !important;
      height: 38px !important;
      min-height: 38px !important;
      max-height: 38px !important;
      padding: 0 !important;
      display: inline-grid !important;
      place-items: center !important;
      border-radius: 11px !important;
      color: #dbeeff !important;
      background: linear-gradient(180deg, rgba(20, 47, 81, .96), rgba(11, 29, 51, .96)) !important;
      border: 1px solid rgba(110, 162, 225, .30) !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
      transition: transform .12s ease, border-color .12s ease, background .12s ease, color .12s ease;
    }

    .view-pad button:hover,
    .view-pad button:focus-visible {
      transform: translateX(-1px);
      border-color: rgba(88, 166, 255, .72) !important;
      color: #ffffff !important;
      background: linear-gradient(180deg, rgba(25, 91, 165, .98), rgba(14, 61, 119, .98)) !important;
      outline: none;
    }

    .view-pad button[data-view="iso"] {
      color: #ffffff !important;
      border-color: rgba(88, 166, 255, .72) !important;
      background: linear-gradient(180deg, rgba(23, 108, 200, .96), rgba(15, 63, 130, .96)) !important;
    }

    .view-pad button[data-view="fit"] {
      margin-top: 4px;
      border-top-color: rgba(255,255,255,.18) !important;
    }

    .view-pad button[data-view="msr"],
    .view-pad button[data-view="clip"] {
      display: none !important;
    }

    .view-pad .viewcube-icon {
      width: 19px;
      height: 19px;
      display: block;
      pointer-events: none;
    }

    .view-pad .viewcube-icon path,
    .view-pad .viewcube-icon rect,
    .view-pad .viewcube-icon polygon,
    .view-pad .viewcube-icon circle,
    .view-pad .viewcube-icon line,
    .view-pad .viewcube-icon polyline {
      vector-effect: non-scaling-stroke;
    }

    .view-pad .sr-only {
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
      .view-pad {
        top: 12px !important;
        right: 12px !important;
        gap: 5px !important;
        padding: 7px 6px !important;
      }
      .view-pad button {
        width: 34px !important;
        min-width: 34px !important;
        height: 34px !important;
        min-height: 34px !important;
      }
      .view-pad .viewcube-icon {
        width: 17px;
        height: 17px;
      }
    }
  `;
  document.head.appendChild(style);
}

function normalizeViewPad() {
  const pad = document.querySelector('.view-pad');
  if (!pad) return;
  pad.setAttribute('aria-label', 'Vertical view and navigation toolbar');
  reorderButtons(pad);
  pad.querySelectorAll('button[data-view]').forEach((button) => {
    const key = button.dataset.view;
    const def = VIEW_DEFS[key];
    if (!def) return;
    button.title = def.title;
    button.setAttribute('aria-label', def.title);
    button.innerHTML = `${def.icon}<span class="sr-only">${escapeHtml(def.label)}</span>`;
  });
}

function reorderButtons(pad) {
  const buttons = new Map();
  pad.querySelectorAll('button[data-view]').forEach((button) => buttons.set(button.dataset.view, button));
  VIEW_ORDER.forEach((key) => {
    const button = buttons.get(key);
    if (button) pad.appendChild(button);
  });
  ['clip', 'msr'].forEach((key) => {
    const button = buttons.get(key);
    if (button) pad.appendChild(button);
  });
}

function svg(content, viewBox = '0 0 24 24') {
  return `<svg class="viewcube-icon" viewBox="${viewBox}" aria-hidden="true" focusable="false" fill="none" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
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

function measureIcon() {
  return svg(`
    <path d="M5 17l12-12 2 2L7 19 5 17z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M9 15l-1-1M12 12l-1-1M15 9l-1-1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
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
