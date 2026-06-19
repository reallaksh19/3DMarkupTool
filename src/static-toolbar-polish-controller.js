// Static toolbar label polish.
// Keeps the first-class static shell readable without re-enabling legacy toolbar controllers.

const STYLE_ID = 'static-toolbar-polish-style';
const VERSION = 'static-toolbar-label-polish-clipbox-20260618';

installToolbarPolish();

function installToolbarPolish() {
  injectToolbarStyle();
  annotateToolButtons();
  requestAnimationFrame(function () {
    annotateToolButtons();
    leftAnchorRibbon();
  });
  window.addEventListener('viewer:ui-score-changed', annotateToolButtons);
  window.addEventListener('viewer:static-clipbox-ready', annotateToolButtons);
  window.addEventListener('resize', leftAnchorRibbon, { passive: true });
  window.__3D_MARKUP_STATIC_TOOLBAR_POLISH__ = { version: VERSION, refresh: annotateToolButtons };
}

function injectToolbarStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .main-ribbon {
      max-width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      overscroll-behavior-inline: contain;
      scrollbar-gutter: stable;
    }

    .main-ribbon .tool-group {
      flex: 0 0 auto;
    }

    .main-ribbon .tool-btn {
      width: 70px;
      min-width: 70px;
      max-width: 70px;
      height: 56px;
      min-height: 56px;
      padding-inline: 5px;
      gap: 5px;
    }

    .main-ribbon .tool-btn[data-wide-label="true"] {
      width: 76px;
      min-width: 76px;
      max-width: 76px;
    }

    .main-ribbon .tool-btn[data-extra-wide-label="true"] {
      width: 84px;
      min-width: 84px;
      max-width: 84px;
    }

    .main-ribbon .tool-btn span {
      display: block;
      max-width: 100%;
      overflow: visible;
      text-overflow: clip;
      font-size: 11px;
      line-height: 1.05;
      letter-spacing: -0.035em;
      white-space: nowrap;
      text-align: center;
    }

    .main-ribbon .tool-btn .lucide {
      width: 19px;
      height: 19px;
      flex: 0 0 auto;
    }

    .topbar-actions .status-pill {
      white-space: nowrap;
    }

    @media (max-width: 1400px) {
      .main-ribbon .tool-btn {
        width: 66px;
        min-width: 66px;
        max-width: 66px;
      }
      .main-ribbon .tool-btn[data-wide-label="true"] {
        width: 72px;
        min-width: 72px;
        max-width: 72px;
      }
      .main-ribbon .tool-btn[data-extra-wide-label="true"] {
        width: 80px;
        min-width: 80px;
        max-width: 80px;
      }
      .main-ribbon .tool-btn span {
        font-size: 10.5px;
      }
    }
  `;
  document.head.appendChild(style);
}

function annotateToolButtons() {
  normalizeClipBoxButton();

  const buttons = Array.from(document.querySelectorAll('.main-ribbon .tool-btn'));
  buttons.forEach((button) => {
    const label = button.querySelector('span')?.textContent?.trim() || button.textContent?.trim() || button.id;
    if (label) {
      button.title = button.title || label;
      button.setAttribute('aria-label', button.getAttribute('aria-label') || label);
    }
    if (/measure|front|fit all|fit sel|clip off|grid off/i.test(label || '')) {
      button.dataset.wideLabel = 'true';
    }
    if (/clip box/i.test(label || '') || button.id === 'clipBoxToggleBtn') {
      button.dataset.extraWideLabel = 'true';
    }
  });
}

function normalizeClipBoxButton() {
  const button = document.getElementById('clipBoxToggleBtn');
  if (!button) return;
  let span = button.querySelector('span');
  if (!span) {
    span = document.createElement('span');
    button.appendChild(span);
  }
  span.textContent = 'Clip Box';
  button.title = 'Show 3D Clip Box controls';
  button.setAttribute('aria-label', 'Show 3D Clip Box controls');
  button.dataset.extraWideLabel = 'true';
}

function leftAnchorRibbon() {
  const ribbon = document.querySelector('.main-ribbon');
  if (!ribbon) return;
  if (document.documentElement.scrollLeft !== 0) document.documentElement.scrollLeft = 0;
  if (document.body.scrollLeft !== 0) document.body.scrollLeft = 0;
  if (ribbon.scrollLeft < 4) ribbon.scrollLeft = 0;
}