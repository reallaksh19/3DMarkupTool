import * as THREE from 'three';

export const INPUTXML_SUPPORT_OVERLAY_ROOT = '__RVM_SUPPORT_SYMBOLS__';

function disposeObject(root) {
  root?.traverse?.((obj) => {
    obj.geometry?.dispose?.();
    if (obj.material) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((material) => material?.dispose?.());
    }
    if (obj.element?.parentNode) obj.element.parentNode.removeChild(obj.element);
  });
}

export function removeInputXmlSupportGraphicsOverlay(viewer) {
  const roots = [viewer?.scene, viewer?.modelGroup].filter(Boolean);
  let removed = 0;
  for (const root of roots) {
    const old = root?.getObjectByName?.(INPUTXML_SUPPORT_OVERLAY_ROOT);
    if (!old) continue;
    old.parent?.remove?.(old);
    disposeObject(old);
    removed += 1;
  }
  return { removed };
}

export function applyInputXmlSupportGraphicsOverlay(viewer, options = {}) {
  if (!options.supportOverlayEnabled) {
    const cleanup = removeInputXmlSupportGraphicsOverlay(viewer);
    return {
      schema: 'InputXmlSupportGraphicsOverlay.v1',
      enabled: false,
      sourceKind: options.sourceKind || 'unknown',
      sourceName: options.sourceName || '',
      skippedReason: 'support overlay is disabled for primitive/native model sources and handled by managed-stage source preview for non-primitive files',
      ...cleanup,
    };
  }

  // This legacy RVM-viewer hook is intentionally not used as the authoritative
  // support-symbol engine. 3DMarkupTool source previews use
  // src/managed-stage-support-visual-resolver.js so symbols are source-anchored
  // before RVM/GLB export. Keep this function as a safe, empty overlay root to
  // avoid stale startup imports re-creating old escaped GUIDE symbols.
  const cleanup = removeInputXmlSupportGraphicsOverlay(viewer);
  const group = new THREE.Group();
  group.name = INPUTXML_SUPPORT_OVERLAY_ROOT;
  group.userData = {
    schema: 'InputXmlSupportGraphicsOverlay.v1',
    enabled: true,
    sourceKind: options.sourceKind || 'unknown',
    sourceName: options.sourceName || '',
    overlayKind: 'nonprimitive-support-overlay-placeholder',
    generatedPartCount: 0,
    policy: 'legacy RVM-viewer support overlay does not generate geometry; managed-stage source preview/export owns support symbols',
  };
  viewer?.scene?.add?.(group);
  return { ...group.userData, removed: cleanup.removed };
}
