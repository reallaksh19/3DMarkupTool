const STYLE_ID = 'phase36InputDrawerFixStyles';
const RETRIES = 28;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPhase36InputDrawerFix, { once: true });
} else {
  initPhase36InputDrawerFix();
}

window.addEventListener('markup:safe-ui-status', () => scheduleApply(12));
window.addEventListener('markup:two-row-icon-ribbon-ready', () => scheduleApply(12));
window.addEventListener('markup:app-ready', () => scheduleApply(12));

function initPhase36InputDrawerFix() {
  injectStyles();
  scheduleApply(RETRIES);
}

function scheduleApply(remaining = 8) {
  window.requestAnimationFrame(() => {
    applyPhase36InputDrawerFix();
    if (remaining > 0) window.setTimeout(() => scheduleApply(remaining - 1), 140);
  });
}

function applyPhase36InputDrawerFix() {
  const drawer = document.getElementById('inputDrawer');
  if (!drawer) return;

  keepInputPanelOpen(drawer);
  normalizeDrawerChrome(drawer);
  collapseDetailedOptions(drawer);
  normalizeRunDownload(drawer);
}

function keepInputPanelOpen(drawer) {
  const inputButton = document.getElementById('toggleInputBtn');
  drawer.classList.add('open', 'phase36-drawer-fixed');
  drawer.removeAttribute('hidden');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('input-open');
  inputButton?.classList.add('active');
  inputButton?.setAttribute('aria-pressed', 'true');
}

function normalizeDrawerChrome(drawer) {
  const title = drawer.querySelector('.drawer-head h2');
  if (title) title.textContent = 'Input / Export';

  const note = drawer.querySelector('.drawer-head p');
  if (note) note.textContent = 'Load InputXML, convert, then export GLB/RVM+ATT.';

  const close = document.getElementById('closeInputBtn');
  if (close && !close.dataset.phase36CloseIcon) {
    close.dataset.phase36CloseIcon = '1';
    close.innerHTML = '<span aria-hidden="true">Ã—</span>';
    close.setAttribute('aria-label', 'Close input panel');
  }
}

function collapseDetailedOptions(drawer) {
  const conversionSection = findSection(drawer, 'Conversion');
  if (!conversionSection) return;

  const details = ensureOptionsDetails(conversionSection);
  const optionsBody = details.querySelector('.phase36-options-body');
  if (!optionsBody) return;

  moveConversionDetails(conversionSection, optionsBody, details);
  moveSideloadDetails(drawer, optionsBody);
  normalizeOptionsSummary(details);
}

function ensureOptionsDetails(section) {
  let details = section.querySelector(':scope > #phase36ConversionOptions')
    || section.querySelector(':scope > #phase35ConversionOptions');

  if (!details) {
    details = document.createElement('details');
    details.id = 'phase36ConversionOptions';
    details.className = 'phase36-options-details';

    const summary = document.createElement('summary');
    summary.innerHTML = '<span>Options</span><b aria-hidden="true">â€º</b>';
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'phase36-options-body';
    details.appendChild(body);
  }

  details.classList.add('phase36-options-details');
  let body = details.querySelector('.phase36-options-body');
  if (!body) {
    const oldBody = details.querySelector('.phase35-options-body');
    if (oldBody) {
      oldBody.classList.add('phase36-options-body');
      body = oldBody;
    } else {
      body = document.createElement('div');
      body.className = 'phase36-options-body';
      details.appendChild(body);
    }
  }

  const heading = section.querySelector('h3');
  const anchor = heading?.nextSibling || section.firstChild;
  if (details.parentElement !== section) section.insertBefore(details, anchor);
  else if (details.previousElementSibling !== heading && heading) section.insertBefore(details, heading.nextSibling);

  return details;
}

function normalizeOptionsSummary(details) {
  const summary = details.querySelector('summary');
  if (!summary) return;
  if (!summary.querySelector('b')) summary.innerHTML = '<span>Options</span><b aria-hidden="true">â€º</b>';
}

function moveConversionDetails(section, optionsBody, details) {
  const movable = Array.from(section.children).filter((child) => {
    if (child === details) return false;
    if (child.matches?.('h3')) return false;
    if (child.classList?.contains('button-row')) return false;
    if (child.classList?.contains('download-grid')) return false;
    return child.matches?.('label.field, .check-grid, .rvm-profile-field');
  });

  movable.forEach((child) => optionsBody.appendChild(child));

  // RVM profile is injected after RVM Version. Keep it under Options if it appears later.
  const profile = section.querySelector(':scope > .rvm-profile-field');
  if (profile) optionsBody.appendChild(profile);
}

