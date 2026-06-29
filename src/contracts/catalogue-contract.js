import {
  CATALOGUE_REGISTRY_SCHEMA,
  COMPONENT_CATALOGUE_ITEM_SCHEMA
} from './platform-contract-schemas.js';

export function validateCatalogueRegistryContract(registry) {
  const errors = [];
  if (!registry || typeof registry !== 'object') errors.push('registry must be an object');
  if (registry?.schema !== CATALOGUE_REGISTRY_SCHEMA) errors.push(`schema must be ${CATALOGUE_REGISTRY_SCHEMA}`);
  if (!Array.isArray(registry?.catalogues)) errors.push('catalogues array is required');
  for (const [index, catalogue] of (registry?.catalogues || []).entries()) {
    if (!catalogue?.id) errors.push(`catalogues[${index}].id is required`);
    if (!catalogue?.version) errors.push(`catalogues[${index}].version is required`);
    if (!catalogue?.source) errors.push(`catalogues[${index}].source is required`);
    if (!Array.isArray(catalogue?.families)) errors.push(`catalogues[${index}].families array is required`);
  }
  return { schema: 'CatalogueRegistryValidation.v1', ok: errors.length === 0, errorCount: errors.length, errors };
}

export function validateComponentCatalogueItemContract(item) {
  const errors = [];
  if (!item || typeof item !== 'object') errors.push('item must be an object');
  if (item?.schema !== COMPONENT_CATALOGUE_ITEM_SCHEMA) errors.push(`schema must be ${COMPONENT_CATALOGUE_ITEM_SCHEMA}`);
  if (!item?.catalogue) errors.push('catalogue is required');
  if (!item?.family) errors.push('family is required');
  if (!item?.type) errors.push('type is required');
  if (!item?.dimensions || typeof item.dimensions !== 'object') errors.push('dimensions object is required');
  if (!Array.isArray(item?.ports) || !item.ports.length) errors.push('ports array with at least one port is required');
  if (!item?.rvmRecipe || typeof item.rvmRecipe !== 'object') errors.push('rvmRecipe object is required');

  for (const [index, port] of (item?.ports || []).entries()) {
    if (!port?.id) errors.push(`ports[${index}].id is required`);
    if (!isPoint3(port?.localPosition)) errors.push(`ports[${index}].localPosition must be [x,y,z]`);
    if (!isPoint3(port?.localDirection)) errors.push(`ports[${index}].localDirection must be [x,y,z]`);
  }

  return { schema: 'ComponentCatalogueItemValidation.v1', ok: errors.length === 0, errorCount: errors.length, errors };
}

export function assertCatalogueRegistryContract(registry) {
  const result = validateCatalogueRegistryContract(registry);
  if (!result.ok) throw new Error(`CatalogueRegistry contract invalid: ${result.errors.join('; ')}`);
  return result;
}

export function assertComponentCatalogueItemContract(item) {
  const result = validateComponentCatalogueItemContract(item);
  if (!result.ok) throw new Error(`ComponentCatalogueItem contract invalid: ${result.errors.join('; ')}`);
  return result;
}

function isPoint3(value) {
  return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry)));
}
