import './static-shell-core-controller.js';
import './static-input-always-visible-controller.js';
import './static-input-conversion-collapse-controller.js';
import './static-review-ui-polish-controller.js';
import './static-toolbar-polish-controller.js';
import './static-svg-icons-controller.js';
import './static-viewcube-svg-controller.js';
import './static-selection-resolver.js';
import './static-canvas-interaction-coordinator.js';
import './static-marquee-zoom-controller.js';
import './static-area-select-controller.js';
import './static-saved-views-controller.js';
import './static-saved-views-context-extension.js';
import './static-component-search-controller.js';
import './static-measure-polyline-controller.js';
import './static-explode-review-controller.js';
import './static-viewpad-navigation-tools-controller.js';
import './static-section-box-from-selection-controller.js';
import './static-tree-core-controller.js';
import './static-color-legend-controller.js';
import './static-workflow-status-controller.js';
import './static-help-shortcuts-controller.js';
import './static-markup-core-controller.js';
import './static-quick-export-core-controller.js';
import './static-topbar-layout-controller.js';
import './static-review-ribbon-tools-controller.js';
import './static-canvas-action-regression-controller.js';
import './static-canvas-action-dispatch-controller.js';
import './static-navigation-smoothness-controller.js';
import './static-ribbon-dropdown-cleanup-controller.js';
import './static-global-tool-lifecycle-controller.js';

window.__3D_MARKUP_STATIC_SHELL_BUNDLE_READY__ = true;
window.dispatchEvent(new CustomEvent('viewer:static-shell-bundle-ready', {
  detail: { version: 'perf-static-drawer-bundle-20260620' }
}));
