import {
  NEW_CORE_READINESS_AUDIT_SCHEMA,
  assertNewCoreReadinessAudit,
  validateAttExportModelContract,
  validateGlbVisualModelContract,
  validateNewCoreReadinessAudit,
  validatePlantModelGraphContract,
  validateResolvedGeometryModelContract,
  validateResolvedPrimitiveModelContract,
  validateRvmExportModelContract
} from '../contracts/index.js';

const CATALOGUE_BINDING_AUDIT_SCHEMA = 'CatalogueBindingAudit.v1';
const ALLOWED_PRIMITIVE_KINDS = Object.freeze(['CYLINDER', 'TORUS', 'FLANGE_CYLINDER']);
const BINARY_OR_WRITER_FIELDS = Object.freeze([
  'binary',
  'bytes',
  'buffer',
  'arrayBuffer',
  'chunk',
  'chunks',
  'cntb',
  'CNTB',
  'primBody',
  'PRIM',
  'fileBlob',
  'downloadUrl',
  'attText',
  'glbBytes',
  'gltfJson',
  'writerPayload',
  'writerCall',
  'writerResult'
]);
const EARLY_REVIEW_TRANSFORM_FIELDS = Object.freeze(['navisTransform', 'exportTransform', 'rvmMatrix', 'finalReviewTransform']);

