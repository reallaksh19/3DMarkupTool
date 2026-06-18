const AUTO_RUN_DELAY_MS = 750;
const RECHECK_DELAY_MS = 300;

const state = {
  initialized: false,
  latest: null,
  runs: []
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAcceptanceHarness, { once: true });
} else {
  initAcceptanceHarness();
}

function initAcceptanceHarness() {
  if (state.initialized) return;
  state.initialized = true;

  window.__3D_MARKUP_UI_ACCEPTANCE__ = {
    run,
    latest: () => state.latest,
    history: () => [...state.runs]
  };

  window.addEventListener('markup:safe-ui-status', () => scheduleRun('safe-ui-status', RECHECK_DELAY_MS));
  window.addEventListener('markup:two-row-icon-ribbon-ready', () => scheduleRun('two-row-ribbon-ready', RECHECK_DELAY_MS));
  window.addEventListener('viewer:runtime-context', () => scheduleRun('runtime-context', RECHECK_DELAY_MS));
  window.addEventListener('viewer:model-loaded', () => scheduleRun('model-loaded', RECHECK_DELAY_MS));

  scheduleRun('startup', AUTO_RUN_DELAY_MS);
}

function scheduleRun(reason, delay) {
  window.clearTimeout(scheduleRun.timer);
  scheduleRun.timer = window.setTimeout(() => run(reason), delay);
}

function run(reason = 'manual') {
  const checks = [
    checkSafeUiStatus,
    checkRuntimeBridge,
    checkInputDrawer,
    checkTwoRowRibbon,
    checkNoStartupContextMenu,
    checkNoLegacyRows,
    checkColorByLocation,
    checkExportMenus,
    checkClipUi,
    checkTreeUi,
    checkDownloadButtons,
    checkNoHeaderOverflow
  ];

  const results = checks.map((check) => safeCheck(check));
  const summary = summarize(reason, results);
  state.latest = summary;
  state.runs.push(summary);
  if (state.runs.length > 20) state.runs.shift();

  report(summary);
  window.dispatchEvent(new CustomEvent('markup:ui-acceptance-result', { detail: summary }));
  return summary;
}

function safeCheck(check) {
  try {
    return check();
  } catch (error) {
    return fail(check.name || 'anonymous check', error?.message || String(error));
  }
}

function summarize(reason, results) {
  const passCount = results.filter((item) => item.status === 'pass').length;
  const warnCount = results.filter((item) => item.status === 'warn').length;
  const failCount = results.filter((item) => item.status === 'fail').length;
  return {
    reason,
    timestamp: new Date().toISOString(),
    status: failCount ? 'fail' : warnCount ? 'warn' : 'pass',
    passCount,
    warnCount,
    failCount,
    results
  };
}

function report(summary) {
  const label = `[3DMarkupTool acceptance] ${summary.status.toUpperCase()} ${summary.passCount} pass, ${summary.warnCount} warn, ${summary.failCount} fail (${summary.reason})`;
  const table = summary.results.map((item) => ({
    status: item.status,
    check: item.check,
    detail: item.detail
  }));

  if (summary.failCount) console.error(label, summary);
  else if (summary.warnCount) console.warn(label, summary);
  else console.info(label, summary);

  if (console.table) console.table(table);
}

function checkSafeUiStatus() {
  const status = window.__3D_MARKUP_SAFE_UI_STATUS__;
  if (!status) return warn('safe-ui-status', 'Safe UI status object is not published yet.');
  if (status.failed > 0) return fail('safe-ui-status', `${status.failed} optional UI module(s) failed.`);
  return pass('safe-ui-status', `${status.loaded}/${status.total} optional module(s) loaded.`);
}

function checkRuntimeBridge() {
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__;
  if (!runtime) return fail('runtime-bridge', 'window.__3D_MARKUP_VIEWER_RUNTIME__ is missing.');
  const missingMethods = ['applyClipping', 'clearClipping', 'getBounds'].filter((name) => typeof runtime[name] !== 'function');
  if (missingMethods.length) return fail('runtime-bridge', `Missing runtime method(s): ${missingMethods.join(', ')}.`);
  return pass('runtime-bridge', 'Unified runtime bridge is available.');
}

function checkInputDrawer() {
  const drawer = document.getElementById('inputDrawer');
  if (!drawer) return fail('input-drawer', '#inputDrawer is missing.');

  const hasClass = drawer.classList.contains('input-drawer');
  const open = drawer.classList.contains('open') || document.body.classList.contains('input-open');
  const closeBtn = document.getElementById('closeInputBtn');
  const toggleBtn = document.getElementById('toggleInputBtn');

  if (!hasClass) return fail('input-drawer', 'Drawer is missing normalized .input-drawer class.');
  if (!closeBtn || !toggleBtn) return fail('input-drawer', 'Close or reopen button is missing.');
  if (!open) return warn('input-drawer', 'Drawer is not open at this checkpoint; startup default may have been manually changed.');
  return pass('input-drawer', 'Drawer exists, is normalized, and has close/reopen controls.');
}

function checkTwoRowRibbon() {
  const shell = document.querySelector('.app-shell.two-row-icon-shell');
  const ribbon = document.getElementById('twoRowCommandRibbon');
  const count = document.querySelectorAll('#twoRowCommandRibbon').length;
  if (!shell || !ribbon) return fail('two-row-ribbon', 'Two-row shell/ribbon is not ready.');
  if (count !== 1) return fail('two-row-ribbon', `Expected one command ribbon, found ${count}.`);
  return pass('two-row-ribbon', 'Single two-row command ribbon is active.');
}

