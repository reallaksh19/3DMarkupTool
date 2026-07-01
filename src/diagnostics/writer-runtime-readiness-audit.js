import {
  validateAttExportModelContract,
  validateGlbVisualModelContract,
  validateRvmExportModelContract
} from '../contracts/index.js';

export const WRITER_RUNTIME_READINESS_AUDIT_SCHEMA = 'WriterRuntimeReadinessAudit.v1';
export const WRITER_RUNTIME_READINESS_STATUSES = Object.freeze([
  'writer-ready',
  'dry-run-ready',
  'test-byte-only',
  'deferred',
  'blocked',
  'runtime-unchanged'
]);

const RUNTIME_FILES = Object.freeze(['src/rvm-converter.js', 'src/rvm-preview.js', 'src/rvm-writer.js', 'src/att-writer.js', 'src/app.js', 'src/main.js', 'index.html']);
const FORBIDDEN_CORE_PREFIXES = Object.freeze(['src/contracts/', 'src/importers/', 'src/catalogue/', 'src/geometry/', 'src/primitives/', 'src/export-models/']);
const KNOWN_RVM_KINDS = Object.freeze(['CYLINDER', 'TORUS', 'FLANGE_CYLINDER', 'BOX', 'SPHERE', 'PYRAMID', 'SNOUT', 'SUPPORT_INTENT']);

export function buildWriterRuntimeReadinessAudit(input = {}, options = {}) {
  const exportModels = input.exportModels || {};
  const rvmExportModel = input.rvmExportModel || exportModels.rvmExportModel;
  const attExportModel = input.attExportModel || exportModels.attExportModel;
  const glbVisualModel = input.glbVisualModel || exportModels.glbVisualModel;
  const phase01 = input.newCoreReadinessAudit || input.phase01Audit;

  const errors = [];
  const warnings = [];
  if (!phase01 || phase01.schema !== 'NewCoreReadinessAudit.v1') errors.push('Required Phase 01 NewCoreReadinessAudit.v1 is missing');
  else if (phase01.ok !== true) errors.push('Required Phase 01 NewCoreReadinessAudit.v1 is not OK');

  appendValidation(errors, 'RvmExportModel', validateRvmExportModelContract(rvmExportModel));
  appendValidation(errors, 'AttExportModel', validateAttExportModelContract(attExportModel));
  appendValidation(errors, 'GlbVisualModel', validateGlbVisualModelContract(glbVisualModel));

  const changedFiles = fileList(options.changedFiles || []);
  const runtimeFilesChanged = changedFiles.some(isRuntimeFile) || options.runtimeFilesChanged === true;
  const forbiddenCoreFiles = changedFiles.filter((path) => FORBIDDEN_CORE_PREFIXES.some((prefix) => path.startsWith(prefix)));
  if (forbiddenCoreFiles.length) errors.push(`Core contract/import/catalogue/geometry/primitive/export-model files changed: ${forbiddenCoreFiles.join(', ')}`);
  if (runtimeFilesChanged && options.agent00RuntimeApproval !== true) errors.push('Production runtime files are changed without Agent 00 approval');
  if (options.productionRuntimePathChanged === true && options.phaseAuthorization !== true) errors.push('Existing production runtime path is changed without explicit phase authorization');
  if (options.productionWriterCalled === true) errors.push('Production writer was called in Phase 02 proof');
  if (options.writerAdapterCatalogueLookup === true) errors.push('Writer adapter performs catalogue lookup');
  if (options.writerAdapterSolvesGeometry === true) errors.push('Writer adapter solves geometry');
  if (options.secondFinalReviewTransformApplied === true || options.writerAdapterAppliesFinalReviewTransform === true) errors.push('Writer adapter applies a second Navis/final-review transform');

  const rvmRows = buildRvmWriterReadinessRows(rvmExportModel, input.writerAdapterPlan, input.testArtifactPlan, options);
  const attRows = buildAttWriterReadinessRows(attExportModel, input.writerAdapterPlan, input.testArtifactPlan, options);
  const glbRows = buildGlbPreviewReadinessRows(glbVisualModel, input.diagnosticPreviewModel, input.controlledPreviewModel, options);
  const traceRows = [...rvmRows, ...attRows, ...glbRows];
  enforceTraceRows(errors, traceRows);

  const audit = {
    schema: WRITER_RUNTIME_READINESS_AUDIT_SCHEMA,
    graphId: rvmExportModel?.graphId || attExportModel?.graphId || glbVisualModel?.graphId || phase01?.graphId || options.graphId || '<unknown-graph>',
    sourceName: options.sourceName || phase01?.sourceName || sourceNameFrom(rvmExportModel, attExportModel, glbVisualModel) || '<unknown-source>',

    rvmExportPrimitiveCount: count(rvmExportModel?.primitives),
    rvmWriterPlannedCount: rvmRows.length,
    rvmWriterReadyCount: countStatus(rvmRows, 'writer-ready'),
    rvmDryRunReadyCount: countStatus(rvmRows, 'dry-run-ready'),
    rvmTestByteOnlyCount: countStatus(rvmRows, 'test-byte-only'),
    rvmDeferredCount: countStatus(rvmRows, 'deferred'),
    rvmBlockedCount: countStatus(rvmRows, 'blocked'),

    attExportRecordCount: count(attExportModel?.records),
    attWriterReadyCount: countStatus(attRows, 'writer-ready') + countStatus(attRows, 'dry-run-ready'),
    attDeferredCount: countStatus(attRows, 'deferred'),
    attBlockedCount: countStatus(attRows, 'blocked'),

    glbVisualItemCount: count(glbVisualModel?.visualItems),
    previewReadyCount: countStatus(glbRows, 'writer-ready') + countStatus(glbRows, 'dry-run-ready'),
    previewDeferredCount: countStatus(glbRows, 'deferred'),
    previewBlockedCount: countStatus(glbRows, 'blocked'),

    runtimeFilesChanged,
    runtimeUnchanged: !runtimeFilesChanged && options.productionRuntimePathChanged !== true,
    productionWriterCalled: options.productionWriterCalled === true,
    testByteWriterCalled: options.testByteWriterCalled === true,
    binaryArtifactGenerated: options.binaryArtifactGenerated === true,
    attArtifactGenerated: options.attArtifactGenerated === true,
    glbArtifactGenerated: options.glbArtifactGenerated === true,

    traceRows,
    hardErrorCount: 0,
    warningCount: warnings.length,
    errors,
    warnings,
    ok: false
  };

  const contract = validateWriterRuntimeReadinessAudit(audit);
  if (!contract.ok) audit.errors.push(...contract.errors.map((entry) => `WriterRuntimeReadinessAudit contract: ${entry}`));
  audit.hardErrorCount = audit.errors.length;
  audit.warningCount = audit.warnings.length;
  audit.ok = audit.hardErrorCount === 0;
  return audit;
}

