const STYLE_ID = 'phase35UiCleanupStyles';
const RETRIES = 24;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPhase35Cleanup, { once: true });
} else {
  initPhase35Cleanup();
}

window.addEventListener('markup:safe-ui-status', () => scheduleApply(10));
window.addEventListener('markup:two-row-icon-ribbon-ready', () => scheduleApply(10));
window.addEventListener('markup:app-ready', () => scheduleApply(10));

function initPhase35Cleanup() {
  injectStyles();
  scheduleApply(RETRIES);
}

function scheduleApply(remaining = 8) {
  window.requestAnimationFrame(() => {
    applyPhase35Cleanup();
    if (remaining > 0) window.setTimeout(() => scheduleApply(remaining - 1), 140);
  });
}

function applyPhase35Cleanup() {
  hideStartupContextMenu();
  keepInputPanelOpen();
  collapseInputOptions();
  polishRibbonButtons();
}

function hideStartupContextMenu() {
  const menu = document.getElementById('visibilityContextMenu');
  if (!menu) return;

  if (!menu.classList.contains('open')) {
    menu.hidden = true;
    menu.style.left = '';
    menu.style.top = '';
  }
}

function keepInputPanelOpen() {
  const drawer = document.getElementById('inputDrawer');
  const inputButton = document.getElementById('toggleInputBtn');
  if (!drawer) return;

  drawer.classList.add('open');
  drawer.removeAttribute('hidden');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('input-open');
  inputButton?.classList.add('active');
  inputButton?.setAttribute('aria-pressed', 'true');
}

function collapseInputOptions() {
  const drawer = document.getElementById('inputDrawer');
  if (!drawer) return;

  const conversionSection = findSection(drawer, 'Conversion');
  if (!conversionSection) return;

  conversionSection.classList.add('phase35-conversion-section');
  const details = ensureOptionsDetails(conversionSection);
  const body = details.querySelector('.phase35-options-body');

  Array.from(conversionSection.children).forEach((child) => {
    if (child.matches?.('h3') || child === details) return;
    body.appendChild(child);
  });

  moveSideloadIntoOptions(drawer, body);
  moveLooseRvmProfileIntoOptions(conversionSection, body);
}

function ensureOptionsDetails(section) {
  let details = section.querySelector(':scope > #phase35ConversionOptions');
  if (details) return details;

  details = document.createElement('details');
  details.id = 'phase35ConversionOptions';
  details.className = 'phase35-options-details';

  const summary = document.createElement('summary');
  summary.innerHTML = '<span>Options</span><b aria-hidden="true">â€º</b>';
  details.appendChild(summary);

  const body = document.createElement('div');
  body.className = 'phase35-options-body';
  details.appendChild(body);

  section.appendChild(details);
  return details;
}

function moveSideloadIntoOptions(drawer, optionsBody) {
  const sideload = findSection(drawer, 'Sideload Data');
  if (!sideload || sideload.dataset.phase35Moved === 'true') return;

  const group = document.createElement('div');
  group.className = 'phase35-options-subgroup';
  group.innerHTML = '<h4>Sideload data</h4>';

  Array.from(sideload.children).forEach((child) => {
    if (child.matches?.('h3')) return;
    group.appendChild(child);
  });

  if (group.children.length > 1) optionsBody.appendChild(group);
  sideload.dataset.phase35Moved = 'true';
  sideload.hidden = true;
  sideload.style.display = 'none';
}

function moveLooseRvmProfileIntoOptions(section, optionsBody) {
  // RVM strict/profile controls are injected by another safe module after page load.
  // Keep them under Options if they appear later.
  Array.from(section.children).forEach((child) => {
    if (child.matches?.('h3') || child.id === 'phase35ConversionOptions') return;
    optionsBody.appendChild(child);
  });
}

function findSection(parent, headingText) {
  return Array.from(parent.querySelectorAll('.panel-section')).find((section) => {
    const heading = section.querySelector('h3');
    return heading && heading.textContent.trim().toLowerCase() === headingText.toLowerCase();
  });
}

function polishRibbonButtons() {
  const importButton = document.getElementById('navisImportTagsBtn');
  if (importButton) {
    replaceButtonIcon(importButton, 'import-clear');
    importButton.title = 'Import XML';
    importButton.setAttribute('aria-label', 'Import XML');
  }

  const clipButton = document.getElementById('clipBtn');
  if (clipButton) {
    replaceButtonIcon(clipButton, 'clip-plane');
    clipButton.title = /on/i.test(clipButton.textContent || '') ? 'Clip On' : 'Clip Off';
    clipButton.setAttribute('aria-label', clipButton.title);
  }
}

function replaceButtonIcon(button, iconName) {
  const iconSlot = button.querySelector('.two-row-svg');
  if (!iconSlot) return;
  iconSlot.innerHTML = iconSvg(iconName);
  iconSlot.dataset.phase35Icon = iconName;
}