export function buildNewCoreReadinessAudit(input = {}, options = {}) {
  const graph = input.graph || input.plantModelGraph;
  const bindingAudit = input.bindingAudit || input.catalogueBindingAudit;
  const resolvedGeometry = input.resolvedGeometry || input.resolvedGeometryModel;
  const primitiveModel = input.primitiveModel || input.resolvedPrimitiveModel;
  const exportModels = input.exportModels || {};
  const rvmExportModel = input.rvmExportModel || exportModels.rvmExportModel;
  const attExportModel = input.attExportModel || exportModels.attExportModel;
  const glbVisualModel = input.glbVisualModel || exportModels.glbVisualModel;

  const errors = [];
  const warnings = [];
  appendValidationErrors(errors, 'PlantModelGraph', validatePlantModelGraphContract(graph));
  if (!bindingAudit || bindingAudit.schema !== CATALOGUE_BINDING_AUDIT_SCHEMA) errors.push('CatalogueBindingAudit.v1 is required');
  appendValidationErrors(errors, 'ResolvedGeometryModel', validateResolvedGeometryModelContract(resolvedGeometry, { expectedAuthoringBasis: graph?.project?.axisBasis?.authoring }));
  appendValidationErrors(errors, 'ResolvedPrimitiveModel', validateResolvedPrimitiveModelContract(primitiveModel, { expectedAuthoringBasis: resolvedGeometry?.axisBasis?.authoring }));
  appendValidationErrors(errors, 'RvmExportModel', validateRvmExportModelContract(rvmExportModel));
  appendValidationErrors(errors, 'AttExportModel', validateAttExportModelContract(attExportModel));
  appendValidationErrors(errors, 'GlbVisualModel', validateGlbVisualModelContract(glbVisualModel));

  const earlyTransformHits = collectFieldHits({ graph, bindingAudit, resolvedGeometry, primitiveModel }, EARLY_REVIEW_TRANSFORM_FIELDS);
  errors.push(...earlyTransformHits.map((hit) => `final Review/Navis transform is not allowed before export-model boundary: ${hit.path}`));

  const payloadHits = collectFieldHits({ graph, bindingAudit, resolvedGeometry, primitiveModel, rvmExportModel, attExportModel, glbVisualModel }, BINARY_OR_WRITER_FIELDS);
  errors.push(...payloadHits.map((hit) => `writer/binary payload field is not allowed in new-core readiness phase: ${hit.path}`));
  if (Number(options.writerCallCount || 0) > 0) errors.push('writer calls are not allowed in new-core readiness phase');

  const graphItems = Array.isArray(graph?.items) ? graph.items : [];
  const bindingByItem = indexBySourceItem(bindingAudit?.bindings, 'itemId');
  const geometryByItem = buildGeometryIndex(resolvedGeometry);
  const primitiveByItem = buildPrimitiveIndex(primitiveModel);
  const rvmByItem = buildRvmExportIndex(rvmExportModel);
  const attByItem = buildAttIndex(attExportModel);
  const glbByItem = buildGlbIndex(glbVisualModel);

  for (const primitive of Array.isArray(primitiveModel?.primitives) ? primitiveModel.primitives : []) {
    const kind = primitive.primitiveKind || primitive.kind;
    if (!ALLOWED_PRIMITIVE_KINDS.includes(kind)) errors.push(`unsupported primitive ${kind || '<missing-kind>'} for source item ${primitive.sourceItemId || '<missing-source-item>'} was emitted`);
    if (!primitive.sourceItemId) errors.push(`primitive ${primitive.primitiveId || primitive.id || '<missing-id>'} lacks source item identity`);
  }
  checkExportIdentity(errors, 'RVM primitive', rvmExportModel?.primitives);
  checkExportIdentity(errors, 'RVM test-byte primitive', rvmExportModel?.testByteEligiblePrimitives);
  checkExportIdentity(errors, 'RVM deferred export', rvmExportModel?.deferredExports);
  checkExportIdentity(errors, 'RVM blocked export', rvmExportModel?.blockedExports);
  checkExportIdentity(errors, 'ATT record', attExportModel?.records);
  checkExportIdentity(errors, 'ATT deferred record', attExportModel?.deferredRecords);
  checkExportIdentity(errors, 'ATT blocked record', attExportModel?.blockedRecords);
  checkExportIdentity(errors, 'GLB visual', glbVisualModel?.visualItems);
  checkExportIdentity(errors, 'GLB deferred visual', glbVisualModel?.deferredVisuals);
  checkExportIdentity(errors, 'GLB blocked visual', glbVisualModel?.blockedVisuals);

  const traceRows = graphItems.map((item) => traceNewCorePipelineReadiness({
    item,
    binding: bindingByItem.get(String(item.id)),
    geometry: geometryByItem.get(String(item.id)),
    primitive: primitiveByItem.get(String(item.id)),
    rvm: rvmByItem.get(String(item.id)),
    att: attByItem.get(String(item.id)),
    glb: glbByItem.get(String(item.id))
  }));

  const audit = {
    schema: NEW_CORE_READINESS_AUDIT_SCHEMA,
    graphId: graph?.id || resolvedGeometry?.graphId || primitiveModel?.graphId || rvmExportModel?.graphId || options.graphId || '<unknown-graph>',
    sourceName: options.sourceName || sourceNameFrom(graph, resolvedGeometry, primitiveModel) || '<unknown-source>',
    itemCount: traceRows.length,
    graphNodeCount: Array.isArray(graph?.nodes) ? graph.nodes.length : 0,
    graphRouteCount: Array.isArray(graph?.routes) ? graph.routes.length : 0,
    graphItemCount: graphItems.length,

    catalogueResolvedCount: countBindings(bindingAudit, 'catalogueResolved'),
    proceduralResolvedCount: countBindings(bindingAudit, 'proceduralResolved'),
    fallbackBlockedCount: countBindings(bindingAudit, 'fallbackBlocked'),
    unresolvedBindingCount: countBindings(bindingAudit, 'unresolved'),
    supportIntentCount: countBindings(bindingAudit, 'supportIntent'),

    resolvedGeometryFrameCount: Array.isArray(resolvedGeometry?.itemFrames) ? resolvedGeometry.itemFrames.filter((entry) => entry.geometryStatus === 'resolved' || entry.geometryStatus === 'catalogueFrameResolved').length : 0,
    unresolvedGeometryCount: Array.isArray(resolvedGeometry?.unresolvedGeometry) ? resolvedGeometry.unresolvedGeometry.length : 0,
    resolvedPrimitiveCount: Array.isArray(primitiveModel?.primitives) ? primitiveModel.primitives.length : 0,
    deferredPrimitiveCount: Array.isArray(primitiveModel?.deferredPrimitives) ? primitiveModel.deferredPrimitives.length : 0,
    blockedPrimitiveCount: Array.isArray(primitiveModel?.blockedPrimitives) ? primitiveModel.blockedPrimitives.length : 0,

    rvmExportPrimitiveCount: Array.isArray(rvmExportModel?.primitives) ? rvmExportModel.primitives.length : 0,
    rvmDeferredExportCount: Array.isArray(rvmExportModel?.deferredExports) ? rvmExportModel.deferredExports.length : 0,
    rvmBlockedExportCount: Array.isArray(rvmExportModel?.blockedExports) ? rvmExportModel.blockedExports.length : 0,
    attRecordCount: Array.isArray(attExportModel?.records) ? attExportModel.records.length : 0,
    attDeferredRecordCount: Array.isArray(attExportModel?.deferredRecords) ? attExportModel.deferredRecords.length : 0,
    attBlockedRecordCount: Array.isArray(attExportModel?.blockedRecords) ? attExportModel.blockedRecords.length : 0,
    glbVisualCount: Array.isArray(glbVisualModel?.visualItems) ? glbVisualModel.visualItems.length : 0,
    glbDeferredVisualCount: Array.isArray(glbVisualModel?.deferredVisuals) ? glbVisualModel.deferredVisuals.length : 0,
    glbBlockedVisualCount: Array.isArray(glbVisualModel?.blockedVisuals) ? glbVisualModel.blockedVisuals.length : 0,

    productionReadyCount: countReadiness(traceRows, 'production-ready'),
    testByteOnlyCount: countReadiness(traceRows, 'test-byte-only'),
    deferredCount: countReadiness(traceRows, 'deferred'),
    blockedCount: countReadiness(traceRows, 'blocked'),
    unresolvedCount: countReadiness(traceRows, 'unresolved'),
    supportIntentOnlyCount: countReadiness(traceRows, 'support-intent-only'),

    traceRows,
    hardErrorCount: 0,
    warningCount: warnings.length,
    errors,
    warnings,
    ok: false
  };

  audit.hardErrorCount = audit.errors.length;
  audit.warningCount = audit.warnings.length;
  audit.ok = audit.hardErrorCount === 0;

  const contractValidation = validateNewCoreReadinessAudit(audit, { expectedItemIds: graphItems.map((item) => item.id) });
  if (!contractValidation.ok) {
    audit.errors.push(...contractValidation.errors.map((entry) => `NewCoreReadinessAudit contract: ${entry}`));
    audit.hardErrorCount = audit.errors.length;
    audit.ok = false;
  }

  return audit;
}