export function assertWriterRuntimeReadinessAudit(audit) {
  const result = validateWriterRuntimeReadinessAudit(audit);
  if (!result.ok) throw new Error(`WriterRuntimeReadinessAudit contract invalid: ${result.errors.join('; ')}`);
  if (audit.ok !== true) throw new Error(`WriterRuntimeReadinessAudit failed: ${(audit.errors || []).join('; ')}`);
  return result;
}

export function validateWriterRuntimeReadinessAudit(audit) {
  const errors = [];
  if (!audit || typeof audit !== 'object') errors.push('audit must be an object');
  if (audit?.schema !== WRITER_RUNTIME_READINESS_AUDIT_SCHEMA) errors.push(`schema must be ${WRITER_RUNTIME_READINESS_AUDIT_SCHEMA}`);
  if (!audit?.graphId) errors.push('graphId is required');
  if (!audit?.sourceName) errors.push('sourceName is required');
  for (const field of countFields()) if (!Number.isInteger(Number(audit?.[field])) || Number(audit?.[field]) < 0) errors.push(`${field} must be a non-negative integer`);
  for (const field of ['runtimeFilesChanged', 'runtimeUnchanged', 'productionWriterCalled', 'testByteWriterCalled', 'binaryArtifactGenerated', 'attArtifactGenerated', 'glbArtifactGenerated', 'ok']) if (typeof audit?.[field] !== 'boolean') errors.push(`${field} must be boolean`);
  if (!Array.isArray(audit?.traceRows)) errors.push('traceRows array is required');
  if (!Array.isArray(audit?.errors)) errors.push('errors array is required');
  if (!Array.isArray(audit?.warnings)) errors.push('warnings array is required');
  for (const [index, row] of array(audit?.traceRows).entries()) {
    for (const field of traceFields()) if (!(field in row)) errors.push(`traceRows[${index}].${field} is required`);
    if (!WRITER_RUNTIME_READINESS_STATUSES.includes(row.readinessStatus)) errors.push(`traceRows[${index}].readinessStatus must be one of ${WRITER_RUNTIME_READINESS_STATUSES.join(', ')}`);
    if (['test-byte-only', 'deferred', 'blocked'].includes(row.readinessStatus) && !row.reason) errors.push(`traceRows[${index}].reason is required for ${row.readinessStatus}`);
  }
  if (Array.isArray(audit?.errors) && audit.errors.length !== Number(audit?.hardErrorCount)) errors.push('hardErrorCount must equal errors.length');
  if (Array.isArray(audit?.warnings) && audit.warnings.length !== Number(audit?.warningCount)) errors.push('warningCount must equal warnings.length');
  if (audit?.ok === true && Number(audit?.hardErrorCount) !== 0) errors.push('ok cannot be true when hardErrorCount is non-zero');
  return { schema: 'WriterRuntimeReadinessAuditValidation.v1', ok: errors.length === 0, errorCount: errors.length, errors };
}

