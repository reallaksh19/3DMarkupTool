const BROWSER_DIAGNOSTICS_VERSION = 'chrome-runtime-diagnostics-20260619';
const EXPECTED_SHELL_VERSION = 'chrome-runtime-diagnostics-20260619';
const STALE_SHELL_VERSION = 'fresh-clip-core-20260619';
const DISMISS_SESSION_KEY = '3dmarkup.browserDiagnostics.dismissedSession';
const FORCE_LOCAL_KEY = '3dmarkup.showBrowserDiagnostics';
const ua = window.navigator && window.navigator.userAgent ? window.navigator.userAgent : '';
const isEdge = /\bEdg\//.test(ua);
const isChromium = /\b(?:Chrome|Chromium|CriOS)\//.test(ua) || Boolean(window.chrome);
const isChrome = isChromium && !isEdge;
const moduleFailures = [];
const runtimeWarnings = [];
let staleAssetUrls = [];
let frameSample = null;
let wheelLatency = null;
let webglInfo = null;
let diagnosticsScheduled = false;
let diagnosticsComplete = false;

window.__3D_MARKUP_BROWSER_DIAGNOSTICS__ = {
  version: BROWSER_DIAGNOSTICS_VERSION,
  expectedShellVersion: EXPECTED_SHELL_VERSION,
  isChrome,
  isEdge,
  moduleFailures,
  runtimeWarnings,
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
  staleAssetUrls = detectStaleShellAssets();
  console.info('[3DMarkupTool:browser-diagnostics]', checklist());

  if (staleAssetUrls.length) {
    const title = isChrome ? 'Chrome stale shell assets detected' : 'Stale shell assets detected';
    recordRuntimeWarning({
      type: 'stale-shell-asset',
      title,
      message: `This page still references ${STALE_SHELL_VERSION}. Use Ctrl+F5. In Chrome, open DevTools → Network → Disable cache and reload, or clear site data for reallaksh19.github.io/3DMarkupTool.`,
      detail: staleAssetUrls.slice(0, 4).map(basename).join(', ')
    });
    return;
  }

  scheduleHeavyDiagnosticsProbes();

  if (shouldShowChromeHint()) {
    showHelp({
      level: 'info',
      title: 'Chrome diagnostics scheduled',
      message: 'Chrome runtime diagnostics will run after the page is visually stable. Ctrl+F5 remains the first cache recovery step.'
    });
  }
}

function scheduleHeavyDiagnosticsProbes() {
  if (diagnosticsScheduled) return;
  diagnosticsScheduled = true;
  const start = () => scheduleAfterFirstPaint(() => scheduleIdle(runHeavyDiagnosticsProbes, 3600));
  if (document.readyState === 'complete') {
    start();
    return;
  }
  window.addEventListener('load', start, { once: true });
  scheduleIdle(start, 5200);
}

function runHeavyDiagnosticsProbes() {
  if (diagnosticsComplete) return;
  diagnosticsComplete = true;
  webglInfo = collectWebglInfo();
  installWheelLatencyProbe();
  sampleFrameTime();
  console.info('[3DMarkupTool:browser-diagnostics:late]', checklist());
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

function recordRuntimeWarning(input) {
  const normalized = {
    type: input.type || 'runtime-warning',
    title: input.title || 'Runtime diagnostic warning',
    message: input.message || 'A browser/runtime issue may be affecting this session.',
    detail: input.detail || '',
    time: new Date().toISOString()
  };
  runtimeWarnings.push(normalized);
  console.warn('[3DMarkupTool:browser-diagnostics] runtime warning', normalized);
  if (isChrome || normalized.type === 'stale-shell-asset') {
    showHelp({
      level: 'warning',
      title: normalized.title,
      message: normalized.message,
      detail: normalized.detail
    });
  }
}

function detectStaleShellAssets() {
  const nodes = [
    ...document.querySelectorAll('script[src]'),
    ...document.querySelectorAll('link[href]')
  ];
  return nodes
    .map((node) => node.src || node.href || '')
    .filter((url) => url.includes(STALE_SHELL_VERSION));
}

function collectWebglInfo() {
  const info = {
    available: false,
    vendor: 'unknown',
    renderer: 'unknown',
    unmaskedVendor: 'unknown',
    unmaskedRenderer: 'unknown'
  };
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return info;
    info.available = true;
    info.vendor = gl.getParameter(gl.VENDOR) || 'unknown';
    info.renderer = gl.getParameter(gl.RENDERER) || 'unknown';
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      info.unmaskedVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || info.vendor;
      info.unmaskedRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || info.renderer;
    }
  } catch (error) {
    info.error = error && (error.message || String(error));
  }
  return info;
}

