import {
  buildSupportRestraintPrimitiveRecords,
  assertSupportRestraintWriterSafePrimitives
} from './support-restraint-primitive-adapter.js?v=bust-cache-4';
import { resolveSupportRestraintVisualSpec } from './support-restraint-visual-catalog.js?v=bust-cache-4';

/**
 * Replaces production support/restraint symbol primitives with the shared
 * support/restraint catalogue adapter output.
 *
 * This is intentionally post-build wiring: export-model.js still owns support
 * record collection and ATT node creation, while this seam owns catalogue
 * primitive parity. The RVM writer remains constrained to cylinder/box/pyramid/
 * sphere records only.
 */
export function applySupportRestraintCatalogueExportParity(exportModel, model, options = {}) {
  const root = exportModel?.root;
  if (!root || !model) return exportModel;
  if (model.sourceKind === 'stagedJson') {
    exportModel.audit = {
      ...(exportModel.audit || {}),
      supportCatalogueExportParitySkipped: true,
      supportCatalogueExportParitySkipReason: 'stagedJson SUPPORT_MARKER nodes are canonical and must not be rewritten as legacy SUPPORT_RESTRAINT catalogue geometry.'
    };
    return exportModel;
  }

  const elementByNode = buildElementIndex(model);
  const supportGroup = findNode(root, (node) => node.attributes?.ROLE === 'SUPPORTS_RESTRAINTS');
  const supportNodes = (supportGroup?.children || []).filter((node) => node.attributes?.TYPE === 'SUPPORT_RESTRAINT');
  let rewrittenNodes = 0;
  let rewrittenPrimitives = 0;
  const families = new Set();

  for (const supportNode of supportNodes) {
    const attrs = supportNode.attributes || {};
    const nodeId = attrs.NODE;
    const pointNode = nodePosition(model, nodeId);
    if (!pointNode) continue;

    const spec = resolveSupportRestraintVisualSpec({
      family: attrs.FAMILY,
      axis: attrs.AXIS,
      typeCode: attrs.FAMILY
    });
    const record = {
      node: nodeId,
      family: attrs.FAMILY,
      axis: attrs.AXIS,
      sign: attrs.SIGN,
      sourceClass: attrs.SOURCE_CLASS,
      source: attrs.SOURCE,
      sourceMode: attrs.SOURCE_MODE,
      gapMm: parseOptionalNumber(attrs.GAP_MM),
      warningText: attrs.WARNING_TEXT,
      sourceNoteName: attrs.SOURCE_NOTE_NAME,
      material: supportNode.material
    };
    const primitives = buildSupportRestraintPrimitiveRecords(record, {
      point: pointFromNode(pointNode),
      tangent: localTangent(elementByNode, nodeId),
      od: localOd(elementByNode, nodeId),
      gapMm: record.gapMm,
      material: supportNode.material,
      sourceClass: attrs.SOURCE_CLASS,
      node: nodeId
    });
    assertSupportRestraintWriterSafePrimitives(primitives);
    if (!primitives.length) continue;

    supportNode.primitives = primitives.map((primitive) => ({
      ...primitive,
      material: primitive.material ?? supportNode.material
    }));
    supportNode.attributes = {
      ...attrs,
      SUPPORT_CATALOGUE_VISUAL: 'TRUE',
      SUPPORT_CATALOGUE_FAMILY: spec.family,
      SUPPORT_CATALOGUE_RECIPE_ID: spec.recipeId,
      SUPPORT_CATALOGUE_SCHEMA: spec.catalogSchemaVersion,
      SUPPORT_CATALOGUE_PROPORTIONAL_FALLBACK: String(Boolean(spec.proportionalFallback)).toUpperCase(),
      SUPPORT_CATALOGUE_VENDOR_DIMENSIONAL_DB_BACKED: String(Boolean(spec.vendorDimensionalDbBacked)).toUpperCase(),
      SUPPORT_CATALOGUE_EXPORT_PRODUCTION_WIRING: 'TRUE'
    };
    rewrittenNodes += 1;
    rewrittenPrimitives += supportNode.primitives.length;
    families.add(spec.family);
  }

  exportModel.audit = {
    ...(exportModel.audit || {}),
    supportCatalogueExportParity: rewrittenNodes > 0,
    supportCatalogueRewrittenNodeCount: rewrittenNodes,
    supportCataloguePrimitiveCount: rewrittenPrimitives,
    supportCatalogueFamilies: Array.from(families).sort(),
    supportCatalogueProportionalFallback: true,
    supportCatalogueVendorDimensionalDbBacked: false,
    supportCatalogueProductionWiring: true,
    supportCatalogueSupportMode: options.supportMode || exportModel.audit?.supportMode || 'compare'
  };

  return exportModel;
}

function findNode(node, predicate) {
  if (!node) return null;
  if (predicate(node)) return node;
  for (const child of node.children || []) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
  return null;
}

function buildElementIndex(model) {
  const index = new Map();
  for (const element of model.elements || []) {
    for (const node of [element.fromNode, element.toNode]) {
      const key = String(Number(node));
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(element);
    }
  }
  return index;
}

function nodePosition(model, nodeId) {
  return model.nodes?.get(String(Number(nodeId))) || null;
}

function pointFromNode(node) {
  return [Number(node.x) || 0, Number(node.y) || 0, Number(node.z) || 0];
}

function localTangent(elementByNode, nodeId) {
  const elements = elementByNode.get(String(Number(nodeId))) || [];
  if (!elements.length) return [1, 0, 0];
  const element = elements[0];
  const tangent = [element.dx, element.dy, element.dz];
  return vecLength(tangent) > 1e-8 ? normalize(tangent) : [1, 0, 0];
}

function localOd(elementByNode, nodeId) {
  const elements = elementByNode.get(String(Number(nodeId))) || [];
  if (!elements.length) return 100;
  return positiveNumber(elements[0].props?.bore, 100);
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function vecLength(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalize(vector) {
  const length = vecLength(vector);
  return length > 1e-12 ? [vector[0] / length, vector[1] / length, vector[2] / length] : [1, 0, 0];
}
