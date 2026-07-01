import { NEW_CORE_READINESS_AUDIT_SCHEMA } from './platform-contract-schemas.js';

export const NEW_CORE_READINESS_STATUSES = Object.freeze([
  'production-ready',
  'test-byte-only',
  'deferred',
  'blocked',
  'unresolved',
  'support-intent-only'
]);

const REQUIRED_COUNT_FIELDS = Object.freeze([
  'itemCount',
  'graphNodeCount',
  'graphRouteCount',
  'graphItemCount',
  'catalogueResolvedCount',
  'proceduralResolvedCount',
  'fallbackBlockedCount',
  'unresolvedBindingCount',
  'supportIntentCount',
  'resolvedGeometryFrameCount',
  'unresolvedGeometryCount',
  'resolvedPrimitiveCount',
  'deferredPrimitiveCount',
  'blockedPrimitiveCount',
  'rvmExportPrimitiveCount',
  'rvmDeferredExportCount',
  'rvmBlockedExportCount',
  'attRecordCount',
  'attDeferredRecordCount',
  'attBlockedRecordCount',
  'glbVisualCount',
  'glbDeferredVisualCount',
  'glbBlockedVisualCount',
  'productionReadyCount',
  'testByteOnlyCount',
  'deferredCount',
  'blockedCount',
  'unresolvedCount',
  'supportIntentOnlyCount',
  'hardErrorCount',
  'warningCount'
]);

const REQUIRED_ROW_FIELDS = Object.freeze([
  'itemId',
  'sourceRef',
  'itemKind',
  'bindingStatus',
  'geometryStatus',
  'primitiveStatus',
  'rvmExportStatus',
  'attStatus',
  'glbStatus',
  'readinessStatus',
  'reason'
]);

export function validateNewCoreReadinessAudit(audit, options = {}) {
  const errors = [];
  if (!audit || typeof audit !== 'object') errors.push('audit must be an object');
  if (audit?.schema !== NEW_CORE_READINESS_AUDIT_SCHEMA) errors.push(`schema must be ${NEW_CORE_READINESS_AUDIT_SCHEMA}`);
  if (!audit?.graphId) errors.push('graphId is required');
  if (!audit?.sourceName) errors.push('sourceName is required');
  for (const field of REQUIRED_COUNT_FIELDS) {
    if (!Number.isInteger(Number(audit?.[field])) || Number(audit?.[field]) < 0) errors.push(`${field} must be a non-negative integer`);
  }
  if (!Array.isArray(audit?.traceRows)) errors.push('traceRows array is required');
  if (!Array.isArray(audit?.errors)) errors.push('errors array is required');
  if (!Array.isArray(audit?.warnings)) errors.push('warnings array is required');
  if (typeof audit?.ok !== 'boolean') errors.push('ok must be boolean');

  const rows = Array.isArray(audit?.traceRows) ? audit.traceRows : [];
  const seen = new Set();
  const duplicated = new Set();
  for (const [index, row] of rows.entries()) {
    if (!row || typeof row !== 'object') {
      errors.push(`traceRows[${index}] must be an object`);
      continue;
    }
    for (const field of REQUIRED_ROW_FIELDS) {
      if (!(field in row)) errors.push(`traceRows[${index}].${field} is required`);
    }
    if (!row.itemId) errors.push(`traceRows[${index}].itemId is required`);
    if (!row.itemKind) errors.push(`traceRows[${index}].itemKind is required`);
    if (!row.bindingStatus) errors.push(`traceRows[${index}].bindingStatus is required`);
    if (!row.geometryStatus) errors.push(`traceRows[${index}].geometryStatus is required`);
    if (!row.primitiveStatus) errors.push(`traceRows[${index}].primitiveStatus is required`);
    if (!row.rvmExportStatus) errors.push(`traceRows[${index}].rvmExportStatus is required`);
    if (!row.attStatus) errors.push(`traceRows[${index}].attStatus is required`);
    if (!row.glbStatus) errors.push(`traceRows[${index}].glbStatus is required`);
    if (!NEW_CORE_READINESS_STATUSES.includes(row.readinessStatus)) errors.push(`traceRows[${index}].readinessStatus must be one of ${NEW_CORE_READINESS_STATUSES.join(', ')}`);
    if (row.readinessStatus !== 'production-ready' && !row.reason) errors.push(`traceRows[${index}].reason is required when readinessStatus is not production-ready`);
    if (row.itemId) {
      const key = String(row.itemId);
      if (seen.has(key) && !row.decompositionOf && !row.parentItemId) duplicated.add(key);
      seen.add(key);
    }
  }
  for (const itemId of duplicated) errors.push(`duplicate trace row for graph item ${itemId}`);

  const expectedItemIds = Array.isArray(options.expectedItemIds) ? options.expectedItemIds.map(String) : [];
  for (const itemId of expectedItemIds) {
    if (!seen.has(itemId)) errors.push(`missing trace row for graph item ${itemId}`);
  }

  if (Number.isInteger(Number(audit?.itemCount)) && rows.length !== Number(audit.itemCount)) errors.push('itemCount must equal traceRows.length');
  assertReadinessCount(audit, rows, 'productionReadyCount', 'production-ready', errors);
  assertReadinessCount(audit, rows, 'testByteOnlyCount', 'test-byte-only', errors);
  assertReadinessCount(audit, rows, 'deferredCount', 'deferred', errors);
  assertReadinessCount(audit, rows, 'blockedCount', 'blocked', errors);
  assertReadinessCount(audit, rows, 'unresolvedCount', 'unresolved', errors);
  assertReadinessCount(audit, rows, 'supportIntentOnlyCount', 'support-intent-only', errors);

  if (Array.isArray(audit?.errors) && Number.isInteger(Number(audit?.hardErrorCount)) && audit.errors.length !== Number(audit.hardErrorCount)) errors.push('hardErrorCount must equal errors.length');
  if (Array.isArray(audit?.warnings) && Number.isInteger(Number(audit?.warningCount)) && audit.warnings.length !== Number(audit.warningCount)) errors.push('warningCount must equal warnings.length');
  if (audit?.ok === true && Number(audit?.hardErrorCount) !== 0) errors.push('ok cannot be true when hardErrorCount is non-zero');

  return {
    schema: 'NewCoreReadinessAuditValidation.v1',
    ok: errors.length === 0,
    errorCount: errors.length,
    errors
  };
}

export function assertNewCoreReadinessAudit(audit, options = {}) {
  const result = validateNewCoreReadinessAudit(audit, options);
  if (!result.ok) throw new Error(`NewCoreReadinessAudit contract invalid: ${result.errors.join('; ')}`);
  return result;
}

function assertReadinessCount(audit, rows, field, status, errors) {
  if (!Number.isInteger(Number(audit?.[field]))) return;
  const actual = rows.filter((row) => row?.readinessStatus === status).length;
  if (Number(audit[field]) !== actual) errors.push(`${field} must equal traceRows ${status} count`);
}
