import * as THREE from 'three';

export const MANAGED_STAGE_SUPPORT_UI_VISUAL_CLEANUP_SCHEMA = 'ManagedStageSupportUiVisualCleanup.v1';
export const MANAGED_STAGE_SUPPORT_UI_VISUAL_CLEANUP_CACHE_KEY = '20260624-support-disc-click-popup-cleanup-1';

export const SUPPORT_MAPPING_POPUP_POLISH_CSS = `
  .support-mapping-settings-popup {
    width: min(1480px, calc(100vw - 28px)) !important;
    max-width: calc(100vw - 28px) !important;
    max-height: min(90vh, 940px) !important;
    padding: 18px !important;
  }
  .support-mapping-settings-popup-header {
    margin: -18px -18px 16px !important;
    padding: 16px 18px !important;
  }
  .support-mapping-settings-popup-header h3 {
    font-size: 18px !important;
  }
  .support-mapping-settings-popup-header small {
    display: block !important;
    max-width: 1220px !important;
    line-height: 1.45 !important;
    color: #dbeafe !important;
  }
  .support-mapping-settings-popup-grid {
    grid-template-columns: minmax(260px, .72fr) minmax(420px, 1.22fr) minmax(520px, 1.55fr) !important;
    gap: 16px !important;
  }
  .support-mapping-settings-popup-grid > section {
    padding: 14px !important;
  }
  .support-mapping-settings-popup-grid textarea {
    min-height: 132px !important;
  }
  [data-support-settings-mapper-host] details,
  [data-support-settings-mapper-host] pre,
  [data-support-settings-mapper-host] table,
  [data-support-settings-isonote-host] table {
    max-width: 100% !important;
    overflow: auto !important;
  }
  [data-support-settings-isonote-host] table,
  [data-support-settings-mapper-host] table {
    font-size: 12px !important;
  }
  @media (max-width: 1180px) {
    .support-mapping-settings-popup-grid {
      grid-template-columns: 1fr !important;
    }
  }
`;

const NOOP_RAYCAST = function supportPreviewRaycastDisabled() {};

installManagedStageSupportUiVisualCleanup();

export function installManagedStageSupportUiVisualCleanup({ win = globalThis.window, doc = globalThis.document } = {}) {
  if (!win || win.__3D_MARKUP_SUPPORT_UI_VISUAL_CLEANUP__?.schema === MANAGED_STAGE_SUPPORT_UI_VISUAL_CLEANUP_SCHEMA) {
    return win?.__3D_MARKUP_SUPPORT_UI_VISUAL_CLEANUP__ || null;
  }

  const api = {
    schema: MANAGED_STAGE_SUPPORT_UI_VISUAL_CLEANUP_SCHEMA,
    cacheKey: MANAGED_STAGE_SUPPORT_UI_VISUAL_CLEANUP_CACHE_KEY,
    cleanup: (modelRoot = null, reason = 'manual') => cleanupAndPublish({ win, doc, modelRoot, reason }),
    polishPopup: () => installSupportPopupPolishStyles(doc)
  };
  win.__3D_MARKUP_SUPPORT_UI_VISUAL_CLEANUP__ = api;

  installSupportPopupPolishStyles(doc);

  const scheduleCleanup = (reason, modelRoot = null) => {
    win.clearTimeout?.(api.pendingTimer);
    api.pendingTimer = win.setTimeout?.(() => api.cleanup(modelRoot, reason), 0);
  };

  win.addEventListener?.('managed-stage:support-preview-auto-apply-result', (event) => scheduleCleanup('support-preview-auto-apply-result', event?.detail?.modelRoot));
  win.addEventListener?.('viewer:managed-stage-json-loaded', (event) => scheduleCleanup('viewer-managed-stage-json-loaded', event?.detail?.modelRoot));
  win.addEventListener?.('viewer:model-loaded', (event) => scheduleCleanup('viewer-model-loaded', event?.detail?.modelRoot));
  win.addEventListener?.('managed-stage:support-settings-popup-ready', () => installSupportPopupPolishStyles(doc));
  win.addEventListener?.('markup:app-ready', () => installSupportPopupPolishStyles(doc));

  scheduleCleanup('install');
  return api;
}