export function assertNewCorePipelineReadinessAudit(input = {}, options = {}) {
  const audit = buildNewCoreReadinessAudit(input, options);
  assertNewCoreReadinessAudit(audit, { expectedItemIds: (input.graph?.items || input.plantModelGraph?.items || []).map((item) => item.id) });
  if (!audit.ok) throw new Error(`NewCoreReadinessAudit failed: ${audit.errors.join('; ')}`);
  return audit;
}

export function traceNewCorePipelineReadiness({ item, binding, geometry, primitive, rvm, att, glb }) {
  const bindingStatus = binding?.status || 'missing';
  const geometryStatus = geometry?.status || 'missing';
  const primitiveStatus = primitive?.status || 'missing';
  const rvmExportStatus = rvm?.status || 'missing';
  const attStatus = att?.status || 'missing';
  const glbStatus = glb?.status || 'missing';
  const readiness = decideReadiness({ item, binding, geometry, primitive, rvm, att, glb });
  return {
    itemId: item?.id || '<missing-item-id>',
    sourceRef: item?.sourceRef || binding?.sourceRef || geometry?.sourceRef || primitive?.sourceRef || rvm?.sourceRef || att?.sourceRef || glb?.sourceRef || null,
    itemKind: item?.kind || binding?.itemKind || '<missing-kind>',
    bindingStatus,
    geometryStatus,
    primitiveStatus,
    rvmExportStatus,
    attStatus,
    glbStatus,
    readinessStatus: readiness.status,
    reason: readiness.reason || ''
  };
}