export function traceWriterAdapterReadiness(row) {
  if (!row || typeof row !== 'object') return { readinessStatus: 'blocked', reason: 'missing trace row' };
  if (row.readinessStatus) return { readinessStatus: row.readinessStatus, reason: row.reason || '' };
  if (row.writerStatus === 'planned' || row.adapterStatus === 'planned') return { readinessStatus: 'dry-run-ready', reason: row.reason || 'writer adapter dry-run plan accepted' };
  if (row.writerStatus === 'testByteEligible' || row.adapterStatus === 'testByteEligible') return { readinessStatus: 'test-byte-only', reason: row.reason || 'test-byte-only writer policy' };
  if (row.writerStatus === 'deferred' || row.adapterStatus === 'deferred') return { readinessStatus: 'deferred', reason: row.reason || 'writer/runtime bridge deferred' };
  if (row.writerStatus === 'blocked' || row.adapterStatus === 'blocked') return { readinessStatus: 'blocked', reason: row.reason || 'writer/runtime bridge blocked' };
  return { readinessStatus: 'blocked', reason: row.reason || 'writer readiness state is missing' };
}

export function buildRvmWriterReadinessRows(rvmExportModel, writerAdapterPlan = null, testArtifactPlan = null, options = {}) {
  return [
    ...array(rvmExportModel?.primitives).map((entry) => rvmTrace(entry, options)),
    ...array(rvmExportModel?.testByteEligiblePrimitives).map((entry) => rvmTrace(entry, options)),
    ...array(rvmExportModel?.deferredExports).map((entry) => statusTrace(entry, 'RvmExportModel.v1', entry.exportPrimitiveId || entry.sourcePrimitiveId || entry.sourceItemId, 'deferred', entry.reason || 'RVM export deferred')),
    ...array(rvmExportModel?.blockedExports).map((entry) => statusTrace(entry, 'RvmExportModel.v1', entry.exportPrimitiveId || entry.sourcePrimitiveId || entry.sourceItemId, 'blocked', entry.reason || 'RVM export blocked'))
  ];
}

export function buildAttWriterReadinessRows(attExportModel) {
  return [
    ...array(attExportModel?.records).map((record) => trace({ sourceItemId: record.sourceItemId, sourcePrimitiveId: record.sourcePrimitiveId || '', exportModel: 'AttExportModel.v1', exportRowId: record.recordId, primitiveKind: '', primitiveCode: '', adapterStatus: 'planned', writerStatus: 'planned', artifactStatus: 'not-generated', previewStatus: 'diagnostic-trace-ready', readinessStatus: 'dry-run-ready', reason: '' })),
    ...array(attExportModel?.deferredRecords).map((record) => statusTrace(record, 'AttExportModel.v1', record.recordId || record.sourceItemId, 'deferred', record.reason || 'ATT record deferred')),
    ...array(attExportModel?.blockedRecords).map((record) => statusTrace(record, 'AttExportModel.v1', record.recordId || record.sourceItemId, 'blocked', record.reason || 'ATT record blocked'))
  ];
}

export function buildGlbPreviewReadinessRows(glbVisualModel, diagnosticPreviewModel = null, controlledPreviewModel = null, options = {}) {
  return [
    ...array(glbVisualModel?.visualItems).map((visual) => trace({ sourceItemId: visual.sourceItemId, sourcePrimitiveId: visual.sourcePrimitiveId || '', exportModel: 'GlbVisualModel.v1', exportRowId: visual.visualItemId, primitiveKind: visual.visualKind || '', primitiveCode: visual.primitiveCode ?? '', adapterStatus: 'planned', writerStatus: 'planned', artifactStatus: options.glbArtifactGenerated === true ? 'generated' : 'not-generated', previewStatus: 'diagnostic-trace-ready', readinessStatus: 'dry-run-ready', reason: '' })),
    ...array(glbVisualModel?.deferredVisuals).map((visual) => statusTrace(visual, 'GlbVisualModel.v1', visual.visualItemId || visual.sourceItemId, 'deferred', visual.reason || 'GLB visual deferred')),
    ...array(glbVisualModel?.blockedVisuals).map((visual) => statusTrace(visual, 'GlbVisualModel.v1', visual.visualItemId || visual.sourceItemId, 'blocked', visual.reason || 'GLB visual blocked'))
  ];
}

