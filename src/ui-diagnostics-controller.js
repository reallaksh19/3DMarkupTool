const PANEL_ID = 'uiDiagnosticsPanel';
const BUTTON_ID = 'uiDiagnosticsBtn';

initUiDiagnostics();

function initUiDiagnostics() {
  injectStyles();
  ensureButton();
  window.addEventListener('markup:safe-ui-status', refreshPanel);
  window.addEventListener('markup:app-ready', refreshPanel);
}

function ensureButton() {
  if (document.getElementById(BUTTON_ID)) return;

  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.className = 'tool-btn ui-diagnostics-btn';
  button.textContent = 'UI Tools';
  button.title = 'Open UI diagnostics, cache, and safe-mode tools';
  button.addEventListener('click', () => togglePanel());

  const safeChip = document.getElementById('safeUiStatus');
  const runtime = document.getElementById('runtimeStatus');
  if (safeChip) safeChip.insertAdjacentElement('afterend', button);
  else if (runtime) runtime.insertAdjacentElement('afterend', button);
  else document.body.appendChild(button);
}

function togglePanel(forceOpen = null) {
  const panel = ensurePanel();
  const shouldOpen = forceOpen == null ? panel.hidden : Boolean(forceOpen);
  panel.hidden = !shouldOpen;
  if (shouldOpen) refreshPanel();
}

