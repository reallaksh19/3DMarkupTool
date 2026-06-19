// Static toolbar label polish.
// Keeps the first-class static shell readable without re-enabling legacy toolbar controllers.

const STYLE_ID = 'static-toolbar-polish-style';
const VERSION = 'static-toolbar-label-polish-selection-loop-guard-20260619';

let selectionSyncInProgress = false;
let lastSelectionSignature = '';

installToolbarPolish();

function installToolbarPolish() {
  injectToolbarStyle();
  annotateToolButtons();
  syncRuntimeSelectionFromStatus();
  requestAnimationFrame(function () {
    annotateToolButtons();
    leftAnchorRibbon();
    syncRuntimeSelectionFromStatus();
  });
  window.addEventListener('viewer:ui-score-changed', annotateToolButtons);
  window.addEventListener('viewer:static-clipbox-ready', annotateToolButtons);
  window.addEventListener('viewer:clipping-changed', annotateToolButtons);
  window.addEventListener('viewer:static-tree-refreshed', syncRuntimeSelectionFromStatus);
  window.addEventListener('viewer:selection-changed', syncRuntimeSelectionFromStatus);
  window.addEventListener('click', () => window.setTimeout(syncRuntimeSelectionFromStatus, 0), true);
  window.addEventListener('resize', leftAnchorRibbon, { passive: true });
  window.__3D_MARKUP_STATIC_TOOLBAR_POLISH__ = {
    version: VERSION,
    refresh: annotateToolButtons,
    syncSelection: syncRuntimeSelectionFromStatus
  };
}

function injectToolbarStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .main-ribbon {
      max-width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      overscroll-behavior-inline: contain;
      scrollbar-gutter: stable;
    }

    .main-ribbon .tool-group {
      flex: 0 0 auto;
    }

    .main-ribbon .tool-btn {
      width: 70px;
      min-width: 70px;
      max-width: 70px;
      height: 56px;
      min-height: 56px;
      padding-inline: 5px;
      gap: 5px;
    }

    .main-ribbon .tool-btn[data-wide-label="true"] {
      width: 76px;
      min-width: 76px;
      max-width: 76px;
    }

    .main-ribbon .tool-btn[data-extra-wide-label="true"] {
      width: 88px;
      min-width: 88px;
      max-width: 88px;
    }

    .main-ribbon .tool-btn span {
      display: block;
      max-width: 100%;
      overflow: visible;
      text-overflow: clip;
      font-size: 11px;
      line-height: 1.05;
      letter-spacing: -0.035em;
      white-space: nowrap;
      text-align: center;
    }

    .main-ribbon .tool-btn .lucide {
      width: 19px;
      height: 19px;
      flex: 0 0 auto;
    }

    .main-ribbon #clipBtn::before {
      content: '◩';
      display: block;
      font-size: 18px;
      line-height: 18px;
      color: currentColor;
      margin-bottom: -2px;
    }

    .main-ribbon #clipBtn > .lucide,
    .main-ribbon #clipBtn > svg {
      display: none !important;
    }

    .topbar-actions .status-pill {
      white-space: nowrap;
    }

    @media (max-width: 1400px) {
      .main-ribbon .tool-btn {
        width: 66px;
        min-width: 66px;
        max-width: 66px;
      }
      .main-ribbon .tool-btn[data-wide-label="true"] {
        width: 72px;
        min-width: 72px;
        max-width: 72px;
      }
      .main-ribbon .tool-btn[data-extra-wide-label="true"] {
        width: 84px;
        min-width: 84px;
        max-width: 84px;
      }
      .main-ribbon .tool-btn span {
        font-size: 10.5px;
      }
    }
  `;
  document.head.appendChild(style);
}

function annotateToolButtons() {
  normalizeClipPlaneButton();
  normalizeClipBoxButton();

  const buttons = Array.from(document.querySelectorAll('.main-ribbon .tool-btn'));
  buttons.forEach((button) => {
    const label = button.querySelector('span')?.textContent?.trim() || button.textContent?.trim() || button.id;
    if (label) {
      button.title = button.title || label;
      button.setAttribute('aria-label', button.getAttribute('aria-label') || label);
    }
    if (/measure|front|fit all|fit sel|grid off/i.test(label || '')) {
      button.dataset.wideLabel = 'true';
    }
    if (/clip plane|plane on|clip box/i.test(label || '') || button.id === 'clipBtn' || button.id === 'clipBoxToggleBtn') {
      button.dataset.extraWideLabel = 'true';
    }
  });
}

function normalizeClipPlaneButton() {
  const button = document.getElementById('clipBtn');
  if (!button) return;
  let span = button.querySelector('span');
  if (!span) {
    span = document.createElement('span');
    button.appendChild(span);
  }
  const active = button.classList.contains('tool-active') || /clip\s+on|plane\s+on/i.test(span.textContent || '');
  span.textContent = active ? 'Plane On' : 'Clip Plane';
  button.title = 'Enable Clip Plane controls';
  button.setAttribute('aria-label', active ? 'Disable Clip Plane' : 'Enable Clip Plane');
  button.dataset.extraWideLabel = 'true';
  if (button.dataset.boundClipPlanePolish !== '1') {
    button.dataset.boundClipPlanePolish = '1';
    button.addEventListener('click', () => window.setTimeout(annotateToolButtons, 0));
  }
}

function normalizeClipBoxButton() {
  const button = document.getElementById('clipBoxToggleBtn');
  if (!button) return;
  let span = button.querySelector('span');
  if (!span) {
    span = document.createElement('span');
    button.appendChild(span);
  }
  span.textContent = 'Clip Box';
  button.title = 'Show 3D Clip Box controls';
  button.setAttribute('aria-label', 'Show 3D Clip Box controls');
  button.dataset.extraWideLabel = 'true';
}

function syncRuntimeSelectionFromStatus() {
  if (selectionSyncInProgress) {
    const runtime = mergedRuntime();
    return runtime.selectedObject && !runtime.selectedObject.isScene ? runtime.selectedObject : null;
  }

  selectionSyncInProgress = true;
  try {
    const runtime = mergedRuntime();
    if (runtime.selectedObject && !runtime.selectedObject.isScene && runtime.renderer) return runtime.selectedObject;

    const selectedId = selectedIdFromStatusOrProps();
    if (!selectedId) return null;

    const object = findObjectById(selectedId);
    if (!object) return null;

    const objectKey = object.uuid || object.id || object.name || selectedId;
    const signature = `${selectedId}:${objectKey}`;
    const changed = signature !== lastSelectionSignature || runtime.selectedObject !== object;

    const data = object.userData || {};
    runtime.selectedObject = object;
    runtime.selectedData = data;
    runtime.selectedId = selectedId;
    publishRuntime(runtime);

    if (changed) {
      lastSelectionSignature = signature;
      window.dispatchEvent(new CustomEvent('viewer:selection-changed', {
        detail: { source: 'static-selection-resolver', object, data, id: selectedId }
      }));
    }
    return object;
  } finally {
    selectionSyncInProgress = false;
  }
}

function mergedRuntime() {
  const primary = window.__3D_MARKUP_VIEWER_RUNTIME__ || {};
  const legacy = window.__3D_MARKUP_CLIP_RUNTIME__ || {};
  const runtime = primary === legacy ? primary : { ...legacy, ...primary };

  runtime.renderer = primary.renderer || legacy.renderer || runtime.renderer || null;
  runtime.scene = primary.scene || legacy.scene || runtime.scene || null;
  runtime.camera = primary.camera || legacy.camera || runtime.camera || null;
  runtime.controls = primary.controls || legacy.controls || runtime.controls || null;
  runtime.modelRoot = primary.modelRoot || legacy.modelRoot || runtime.modelRoot || null;
  runtime.applyClipping = primary.applyClipping || legacy.applyClipping || runtime.applyClipping;
  runtime.clearClipping = primary.clearClipping || legacy.clearClipping || runtime.clearClipping;
  runtime.clippingPlanes = primary.clippingPlanes || legacy.clippingPlanes || runtime.clippingPlanes || [];
  runtime.clippingMode = primary.clippingMode || legacy.clippingMode || runtime.clippingMode || 'none';
  return runtime;
}

function publishRuntime(runtime) {
  window.__3D_MARKUP_VIEWER_RUNTIME__ = runtime;
  window.__3D_MARKUP_CLIP_RUNTIME__ = runtime;
  window.__3D_MARKUP_RECORD_RENDER_CONTEXT__?.({
    renderer: runtime.renderer,
    scene: runtime.scene,
    camera: runtime.camera,
    controls: runtime.controls,
    modelRoot: runtime.modelRoot,
    selectedObject: runtime.selectedObject,
    selectedData: runtime.selectedData,
    clippingPlanes: runtime.clippingPlanes,
    clippingMode: runtime.clippingMode,
    source: 'static-selection-resolver'
  });
}

function selectedIdFromStatusOrProps() {
  const statusText = String(document.getElementById('selectedStatus')?.textContent || '').trim();
  const match = statusText.match(/Selected:\s*([^\s]+)/i);
  if (match && match[1] && !/^none$/i.test(match[1])) return normalizeId(match[1]);

  const propertyTitle = document.querySelector('.selected-card-title span')?.textContent?.trim();
  if (propertyTitle && !/^no selection$/i.test(propertyTitle)) return normalizeId(propertyTitle);

  return '';
}

function findObjectById(id) {
  const normalized = normalizeId(id);
  if (!normalized) return null;

  const treeState = window.__3D_MARKUP_STATIC_TREE__?.state || window.__3D_MARKUP_TREE__?.state;
  const treeMatch = treeState?.objects?.find((item) => objectMatches(item.object, normalized));
  if (treeMatch?.object) return treeMatch.object;

  const runtime = mergedRuntime();
  const root = runtime.modelRoot || runtime.scene;
  let found = null;
  root?.traverse?.((object) => {
    if (found || !object || object.isScene) return;
    if (objectMatches(object, normalized)) found = object;
  });
  return found;
}

function objectMatches(object, normalizedId) {
  const raw = object?.userData || {};
  const candidates = [
    object?.name,
    raw.ID,
    raw.id,
    raw.REF_NO,
    raw.refNo,
    raw.LABEL,
    raw.label,
    raw.NODE,
    raw.node,
    raw.componentId,
    raw.COMPONENT_ID,
    raw.title,
    raw.name
  ];
  return candidates.some((value) => normalizeId(value) === normalizedId);
}

function normalizeId(value) {
  return String(value || '')
    .trim()
    .replace(/^Selected:\s*/i, '')
    .replace(/[\s,;]+$/g, '')
    .toUpperCase();
}

function leftAnchorRibbon() {
  const ribbon = document.querySelector('.main-ribbon');
  if (!ribbon) return;
  if (document.documentElement.scrollLeft !== 0) document.documentElement.scrollLeft = 0;
  if (document.body.scrollLeft !== 0) document.body.scrollLeft = 0;
  if (ribbon.scrollLeft < 4) ribbon.scrollLeft = 0;
}
