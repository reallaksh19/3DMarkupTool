const KNOWN_CHUNKS = new Set(['HEAD', 'MODL', 'CNTB', 'CNTE', 'PRIM', 'END:', 'MATE', 'MATL', 'COLR']);
const PRIMITIVE_KINDS = new Map([
  [1, 'pyramid'],
  [2, 'box'],
  [8, 'cylinder'],
  [9, 'sphere']
]);

const state = {
  panel: null,
  fileInput: null,
  lastRvmBuffer: null,
  lastAttText: '',
  lastReport: null,
  pendingRvmCapture: false,
  pendingAttCapture: false,
  originalCreateObjectUrl: null
};

initRvmCompatValidator();

function initRvmCompatValidator() {
  if (window.__RVM_COMPAT_VALIDATOR__) return;
  injectStyles();
  ensurePanel();
  ensureToolbarButton();
  ensureDownloadDrawerButton();
  wireDownloadCapture();
  window.__RVM_COMPAT_VALIDATOR__ = {
    open: openPanel,
    validateBuffer,
    getLastReport: () => state.lastReport
  };
}

function ensureToolbarButton() {
  if (document.getElementById('rvmCompatBtn')) return;
  const button = document.createElement('button');
  button.id = 'rvmCompatBtn';
  button.type = 'button';
  button.className = 'tool-btn icon-text rvm-compat-command';
  button.title = 'Validate RVM binary framing and Navisworks compatibility risk';
  button.innerHTML = '<span class="rvm-qa-icon">QA</span><span>RVM QA</span>';
  button.addEventListener('click', () => {
    openPanel();
    if (state.lastRvmBuffer) {
      runValidation();
    } else {
      setPanelMessage('No generated RVM captured yet. Choose an RVM/ATT file or click RVM download once to capture the generated binary for validation.', 'warn');
    }
  });

  const rvmPreview = document.getElementById('previewRvmBtn');
  const previewGroup = rvmPreview?.closest('.toolbar-group');
  if (rvmPreview) {
    rvmPreview.insertAdjacentElement('afterend', button);
  } else if (previewGroup) {
    previewGroup.appendChild(button);
  } else {
    document.querySelector('.toolbar')?.appendChild(button);
  }
}

function ensureDownloadDrawerButton() {
  if (document.getElementById('validateRvmFileBtn')) return;
  const grid = document.querySelector('.download-grid');
  if (!grid) return;
  const button = document.createElement('button');
  button.id = 'validateRvmFileBtn';
  button.type = 'button';
  button.className = 'rvm-validate-file-btn';
  button.innerHTML = '<span>RVM QA</span>';
  button.title = 'Validate generated or selected RVM/ATT files';
  button.addEventListener('click', () => {
    openPanel();
    state.fileInput?.click();
  });
  grid.appendChild(button);
}

function ensurePanel() {
  if (state.panel) return state.panel;
  const panel = document.createElement('section');
  panel.id = 'rvmCompatPanel';
  panel.className = 'rvm-compat-panel';
  panel.setAttribute('aria-label', 'RVM compatibility validator');
  panel.innerHTML = `
    <div class="rvm-compat-head">
      <div>
        <div class="rvm-compat-kicker">NAVISWORKS RVM QA</div>
        <h2>RVM Compatibility Validator</h2>
      </div>
      <button type="button" class="rvm-compat-close" title="Close RVM QA">Ã—</button>
    </div>
    <div class="rvm-compat-actions">
      <button type="button" id="rvmCompatChooseBtn">Choose RVM/ATT</button>
      <button type="button" id="rvmCompatRunBtn">Validate</button>
      <button type="button" id="rvmCompatReportBtn">QA JSON</button>
    </div>
    <div class="rvm-compat-body" id="rvmCompatBody">
      <div class="rvm-compat-empty">Choose an exported <b>.rvm</b> file, or click the RVM download button once so this validator can capture and inspect the generated binary.</div>
    </div>
  `;
  document.body.appendChild(panel);
  state.panel = panel;

  panel.querySelector('.rvm-compat-close')?.addEventListener('click', () => closePanel());
  panel.querySelector('#rvmCompatChooseBtn')?.addEventListener('click', () => state.fileInput?.click());
  panel.querySelector('#rvmCompatRunBtn')?.addEventListener('click', () => runValidation());
  panel.querySelector('#rvmCompatReportBtn')?.addEventListener('click', () => downloadReport());

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.rvm,.RVM,.att,.ATT,.txt,text/plain,application/octet-stream';
  input.multiple = true;
  input.hidden = true;
  input.addEventListener('change', async () => {
    await loadSelectedFiles(Array.from(input.files || []));
    input.value = '';
  });
  document.body.appendChild(input);
  state.fileInput = input;
  return panel;
}

