export const RENDER_BOUNDARY_SCHEMA = 'render-boundary-manifest/v1';

export const CONTRACT_RENDER_BOUNDARY = Object.freeze({
  schemaVersion: RENDER_BOUNDARY_SCHEMA,
  policy: 'source adapters and component contracts own classification; renderers must consume geometry contracts',
  contractEntryPoints: Object.freeze([
    'src/piping-component-contract.js',
    'src/piping-component-catalog.js',
    'src/piping-component-layer.js'
  ]),
  legacyFallbackRenderers: Object.freeze([
    Object.freeze({
      path: 'src/converter.js',
      owner: 'legacy InputXML/UXML GLB preview renderer',
      reason: 'Allowed only as fallback until GeometryContract-driven viewer/GLB/RVM render adapters replace direct source-to-mesh rendering.',
      replacement: 'Source Adapter → PipingComponent.v1 → PipingGraph.v1 → GeometryContract.v1 → RenderInstruction.v1',
      fallbackOnly: true
    })
  ])
});

export function legacyFallbackRendererPaths(manifest = CONTRACT_RENDER_BOUNDARY) {
  return new Set((manifest.legacyFallbackRenderers || []).map((entry) => entry.path));
}

export function assertRenderBoundaryManifest(manifest = CONTRACT_RENDER_BOUNDARY) {
  const errors = [];
  if (manifest.schemaVersion !== RENDER_BOUNDARY_SCHEMA) {
    errors.push(`schemaVersion must be ${RENDER_BOUNDARY_SCHEMA}`);
  }
  if (!Array.isArray(manifest.contractEntryPoints) || manifest.contractEntryPoints.length === 0) {
    errors.push('contractEntryPoints must name at least one contract module');
  }
  if (!Array.isArray(manifest.legacyFallbackRenderers)) {
    errors.push('legacyFallbackRenderers must be an array');
  }

  const seen = new Set();
  for (const [index, entry] of (manifest.legacyFallbackRenderers || []).entries()) {
    const prefix = `legacyFallbackRenderers[${index}]`;
    if (!entry || typeof entry !== 'object') {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    if (!entry.path || typeof entry.path !== 'string') errors.push(`${prefix}.path must be a non-empty string`);
    if (entry.path && seen.has(entry.path)) errors.push(`${prefix}.path duplicate ${entry.path}`);
    if (entry.path) seen.add(entry.path);
    if (entry.fallbackOnly !== true) errors.push(`${prefix}.fallbackOnly must be true`);
    if (!/fallback/i.test(entry.reason || '')) errors.push(`${prefix}.reason must explicitly mention fallback`);
    if (!/GeometryContract|PipingComponent|RenderInstruction/.test(entry.replacement || '')) {
      errors.push(`${prefix}.replacement must point to the contract-driven renderer path`);
    }
  }

  if (errors.length) {
    throw new Error(`Render boundary manifest failed: ${errors.join('; ')}`);
  }
  return true;
}
