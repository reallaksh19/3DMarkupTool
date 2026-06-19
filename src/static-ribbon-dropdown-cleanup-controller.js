// Phase 3 dropdown / ribbon cleanup controller.
// This is a DOM-only UI cleanup layer: no scene traversal, no tool runtime recovery.

const VERSION = 'phase3-ribbon-cleanup-20260619';
const STYLE_ID = 'phase3RibbonDropdownCleanupStyles';
const VIEW_TOGGLE_ID = 'phase3ViewFitToggle';
const VIEW_GROUP_SELECTOR = '[aria-label="View tools"]';
const SECONDARY_VIEW_IDS = ['viewTopBtn', 'viewFrontBtn', 'viewSideBtn', 'fitSelectionBtn', 'previewGlbBtn', 'previewRvmBtn'];
const MENU_EVENTS = ['click', 'keyup'];

runWhenReady(initPhase3RibbonDropdownCleanup);

function runWhenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function initPhase3RibbonDropdownCleanup() {
  injectStyles();
  refreshPhase3Layout();
  bindPhase3Events();
  window.__3D_MARKUP_PHASE3_RIBBON_CLEANUP__ = {
    version: VERSION,
    refresh: refreshPhase3Layout,
    checklist: buildChecklist,
    noPolling: true,
    noSceneTraversal: true
  };
  window.dispatchEvent(new CustomEvent('viewer:phase3-ribbon-cleanup', { detail: buildChecklist() }));
}

function refreshPhase3Layout() {
  removeDuplicateReviewDropdown();
  removeQuickExportRibbonDuplicates();
  movePreviewModesIntoViewFit();
  installViewFitCollapse();
  positionOpenTopMenus();
  return buildChecklist();
}

function bindPhase3Events() {
  MENU_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, () => window.setTimeout(positionOpenTopMenus, 0), true);
  });
  window.addEventListener('resize', positionOpenTopMenus);
  ['viewer:ui-controls-changed', 'viewer:model-loaded', 'markup:app-ready'].forEach((eventName) => {
    window.addEventListener(eventName, () => window.setTimeout(refreshPhase3Layout, 0));
  });
  window.setTimeout(refreshPhase3Layout, 150);
  window.setTimeout(refreshPhase3Layout, 800);
}

function removeDuplicateReviewDropdown() {
  const reviewMenu = document.getElementById('topReviewMenu');
  if (!reviewMenu) return;
  reviewMenu.dataset.phase3RemovedDuplicate = 'true';
  reviewMenu.hidden = true;
  reviewMenu.setAttribute('aria-hidden', 'true');
  reviewMenu.style.display = 'none';
}

function removeQuickExportRibbonDuplicates() {
  document.querySelectorAll('#quickExportGroup, .quick-export-group').forEach((group) => {
    group.dataset.phase3RemovedDuplicate = 'true';
    group.hidden = true;
    group.setAttribute('aria-hidden', 'true');
    group.style.display = 'none';
  });
}

function movePreviewModesIntoViewFit() {
  const viewGroup = document.querySelector(VIEW_GROUP_SELECTOR);
  const glb = document.getElementById('previewGlbBtn');
  const rvm = document.getElementById('previewRvmBtn');
  if (!viewGroup || !glb || !rvm) return;

  const fit = document.getElementById('fitSelectionBtn') || document.getElementById('resetCameraBtn');
  if (glb.parentElement !== viewGroup) viewGroup.insertBefore(glb, fit?.nextSibling || null);
  if (rvm.parentElement !== viewGroup) viewGroup.insertBefore(rvm, glb.nextSibling);
  glb.dataset.phase3MovedToView = 'true';
  rvm.dataset.phase3MovedToView = 'true';

  const previewGroup = document.querySelector('[aria-label="Preview mode"]');
  if (previewGroup && previewGroup !== viewGroup && !previewGroup.querySelector('button:not([hidden])')) {
    previewGroup.dataset.phase3RemovedEmpty = 'true';
    previewGroup.hidden = true;
    previewGroup.style.display = 'none';
  }
}

function installViewFitCollapse() {
  const viewGroup = document.querySelector(VIEW_GROUP_SELECTOR);
  if (!viewGroup) return;
  viewGroup.classList.add('phase3-collapsible-group');
  viewGroup.dataset.phase3Group = 'view-fit';
  viewGroup.dataset.expandedLabel = viewGroup.dataset.expandedLabel || 'View / Fit';

  SECONDARY_VIEW_IDS.forEach((id) => {
    const button = document.getElementById(id);
    if (button) button.classList.add('phase3-collapsible-secondary');
  });

  let toggle = document.getElementById(VIEW_TOGGLE_ID);
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.id = VIEW_TOGGLE_ID;
    toggle.type = 'button';
    toggle.className = 'tool-btn phase3-collapse-toggle';
    toggle.title = 'Expand or collapse secondary View / Fit tools';
    toggle.setAttribute('aria-label', 'Expand or collapse View / Fit tools');
    toggle.addEventListener('click', () => {
      const collapsed = viewGroup.dataset.collapsed !== 'true';
      setViewGroupCollapsed(viewGroup, collapsed);
    });
    viewGroup.appendChild(toggle);
  } else if (toggle.parentElement !== viewGroup) {
    viewGroup.appendChild(toggle);
  }

  const stored = window.localStorage.getItem('3dmarkup.phase3.viewFitCollapsed');
  setViewGroupCollapsed(viewGroup, stored === null ? true : stored === '1');
}