function wireDownloadCapture() {
  const rvmButton = document.getElementById('downloadRvmBtn');
  const attButton = document.getElementById('downloadAttBtn');
  rvmButton?.addEventListener('click', () => {
    state.pendingRvmCapture = true;
    openPanel();
    setPanelMessage('Capturing generated RVM download for compatibility validationâ€¦', 'info');
    window.setTimeout(() => { state.pendingRvmCapture = false; }, 2000);
  }, true);
  attButton?.addEventListener('click', () => {
    state.pendingAttCapture = true;
    window.setTimeout(() => { state.pendingAttCapture = false; }, 2000);
  }, true);

  if (state.originalCreateObjectUrl || !URL?.createObjectURL) return;
  state.originalCreateObjectUrl = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function patchedCreateObjectURL(blob) {
    if (state.pendingRvmCapture && blob instanceof Blob) {
      blob.arrayBuffer().then((buffer) => {
        state.lastRvmBuffer = buffer;
        state.pendingRvmCapture = false;
        runValidation('Generated RVM captured from download');
      }).catch(() => setPanelMessage('Unable to read generated RVM blob for validation.', 'error'));
    } else if (state.pendingAttCapture && blob instanceof Blob) {
      blob.text().then((text) => {
        state.lastAttText = text;
        state.pendingAttCapture = false;
      }).catch(() => undefined);
    }
    return state.originalCreateObjectUrl(blob);
  };
}

async function loadSelectedFiles(files) {
  if (!files.length) return;
  openPanel();
  let loadedRvm = false;
  let loadedAtt = false;
  for (const file of files) {
    const name = file.name || '';
    if (/\.att$|\.txt$/i.test(name)) {
      state.lastAttText = await file.text();
      loadedAtt = true;
    } else if (/\.rvm$/i.test(name) || file.type === 'application/octet-stream' || !file.type) {
      state.lastRvmBuffer = await file.arrayBuffer();
      loadedRvm = true;
    }
  }
  if (!loadedRvm && !state.lastRvmBuffer) {
    setPanelMessage('No RVM file found in selected files. Choose a .rvm file, optionally with the matching .att file.', 'warn');
    return;
  }
  runValidation(`${loadedRvm ? 'RVM' : 'Previous RVM'}${loadedAtt ? ' + ATT' : ''} ready`);
}

function openPanel() {
  ensurePanel();
  state.panel.classList.add('open');
}

function closePanel() {
  state.panel?.classList.remove('open');
}

function setPanelMessage(message, tone = 'info') {
  const body = document.getElementById('rvmCompatBody');
  if (!body) return;
  body.innerHTML = `<div class="rvm-compat-message ${tone}">${escapeHtml(message)}</div>`;
}

function runValidation(sourceLabel = 'RVM buffer') {
  if (!state.lastRvmBuffer) {
    setPanelMessage('No RVM buffer available. Click Choose RVM/ATT or download the generated RVM once.', 'warn');
    return;
  }
  const report = validateBuffer(state.lastRvmBuffer, state.lastAttText, sourceLabel);
  state.lastReport = report;
  renderReport(report);
}

