import { RvmViewer3D } from './RvmViewer3D.js?v=20260518-statusbar-theme-12';
import { applyInputXmlSupportGraphicsOverlay } from './RvmInputXmlSupportGraphics.js?v=20260619-source-bend-collapse-1';
import { refreshInputXmlGraphics } from './RvmInputXmlAutoBendGraphics.js?v=20260619-source-bend-collapse-1';
import { state } from '../core/state.js';

const SUPPORT_OVERLAY_ROOT_NAME = '__RVM_SUPPORT_SYMBOLS__';

function optionsFromUi() {
  const root = document.querySelector('[data-rvm-viewer]');
  const scale = Number(root?.querySelector?.('#rvm-support-scale')?.value);
  const labelsVisible = root?.querySelector?.('#rvm-support-labels')?.getAttribute?.('aria-pressed') === 'true';
  const autoBend = root?.querySelector?.('#rvm-inputxml-auto-bend')?.checked;
  return {
    scaleMultiplier: Number.isFinite(scale) ? scale : 3,
    labelsVisible,
    autoBendEnabled: autoBend !== false,
  };
}

function str(value) {
  if (value == null) return '';
  return String(value);
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
  const old = viewer?.scene?.getObjectByName?.(SUPPORT_OVERLAY_ROOT_NAME);
  if (!old) return;
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

function refresh(viewer) {
  const options = optionsFromUi();
  refreshInputXmlGraphics(viewer, options);
  if (hasCompactNativeRvmSupportOverlay()) {
    removeLegacySupportOverlay(viewer);
    return;
  }
  applyInputXmlSupportGraphicsOverlay(viewer, options);
}

if (!RvmViewer3D.prototype.__inputXmlGraphicsSetModelBridgeV10) {
  const setModelOriginal = RvmViewer3D.prototype.setModel;
  RvmViewer3D.prototype.setModel = function setModelWithInputXmlGraphics(...args) {
    const result = setModelOriginal.apply(this, args);
    window.__rvmInputXmlSupportGraphicsViewer = this;
    setTimeout(() => refresh(this), 0);
    setTimeout(() => refresh(this), 100);
    return result;
  };
  RvmViewer3D.prototype.__inputXmlGraphicsSetModelBridgeV10 = true;
}