function iconSvg(name) {
  const paths = {
    'import-clear': '<path d="M12 3v11"/><path d="M7.5 9.5L12 14l4.5-4.5"/><path d="M5 19h14"/><path d="M7 16h10"/>',
    'clip-plane': '<path d="M4 7h16"/><path d="M7 4l10 16"/><path d="M7 20h10"/><circle cx="7" cy="7" r="1.6"/><circle cx="17" cy="17" r="1.6"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths['import-clear']}</svg>`;
}

function injectStyles() {
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Hide right-click visibility menu until it is actually opened. */
    #visibilityContextMenu:not(.open),
    .visibility-context-menu:not(.open) {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }

    /* Keep Input visible on startup and protect it from layout recovery side effects. */
    body.input-open #inputDrawer,
    #inputDrawer.open {
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
    }

    /* Input drawer options collapse. */
    #inputDrawer .phase35-options-details {
      margin-top: 10px !important;
      border: 1px solid rgba(92, 143, 196, .55) !important;
      border-radius: 12px !important;
      background: rgba(10, 29, 48, .72) !important;
      overflow: hidden !important;
    }

    #inputDrawer .phase35-options-details > summary {
      min-height: 36px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 10px !important;
      padding: 0 12px !important;
      cursor: pointer !important;
      color: #eef6ff !important;
      font-size: 13px !important;
      font-weight: 950 !important;
      list-style: none !important;
      user-select: none !important;
    }

    #inputDrawer .phase35-options-details > summary::-webkit-details-marker { display: none !important; }

    #inputDrawer .phase35-options-details > summary b {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 20px !important;
      height: 20px !important;
      border-radius: 999px !important;
      color: #9bd1ff !important;
      background: rgba(52, 94, 137, .42) !important;
      transition: transform .16s ease !important;
    }

    #inputDrawer .phase35-options-details[open] > summary b {
      transform: rotate(90deg) !important;
    }

    #inputDrawer .phase35-options-body {
      display: grid !important;
      gap: 10px !important;
      padding: 11px 12px 13px !important;
      border-top: 1px solid rgba(92, 143, 196, .22) !important;
    }

    #inputDrawer .phase35-options-subgroup {
      display: grid !important;
      gap: 8px !important;
      margin-top: 4px !important;
      padding-top: 8px !important;
      border-top: 1px dashed rgba(119, 165, 214, .28) !important;
    }

    #inputDrawer .phase35-options-subgroup h4 {
      margin: 0 !important;
      color: #72dcff !important;
      font-size: 11px !important;
      font-weight: 950 !important;
      letter-spacing: .04em !important;
      text-transform: uppercase !important;
    }

    /* Scale second-row command icons by approximately 1.5x. */
    body.two-row-ribbon-ready .app-shell.two-row-icon-shell {
      height: 128px !important;
      min-height: 128px !important;
      max-height: 128px !important;
      grid-template-rows: 42px 70px !important;
    }

    body.two-row-ribbon-ready .toolbar.two-row-command-bar {
      height: 70px !important;
      min-height: 70px !important;
    }

    body.two-row-ribbon-ready .two-row-command-ribbon {
      height: 64px !important;
      min-height: 64px !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 6px 8px !important;
    }

    body.two-row-ribbon-ready .two-row-command-group,
    body.two-row-ribbon-ready .two-row-menu {
      height: 52px !important;
      min-height: 52px !important;
      padding: 4px 6px !important;
      gap: 5px !important;
    }

    body.two-row-ribbon-ready .two-row-icon-button.two-row-command-button {
      width: 42px !important;
      height: 42px !important;
      min-width: 42px !important;
      min-height: 42px !important;
      border-radius: 12px !important;
    }

    body.two-row-ribbon-ready .two-row-icon-button.two-row-command-button .two-row-svg {
      width: 25px !important;
      height: 25px !important;
    }

    body.two-row-ribbon-ready .two-row-menu-trigger {
      height: 42px !important;
      min-height: 42px !important;
      padding: 0 12px !important;
      border-radius: 12px !important;
      font-size: 11px !important;
    }

    body.two-row-ribbon-ready .two-row-menu-trigger .two-row-svg {
      width: 22px !important;
      height: 22px !important;
    }

    body.two-row-ribbon-ready .two-row-color-control {
      height: 42px !important;
      min-height: 42px !important;
      min-width: 190px !important;
      max-width: 210px !important;
      border-radius: 12px !important;
    }

    body.two-row-ribbon-ready .two-row-color-control .two-row-svg {
      width: 20px !important;
      height: 20px !important;
    }

    body.two-row-ribbon-ready .two-row-color-control select {
      height: 30px !important;
      font-size: 11px !important;
    }
  `;
  document.head.appendChild(style);
}
