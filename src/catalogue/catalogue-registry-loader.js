import {
  validateCatalogueRegistryContract,
  validateComponentCatalogueItemContract
} from '../contracts/index.js';

const REGISTRY_AUDIT_SCHEMA = 'CatalogueRegistryLoadAudit.v1';
const ITEM_AUDIT_SCHEMA = 'CatalogueItemLoadAudit.v1';
const INDEX_SCHEMA = 'BasePipingCatalogueIndex.v1';

export function loadCatalogueRegistryFromText(sourceText, options = {}) {
  const parsed = parseJson(sourceText, 'catalogue registry');
  const registry = parsed.ok ? parsed.value : null;
  const validation = validateCatalogueRegistryContract(registry);
  const audit = auditCatalogueRegistryLoad(registry, validation, {
    ...options,
    parsed: parsed.ok,
    parseError: parsed.error
  });
  return { registry, validation, audit };
}

export function auditCatalogueRegistryLoad(registry, validation = validateCatalogueRegistryContract(registry), options = {}) {
  const catalogues = Array.isArray(registry?.catalogues) ? registry.catalogues : [];
  const familySet = new Set();
  for (const catalogue of catalogues) {
    for (const family of Array.isArray(catalogue?.families) ? catalogue.families : []) familySet.add(String(family));
  }
  const warnings = [];
  if (options.parseError) warnings.push(options.parseError);
  if (!validation.ok) warnings.push(...validation.errors);
  return {
    schema: REGISTRY_AUDIT_SCHEMA,
    sourceName: options.sourceName || 'catalogue-registry.json',
    parsed: options.parsed !== false,
    valid: Boolean(validation.ok),
    catalogueCount: catalogues.length,
    familyCount: familySet.size,
    itemSourceCount: catalogues.filter((catalogue) => typeof catalogue?.source === 'string' && catalogue.source.trim()).length,
    warnings
  };
}

export function loadCatalogueItemsFromMap(registry, fileMap, options = {}) {
  const warnings = [];
  const items = [];
  const itemKeys = [];
  const unsupportedSources = [];

  for (const catalogue of Array.isArray(registry?.catalogues) ? registry.catalogues : []) {
    const source = catalogue?.source;
    if (!source) {
      warnings.push(`catalogue ${catalogue?.id || '<unknown>'} has no source`);
      continue;
    }
    const sourceText = readFileMapEntry(fileMap, source);
    if (sourceText === undefined) {
      warnings.push(`missing catalogue source: ${source}`);
      continue;
    }
    const parsed = parseJson(sourceText, source);
    if (!parsed.ok) {
      warnings.push(parsed.error);
      continue;
    }
    if (parsed.value?.schema === INDEX_SCHEMA || Array.isArray(parsed.value?.items)) {
      for (const entry of parsed.value.items || []) {
        const itemSource = entry?.source;
        if (!itemSource) {
          warnings.push(`catalogue index entry ${entry?.id || '<unknown>'} has no source`);
          continue;
        }
        const itemText = readFileMapEntry(fileMap, itemSource);
        if (itemText === undefined) {
          warnings.push(`missing catalogue item source: ${itemSource}`);
          continue;
        }
        appendCatalogueItem(items, itemKeys, warnings, itemText, itemSource);
      }
    } else if (parsed.value?.schema === 'ComponentCatalogueItem.v1') {
      appendCatalogueItem(items, itemKeys, warnings, sourceText, source);
    } else {
      unsupportedSources.push(source);
      warnings.push(`unsupported catalogue source schema for ${source}: ${parsed.value?.schema || '<missing>'}`);
    }
  }

  const audit = {
    schema: ITEM_AUDIT_SCHEMA,
    sourceName: options.sourceName || 'catalogue-items',
    itemCount: items.length,
    validItemCount: items.filter((item) => validateComponentCatalogueItemContract(item).ok).length,
    invalidItemCount: items.filter((item) => !validateComponentCatalogueItemContract(item).ok).length,
    itemKeys,
    unsupportedSources,
    warnings
  };
  return { items, audit };
}

export function catalogueItemKey(item) {
  return [item?.catalogue, item?.family, item?.type, item?.nps, item?.schedule]
    .filter((part) => part !== undefined && part !== null && String(part).trim() !== '')
    .map((part) => String(part))
    .join('/');
}

function appendCatalogueItem(items, itemKeys, warnings, sourceText, sourceName) {
  const parsed = parseJson(sourceText, sourceName);
  if (!parsed.ok) {
    warnings.push(parsed.error);
    return;
  }
  const validation = validateComponentCatalogueItemContract(parsed.value);
  if (!validation.ok) {
    warnings.push(`invalid catalogue item ${sourceName}: ${validation.errors.join('; ')}`);
    return;
  }
  items.push(parsed.value);
  itemKeys.push(catalogueItemKey(parsed.value));
}

function readFileMapEntry(fileMap, source) {
  if (fileMap instanceof Map) return fileMap.get(source);
  if (fileMap && typeof fileMap === 'object') return fileMap[source];
  return undefined;
}

function parseJson(sourceText, label) {
  try {
    const value = typeof sourceText === 'string' ? JSON.parse(sourceText) : sourceText;
    return value && typeof value === 'object'
      ? { ok: true, value }
      : { ok: false, error: `${label} JSON root must be an object` };
  } catch (error) {
    return { ok: false, error: `${label} JSON parse failed: ${error.message}` };
  }
}
