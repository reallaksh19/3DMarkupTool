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
let environmentInfo = null;
let navigationTiming = null;
let memoryInfo = null;
let longTaskStats = null;
let batteryInfo = null;

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
  environmentInfo = collectEnvironmentInfo();
  navigationTiming = collectNavigationTiming();
  memoryInfo = collectMemoryInfo();
  collectBatteryInfo();
  installWheelLatencyProbe();
  sampleFrameTime();
  console.info('[3DMarkupTool:browser-diagnostics:late]', checklist());
}

function collectEnvironmentInfo() {
  const nav = window.navigator || {};
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection || null;
  const reduceMotion = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    hardwareConcurrency: nav.hardwareConcurrency || null,
    deviceMemoryGb: nav.deviceMemory || null,
    devicePixelRatio: window.devicePixelRatio || 1,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    screen: window.screen
      ? { width: window.screen.width, height: window.screen.height, colorDepth: window.screen.colorDepth }
      : null,
    connection: conn
      ? { effectiveType: conn.effectiveType, downlinkMbps: conn.downlink, rttMs: conn.rtt, saveData: conn.saveData }
      : null,
    prefersReducedMotion: reduceMotion,
    online: typeof nav.onLine === 'boolean' ? nav.onLine : null
  };
}

function collectNavigationTiming() {
  try {
    const navEntry = performance.getEntriesByType('navigation')[0];
    const paints = performance.getEntriesByType('paint') || [];
    const fcp = paints.find((p) => p.name === 'first-contentful-paint');
    if (!navEntry) return { firstContentfulPaintMs: fcp ? round(fcp.startTime) : null };
    return {
      ttfbMs: round(navEntry.responseStart),
      domInteractiveMs: round(navEntry.domInteractive),
      domContentLoadedMs: round(navEntry.domContentLoadedEventEnd),
      loadEventMs: round(navEntry.loadEventEnd),
      firstContentfulPaintMs: fcp ? round(fcp.startTime) : null,
      transferKb: navEntry.transferSize ? Math.round(navEntry.transferSize / 1024) : null
    };
  } catch (error) {
    return { error: error && (error.message || String(error)) };
  }
}

function collectMemoryInfo() {
  const m = performance && performance.memory;
  if (!m) return { supported: false };
  return {
    supported: true,
    usedHeapMb: round(m.usedJSHeapSize / 1048576),
    totalHeapMb: round(m.totalJSHeapSize / 1048576),
    limitMb: round(m.jsHeapSizeLimit / 1048576)
  };
}

function collectBatteryInfo() {
  if (!window.navigator || typeof window.navigator.getBattery !== 'function') {
    batteryInfo = { supported: false };
    return;
  }
  window.navigator.getBattery()
    .then((b) => {
      batteryInfo = {
        supported: true,
        charging: b.charging,
        levelPct: Math.round(b.level * 100)
      };
    })
    .catch((error) => {
      batteryInfo = { supported: false, reason: error && (error.message || String(error)) };
    });
}

function startLongTaskObserver() {
  if (typeof PerformanceObserver !== 'function') {
    return { supported: false, count: 0, totalMs: 0, maxMs: 0 };
  }
  const stats = { supported: true, count: 0, totalMs: 0, maxMs: 0, _observer: null };
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        stats.count += 1;
        stats.totalMs = round(stats.totalMs + entry.duration);
        stats.maxMs = Math.max(stats.maxMs, round(entry.duration));
      }
    });
    observer.observe({ type: 'longtask', buffered: false });
    stats._observer = observer;
  } catch (error) {
    return { supported: false, reason: error && (error.message || String(error)), count: 0, totalMs: 0, maxMs: 0 };
  }
  return stats;
}

function finalizeLongTaskObserver(stats) {
  if (stats && stats._observer) {
    try { stats._observer.takeRecords && stats._observer.takeRecords().forEach(() => {}); } catch (_) {}
    try { stats._observer.disconnect(); } catch (_) {}
    delete stats._observer;
  }
  return stats;
}

