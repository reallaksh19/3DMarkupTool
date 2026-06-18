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

  wireRecoveredConverterControls();

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

function wireRecoveredConverterControls() {
  const title = document.querySelector('#inputDrawer .drawer-head h2');
  if (title) title.textContent = '3D Model ' + 'Converters';
  const inputSection = document.querySelector('#inputDrawer .panel-section');
  if (inputSection && !document.getElementById('converterSelect')) {
    const label = document.createElement('label');
    label.className = 'field';
    label.innerHTML = '<span>Converter</span><select id="converterSelect"><option value="inputxml-glb" selected>INPUTXML-&gt;GLB</option></select>';
    inputSection.insertBefore(label, inputSection.querySelector('.file-picker'));
  }
  const sideloadSection = Array.from(document.querySelectorAll('#inputDrawer .panel-section')).find((section) => /Sideload/i.test(section.querySelector('h3')?.textContent || ''));
  if (sideloadSection && !document.getElementById('sideloadBundleFile')) {
    const label = document.createElement('label');
    label.className = 'file-picker';
    label.innerHTML = '<input type="file" id="sideloadBundleFile" accept=".csv,.json,.txt" multiple><span>Optional sideload bundle (.csv,.json,.txt)</span>';
    sideloadSection.insertBefore(label, sideloadSection.children[1] || null);
  }
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
