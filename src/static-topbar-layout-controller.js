// Static topbar/ribbon layout controller.
// The static shell now owns first-paint geometry. This module must not move
// controls or inject layout-changing CSS during the default boot path.

const VERSION = 'perf-idle-topbar-layout-20260620';

const MARKUP_IDS = ['staticTagBtn', 'staticIsonoteXmlBtn', 'staticImportXmlBtn'];
const SESSION_IDS = ['staticSaveSessionBtn', 'staticRestoreSessionBtn', 'staticClearSessionBtn'];
const EXPORT_IDS = ['downloadGlbBtn', 'downloadRvmBtn', 'downloadAttBtn', 'downloadAuditBtn', 'staticXmlQaBtn', 'staticExportXmlBtn'];
const PROXIED_IDS = [...MARKUP_IDS, ...SESSION_IDS, ...EXPORT_IDS];

let fullLayoutEnabled = false;
let menuCloseBound = false;

runWhenReady(initStaticTopbarLayout);

function runWhenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function initStaticTopbarLayout() {
  groupViewFitDisplay();
  bindMenuCloseOnly();

  const api = {
    version: VERSION,
    mode: shouldEnableFullTopbarLayout() ? 'full-opt-in' : 'static-shell',
    refresh: refreshLayout,
    enableFullLayout
  };
  window.__3D_MARKUP_STATIC_TOPBAR_LAYOUT__ = api;

  if (shouldEnableFullTopbarLayout()) enableFullLayout();
}

function shouldEnableFullTopbarLayout() {
  const params = new URLSearchParams(window.location.search);
  return params.has('topbarLayout')
    || params.has('fullTopbarLayout')
    || window.localStorage.getItem('3dmarkup.fullTopbarLayout') === '1';
}

function enableFullLayout() {
  if (fullLayoutEnabled) return;
  fullLayoutEnabled = true;
  injectStyles();
  groupViewFitDisplay();
  ensureTopbarMenus();
  improveHealthStatus();
  bindUpdates();
  refreshLayout();
}

function injectStyles() {
  if (document.getElementById('staticTopbarLayoutStyles')) return;
  const style = document.createElement('style');
  style.id = 'staticTopbarLayoutStyles';
  style.textContent = `
    .topbar-actions { gap: 8px; align-items: center; }
    .top-menu-wrap { position: relative; }
    .top-menu-btn {
      min-height: 42px;
      padding: 0 12px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      border-radius: 10px;
      font-weight: 950;
      white-space: nowrap;
    }
    .top-menu-btn svg { width: 16px; height: 16px; }
    .top-menu-btn::after { content: '▾'; font-size: 10px; opacity: .75; margin-left: 2px; }
    .top-menu-popover {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      z-index: 90;
      min-width: 220px;
      display: grid;
      gap: 5px;
      padding: 8px;
      border: 1px solid rgba(83,125,176,.45);
      border-radius: 12px;
      background: rgba(4, 14, 28, .98);
      box-shadow: 0 18px 44px rgba(0,0,0,.42);
    }
    .top-menu-popover[hidden] { display: none; }
    .top-menu-popover button {
      width: 100%;
      min-height: 34px;
      justify-content: flex-start;
      display: flex;
      align-items: center;
      gap: 8px;
      border-radius: 8px;
      padding: 6px 9px;
      font-size: 11px;
      text-align: left;
    }
    .top-menu-popover button svg { width: 15px; height: 15px; }
    .top-menu-note {
      padding: 5px 7px 2px;
      color: #94abc6;
      font-size: 10px;
      line-height: 1.3;
    }
    .app-health-pill {
      min-width: 142px;
      min-height: 42px;
      display: grid;
      grid-template-rows: auto 5px auto;
      gap: 3px;
      padding: 6px 10px;
      border-radius: 12px;
      border: 1px solid rgba(39,224,161,.45);
      background: rgba(3, 45, 39, .65);
      color: #dffdf5;
      line-height: 1.05;
      white-space: nowrap;
      box-sizing: border-box;
    }
    .app-health-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
    .app-health-top strong { font-size: 11px; font-weight: 1000; }
    .app-health-top b { font-size: 12px; font-weight: 1000; color: #39f0bd; }
    .app-health-bar { position: relative; height: 5px; border-radius: 999px; overflow: hidden; background: rgba(255,255,255,.12); }
    .app-health-bar span { display: block; height: 100%; width: var(--health-pct, 0%); border-radius: inherit; background: linear-gradient(90deg, #1fa7ff, #28e0a1); transition: width .18s ease; }
    .app-health-detail { font-size: 9.5px; color: rgba(213,255,244,.78); font-weight: 800; overflow: hidden; text-overflow: ellipsis; }
    .app-health-pill.warn { border-color: rgba(255,171,53,.62); background: rgba(61, 39, 8, .68); color: #ffe6b5; }
    .app-health-pill.warn .app-health-top b { color: #ffc15d; }
    .app-health-pill.warn .app-health-bar span { background: linear-gradient(90deg, #ff9d2e, #ffd166); }
    .app-health-pill.bad { border-color: rgba(255,90,110,.62); background: rgba(62, 8, 20, .68); color: #ffd7dc; }
    .app-health-pill.bad .app-health-top b { color: #ff7f93; }
    .app-health-pill.bad .app-health-bar span { background: linear-gradient(90deg, #ff4d6d, #ff8fa3); }
  `;
  document.head.appendChild(style);
}