function interpretFrameSample(sample, longTasks) {
  if (sample.visibilityState && sample.visibilityState !== 'visible') {
    return 'tab-hidden-throttle (frames are paced by the browser, not the app; not real jank)';
  }
  if (sample.hadFocus === false) {
    return 'tab-unfocused-throttle (background-window rAF pacing; not real jank)';
  }
  const slowish = sample.slowFrames >= 8 || sample.p95Ms > 80;
  if (!slowish) return 'nominal';
  if (longTasks && longTasks.supported) {
    if (longTasks.totalMs >= 200) {
      return `main-thread-blocking (${longTasks.count} long tasks, ${longTasks.totalMs}ms total during sample)`;
    }
    return 'raf-throttle-or-vsync (slow frame cadence but main thread idle — suspect power-save, occlusion, DevTools overhead, or capped refresh rate)';
  }
  return 'indeterminate (long-task API unavailable; cannot separate throttle from blocking)';
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
  const startVisibility = document.visibilityState;
  const startFocus = typeof document.hasFocus === 'function' ? document.hasFocus() : null;
  const ltStats = startLongTaskObserver();
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
    const elapsed = now - start;
    const sorted = samples.slice().sort((a, b) => a - b);
    const average = samples.reduce((sum, value) => sum + value, 0) / Math.max(samples.length, 1);
    const max = Math.max(...samples, 0);
    const min = sorted.length ? sorted[0] : 0;
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
    const slowFrames = samples.filter((value) => value > 50).length;
    longTaskStats = finalizeLongTaskObserver(ltStats);
    frameSample = {
      sampleCount: samples.length,
      elapsedMs: round(elapsed),
      averageMs: round(average),
      minMs: round(min),
      medianMs: round(median),
      p95Ms: round(p95),
      maxMs: round(max),
      slowFrames,
      effectiveFps: round(1000 / Math.max(average, 0.0001)),
      terminatedBy: samples.length >= maxFrames ? 'frame-target' : 'time-cap',
      visibilityState: startVisibility,
      hadFocus: startFocus,
      longTasksDuringSample: longTaskStats && longTaskStats.supported ? longTaskStats.count : null,
      longTaskMsDuringSample: longTaskStats && longTaskStats.supported ? longTaskStats.totalMs : null,
      maxLongTaskMs: longTaskStats && longTaskStats.supported ? longTaskStats.maxMs : null,
      startedAt: new Date(start + performance.timeOrigin).toISOString()
    };
    frameSample.likelyCause = interpretFrameSample(frameSample, longTaskStats);
    console.info('[3DMarkupTool:browser-diagnostics:frame]', frameSample);

    // Only warn when the sample reflects a tab the user is actually looking at
    // (visible + focused) AND the main thread was genuinely busy (long tasks).
    // Throttled/occluded samples or idle-main-thread frame pacing are not
    // actionable jank, so they get an info-level note instead of a banner.
    const throttleSuspected = startVisibility !== 'visible' || startFocus === false;
    const mainThreadBusy = longTaskStats && longTaskStats.supported
      ? longTaskStats.totalMs >= 200
      : true; // unknown → fall back to legacy behaviour and warn
    const slowish = slowFrames >= 8 || p95 > 80;
    const rendererName = webglInfo && (webglInfo.unmaskedRenderer || webglInfo.renderer);

    if (isChrome && slowish && !throttleSuspected && mainThreadBusy) {
      recordRuntimeWarning({
        type: 'frame-lag',
        title: 'Chrome frame-time lag detected',
        message: 'Chrome is reporting slow frames while the viewer was focused and the main thread was busy. Try Ctrl+F5, then Chrome DevTools → Network → Disable cache and reload. If it persists, disable Chrome hardware acceleration or test Edge for GPU-driver comparison.',
        detail: `p95=${frameSample.p95Ms}ms, max=${frameSample.maxMs}ms, slowFrames=${slowFrames}, longTasks=${frameSample.longTasksDuringSample} (${frameSample.longTaskMsDuringSample}ms), renderer=${rendererName}`
      });
    } else if (slowish) {
      console.info('[3DMarkupTool:browser-diagnostics] Slow frame cadence not flagged as jank.', {
        likelyCause: frameSample.likelyCause,
        visibilityState: startVisibility,
        hadFocus: startFocus,
        longTaskMs: frameSample.longTaskMsDuringSample
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
      z-index: 9999;
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

function summarizeLongTasks(stats) {
  if (!stats) return null;
  return {
    supported: stats.supported,
    count: stats.count || 0,
    totalMs: stats.totalMs || 0,
    maxMs: stats.maxMs || 0,
    reason: stats.reason
  };
}

function collectAppBootState() {
  return {
    appReady: Boolean(window.__3D_MARKUP_APP_READY__),
    bootComplete: Boolean(window.__3D_MARKUP_APP_BOOT_COMPLETE__),
    bootBundled: Boolean(window.__3D_MARKUP_APP_BOOT_BUNDLED__),
    bootFailed: Boolean(window.__3D_MARKUP_APP_BOOT_FAILED__),
    shellBundleComplete: Boolean(window.__3D_MARKUP_STATIC_SHELL_BUNDLED_IMPORT_COMPLETE__),
    shellBundleFailed: Boolean(window.__3D_MARKUP_STATIC_SHELL_BUNDLED_IMPORT_FAILED__),
    safeUiSkipped: Boolean(window.__3D_MARKUP_SAFE_UI_SKIPPED__)
  };
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
    capturedAt: new Date().toISOString(),
    webglInfo,
    frameSample,
    wheelLatency,
    environmentInfo,
    navigationTiming,
    memoryInfo,
    longTaskStats: summarizeLongTasks(longTaskStats),
    batteryInfo,
    appBoot: collectAppBootState(),
    helpApi: true,
    noIntervalPolling: true,
    frameTimeProbe: true,
    wheelLatencyProbe: true,
    staleShellProbe: true,
    deferredWebglProbe: true
  };
}
