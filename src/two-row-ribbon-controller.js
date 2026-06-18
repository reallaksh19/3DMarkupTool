const PRIMARY_GROUP_SELECTORS = [
  '.primary-tools',
  '[aria-label="View tools"]',
  '[aria-label="Review tools"]'
];

const SECONDARY_GROUP_SELECTORS = [
  '.color-control',
  '.panel-tools',
  '[aria-label="Preview mode"]',
  '.navis-tag-tools',
  '#runtimeStatus'
];

const state = {
  observer: null,
  applying: false,
  timer: null
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initTwoRowRibbon, { once: true });
} else {
  initTwoRowRibbon();
}

function initTwoRowRibbon() {
  document.body.classList.add('two-row-professional-shell');
  injectStyles();
  applyTwoRowRibbon();
  startObserver();
  startShortTimer();
}

function startObserver() {
  if (state.observer) return;
  const toolbar = document.querySelector('.toolbar');
  if (!toolbar) return;

  state.observer = new MutationObserver(() => {
    if (state.applying) return;
    window.requestAnimationFrame(applyTwoRowRibbon);
  });
  state.observer.observe(toolbar, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'id', 'aria-label'] });
}

function startShortTimer() {
  let ticks = 0;
  state.timer = setInterval(() => {
    applyTwoRowRibbon();
    ticks += 1;
    if (ticks > 18) clearInterval(state.timer);
  }, 450);
}

function applyTwoRowRibbon() {
  const toolbar = document.querySelector('.toolbar');
  if (!toolbar) return;

  state.applying = true;
  try {
    toolbar.classList.add('two-row-ribbon');
    const primaryRow = ensureRow(toolbar, 'primary');
    const secondaryRow = ensureRow(toolbar, 'secondary');

    for (const selector of PRIMARY_GROUP_SELECTORS) {
      const group = resolveGroup(selector);
      if (group) primaryRow.appendChild(group);
    }

    for (const selector of SECONDARY_GROUP_SELECTORS) {
      const group = resolveGroup(selector);
      if (group) secondaryRow.appendChild(group);
    }

    moveUnassignedToolbarGroups(toolbar, primaryRow, secondaryRow);
    updateRowState(primaryRow, secondaryRow);
  } finally {
    state.applying = false;
  }
}

function ensureRow(toolbar, type) {
  const id = `professionalRibbon${capitalize(type)}Row`;
  let row = document.getElementById(id);
  if (!row) {
    row = document.createElement('div');
    row.id = id;
    row.className = `professional-ribbon-row professional-ribbon-row-${type}`;
    row.dataset.rowLabel = type === 'primary' ? 'Viewer Controls' : 'Review / Output';
    toolbar.appendChild(row);
  }
  return row;
}

function resolveGroup(selector) {
  const anchor = document.querySelector(selector);
  if (!anchor) return null;
  if (anchor.classList?.contains('toolbar-group')) return anchor;
  if (anchor.classList?.contains('color-control')) return anchor;
  if (anchor.classList?.contains('status-pill')) return anchor;
  const group = anchor.closest?.('.toolbar-group, .color-control, .status-pill');
  return group || anchor;
}

function moveUnassignedToolbarGroups(toolbar, primaryRow, secondaryRow) {
  const rows = new Set([primaryRow, secondaryRow]);
  const directChildren = Array.from(toolbar.children).filter((child) => !rows.has(child));
  for (const child of directChildren) {
    if (child.classList?.contains('professional-ribbon-row')) continue;
    if (isSecondaryLike(child)) secondaryRow.appendChild(child);
    else primaryRow.appendChild(child);
  }
}

function isSecondaryLike(element) {
  const label = String(element.getAttribute?.('aria-label') || '').toLowerCase();
  const className = String(element.className || '').toLowerCase();
  const id = String(element.id || '').toLowerCase();
  return label.includes('preview') ||
    label.includes('panel') ||
    label.includes('tag') ||
    className.includes('panel') ||
    className.includes('tag') ||
    className.includes('color') ||
    className.includes('status') ||
    id.includes('status');
}

function updateRowState(primaryRow, secondaryRow) {
  primaryRow.classList.toggle('is-empty', primaryRow.children.length === 0);
  secondaryRow.classList.toggle('is-empty', secondaryRow.children.length === 0);
}

