// Static topbar/ribbon layout controller.
// Keeps View/Fit/Display expanded while moving Color By into Display and
// placing Session/Export as topbar menus after Props.

const VERSION = 'static-topbar-layout-session-export-20260619';

const SESSION_IDS = ['staticSaveSessionBtn', 'staticRestoreSessionBtn', 'staticClearSessionBtn'];
const EXPORT_IDS = ['downloadGlbBtn', 'downloadRvmBtn', 'downloadAttBtn', 'downloadAuditBtn', 'staticExportXmlBtn'];

runWhenReady(initStaticTopbarLayout);

function runWhenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function initStaticTopbarLayout() {
  injectStyles();
  groupViewFitDisplay();
  moveColorByToDisplay();
  ensureTopbarMenus();
  improveHealthStatus();
  bindUpdates();
  window.__3D_MARKUP_STATIC_TOPBAR_LAYOUT__ = {
    version: VERSION,
    refresh: refreshLayout
  };
  refreshLayout();
}

function injectStyles() {
  if (document.getElementById('staticTopbarLayoutStyles')) return;
  const style = document.createElement('style');
  style.id = 'staticTopbarLayoutStyles';
  style.textContent = `
    .topbar-actions { gap: 8px; align-items: center; }
    .topbar-actions .color-control { display: none !important; }

    .main-ribbon { align-items: stretch; gap: 8px; }
    .toolbar-group[data-expanded-group] {
      position: relative;
      padding-top: 16px;
    }
    .toolbar-group[data-expanded-group]::before {
      content: attr(data-expanded-label);
      position: absolute;
      top: 2px;
      left: 10px;
      color: rgba(169, 195, 226, .78);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: .08em;
      text-transform: uppercase;
      pointer-events: none;
    }

    .display-color-inline {
      min-width: 170px;
      height: 56px;
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 2px;
      align-items: center;
      padding: 6px 8px;
      border: 1px solid rgba(83,125,176,.38);
      border-radius: 10px;
      background: rgba(11,29,51,.76);
      color: #e6f0ff;
      box-sizing: border-box;
    }
    .display-color-inline span {
      font-size: 9px;
      font-weight: 950;
      letter-spacing: .04em;
      color: #a9c3e2;
      line-height: 1;
    }
    .display-color-inline select {
      height: 28px;
      min-height: 28px !important;
      padding: 3px 28px 3px 8px;
      border-radius: 7px;
      font-size: 11px;
      font-weight: 800;
      background-color: rgba(6, 22, 40, .88);
      color: #fff;
    }

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
      min-width: 210px;
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
      min-height: 42px;
      display: grid;
      align-content: center;
      gap: 1px;
      padding: 6px 12px;
      border-radius: 12px;
      border: 1px solid rgba(39,224,161,.45);
      background: rgba(3, 45, 39, .65);
      color: #dffdf5;
      line-height: 1.05;
      white-space: nowrap;
    }
    .app-health-pill strong { font-size: 11px; font-weight: 1000; }
    .app-health-pill span { font-size: 9.5px; color: rgba(213,255,244,.78); font-weight: 800; }
    .app-health-pill.warn { border-color: rgba(255,171,53,.62); background: rgba(61, 39, 8, .68); color: #ffe6b5; }
    .app-health-pill.bad { border-color: rgba(255,90,110,.62); background: rgba(62, 8, 20, .68); color: #ffd7dc; }
    #runtimeStatus, #uiScorePill { display: none !important; }

    @media (max-width: 1500px) {
      .display-color-inline { min-width: 150px; }
      .top-menu-btn { padding-inline: 10px; }
      .app-health-pill { padding-inline: 10px; }
    }
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

function moveColorByToDisplay() {
  const displayGroup = document.querySelector('[data-group="display"]');
  const select = document.getElementById('colorBySelect');
  if (!displayGroup || !select || document.getElementById('displayColorInline')) return;

  const inline = document.createElement('label');
  inline.id = 'displayColorInline';
  inline.className = 'display-color-inline';
  inline.innerHTML = '<span>Color By</span>';
  inline.appendChild(select);

  const legend = document.getElementById('colorLegendBtn');
  if (legend?.parentElement === displayGroup) displayGroup.insertBefore(inline, legend);
  else displayGroup.insertBefore(inline, displayGroup.firstChild);
}

function ensureTopbarMenus() {
  const actions = document.querySelector('.topbar-actions');
  const props = document.getElementById('togglePropsBtn');
  if (!actions || !props) return;

  const session = ensureMenu('topSessionMenu', 'Session', 'save', SESSION_IDS, 'Browser session actions');
  const exp = ensureMenu('topExportMenu', 'Export', 'download', EXPORT_IDS, 'Downloads use existing export buttons');

  if (session && session.parentElement !== actions) props.after(session);
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
  if (pop) {
    pop.innerHTML = '';
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
  health.innerHTML = '<strong>Starting</strong><span>UI loading</span>';
  actions.appendChild(health);
}

function bindUpdates() {
  window.addEventListener('click', (event) => {
    if (!event.target?.closest?.('.top-menu-wrap')) closeMenus();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenus();
  });
  ['viewer:ui-score-changed', 'markup:app-ready', 'markup:render-context', 'viewer:model-loaded', 'viewer:selection-changed', 'viewer:grid-visibility-changed']
    .forEach((name) => window.addEventListener(name, refreshLayout));
  window.setInterval(refreshLayout, 1200);
}

function refreshLayout() {
  groupViewFitDisplay();
  moveColorByToDisplay();
  refreshTopbarMenus();
  refreshHealth();
  if (window.lucide?.createIcons) {
    try { window.lucide.createIcons(); } catch { /* inline icons may already be SVG */ }
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

  let state = 'Ready';
  let detail = `${enabled}/${loaded || '?'} UI enabled`;
  let cls = 'app-health-pill';
  if (/failed|error/i.test(runtimeText)) {
    state = 'Needs attention';
    detail = runtimeText || detail;
    cls += ' bad';
  } else if (exportsReady) {
    state = 'Review ready';
    detail = `Model + exports ready · UI ${enabled}/${loaded || '?'}`;
  } else if (modelReady) {
    state = 'Model ready';
    detail = `Select / inspect · UI ${enabled}/${loaded || '?'}`;
  } else if (/ready|converted/i.test(runtimeText)) {
    state = 'App ready';
    detail = `Load or convert · UI ${enabled}/${loaded || '?'}`;
  } else {
    state = 'Starting';
    detail = runtimeText || detail;
    cls += ' warn';
  }
  health.className = cls;
  health.innerHTML = `<strong>${escapeHtml(state)}</strong><span>${escapeHtml(detail)}</span>`;
  health.title = [
    `Application state: ${state}`,
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