function sampleFrameTime() {
  if (!window.requestAnimationFrame) return;
  const samples = [];
  const maxFrames = 90;
  const start = performance.now();
  let last = start;
  function step(now) {
    const delta = now - last;
    last = now;
    if (samples.length > 0 || delta > 0) samples.push(delta);
    if (samples.length < maxFrames && now - start < 3000) {
      window.requestAnimationFrame(step);
      return;
    }
    const sorted = samples.slice().sort((a, b) => a - b);
    const average = samples.reduce((sum, value) => sum + value, 0) / Math.max(samples.length, 1);
    const max = Math.max(...samples, 0);
    const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
    const slowFrames = samples.filter((value) => value > 50).length;
    frameSample = {
      sampleCount: samples.length,
      averageMs: round(average),
      p95Ms: round(p95),
      maxMs: round(max),
      slowFrames,
      startedAt: new Date(start + performance.timeOrigin).toISOString()
    };
    if (isChrome && (slowFrames >= 8 || p95 > 80)) {
      recordRuntimeWarning({
        type: 'frame-lag',
        title: 'Chrome frame-time lag detected',
        message: 'Chrome is reporting slow frames in the viewer shell. Try Ctrl+F5, then Chrome DevTools → Network → Disable cache and reload. If it persists, disable Chrome hardware acceleration or test Edge for GPU-driver comparison.',
        detail: `p95=${frameSample.p95Ms}ms, max=${frameSample.maxMs}ms, slowFrames=${slowFrames}, renderer=${webglInfo && (webglInfo.unmaskedRenderer || webglInfo.renderer)}`
      });
    }
  }
  window.requestAnimationFrame(step);
}

function installWheelLatencyProbe() {
  if (!isChrome || !window.requestAnimationFrame) return;
  const viewer = document.getElementById('viewer') || document;
  const handler = () => {
    const eventTime = performance.now();
    window.requestAnimationFrame((frameTime) => {
      const latency = frameTime - eventTime;
      wheelLatency = {
        lastMs: round(latency),
        time: new Date().toISOString()
      };
      if (latency > 120) {
        recordRuntimeWarning({
          type: 'wheel-latency',
          title: 'Chrome wheel-event latency detected',
          message: 'Mouse wheel input is delayed in Chrome. Use Ctrl+F5 first. If only Chrome is affected, try disabling extensions for this site or disable Chrome hardware acceleration as a GPU-driver test.',
          detail: `wheelLatency=${round(latency)}ms`
        });
      }
    });
  };
  viewer.addEventListener('wheel', handler, { passive: true, capture: true });
}

function shouldShowChromeHint() {
  if (!isChrome) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.has('browserDiagnostics') || params.has('diagnostics')) return true;
  if (window.localStorage.getItem(FORCE_LOCAL_KEY) === '1') return true;
  if (window.sessionStorage.getItem(DISMISS_SESSION_KEY) === '1') return false;
  return false;
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
        <button type="button" data-action="report">Copy diagnostic checklist</button>
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
        detail: moduleFailures[0] ? `${basename(moduleFailures[0].url)}: ${moduleFailures[0].reason}` : staleAssetUrls[0] ? basename(staleAssetUrls[0]) : ''
      });
    }
    if (action === 'report') {
      const snapshot = checklist();
      console.info('[3DMarkupTool:browser-diagnostics] checklist snapshot', snapshot);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2)).catch(() => {});
      }
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
      max-width: 460px;
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

function scheduleAfterFirstPaint(callback) {
  const run = () => callback();
  if (typeof window.requestAnimationFrame !== 'function') {
    run();
    return;
  }
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(run);
  });
}

function scheduleIdle(callback, timeout = 1600) {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(callback, { timeout });
    return;
  }
  window.setTimeout(callback, 1);
}

function basename(url) {
  return String(url || '').split('/').pop() || String(url || 'module');
}

function round(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function checklist() {
  return {
    version: BROWSER_DIAGNOSTICS_VERSION,
    expectedShellVersion: EXPECTED_SHELL_VERSION,
    staleAssetCount: staleAssetUrls.length,
    staleAssetUrls: staleAssetUrls.slice(),
    isChrome,
    isEdge,
    userAgent: ua,
    moduleFailureCount: moduleFailures.length,
    runtimeWarningCount: runtimeWarnings.length,
    diagnosticsScheduled,
    diagnosticsComplete,
    webglInfo,
    frameSample,
    wheelLatency,
    helpApi: true,
    noIntervalPolling: true,
    frameTimeProbe: true,
    wheelLatencyProbe: true,
    staleShellProbe: true,
    deferredWebglProbe: true
  };
}