function decideReadiness({ item, binding, geometry, primitive, rvm, att, glb }) {
  if (item?.kind === 'support' || binding?.status === 'supportIntent') {
    return { status: 'support-intent-only', reason: reasonOf(primitive, rvm, att, glb, binding) || 'support engineering intent is preserved; support primitive generation is outside Phase 01' };
  }
  if (binding?.status === 'unresolved') return { status: 'unresolved', reason: binding.reason || 'no deterministic catalogue/procedural/fallback binding decision exists' };
  if (binding?.status === 'fallbackBlocked') return { status: 'blocked', reason: binding.reason || 'fallback is blocked without production evidence' };
  if (geometry?.status === 'blocked') return { status: 'blocked', reason: geometry.reason || 'resolved geometry is blocked' };
  if (primitive?.status === 'blocked') return { status: 'blocked', reason: primitive.reason || 'primitive compilation is blocked' };
  if (rvm?.status === 'blocked' || att?.status === 'blocked' || glb?.status === 'blocked') return { status: 'blocked', reason: reasonOf(rvm, att, glb) || 'export model is blocked' };
  if (rvm?.status === 'test-byte-only' || rvm?.testByteEligible === true || primitive?.primitiveKind === 'TORUS') return { status: 'test-byte-only', reason: reasonOf(rvm, primitive) || 'TORUS/code4 is test-byte-only until production writer policy explicitly allows it' };
  if (primitive?.status === 'deferred' || rvm?.status === 'deferred' || att?.status === 'deferred' || glb?.status === 'deferred') return { status: 'deferred', reason: reasonOf(rvm, att, glb, primitive) || 'valid model state is deferred until writer/runtime support is implemented' };
  if (rvm?.status === 'exportPlanned' && att?.status === 'recordPlanned' && glb?.status === 'visualPlanned') return { status: 'production-ready' };
  if (!binding || !geometry || !primitive || !rvm || !att || !glb) return { status: 'blocked', reason: 'missing end-to-end readiness evidence' };
  return { status: 'deferred', reason: 'readiness policy has no production writer proof for this item' };
}

function appendValidationErrors(errors, label, result) {
  if (!result?.ok) errors.push(...(result?.errors || [`${label} validation failed`]).map((entry) => `${label}: ${entry}`));
}

function buildGeometryIndex(model) {
  const index = new Map();
  for (const entry of Array.isArray(model?.itemFrames) ? model.itemFrames : []) index.set(String(entry.itemId), { status: entry.geometryStatus || 'resolved', reason: entry.reason, sourceRef: entry.sourceRef });
  for (const entry of Array.isArray(model?.supportPlacements) ? model.supportPlacements : []) index.set(String(entry.itemId), { status: entry.geometryStatus || 'intentOnly', reason: entry.reason, sourceRef: entry.sourceRef });
  for (const entry of Array.isArray(model?.unresolvedGeometry) ? model.unresolvedGeometry : []) index.set(String(entry.itemId), { status: entry.geometryStatus || 'blocked', reason: entry.reason, sourceRef: entry.sourceRef });
  return index;
}

function buildPrimitiveIndex(model) {
  const index = new Map();
  for (const entry of Array.isArray(model?.primitives) ? model.primitives : []) index.set(String(entry.sourceItemId), { status: entry.geometryStatus || 'primitiveResolved', primitiveKind: entry.primitiveKind || entry.kind, primitiveCode: entry.primitiveCode ?? entry.rvmCode, sourceRef: entry.sourceRef, reason: entry.reason });
  for (const entry of Array.isArray(model?.deferredPrimitives) ? model.deferredPrimitives : []) index.set(String(entry.sourceItemId), { status: entry.geometryStatus || 'deferred', reason: entry.reason, sourceRef: entry.sourceRef });
  for (const entry of Array.isArray(model?.blockedPrimitives) ? model.blockedPrimitives : []) index.set(String(entry.sourceItemId), { status: entry.geometryStatus || 'blocked', reason: entry.reason, sourceRef: entry.sourceRef });
  return index;
}

