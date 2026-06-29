import {
  validateComponentCatalogueItemContract,
  validatePlantModelGraphContract
} from '../contracts/index.js';
import { loadCatalogueRegistry, normalizeCatalogueKey } from './catalogue-registry.js';

export function bindPlantGraphItemToCatalogue(item, registry, catalogueItems, options = {}) {
  const loadedRegistry = ensureLoadedRegistry(registry, options);
  const itemIndex = buildCatalogueItemIndex(catalogueItems, options);
  const prefix = itemPrefix(item, options.itemIndex);

  if (item?.catalogueRef) {
    const catalogueKey = normalizeCatalogueKey(item.catalogueRef);
    const registeredCatalogue = loadedRegistry.catalogueById[normalizeCatalogueKey({ catalogue: item.catalogueRef.catalogue })];
    if (!registeredCatalogue) {
      const warning = `${prefix} unresolved: catalogue ${item.catalogueRef.catalogue} is not registered`;
      return unresolvedBinding(item, catalogueKey, warning);
    }

    const catalogueItem = itemIndex.get(catalogueKey);
    if (catalogueItem) {
      return {
        itemId: item.id,
        mode: 'catalogue',
        catalogueKey,
        catalogueItemId: catalogueItem.id ?? catalogueKey,
        catalogueItem
      };
    }

    const fallback = resolveFallback(item, catalogueKey, options);
    if (fallback) {
      return {
        itemId: item.id,
        mode: 'fallback',
        catalogueKey,
        fallback
      };
    }

    const warning = `${prefix} unresolved: no catalogue item for ${catalogueKey}`;
    return unresolvedBinding(item, catalogueKey, warning);
  }

  const proceduralGenerator = resolveProceduralGenerator(item);
  if (proceduralGenerator) {
    return {
      itemId: item.id,
      mode: 'procedural',
      generator: proceduralGenerator
    };
  }

  const fallback = resolveFallback(item, null, options);
  if (fallback) {
    return {
      itemId: item.id,
      mode: 'fallback',
      fallback
    };
  }

  const warning = `${prefix} unresolved: no catalogueRef or procedural generator`;
  return unresolvedBinding(item, null, warning);
}

export function bindPlantGraphCatalogueRefs(graph, registry, catalogueItems, options = {}) {
  const graphValidation = validatePlantModelGraphContract(graph);
  if (!graphValidation.ok && options.throwOnInvalid !== false) {
    throw new Error(`PlantModelGraph invalid: ${graphValidation.errors.join('; ')}`);
  }

  const itemBindings = (graph?.items || []).map((item, index) =>
    bindPlantGraphItemToCatalogue(item, registry, catalogueItems, { ...options, itemIndex: index })
  );

  const auditBindings = itemBindings.map(toAuditBinding);
  const warnings = itemBindings.filter((binding) => binding.warning).map((binding) => binding.warning);

  return {
    schema: 'CatalogueBindingAudit.v1',
    graphId: graph?.id ?? graph?.graphId ?? null,
    itemCount: itemBindings.length,
    catalogueResolved: itemBindings.filter((binding) => binding.mode === 'catalogue').length,
    proceduralResolved: itemBindings.filter((binding) => binding.mode === 'procedural').length,
    fallbackResolved: itemBindings.filter((binding) => binding.mode === 'fallback').length,
    unresolved: itemBindings.filter((binding) => binding.mode === 'unresolved').length,
    warnings,
    bindings: auditBindings
  };
}

function ensureLoadedRegistry(registry, options) {
  if (registry?.schema === 'LoadedCatalogueRegistry.v1') return registry;
  return loadCatalogueRegistry(registry, options);
}

function buildCatalogueItemIndex(catalogueItems, options = {}) {
  const itemList = extractCatalogueItems(catalogueItems);
  const index = new Map();

  for (const [listIndex, item] of itemList.entries()) {
    const validation = validateComponentCatalogueItemContract(item);
    if (!validation.ok && options.throwOnInvalidItems !== false) {
      throw new Error(`ComponentCatalogueItem invalid at catalogueItems[${listIndex}]: ${validation.errors.join('; ')}`);
    }

    const key = normalizeCatalogueKey(item);
    if (key && !index.has(key)) index.set(key, item);
  }

  return index;
}

function extractCatalogueItems(catalogueItems) {
  if (Array.isArray(catalogueItems)) return catalogueItems;
  if (Array.isArray(catalogueItems?.items)) return catalogueItems.items;
  return [];
}

function resolveProceduralGenerator(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.generator) return String(item.generator);
  if (item.kind === 'generated') return 'generatedItem.v1';
  if (item.kind === 'support') {
    const family = item.supportFamily ? String(item.supportFamily).trim().toLowerCase() : 'generic';
    return `supportMarker.${family}.v1`;
  }
  return null;
}

function resolveFallback(item, catalogueKey, options) {
  if (typeof options.fallbackResolver !== 'function') return null;
  return options.fallbackResolver(item, { catalogueKey }) || null;
}

function unresolvedBinding(item, catalogueKey, warning) {
  return {
    itemId: item?.id ?? null,
    mode: 'unresolved',
    ...(catalogueKey ? { catalogueKey } : {}),
    warning
  };
}

function itemPrefix(item, index) {
  const id = item?.id ?? '<unknown>';
  return Number.isInteger(index) ? `items[${index}] ${id}` : id;
}

function toAuditBinding(binding) {
  const base = {
    itemId: binding.itemId,
    mode: binding.mode
  };

  if (binding.mode === 'catalogue') {
    return {
      ...base,
      catalogueKey: binding.catalogueKey,
      catalogueItemId: binding.catalogueItemId
    };
  }

  if (binding.mode === 'procedural') {
    return {
      ...base,
      generator: binding.generator
    };
  }

  if (binding.mode === 'fallback') {
    return {
      ...base,
      ...(binding.catalogueKey ? { catalogueKey: binding.catalogueKey } : {}),
      fallback: binding.fallback
    };
  }

  return {
    ...base,
    ...(binding.catalogueKey ? { catalogueKey: binding.catalogueKey } : {}),
    warning: binding.warning
  };
}