function validateBuffer(buffer, attText = '', sourceLabel = 'RVM buffer') {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer || buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const errors = [];
  const warnings = [];
  const advisories = [];
  const chunks = [];
  const primitiveCounts = {};
  const tokenCounts = {};
  const stack = [];
  let offset = 0;
  let ended = false;

  if (bytes.byteLength < 24) {
    errors.push('File is smaller than one 24-byte RVM chunk header.');
    return finalizeReport({ sourceLabel, bytes, chunks, errors, warnings, advisories, primitiveCounts, tokenCounts, attText });
  }

  let guard = 0;
  while (offset + 24 <= bytes.byteLength && guard < 100000) {
    guard += 1;
    const wideToken = decodeWideToken(view, offset);
    const asciiToken = decodeAsciiToken(bytes, offset);
    const token = wideToken || asciiToken || '????';
    const nextOffset = view.getUint32(offset + 16, false);
    const reserved = view.getUint32(offset + 20, false);
    const bodyStart = offset + 24;
    const bodyLength = nextOffset - bodyStart;
    const chunk = { index: chunks.length, offset, token, wideToken, asciiToken, nextOffset, bodyStart, bodyLength, reserved };

    chunks.push(chunk);
    tokenCounts[token] = (tokenCounts[token] || 0) + 1;

    if (!wideToken) warnings.push(`Chunk ${chunk.index} at ${offset}: token is not valid wide 32-bit BE text.`);
    if (!KNOWN_CHUNKS.has(token)) warnings.push(`Chunk ${chunk.index} at ${offset}: unknown token ${token}.`);
    if (reserved !== 0) advisories.push(`Chunk ${chunk.index} ${token}: reserved field is ${reserved}, not zero.`);
    if (!Number.isFinite(bodyLength) || bodyLength < 0) {
      errors.push(`Chunk ${chunk.index} ${token}: next offset ${nextOffset} is before body start ${bodyStart}.`);
      break;
    }
    if (nextOffset > bytes.byteLength) {
      errors.push(`Chunk ${chunk.index} ${token}: next offset ${nextOffset} exceeds file size ${bytes.byteLength}.`);
      break;
    }
    if (bodyLength % 4 !== 0) warnings.push(`Chunk ${chunk.index} ${token}: body length ${bodyLength} is not 4-byte aligned.`);

    if (token === 'HEAD' && chunk.index !== 0) warnings.push('HEAD is not the first chunk.');
    if (chunk.index === 0 && token !== 'HEAD') errors.push(`First chunk is ${token}; expected HEAD.`);
    if (chunk.index === 1 && token !== 'MODL') warnings.push(`Second chunk is ${token}; expected MODL for this exporter dialect.`);

    if (token === 'CNTB') {
      stack.push(chunk.index);
      advisories.push(`CNTB chunk ${chunk.index}: next offset points to group body end, not necessarily subtree end. If Navisworks expects subtree/sibling offsets, this dialect may fail.`);
    }
    if (token === 'CNTE') {
      if (!stack.length) errors.push(`CNTE chunk ${chunk.index}: container end without matching CNTB.`);
      else stack.pop();
    }
    if (token === 'PRIM') {
      const primitiveKind = bodyLength >= 8 ? view.getUint32(bodyStart + 4, false) : null;
      chunk.primitiveKind = primitiveKind;
      chunk.primitiveName = PRIMITIVE_KINDS.get(primitiveKind) || 'unknown';
      primitiveCounts[chunk.primitiveName] = (primitiveCounts[chunk.primitiveName] || 0) + 1;
      if (!PRIMITIVE_KINDS.has(primitiveKind)) warnings.push(`PRIM chunk ${chunk.index}: primitive code ${primitiveKind} is not in the current expected set [1,2,8,9].`);
      if (bodyLength < 80) warnings.push(`PRIM chunk ${chunk.index}: body length ${bodyLength} is unusually small for current PRIM layout.`);
    }
    if (token === 'END:') {
      ended = true;
      if (nextOffset < bytes.byteLength) advisories.push(`END chunk reached at ${offset}; ${bytes.byteLength - nextOffset} trailing bytes remain.`);
      break;
    }
    if (nextOffset <= offset) {
      errors.push(`Chunk ${chunk.index} ${token}: next offset does not advance.`);
      break;
    }
    offset = nextOffset;
  }

  if (guard >= 100000) errors.push('Chunk scan stopped after 100000 chunks; possible corrupt offsets or loop.');
  if (!ended) errors.push('No END: chunk reached during sequential scan.');
  if (stack.length) errors.push(`${stack.length} CNTB container(s) are not closed by CNTE.`);
  if (!tokenCounts.HEAD) errors.push('Missing HEAD chunk.');
  if (!tokenCounts.MODL) errors.push('Missing MODL chunk.');
  if (!tokenCounts.PRIM) warnings.push('No PRIM chunks found. Navisworks would load no visible primitive geometry.');
  if (!tokenCounts.MATE && !tokenCounts.MATL && !tokenCounts.COLR) {
    advisories.push('No explicit material/color chunks detected. Navisworks may load default colors or expect material records depending on dialect.');
  }

  return finalizeReport({ sourceLabel, bytes, chunks, errors, warnings, advisories, primitiveCounts, tokenCounts, attText });
}

