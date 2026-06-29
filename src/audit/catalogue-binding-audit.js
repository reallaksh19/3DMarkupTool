const CATALOGUE_BINDING_AUDIT_SCHEMA = 'CatalogueBindingAudit.v1';
const COUNT_KEYS = [
  'itemCount',
  'catalogueResolvedCount',
  'proceduralResolvedCount',
  'fallbackBlockedCount',
  'unresolvedCount',
  'supportIntentCount',
  'nearestMatchCount',
  'exportDecisionCount'
];

export function assertCatalogueBindingAudit(audit, expectations = {}) {
  const errors = [];
  if (!audit || typeof audit !== 'object') errors.push('audit must be an object');
  if (audit?.schema !== CATALOGUE_BINDING_AUDIT_SCHEMA) errors.push(`schema must be ${CATALOGUE_BINDING_AUDIT_SCHEMA}`);
  if (!Array.isArray(audit?.bindings)) errors.push('bindings must be an array');
  for (const key of COUNT_KEYS) {
    if (!Number.isInteger(Number(audit?.[key]))) errors.push(`${key} must be integer-like`);
  }
  if (Array.isArray(audit?.bindings) && Number(audit.itemCount) !== audit.bindings.length) {
    errors.push('itemCount must equal bindings.length');
  }
  for (const [key, expected] of Object.entries(expectations)) {
    if (JSON.stringify(audit?.[key]) !== JSON.stringify(expected)) errors.push(`${key} expectation failed`);
  }
  if (errors.length) throw new Error(`Catalogue binding audit invalid: ${errors.join('; ')}`);
  return { schema: 'CatalogueBindingAuditAssertion.v1', ok: true, errorCount: 0, errors: [] };
}
