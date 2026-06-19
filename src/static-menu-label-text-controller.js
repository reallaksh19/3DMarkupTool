// Reverted by PR: menu label text controller disabled.
// Kept as a no-op placeholder so stale cached bootstraps that import this file
// do not fail or patch the runtime UI.

const VERSION = 'topbar-menu-label-text-reverted-20260619';

window.__3D_MARKUP_TOPBAR_MENU_LABELS__ = {
  version: VERSION,
  reverted: true,
  refresh() {},
  checklist() {
    return { version: VERSION, reverted: true, allKnownLabelsVisible: false, rows: [] };
  }
};

window.dispatchEvent(new CustomEvent('viewer:topbar-menu-labels-reverted', {
  detail: window.__3D_MARKUP_TOPBAR_MENU_LABELS__.checklist()
}));
