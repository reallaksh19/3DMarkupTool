const EXPORT_MODEL_COMPILATION_AUDIT_SCHEMA = 'ExportModelCompilationAudit.v1';
const COUNT_KEYS = [
  'rvmTransformWarningCount',
  'rvmPrimitivePlanCount',
  'rvmCylinderPlanCount',
  'rvmTorusPlanCount',
  'rvmBoxPlanCount',
  'rvmSpherePlanCount',
  'rvmPyramidPlanCount',
  'attRecordPlanCount',
  'glbVisualPlanCount',
  'blockedExportCount',
  'deferredExportCount',
  'blockedAttRecordCount',
  'deferredAttRecordCount',
  'blockedVisualCount',
  'deferredVisualCount',
  'blockedUnresolvedExportCount',
  'deferredSupportExportCount',
  'writerCallCount',
  'binaryPayloadCount',
  'textPayloadCount',
  'glbPayloadCount',
  'hardErrorCount'
];

export function assertExportModelCompilationAudit(audit, expectations = {}) {
  const errors = [];
  if (!audit || typeof audit !== 'object') errors.push('audit must be an object');
  if (audit?.schema !== EXPORT_MODEL_COMPILATION_AUDIT_SCHEMA) errors.push(`schema must be ${EXPORT_MODEL_COMPILATION_AUDIT_SCHEMA}`);
  if (!audit?.graphId) errors.push('graphId is required');
  if (!audit?.transformPolicy) errors.push('transformPolicy is required');
  for (const key of COUNT_KEYS) {
    if (!Number.isInteger(Number(audit?.[key]))) errors.push(`${key} must be integer-like`);
  }
  if (typeof audit?.navisTransformApplied !== 'boolean') errors.push('navisTransformApplied must be boolean');
  if (typeof audit?.ok !== 'boolean') errors.push('ok must be boolean');
  if (!Array.isArray(audit?.errors)) errors.push('errors array is required');
  if (!Array.isArray(audit?.warnings)) errors.push('warnings array is required');
  for (const [key, expected] of Object.entries(expectations)) {
    if (JSON.stringify(audit?.[key]) !== JSON.stringify(expected)) errors.push(`${key} expectation failed`);
  }
  if (errors.length) throw new Error(`Export model compilation audit invalid: ${errors.join('; ')}`);
  return { schema: 'ExportModelCompilationAuditAssertion.v1', ok: true, errorCount: 0, errors: [] };
}
