export const APP_CONVERSION_BOUNDARY_SCHEMA = 'AppConversionBoundary.v1';

export const APPROVED_APP_CONVERSION_ENTRYPOINTS = Object.freeze([
  {
    path: 'src/app-conversion-pipeline.js',
    role: 'APP_CONVERSION_PIPELINE_SEAM',
    allowedDirectConverters: ['convertInputXmlToGlbWithShadowDiagnostics', 'convertInputXmlToRvmAtt', 'createRvmPreviewScene'],
    reason: 'Centralized app conversion seam that combines legacy GLB fallback, shadow contract diagnostics, RVM/ATT export, and preview scene creation.'
  }
]);

export function assertAppConversionBoundaryManifest(entries = APPROVED_APP_CONVERSION_ENTRYPOINTS) {
  if (!Array.isArray(entries) || !entries.length) throw new Error('App conversion boundary manifest must contain entries');
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid app conversion boundary entry');
    if (!entry.path || typeof entry.path !== 'string') throw new Error('Boundary entry path is required');
    if (seen.has(entry.path)) throw new Error(`Duplicate app conversion boundary entry: ${entry.path}`);
    seen.add(entry.path);
    if (!entry.role || typeof entry.role !== 'string') throw new Error(`Boundary entry role is required for ${entry.path}`);
    if (!Array.isArray(entry.allowedDirectConverters) || !entry.allowedDirectConverters.length) throw new Error(`Boundary entry converters are required for ${entry.path}`);
    if (!entry.reason || typeof entry.reason !== 'string') throw new Error(`Boundary entry reason is required for ${entry.path}`);
  }
  return true;
}

export function approvedAppConversionPathSet(entries = APPROVED_APP_CONVERSION_ENTRYPOINTS) {
  assertAppConversionBoundaryManifest(entries);
  return new Set(entries.map((entry) => entry.path));
}