function capitalize(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function injectStyles() {
  if (document.getElementById('twoRowRibbonStyles')) return;
  const style = document.createElement('style');
  style.id = 'twoRowRibbonStyles';
  style.textContent = `
    body.two-row-professional-shell .viewer-topbar {
      min-height: 118px;
      grid-template-columns: minmax(230px, 315px) minmax(0, 1fr);
      gap: 12px;
      padding: 9px 14px;
    }

    body.two-row-professional-shell .brand-block {
      padding-block: 8px;
    }

    body.two-row-professional-shell .brand-subtitle {
      max-width: 300px;
      font-size: 11px;
      line-height: 1.25;
    }

    body.two-row-professional-shell .brand-meta-row {
      margin-top: 7px;
    }

    body.two-row-professional-shell .toolbar.professional-ribbon.two-row-ribbon {
      display: grid;
      grid-template-rows: auto auto;
      align-content: center;
      justify-content: stretch;
      gap: 7px;
      width: 100%;
      min-width: 0;
    }

    body.two-row-professional-shell .professional-ribbon-row {
      position: relative;
      display: flex;
      align-items: stretch;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 7px;
      min-width: 0;
      width: 100%;
    }

    body.two-row-professional-shell .professional-ribbon-row::before {
      content: attr(data-row-label);
      align-self: center;
      margin-right: auto;
      min-width: 108px;
      color: rgba(170, 193, 220, .78);
      font-size: 9px;
      font-weight: 950;
      letter-spacing: 1.35px;
      text-transform: uppercase;
      white-space: nowrap;
    }

    body.two-row-professional-shell .professional-ribbon-row.is-empty {
      display: none;
    }

    body.two-row-professional-shell .toolbar-group,
    body.two-row-professional-shell .color-control,
    body.two-row-professional-shell .status-pill {
      min-height: 43px;
      padding: 16px 7px 6px;
      border-radius: 12px;
    }

    body.two-row-professional-shell .professional-ribbon-row-secondary .toolbar-group,
    body.two-row-professional-shell .professional-ribbon-row-secondary .color-control,
    body.two-row-professional-shell .professional-ribbon-row-secondary .status-pill {
      min-height: 40px;
      padding-top: 15px;
      background: linear-gradient(180deg, rgba(18, 31, 49, .72), rgba(10, 20, 34, .68));
    }

    body.two-row-professional-shell .toolbar-group::before,
    body.two-row-professional-shell .color-control::before,
    body.two-row-professional-shell .status-pill::before {
      top: 5px;
      left: 9px;
      font-size: 8px;
      letter-spacing: .8px;
    }

    body.two-row-professional-shell .tool-btn {
      height: 27px;
      min-height: 27px;
      min-width: 38px;
      padding: 5px 9px;
      border-radius: 8px;
      font-size: 10.5px;
    }

    body.two-row-professional-shell .toolbar-group[aria-label='View tools'] .tool-btn:not(.accent) {
      min-width: 48px;
    }

    body.two-row-professional-shell .toolbar-group[aria-label='Preview mode'] .tool-btn {
      min-width: 47px;
    }

    body.two-row-professional-shell .color-control {
      grid-template-columns: auto minmax(128px, 150px);
      gap: 7px;
      align-items: end;
    }

    body.two-row-professional-shell .color-control select {
      height: 27px;
      min-width: 128px;
      font-size: 11px;
    }

    body.two-row-professional-shell .color-control span {
      font-size: 10.5px;
    }

    body.two-row-professional-shell .status-pill {
      min-width: 100px;
      min-height: 40px;
      padding: 16px 10px 6px;
      font-size: 11px;
    }

    body.two-row-professional-shell .viewer-shell {
      height: calc(100vh - 118px);
    }

    body.two-row-professional-shell .navis-tags-menu {
      top: calc(100% + 7px);
    }

    @media (max-width: 1540px) {
      body.two-row-professional-shell .viewer-topbar {
        grid-template-columns: minmax(190px, 255px) minmax(0, 1fr);
        min-height: 114px;
        gap: 9px;
        padding: 8px 10px;
      }

      body.two-row-professional-shell h1 {
        font-size: 18px;
      }

      body.two-row-professional-shell .professional-ribbon-row::before {
        display: none;
      }

      body.two-row-professional-shell .toolbar-group,
      body.two-row-professional-shell .color-control,
      body.two-row-professional-shell .status-pill {
        min-height: 40px;
      }

      body.two-row-professional-shell .tool-btn {
        padding-left: 7px;
        padding-right: 7px;
      }

      body.two-row-professional-shell .viewer-shell {
        height: calc(100vh - 114px);
      }
    }

    @media (max-width: 1080px) {
      body.two-row-professional-shell .viewer-topbar {
        grid-template-columns: 1fr;
        min-height: auto;
      }

      body.two-row-professional-shell .professional-ribbon-row {
        justify-content: flex-start;
      }

      body.two-row-professional-shell .viewer-shell {
        height: calc(100vh - 186px);
      }
    }
  `;
  document.head.appendChild(style);
}
