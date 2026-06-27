const CODE4_EXPECTED_WORDS = 3;
const CODE7_EXPECTED_WORDS = 9;
const CODE9_EXPECTED_WORDS = 1;

export function auditManagedStageRvmPayloadSemantics(primitives = []) {
  const tracked = primitives.filter((primitive) => [4, 7, 9].includes(Number(primitive.code)));
  const summaries = tracked.map((primitive, index) => summarizePrimitive(primitive, index));
  const issues = summaries.flatMap((summary) => summary.issues.map((issue) => ({ code: summary.code, index: summary.index, issue })));
  return {
    schema: 'ManagedStageRvmPayloadSemanticsAudit.v1',
    primitiveCount: primitives.length,
    trackedPrimitiveCount: tracked.length,
    code4: summarizeCode(summaries, 4),
    code7: summarizeCode(summaries, 7),
    code9: summarizeCode(summaries, 9),
    issueCount: issues.length,
    issues,
    ok: issues.length === 0
  };
}

function summarizePrimitive(primitive, index) {
  const code = Number(primitive.code);
  const semantics = primitive.payloadSemantics || {};
  const payloadWordCount = Number(primitive.payloadWordCount || 0);
  const bodyLength = Number(primitive.bodyLength || 0);
  const bboxConsistentWithPayload = primitive.bboxConsistentWithPayload;
  const issues = [];

  if (code === 4) {
    const bendRadius = Number(semantics.bendRadius);
    const tubeRadius = Number(semantics.tubeRadius);
    const sweepAngleRad = Number(semantics.sweepAngleRad);
    if (bodyLength !== 92) issues.push(`body length ${bodyLength} is not 92`);
    if (payloadWordCount !== CODE4_EXPECTED_WORDS) issues.push(`payload words ${payloadWordCount} is not ${CODE4_EXPECTED_WORDS}`);
    if (!finitePositive(bendRadius)) issues.push('bend radius is not positive');
    if (!finitePositive(tubeRadius)) issues.push('tube radius is not positive');
    if (!Number.isFinite(sweepAngleRad) || sweepAngleRad <= 0 || sweepAngleRad > Math.PI * 2 + 1e-6) issues.push('sweep angle is outside valid range');
    return {
      index,
      code,
      kind: primitive.emittedKind || 'elbow',
      bodyLength,
      payloadWordCount,
      bendRadius,
      tubeRadius,
      sweepAngleRad,
      semanticConfidence: primitive.semanticConfidence || '',
      bboxConsistentWithPayload,
      issues
    };
  }

  if (code === 7) {
    const radiusBottom = Number(semantics.radiusBottom);
    const radiusTop = Number(semantics.radiusTop);
    const height = Number(semantics.height);
    const offsetX = Number(semantics.offsetX || 0);
    const offsetY = Number(semantics.offsetY || 0);
    const shearValues = ['botShearX', 'botShearY', 'topShearX', 'topShearY'].map((key) => Number(semantics[key] || 0));
    if (bodyLength !== 116) issues.push(`body length ${bodyLength} is not 116`);
    if (payloadWordCount !== CODE7_EXPECTED_WORDS) issues.push(`payload words ${payloadWordCount} is not ${CODE7_EXPECTED_WORDS}`);
    if (!finitePositive(radiusBottom)) issues.push('bottom radius is not positive');
    if (!finitePositive(radiusTop)) issues.push('top radius is not positive');
    if (!finitePositive(height)) issues.push('height is not positive');
    if (!shearValues.every((value) => approxZero(value))) issues.push('shear values are non-zero');
    return {
      index,
      code,
      kind: primitive.emittedKind || 'snout',
      bodyLength,
      payloadWordCount,
      radiusBottom,
      radiusTop,
      height,
      offsetX,
      offsetY,
      semanticConfidence: primitive.semanticConfidence || '',
      bboxConsistentWithPayload,
      issues
    };
  }

  if (code === 9) {
    const diameter = Number(semantics.diameter);
    if (bodyLength !== 84) issues.push(`body length ${bodyLength} is not 84`);
    if (payloadWordCount !== CODE9_EXPECTED_WORDS) issues.push(`payload words ${payloadWordCount} is not ${CODE9_EXPECTED_WORDS}`);
    if (!finitePositive(diameter)) issues.push('diameter is not positive');
    return {
      index,
      code,
      kind: primitive.emittedKind || 'sphere',
      bodyLength,
      payloadWordCount,
      diameter,
      semanticConfidence: primitive.semanticConfidence || '',
      bboxConsistentWithPayload,
      issues
    };
  }

  return { index, code, issues };
}

function summarizeCode(summaries, code) {
  const entries = summaries.filter((summary) => summary.code === code);
  const issueCount = entries.reduce((sum, entry) => sum + entry.issues.length, 0);
  return {
    count: entries.length,
    issueCount,
    ok: issueCount === 0,
    samples: entries.slice(0, 12)
  };
}

function finitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

function approxZero(value) {
  return Math.abs(Number(value) || 0) <= 1e-6;
}
