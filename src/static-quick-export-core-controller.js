// Static quick export core controller.
// Phase 3 menu-only mode: keep downloads under the topbar Export menu and do
// not create duplicate ribbon export tiles.

const VERSION = 'static-quick-export-core-menu-only-20260619';
const EXPORTS = [
  { id: 'quickDownloadGlbBtn', label: 'GLB ↓', title: 'Download GLB', target: 'downloadGlbBtn' },
  { id: 'quickDownloadRvmBtn', label: 'RVM ↓', title: 'Download RVM', target: 'downloadRvmBtn' },
  { id: 'quickDownloadAttBtn', label: 'ATT ↓', title: 'Download ATT attributes', target: 'downloadAttBtn' },
  { id: 'quickDownloadAuditBtn', label: 'QA', title: 'Download conversion audit JSON', target: 'downloadAuditBtn' }
];

installQuickExports();

function installQuickExports() {
  const start = () => {
    removeLegacyQuickExportGroup();
    syncQuickExportState();
    observeDownloadButtons();
    window.__3D_MARKUP_STATIC_QUICK_EXPORT__ = { version: VERSION, menuOnly: true, refresh: syncQuickExportState };
    window.dispatchEvent(new CustomEvent('viewer:ui-controls-changed', { detail: { feature: 'quick-export-menu-only' } }));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}

function removeLegacyQuickExportGroup() {
  document.querySelectorAll('#quickExportGroup, .quick-export-group').forEach((group) => {
    group.dataset.quickExportMenuOnlyRemoved = 'true';
    group.hidden = true;
    group.setAttribute('aria-hidden', 'true');
    group.style.display = 'none';
  });
}

function proxyDownload(targetId) {
  const target = document.getElementById(targetId);
  if (!target || target.disabled) return;
  target.click();
}

function syncQuickExportState() {
  removeLegacyQuickExportGroup();
  EXPORTS.forEach((item) => {
    const target = document.getElementById(item.target);
    const enabled = Boolean(target && !target.disabled);
    document.querySelectorAll(`[data-proxy-for="${cssEscape(item.target)}"], [data-proxy-target="${cssEscape(item.target)}"]`).forEach((proxy) => {
      proxy.disabled = !enabled;
      proxy.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      proxy.classList.toggle('ready', enabled);
      proxy.title = item.title;
    });
  });
  window.dispatchEvent(new CustomEvent('viewer:ui-controls-changed', { detail: { feature: 'quick-export-menu-only-state' } }));
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
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value));
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}
