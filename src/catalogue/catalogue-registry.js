import { validateCatalogueRegistryContract } from '../contracts/index.js';

export function normalizeCatalogueKey(key) {
  if (key == null) return '';
  if (typeof key === 'string' || typeof key === 'number') return normalizeToken(key);
  if (typeof key !== 'object') return '';

  const parts = [
    key.catalogue ?? key.catalog ?? key.catalogueId,
    key.family,
    key.type ?? key.componentType,
    key.nps ?? key.size ?? key.bore,
    key.schedule ?? key.sch,
    key.rating,
    key.material
  ];

  return parts
    .filter((part) => part !== undefined && part !== null && String(part).trim() !== '')
    .map(normalizeToken)
    .join('|');
}

export function validateCatalogueRegistry(registryObject) {
  const contract = validateCatalogueRegistryContract(registryObject);
  const errors = [...contract.errors];
  const warnings = [];
  const seenCatalogueIds = new Set();

  for (const [index, catalogue] of (registryObject?.catalogues || []).entries()) {
    const catalogueKey = normalizeCatalogueKey({ catalogue: catalogue?.id });
    if (catalogueKey && seenCatalogueIds.has(catalogueKey)) {
      errors.push(`catalogues[${index}].id duplicates ${catalogue.id}`);
    }
    if (catalogueKey) seenCatalogueIds.add(catalogueKey);

    for (const [familyIndex, family] of (catalogue?.families || []).entries()) {
      if (!normalizeToken(family)) {
        errors.push(`catalogues[${index}].families[${familyIndex}] must be non-empty`);
      }
    }

    if (Array.isArray(catalogue?.generators) && !catalogue.generators.length) {
      warnings.push(`catalogues[${index}].generators is empty`);
    }
  }

  return {
    ...contract,
    ok: errors.length === 0,
    errorCount: errors.length,
    errors,
    warningCount: warnings.length,
    warnings
  };
}

export function loadCatalogueRegistry(registryObject, options = {}) {
  const validation = validateCatalogueRegistry(registryObject);
  if (!validation.ok && options.throwOnInvalid !== false) {
    throw new Error(`CatalogueRegistry invalid: ${validation.errors.join('; ')}`);
  }

  const catalogues = (registryObject?.catalogues || []).map((catalogue) => ({
    ...catalogue,
    key: normalizeCatalogueKey({ catalogue: catalogue.id }),
    familyKeys: (catalogue.families || []).map((family) => normalizeCatalogueKey({ family }))
  }));

  return {
    schema: 'LoadedCatalogueRegistry.v1',
    source: registryObject,
    catalogues,
    catalogueById: Object.fromEntries(catalogues.map((catalogue) => [catalogue.key, catalogue])),
    validation
  };
}

function normalizeToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}