function finalizeReport({ sourceLabel, bytes, chunks, errors, warnings, advisories, primitiveCounts, tokenCounts, attText }) {
  const att = validateAtt(attText);
  warnings.push(...att.warnings);
  advisories.push(...att.advisories);
  const score = Math.max(0, 100 - errors.length * 25 - warnings.length * 8 - advisories.length * 2);
  const status = errors.length ? 'FAIL' : warnings.length ? 'RISK' : 'PASS-WITH-DIALECT-CAUTION';
  const dialect = detectDialect(chunks);
  return {
    generatedAt: new Date().toISOString(),
    sourceLabel,
    fileSize: bytes.byteLength,
    status,
    score,
    dialect,
    chunks,
    tokenCounts,
    primitiveCounts,
    att,
    errors,
    warnings,
    advisories
  };
}

function detectDialect(chunks) {
  const first = chunks[0];
  return {
    tokenEncoding: first?.wideToken ? 'wide-uint32-be-token' : 'unknown-or-ascii-token',
    offsetConvention: 'field16-as-absolute-body-end-offset',
    headerBytes: 24,
    provenNavisworksReady: false,
    note: 'This validates the current exporter framing. It does not prove Autodesk Navisworks accepts the dialect.'
  };
}

function validateAtt(text) {
  const warnings = [];
  const advisories = [];
  if (!text) {
    warnings.push('No ATT companion file selected/captured. Attributes may not attach in Navisworks.');
    return { present: false, blockCount: 0, warnings, advisories };
  }
  const firstLine = String(text).split(/\r?\n/, 1)[0] || '';
  if (!/CADC_Attributes_File\s+v1\.0/i.test(firstLine)) {
    warnings.push('ATT companion does not start with CADC_Attributes_File v1.0.');
  }
  const blockCount = (String(text).match(/^NEW\s+/gmi) || []).length;
  if (!blockCount) warnings.push('ATT companion contains no NEW attribute blocks.');
  advisories.push('ATT/RVM hierarchy-name matching must still be checked in Navisworks with same-base-name import.');
  return { present: true, blockCount, firstLine, warnings: [], advisories };
}

function decodeWideToken(view, offset) {
  let token = '';
  for (let index = 0; index < 4; index += 1) {
    const code = view.getUint32(offset + index * 4, false);
    if (code < 32 || code > 126) return '';
    token += String.fromCharCode(code);
  }
  return token;
}

function decodeAsciiToken(bytes, offset) {
  let token = '';
  for (let index = 0; index < 4; index += 1) {
    const code = bytes[offset + index];
    if (code < 32 || code > 126) return '';
    token += String.fromCharCode(code);
  }
  return token;
}

