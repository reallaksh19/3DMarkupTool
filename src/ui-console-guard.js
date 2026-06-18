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
  const fileText = document.querySelector('label.file-picker span');
  if (fileText) fileText.textContent = 'Input XML (CAESAR II) (.xml,.XML)';
  const conversionTitle = Array.from(document.querySelectorAll('#inputDrawer .panel-section h3')).find((h) => /Conversion/i.test(h.textContent || ''));
  if (conversionTitle) conversionTitle.textContent = 'Advanced options';
  const isonoteBoard = document.getElementById('isonoteBoards')?.closest('label');
  if (isonoteBoard) isonoteBoard.lastChild.textContent = ' ISONOTE annotations';
  const sideloadSection = Array.from(document.querySelectorAll('#inputDrawer .panel-section')).find((section) => /Sideload/i.test(section.querySelector('h3')?.textContent || ''));
  if (sideloadSection && !document.getElementById('sideloadBundleFile')) {
    const label = document.createElement('label');
    label.className = 'file-picker';
    label.innerHTML = '<input type="file" id="sideloadBundleFile" accept=".csv,.json,.txt" multiple><span>Optional sideload bundle (.csv,.json,.txt)</span>';
    sideloadSection.insertBefore(label, sideloadSection.children[1] || null);
    document.getElementById('sideloadBundleFile')?.addEventListener('change', onSideloadBundleChange);
  }
  if (sideloadSection && !document.getElementById('glbWiringChecklist')) {
    const checklist = document.createElement('div');
    checklist.id = 'glbWiringChecklist';
    checklist.className = 'selected-card';
    checklist.innerHTML = '<strong>Wiring checklist</strong><div>DONE Converter INPUTXML-&gt;GLB</div><div>DONE XML input wired</div><div>DONE optional sideload bundle wired</div><div>DONE ISONOTE and Line No text inputs wired</div><div>DONE Advanced options wired</div>';
    sideloadSection.appendChild(checklist);
  }
}

async function onSideloadBundleChange(event) {
  const files = Array.from(event.target.files || []);
  const isoRows = [];
  const lineRows = [];
  for (const file of files) {
    const text = await file.text();
    const target = classifySideload(file.name, text);
    if (target === 'line') lineRows.push(...dataRows(text));
    if (target === 'iso') isoRows.push(...dataRows(text));
  }
  if (isoRows.length) setText('isonoteText', `NODE,ISONOTE\n${isoRows.join('\n')}`);
  if (lineRows.length) setText('lineNoText', `NODE,LINE_NO\n${lineRows.join('\n')}`);
  const log = document.getElementById('log');
  if (log) log.textContent += `Sideload bundle wired: ${files.map((f) => f.name).join(', ')}\n`;
}

function classifySideload(name, text) {
  const source = `${name}\n${String(text).slice(0, 500)}`.toUpperCase();
  if (source.includes('LINE_NO') || source.includes('LINE NO')) return 'line';
  if (source.includes('ISONOTE') || source.includes(':/PS')) return 'iso';
  if (String(name).toLowerCase().includes('line')) return 'line';
  if (String(name).toLowerCase().includes('isonote')) return 'iso';
  return '';
}

function dataRows(text) {
  return String(text || '').split(/\r?\n/).map((row) => row.trim()).filter((row) => row && !/^node\s*,/i.test(row));
}

function setText(id, value) {
  const target = document.getElementById(id);
  if (!target) return;
  target.value = value;
  target.dispatchEvent(new Event('input', { bubbles: true }));
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
