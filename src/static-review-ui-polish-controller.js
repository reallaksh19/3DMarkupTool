// Static review UI polish.
// Default review mode hides experimental clip UI and tightens the shell for model review/export.

const VERSION = 'static-review-ui-polish-no-fresh-clip-20260619';
const CLIP_ENABLED = new URLSearchParams(location.search).has('clipTools')
  || localStorage.getItem('3dmarkup.clipTools') === '1';

runWhenReady(initReviewUiPolish);

function runWhenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function initReviewUiPolish() {
  injectStyles();
  normalizeShellText();
  if (!CLIP_ENABLED) hideClipUi();
  window.addEventListener('viewer:ui-score-changed', () => {
    if (!CLIP_ENABLED) hideClipUi();
  });
  window.__3D_MARKUP_REVIEW_UI_POLISH__ = { version: VERSION, clipEnabled: CLIP_ENABLED, refresh: initReviewUiPolish };
}

function injectStyles() {
  if (document.getElementById('staticReviewUiPolishStyles')) return;
  const style = document.createElement('style');
  style.id = 'staticReviewUiPolishStyles';
  style.textContent = `
    body.review-mode .clip-adjust-panel,
    body.review-mode #clipBtn,
    body.review-mode #clipBoxToggleBtn,
    body.review-mode #freshClipPlaneBtn,
    body.review-mode #freshClipBoxBtn,
    body.review-mode #freshClipClearBtn,
    body.review-mode .fresh-clip-btn,
    body.review-mode [data-view="clip"],
    body.review-mode #clipStatus,
    body.review-mode .fresh-clip-panel,
    body.review-mode .static-clipbox-panel { display: none !important; }
    .viewer-topbar h1 { letter-spacing: -.02em; }
    .viewer-statusbar { gap: 14px; }
    .viewer-statusbar span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .drawer-head p, .property-head p { color: #93a8bf; }
  `;
  document.head.appendChild(style);
}

function normalizeShellText() {
  document.body.classList.toggle('review-mode', !CLIP_ENABLED);
  const title = document.querySelector('.brand-block h1');
  if (title) title.textContent = 'GLB / RVM Review';
  const drawerCopy = document.querySelector('.drawer-head p');
  if (drawerCopy) drawerCopy.textContent = 'Load InputXML, convert, review, then export GLB / RVM / ATT.';
  const propCopy = document.querySelector('.property-head p');
  if (propCopy) propCopy.textContent = 'Review selected component metadata.';
}

function hideClipUi() {
  document.body.classList.add('review-mode');
  document.querySelectorAll('[data-view="clip"], #freshClipPlaneBtn, #freshClipBoxBtn, #freshClipClearBtn').forEach((button) => button.remove());
  const hint = document.getElementById('hint');
  if (hint) {
    const shortcuts = hint.querySelector('span:last-child');
    if (shortcuts) shortcuts.textContent = 'Shortcuts: S/O/P/M/H/F/Esc';
  }
}
