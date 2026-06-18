import './phase24b-ui-exposure-controller.js?v=phase30-origin-marquee-visible';

const LEGEND_ID = 'colorByLegendPanel';

function byId(id) {
  return document.getElementById(id);
}

function installStyles() {
  if (byId('colorByLegendVisibilityFixStyles')) return;
  const style = document.createElement('style');
  style.id = 'colorByLegendVisibilityFixStyles';
  style.textContent = `
    #${LEGEND_ID}.color-legend-panel {
      position: absolute !important;
      left: 18px !important;
      right: auto !important;
      top: auto !important;
      bottom: 76px !important;
      z-index: 7600 !important;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 160ms ease, transform 160ms ease;
      pointer-events: auto !important;
    }

    #${LEGEND_ID}.color-legend-panel.visible {
      display: flex !important;
      opacity: 1;
      transform: translateY(0);
    }

    body.props-open #${LEGEND_ID}.color-legend-panel {
      left: 18px !important;
      right: auto !important;
      bottom: 76px !important;
    }

    #${LEGEND_ID} .color-legend-title strong::after {
      content: ' / canvas';
      color: #7fa3c7;
      font-weight: 700;
      letter-spacing: 0.06em;
    }

    @media (max-width: 980px) {
      #${LEGEND_ID}.color-legend-panel {
        left: 12px !important;
        bottom: 66px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function getMode() {
  return byId('colorBySelect')?.value || 'default';
}

function reparentLegendToCanvas() {
  const viewer = byId('viewer');
  const panel = byId(LEGEND_ID);
  if (!viewer || !panel) return panel;
  if (panel.parentElement !== viewer) viewer.appendChild(panel);
  return panel;
}

function forceLegendVisible() {
  const mode = getMode();
  const panel = reparentLegendToCanvas();
  if (!panel) return;

  if (mode === 'default') {
    panel.classList.remove('visible');
    panel.dataset.userHidden = '';
    return;
  }

  panel.dataset.userHidden = '';
  panel.style.display = 'flex';
  panel.classList.add('visible');
}

function scheduleForce() {
  window.requestAnimationFrame(() => {
    reparentLegendToCanvas();
    forceLegendVisible();
    window.requestAnimationFrame(forceLegendVisible);
  });
}

function installColorLegendVisibilityFix() {
  installStyles();

  const select = byId('colorBySelect');
  select?.addEventListener('change', scheduleForce, true);
  window.addEventListener('markup:render-context', () => {
    if (getMode() !== 'default') scheduleForce();
  });
  window.addEventListener('resize', scheduleForce);

  const observer = new MutationObserver(() => {
    const panel = byId(LEGEND_ID);
    if (panel && getMode() !== 'default' && !panel.classList.contains('visible')) scheduleForce();
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });

  scheduleForce();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installColorLegendVisibilityFix, { once: true });
} else {
  installColorLegendVisibilityFix();
}
