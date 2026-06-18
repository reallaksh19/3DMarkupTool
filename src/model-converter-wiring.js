const WIRING_VERSION = 'glb-recovered-ui-1';
const byId = (id) => document.getElementById(id);

function whenReady(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
  else fn();
}

whenReady(() => {
  if (document.body.dataset.glbRecoveredWiring === WIRING_VERSION) return;
  document.body.dataset.glbRecoveredWiring = WIRING_VERSION;
  renameInputDrawer();
  ensureConverterSelector();
  ensureSideloadBundleInput();
  polishAdvancedOptions();
  ensureWiringChecklist();
  updateChecklistState();
});

function renameInputDrawer() {
  const headTitle = document.querySelector('#inputDrawer .drawer-head h2');
  const headDesc = document.querySelector('#inputDrawer .drawer-head p');
  if (headTitle) headTitle.textContent = '3D Model Converters';
  if (headDesc) headDesc.textContent = 'Convert CAESAR II InputXML to GLB with side-loaded ISONOTE and line-number metadata.';

  const inputSection = document.querySelector('#inputDrawer .panel-section');
  const inputHeading = inputSection?.querySelector('h3');
  if (inputHeading) inputHeading.textContent = '3D Model Converters';

  const fileLabel = document.querySelector('label.file-picker[for="xmlFile"], label.file-picker');
  const fileSpan = fileLabel?.querySelector('span');
  if (fileSpan) fileSpan.innerHTML = '<i data-lucide="upload"></i> Input XML (CAESAR II) (.xml,.XML)';
}

function ensureConverterSelector() {
  const inputSection = document.querySelector('#inputDrawer .panel-section');
  if (!inputSection || byId('converterSelect')) return;

  const field = document.createElement('label');
  field.className = 'field converter-field';
  field.innerHTML = `
    <span>Converter</span>
    <select id="converterSelect" aria-label="Model converter">
      <option value="inputxml-glb" selected>INPUTXML-&gt;GLB</option>
    </select>
    <small>Renamed from BM_CII InputXML→GLB Support + ISONOTE. This is the active GLB path.</small>
  `;

  const filePicker = inputSection.querySelector('.file-picker');
  inputSection.insertBefore(field, filePicker || inputSection.children[1] || null);
  byId('converterSelect')?.addEventListener('change', updateChecklistState);
}

function ensureSideloadBundleInput() {
  const sideloadSection = Array.from(document.querySelectorAll('#inputDrawer .panel-section'))
    .find((section) => /Sideload/i.test(section.querySelector('h3')?.textContent || ''));
  if (!sideloadSection || byId('sideloadBundleFile')) return;

  const picker = document.createElement('label');
  picker.className = 'file-picker sideload-bundle-picker';
  picker.innerHTML = `
    <input type="file" id="sideloadBundleFile" accept=".csv,.json,.txt,text/csv,application/json,text/plain" multiple />
    <span><i data-lucide="paperclip"></i> Optional sideload bundle (.csv,.json,.txt)</span>
  `;
  const help = document.createElement('p');
  help.className = 'field-help';
  help.textContent = 'Accepts ISONOTE and LINE_NO side-load files. Recognized rows are written into the existing ISONOTE and Line No text inputs before conversion.';
  sideloadSection.insertBefore(help, sideloadSection.children[1] || null);
  sideloadSection.insertBefore(picker, help);

  byId('sideloadBundleFile')?.addEventListener('change', onSideloadBundleChange);
}

function polishAdvancedOptions() {
  const conversionSection = Array.from(document.querySelectorAll('#inputDrawer .panel-section'))
    .find((section) => /Conversion/i.test(section.querySelector('h3')?.textContent || ''));
  if (!conversionSection) return;
  const h3 = conversionSection.querySelector('h3');
  if (h3) h3.textContent = 'Advanced options';
  conversionSection.classList.add('advanced-options-panel');

  const supportMode = byId('supportMode');
  const singleAxis = byId('singleAxisDecision');
  if (supportMode) supportMode.title = 'Wired to collectOptions().supportMode and converter support generation.';
  if (singleAxis) singleAxis.title = 'Wired to collectOptions().singleAxisDecision and ISONOTE single-axis resolver.';

  const isonoteLabel = byId('isonoteBoards')?.closest('label');
  if (isonoteLabel) isonoteLabel.lastChild.textContent = ' ISONOTE annotations';

  if (!conversionSection.querySelector('.advanced-options-note')) {
    const note = document.createElement('p');
    note.className = 'field-help advanced-options-note';
    note.textContent = 'Advanced options are live-wired through collectOptions(): support source mode, single-axis decision, node labels, ISONOTE annotations, support labels, compare colors, and compact geometry.';
    conversionSection.appendChild(note);
  }
}

