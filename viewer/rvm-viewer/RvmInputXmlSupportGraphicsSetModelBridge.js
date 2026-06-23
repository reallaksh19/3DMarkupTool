import { RvmViewer3D } from './RvmViewer3D.js?v=20260518-statusbar-theme-12';
import { applyInputXmlSupportGraphicsOverlay } from './RvmInputXmlSupportGraphics.js?v=20260622-nonprimitive-overlay-gate-1';
import { refreshInputXmlGraphics } from './RvmInputXmlAutoBendGraphics.js?v=20260622-nonprimitive-overlay-gate-1';
import { state } from '../core/state.js';
import { resolveManagedStageSourceKindPolicy } from '../../src/managed-stage-source-kind-policy.js';

const SUPPORT_OVERLAY_ROOT_NAME = '__RVM_SUPPORT_SYMBOLS__';
const NATIVE_PRIMITIVE_SOURCE_KIND = 'rvm';

function optionsFromUi(viewer) {
  const root = document.querySelector('[data-rvm-viewer]');
  const scale = Number(root?.querySelector?.('#rvm-support-scale')?.value);
  const labelsVisible = root?.querySelector?.('#rvm-support-labels')?.getAttribute?.('aria-pressed') === 'true';
  const autoBend = root?.querySelector?.('#rvm-inputxml-auto-bend')?.checked;
  const sourceName = resolveRuntimeSourceName(viewer);
  const sourceKind = resolveRuntimeSourceKind(viewer, sourceName);
  const sourcePolicy = resolveManagedStageSourceKindPolicy(sourceName, { sourceKind });
  return {
    scaleMultiplier: Number.isFinite(scale) ? Math.max(Math.min(scale, 1.5), 0.25) : 0.75,
    labelsVisible,
    autoBendEnabled: autoBend !== false && sourcePolicy.autoBendEnabled,
    supportOverlayEnabled: sourcePolicy.supportOverlayEnabled,
    sourceName,
    sourceKind: sourcePolicy.sourceKind,
    sourcePolicy,
  };
}

function str(value) {
  if (value == null) return '';
  return String(value);
}

function resolveRuntimeSourceName(viewer) {
  const candidates = [
    viewer?.userData?.sourceName,
    viewer?.userData?.fileName,
    viewer?.userData?.loadedFileName,
    state?.rvm?.sourceName,
    state?.rvm?.fileName,
    state?.rvm?.loadedFileName,
    state?.rvm?.metadata?.sourceName,
    state?.rvm?.metadata?.fileName,
  ];
  return candidates.map(str).find(Boolean) || 'native-rvm-model.rvm';
}

function resolveRuntimeSourceKind(viewer, sourceName) {
  const explicit = [
    viewer?.userData?.sourceKind,
    viewer?.userData?.loadedSourceKind,
    state?.rvm?.sourceKind,
    state?.rvm?.loadedSourceKind,
    state?.rvm?.metadata?.sourceKind,
  ].map(str).find(Boolean);
  if (explicit) return explicit;
  if (hasNativeRvmPrimitiveIndex()) return NATIVE_PRIMITIVE_SOURCE_KIND;
  const clean = str(sourceName).split(/[?#]/)[0].toLowerCase();
  const ext = clean.match(/\.([a-z0-9]+)$/)?.[1];
  return ext || 'json';
}

function hasNativeRvmPrimitiveIndex() {
  const nodes = Array.isArray(state?.rvm?.index?.nodes) ? state.rvm.index.nodes : [];
  return nodes.some((node) => {
    const attrs = node?.attributes || {};
    return attrs.RVM_PRIMITIVE_CODE != null
      || attrs.RVM_NATIVE_PRIMITIVE_CODE != null
      || attrs.RVM_PRIMITIVE_KIND != null
      || /\bRVM\b/i.test(str(attrs.SOURCE_FORMAT));
  });
}

function hasCompactNativeRvmSupportOverlay() {
  const nodes = Array.isArray(state?.rvm?.index?.nodes) ? state.rvm.index.nodes : [];
  return nodes.some((node) => {
    const attrs = node?.attributes || {};
    const supportPolicyText = [
      attrs.RVM_SUPPORT_OVERLAY,
      attrs.SUPPORT_SYMBOL_POLICY,
      attrs.SUPPORT_RVM_ALLOWED_CODES,
      attrs.SUPPORT_RVM_FORBIDDEN_CODES,
      attrs.RVM_OWNER_NAME,
      attrs.RVM_OWNER_PATH,
      attrs.NAME,
      node?.name,
    ].map(str).join(' ').toUpperCase();
    return supportPolicyText.includes('CODE8_COMPACT_BAR_GLYPHS')
      || /RVM_SUPPORT_OVERLAY\s*YES/.test(supportPolicyText)
      || /SUPPORT_RVM_ALLOWED_CODES\s*8/.test(supportPolicyText);
  });
}

function removeLegacySupportOverlay(viewer) {
  const roots = [viewer?.scene, viewer?.modelGroup].filter(Boolean);
  for (const root of roots) {
    const old = root?.getObjectByName?.(SUPPORT_OVERLAY_ROOT_NAME);
    if (!old) continue;
    old.parent?.remove?.(old);
    old.traverse?.((obj) => {
      obj.geometry?.dispose?.();
      if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach((material) => material?.dispose?.());
      }
      if (obj.element?.parentNode) obj.element.parentNode.removeChild(obj.element);
    });
  }
}

function refresh(viewer) {
  const options = optionsFromUi(viewer);
  viewer.userData = viewer.userData || {};
  viewer.userData.inputXmlGraphicsSourcePolicy = options.sourcePolicy;

  if (!options.sourcePolicy.autoBendEnabled && !options.sourcePolicy.supportOverlayEnabled) {
    removeLegacySupportOverlay(viewer);
    return;
  }

  refreshInputXmlGraphics(viewer, options);
  if (!options.supportOverlayEnabled || hasCompactNativeRvmSupportOverlay()) {
    removeLegacySupportOverlay(viewer);
    return;
  }
  applyInputXmlSupportGraphicsOverlay(viewer, options);
}

if (!RvmViewer3D.prototype.__inputXmlGraphicsSetModelBridgeV11) {
  const setModelOriginal = RvmViewer3D.prototype.setModel;
  RvmViewer3D.prototype.setModel = function setModelWithInputXmlGraphics(...args) {
    const result = setModelOriginal.apply(this, args);
    window.__rvmInputXmlSupportGraphicsViewer = this;
    setTimeout(() => refresh(this), 0);
    setTimeout(() => refresh(this), 100);
    return result;
  };
  RvmViewer3D.prototype.__inputXmlGraphicsSetModelBridgeV11 = true;
}