function rvmTrace(entry, options) {
  const kind = entry.primitiveKind || entry.kind || '';
  let readinessStatus = 'blocked';
  let reason = entry.reason || '';
  if (!entry.sourceItemId && !entry.sourcePrimitiveId) reason = 'missing source item or source primitive identity';
  else if (!KNOWN_RVM_KINDS.includes(kind)) reason = `unsupported primitive ${kind || '<missing-kind>'}`;
  else if (kind === 'TORUS' || Number(entry.primitiveCode) === 4 || entry.testByteEligible === true) { readinessStatus = 'test-byte-only'; reason ||= 'TORUS/code4 is test-byte-only until production writer policy explicitly allows it'; }
  else if (kind === 'FLANGE_CYLINDER' || kind === 'SUPPORT_INTENT') { readinessStatus = 'deferred'; reason ||= `${kind} writer bridge remains deferred`; }
  else if (kind === 'CYLINDER' && Number(entry.primitiveCode) === 8) readinessStatus = options.productionWriterPolicyApproved === true ? 'writer-ready' : 'dry-run-ready';
  else reason ||= 'RVM primitive is not writer-ready in Phase 02';
  return trace({ sourceItemId: entry.sourceItemId || '', sourcePrimitiveId: entry.sourcePrimitiveId || '', exportModel: 'RvmExportModel.v1', exportRowId: entry.exportPrimitiveId || entry.sourcePrimitiveId || entry.sourceItemId || '<missing-export-row-id>', primitiveKind: kind, primitiveCode: entry.primitiveCode ?? '', adapterStatus: readinessStatus === 'blocked' ? 'blocked' : 'planned', writerStatus: readinessStatus, artifactStatus: 'not-generated', previewStatus: 'diagnostic-trace-ready', readinessStatus, reason });
}

function statusTrace(entry, exportModel, exportRowId, status, reason) {
  return trace({ sourceItemId: entry.sourceItemId || '', sourcePrimitiveId: entry.sourcePrimitiveId || '', exportModel, exportRowId, primitiveKind: entry.primitiveKind || entry.family || '', primitiveCode: entry.primitiveCode ?? '', adapterStatus: status, writerStatus: status, artifactStatus: 'not-generated', previewStatus: 'diagnostic-trace-ready', readinessStatus: status, reason });
}

function trace(row) { return row; }
function appendValidation(errors, label, result) { if (!result?.ok) errors.push(...(result?.errors || [`${label} validation failed`]).map((entry) => `${label}: ${entry}`)); }
function enforceTraceRows(errors, rows) { for (const row of rows) { if (!row.sourceItemId && !row.sourcePrimitiveId) errors.push(`${row.exportModel} row ${row.exportRowId} lacks source item or source primitive identity`); if (row.readinessStatus !== 'dry-run-ready' && row.readinessStatus !== 'writer-ready' && !row.reason) errors.push(`${row.exportModel} row ${row.exportRowId} requires reason for ${row.readinessStatus}`); } }
function count(value) { return array(value).length; }
function countStatus(rows, status) { return rows.filter((row) => row.readinessStatus === status).length; }
function array(value) { return Array.isArray(value) ? value : []; }
function fileList(value) { return Array.isArray(value) ? value.map(String) : []; }
function isRuntimeFile(path) { return RUNTIME_FILES.includes(path); }
function sourceNameFrom(...models) { for (const model of models) { const source = array(model?.sourceRefs).find((entry) => entry?.name); if (source?.name) return source.name; } return null; }
function countFields() { return ['rvmExportPrimitiveCount', 'rvmWriterPlannedCount', 'rvmWriterReadyCount', 'rvmDryRunReadyCount', 'rvmTestByteOnlyCount', 'rvmDeferredCount', 'rvmBlockedCount', 'attExportRecordCount', 'attWriterReadyCount', 'attDeferredCount', 'attBlockedCount', 'glbVisualItemCount', 'previewReadyCount', 'previewDeferredCount', 'previewBlockedCount', 'hardErrorCount', 'warningCount']; }
function traceFields() { return ['sourceItemId', 'sourcePrimitiveId', 'exportModel', 'exportRowId', 'primitiveKind', 'primitiveCode', 'adapterStatus', 'writerStatus', 'artifactStatus', 'previewStatus', 'readinessStatus', 'reason']; }