function ensurePanel() {
  let panel = document.getElementById(PANEL_ID);
  if (panel) return panel;

  panel = document.createElement('section');
  panel.id = PANEL_ID;
  panel.className = 'ui-diagnostics-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <header class="ui-diagnostics-head">
      <div>
        <h2>UI Diagnostics</h2>
        <p>Safe-loader status and recovery tools.</p>
      </div>
      <button type="button" class="ui-diagnostics-close" data-ui-diag="close">Ã—</button>
    </header>
    <div class="ui-diagnostics-summary" data-ui-diag="summary"></div>
    <div class="ui-diagnostics-actions">
      <button type="button" data-ui-diag="fresh">Fresh Reload</button>
      <button type="button" data-ui-diag="safe">Safe Mode</button>
      <button type="button" data-ui-diag="normal">Exit Safe Mode</button>
      <button type="button" data-ui-diag="copy">Copy Report</button>
    </div>
    <div class="ui-diagnostics-list" data-ui-diag="list"></div>
  `;

  panel.addEventListener('click', (event) => {
    const action = event.target?.closest('[data-ui-diag]')?.getAttribute('data-ui-diag');
    if (!action) return;
    if (action === 'close') togglePanel(false);
    if (action === 'fresh') freshReload();
    if (action === 'safe') enableSafeMode();
    if (action === 'normal') exitSafeMode();
    if (action === 'copy') copyReport();
  });

  document.body.appendChild(panel);
  return panel;
}

function refreshPanel() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel || panel.hidden) return;

  const report = buildReport();
  const summary = panel.querySelector('[data-ui-diag="summary"]');
  const list = panel.querySelector('[data-ui-diag="list"]');

  if (summary) {
    summary.innerHTML = `
      <div><strong>Core:</strong> ${escapeHtml(report.coreReady ? 'Ready' : 'Waiting')}</div>
      <div><strong>Mode:</strong> ${escapeHtml(report.safeMode ? 'Safe Mode' : 'Normal')}</div>
      <div><strong>Modules:</strong> ${report.loaded}/${report.total} loaded${report.failed ? `, ${report.failed} failed` : ''}</div>
      <div><strong>Version:</strong> ${escapeHtml(report.version)}</div>
    `;
  }

  if (list) {
    list.innerHTML = report.modules.length
      ? report.modules.map(renderModule).join('')
      : '<p class="ui-diag-muted">No module status yet.</p>';
  }
}

function renderModule(module) {
  const status = module.status || 'pending';
  const error = module.error ? `<small>${escapeHtml(module.error)}</small>` : '';
  return `
    <article class="ui-diag-module ${escapeHtml(status)}">
      <span>${escapeHtml(module.label || module.id)}</span>
      <b>${escapeHtml(status)}</b>
      ${error}
    </article>
  `;
}

function buildReport() {
  const loader = window.__3D_MARKUP_SAFE_UI_LOADER__ || {};
  const modules = Array.isArray(loader.results) ? loader.results.slice() : [];
  const planned = Array.isArray(loader.modules) ? loader.modules : [];
  const plannedOnly = planned
    .filter((entry) => !modules.some((item) => item.id === entry.id))
    .map((entry) => ({ id: entry.id, label: entry.label, status: 'pending' }));
  const all = modules.concat(plannedOnly);
  return {
    coreReady: Boolean(window.__3D_MARKUP_APP_READY__),
    safeMode: Boolean(loader.safeMode),
    version: loader.version || 'unknown',
    total: planned.length || all.length,
    loaded: modules.filter((item) => item.status === 'loaded').length,
    failed: modules.filter((item) => item.status === 'failed').length,
    modules: all
  };
}

function freshReload() {
  const url = new URL(window.location.href);
  url.searchParams.set('v', `fresh-${Date.now()}`);
  window.location.href = url.toString();
}

function enableSafeMode() {
  window.localStorage.setItem('3dmarkup.safeUiMode', 'core');
  const url = new URL(window.location.href);
  url.searchParams.set('safe', '1');
  url.searchParams.set('v', `safe-${Date.now()}`);
  window.location.href = url.toString();
}

function exitSafeMode() {
  window.localStorage.removeItem('3dmarkup.safeUiMode');
  const url = new URL(window.location.href);
  url.searchParams.delete('safe');
  url.searchParams.set('v', `normal-${Date.now()}`);
  window.location.href = url.toString();
}

async function copyReport() {
  const report = buildReport();
  const text = JSON.stringify(report, null, 2);
  try {
    await navigator.clipboard?.writeText(text);
    setToast('UI diagnostics copied.');
  } catch {
    window.prompt('Copy UI diagnostics:', text);
  }
}

function setToast(message) {
  const panel = ensurePanel();
  const summary = panel.querySelector('[data-ui-diag="summary"]');
  if (!summary) return;
  const toast = document.createElement('div');
  toast.className = 'ui-diag-toast';
  toast.textContent = message;
  summary.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2200);
}

function injectStyles() {
  if (document.getElementById('uiDiagnosticsStyles')) return;
  const style = document.createElement('style');
  style.id = 'uiDiagnosticsStyles';
  style.textContent = `
    .ui-diagnostics-btn {
      min-width: 72px;
    }
    .ui-diagnostics-panel {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 9500;
      width: min(420px, calc(100vw - 36px));
      max-height: min(620px, calc(100vh - 36px));
      overflow: auto;
      color: #e8f3ff;
      background: rgba(5, 18, 34, .96);
      border: 1px solid rgba(99, 179, 237, .45);
      border-radius: 16px;
      box-shadow: 0 22px 70px rgba(0, 0, 0, .42);
      padding: 14px;
      backdrop-filter: blur(16px);
    }
    .ui-diagnostics-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px solid rgba(148, 197, 255, .15);
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .ui-diagnostics-head h2 {
      margin: 0;
      font-size: 15px;
    }
    .ui-diagnostics-head p,
    .ui-diag-muted {
      margin: 4px 0 0;
      color: #9eb6d4;
      font-size: 12px;
    }
    .ui-diagnostics-close {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      border: 1px solid rgba(132, 190, 255, .36);
      background: rgba(23, 48, 78, .75);
      color: #e8f3ff;
      font-size: 20px;
      cursor: pointer;
    }
    .ui-diagnostics-summary {
      display: grid;
      gap: 6px;
      margin-bottom: 12px;
      padding: 10px;
      background: rgba(17, 42, 70, .72);
      border-radius: 12px;
      font-size: 12px;
    }
    .ui-diagnostics-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .ui-diagnostics-actions button {
      border: 1px solid rgba(132, 190, 255, .35);
      background: rgba(31, 70, 108, .78);
      color: #eef7ff;
      border-radius: 10px;
      padding: 8px 10px;
      font-weight: 800;
      cursor: pointer;
    }
    .ui-diagnostics-list {
      display: grid;
      gap: 7px;
    }
    .ui-diag-module {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px 10px;
      align-items: center;
      padding: 9px 10px;
      border-radius: 11px;
      border: 1px solid rgba(132, 190, 255, .18);
      background: rgba(11, 29, 52, .78);
      font-size: 12px;
    }
    .ui-diag-module b {
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: .08em;
      color: #a9c7e8;
    }
    .ui-diag-module.loaded b { color: #4ff0b2; }
    .ui-diag-module.failed b { color: #ff8a8a; }
    .ui-diag-module.pending b { color: #ffd166; }
    .ui-diag-module small {
      grid-column: 1 / -1;
      color: #ffb4b4;
      overflow-wrap: anywhere;
    }
    .ui-diag-toast {
      margin-top: 8px;
      color: #4ff0b2;
      font-weight: 800;
    }
  `;
  document.head.appendChild(style);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}
