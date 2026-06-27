// Static input/export drawer summary.
// index.html and static-shell-performance.css own all markup and layout.
// This controller only binds explicit refresh triggers and updates existing nodes.

const VERSION = 'static-drawer-summary-static-20260620';

runWhenReady(initDrawerSummary);

function runWhenReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function initDrawerSummary() {
  const card = getSummaryCard();
  if (!card) return;

  bindRefreshTriggers();
  refreshDrawerSummary('init');
  window.__3D_MARKUP_DRAWER_SUMMARY__ = { version: VERSION, refresh: refreshDrawerSummary };
  window.dispatchEvent(new CustomEvent('viewer:drawer-summary-ready', { detail: { version: VERSION } }));
}

function getSummaryCard() {
  return document.getElementById('drawerSummaryCard');
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

  [
    'viewer:model-loaded',
    'viewer:runtime-context',
    'viewer:selection-changed',
    'viewer:ui-score-changed',
    'viewer:quick-export-ready',
    'viewer:conversion-started',
    'viewer:conversion-complete',
    'viewer:conversion-failed',
    'viewer:log-updated',
    '3dmarkup:log-updated'
  ].forEach((eventName) => {
    window.addEventListener(eventName, () => scheduleRefresh(eventName));
  });
}

function scheduleRefresh(source) {
  window.clearTimeout(scheduleRefresh.timer);
  scheduleRefresh.timer = window.setTimeout(() => refreshDrawerSummary(source), 80);
}

function refreshDrawerSummary(source = 'manual') {
  if (!getSummaryCard()) return;

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
  const label = String(source || 'manual').replace(/^viewer:/, '').replace(/^3dmarkup:/, '').replace(/-/g, ' ');
  return label.length > 18 ? `${label.slice(0, 16)}â€¦` : label;
}

function logTextValue() {
  return String(document.getElementById('log')?.textContent || '');
}
