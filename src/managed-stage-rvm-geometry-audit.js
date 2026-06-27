const PIPE_FITTING_CODES = Object.freeze([4, 7, 8, 9]);
const SUPPORT_CODES = Object.freeze([8]);

export function auditManagedStageRvmGeometry(manifest = {}, payloadSemanticsAudit = {}) {
  const elements = Array.isArray(manifest.elements) ? manifest.elements : [];
  const supportPrimitives = Array.isArray(manifest.supportOverlayPrimitives) ? manifest.supportOverlayPrimitives : [];
  const geometryPrimitives = elements.flatMap((element) => (element.primitives || []).map((primitive) => ({ ...primitive, element })));
  const issues = [];
  const code4 = geometryPrimitives.filter((entry) => Number(entry.emittedCode) === 4);
  const code7 = geometryPrimitives.filter((entry) => Number(entry.emittedCode) === 7);
  const code9 = geometryPrimitives.filter((entry) => Number(entry.emittedCode) === 9);
  const supportCodeHistogram = histogram(supportPrimitives.map((primitive) => primitive.emittedCode));
  const supportNonCode8 = supportPrimitives.filter((primitive) => !SUPPORT_CODES.includes(Number(primitive.emittedCode)));
  const supportPipeFittingCodes = supportPrimitives.filter((primitive) => [4, 7, 9].includes(Number(primitive.emittedCode)));
  const geometryUnexpectedCodes = geometryPrimitives.filter((primitive) => !PIPE_FITTING_CODES.includes(Number(primitive.emittedCode)));
  if (supportNonCode8.length) issues.push(`support overlay has non-code8 primitive count ${supportNonCode8.length}`);
  if (supportPipeFittingCodes.length) issues.push(`support overlay has pipe/fitting primitive code count ${supportPipeFittingCodes.length}`);
  if (geometryUnexpectedCodes.length) issues.push(`geometry has unexpected primitive code count ${geometryUnexpectedCodes.length}`);
  return { schema: 'ManagedStageRvmGeometryAudit.v1', ok: issues.length === 0, issueCount: issues.length, issues, geometry: { elementCount: elements.length, primitiveCount: geometryPrimitives.length, primitiveCodeHistogram: histogram(geometryPrimitives.map((primitive) => primitive.emittedCode)), primitiveRoleTagCounts: groupCount(geometryPrimitives.map(roleTag)), code4Elbows: summarizeElbows(code4, payloadSemanticsAudit.code4), code7Snouts: summarizeSnouts(code7, payloadSemanticsAudit.code7), code9Spheres: summarizeSpheres(code9, payloadSemanticsAudit.code9), code8Cylinders: summarizeCylinders(geometryPrimitives.filter((primitive) => Number(primitive.emittedCode) === 8)) }, supportOverlay: { primitiveCount: supportPrimitives.length, primitiveCodeHistogram: supportCodeHistogram, primitiveRoleTagCounts: groupCount(supportPrimitives.map(roleTag)), allowedPrimitiveCodes: [...SUPPORT_CODES], isolatedFromPipeFittingCodes: supportPipeFittingCodes.length === 0, nonCode8PrimitiveCount: supportNonCode8.length } };
}

function summarizeElbows(entries, semantics = {}) { const sweeps = numericValues((semantics.samples || []).map((sample) => sample.sweepAngleRad)); const radii = numericValues((semantics.samples || []).map((sample) => sample.bendRadius)); return { count: entries.length, payloadIssueCount: semantics.issueCount || 0, sweepAngleRad: numericSummary(sweeps), bendRadiusMm: numericSummary(radii), roleTagCounts: groupCount(entries.map(roleTag)), samples: entries.slice(0, 12).map(sampleEntry) }; }
function summarizeSnouts(entries, semantics = {}) { const roleTags = entries.map(roleTag); const flangeHubCount = roleTags.filter((tag) => tag === 'flangeHubSnout').length; const reducerCount = roleTags.filter((tag) => tag === 'reducerSnout').length; return { count: entries.length, payloadIssueCount: semantics.issueCount || 0, roleTagCounts: groupCount(roleTags), flangeHubCount, reducerCount, placement: placementSummary(entries), samples: entries.slice(0, 12).map(sampleEntry) }; }
function summarizeSpheres(entries, semantics = {}) { const roleTags = entries.map(roleTag); const valveBodyCount = roleTags.filter((tag) => tag === 'valveBodySphere').length; return { count: entries.length, payloadIssueCount: semantics.issueCount || 0, valveBodyCount, roleTagCounts: groupCount(roleTags), placement: placementSummary(entries), samples: entries.slice(0, 12).map(sampleEntry) }; }
function summarizeCylinders(entries) { return { count: entries.length, roleTagCounts: groupCount(entries.map(roleTag)), genericInputXmlFallbackCount: entries.filter((entry) => /^source-route-bend|^node-local-elbow|generic-branch/i.test(entry.localName || '')).length }; }
function sampleEntry(entry) { return { element: entry.element.reviewName || entry.element.inputName || '', localName: entry.localName, primitiveRole: entry.primitiveRole || '', primitiveRoleTag: roleTag(entry), dtxr: entry.element.dtxr || '', bodyLength: entry.bodyLength, dimensions: entry.dimensions, placement: entry.placement || null }; }
function placementSummary(entries) { return { endpointLockedCount: entries.filter((entry) => entry.placement?.endpointLocked === true).length, startOffsetMm: numericSummary(entries.map((entry) => entry.placement?.startOffsetMm)), endOffsetMm: numericSummary(entries.map((entry) => entry.placement?.endOffsetMm)), recipeSegmentStartDistanceMm: numericSummary(entries.map((entry) => entry.placement?.recipeSegmentStartDistanceMm)), recipeSegmentEndDistanceMm: numericSummary(entries.map((entry) => entry.placement?.recipeSegmentEndDistanceMm)), sphereSegmentSpanMm: numericSummary(entries.map((entry) => entry.placement?.sphereSegmentSpanMm)) }; }
function roleTag(entry) { return String(entry?.primitiveRoleTag || entry?.primitiveRole || entry?.localName || 'UNNAMED'); }
function histogram(values) { return values.reduce((out, value) => { const key = String(Number(value)); out[key] = (out[key] || 0) + 1; return out; }, {}); }
function groupCount(values) { return values.reduce((out, value) => { const key = String(value || 'UNNAMED'); out[key] = (out[key] || 0) + 1; return out; }, {}); }
function numericValues(values) { return values.map(Number).filter((value) => Number.isFinite(value)); }
function numericSummary(values) { const numeric = numericValues(values); if (!numeric.length) return { count: 0, min: null, max: null }; return { count: numeric.length, min: round(Math.min(...numeric)), max: round(Math.max(...numeric)) }; }
function round(value) { return Number(Number(value || 0).toFixed(6)); }
