const STATIC_SHORTCUT_CLEANUP_SCHEMA = 'StaticShortcutCleanupController.v1';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installStaticShortcutCleanupController, { once: true });
} else {
  installStaticShortcutCleanupController();
}

export function installStaticShortcutCleanupController() {
  if (window.__3D_MARKUP_STATIC_SHORTCUT_CLEANUP__?.schema === STATIC_SHORTCUT_CLEANUP_SCHEMA) return window.__3D_MARKUP_STATIC_SHORTCUT_CLEANUP__;
  const api = { schema: STATIC_SHORTCUT_CLEANUP_SCHEMA, patch: patchHelpAndTooltips };
  window.__3D_MARKUP_STATIC_SHORTCUT_CLEANUP__ = api;
  window.addEventListener('keydown', onKeyDownCapture, true);
  window.addEventListener('pointerdown', onPointerDownCapture, true);
  window.addEventListener('viewer:static-help-ready', patchHelpAndTooltips);
  window.addEventListener('viewer:static-shell-bundle-ready', patchHelpAndTooltips);
  patchHelpAndTooltips();
  return api;
}

function onKeyDownCapture(event) {
  if (isTextInput(event.target)) return;
  const key = String(event.key || '').toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === 'c') {
    event.preventDefault();
    event.stopImmediatePropagation?.();
    setStatus('Ctrl+C shortcut removed. Use visible Copy buttons only.');
  }
}

function onPointerDownCapture(event) {
  if (!event.ctrlKey && !event.metaKey) return;
  const canvas = document.querySelector('#viewer canvas');
  if (!canvas || event.target !== canvas) return;
  event.preventDefault();
  event.stopImmediatePropagation?.();
  setStatus('Ctrl-click shortcut removed. Use normal Select mode and visible review tools.');
}

function patchHelpAndTooltips() {
  const helpButton = document.getElementById('helpShortcutsBtn');
  if (helpButton) {
    helpButton.title = 'Show help. Shortcuts are limited to visible navigation/review actions.';
    helpButton.setAttribute('aria-label', 'Show help. Shortcuts are limited to visible navigation/review actions.');
  }
  const panel = document.getElementById('staticHelpShortcutsPanel');
  if (panel) {
    panel.querySelectorAll('.static-help-list li').forEach((li) => {
      const text = li.textContent || '';
      if (/ctrl|control|ctrl\+c|ctrl\+click/i.test(text)) li.remove();
    });
    const note = panel.querySelector('.static-help-note');
    if (note) note.innerHTML = 'Keyboard shortcuts are intentionally minimal. Use the visible canvas/navigation buttons for selection, zoom, orbit, pan, support mapping, debug, and audit workflows.';
  }
  document.querySelectorAll('[title]').forEach((el) => {
    const title = el.getAttribute('title') || '';
    if (/ctrl|control|ctrl\+c|ctrl\+click/i.test(title)) el.setAttribute('title', title.replace(/ctrl\+click/ig, 'click').replace(/ctrl\+c/ig, 'Copy button').replace(/ctrl/ig, 'visible button'));
  });
  return true;
}

function isTextInput(target) {
  if (!target) return false;
  const tag = String(target.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

function setStatus(message) {
  const pill = document.getElementById('runtimeStatus');
  if (pill) pill.textContent = message;
}
