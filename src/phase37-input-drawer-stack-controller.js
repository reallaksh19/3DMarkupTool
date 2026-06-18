const STYLE_ID = 'phase37InputDrawerStackStyles';
const RETRIES = 36;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPhase37InputDrawerStack, { once: true });
} else {
  initPhase37InputDrawerStack();
}

window.addEventListener('markup:safe-ui-status', () => scheduleApply(14));
window.addEventListener('markup:two-row-icon-ribbon-ready', () => scheduleApply(14));
window.addEventListener('markup:app-ready', () => scheduleApply(14));
window.addEventListener('resize', () => scheduleApply(4));

function initPhase37InputDrawerStack() {
  injectStyles();
  scheduleApply(RETRIES);
}

function scheduleApply(remaining = 8) {
  window.requestAnimationFrame(() => {
    applyPhase37InputDrawerStack();
    if (remaining > 0) window.setTimeout(() => scheduleApply(remaining - 1), 120);
  });
}

function applyPhase37InputDrawerStack() {
  const drawer = document.getElementById('inputDrawer');
  if (!drawer) return;

  drawer.classList.add('phase37-drawer-stack');
  keepInputOpen(drawer);
  normalizeDrawerTitle(drawer);
  forceSectionOrder(drawer);
  closeOptionsByDefault(drawer);
}

function keepInputOpen(drawer) {
  drawer.classList.add('open');
  drawer.removeAttribute('hidden');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('input-open');

  const inputButton = document.getElementById('toggleInputBtn');
  inputButton?.classList.add('active');
  inputButton?.setAttribute('aria-pressed', 'true');
}

function normalizeDrawerTitle(drawer) {
  const title = drawer.querySelector('.drawer-head h2');
  if (title) title.textContent = 'Input / Export';

  const note = drawer.querySelector('.drawer-head p');
  if (note) note.textContent = 'Load InputXML, convert, then export GLB/RVM+ATT.';

  const close = document.getElementById('closeInputBtn');
  if (close) {
    close.innerHTML = '<span aria-hidden="true">×</span>';
    close.setAttribute('aria-label', 'Close input panel');
  }
}

function forceSectionOrder(drawer) {
  const head = drawer.querySelector(':scope > .drawer-head');
  const input = findSection(drawer, 'Input');
  const conversion = findSection(drawer, 'Conversion');
  const run = findSection(drawer, 'Run / Download');
  const log = findSection(drawer, 'Log');

  const ordered = [head, input, conversion, run, log].filter(Boolean);
  ordered.forEach((node) => {
    if (node.parentElement === drawer) drawer.appendChild(node);
  });

  drawer.querySelectorAll(':scope > .panel-section').forEach((section) => {
    section.classList.add('phase37-section-full');
    section.style.removeProperty('grid-column');
    section.style.removeProperty('grid-row');
    section.style.width = '100%';
  });
}

function closeOptionsByDefault(drawer) {
  const details = drawer.querySelector('#phase36ConversionOptions, #phase35ConversionOptions');
  if (details && !details.dataset.phase37UserOpened) {
    details.removeAttribute('open');
    const summary = details.querySelector('summary');
    if (summary && !summary.dataset.phase37OptionsHooked) {
      summary.dataset.phase37OptionsHooked = '1';
      summary.addEventListener('click', () => {
        details.dataset.phase37UserOpened = '1';
      }, { once: true });
    }
  }
}

function findSection(parent, headingText) {
  return Array.from(parent.querySelectorAll(':scope > .panel-section')).find((section) => {
    const heading = section.querySelector(':scope > h3');
    return heading && heading.textContent.trim().toLowerCase() === headingText.toLowerCase();
  });
}

