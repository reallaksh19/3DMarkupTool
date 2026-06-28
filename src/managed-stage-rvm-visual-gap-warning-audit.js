export function auditManagedStageRvmVisualGapWarnings(exportModel = {}, primitivePayloads = []) {
  const warnings = [];
  const samples = [];
  visit(exportModel.root, (node) => {
    const primitives = Array.isArray(node.primitives) ? node.primitives : [];
    for (const primitive of primitives) {
      const roleTag = String(primitive.primitiveRoleTag || primitive.primitiveRole || primitive.localName || '');
      if (primitive.kind === 'sphere' && roleTag === 'valveBodySphere') {
        const diameter = Number(primitive.diameter || 0);
        const span = Number(primitive.sphereSegmentSpanMm || primitive.length || 0);
        const ratio = span > 0 ? diameter / span : null;
        if (diameter > 0) {
          warnings.push({
            code: 'RVM_CODE9_SPHERE_VISUAL_CONVENTION',
            severity: 'warning',
            blocking: false,
            element: node.reviewName || node.name || '',
            primitive: primitive.name || primitive.localName || '',
            message: 'Code-9 sphere payload is known to be viewer-sensitive; external Review viewers may display valve body spheres larger than the canvas preview.',
            diameterMm: round(diameter),
            sphereSegmentSpanMm: span ? round(span) : null,
            diameterToSegmentRatio: ratio === null ? null : round(ratio)
          });
        }
      }
      if (primitive.kind === 'snout') {
        const height = Number(primitive.height || 0);
        const start = primitive.startMm;
        const end = primitive.endMm;
        const endpointDistance = distance(start, end);
        if (height > 0 && endpointDistance > 0 && Math.abs(height - endpointDistance) > 1e-3) {
          warnings.push({
            code: 'RVM_CODE7_SNOUT_ENDPOINT_HEIGHT_MISMATCH',
            severity: 'warning',
            blocking: false,
            element: node.reviewName || node.name || '',
            primitive: primitive.name || primitive.localName || '',
            message: 'Code-7 snout height differs from start/end distance; external viewer may show a placement gap.',
            heightMm: round(height),
            endpointDistanceMm: round(endpointDistance),
            deltaMm: round(height - endpointDistance)
          });
        }
      }
    }
    const ordered = primitives.filter((primitive) => Array.isArray(primitive.startMm) && Array.isArray(primitive.endMm)).sort((a, b) => Number(a.recipeSegmentIndex ?? 0) - Number(b.recipeSegmentIndex ?? 0));
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      const gap = distance(previous.endMm, current.startMm);
      if (gap > 1e-3) {
        warnings.push({
          code: 'RVM_PRIMITIVE_ENDPOINT_GAP',
          severity: 'warning',
          blocking: false,
          element: node.reviewName || node.name || '',
          previousPrimitive: previous.name || previous.localName || '',
          nextPrimitive: current.name || current.localName || '',
          message: 'Adjacent recipe primitives do not share endpoints; external RVM viewers may show a visible gap.',
          gapMm: round(gap)
        });
      }
    }
  });

  samples.push(...warnings.slice(0, 20));
  return {
    schema: 'ManagedStageRvmVisualGapWarningAudit.v1',
    blocking: false,
    failClosed: false,
    warningOnly: true,
    warningCount: warnings.length,
    warningCodeHistogram: histogram(warnings.map((warning) => warning.code)),
    primitivePayloadCount: Array.isArray(primitivePayloads) ? primitivePayloads.length : 0,
    samples,
    warnings
  };
}

function visit(node, callback) {
  if (!node) return;
  callback(node);
  for (const child of node.children || []) visit(child, callback);
}

function distance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== 3 || b.length !== 3) return 0;
  return Math.hypot(Number(a[0]) - Number(b[0]), Number(a[1]) - Number(b[1]), Number(a[2]) - Number(b[2]));
}

function histogram(values) {
  return values.reduce((out, value) => {
    const key = String(value || 'UNKNOWN');
    out[key] = (out[key] || 0) + 1;
    return out;
  }, {});
}

function round(value) {
  return Number(Number(value || 0).toFixed(6));
}