function groupViewFitDisplay() {
  const viewGroup = document.querySelector('[aria-label="View tools"]');
  if (viewGroup) {
    viewGroup.dataset.expandedGroup = 'view-fit';
    viewGroup.dataset.expandedLabel = 'View / Fit';
  }
  const displayGroup = document.querySelector('[data-group="display"]');
  if (displayGroup) {
    displayGroup.dataset.expandedGroup = 'display';
    displayGroup.dataset.expandedLabel = 'Display';
  }
}

function ensureTopbarMenus() {
  const actions = document.querySelector('.topbar-actions');
  const props = document.getElementById('togglePropsBtn');
  if (!actions || !props) return;

  const markup = ensureMenu('topMarkupMenu', 'Markup', 'tag', MARKUP_IDS, 'Tag, ISONOTE XML, and XML import tools');
  const session = ensureMenu('topSessionMenu', 'Session', 'save', SESSION_IDS, 'Browser session actions');
  const exp = ensureMenu('topExportMenu', 'Export', 'download', EXPORT_IDS, 'Downloads use existing export buttons');

  if (markup && markup.parentElement !== actions) props.after(markup);
  if (session && session.parentElement !== actions) markup?.after(session);
  if (exp && exp.parentElement !== actions) session?.after(exp);
}

function ensureMenu(id, label, icon, itemIds, note) {
  let wrap = document.getElementById(id);
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = id;
    wrap.className = 'top-menu-wrap';
    wrap.innerHTML = `
      <button type="button" class="top-menu-btn panel-toggle" aria-expanded="false"><i data-lucide="${icon}"></i><span>${label}</span></button>
      <div class="top-menu-popover" hidden role="menu"></div>
    `;
    const btn = wrap.querySelector('.top-menu-btn');
    btn?.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleMenu(wrap);
    });
  }
  const pop = wrap.querySelector('.top-menu-popover');
  if (pop && !pop.dataset.boundProxyMenu) {
    pop.dataset.boundProxyMenu = '1';
    itemIds.forEach((itemId) => {
      const source = document.getElementById(itemId);
      const proxy = document.createElement('button');
      proxy.type = 'button';
      proxy.dataset.proxyFor = itemId;
      proxy.disabled = !source || source.disabled;
      proxy.innerHTML = menuItemHtml(source, itemId);
      proxy.addEventListener('click', () => {
        const liveSource = document.getElementById(itemId);
        if (!liveSource || liveSource.disabled) return;
        liveSource.click();
        closeMenus();
      });
      pop.appendChild(proxy);
    });
    const noteEl = document.createElement('div');
    noteEl.className = 'top-menu-note';
    noteEl.textContent = note;
    pop.appendChild(noteEl);
  }
  return wrap;
}

function menuItemHtml(source, id) {
  const sourceIcon = source?.querySelector('svg, i')?.outerHTML || '<span aria-hidden="true">•</span>';
  const label = source?.querySelector('span')?.textContent?.trim()
    || source?.textContent?.replace(/\s+/g, ' ').trim()
    || id.replace(/^static|Btn$|download/gi, '');
  return `${sourceIcon}<span>${escapeHtml(label)}</span>`;
}

function toggleMenu(wrap) {
  const pop = wrap.querySelector('.top-menu-popover');
  const btn = wrap.querySelector('.top-menu-btn');
  const willOpen = pop?.hidden;
  closeMenus();
  if (!pop || !willOpen) return;
  refreshTopbarMenus();
  pop.hidden = false;
  btn?.setAttribute('aria-expanded', 'true');
}

