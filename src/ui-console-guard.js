const state = {
  inputLoaded: false
};

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
    showInputRequiredMessage();
  }, true);
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
    log.textContent += 'INFO: Load an InputXML before running conversion.\n';
  }
  document.body.classList.add('input-open');
  document.getElementById('xmlFile')?.focus?.();
}