function renderReport(report) {
  openPanel();
  const body = document.getElementById('rvmCompatBody');
  if (!body) return;
  const topChunks = report.chunks.slice(0, 14);
  body.innerHTML = `
    <div class="rvm-score ${scoreClass(report)}">
      <div>
        <strong>${escapeHtml(report.status)}</strong>
        <span>${escapeHtml(report.dialect.tokenEncoding)} / ${escapeHtml(report.dialect.offsetConvention)}</span>
      </div>
      <b>${report.score}</b>
    </div>
    <div class="rvm-compat-stats">
      <span>Size <b>${formatBytes(report.fileSize)}</b></span>
      <span>Chunks <b>${report.chunks.length}</b></span>
      <span>PRIM <b>${report.tokenCounts.PRIM || 0}</b></span>
      <span>ATT <b>${report.att.present ? `${report.att.blockCount} blocks` : 'missing'}</b></span>
    </div>
    ${issueBlock('Errors', report.errors, 'error')}
    ${issueBlock('Warnings', report.warnings, 'warn')}
    ${issueBlock('Advisories', report.advisories, 'info')}
    <details class="rvm-compat-details" open>
      <summary>Chunk offset table</summary>
      <table>
        <thead><tr><th>#</th><th>Offset</th><th>Token</th><th>Next</th><th>Body</th><th>PRIM</th></tr></thead>
        <tbody>${topChunks.map((chunk) => `<tr><td>${chunk.index}</td><td>${chunk.offset}</td><td>${escapeHtml(chunk.token)}</td><td>${chunk.nextOffset}</td><td>${chunk.bodyLength}</td><td>${escapeHtml(chunk.primitiveName || '')}</td></tr>`).join('')}</tbody>
      </table>
      ${report.chunks.length > topChunks.length ? `<p class="rvm-compat-muted">Showing first ${topChunks.length} of ${report.chunks.length} chunks. Download QA JSON for the full table.</p>` : ''}
    </details>
  `;
}

function issueBlock(title, entries, tone) {
  if (!entries.length) return '';
  return `<details class="rvm-issues ${tone}" open><summary>${title} (${entries.length})</summary><ul>${entries.slice(0, 8).map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}</ul>${entries.length > 8 ? `<p class="rvm-compat-muted">+ ${entries.length - 8} more in QA JSON</p>` : ''}</details>`;
}

function scoreClass(report) {
  if (report.errors.length) return 'bad';
  if (report.warnings.length) return 'risk';
  return 'ok';
}

