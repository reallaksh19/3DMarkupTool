import { distance, point3 } from './managed-stage-topology-audit.js';

export const MANAGED_STAGE_RVM_MATERIALS = Object.freeze({
  ROOT: 1,
  PIPE: 4,
  FITTING: 5,
  FLANGE: 6,
  VALVE: 7,
  UNKNOWN_PIPELIKE: 8
});

export function planManagedStagePrimitives(record) {
  const a = record.attributes || {};
  const dtxr = a.DTXR || record.type || 'UNKNOWN';
  const pipeRadius = parseMm(a.DIAMETER || a.BORE || a.ABORE || a.LBORE) / 2;
  if (!(pipeRadius > 0)) throw new Error(`Missing/invalid diameter for ${record.name}`);

  if (dtxr === 'PIPE' || dtxr === 'UNSPECIFIED') {
    const material = dtxr === 'UNSPECIFIED' ? MANAGED_STAGE_RVM_MATERIALS.UNKNOWN_PIPELIKE : MANAGED_STAGE_RVM_MATERIALS.PIPE;
    return planInlineCylinder(record, pipeRadius, material, 'body');
  }
  if (dtxr === 'FLANGE') return planInlineCylinder(record, flangeRadius(pipeRadius), MANAGED_STAGE_RVM_MATERIALS.FLANGE, 'flange');
  if (dtxr === 'VALVE') return planInlineCylinder(record, valveRadius(pipeRadius), MANAGED_STAGE_RVM_MATERIALS.VALVE, 'body');
  if (dtxr === 'FLANGE_PAIR') return planFlangePair(record, pipeRadius);
  if (dtxr === 'FLANGED_VALVE') return planFlangedValve(record, pipeRadius);
  if (dtxr === 'BEND') return [planCode4Elbow(record, pipeRadius)];
  throw new Error(`Unsupported managed-stage DTXR: ${dtxr}`);
}

export function managedStageComponentClass(record) {
  const dtxr = record.attributes?.DTXR || record.type || 'UNKNOWN';
  if (dtxr === 'PIPE') return 'PIPE';
  if (dtxr === 'UNSPECIFIED') return 'UNKNOWN_PIPELIKE';
  if (dtxr === 'BEND') return 'BEND';
  if (dtxr === 'FLANGE') return 'FLANGE';
  if (dtxr === 'FLANGE_PAIR') return 'FLANGE_PAIR';
  if (dtxr === 'VALVE') return 'VALVE';
  if (dtxr === 'FLANGED_VALVE') return 'FLANGED_VALVE';
  return 'UNKNOWN';
}

export function managedStageMaterialForClass(componentClass) {
  if (componentClass === 'PIPE') return MANAGED_STAGE_RVM_MATERIALS.PIPE;
  if (componentClass === 'BEND') return MANAGED_STAGE_RVM_MATERIALS.FITTING;
  if (componentClass.includes('FLANGE')) return MANAGED_STAGE_RVM_MATERIALS.FLANGE;
  if (componentClass.includes('VALVE')) return MANAGED_STAGE_RVM_MATERIALS.VALVE;
  if (componentClass === 'UNKNOWN_PIPELIKE') return MANAGED_STAGE_RVM_MATERIALS.UNKNOWN_PIPELIKE;
  return MANAGED_STAGE_RVM_MATERIALS.FITTING;
}

function planInlineCylinder(record, radius, material, localName) {
  const { start, end, axis, lengthMm } = segment(record);
  return [cylinder(record, localName, midpoint(start, end), axis, radius, lengthMm, material)];
}

function planFlangePair(record, pipeRadius) {
  const { start, end, axis, lengthMm } = segment(record);
  const thick = Math.min(lengthMm * 0.45, 90);
  const radius = flangeRadius(pipeRadius);
  return [
    cylinder(record, 'flangeA', pointAlong(start, axis, thick / 2), axis, radius, thick, MANAGED_STAGE_RVM_MATERIALS.FLANGE),
    cylinder(record, 'flangeB', pointAlong(end, axis, -thick / 2), axis, radius, thick, MANAGED_STAGE_RVM_MATERIALS.FLANGE)
  ];
}

function planFlangedValve(record, pipeRadius) {
  const { start, end, axis, lengthMm } = segment(record);
  const flangeLen = Math.min(lengthMm * 0.18, 90);
  const bodyLen = lengthMm - flangeLen * 2;
  if (!(bodyLen > 0)) throw new Error(`Invalid flanged valve body length for ${record.name}`);
  return [
    cylinder(record, 'flangeA', pointAlong(start, axis, flangeLen / 2), axis, flangeRadius(pipeRadius), flangeLen, MANAGED_STAGE_RVM_MATERIALS.FLANGE),
    cylinder(record, 'body', pointAlong(start, axis, flangeLen + bodyLen / 2), axis, valveRadius(pipeRadius), bodyLen, MANAGED_STAGE_RVM_MATERIALS.VALVE),
    cylinder(record, 'flangeB', pointAlong(end, axis, -flangeLen / 2), axis, flangeRadius(pipeRadius), flangeLen, MANAGED_STAGE_RVM_MATERIALS.FLANGE)
  ];
}

function planCode4Elbow(record, pipeRadius) {
  const { start, end, axis } = segment(record);
  const bendRadius = Number(record.attributes?.BEND_RADIUS);
  const sweepAngleRad = (Number(record.attributes?.BEND_ANGLE || 90) * Math.PI) / 180;
  if (!(bendRadius > 0) || !(sweepAngleRad > 0)) throw new Error(`Invalid bend payload for ${record.name}`);
  const outer = bendRadius + pipeRadius;
  return {
    kind: 'elbow',
    name: `${record.name}_BEND`,
    localName: 'bend',
    center: midpoint(start, end),
    direction: axis,
    bendRadius,
    tubeRadius: pipeRadius,
    sweepAngleRad,
    material: MANAGED_STAGE_RVM_MATERIALS.FITTING,
    localBbox: [0, 0, -pipeRadius, outer, outer, pipeRadius],
    orientationAssumption: 'managed-stage midpoint/fallback code-4 torus orientation'
  };
}

function cylinder(record, localName, center, direction, radius, lengthMm, material) {
  if (!(radius > 0) || !(lengthMm > 0)) throw new Error(`Invalid cylinder dimensions for ${record.name}.${localName}`);
  return { kind: 'cylinder', name: `${record.name}_${localName}`, localName, center, direction, radius, length: lengthMm, material };
}

function segment(record) {
  const start = point3(record.attributes?.APOS, `${record.name}.APOS`);
  const end = point3(record.attributes?.LPOS, `${record.name}.LPOS`);
  const lengthMm = distance(start, end);
  if (!(lengthMm > 0)) throw new Error(`Zero-length managed-stage component: ${record.name}`);
  return { start, end, axis: normalize(vsub(end, start)), lengthMm };
}

function parseMm(value) {
  if (typeof value === 'number') return value;
  return Number(String(value || '').replace(/mm$/i, '').trim());
}

function flangeRadius(pipeRadius) { return Math.max(pipeRadius * 1.55, pipeRadius + 35); }
function valveRadius(pipeRadius) { return Math.max(pipeRadius * 1.35, pipeRadius + 25); }
function pointAlong(start, axis, d) { return [start[0] + axis[0] * d, start[1] + axis[1] * d, start[2] + axis[2] * d]; }
function midpoint(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }
function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function normalize(v) { const l = Math.hypot(v[0], v[1], v[2]); if (!(l > 0)) throw new Error('Zero-length direction'); return [v[0] / l, v[1] / l, v[2] / l]; }
