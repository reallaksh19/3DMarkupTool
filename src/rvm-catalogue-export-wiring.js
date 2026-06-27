import {
  buildRvmValveFlangeCatalogueExport,
  RVM_CATALOGUE_SUPPORTED_PRIMITIVE_KINDS
} from './rvm-catalogue-primitive-translator.js?v=bust-cache-4';

export const RVM_CATALOGUE_EXPORT_WIRING_SCHEMA = 'RvmCatalogueExportWiring.v1';

/**
 * Applies C3B valve/flange catalogue parity to the production RVM export tree.
 *
 * This runs after the neutral export tree is built and before Navis-safe name
 * normalization / RVM writing. Unknown or non-catalogue components keep the
 * existing fallback primitives. Catalogue components are replaced only when the
 * translator returns writer-safe primitives.
 */
export function applyRvmCatalogueExportParity(exportModel, model, options = {}) {
  if (!exportModel?.root || !model?.elements?.length) return exportModel;
  if (model.sourceKind === 'stagedJson') {
    exportModel.audit = {
      ...(exportModel.audit || {}),
      rvmCatalogueParitySkipped: true,
      rvmCatalogueParitySkipReason: 'stagedJson valve/flange review output uses low-budget cylinder recipes, not rich legacy catalogue visuals.'
    };
    return exportModel;
  }

  const plant = findChild(exportModel.root, 'PLANT_GEOMETRY');
  if (!plant || !Array.isArray(plant.children)) return exportModel;

  const childByName = new Map(plant.children.map((child) => [child.name, child]));
  let catalogueComponentCount = 0;
  let cataloguePrimitiveCount = 0;
  const catalogueComponents = [];

  for (const element of model.elements) {
    const node = childByName.get(safeName(element.id || element.props?.id));
    if (!node) continue;

    const bundle = buildCatalogueBundleForElement(element, node, options);
    if (!bundle) continue;

    assertWriterSafe(bundle.primitives, element);
    node.primitives = bundle.primitives;
    node.attributes = {
      ...(node.attributes || {}),
      ...bundle.attributes,
      CATALOGUE_EXPORT_WIRING_SCHEMA: RVM_CATALOGUE_EXPORT_WIRING_SCHEMA,
      CATALOGUE_EXPORT_PRODUCTION_WIRING: 'TRUE'
    };

    catalogueComponentCount += 1;
    cataloguePrimitiveCount += bundle.primitives.length;
    catalogueComponents.push(node.name);
  }

  if (catalogueComponentCount > 0) {
    exportModel.audit = {
      ...(exportModel.audit || {}),
      primitiveCount: countPrimitives(exportModel.root),
      rvmCatalogueParity: true,
      rvmCatalogueExportWiringSchema: RVM_CATALOGUE_EXPORT_WIRING_SCHEMA,
      rvmCatalogueComponentCount: catalogueComponentCount,
      rvmCataloguePrimitiveCount: cataloguePrimitiveCount,
      rvmCatalogueComponents: catalogueComponents
    };
  }

  return exportModel;
}

function buildCatalogueBundleForElement(element, node, options) {
  const endpoints = elementEndpoints(element);
  if (!endpoints) return null;

  const length = vecLength(sub(endpoints.end, endpoints.start));
  if (!(length > 1e-6)) return null;

  const pipeRadius = Math.max(positiveNumber(element.props?.bore, 100) / 2, 1);
  return buildRvmValveFlangeCatalogueExport(
    element,
    { length, pipeRadius },
    {
      start: endpoints.start,
      end: endpoints.end,
      material: positiveNumber(node.material, 27),
      namePrefix: node.name,
      pipeRadius
    },
    options
  );
}

function elementEndpoints(element) {
  const start = pointFromNode(element.from);
  const end = pointFromNode(element.to);
  if (!start || !end) return null;
  return { start, end };
}

function assertWriterSafe(primitives, element) {
  const unsupported = (primitives || []).filter((primitive) => !RVM_CATALOGUE_SUPPORTED_PRIMITIVE_KINDS.includes(primitive.kind));
  if (unsupported.length) {
    const kinds = Array.from(new Set(unsupported.map((primitive) => primitive.kind))).join(',');
    throw new Error(`RVM catalogue translator emitted unsupported primitive kind(s) for ${element.id || element.props?.id}: ${kinds}`);
  }
}

function findChild(node, name) {
  return (node.children || []).find((child) => child.name === name) || null;
}

function countPrimitives(node) {
  const own = Array.isArray(node.primitives) ? node.primitives.length : 0;
  return own + (node.children || []).reduce((sum, child) => sum + countPrimitives(child), 0);
}

function pointFromNode(node) {
  if (!node) return null;
  const point = [Number(node.x), Number(node.y), Number(node.z)];
  return point.every(Number.isFinite) ? point : null;
}

function positiveNumber(value, fallback) {
  if (value && typeof value === 'object' && 'value' in value) value = value.value;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function safeName(value) {
  const clean = String(value || 'UNNAMED').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return clean || 'UNNAMED';
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vecLength(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}