function ensureWiringChecklist() {
  if (byId('glbWiringChecklist')) return;
  const sideloadSection = Array.from(document.querySelectorAll('#inputDrawer .panel-section'))
    .find((section) => /Sideload/i.test(section.querySelector('h3')?.textContent || ''));
  if (!sideloadSection) return;
  const checklist = document.createElement('div');
  checklist.id = 'glbWiringChecklist';
  checklist.className = 'glb-wiring-checklist';
  checklist.innerHTML = `
    <strong>Wiring checklist</strong>
    <ul>
      <li data-check="converter">Converter selector: INPUTXML-&gt;GLB</li>
      <li data-check="xml">Input XML control: xmlFile</li>
      <li data-check="bundle">Optional sideload bundle: csv/json/txt</li>
      <li data-check="isonote">ISONOTE sideload: isonoteText</li>
      <li data-check="lineNo">Line No sideload: lineNoText</li>
      <li data-check="supportMode">Support source mode: supportMode</li>
      <li data-check="axis">Single-axis decision: singleAxisDecision</li>
      <li data-check="advanced">Advanced options: live collectOptions controls</li>
    </ul>
  `;
  sideloadSection.appendChild(checklist);
}

async function onSideloadBundleChange(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  const merged = { isonote: [], lineNo: [], unknown: [] };
  for (const file of files) {
    const text = await file.text();
    const classified = classifySideload(file.name, text);
    if (classified.isonote) merged.isonote.push(classified.isonote);
    if (classified.lineNo) merged.lineNo.push(classified.lineNo);
    if (!classified.isonote && !classified.lineNo) merged.unknown.push(file.name);
  }
  if (merged.isonote.length) setTextarea('isonoteText', mergeCsvBlocks(merged.isonote, 'NODE,ISONOTE'));
  if (merged.lineNo.length) setTextarea('lineNoText', mergeCsvBlocks(merged.lineNo, 'NODE,LINE_NO'));
  updateChecklistState();
  const log = byId('log');
  if (log) {
    const parts = [`Sideload bundle loaded: ${files.map((f) => f.name).join(', ')}`];
    if (merged.unknown.length) parts.push(`Unclassified: ${merged.unknown.join(', ')}`);
    log.textContent += `${parts.join(' | ')}\n`;
  }
}

function classifySideload(name, text) {
  const lowerName = String(name || '').toLowerCase();
  const raw = String(text || '').trim();
  if (!raw) return {};
  if (lowerName.endsWith('.json') || /^[\[{]/.test(raw)) return classifyJson(raw);
  const upper = raw.slice(0, 500).toUpperCase();
  if (upper.includes('LINE_NO') || upper.includes('LINE NO') || lowerName.includes('line')) return { lineNo: normalizeCsv(raw, 'NODE,LINE_NO') };
  if (upper.includes('ISONOTE') || upper.includes(':/PS') || lowerName.includes('isonote')) return { isonote: normalizeCsv(raw, 'NODE,ISONOTE') };
  return {};
}

function classifyJson(raw) {
  try {
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : Object.values(parsed).find(Array.isArray) || [];
    const isonoteRows = rowsToCsv(rows, ['ISONOTE', 'isonote', 'sourceNoteName', 'note'], 'NODE,ISONOTE');
    const lineRows = rowsToCsv(rows, ['LINE_NO', 'lineNo', 'line_no', 'line'], 'NODE,LINE_NO');
    const out = {};
    if (isonoteRows) out.isonote = isonoteRows;
    if (lineRows) out.lineNo = lineRows;
    if (!out.isonote && typeof parsed.isonoteText === 'string') out.isonote = normalizeCsv(parsed.isonoteText, 'NODE,ISONOTE');
    if (!out.lineNo && typeof parsed.lineNoText === 'string') out.lineNo = normalizeCsv(parsed.lineNoText, 'NODE,LINE_NO');
    return out;
  } catch {
    return {};
  }
}

function rowsToCsv(rows, valueKeys, header) {
  if (!Array.isArray(rows)) return '';
  const lines = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const node = row.NODE ?? row.node ?? row.Node;
    const valueKey = valueKeys.find((key) => row[key] != null);
    if (node == null || !valueKey) continue;
    lines.push(`${node},${String(row[valueKey]).replace(/\r?\n/g, ' ')}`);
  }
  return lines.length ? `${header}\n${lines.join('\n')}` : '';
}

function normalizeCsv(raw, header) {
  const rows = String(raw || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!rows.length) return '';
  if (/^node\s*,/i.test(rows[0])) return rows.join('\n');
  return `${header}\n${rows.join('\n')}`;
}

function mergeCsvBlocks(blocks, header) {
  const rows = [];
  for (const block of blocks) {
    for (const row of String(block || '').split(/\r?\n/)) {
      const line = row.trim();
      if (!line || /^node\s*,/i.test(line)) continue;
      rows.push(line);
    }
  }
  return `${header}\n${rows.join('\n')}`;
}

function setTextarea(id, value) {
  const textarea = byId(id);
  if (!textarea) return;
  textarea.value = value;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function updateChecklistState() {
  const checks = {
    converter: byId('converterSelect')?.value === 'inputxml-glb',
    xml: Boolean(byId('xmlFile')),
    bundle: Boolean(byId('sideloadBundleFile')),
    isonote: Boolean(byId('isonoteText')),
    lineNo: Boolean(byId('lineNoText')),
    supportMode: Boolean(byId('supportMode')),
    axis: Boolean(byId('singleAxisDecision')),
    advanced: ['nodeLabels', 'isonoteBoards', 'supportLabels', 'compareColors', 'compactMode'].every((id) => Boolean(byId(id)))
  };
  for (const [key, ok] of Object.entries(checks)) {
    const item = document.querySelector(`#glbWiringChecklist [data-check="${key}"]`);
    if (item) item.dataset.ok = ok ? 'true' : 'false';
  }
}