function moveSideloadDetails(drawer, optionsBody) {
  const sideload = findSection(drawer, 'Sideload Data');
  if (!sideload) return;

  let group = optionsBody.querySelector(':scope > .phase36-sideload-group');
  if (!group) {
    group = document.createElement('div');
    group.className = 'phase36-options-subgroup phase36-sideload-group';
    group.innerHTML = '<h4>Sideload data</h4>';
    optionsBody.appendChild(group);
  }

  Array.from(sideload.children).forEach((child) => {
    if (child.matches?.('h3')) return;
    group.appendChild(child);
  });

  sideload.hidden = true;
  sideload.style.display = 'none';
  sideload.dataset.phase36Moved = 'true';
}

function normalizeRunDownload(drawer) {
  const runSection = findSection(drawer, 'Run / Download');
  if (!runSection) return;
  runSection.classList.add('phase36-run-section');

  const qa = document.getElementById('rvmCompatBtn');
  const grid = runSection.querySelector('.download-grid');
  if (qa && grid && qa.parentElement !== grid) {
    qa.classList.add('phase36-rvm-qa-download');
    grid.appendChild(qa);
  }
}

function findSection(parent, headingText) {
  return Array.from(parent.querySelectorAll('.panel-section')).find((section) => {
    const heading = section.querySelector('h3');
    return heading && heading.textContent.trim().toLowerCase() === headingText.toLowerCase();
  });
}

