// Static input/export drawer summary.
// Adds a compact review status card without touching conversion/export internals.

const VERSION = 'static-drawer-summary-review-20260619';
const STYLE_ID = 'staticDrawerSummaryStyles';

runWhenReady(initDrawerSummary);

function runWhenReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function initDrawerSummary() {
  injectStyles();
  ensureSummaryCard();
  bindRefreshTriggers();
  refreshDrawerSummary('init');
  window.__3D_MARKUP_DRAWER_SUMMARY__ = { version: VERSION, refresh: refreshDrawerSummary };
  window.dispatchEvent(new CustomEvent('viewer:drawer-summary-ready', { detail: { version: VERSION } }));
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .drawer-summary-card {
      margin: 10px 12px 12px;
      padding: 10px;
      border: 1px solid rgba(116, 230, 255, .18);
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(8, 23, 41, .96), rgba(5, 16, 30, .92));
      box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
      display: grid;
      gap: 9px;
    }
    .drawer-summary-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      color: #eaf6ff;
      font-size: 11px;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: .07em;
    }
    .drawer-summary-title small {
      color: #8fb2d0;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: none;
      white-space: nowrap;
    }
    .drawer-summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 7px;
    }
    .drawer-summary-step {
      min-width: 0;
      padding: 8px 7px;
      border: 1px solid rgba(124, 164, 209, .18);
      border-radius: 11px;
      background: rgba(13, 31, 53, .72);
      display: grid;
      gap: 4px;
    }
    .drawer-summary-step strong {
      color: #f2f8ff;
      font-size: 11px;
      line-height: 1.05;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .drawer-summary-step span {
      color: #9fb9d4;
      font-size: 10px;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .drawer-summary-step[data-state="ok"] {
      border-color: rgba(91, 214, 151, .42);
      background: rgba(13, 55, 39, .54);
    }
    .drawer-summary-step[data-state="warn"] {
      border-color: rgba(247, 183, 92, .44);
      background: rgba(65, 42, 12, .46);
    }
    .drawer-summary-step[data-state="idle"] {
      opacity: .86;
    }
    .drawer-summary-hint {
      color: #a8bdd3;
      font-size: 10.5px;
      line-height: 1.35;
      min-height: 14px;
    }
  `;
  document.head.appendChild(style);
}

function ensureSummaryCard() {
  const drawer = document.getElementById('inputDrawer');
  if (!drawer) return null;
  let card = document.getElementById('drawerSummaryCard');
  if (card) return card;

  card = document.createElement('section');
  card.id = 'drawerSummaryCard';
  card.className = 'drawer-summary-card';
  card.setAttribute('aria-label', 'Conversion workflow summary');
  card.innerHTML = `
    <div class="drawer-summary-title">
      <span>Review Workflow</span>
      <small id="drawerSummaryStamp">ready</small>
    </div>
    <div class="drawer-summary-grid">
      ${stepHtml('input', 'Input', 'Waiting')}
      ${stepHtml('model', 'Model', 'Not converted')}
      ${stepHtml('export', 'Export', 'Locked')}
    </div>
    <div id="drawerSummaryHint" class="drawer-summary-hint">Load InputXML or BM_CII sample to begin.</div>
  `;

  const head = drawer.querySelector('.drawer-head');
  if (head?.nextSibling) drawer.insertBefore(card, head.nextSibling);
  else drawer.prepend(card);
  return card;
}

function stepHtml(id, label, value) {
  return `<div id="drawerSummary_${id}" class="drawer-summary-step" data-state="idle"><strong>${label}</strong><span>${value}</span></div>`;
}

function bindRefreshTriggers() {
  const ids = [
    'xmlFile', 'loadSampleBtn', 'clearBtn', 'convertBtn',
    'downloadGlbBtn', 'downloadRvmBtn', 'downloadAttBtn', 'downloadAuditBtn',
    'previewGlbBtn', 'previewRvmBtn', 'selectedStatus', 'runtimeStatus'
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.drawerSummaryBound === '1') return;
    el.dataset.drawerSummaryBound = '1';
    ['click', 'change', 'input'].forEach((eventName) => {
      el.addEventListener(eventName, () => scheduleRefresh(eventName), { passive: true });
    });
  });

  ['viewer:model-loaded', 'viewer:runtime-context', 'viewer:selection-changed', 'viewer:ui-score-changed', 'viewer:quick-export-ready'].forEach((eventName) => {
    window.addEventListener(eventName, () => scheduleRefresh(eventName));
  });

  const log = document.getElementById('log');
  if (log && !log.__drawerSummaryObserver) {
    log.__drawerSummaryObserver = new MutationObserver(() => scheduleRefresh('log'));
    log.__drawerSummaryObserver.observe(log, { childList: true, subtree: true, characterData: true });
  }
}

function scheduleRefresh(source) {
  window.clearTimeout(scheduleRefresh.timer);
  scheduleRefresh.timer = window.setTimeout(() => refreshDrawerSummary(source), 80);
}

function refreshDrawerSummary(source = 'manual') {
  ensureSummaryCard();
  const input = inputState();
  const model = modelState();
  const exportState = exportsState();

  writeStep('input', input.state, input.text);
  writeStep('model', model.state, model.text);
  writeStep('export', exportState.state, exportState.text);

  const hint = document.getElementById('drawerSummaryHint');
  if (hint) hint.textContent = summaryHint(input, model, exportState);

  const stamp = document.getElementById('drawerSummaryStamp');
  if (stamp) stamp.textContent = compactStamp(source);
}

function inputState() {
  const fileInput = document.getElementById('xmlFile');
  const hasFile = Boolean(fileInput?.files?.length);
  const logText = logTextValue();
  const sampleLoaded = /sample|BM_CII|loaded/i.test(logText) && !/clear/i.test(logText.slice(-180));
  if (hasFile) return { state: 'ok', text: fileInput.files[0]?.name || 'File selected' };
  if (sampleLoaded) return { state: 'ok', text: 'BM_CII sample' };
  return { state: 'idle', text: 'Waiting' };
}

function modelState() {
  const runtime = document.getElementById('runtimeStatus')?.textContent || '';
  const logText = logTextValue();
  const glbEnabled = !document.getElementById('downloadGlbBtn')?.disabled;
  const rvmEnabled = !document.getElementById('downloadRvmBtn')?.disabled;
  if (glbEnabled || rvmEnabled || /converted|model ready|GLB generated|RVM generated/i.test(runtime + ' ' + logText)) {
    return { state: 'ok', text: 'Converted' };
  }
  if (/converting|running|processing/i.test(runtime + ' ' + logText)) {
    return { state: 'warn', text: 'Running' };
  }
  return { state: 'idle', text: 'Not converted' };
}

function exportsState() {
  const enabled = [
    ['GLB', 'downloadGlbBtn'],
    ['RVM', 'downloadRvmBtn'],
    ['ATT', 'downloadAttBtn'],
    ['Audit', 'downloadAuditBtn']
  ].filter(([, id]) => !document.getElementById(id)?.disabled).map(([name]) => name);
  if (enabled.length) return { state: 'ok', text: enabled.join(' / ') };
  return { state: 'idle', text: 'Locked' };
}

function writeStep(id, state, text) {
  const step = document.getElementById(`drawerSummary_${id}`);
  if (!step) return;
  step.dataset.state = state;
  const value = step.querySelector('span');
  if (value) value.textContent = text;
}

function summaryHint(input, model, exp) {
  if (input.state !== 'ok') return 'Load InputXML or BM_CII sample to begin.';
  if (model.state !== 'ok') return 'Run Conversion to generate the GLB/RVM review model.';
  if (exp.state !== 'ok') return 'Conversion is complete; export buttons will unlock when outputs are ready.';
  return 'Review properties, use Color By / Legend, then export GLB, RVM, ATT or Audit.';
}

function compactStamp(source) {
  const label = String(source || 'manual').replace(/^viewer:/, '').replace(/-/g, ' ');
  return label.length > 18 ? `${label.slice(0, 16)}…` : label;
}

function logTextValue() {
  return String(document.getElementById('log')?.textContent || '');
}
