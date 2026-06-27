export function auditManagedStageRvmElbows(torusAssumptions = [], payloadSemanticsAudit = {}) {
  const entries = Array.isArray(torusAssumptions) ? torusAssumptions : [];
  const payloadSamples = payloadSemanticsAudit?.code4?.samples || [];
  const samples = entries.map((entry, index) => summarizeElbow(entry, payloadSamples[index] || {}));
  return {
    schema: 'ManagedStageRvmElbowAudit.v1',
    count: entries.length,
    payloadCount: Number(payloadSemanticsAudit?.code4?.count || 0),
    payloadIssueCount: Number(payloadSemanticsAudit?.code4?.issueCount || 0),
    endpointFitErrorMm: numericSummary(samples.map((sample) => sample.endpointFitErrorMm)),
    sweepAngleRad: numericSummary(samples.map((sample) => sample.sweepAngleRad)),
    emittedBendRadiusMm: numericSummary(samples.map((sample) => sample.bendRadiusMm)),
    declaredBendRadiusMm: numericSummary(samples.map((sample) => sample.declaredBendRadiusMm)),
    declaredVsEmittedRadiusDeltaMm: numericSummary(samples.map((sample) => sample.declaredVsEmittedRadiusDeltaMm)),
    radiusInflatedCount: samples.filter((sample) => sample.radiusInflated).length,
    tangentHintStateCounts: groupCount(samples.map((sample) => sample.tangentHintState || 'UNKNOWN')),
    solverStateCounts: groupCount(samples.map((sample) => sample.solverState || 'UNKNOWN')),
    samples
  };
}

function summarizeElbow(entry, payload) {
  const bendRadiusMm = finiteOrNull(entry.bendRadiusMm);
  const declaredBendRadiusMm = finiteOrNull(entry.declaredBendRadiusMm);
  return {
    element: entry.element || '',
    primitive: entry.primitive || '',
    primitiveCode: 4,
    bodyLength: payload.bodyLength || null,
    bendRadiusMm,
    payloadBendRadiusMm: finiteOrNull(payload.bendRadius),
    tubeRadiusMm: finiteOrNull(entry.tubeRadiusMm ?? payload.tubeRadius),
    sweepAngleRad: finiteOrNull(entry.sweepAngleRad ?? payload.sweepAngleRad),
    declaredBendRadiusMm,
    declaredSweepAngleRad: finiteOrNull(entry.declaredSweepAngleRad),
    declaredVsEmittedRadiusDeltaMm: declaredBendRadiusMm !== null && bendRadiusMm !== null ? round(bendRadiusMm - declaredBendRadiusMm) : null,
    radiusInflated: Boolean(entry.radiusInflatedMm && Number(entry.radiusInflatedMm) > 0),
    radiusInflatedMm: finiteOrNull(entry.radiusInflatedMm),
    minRadiusForChordMm: finiteOrNull(entry.minRadiusForChordMm),
    chordLengthMm: finiteOrNull(entry.chordLengthMm),
    endpointFitErrorMm: finiteOrNull(entry.endpointFitErrorMm),
    tangentHintState: entry.tangentHintState || '',
    solverState: entry.solverState || '',
    orientationAssumption: entry.orientationAssumption || ''
  };
}

function numericSummary(values) {
  const numeric = values.map(Number).filter((value) => Number.isFinite(value));
  if (!numeric.length) return { count: 0, min: null, max: null };
  return { count: numeric.length, min: round(Math.min(...numeric)), max: round(Math.max(...numeric)) };
}

function groupCount(values) {
  return values.reduce((out, value) => {
    const key = String(value || 'UNSPECIFIED');
    out[key] = (out[key] || 0) + 1;
    return out;
  }, {});
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? round(number) : null;
}

function round(value) {
  return Number(Number(value || 0).toFixed(6));
}