function injectStyles() {
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Phase 36: force Input drawer back to a vertical sidebar. */
    body.input-open #inputDrawer,
    #inputDrawer.open,
    #inputDrawer.phase36-drawer-fixed {
      display: flex !important;
      flex-direction: column !important;
      align-items: stretch !important;
      justify-content: flex-start !important;
      gap: 0 !important;
      width: 378px !important;
      min-width: 320px !important;
      max-width: min(420px, calc(100vw - 32px)) !important;
      padding: 14px !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
      visibility: visible !important;
      opacity: 1 !important;
      transform: translateX(0) !important;
    }

    #inputDrawer.phase36-drawer-fixed .drawer-head {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) 32px !important;
      align-items: start !important;
      gap: 10px !important;
      margin: 0 0 10px !important;
      width: 100% !important;
      flex: 0 0 auto !important;
    }

    #inputDrawer.phase36-drawer-fixed .drawer-head h2 {
      margin: 0 !important;
      font-size: 16px !important;
      line-height: 1.1 !important;
      white-space: normal !important;
    }

    #inputDrawer.phase36-drawer-fixed .drawer-head p {
      margin: 4px 0 0 !important;
      max-width: 100% !important;
      color: #a9bed4 !important;
      font-size: 11px !important;
      line-height: 1.35 !important;
      white-space: normal !important;
    }

    #inputDrawer.phase36-drawer-fixed #closeInputBtn {
      width: 32px !important;
      min-width: 32px !important;
      height: 32px !important;
      padding: 0 !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      border-radius: 9px !important;
      color: #dcecff !important;
    }

    #inputDrawer.phase36-drawer-fixed #closeInputBtn span {
      display: inline-block !important;
      font-size: 22px !important;
      line-height: 1 !important;
      transform: translateY(-1px) !important;
    }

    #inputDrawer.phase36-drawer-fixed .panel-section {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      flex: 0 0 auto !important;
      padding: 12px 0 !important;
      border-top: 1px solid rgba(255,255,255,.08) !important;
      overflow: visible !important;
    }

    #inputDrawer.phase36-drawer-fixed .panel-section h3 {
      display: block !important;
      margin: 0 0 9px !important;
      color: #5ee6ff !important;
      font-size: 12px !important;
      font-weight: 950 !important;
      letter-spacing: .04em !important;
      text-transform: none !important;
    }

    #inputDrawer.phase36-drawer-fixed .button-row {
      display: flex !important;
      flex-direction: row !important;
      flex-wrap: wrap !important;
      align-items: center !important;
      gap: 8px !important;
      width: 100% !important;
      max-width: 100% !important;
    }

    #inputDrawer.phase36-drawer-fixed .button-row > button {
      min-width: 0 !important;
      flex: 1 1 130px !important;
    }

    #inputDrawer.phase36-drawer-fixed #loadSampleBtn,
    #inputDrawer.phase36-drawer-fixed #convertBtn {
      flex: 1 1 160px !important;
    }

    #inputDrawer.phase36-drawer-fixed #clearBtn,
    #inputDrawer.phase36-drawer-fixed #viewRulesBtn {
      flex: 0 1 125px !important;
    }

    #inputDrawer.phase36-drawer-fixed .download-grid {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 8px !important;
      width: 100% !important;
      max-width: 100% !important;
      margin-top: 10px !important;
    }

    #inputDrawer.phase36-drawer-fixed .download-grid > button {
      width: 100% !important;
      min-width: 0 !important;
      justify-content: center !important;
    }

    #inputDrawer.phase36-drawer-fixed .file-drop {
      display: grid !important;
      grid-template-columns: 28px minmax(0, 1fr) !important;
      align-items: center !important;
      gap: 8px !important;
      width: 100% !important;
      min-height: 42px !important;
      margin-bottom: 10px !important;
      padding: 9px 10px !important;
      border: 1px dashed rgba(105, 162, 219, .42) !important;
      border-radius: 12px !important;
      background: rgba(10, 25, 42, .58) !important;
      color: #eaf6ff !important;
    }

    #inputDrawer.phase36-drawer-fixed .file-drop span {
      min-width: 0 !important;
      line-height: 1.2 !important;
    }

    #inputDrawer.phase36-drawer-fixed .field,
    #inputDrawer.phase36-drawer-fixed .phase36-options-body > .field {
      display: block !important;
      width: 100% !important;
      margin: 9px 0 !important;
    }

    #inputDrawer.phase36-drawer-fixed .field span {
      display: block !important;
      margin-bottom: 5px !important;
      color: #a9bed4 !important;
      font-size: 11px !important;
    }

    #inputDrawer.phase36-drawer-fixed .field input,
    #inputDrawer.phase36-drawer-fixed .field select,
    #inputDrawer.phase36-drawer-fixed .field textarea,
    #inputDrawer.phase36-drawer-fixed input[type='number'],
    #inputDrawer.phase36-drawer-fixed input[type='text'],
    #inputDrawer.phase36-drawer-fixed select,
    #inputDrawer.phase36-drawer-fixed textarea {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      box-sizing: border-box !important;
    }

    #inputDrawer.phase36-drawer-fixed .checkbox-field {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
    }

    #inputDrawer.phase36-drawer-fixed .checkbox-field span {
      display: inline !important;
      margin: 0 !important;
    }

    #inputDrawer.phase36-drawer-fixed .check-grid {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 7px !important;
      width: 100% !important;
    }

    #inputDrawer.phase36-drawer-fixed .phase36-options-details,
    #inputDrawer.phase36-drawer-fixed .phase35-options-details {
      display: block !important;
      width: 100% !important;
      margin: 2px 0 0 !important;
      border: 1px solid rgba(92, 143, 196, .55) !important;
      border-radius: 12px !important;
      background: rgba(10, 29, 48, .72) !important;
      overflow: hidden !important;
    }

    #inputDrawer.phase36-drawer-fixed .phase36-options-details > summary,
    #inputDrawer.phase36-drawer-fixed .phase35-options-details > summary {
      min-height: 38px !important;
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

    #inputDrawer.phase36-drawer-fixed .phase36-options-details > summary::-webkit-details-marker,
    #inputDrawer.phase36-drawer-fixed .phase35-options-details > summary::-webkit-details-marker {
      display: none !important;
    }

    #inputDrawer.phase36-drawer-fixed .phase36-options-details > summary b,
    #inputDrawer.phase36-drawer-fixed .phase35-options-details > summary b {
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

    #inputDrawer.phase36-drawer-fixed .phase36-options-details[open] > summary b,
    #inputDrawer.phase36-drawer-fixed .phase35-options-details[open] > summary b {
      transform: rotate(90deg) !important;
    }

    #inputDrawer.phase36-drawer-fixed .phase36-options-body,
    #inputDrawer.phase36-drawer-fixed .phase35-options-body {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 9px !important;
      padding: 10px 12px 12px !important;
      border-top: 1px solid rgba(92, 143, 196, .22) !important;
    }

    #inputDrawer.phase36-drawer-fixed .phase36-options-subgroup,
    #inputDrawer.phase36-drawer-fixed .phase35-options-subgroup {
      display: grid !important;
      gap: 8px !important;
      margin-top: 4px !important;
      padding-top: 8px !important;
      border-top: 1px dashed rgba(119, 165, 214, .28) !important;
    }

    #inputDrawer.phase36-drawer-fixed .phase36-options-subgroup h4,
    #inputDrawer.phase36-drawer-fixed .phase35-options-subgroup h4 {
      margin: 0 !important;
      color: #72dcff !important;
      font-size: 11px !important;
      font-weight: 950 !important;
      letter-spacing: .04em !important;
      text-transform: uppercase !important;
    }
  `;
  document.head.appendChild(style);
}
