export const FALLBACK_POLICY_SCHEMA = 'FallbackPolicyRecord.v1';

export const FALLBACK_KINDS = Object.freeze({
  VISUAL_ONLY: 'visualOnly',
  EXPORT_ALLOWED: 'exportAllowed',
  BLOCKED: 'blocked'
});

export const ALLOWED_FALLBACK_KINDS = Object.freeze(Object.values(FALLBACK_KINDS));

export function createBlockedUnknownEngineeringItemFallback(reason = 'Unknown engineering item requires explicit review') {
  return {
    schema: FALLBACK_POLICY_SCHEMA,
    fallbackKind: FALLBACK_KINDS.BLOCKED,
    reason,
    confidence: 0,
    requiresUserApproval: true
  };
}

export function validateFallbackPolicyRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object') errors.push('fallback record must be an object');
  if (record?.schema && record.schema !== FALLBACK_POLICY_SCHEMA) errors.push(`schema must be ${FALLBACK_POLICY_SCHEMA} when present`);
  if (!ALLOWED_FALLBACK_KINDS.includes(record?.fallbackKind)) {
    errors.push(`fallbackKind must be one of: ${ALLOWED_FALLBACK_KINDS.join(', ')}`);
  }
  if (typeof record?.reason !== 'string' || !record.reason.trim()) errors.push('reason is required');
  if (!Number.isFinite(Number(record?.confidence))) {
    errors.push('confidence must be numeric');
  } else if (Number(record.confidence) < 0 || Number(record.confidence) > 1) {
    errors.push('confidence must be between 0 and 1');
  }
  if (typeof record?.requiresUserApproval !== 'boolean') errors.push('requiresUserApproval must be boolean');

  return {
    schema: 'FallbackPolicyValidation.v1',
    ok: errors.length === 0,
    errorCount: errors.length,
    errors
  };
}

export function assertFallbackPolicyRecord(record) {
  const result = validateFallbackPolicyRecord(record);
  if (!result.ok) throw new Error(`Fallback policy invalid: ${result.errors.join('; ')}`);
  return result;
}
