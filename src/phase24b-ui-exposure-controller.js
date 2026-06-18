const IDS = {
  origin: 'originManagerBtn',
  marquee: 'marqueeZoomBtn',
  legend: 'colorByLegendPanel',
  select: 'colorBySelect'
};

const state = {
  installed: false,
  refreshTimer: null
};

function byId(id) {
  return document.getElementById(id);
}

function installStyles() {
  if (byId('phase24bUiExposureStyles')) return;
  const style = document.createElement('style');
  style.id = 'phase24bUiExposureStyles';
  style.textContent = `
    .phase24b-review-group {
      display: inline-flex !important;
      align-items: end;
      gap: 6px;
    }

    .phase24b-review-group::before {
      content: 'Inspect' !important;
    }

    #${IDS.origin}, #${IDS.marquee} {
      display: inline-flex !important;
      visibility: visible !important;
      opacity: 1 !important;
    }

    #${IDS.origin}.phase24b-attention {
      border-color: rgba(255, 209, 102, .92) !important;
      background: rgba(255, 178, 54, .18) !important;
      color: #fff2c6 !important;
      box-shadow: 0 0 0 1px rgba(255,209,102,.18), 0 6px 18px rgba(0,0,0,.25);
    }

    #${IDS.marquee}.active,
    #${IDS.marquee}[aria-pressed='true'] {
      border-color: rgba(255, 209, 102, .92) !important;
      background: rgba(255, 178, 54, .2) !important;
      color: #fff2c6 !important;
    }

    #phase24bLegendPlaceholder {
      position: absolute;
      left: 18px;
      bottom: 76px;
      z-index: 7590;
      display: none;
      max-width: 280px;
      border: 1px solid rgba(114, 178, 245, .32);
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(8,19,31,.95), rgba(6,13,22,.92));
      color: #dbeafe;
      padding: 10px 12px;
      font-size: 11px;
      box-shadow: 0 18px 44px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.05);
      pointer-events: none;
    }

    #phase24bLegendPlaceholder.visible {
      display: block;
    }

    #phase24bLegendPlaceholder strong {
      display: block;
      color: #ffffff;
      font-size: 11px;
      letter-spacing: .08em;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    #phase24bLegendPlaceholder span {
      color: #9fb3c8;
      line-height: 1.35;
    }

    body.props-open #phase24bLegendPlaceholder {
      left: 18px;
      bottom: 76px;
    }
  `;
  document.head.appendChild(style);
}

function getToolbarInsertionPoint() {
  const primaryRow = byId('professionalRibbonPrimaryRow');
  const toolbar = document.querySelector('.toolbar');
  return primaryRow || toolbar;
}

function ensureReviewGroup() {
  let group = document.querySelector('.phase24b-review-group');
  if (group) return group;

  group = document.createElement('div');
  group.className = 'toolbar-group phase24b-review-group';
  group.setAttribute('aria-label', 'Inspect tools');

  const anchor = document.querySelector('[aria-label="Fit tools"], #fitSelectionBtn')?.closest?.('.toolbar-group') || byId('fitSelectionBtn');
  if (anchor?.parentElement) anchor.insertAdjacentElement('afterend', group);
  else getToolbarInsertionPoint()?.appendChild(group);
  return group;
}

function appendOnce(parent, child) {
  if (!parent || !child) return;
  if (child.parentElement === parent) return;
  parent.appendChild(child);
}

function ensureOriginButton() {
  let button = byId(IDS.origin);
  if (!button) {
    button = document.createElement('button');
    button.id = IDS.origin;
    button.type = 'button';
    button.className = 'tool-btn icon-text phase24b-attention';
    button.title = 'Origin Manager: review/apply display-only non-overlap offsets';
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<span aria-hidden="true">◎</span><span>Origins</span>';
    button.addEventListener('click', () => {
      const panel = byId('originManagerPanel');
      if (panel) {
        const visible = !panel.classList.contains('visible');
        panel.classList.toggle('visible', visible);
        button.classList.toggle('active', visible);
        button.setAttribute('aria-expanded', String(visible));
      }
      setStatus('Origin Manager opened');
    });
  }
  button.classList.add('phase24b-attention');
  appendOnce(ensureReviewGroup(), button);
  return button;
}

function ensureMarqueeButton() {
  let button = byId(IDS.marquee);
  if (!button) {
    button = document.createElement('button');
    button.id = IDS.marquee;
    button.type = 'button';
    button.className = 'tool-btn icon-text';
    button.title = 'Marquee Zoom: drag a rectangle (Z)';
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = '<span aria-hidden="true">▣</span><span>Marquee</span>';
  }
  appendOnce(ensureReviewGroup(), button);
  return button;
}

function ensureLegendPlaceholder() {
  let placeholder = byId('phase24bLegendPlaceholder');
  if (placeholder) return placeholder;
  placeholder = document.createElement('div');
  placeholder.id = 'phase24bLegendPlaceholder';
  placeholder.innerHTML = '<strong>Color Legend</strong><span>Change Color By mode to build the legend from visible model colors.</span>';
  (byId('viewer') || document.body).appendChild(placeholder);
  return placeholder;
}

function colorMode() {
  return byId(IDS.select)?.value || 'default';
}

function refreshLegendExposure() {
  const mode = colorMode();
  const placeholder = ensureLegendPlaceholder();
  const legend = byId(IDS.legend);
  const active = mode !== 'default';

  if (!active) {
    placeholder.classList.remove('visible');
    return;
  }

  if (legend && legend.textContent.trim()) {
    placeholder.classList.remove('visible');
  } else {
    const span = placeholder.querySelector('span');
    if (span) span.textContent = `Color By is set to ${labelForMode(mode)}. Legend data is being prepared from visible objects.`;
    placeholder.classList.add('visible');
  }
}

function labelForMode(mode) {
  return String(mode || 'default')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function setStatus(message) {
  const pill = byId('runtimeStatus');
  if (pill) pill.textContent = message;
}

function exposePhase24Ui() {
  installStyles();
  ensureOriginButton();
  ensureMarqueeButton();
  ensureLegendPlaceholder();
  refreshLegendExposure();
}

function scheduleExpose(delay = 0) {
  window.clearTimeout(state.refreshTimer);
  state.refreshTimer = window.setTimeout(exposePhase24Ui, delay);
}

function install() {
  if (state.installed) return;
  state.installed = true;

  exposePhase24Ui();

  byId(IDS.select)?.addEventListener('change', () => {
    window.setTimeout(refreshLegendExposure, 80);
    window.setTimeout(refreshLegendExposure, 320);
  }, true);

  window.addEventListener('markup:render-context', () => {
    scheduleExpose(120);
  });

  // Bounded startup retries only. Do not observe/mutate the toolbar subtree continuously;
  // moving buttons while observing the same subtree can create a DOM mutation loop.
  [250, 900, 1800].forEach((delay) => window.setTimeout(exposePhase24Ui, delay));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}
