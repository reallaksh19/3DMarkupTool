// Local production-safe Lucide shim.
// The full lucide ESM bundle dynamically imports hundreds of icon modules from
// unpkg, which can exhaust browser/network resources on GitHub Pages.
// The app only needs createIcons() to be safe; visible button text remains.
export const icons = {};

export function createIcons() {
  // No-op by design. Keep data-lucide <i> elements in place but avoid external
  // dynamic icon fetches and resource exhaustion.
}