function buildRvmExportIndex(model) {
  const index = new Map();
  for (const entry of Array.isArray(model?.primitives) ? model.primitives : []) index.set(String(entry.sourceItemId), { status: 'exportPlanned', sourcePrimitiveId: entry.sourcePrimitiveId, sourceRef: entry.sourceRef });
  for (const entry of Array.isArray(model?.testByteEligiblePrimitives) ? model.testByteEligiblePrimitives : []) index.set(String(entry.sourceItemId), { status: 'test-byte-only', testByteEligible: entry.testByteEligible === true, reason: entry.reason || 'TORUS/code4 is test-byte-only until production writer policy explicitly allows it', sourcePrimitiveId: entry.sourcePrimitiveId, sourceRef: entry.sourceRef });
  for (const entry of Array.isArray(model?.deferredExports) ? model.deferredExports : []) {
    const status = entry.testByteEligible === true ? 'test-byte-only' : 'deferred';
    index.set(String(entry.sourceItemId), { status, testByteEligible: entry.testByteEligible === true, reason: entry.reason, sourcePrimitiveId: entry.sourcePrimitiveId, sourceRef: entry.sourceRef });
  }
  for (const entry of Array.isArray(model?.blockedExports) ? model.blockedExports : []) index.set(String(entry.sourceItemId), { status: 'blocked', reason: entry.reason, sourceRef: entry.sourceRef });
  return index;
}

function buildAttIndex(model) {
  const index = new Map();
  for (const entry of Array.isArray(model?.records) ? model.records : []) index.set(String(entry.sourceItemId), { status: entry.exportStatus || 'recordPlanned', sourceRef: entry.sourceRef });
  for (const entry of Array.isArray(model?.deferredRecords) ? model.deferredRecords : []) index.set(String(entry.sourceItemId), { status: entry.recordStatus || 'deferred', reason: entry.reason, sourceRef: entry.sourceRef });
  for (const entry of Array.isArray(model?.blockedRecords) ? model.blockedRecords : []) index.set(String(entry.sourceItemId), { status: entry.recordStatus || 'blocked', reason: entry.reason, sourceRef: entry.sourceRef });
  return index;
}

function buildGlbIndex(model) {
  const index = new Map();
  for (const entry of Array.isArray(model?.visualItems) ? model.visualItems : []) index.set(String(entry.sourceItemId), { status: entry.visualStatus || 'visualPlanned', sourceRef: entry.sourceRef });
  for (const entry of Array.isArray(model?.deferredVisuals) ? model.deferredVisuals : []) index.set(String(entry.sourceItemId), { status: entry.visualStatus || 'deferred', reason: entry.reason, sourceRef: entry.sourceRef });
  for (const entry of Array.isArray(model?.blockedVisuals) ? model.blockedVisuals : []) index.set(String(entry.sourceItemId), { status: entry.visualStatus || 'blocked', reason: entry.reason, sourceRef: entry.sourceRef });
  return index;
}

function indexBySourceItem(entries, idField) {
  const index = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) index.set(String(entry[idField]), entry);
  return index;
}

function countBindings(bindingAudit, status) {
  return Array.isArray(bindingAudit?.bindings) ? bindingAudit.bindings.filter((entry) => entry.status === status).length : 0;
}

function countReadiness(rows, status) {
  return rows.filter((row) => row.readinessStatus === status).length;
}

function sourceNameFrom(...models) {
  for (const model of models) {
    const source = Array.isArray(model?.sourceRefs) ? model.sourceRefs.find((entry) => entry?.name) : null;
    if (source?.name) return source.name;
  }
  return null;
}

function reasonOf(...entries) {
  for (const entry of entries) if (entry?.reason) return entry.reason;
  return '';
}

function checkExportIdentity(errors, label, entries) {
  for (const [index, entry] of (Array.isArray(entries) ? entries : []).entries()) {
    if (!entry?.sourceItemId && !entry?.sourcePrimitiveId) errors.push(`${label}[${index}] lacks source primitive or source item identity`);
  }
}

function collectFieldHits(value, fields, path = '$', hits = []) {
  if (!value || typeof value !== 'object') return hits;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectFieldHits(entry, fields, `${path}[${index}]`, hits));
    return hits;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (fields.includes(key)) hits.push({ path: `${path}.${key}`, field: key });
    collectFieldHits(entry, fields, `${path}.${key}`, hits);
  }
  return hits;
}
