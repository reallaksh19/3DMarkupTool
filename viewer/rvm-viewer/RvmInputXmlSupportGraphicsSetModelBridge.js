import { RvmViewer3D } from './RvmViewer3D.js?v=20260518-statusbar-theme-12';
import { applyInputXmlSupportGraphicsOverlay } from './RvmInputXmlSupportGraphics.js?v=20260619-source-bend-collapse-1';
import { refreshInputXmlGraphics } from './RvmInputXmlAutoBendGraphics.js?v=20260619-source-bend-collapse-1';
import { state } from '../core/state.js';

const SUPPORT_OVERLAY_ROOT_NAME = '__RVM_SUPPORT_SYMBOLS__';
const STANDALONE_RVM_SUPPORT_OWNER_RE = /\bINPUTXML-\d+-(?:REST|GUIDE|LINESTOP|LINE_STOP|LIMITSTOP|LIMIT_STOP|HOLDDOWN|HOLD_DOWN|SUPPORT|SUPP)-\d+\b/;

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

function textFromValue(value, seen = new WeakSet(), depth = 0) {
  if (value == null || depth > 4) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value !== 'object') return '';
  if (seen.has(value)) return '';
  seen.add(value);
  if (Array.isArray(value)) return value.map((entry) => textFromValue(entry, seen, depth + 1)).join(' ');
  return Object.entries(value)
    .map(([key, entry]) => `${key} ${textFromValue(entry, seen, depth + 1)}`)
    .join(' ');
}

function supportPolicyTextFromNode(node) {
  const attrs = node?.attributes || {};
  return [
    attrs.RVM_SUPPORT_OVERLAY,
    attrs.SUPPORT_SYMBOL_POLICY,
    attrs.SUPPORT_RVM_ALLOWED_CODES,
    attrs.SUPPORT_RVM_FORBIDDEN_CODES,
    attrs.RVM_OWNER_NAME,
    attrs.RVM_OWNER_PATH,
    attrs.NAME,
    node?.name,
  ].map(str).join(' ').toUpperCase();
}

function hasAttributeBackedCompactNativeRvmSupportOverlay() {
  const nodes = Array.isArray(state?.rvm?.index?.nodes) ? state.rvm.index.nodes : [];
  return nodes.some((node) => {
    const supportPolicyText = supportPolicyTextFromNode(node);
    return supportPolicyText.includes('CODE8_COMPACT_BAR_GLYPHS')
      || /RVM_SUPPORT_OVERLAY\s*YES/.test(supportPolicyText)
      || /SUPPORT_RVM_ALLOWED_CODES\s*8/.test(supportPolicyText);
  });
}

function objectEvidenceText(object) {
  return [
    object?.name,
    object?.type,
    textFromValue(object?.userData),
  ].join(' ').toUpperCase();
}

function looksLikeStandaloneNativeSupportCode8Cylinder(object) {
  const text = objectEvidenceText(object);
  if (!STANDALONE_RVM_SUPPORT_OWNER_RE.test(text)) return false;
  const isCode8 = /RVM_PRIMITIVE_CODE\s*[:=]?\s*8\b/.test(text)
    || /\[PRIM\s+CODE\s+8\]/.test(text)
    || /\bPRIM\s+CODE\s+8\b/.test(text);
  const isNativeCylinder = /RVM_NATIVE_CYLINDER|RVM\s+CYLINDER|RVM_PRIMITIVE_KIND\s*[:=]?\s*CYLINDER|RVM_PRIMITIVE_KIND_NAME\s*[:=]?\s*CYLINDER/.test(text);
  const isStandaloneFallback = /RVM_BINARY_BROWSER_FALLBACK|BROWSER_PARSE_METHOD|RVM_BROWSER_RENDER_PRIMITIVE/.test(text);
  return isCode8 && isNativeCylinder && isStandaloneFallback;
}

function hasStandaloneFallbackNativeRvmSupportOverlay(viewer) {
  let found = false;
  viewer?.scene?.traverse?.((object) => {
    if (!found && looksLikeStandaloneNativeSupportCode8Cylinder(object)) found = true;
  });
  return found;
}

function hasCompactNativeRvmSupportOverlay(viewer) {
  return hasAttributeBackedCompactNativeRvmSupportOverlay()
    || hasStandaloneFallbackNativeRvmSupportOverlay(viewer);
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
  if (hasCompactNativeRvmSupportOverlay(viewer)) {
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

export const __rvmInputXmlSupportGraphicsBridgeTest = {
  STANDALONE_RVM_SUPPORT_OWNER_RE,
  looksLikeStandaloneNativeSupportCode8Cylinder,
};