function downloadReport() {
  if (!state.lastReport) {
    runValidation();
    if (!state.lastReport) return;
  }
  const blob = new Blob([JSON.stringify(state.lastReport, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'rvm_compatibility_report.json';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function injectStyles() {
  if (document.getElementById('rvmCompatStyles')) return;
  const style = document.createElement('style');
  style.id = 'rvmCompatStyles';
  style.textContent = `
    .rvm-compat-command .rvm-qa-icon{display:inline-flex;align-items:center;justify-content:center;width:1.55rem;height:1.55rem;border-radius:.45rem;background:rgba(125,211,252,.16);border:1px solid rgba(125,211,252,.36);font-size:.68rem;font-weight:900;letter-spacing:.04em;color:#aee9ff;}
    .rvm-compat-panel{position:fixed;right:1.1rem;bottom:1.1rem;z-index:5200;width:min(540px,calc(100vw - 2rem));max-height:min(76vh,760px);overflow:hidden;display:none;flex-direction:column;border:1px solid rgba(92,168,224,.42);border-radius:18px;background:linear-gradient(180deg,rgba(9,22,36,.98),rgba(7,17,28,.98));box-shadow:0 24px 72px rgba(0,0,0,.48),0 0 0 1px rgba(255,255,255,.04);color:#e9f4ff;font-family:Inter,system-ui,Segoe UI,sans-serif;}
    .rvm-compat-panel.open{display:flex;}
    .rvm-compat-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;padding:1rem 1.1rem;border-bottom:1px solid rgba(92,168,224,.22);}
    .rvm-compat-kicker{font-size:.66rem;font-weight:900;letter-spacing:.18em;color:#74d4ff;}
    .rvm-compat-head h2{margin:.18rem 0 0;font-size:1.05rem;}
    .rvm-compat-close{width:2rem;height:2rem;border-radius:.6rem;border:1px solid rgba(148,197,235,.35);background:rgba(255,255,255,.05);color:#dcefff;font-size:1.2rem;cursor:pointer;}
    .rvm-compat-actions{display:flex;gap:.5rem;flex-wrap:wrap;padding:.75rem 1.1rem;border-bottom:1px solid rgba(92,168,224,.16);}
    .rvm-compat-actions button,.rvm-validate-file-btn{border:1px solid rgba(99,179,237,.35);background:rgba(21,55,86,.7);color:#eaf7ff;border-radius:.65rem;padding:.55rem .75rem;font-weight:800;cursor:pointer;}
    .rvm-compat-body{padding:1rem 1.1rem;overflow:auto;}
    .rvm-compat-empty,.rvm-compat-message{border:1px dashed rgba(125,211,252,.32);border-radius:14px;background:rgba(8,25,40,.72);padding:1rem;line-height:1.45;color:#d8ecff;}
    .rvm-compat-message.warn{border-color:rgba(251,191,36,.42);color:#fff4ce;}.rvm-compat-message.error{border-color:rgba(248,113,113,.5);color:#ffe0e0;}.rvm-compat-message.info{border-color:rgba(125,211,252,.38);}
    .rvm-score{display:flex;align-items:center;justify-content:space-between;gap:1rem;border-radius:14px;padding:.85rem 1rem;margin-bottom:.75rem;border:1px solid rgba(148,197,235,.28);background:rgba(255,255,255,.05);}.rvm-score span{display:block;font-size:.76rem;color:#b9cce0;margin-top:.15rem;}.rvm-score b{font-size:1.8rem;}.rvm-score.bad{border-color:rgba(248,113,113,.55);}.rvm-score.risk{border-color:rgba(251,191,36,.55);}.rvm-score.ok{border-color:rgba(52,211,153,.55);}
    .rvm-compat-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.45rem;margin-bottom:.8rem;}.rvm-compat-stats span{border:1px solid rgba(148,197,235,.2);border-radius:10px;background:rgba(255,255,255,.045);padding:.55rem;font-size:.73rem;color:#b9cce0;}.rvm-compat-stats b{display:block;color:#fff;font-size:.88rem;margin-top:.18rem;}
    .rvm-issues,.rvm-compat-details{border:1px solid rgba(148,197,235,.2);border-radius:12px;margin:.55rem 0;background:rgba(255,255,255,.04);}.rvm-issues summary,.rvm-compat-details summary{padding:.7rem .8rem;cursor:pointer;font-weight:900;}.rvm-issues ul{margin:0;padding:.1rem 1rem .8rem 1.45rem;line-height:1.35;font-size:.8rem;}.rvm-issues.error{border-color:rgba(248,113,113,.4);}.rvm-issues.warn{border-color:rgba(251,191,36,.38);}.rvm-issues.info{border-color:rgba(125,211,252,.25);}
    .rvm-compat-details table{width:100%;border-collapse:collapse;font-size:.74rem;margin:.1rem 0 .8rem;}.rvm-compat-details th,.rvm-compat-details td{border-top:1px solid rgba(148,197,235,.13);padding:.42rem .5rem;text-align:left;}.rvm-compat-details th{color:#9ecff5;font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;}.rvm-compat-muted{font-size:.76rem;color:#9fb5ca;margin:.45rem .8rem .8rem;}
  `;
  document.head.appendChild(style);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'N/A';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