function checkNoStartupContextMenu() {
  const menu = document.getElementById('visibilityContextMenu');
  if (!menu) return pass('context-menu', 'Visibility context menu has not been created yet.');

  const rect = menu.getBoundingClientRect();
  const visible = !menu.hidden
    && menu.getAttribute('aria-hidden') !== 'true'
    && rect.width > 0
    && rect.height > 0;

  if (visible || menu.classList.contains('open')) {
    return fail('context-menu', 'Visibility context menu is open without a right-click action.');
  }
  return pass('context-menu', 'Visibility context menu is hidden on startup.');
}

function checkNoLegacyRows() {
  const selectors = [
    '.legacy-tag-row',
    '.old-tag-row',
    '.secondary-toolbar',
    '.floating-tag-row',
    '.floating-session-row',
    '.tag-session-row'
  ];

  const visible = selectors.flatMap((selector) => [...document.querySelectorAll(selector)]).filter(isVisible);
  if (visible.length) return fail('legacy-rows', `${visible.length} legacy/floating toolbar row(s) are visible.`);
  return pass('legacy-rows', 'No known legacy/floating toolbar rows are visible.');
}

function checkColorByLocation() {
  const color = document.querySelector('.color-control');
  if (!color) return fail('color-by', 'Color By control is missing.');
  const displayGroup = document.querySelector('#twoRowGroup_display, [data-group="display"]');
  if (!displayGroup) return warn('color-by', 'DISPLAY group is not available yet.');
  if (!displayGroup.contains(color)) return fail('color-by', 'Color By control is not inside DISPLAY group.');
  return pass('color-by', 'Color By control is inside DISPLAY group.');
}

function checkExportMenus() {
  const menuKeys = ['export', 'tags', 'session', 'xml'];
  const missing = menuKeys.filter((key) => !document.querySelector(`.two-row-menu[data-menu-key="${key}"], #twoRowMenu_${key}`));
  if (missing.length) return fail('ribbon-menus', `Missing menu(s): ${missing.join(', ')}.`);

  const openOnStartup = menuKeys.filter((key) => {
    const menu = document.querySelector(`.two-row-menu-popover[data-menu-key="${key}"], #twoRowMenuPopover_${key}`);
    return menu && isVisible(menu);
  });
  if (openOnStartup.length) return fail('ribbon-menus', `Menu popover(s) open on startup: ${openOnStartup.join(', ')}.`);

  return pass('ribbon-menus', 'Export/Tags/Session/XML menus exist and are closed.');
}

function checkClipUi() {
  const clipButton = document.getElementById('clipBtn');
  const slider = document.getElementById('clipSlider');
  const hint = document.getElementById('clipAdjustHint');
  const boxButton = document.getElementById('clipBoxToggleBtn') || document.querySelector('[data-clip-box-toggle]');

  if (!clipButton) return fail('clip-ui', 'Clip button is missing.');
  if (!slider || !hint) return fail('clip-ui', 'Clip adjust slider or hint is missing.');
  if (!boxButton) return warn('clip-ui', 'Clip Box toggle not detected yet.');

  const text = (clipButton.textContent || '').trim();
  if (/clip\s+off/i.test(text)) return warn('clip-ui', 'Clip button still contains legacy visible text.');
  return pass('clip-ui', 'Clip plane controls are present and Clip Box toggle is available.');
}

function checkTreeUi() {
  const treeApi = window.__3D_MARKUP_TREE__;
  const button = document.getElementById('treeToggleBtn') || document.querySelector('[data-tree-toggle]');
  const panel = document.getElementById('modelTreePanel') || document.querySelector('.model-tree-panel');
  const viewer = document.getElementById('viewer');

  if (!treeApi || typeof treeApi.toggle !== 'function') return fail('tree-ui', 'window.__3D_MARKUP_TREE__.toggle is missing.');
  if (!button) return fail('tree-ui', 'Tree toggle button is missing.');
  if (panel && viewer && !viewer.contains(panel)) return fail('tree-ui', 'Tree panel is not mounted under #viewer.');
  return pass('tree-ui', 'Tree API and toggle are available; panel mount is valid.');
}

function checkDownloadButtons() {
  const ids = ['downloadGlbBtn', 'downloadRvmBtn', 'downloadAttBtn'];
  const missing = ids.filter((id) => !document.getElementById(id));
  if (missing.length) return fail('download-buttons', `Missing download button(s): ${missing.join(', ')}.`);
  return pass('download-buttons', 'GLB/RVM/ATT download buttons exist.');
}

function checkNoHeaderOverflow() {
  const header = document.querySelector('.app-shell');
  const ribbon = document.getElementById('twoRowCommandRibbon');
  const target = ribbon || header;
  if (!target) return warn('header-overflow', 'Header/ribbon not available yet.');
  if (!target.clientWidth) return warn('header-overflow', 'Header/ribbon has zero measured width.');

  const overflow = target.scrollWidth - target.clientWidth;
  if (overflow > 4) return fail('header-overflow', `Horizontal overflow detected: ${overflow}px.`);
  return pass('header-overflow', 'No horizontal overflow detected in ribbon/header.');
}

function pass(check, detail) {
  return { status: 'pass', check, detail };
}

function warn(check, detail) {
  return { status: 'warn', check, detail };
}

function fail(check, detail) {
  return { status: 'fail', check, detail };
}

function isVisible(element) {
  if (!element || element.hidden) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
