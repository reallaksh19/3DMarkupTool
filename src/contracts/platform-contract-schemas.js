export const PLATFORM_CONTRACT_SCHEMA = 'PlatformContractSchemas.v1';

export const PLANT_MODEL_GRAPH_SCHEMA = 'PlantModelGraph.v1';
export const CATALOGUE_REGISTRY_SCHEMA = 'CatalogueRegistry.v1';
export const COMPONENT_CATALOGUE_ITEM_SCHEMA = 'ComponentCatalogueItem.v1';
export const RESOLVED_GEOMETRY_MODEL_SCHEMA = 'ResolvedGeometryModel.v1';
export const RESOLVED_PRIMITIVE_MODEL_SCHEMA = 'ResolvedPrimitiveModel.v1';
export const RVM_EXPORT_MODEL_SCHEMA = 'RvmExportModel.v1';
export const ATT_EXPORT_MODEL_SCHEMA = 'AttExportModel.v1';
export const GLB_VISUAL_MODEL_SCHEMA = 'GlbVisualModel.v1';
export const WRITER_ADAPTER_PLAN_SCHEMA = 'WriterAdapterPlan.v1';
export const TEST_ARTIFACT_ADAPTER_PLAN_SCHEMA = 'TestArtifactAdapterPlan.v1';

export const CONTRACT_SCHEMA_SET = Object.freeze({
  schema: PLATFORM_CONTRACT_SCHEMA,
  plantModelGraph: PLANT_MODEL_GRAPH_SCHEMA,
  catalogueRegistry: CATALOGUE_REGISTRY_SCHEMA,
  componentCatalogueItem: COMPONENT_CATALOGUE_ITEM_SCHEMA,
  resolvedGeometryModel: RESOLVED_GEOMETRY_MODEL_SCHEMA,
  resolvedPrimitiveModel: RESOLVED_PRIMITIVE_MODEL_SCHEMA,
  rvmExportModel: RVM_EXPORT_MODEL_SCHEMA,
  attExportModel: ATT_EXPORT_MODEL_SCHEMA,
  glbVisualModel: GLB_VISUAL_MODEL_SCHEMA,
  writerAdapterPlan: WRITER_ADAPTER_PLAN_SCHEMA,
  testArtifactAdapterPlan: TEST_ARTIFACT_ADAPTER_PLAN_SCHEMA
});
