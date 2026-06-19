/**
 * Normalizes renderer-neutral export tree names before Navisworks RVM/ATT serialization.
 * Parameters: export model produced by buildRvmExportModel.
 * Output: same export model object with node and primitive names made Navis/ATT safe.
 * Fallback: unsafe or empty names are replaced with deterministic UNNAMED-style safe tokens.
 */
const SAFE_NAVIS_NAME = /^[A-Za-z0-9_]+$/;

export function normalizeNavisExportModelNames(exportModel) {
  if (!exportModel || typeof exportModel !== 'object' || !exportModel.root) return exportModel;

  const nodeNames = new Map();
  const primitiveNames = new Map();
  normalizeNode(exportModel.root, nodeNames, primitiveNames);
  return exportModel;
}

export function toNavisSafeName(value) {
  const expanded = String(value || 'UNNAMED')
    .replace(/\+/g, '_PLUS_')
    .replace(/-/g, '_MINUS_');
  const clean = expanded
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || 'UNNAMED';
}

export function isNavisSafeName(value) {
  return SAFE_NAVIS_NAME.test(String(value || ''));
}

function normalizeNode(node, nodeNames, primitiveNames) {
  if (!node || typeof node !== 'object') return;

  node.name = uniqueSafeName(node.name, nodeNames);

  if (Array.isArray(node.primitives)) {
    for (const primitive of node.primitives) {
      if (!primitive || typeof primitive !== 'object') continue;
      primitive.name = uniqueSafeName(primitive.name, primitiveNames);
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) normalizeNode(child, nodeNames, primitiveNames);
  }
}

function uniqueSafeName(value, seen) {
  const base = toNavisSafeName(value);
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}_${count + 1}`;
}
