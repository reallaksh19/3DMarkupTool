// Static quick export core controller.
// Adds visible top-ribbon export proxies for the existing drawer download buttons.
// This is UI wiring only: it does not alter GLB/RVM/ATT writer logic.

const VERSION = 'static-quick-export-core-20260618';
const EXPORTS = [
  { id: 'quickDownloadGlbBtn', label: 'GLB ↓', title: 'Download GLB', target: 'downloadGlbBtn' },
  { id: 'quickDownloadRvmBtn', label: 'RVM ↓', title: 'Download RVM', target: 'downloadRvmBtn' },
  { id: 'quickDownloadAttBtn', label: 'ATT ↓', title: 'Download ATT attributes', target: 'downloadAttBtn' },
  { id: 'quickDownloadAuditBtn', label: 'QA', title: 'Download conversion audit JSON', target: 'downloadAuditBtn' }
];

installQuickExports();

function installQuickExports() {
  const start = () => {
    createQuickExportGroup();
    syncQuickExportState();
    observeDownloadButtons();
    window.__3D_MARKUP_STATIC_QUICK_EXPORT__ = { version: VERSION, refresh: syncQuickExportState };
    window.dispatchEvent(new CustomEvent('viewer:ui-controls-changed', { detail: { feature: 'quick-export' } }));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}

function createQuickExportGroup() {
  if (document.getElementById('quickExportGroup')) return;
  const ribbon = document.querySelector('.main-ribbon');
  if (!ribbon) return;

  const group = document.createElement('div');
  group.id = 'quickExportGroup';
  group.className = 'tool-group toolbar-group quick-export-group';
  group.setAttribute('aria-label', 'Quick export downloads');

  EXPORTS.forEach((item) => {
    const button = document.createElement('button');
    button.id = item.id;
    button.type = 'button';
    button.className = 'tool-btn quick-export-btn';
    button.title = item.title;
    button.setAttribute('aria-label', item.title);
    button.dataset.proxyTarget = item.target;
    button.innerHTML = `<span>${escapeHtml(item.label)}</span>`;
    button.addEventListener('click', () => proxyDownload(item.target));
    group.appendChild(button);
  });

  const previewGroup = document.getElementById('previewRvmBtn')?.closest('.tool-group');
  if (previewGroup?.parentElement === ribbon) previewGroup.after(group);
  else ribbon.appendChild(group);
}

function proxyDownload(targetId) {
  const target = document.getElementById(targetId);
  if (!target || target.disabled) return;
  target.click();
}

function syncQuickExportState() {
  EXPORTS.forEach((item) => {
    const proxy = document.getElementById(item.id);
    const target = document.getElementById(item.target);
    if (!proxy) return;
    const enabled = Boolean(target && !target.disabled);
    proxy.disabled = !enabled;
    proxy.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    proxy.classList.toggle('ready', enabled);
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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}
