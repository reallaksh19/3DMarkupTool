export function auditManagedStageRvmSegments(root = {}) {
  const elements = elementNodes(root);
  const samples = elements.map(summarizeElement);
  const issues = samples.flatMap((entry) => entry.issues.map((issue) => ({ element: entry.element, issue })));
  return {
    schema: 'ManagedStageRvmSegmentAudit.v1',
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    elementCount: samples.length,
    primitiveCount: samples.reduce((sum, entry) => sum + entry.primitiveCount, 0),
    cleanElementCount: samples.filter((entry) => entry.ok).length,
    endpointLockedPrimitiveCount: samples.reduce((sum, entry) => sum + entry.endpointLockedPrimitiveCount, 0),
    maxEndpointGapMm: maxValue(samples.map((entry) => entry.maxEndpointGapMm)),
    recipeCoverage: {
      fullSpanCount: samples.filter((entry) => entry.recipeCoverageFullSpan).length,
      partialOrUnknownCount: samples.filter((entry) => !entry.recipeCoverageFullSpan).length
    },
    samples: samples.slice(0, 20)
  };
}

function summarizeElement(node = {}) {
  const primitives = Array.isArray(node.primitives) ? node.primitives : [];
  const ordered = [...primitives].sort((a, b) => Number(a.recipeSegmentIndex ?? 0) - Number(b.recipeSegmentIndex ?? 0));
  const gaps = [];
  const issues = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (Array.isArray(previous.endMm) && Array.isArray(current.startMm)) gaps.push(distance(previous.endMm, current.startMm));
  }
  const maxGap = maxValue(gaps);
  if (maxGap > 1e-6) issues.push(`primitive endpoint gap ${round(maxGap)} mm`);
  const endpointLockedPrimitiveCount = primitives.filter((primitive) => primitive.endpointLocked === true).length;
  if (primitives.length && endpointLockedPrimitiveCount !== primitives.length) issues.push(`endpoint locked primitive count ${endpointLockedPrimitiveCount}/${primitives.length}`);
  const recipeSpan = recipeSpanSummary(ordered);
  if (recipeSpan.available && !recipeSpan.fullSpan) issues.push(`recipe span ${recipeSpan.coveredLengthMm}/${recipeSpan.expectedLengthMm} mm`);
  return {
    element: node.reviewName || node.name || '',
    dtxr: node.attributes?.DTXR || '',
    primitiveCount: primitives.length,
    endpointLockedPrimitiveCount,
    ok: issues.length === 0,
    maxEndpointGapMm: round(maxGap),
    recipeCoverageFullSpan: recipeSpan.available ? recipeSpan.fullSpan : primitives.length <= 1,
    recipeCoverage: recipeSpan,
    primitiveRoles: ordered.map((primitive) => primitive.primitiveRole || primitive.localName || primitive.name || primitive.kind || ''),
    issues
  };
}

function recipeSpanSummary(primitives) {
  const spans = primitives.filter((primitive) => Number.isFinite(Number(primitive.recipeSegmentStartDistanceMm)) && Number.isFinite(Number(primitive.recipeSegmentEndDistanceMm)));
  if (!spans.length) return { available: false, fullSpan: primitives.length <= 1, coveredLengthMm: null, expectedLengthMm: null };
  const minStart = Math.min(...spans.map((primitive) => Number(primitive.recipeSegmentStartDistanceMm)));
  const maxEnd = Math.max(...spans.map((primitive) => Number(primitive.recipeSegmentEndDistanceMm)));
  const covered = spans.reduce((sum, primitive) => sum + Math.max(0, Number(primitive.recipeSegmentEndDistanceMm) - Number(primitive.recipeSegmentStartDistanceMm)), 0);
  const expected = maxEnd - minStart;
  return { available: true, fullSpan: Math.abs(covered - expected) <= 1e-6, coveredLengthMm: round(covered), expectedLengthMm: round(expected), minStartMm: round(minStart), maxEndMm: round(maxEnd) };
}

function elementNodes(root) { return root?.children?.[0]?.children?.[0]?.children || []; }
function distance(a, b) { return !Array.isArray(a) || !Array.isArray(b) || a.length !== 3 || b.length !== 3 ? 0 : Math.hypot(Number(a[0]) - Number(b[0]), Number(a[1]) - Number(b[1]), Number(a[2]) - Number(b[2])); }
function maxValue(values) { const numeric = values.map(Number).filter((value) => Number.isFinite(value)); return numeric.length ? Math.max(...numeric) : 0; }
function round(value) { return Number(Number(value || 0).toFixed(6)); }
