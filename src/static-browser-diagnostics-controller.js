const BROWSER_DIAGNOSTICS_VERSION = 'browser-diagnostics-20260619';
const DISMISS_SESSION_KEY = '3dmarkup.browserDiagnostics.dismissedSession';
const FORCE_LOCAL_KEY = '3dmarkup.showBrowserDiagnostics';
const ua = window.navigator && window.navigator.userAgent ? window.navigator.userAgent : '';
const isEdge = /\bEdg\//.test(ua);
const isChromium = /\b(?:Chrome|Chromium|CriOS)\//.test(ua) || Boolean(window.chrome);
const isChrome = isChromium && !isEdge;
const moduleFailures = [];

window.__3D_MARKUP_BROWSER_DIAGNOSTICS__ = {
  version: BROWSER_DIAGNOSTICS_VERSION,
  isChrome,
  isEdge,
  moduleFailures,
  recordModuleFailure,
  showHelp,
  hide,
  checklist
};

window.addEventListener('3dmarkup:bootstrap-module-failed', (event) => {
  recordModuleFailure(event.detail || {});
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onReady, { once: true });
} else {
  onReady();
}

function onReady() {
  console.info('[3DMarkupTool:browser-diagnostics]', checklist());
  if (shouldShowChromeHint()) {
    showHelp({
      level: 'info',
      title: 'Chrome detected',
      message: 'If zoom or tools feel erratic after an update, Chrome may be using stale cached modules. Press Ctrl+F5, or open DevTools → Network → Disable cache and reload. Edge may appear normal because it has a different cache state.'
    });
  }
}

function recordModuleFailure(detail) {
  const normalized = {
    url: detail.url || 'unknown module',
    reason: detail.reason || 'dynamic import failed',
    version: detail.version || BROWSER_DIAGNOSTICS_VERSION,
    userAgent: detail.userAgent || ua,
    time: new Date().toISOString()
  };
  moduleFailures.push(normalized);
  console.warn('[3DMarkupTool:browser-diagnostics] module failure', normalized);
  if (isChrome) {
    showHelp({
      level: 'warning',
      title: 'Chrome cache/module issue detected',
      message: `A UI module failed to load in Chrome: ${basename(normalized.url)}. Use Ctrl+F5 first. If it persists, clear site data for this app or enable DevTools → Network → Disable cache, then reload.`,
      detail: normalized.reason
    });
  }
}

function shouldShowChromeHint() {
  if (!isChrome) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.has('browserDiagnostics') || params.has('diagnostics')) return true;
  if (window.localStorage.getItem(FORCE_LOCAL_KEY) === '1') return true;
  if (window.sessionStorage.getItem(DISMISS_SESSION_KEY) === '1') return false;
  return true;
}

function showHelp(input = {}) {
  const level = input.level || 'info';
  const title = input.title || 'Browser diagnostic';
  const message = input.message || 'A browser-specific cache or dynamic import issue may be affecting this session.';
  const detail = input.detail || '';
  const banner = ensureBanner();
  banner.dataset.level = level;
  banner.querySelector('[data-role="title"]').textContent = title;
  banner.querySelector('[data-role="message"]').textContent = message;
  const detailNode = banner.querySelector('[data-role="detail"]');
  detailNode.textContent = detail;
  detailNode.hidden = !detail;
  banner.hidden = false;
  banner.classList.add('is-visible');
}

function hide() {
  const banner = document.getElementById('browserDiagnosticBanner');
  if (banner) {
    banner.hidden = true;
    banner.classList.remove('is-visible');
  }
  window.sessionStorage.setItem(DISMISS_SESSION_KEY, '1');
}

function ensureBanner() {
  let banner = document.getElementById('browserDiagnosticBanner');
  if (banner) return banner;

  injectStyles();
  banner = document.createElement('section');
  banner.id = 'browserDiagnosticBanner';
  banner.className = 'browser-diagnostic-banner';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  banner.hidden = true;
  banner.innerHTML = `
    <div class="browser-diagnostic-banner__icon" aria-hidden="true">!</div>
    <div class="browser-diagnostic-banner__body">
      <strong data-role="title">Browser diagnostic</strong>
      <p data-role="message"></p>
      <code data-role="detail" hidden></code>
      <div class="browser-diagnostic-banner__actions">
        <button type="button" data-action="reload">Hard refresh help</button>
        <button type="button" data-action="dismiss">Dismiss</button>
      </div>
    </div>
  `;
  banner.addEventListener('click', (event) => {
    const action = event.target && event.target.dataset ? event.target.dataset.action : '';
    if (action === 'dismiss') hide();
    if (action === 'reload') {
      console.info('[3DMarkupTool:browser-diagnostics] Hard refresh help: Ctrl+F5. For Chrome cache testing, open DevTools → Network → Disable cache, then reload. To reset this app, clear site data for reallaksh19.github.io.');
      showHelp({
        level: 'info',
        title: 'Hard refresh / Chrome cache help',
        message: 'Press Ctrl+F5. If the issue remains, open DevTools → Network → Disable cache and reload, or clear site data for reallaksh19.github.io/3DMarkupTool.',
        detail: moduleFailures[0] ? `${basename(moduleFailures[0].url)}: ${moduleFailures[0].reason}` : ''
      });
    }
  });
  document.body.appendChild(banner);
  return banner;
}

function injectStyles() {
  if (document.getElementById('browserDiagnosticStyles')) return;
  const style = document.createElement('style');
  style.id = 'browserDiagnosticStyles';
  style.textContent = `
    .browser-diagnostic-banner {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 100000;
      max-width: 430px;
      display: flex;
      gap: 12px;
      padding: 12px 14px;
      border: 1px solid rgba(245, 158, 11, 0.45);
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.96);
      color: #e5e7eb;
      box-shadow: 0 18px 42px rgba(0, 0, 0, 0.35);
      font: 12px/1.45 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .browser-diagnostic-banner[hidden] { display: none; }
    .browser-diagnostic-banner__icon {
      flex: 0 0 auto;
      width: 24px;
      height: 24px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: #f59e0b;
      color: #111827;
      font-weight: 900;
    }
    .browser-diagnostic-banner__body { min-width: 0; }
    .browser-diagnostic-banner strong { display: block; margin-bottom: 3px; color: #fff7ed; font-size: 13px; }
    .browser-diagnostic-banner p { margin: 0; }
    .browser-diagnostic-banner code {
      display: block;
      margin-top: 6px;
      max-width: 100%;
      overflow-wrap: anywhere;
      color: #fde68a;
      background: rgba(245, 158, 11, 0.1);
      padding: 4px 6px;
      border-radius: 8px;
    }
    .browser-diagnostic-banner__actions { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
    .browser-diagnostic-banner button {
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      color: #f8fafc;
      cursor: pointer;
      padding: 4px 9px;
      font: inherit;
    }
  `;
  document.head.appendChild(style);
}

function basename(url) {
  return String(url || '').split('/').pop() || String(url || 'module');
}

function checklist() {
  return {
    version: BROWSER_DIAGNOSTICS_VERSION,
    isChrome,
    isEdge,
    userAgent: ua,
    moduleFailureCount: moduleFailures.length,
    helpApi: true,
    noIntervalPolling: true
  };
}
