export const PLATFORM_CONTRACT_SCHEMA = 'PlatformContractSchemas.v1';

export const PLANT_MODEL_GRAPH_SCHEMA = 'PlantModelGraph.v1';
export const CATALOGUE_REGISTRY_SCHEMA = 'CatalogueRegistry.v1';
export const COMPONENT_CATALOGUE_ITEM_SCHEMA = 'ComponentCatalogueItem.v1';
export const RESOLVED_PRIMITIVE_MODEL_SCHEMA = 'ResolvedPrimitiveModel.v1';

export const CONTRACT_SCHEMA_SET = Object.freeze({
  schema: PLATFORM_CONTRACT_SCHEMA,
  plantModelGraph: PLANT_MODEL_GRAPH_SCHEMA,
  catalogueRegistry: CATALOGUE_REGISTRY_SCHEMA,
  componentCatalogueItem: COMPONENT_CATALOGUE_ITEM_SCHEMA,
  resolvedPrimitiveModel: RESOLVED_PRIMITIVE_MODEL_SCHEMA
});
