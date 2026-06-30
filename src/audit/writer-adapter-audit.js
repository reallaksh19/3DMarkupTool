const WRITER_ADAPTER_AUDIT_SCHEMA = 'WriterAdapterAudit.v1';
const COUNT_KEYS = ['rvmPlannedChunkCount', 'rvmPlannedPrimChunkCount', 'rvmPlannedCylinderCount', 'rvmPlannedTorusCount', 'testByteEligibleTorusCount', 'testByteEligibleBendTorusCount', 'productionReadyTorusCount', 'rvmPlannedBoxCount', 'rvmPlannedSphereCount', 'rvmPlannedPyramidCount', 'attPlannedRecordCount', 'glbPlannedVisualCount', 'blockedWriterItemCount', 'deferredWriterItemCount', 'blockedUnresolvedWriterCount', 'blockedFlangeWriterCount', 'blockedValveWriterCount', 'blockedBendWriterCount', 'deferredSupportWriterCount', 'deferredBendTorusWriterCount', 'writerCallCount', 'binaryPayloadCount', 'textPayloadCount', 'glbPayloadCount', 'downloadSideEffectCount', 'runtimeMutationCount', 'hardErrorCount', 'warningCount'];

export function assertWriterAdapterAudit(audit, expectations = {}) {
  const errors = [];
  if (!audit || typeof audit !== 'object') errors.push('audit must be an object');
  if (audit?.schema !== WRITER_ADAPTER_AUDIT_SCHEMA) errors.push(`schema must be ${WRITER_ADAPTER_AUDIT_SCHEMA}`);
  if (!audit?.graphId) errors.push('graphId is required');
  if (!['dryRun', 'testOnly'].includes(audit?.mode)) errors.push('mode must be dryRun or testOnly');
  for (const key of COUNT_KEYS) if (!Number.isInteger(Number(audit?.[key]))) errors.push(`${key} must be integer-like`);
  for (const key of ['rvmWriterReady', 'rvmPipeBendSubsetTestByteReady', 'attWriterReady', 'glbWriterReady', 'ok']) if (typeof audit?.[key] !== 'boolean') errors.push(`${key} must be boolean`);
  if (!Array.isArray(audit?.errors)) errors.push('errors array is required');
  if (!Array.isArray(audit?.warnings)) errors.push('warnings array is required');
  for (const [key, expected] of Object.entries(expectations)) if (JSON.stringify(audit?.[key]) !== JSON.stringify(expected)) errors.push(`${key} expectation failed`);
  if (errors.length) throw new Error(`Writer adapter audit invalid: ${errors.join('; ')}`);
  return { schema: 'WriterAdapterAuditAssertion.v1', ok: true, errorCount: 0, errors: [] };
}
