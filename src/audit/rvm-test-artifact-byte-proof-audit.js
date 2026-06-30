const RVM_BYTE_PROOF_AUDIT_SCHEMA = 'RvmTestArtifactByteProofAudit.v1';
const COUNT_KEYS = [
  'artifactByteLength',
  'sourceTraceCount',
  'tracedStraightPipeCount',
  'tracedBlockedFlangeCount',
  'tracedBlockedValveCount',
  'tracedBlockedBendCount',
  'tracedDeferredSupportCount',
  'primitiveWriteCount',
  'cylinderWriteCount',
  'torusWriteCount',
  'boxWriteCount',
  'sphereWriteCount',
  'pyramidWriteCount',
  'supportWriteCount',
  'blockedFlangeCount',
  'blockedValveCount',
  'blockedBendCount',
  'deferredSupportWriterCount',
  'writerCallCount',
  'rvmWriterCallCount',
  'attWriterCallCount',
  'glbWriterCallCount',
  'objectUrlCount',
  'downloadSideEffectCount',
  'productionPathMutationCount',
  'cacheKeyMutationCount',
  'hardErrorCount',
  'warningCount'
];
const BOOLEAN_KEYS = [
  'rvmStraightPipeSubsetArtifactReady',
  'rvmFullModelArtifactReady',
  'artifactGenerated',
  'artifactBlocked',
  'artifactChecksumPresent',
  'byteHeaderPresent',
  'binaryPayloadGenerated',
  'attTextPayloadGenerated',
  'glbPayloadGenerated',
  'runtimeTouched',
  'browserTouched',
  'canvasTouched',
  'ok'
];

export function assertRvmTestArtifactByteProofAudit(audit, expectations = {}) {
  const errors = [];
  if (!audit || typeof audit !== 'object') errors.push('audit must be an object');
  if (audit?.schema !== RVM_BYTE_PROOF_AUDIT_SCHEMA) errors.push(`schema must be ${RVM_BYTE_PROOF_AUDIT_SCHEMA}`);
  if (!audit?.graphId) errors.push('graphId is required');
  if (audit?.mode !== 'testOnly') errors.push('mode must be testOnly');
  for (const key of COUNT_KEYS) {
    if (!Number.isInteger(Number(audit?.[key]))) errors.push(`${key} must be integer-like`);
  }
  for (const key of BOOLEAN_KEYS) {
    if (typeof audit?.[key] !== 'boolean') errors.push(`${key} must be boolean`);
  }
  if (!Array.isArray(audit?.errors)) errors.push('errors array is required');
  if (!Array.isArray(audit?.warnings)) errors.push('warnings array is required');
  for (const [key, expected] of Object.entries(expectations)) {
    if (JSON.stringify(audit?.[key]) !== JSON.stringify(expected)) errors.push(`${key} expectation failed`);
  }
  if (errors.length) throw new Error(`RVM test artifact byte proof audit invalid: ${errors.join('; ')}`);
  return { schema: 'RvmTestArtifactByteProofAuditAssertion.v1', ok: true, errorCount: 0, errors: [] };
}