function closeMenus() {
  document.querySelectorAll('.top-menu-popover').forEach((pop) => { pop.hidden = true; });
  document.querySelectorAll('.top-menu-btn[aria-expanded="true"]').forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
}

function improveHealthStatus() {
  const actions = document.querySelector('.topbar-actions');
  if (!actions || document.getElementById('appHealthPill')) return;
  const health = document.createElement('div');
  health.id = 'appHealthPill';
  health.className = 'app-health-pill warn';
  health.setAttribute('role', 'status');
  health.setAttribute('aria-live', 'polite');
  health.innerHTML = '<div class="app-health-top"><strong>Starting</strong><b>0%</b></div><div class="app-health-bar"><span></span></div><div class="app-health-detail">UI loading</div>';
  actions.appendChild(health);
}

function bindMenuCloseOnly() {
  if (menuCloseBound) return;
  menuCloseBound = true;
  window.addEventListener('click', (event) => {
    if (!event.target?.closest?.('.top-menu-wrap')) closeMenus();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenus();
  });
}

function bindUpdates() {
  ['viewer:ui-score-changed', 'markup:app-ready', 'markup:render-context', 'viewer:model-loaded', 'viewer:selection-changed', 'viewer:grid-visibility-changed']
    .forEach((name) => window.addEventListener(name, refreshLayout));
}

function refreshLayout() {
  groupViewFitDisplay();
  if (fullLayoutEnabled) {
    ensureTopbarMenus();
    refreshTopbarMenus();
    refreshHealth();
    if (window.lucide?.createIcons) {
      try { window.lucide.createIcons(); } catch { /* inline icons may already be SVG */ }
    }
  }
}

function refreshTopbarMenus() {
  document.querySelectorAll('.top-menu-popover [data-proxy-for]').forEach((proxy) => {
    const source = document.getElementById(proxy.dataset.proxyFor);
    proxy.disabled = !source || source.disabled;
  });
}

function refreshHealth() {
  const health = document.getElementById('appHealthPill');
  if (!health) return;
  const runtimeText = String(document.getElementById('runtimeStatus')?.textContent || '').trim();
  const score = window.__3D_MARKUP_UI_SCORE__ || {};
  const loaded = Number(score.loaded || 0);
  const enabled = Number(score.enabled || 0);
  const modelReady = modelIsReady();
  const exportsReady = ['downloadGlbBtn', 'downloadRvmBtn', 'downloadAttBtn'].some((id) => !document.getElementById(id)?.disabled);
  const uiPct = loaded ? Math.max(0, Math.min(100, Math.round((enabled / loaded) * 100))) : 0;

  let state = 'Ready';
  let detail = `${enabled}/${loaded || '?'} UI enabled`;
  let cls = 'app-health-pill';
  let pct = uiPct;
  if (/failed|error/i.test(runtimeText)) {
    state = 'Needs attention';
    detail = runtimeText || detail;
    cls += ' bad';
    pct = Math.min(uiPct, 45);
  } else if (exportsReady) {
    state = 'Review ready';
    detail = `Exports ready · ${enabled}/${loaded || '?'} UI`;
  } else if (modelReady) {
    state = 'Model ready';
    detail = `Inspect / select · ${enabled}/${loaded || '?'} UI`;
    pct = Math.max(pct, 70);
  } else if (/ready|converted/i.test(runtimeText)) {
    state = 'App ready';
    detail = `Load or convert · ${enabled}/${loaded || '?'} UI`;
    pct = Math.max(pct, 55);
  } else {
    state = 'Starting';
    detail = runtimeText || detail;
    cls += ' warn';
    pct = Math.max(pct, 20);
  }
  health.className = cls;
  health.style.setProperty('--health-pct', `${pct}%`);
  health.innerHTML = `
    <div class="app-health-top"><strong>${escapeHtml(state)}</strong><b>${pct}%</b></div>
    <div class="app-health-bar"><span></span></div>
    <div class="app-health-detail">${escapeHtml(detail)}</div>
  `;
  health.title = [
    `Application state: ${state}`,
    `Health: ${pct}%`,
    `Detail: ${detail}`,
    loaded ? `UI loaded: ${loaded}` : '',
    loaded ? `UI enabled: ${enabled}` : ''
  ].filter(Boolean).join('\n');
}

function modelIsReady() {
  const objectStatus = String(document.getElementById('componentStatus')?.textContent || '').trim();
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
  if (runtime.modelRoot || runtime.scene) return true;
  const match = objectStatus.match(/Objects:\s*(\d+)/i);
  return Number(match?.[1] || 0) > 0;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