function injectStyles() {
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Phase 37: make the Input drawer a strict vertical stack. */
    body.input-open #inputDrawer.phase37-drawer-stack,
    #inputDrawer.open.phase37-drawer-stack,
    #inputDrawer.phase37-drawer-stack {
      display: block !important;
      width: 378px !important;
      min-width: 320px !important;
      max-width: min(420px, calc(100vw - 32px)) !important;
      padding: 14px !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
      visibility: visible !important;
      opacity: 1 !important;
      transform: translateX(0) !important;
      box-sizing: border-box !important;
      contain: none !important;
    }

    #inputDrawer.phase37-drawer-stack > .drawer-head,
    #inputDrawer.phase37-drawer-stack > .panel-section {
      display: block !important;
      position: relative !important;
      float: none !important;
      clear: both !important;
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      height: auto !important;
      flex: none !important;
      grid-column: auto !important;
      grid-row: auto !important;
      margin-left: 0 !important;
      margin-right: 0 !important;
      transform: none !important;
      box-sizing: border-box !important;
    }

    #inputDrawer.phase37-drawer-stack > .drawer-head {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) 32px !important;
      gap: 10px !important;
      align-items: start !important;
      margin: 0 0 10px !important;
      padding: 0 0 10px !important;
      border-bottom: 1px solid rgba(255,255,255,.08) !important;
    }

    #inputDrawer.phase37-drawer-stack > .panel-section {
      padding: 12px 0 !important;
      border-top: 0 !important;
      border-bottom: 1px solid rgba(255,255,255,.08) !important;
    }

    #inputDrawer.phase37-drawer-stack > .panel-section[hidden],
    #inputDrawer.phase37-drawer-stack > .panel-section[style*="display: none"] {
      display: none !important;
    }

    #inputDrawer.phase37-drawer-stack .drawer-head h2 {
      margin: 0 !important;
      font-size: 16px !important;
      line-height: 1.12 !important;
      white-space: normal !important;
    }

    #inputDrawer.phase37-drawer-stack .drawer-head p {
      margin: 4px 0 0 !important;
      font-size: 11px !important;
      line-height: 1.35 !important;
      color: #a9bed4 !important;
      white-space: normal !important;
    }

    #inputDrawer.phase37-drawer-stack .panel-section h3 {
      display: block !important;
      margin: 0 0 9px !important;
      color: #5ee6ff !important;
      font-size: 12px !important;
      font-weight: 950 !important;
      letter-spacing: .04em !important;
      white-space: nowrap !important;
    }

    #inputDrawer.phase37-drawer-stack .button-row {
      display: flex !important;
      flex-direction: row !important;
      flex-wrap: wrap !important;
      gap: 8px !important;
      width: 100% !important;
      max-width: 100% !important;
    }

    #inputDrawer.phase37-drawer-stack .button-row > button {
      min-width: 0 !important;
      flex: 1 1 140px !important;
      white-space: normal !important;
    }

    #inputDrawer.phase37-drawer-stack #loadSampleBtn,
    #inputDrawer.phase37-drawer-stack #clearBtn {
      min-height: 40px !important;
    }

    #inputDrawer.phase37-drawer-stack #convertBtn,
    #inputDrawer.phase37-drawer-stack #viewRulesBtn {
      flex: 1 1 160px !important;
      min-height: 40px !important;
    }

    #inputDrawer.phase37-drawer-stack .download-grid {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 8px !important;
      width: 100% !important;
      max-width: 100% !important;
      margin-top: 10px !important;
    }

    #inputDrawer.phase37-drawer-stack .download-grid > button {
      min-width: 0 !important;
      width: 100% !important;
      min-height: 40px !important;
      white-space: normal !important;
      justify-content: center !important;
    }

    #inputDrawer.phase37-drawer-stack .file-drop {
      display: grid !important;
      grid-template-columns: 28px minmax(0, 1fr) !important;
      align-items: center !important;
      gap: 8px !important;
      width: 100% !important;
      max-width: 100% !important;
      min-height: 42px !important;
      margin-bottom: 10px !important;
    }

    #inputDrawer.phase37-drawer-stack .file-drop span {
      min-width: 0 !important;
      white-space: normal !important;
    }

    #inputDrawer.phase37-drawer-stack .phase36-options-details,
    #inputDrawer.phase37-drawer-stack .phase35-options-details {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 0 10px !important;
      box-sizing: border-box !important;
    }

    #inputDrawer.phase37-drawer-stack .phase36-options-details > summary,
    #inputDrawer.phase37-drawer-stack .phase35-options-details > summary {
      min-height: 38px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 10px !important;
      width: 100% !important;
      box-sizing: border-box !important;
      list-style: none !important;
    }

    #inputDrawer.phase37-drawer-stack .phase36-options-body,
    #inputDrawer.phase37-drawer-stack .phase35-options-body {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 9px !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    #inputDrawer.phase37-drawer-stack .field,
    #inputDrawer.phase37-drawer-stack .check-grid,
    #inputDrawer.phase37-drawer-stack .rvm-profile-field,
    #inputDrawer.phase37-drawer-stack textarea,
    #inputDrawer.phase37-drawer-stack select,
    #inputDrawer.phase37-drawer-stack input[type='text'],
    #inputDrawer.phase37-drawer-stack input[type='number'] {
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
  `;
  document.head.appendChild(style);
}
