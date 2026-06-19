// Static quick export core controller.
// Export downloads now live in the topbar Export menu. This module remains as a
// compatibility bridge for legacy diagnostics/state refresh, but it must not add a
// second GLB/RVM/ATT/QA ribbon group.

const VERSION = 'static-quick-export-menu-only-20260619';
const EXPORTS = [
  { id: 'quickDownloadGlbBtn', label: 'GLB ↓', title: 'Download GLB', target: 'downloadGlbBtn' },
  { id: 'quickDownloadRvmBtn', label: 'RVM ↓', title: 'Download RVM', target: 'downloadRvmBtn' },
  { id: 'quickDownloadAttBtn', label: 'ATT ↓', title: 'Download ATT attributes', target: 'downloadAttBtn' },
  { id: 'quickDownloadAuditBtn', label: 'QA', title: 'Download conversion audit JSON', target: 'downloadAuditBtn' }
];

installQuickExports();

function installQuickExports() {
  const start = () => {
    removeQuickExportGroup();
    syncQuickExportState();
    observeDownloadButtons();
    window.__3D_MARKUP_STATIC_QUICK_EXPORT__ = {
      version: VERSION,
      refresh: syncQuickExportState,
      removeRibbonGroup: removeQuickExportGroup,
      mode: 'topbar-export-menu-only'
    };
    window.dispatchEvent(new CustomEvent('viewer:ui-controls-changed', { detail: { feature: 'quick-export-menu-only' } }));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}

function removeQuickExportGroup() {
  const group = document.getElementById('quickExportGroup');
  if (!group) return false;
  group.remove();
  return true;
}

function syncQuickExportState() {
  removeQuickExportGroup();
  EXPORTS.forEach((item) => {
    const proxy = document.getElementById(item.id);
    const target = document.getElementById(item.target);
    if (proxy) {
      const enabled = Boolean(target && !target.disabled);
      proxy.disabled = !enabled;
      proxy.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      proxy.classList.toggle('ready', enabled);
    }
    const menuProxy = document.querySelector(`[data-proxy-for="${item.target}"]`);
    if (menuProxy) menuProxy.disabled = !target || target.disabled;
  });
  window.dispatchEvent(new CustomEvent('viewer:ui-controls-changed', { detail: { feature: 'quick-export-state' } }));
}

function observeDownloadButtons() {
  EXPORTS.forEach((item) => {
    const target = document.getElementById(item.target);
    if (!target || target.__quickExportObserved) return;
    target.__quickExportObserved = true;
    new MutationObserver(syncQuickExportState).observe(target, { attributes: true, attributeFilter: ['disabled', 'class', 'aria-disabled'] });
  });

  window.addEventListener('markup:app-ready', syncQuickExportState);
  window.addEventListener('viewer:model-loaded', syncQuickExportState);
  window.addEventListener('viewer:ui-score-changed', () => window.setTimeout(syncQuickExportState, 0));
  window.setTimeout(syncQuickExportState, 300);
  window.setTimeout(syncQuickExportState, 1200);
}