export function cleanupManagedStageSupportPreview(modelRoot, options = {}) {
  if (!modelRoot?.traverse) {
    return cleanupResult('skipped', { reason: 'missing modelRoot', requestedBy: options.reason || 'manual' });
  }

  let supportRootCount = 0;
  let supportPartCount = 0;
  let raycastDisabledCount = 0;
  let coneOpenEndedReplacedCount = 0;
  let canCapPickDisabledCount = 0;

  modelRoot.traverse((object) => {
    const data = object?.userData || {};
    const isSupportRoot = data.managedStageSupportVisual === true;
    const isSupportPart = data.managedStageSupportVisualPart === true;
    if (!isSupportRoot && !isSupportPart) return;

    if (isSupportRoot) supportRootCount += 1;
    if (isSupportPart) supportPartCount += 1;

    if (disableSupportPicking(object)) raycastDisabledCount += 1;

    if (isSupportPart && object?.isMesh && isSupportConeMesh(object)) {
      if (replaceClosedConeWithOpenCone(object)) coneOpenEndedReplacedCount += 1;
    }

    if (isSupportPart && data.supportSpringCanCylinder === true && disableSupportPicking(object)) {
      canCapPickDisabledCount += 1;
    }
  });

  const result = cleanupResult('applied', {
    requestedBy: options.reason || 'manual',
    supportRootCount,
    supportPartCount,
    raycastDisabledCount,
    coneOpenEndedReplacedCount,
    canCapPickDisabledCount,
    whiteDiscCapPolicy: 'directional and warning support cones are converted to open-ended ConeGeometry so base discs are not rendered',
    pickingPolicy: 'preview-only support overlays have raycast disabled so pipe/canvas clicks pass through'
  });

  modelRoot.userData = {
    ...(modelRoot.userData || {}),
    managedStageSupportUiVisualCleanup: result
  };
  return result;
}

export function installSupportPopupPolishStyles(doc = globalThis.document) {
  if (!doc?.head || doc.getElementById('supportPopupPolishStyle')) return false;
  const style = doc.createElement('style');
  style.id = 'supportPopupPolishStyle';
  style.textContent = SUPPORT_MAPPING_POPUP_POLISH_CSS;
  doc.head.appendChild(style);
  return true;
}

function cleanupAndPublish({ win, doc, modelRoot = null, reason = 'manual' } = {}) {
  const root = modelRoot || resolveModelRoot(win);
  const result = cleanupManagedStageSupportPreview(root, { reason });
  if (win) {
    win.__3D_MARKUP_SUPPORT_UI_VISUAL_CLEANUP_LAST_RESULT__ = result;
    win.dispatchEvent?.(new CustomEvent('managed-stage:support-ui-visual-cleanup-result', { detail: { ...result, modelRoot: root } }));
  }
  appendCleanupLog(doc, result);
  win?.__3D_MARKUP_VIEWER_RUNTIME__?.renderOnce?.(`support-ui-visual-cleanup:${reason}`);
  return result;
}

function replaceClosedConeWithOpenCone(mesh) {
  const geometry = mesh.geometry;
  const params = geometry?.parameters || {};
  if (geometry?.type !== 'ConeGeometry') return false;
  if (params.openEnded === true || mesh.userData?.supportConeBaseCapRemoved === true) return false;

  const next = new THREE.ConeGeometry(
    Number(params.radius || mesh.userData?.supportConeRadiusMm || 1),
    Number(params.height || mesh.userData?.supportConeLengthMm || 1),
    Number(params.radialSegments || 24),
    Number(params.heightSegments || 1),
    true,
    Number(params.thetaStart || 0),
    Number(params.thetaLength || Math.PI * 2)
  );
  next.name = geometry.name || `${mesh.name || 'support-cone'}_OPEN_ENDED_GEOMETRY`;
  geometry.dispose?.();
  mesh.geometry = next;
  mesh.userData = {
    ...(mesh.userData || {}),
    supportConeOpenEnded: true,
    supportConeBaseCapRemoved: true,
    supportWhiteDiscCapRemoved: true
  };
  return true;
}

function disableSupportPicking(object) {
  if (!object) return false;
  const alreadyDisabled = object.userData?.supportPreviewPickingDisabled === true;
  object.raycast = NOOP_RAYCAST;
  object.userData = {
    ...(object.userData || {}),
    supportPreviewPickingDisabled: true,
    supportPreviewClickThrough: true,
    supportPreviewRaycastPolicy: 'disabled for preview-only support overlay; click should pass to canvas/model objects'
  };
  return !alreadyDisabled;
}

function isSupportConeMesh(mesh) {
  const data = mesh?.userData || {};
  return mesh?.geometry?.type === 'ConeGeometry'
    && (data.supportDirectionalCone === true || data.supportWarningCone === true || data.supportConeCatalogue === true || data.supportVisualGeometry === 'cone-and-can-support-glyphs');
}

function resolveModelRoot(win) {
  const runtime = win?.__3D_MARKUP_VIEWER_RUNTIME__ || win?.__3D_MARKUP_CLIP_RUNTIME__ || {};
  return runtime.getModelRoot?.() || runtime.modelRoot || null;
}

function appendCleanupLog(doc, result) {
  const log = doc?.getElementById?.('log');
  if (!log || result?.status !== 'applied') return;
  const line = `[${new Date().toLocaleTimeString()}] Support cleanup: coneCapsRemoved=${Number(result.coneOpenEndedReplacedCount || 0)}, pickingDisabled=${Number(result.raycastDisabledCount || 0)}, popup=wide`;
  log.textContent = `${log.textContent || ''}${log.textContent ? '\n' : ''}${line}`;
  log.scrollTop = log.scrollHeight;
}

function cleanupResult(status, details = {}) {
  return {
    schema: MANAGED_STAGE_SUPPORT_UI_VISUAL_CLEANUP_SCHEMA,
    cacheKey: MANAGED_STAGE_SUPPORT_UI_VISUAL_CLEANUP_CACHE_KEY,
    status,
    ...details
  };
}
