const GEOMETRY_RESOLUTION_AUDIT_SCHEMA = 'GeometryResolutionAudit.v1';
const COUNT_KEYS = [
  'routeFrameCount',
  'itemFrameCount',
  'supportPlacementCount',
  'unresolvedGeometryCount',
  'resolvedStraightPipeCount',
  'catalogueFrameResolvedCount',
  'blockedUnresolvedComponentCount',
  'hardErrorCount',
  'primitiveCodeCount',
  'exportDecisionCount'
];

export function assertGeometryResolutionAudit(audit, expectations = {}) {
  const errors = [];
  if (!audit || typeof audit !== 'object') errors.push('audit must be an object');
  if (audit?.schema !== GEOMETRY_RESOLUTION_AUDIT_SCHEMA) errors.push(`schema must be ${GEOMETRY_RESOLUTION_AUDIT_SCHEMA}`);
  if (!audit?.graphId) errors.push('graphId is required');
  for (const key of COUNT_KEYS) {
    if (!Number.isInteger(Number(audit?.[key]))) errors.push(`${key} must be integer-like`);
  }
  if (typeof audit?.navisTransformApplied !== 'boolean') errors.push('navisTransformApplied must be boolean');
  if (typeof audit?.ok !== 'boolean') errors.push('ok must be boolean');
  if (!Array.isArray(audit?.errors)) errors.push('errors array is required');
  for (const [key, expected] of Object.entries(expectations)) {
    if (JSON.stringify(audit?.[key]) !== JSON.stringify(expected)) errors.push(`${key} expectation failed`);
  }
  if (errors.length) throw new Error(`Geometry resolution audit invalid: ${errors.join('; ')}`);
  return { schema: 'GeometryResolutionAuditAssertion.v1', ok: true, errorCount: 0, errors: [] };
}