function setViewGroupCollapsed(viewGroup, collapsed) {
  viewGroup.dataset.collapsed = collapsed ? 'true' : 'false';
  window.localStorage.setItem('3dmarkup.phase3.viewFitCollapsed', collapsed ? '1' : '0');
  const toggle = document.getElementById(VIEW_TOGGLE_ID);
  if (toggle) {
    toggle.dataset.phase3Collapsed = collapsed ? 'true' : 'false';
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggle.replaceChildren(textNode(collapsed ? '>>' : '<<'), textNode(collapsed ? 'More' : 'Less', 'span'));
  }
}

function positionOpenTopMenus() {
  document.querySelectorAll('.top-menu-wrap').forEach((wrap) => {
    const pop = wrap.querySelector('.top-menu-popover');
    const btn = wrap.querySelector('.top-menu-btn');
    if (!pop || pop.hidden || !btn) return;
    const rect = btn.getBoundingClientRect();
    const margin = 8;
    const width = Math.max(pop.offsetWidth || 240, 220);
    const left = Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin));
    pop.style.position = 'fixed';
    pop.style.top = `${Math.min(rect.bottom + margin, window.innerHeight - margin - 80)}px`;
    pop.style.left = `${left}px`;
    pop.style.right = 'auto';
    pop.style.maxHeight = `${Math.max(160, window.innerHeight - rect.bottom - 24)}px`;
    pop.style.overflowY = 'auto';
  });
}

function buildChecklist() {
  const exportMenu = document.getElementById('topExportMenu');
  const viewGroup = document.querySelector(VIEW_GROUP_SELECTOR);
  return {
    version: VERSION,
    dropdownOverflowVisible: true,
    duplicateReviewMenuHidden: !document.getElementById('topReviewMenu') || document.getElementById('topReviewMenu').hidden || document.getElementById('topReviewMenu').style.display === 'none',
    quickExportRibbonHidden: !document.getElementById('quickExportGroup') || document.getElementById('quickExportGroup').hidden || document.getElementById('quickExportGroup').style.display === 'none',
    exportMenuPresent: Boolean(exportMenu),
    previewModesInViewFit: Boolean(viewGroup?.contains(document.getElementById('previewGlbBtn')) && viewGroup?.contains(document.getElementById('previewRvmBtn'))),
    viewFitCollapseToggle: Boolean(document.getElementById(VIEW_TOGGLE_ID)),
    iconSizeNormalized: true,
    noPolling: true,
    noSceneTraversal: true
  };
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .viewer-topbar,
    .topbar-main,
    .topbar-actions,
    .main-ribbon,
    .toolbar-group,
    .top-menu-wrap { overflow: visible !important; }
    .viewer-topbar { z-index: 2200; }
    .top-menu-wrap { z-index: 2300; }
    .top-menu-popover {
      position: fixed !important;
      right: auto !important;
      z-index: 2400 !important;
      max-height: min(72vh, 540px);
      overflow-y: auto !important;
      overflow-x: hidden !important;
    }
    #topReviewMenu { display: none !important; }
    #quickExportGroup,
    .quick-export-group { display: none !important; }
    .tool-btn,
    .review-ribbon-tool-btn {
      width: 64px !important;
      min-width: 64px !important;
      max-width: 64px !important;
      height: 56px !important;
      min-height: 56px !important;
      max-height: 56px !important;
    }
    .tool-btn svg,
    .tool-btn .lucide,
    .review-tool-svg,
    .review-ribbon-tool-icon {
      width: 20px !important;
      height: 20px !important;
      flex: 0 0 20px;
    }
    .phase3-collapsible-group[data-collapsed="true"] .phase3-collapsible-secondary {
      display: none !important;
    }
    .phase3-collapse-toggle {
      width: 54px !important;
      min-width: 54px !important;
      max-width: 54px !important;
      color: #ffe08a;
      border-color: rgba(255, 200, 109, .55);
      background: linear-gradient(180deg, rgba(77, 53, 14, .96), rgba(38, 27, 12, .96));
    }
    .phase3-collapse-toggle > :first-child {
      font-size: 16px;
      line-height: 1;
      font-weight: 1000;
    }
    .phase3-collapse-toggle span {
      font-size: 9px;
      line-height: 1;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .main-ribbon {
      overflow-x: auto !important;
      overflow-y: visible !important;
      padding-bottom: 4px;
    }
  `;
  document.head.appendChild(style);
}

function textNode(text, tagName = 'span') {
  const node = document.createElement(tagName);
  node.textContent = text;
  return node;
}
