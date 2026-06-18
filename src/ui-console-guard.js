import './property-panel-revamp.js?v=property-panel-revamp-1';
import './property-panel-revamp-reset.js?v=property-panel-revamp-1';

const state = {
  inputLoaded: false
};

ensurePropertyPanelRevampStyles();

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initUiConsoleGuard, { once: true });
} else {
  initUiConsoleGuard();
}

function initUiConsoleGuard() {
  const convertBtn = document.getElementById('convertBtn');
  const xmlFile = document.getElementById('xmlFile');
  const log = document.getElementById('log');

  xmlFile?.addEventListener('change', () => {
    state.inputLoaded = Boolean(xmlFile.files?.length);
  });

  if (log) {
    const observer = new MutationObserver(() => syncInputStateFromLog(log.textContent || ''));
    observer.observe(log, { childList: true, characterData: true, subtree: true });
    syncInputStateFromLog(log.textContent || '');
  }

  convertBtn?.addEventListener('click', (event) => {
    if (state.inputLoaded) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    showInputRequiredMessage();
  }, true);
}

function ensurePropertyPanelRevampStyles() {
  const href = './src/property-panel-revamp.css?v=property-panel-revamp-1';
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function syncInputStateFromLog(text) {
  const lastClear = text.lastIndexOf('Cleared');
  const lastLoaded = Math.max(
    text.lastIndexOf('Loaded BM_CII sample'),
    text.lastIndexOf('Loaded ')
  );

  state.inputLoaded = lastLoaded > lastClear;
}

function showInputRequiredMessage() {
  const status = document.getElementById('runtimeStatus');
  const log = document.getElementById('log');

  if (status) status.textContent = 'Load InputXML first';

  if (log && !/Load an InputXML before running conversion\./.test(log.textContent || '')) {
    const ts = new Date().toLocaleTimeString();
    log.textContent += `[${ts}] INFO: Load an InputXML before running conversion. Use Choose InputXML or Load BM_CII sample.\n`;
    log.scrollTop = log.scrollHeight;
  }

  document.body.classList.add('input-open');
  document.getElementById('xmlFile')?.focus?.();
}
