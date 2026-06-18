const MENU_TARGETS = {
  export: ['previewGlbBtn', 'previewRvmBtn', 'rvmCompatBtn'],
  tags: ['navisTagBtn', 'navisIsonoteBtn', 'navisImportTagsBtn', 'navisTagViewsBtn'],
  session: ['navisSaveTagSessionBtn', 'navisRestoreTagSessionBtn', 'navisClearTagSessionBtn'],
  xml: ['navisXmlQaBtn', 'navisExportTagsBtn']
};

const state = {
  observer: null,
  scheduled: false,
  initialClosed: false
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRibbonMenuPolish, { once: true });
} else {
  initRibbonMenuPolish();
}

window.addEventListener('markup:two-row-icon-ribbon-ready', () => schedulePolish());
window.addEventListener('markup:safe-ui-status', () => schedulePolish());
window.addEventListener('markup:toolbar-optimized', () => schedulePolish());

document.addEventListener('click', (event) => {
  if (event.target?.closest?.('.two-row-menu-trigger, .two-row-menu-item')) {
    window.setTimeout(syncMenuHiddenState, 0);
  }
}, true);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') window.setTimeout(syncMenuHiddenState, 0);
}, true);

function initRibbonMenuPolish() {
  injectStyles();
  schedulePolish(18);
  installObserver();

  window.__3D_MARKUP_RIBBON_MENU_POLISH__ = {
    polish: () => runPolishCycle(),
    closeMenus,
    syncMenuHiddenState,
    relocateLateMenuButtons
  };
}

function schedulePolish(retries = 6) {
  if (state.scheduled) return;
  state.scheduled = true;

  const run = (remaining) => {
    window.requestAnimationFrame(() => {
      state.scheduled = false;
      runPolishCycle();
      if (remaining > 0) window.setTimeout(() => schedulePolish(remaining - 1), 130);
    });
  };

  run(retries);
}

function runPolishCycle() {
  relocateLateMenuButtons();

  if (!state.initialClosed) {
    closeMenus();
    state.initialClosed = true;
  }

  syncMenuHiddenState();
  hideStaleRows();
}

function relocateLateMenuButtons() {
  const ribbon = document.getElementById('twoRowCommandRibbon');
  if (!ribbon) return;

  Object.entries(MENU_TARGETS).forEach(([menuKey, ids]) => {
    const menu = document.getElementById(`twoRowMenu_${menuKey}`);
    const popover = menu?.querySelector?.(':scope > .two-row-menu-popover');
    if (!popover) return;

    ids.forEach((id) => {
      const button = document.getElementById(id);
      if (!button || button.parentElement === popover) return;
      if (!button.classList.contains('two-row-menu-item')) button.classList.add('two-row-menu-item');
      button.setAttribute('role', 'menuitem');
      popover.appendChild(button);
    });
  });
}

function closeMenus() {
  document.querySelectorAll('.two-row-menu.open').forEach((menu) => {
    menu.classList.remove('open');
    menu.querySelector(':scope > .two-row-menu-trigger')?.setAttribute('aria-expanded', 'false');
  });
  syncMenuHiddenState();
}

function syncMenuHiddenState() {
  document.querySelectorAll('.two-row-menu').forEach((menu) => {
    const open = menu.classList.contains('open');
    const trigger = menu.querySelector(':scope > .two-row-menu-trigger');
    const popover = menu.querySelector(':scope > .two-row-menu-popover');

    trigger?.setAttribute('aria-expanded', String(open));
    if (popover) {
      popover.hidden = !open;
      popover.setAttribute('aria-hidden', String(!open));
      popover.style.pointerEvents = open ? 'auto' : 'none';
    }
  });
}

function hideStaleRows() {
  if (!document.body.classList.contains('two-row-ribbon-ready')) return;

  document.querySelectorAll('#toolbarSecondaryRow, .toolbar-secondary-row').forEach((row) => {
    row.classList.add('two-row-obsolete-row');
    row.setAttribute('aria-hidden', 'true');
  });

  document.querySelectorAll('.tag-lite-host, .navis-tag-tools').forEach((group) => {
    if (group.closest('.two-row-menu-popover')) return;
    if (group.querySelector('button')) return;
    group.classList.add('two-row-obsolete-row');
    group.setAttribute('aria-hidden', 'true');
  });
}

function installObserver() {
  if (state.observer) return;

  state.observer = new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => {
      if (mutation.type === 'attributes') return mutation.target?.classList?.contains?.('two-row-menu');
      return [...mutation.addedNodes || []].some((node) => node.nodeType === 1 && (
        node.matches?.('.two-row-menu, .two-row-menu-popover, .toolbar-secondary-row, .navis-tag-tools, .tag-lite-host')
          || node.querySelector?.('.two-row-menu, .two-row-menu-popover, .toolbar-secondary-row, .navis-tag-tools, .tag-lite-host')
      ));
    });

    if (relevant) schedulePolish(2);
  });

  state.observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });
}

function injectStyles() {
  if (document.getElementById('ribbonMenuPolishStyles')) return;

  const style = document.createElement('style');
  style.id = 'ribbonMenuPolishStyles';
  style.textContent = `
    body.two-row-ribbon-ready .two-row-obsolete-row {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
      width: 0 !important;
      height: 0 !important;
      min-width: 0 !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
    }

    body.two-row-ribbon-ready .two-row-menu-popover[hidden] {
      display: none !important;
      pointer-events: none !important;
    }

    body.two-row-ribbon-ready .two-row-menu.open .two-row-menu-popover:not([hidden]) {
      display: flex !important;
      pointer-events: auto !important;
    }
  `;
  document.head.appendChild(style);
}
