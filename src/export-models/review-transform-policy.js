export const PHASE7_RVM_TRANSFORM_POLICY = 'phase7-authoring-to-navis-review.identity-placeholder.v1';

export function transformAuthoringPointToReview(point) {
  return point3(point);
}

export function transformAuthoringAxisToReview(axis) {
  return unit(point3(axis));
}

export function phase7TransformMetadata() {
  return {
    sourceAxisBasis: { authoring: 'canvas-current' },
    exportAxisBasis: { review: 'navis-review' },
    transformPolicy: PHASE7_RVM_TRANSFORM_POLICY,
    transformApplied: false,
    warning: 'RVM transform policy not implemented in Phase 7'
  };
}

function point3(value) {
  return Array.isArray(value) && value.length === 3 ? value.map(Number) : [0, 0, 0];
}

function unit(value) {
  const length = Math.hypot(Number(value[0]), Number(value[1]), Number(value[2]));
  return length > 0 ? value.map((entry) => entry / length) : [0, 0, 0];
}
