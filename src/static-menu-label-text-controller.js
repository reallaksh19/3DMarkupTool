// Adds explicit readable labels to topbar menu proxy buttons.
// The Markup and Session source buttons use compact glyph spans, so this
// controller ensures the dropdowns never render as icon-only rows.

const VERSION = 'topbar-menu-label-text-20260619';

const MENU_LABELS = {
  staticTagBtn: 'Tag',
  staticIsonoteXmlBtn: 'ISONOTE XML',
  staticImportXmlBtn: 'Import XML',
  staticSaveSessionBtn: 'Save Session',
  staticRestoreSessionBtn: 'Restore Session',
  staticClearSessionBtn: 'Clear Session',
  downloadGlbBtn: 'Download GLB',
  downloadRvmBtn: 'Download RVM',
  downloadAttBtn: 'Download ATT',
  downloadAuditBtn: 'Download Audit',
  staticXmlQaBtn: 'XML QA',
  staticExportXmlBtn: 'Export XML'
};

runWhenReady(initMenuLabelText);

function runWhenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function initMenuLabelText() {
  ensureStyles();
  applyMenuLabels();
  ['viewer:ui-controls-changed', 'viewer:status-message', 'viewer:model-loaded', 'markup:render-context']
    .forEach((eventName) => window.addEventListener(eventName, applyMenuLabels));
  document.addEventListener('click', (event) => {
    if (event.target?.closest?.('.top-menu-wrap')) window.setTimeout(applyMenuLabels, 0);
  }, true);
  observeTopbar();
  window.__3D_MARKUP_TOPBAR_MENU_LABELS__ = {
    version: VERSION,
    labels: { ...MENU_LABELS },
    refresh: applyMenuLabels,
    checklist
  };
  window.dispatchEvent(new CustomEvent('viewer:topbar-menu-labels-ready', { detail: checklist() }));
}

function ensureStyles() {
  if (document.getElementById('topbarMenuLabelTextStyles')) return;
  const style = document.createElement('style');
  style.id = 'topbarMenuLabelTextStyles';
  style.textContent = `
    .top-menu-popover [data-proxy-for] span.top-menu-item-label,
    .top-menu-popover [data-proxy-for] span:not(.static-tool-icon) {
      display: inline-block;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .top-menu-popover [data-proxy-for][data-menu-label-fixed="true"] {
      grid-template-columns: auto 1fr;
    }
  `;
  document.head.appendChild(style);
}

function applyMenuLabels() {
  document.querySelectorAll('.top-menu-popover [data-proxy-for]').forEach((button) => {
    const id = button.dataset.proxyFor;
    const label = MENU_LABELS[id];
    if (!label) return;
    ensureButtonLabel(button, label);
    button.title = label;
    button.setAttribute('aria-label', label);
    button.dataset.menuLabelFixed = 'true';
  });
}

function ensureButtonLabel(button, label) {
  const spans = Array.from(button.querySelectorAll('span'));
  let labelSpan = spans.find((span) => !span.classList.contains('static-tool-icon') && span.textContent.trim() === label)
    || spans.find((span) => span.classList.contains('top-menu-item-label'))
    || spans.find((span) => !span.classList.contains('static-tool-icon'));
  if (!labelSpan) {
    labelSpan = document.createElement('span');
    labelSpan.className = 'top-menu-item-label';
    button.appendChild(labelSpan);
  }
  labelSpan.classList.add('top-menu-item-label');
  labelSpan.textContent = label;
}

function observeTopbar() {
  const topbar = document.querySelector('.topbar-actions');
  if (!topbar || typeof MutationObserver !== 'function') return;
  const observer = new MutationObserver(() => applyMenuLabels());
  observer.observe(topbar, { childList: true, subtree: true });
}

function checklist() {
  const ids = Object.keys(MENU_LABELS);
  const rows = ids.map((id) => {
    const button = document.querySelector(`.top-menu-popover [data-proxy-for="${id}"]`);
    const label = MENU_LABELS[id];
    const text = button?.textContent?.replace(/\s+/g, ' ').trim() || '';
    return {
      id,
      label,
      present: Boolean(button),
      labelVisible: text.includes(label),
      aria: button?.getAttribute('aria-label') || '',
      title: button?.title || ''
    };
  });
  return {
    version: VERSION,
    rows,
    allKnownLabelsVisible: rows.every((row) => !row.present || row.labelVisible),
    markupLabels: rows.filter((row) => row.id.startsWith('static') && !row.id.includes('Session')),
    sessionLabels: rows.filter((row) => row.id.includes('Session'))
  };
}
