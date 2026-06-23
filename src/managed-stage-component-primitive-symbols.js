import * as THREE from 'three';
import { cylinderBetween, mat } from './geometry.js?v=professional-viewer-3';

const VERSION = 'managed-stage-component-primitive-symbols-20260623b';
const FLANGE_COLOR = 0xb7b7b7;
const VALVE_COLOR = 0xcc2222;
const EPS_MM = 0.001;
const FLANGE_LIKE = new Set(['FLAN', 'FLANGE', 'FLANGE_PAIR']);
const VALVE_LIKE = new Set(['VALV', 'VALVE', 'FLANGED_VALVE']);
const DIAMETER_FIELDS = ['DIAMETER', 'BORE', 'ABORE', 'LBORE', 'HBOR', 'TBOR', 'NOMINAL_DIAMETER', 'NOMINALDIAMETER', 'DN'];

if (typeof window !== 'undefined') installManagedStageComponentPrimitiveSymbols();

export function installManagedStageComponentPrimitiveSymbols() {
  if (typeof window === 'undefined') {
    return { version: VERSION, apply: applyManagedStageComponentPrimitiveSymbols, debug: () => null };
  }
  if (window.__3D_MARKUP_MANAGED_STAGE_COMPONENT_PRIMITIVE_SYMBOLS__?.version === VERSION) {
    return window.__3D_MARKUP_MANAGED_STAGE_COMPONENT_PRIMITIVE_SYMBOLS__;
  }

  const api = {
    version: VERSION,
    apply: applyManagedStageComponentPrimitiveSymbols,
    patchActiveArtifact,
    debug: () => window.__3D_MARKUP_MANAGED_STAGE_COMPONENT_PRIMITIVE_SYMBOLS_LAST__ || null
  };
  window.__3D_MARKUP_MANAGED_STAGE_COMPONENT_PRIMITIVE_SYMBOLS__ = api;

  window.addEventListener?.('viewer:managed-stage-json-loaded', (event) => {
    applyManagedStageComponentPrimitiveSymbols(event?.detail?.modelRoot, event?.detail || {});
  });
  window.addEventListener?.('viewer:model-loaded', (event) => {
    applyManagedStageComponentPrimitiveSymbols(event?.detail?.modelRoot, event?.detail || {});
  });
  window.addEventListener?.('viewer:managed-stage-json-ui-ready', () => patchActiveArtifact(), { passive: true });

  patchActiveArtifact();
  return api;
}

function patchActiveArtifact() {
  if (typeof window === 'undefined') return null;
  const artifact = window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__?.getActiveArtifact?.();
  if (artifact?.previewScene) {
    return applyManagedStageComponentPrimitiveSymbols(artifact.previewScene, {
      sourceName: artifact.sourceName,
      previewCoordinateAudit: artifact.previewCoordinateAudit
    });
  }
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__;
  return applyManagedStageComponentPrimitiveSymbols(runtime?.modelRoot, { source: runtime?.source });
}

export function applyManagedStageComponentPrimitiveSymbols(modelRoot, detail = {}) {
  if (!modelRoot || !isManagedStagePreview(modelRoot, detail)) return null;

  const targets = [];
  modelRoot.traverse?.((object) => {
    const data = object.userData || {};
    if (!isRawSourceLine(data)) return;
    const family = componentFamily(data);
    if (family === 'FLANGE' || family === 'VALVE') targets.push({ object, data, family });
  });

  let flangeSymbolCount = 0;
  let valveSymbolCount = 0;
  const rows = [];
  for (const target of targets) {
    if (target.family === 'FLANGE') {
      const symbol = addWeldNeckFlangeSymbol(target.object, target.data);
      if (symbol) {
        flangeSymbolCount += 1;
        rows.push(symbol.userData.componentPrimitiveSymbolRow);
      }
    } else if (target.family === 'VALVE') {
      const symbol = addBallValveSymbol(target.object, target.data);
      if (symbol) {
        valveSymbolCount += 1;
        rows.push(symbol.userData.componentPrimitiveSymbolRow);
      }
    }
  }

  const result = {
    version: VERSION,
    schema: 'ManagedStageComponentPrimitiveSymbols.v1',
    sourceName: detail.sourceName || modelRoot.userData?.sourceName || modelRoot.userData?.source || 'managed-stage-preview',
    policy: 'stagedJson FLANGE and VALVE source lines use source APOS/LPOS length/axis and source diameter hints for compact additive primitive symbols; flange=2 primitives, ball valve=5 primitives; no boxes, no handwheels, no valve stems',
    targetCount: targets.length,
    flangeSymbolCount,
    valveSymbolCount,
    rows
  };

  modelRoot.userData = {
    ...(modelRoot.userData || {}),
    managedStageComponentPrimitiveSymbols: result
  };
  if (typeof window !== 'undefined') {
    window.__3D_MARKUP_MANAGED_STAGE_COMPONENT_PRIMITIVE_SYMBOLS_LAST__ = result;
    window.dispatchEvent?.(new CustomEvent('viewer:managed-stage-component-primitive-symbols-ready', {
      detail: { version: VERSION, flangeSymbolCount, valveSymbolCount }
    }));
    const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__;
    runtime?.renderOnce?.('managed-stage-component-primitive-symbols');
  }
  return result;
}

function addWeldNeckFlangeSymbol(object, data) {
  if (data.managedStageWeldNeckFlangeSymbolApplied || object.__managedStageWeldNeckFlangeSymbolApplied) return null;
  const basis = lineBasis(data);
  if (!basis) return null;

  const metrics = componentMetrics(object, data, basis.length);
  const pipeRadius = metrics.pipeRadiusMm;
  const flangeRadius = Math.max(pipeRadius * 1.95, 10);
  const hubSmallRadius = Math.max(pipeRadius * 1.05, 5);
  const hubLargeRadius = Math.max(pipeRadius * 1.42, 8);
  const faceLength = clamp(metrics.sourceLengthMm * 0.22, pipeRadius * 0.55, Math.max(pipeRadius * 2.2, 20));
  const hubLength = clamp(metrics.sourceLengthMm * 0.34, pipeRadius * 0.9, Math.max(pipeRadius * 3.2, 32));
  const halfFace = faceLength * 0.5;
  const hubEnd = basis.center.clone().sub(basis.dir.clone().multiplyScalar(halfFace));
  const hubStart = hubEnd.clone().sub(basis.dir.clone().multiplyScalar(Math.min(hubLength, Math.max(metrics.sourceLengthMm * 0.42, faceLength))));
  const material = mat(FLANGE_COLOR, { transparent: true, opacity: 0.94 });

  const group = primitiveSymbolGroup(object, data, {
    nameSuffix: 'WELDNECK_FLANGE_2P',
    cueKind: 'flange-weldneck-primitive-symbol',
    componentSymbol: 'WELDNECK_FLANGE',
    primitiveCount: 2,
    primitiveBudgetLimit: 2,
    geometryPrimitivePolicy: '2 primitives: raised-face flange disk + weld-neck tapered hub; length/axis/diameter derived from source APOS/LPOS and diameter fields',
    basis,
    metrics
  });

  const face = cylinderBetween(
    basis.center.clone().sub(basis.dir.clone().multiplyScalar(halfFace)),
    basis.center.clone().add(basis.dir.clone().multiplyScalar(halfFace)),
    flangeRadius,
    material,
    28,
    `${group.name}_RAISED_FACE_DISK`
  );
  const neck = frustumBetween(hubStart, hubEnd, hubSmallRadius, hubLargeRadius, material, 24, `${group.name}_WELD_NECK_HUB`);
  stampPrimitive(face, group, 'raised-face-disk', 1);
  stampPrimitive(neck, group, 'weld-neck-hub', 2);
  group.add(face, neck);
  object.parent?.add?.(group);
  softenSourceLine(object, 0.42);
  data.managedStageWeldNeckFlangeSymbolApplied = true;
  data.managedStageComponentPrimitiveSymbolApplied = true;
  object.__managedStageWeldNeckFlangeSymbolApplied = VERSION;
  return group;
}

function addBallValveSymbol(object, data) {
  if (data.managedStageValvePrimitiveSymbolApplied || object.__managedStageValvePrimitiveSymbolApplied) return null;
  const basis = lineBasis(data);
  if (!basis) return null;

  const metrics = componentMetrics(object, data, basis.length);
  const pipeRadius = metrics.pipeRadiusMm;
  const flangeRadius = Math.max(pipeRadius * 1.85, 10);
  const bodyRadius = Math.max(pipeRadius * 1.62, 9);
  const boreRadius = Math.max(pipeRadius * 1.04, 5);
  const bodyLength = clamp(metrics.sourceLengthMm * 0.30, pipeRadius * 1.7, Math.max(pipeRadius * 4.0, 42));
  const flangeLength = clamp(metrics.sourceLengthMm * 0.14, pipeRadius * 0.45, Math.max(pipeRadius * 1.45, 16));
  const seatLength = clamp(metrics.sourceLengthMm * 0.16, pipeRadius * 0.65, Math.max(pipeRadius * 2.0, 24));
  const material = mat(VALVE_COLOR, { transparent: true, opacity: 0.93 });

  const group = primitiveSymbolGroup(object, data, {
    nameSuffix: 'BALL_VALVE_5P',
    // Keep the legacy cue kind so the existing geometry ledger still counts VALVE rows.
    cueKind: 'valve-opposed-cone-pair',
    componentSymbol: 'BALL_VALVE',
    primitiveCount: 5,
    primitiveBudgetLimit: 6,
    geometryPrimitivePolicy: '5 primitives: central ball/body barrel + two seats + two end flanges; source APOS/LPOS controls axis/length; no stem, no handwheel',
    basis,
    metrics
  });

  const halfBody = bodyLength * 0.5;
  const leftBody = basis.center.clone().sub(basis.dir.clone().multiplyScalar(halfBody));
  const rightBody = basis.center.clone().add(basis.dir.clone().multiplyScalar(halfBody));
  const leftSeatOuter = leftBody.clone().sub(basis.dir.clone().multiplyScalar(seatLength));
  const rightSeatOuter = rightBody.clone().add(basis.dir.clone().multiplyScalar(seatLength));
  const leftFlangeOuter = leftSeatOuter.clone().sub(basis.dir.clone().multiplyScalar(flangeLength));
  const rightFlangeOuter = rightSeatOuter.clone().add(basis.dir.clone().multiplyScalar(flangeLength));

  const body = cylinderBetween(leftBody, rightBody, bodyRadius, material, 28, `${group.name}_CENTRAL_BALL_BODY`);
  const leftSeat = cylinderBetween(leftSeatOuter, leftBody, boreRadius, material, 20, `${group.name}_LEFT_SEAT`);
  const rightSeat = cylinderBetween(rightBody, rightSeatOuter, boreRadius, material, 20, `${group.name}_RIGHT_SEAT`);
  const leftFlange = cylinderBetween(leftFlangeOuter, leftSeatOuter, flangeRadius, material, 28, `${group.name}_LEFT_FLANGE`);
  const rightFlange = cylinderBetween(rightSeatOuter, rightFlangeOuter, flangeRadius, material, 28, `${group.name}_RIGHT_FLANGE`);

  stampPrimitive(body, group, 'central-ball-body', 1);
  stampPrimitive(leftSeat, group, 'left-seat', 2);
  stampPrimitive(rightSeat, group, 'right-seat', 3);
  stampPrimitive(leftFlange, group, 'left-end-flange', 4);
  stampPrimitive(rightFlange, group, 'right-end-flange', 5);
  group.add(body, leftSeat, rightSeat, leftFlange, rightFlange);
  object.parent?.add?.(group);
  softenSourceLine(object, 0.26);

  // Prevent the older InputXML classification guard from adding the obsolete cone-pair overlay.
  data.inputXmlValveConePairApplied = true;
  data.managedStageValvePrimitiveSymbolApplied = true;
  data.managedStageComponentPrimitiveSymbolApplied = true;
  data.visualClassification = 'stagedjson-ball-valve-primitive-symbol';
  object.__managedStageValvePrimitiveSymbolApplied = VERSION;
  return group;
}

function primitiveSymbolGroup(object, data, spec) {
  const group = new THREE.Group();
  group.name = `${object.name || data.sourceName || 'MANAGED_STAGE_COMPONENT'}_${spec.nameSuffix}`;
  const metrics = spec.metrics || {};
  const basis = spec.basis || {};
  const row = {
    sourceName: data.sourceName || object.name || '',
    sourcePath: data.sourcePath || object.name || '',
    componentSymbol: spec.componentSymbol,
    cueKind: spec.cueKind,
    primitiveCount: spec.primitiveCount,
    primitiveBudgetLimit: spec.primitiveBudgetLimit,
    geometryPrimitivePolicy: spec.geometryPrimitivePolicy,
    sourceLengthMm: metrics.sourceLengthMm,
    sourceAxis: basis.sourceAxis,
    sourceDiameterMm: metrics.sourceDiameterMm,
    pipeRadiusMm: metrics.pipeRadiusMm,
    sourceMetricPolicy: metrics.sourceMetricPolicy
  };
  group.userData = {
    TYPE: 'MANAGED_STAGE_PREVIEW_CUE',
    cueKind: spec.cueKind,
    componentSymbol: spec.componentSymbol,
    componentPrimitiveSymbol: true,
    componentPrimitiveSymbolRow: row,
    primitiveCount: spec.primitiveCount,
    primitiveBudgetLimit: spec.primitiveBudgetLimit,
    geometryPrimitivePolicy: spec.geometryPrimitivePolicy,
    previewAdditiveCue: true,
    previewOnly: true,
    exportedRvmGeometry: false,
    sourceName: data.sourceName || object.name || '',
    sourcePath: data.sourcePath || object.name || '',
    sourceValvePath: spec.componentSymbol === 'BALL_VALVE' ? (data.sourcePath || object.name || '') : '',
    sourceFlangePath: spec.componentSymbol === 'WELDNECK_FLANGE' ? (data.sourcePath || object.name || '') : '',
    sourceStartMm: clonePoint(data.sourceStartMm || data.sourceAposMm || data.previewStartMm),
    sourceEndMm: clonePoint(data.sourceEndMm || data.sourceLposMm || data.previewEndMm),
    sourceLengthMm: metrics.sourceLengthMm,
    sourceAxis: basis.sourceAxis,
    sourceDiameterMm: metrics.sourceDiameterMm,
    pipeRadiusMm: metrics.pipeRadiusMm,
    sourceMetricPolicy: metrics.sourceMetricPolicy,
    coordinatePolicy: 'additive stagedJson component primitive symbol; source APOS/LPOS line remains auditable and is not exported as fallback geometry'
  };
  return group;
}

function stampPrimitive(mesh, group, part, ordinal) {
  mesh.userData = {
    ...(group.userData || {}),
    cuePart: part,
    componentPrimitivePart: part,
    componentPrimitiveOrdinal: ordinal,
    componentPrimitiveBudgetCounted: true,
    previewAdditiveCue: true,
    previewOnly: true,
    exportedRvmGeometry: false
  };
  return mesh;
}

function lineBasis(data) {
  const start = pointFrom(data.sourceStartMm || data.sourceAposMm || data.previewStartMm);
  const end = pointFrom(data.sourceEndMm || data.sourceLposMm || data.previewEndMm);
  if (!start || !end) return null;
  const span = end.clone().sub(start);
  const length = span.length();
  if (!(length > EPS_MM)) return null;
  const dir = span.clone().normalize();
  const center = start.clone().add(end).multiplyScalar(0.5);
  return { start, end, span, length, dir, center, sourceAxis: axisTokenFromDirection(dir) };
}

function componentMetrics(object, data, length) {
  const sourceDiameterMm = inferSourceDiameterMm(data);
  const pipeRadiusMm = inferObjectRadius(object, length, sourceDiameterMm);
  return {
    sourceLengthMm: round(length),
    sourceDiameterMm: Number.isFinite(sourceDiameterMm) ? round(sourceDiameterMm) : null,
    pipeRadiusMm: round(pipeRadiusMm),
    sourceMetricPolicy: sourceDiameterMm
      ? 'APOS/LPOS controls symbol axis and length; source diameter field controls pipe radius'
      : 'APOS/LPOS controls symbol axis and length; pipe radius inferred from source preview geometry'
  };
}

function frustumBetween(a, b, radiusStart, radiusEnd, material, radialSegments = 20, name = 'frustum') {
  const delta = b.clone().sub(a);
  const length = Math.max(delta.length(), 0.0001);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusEnd, radiusStart, length, radialSegments, 1, false), material);
  mesh.name = name;
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  return mesh;
}

function softenSourceLine(object, opacity) {
  const materials = Array.isArray(object.material) ? object.material : [object.material].filter(Boolean);
  for (const material of materials) {
    material.transparent = true;
    material.opacity = Math.min(Number(material.opacity) || 1, opacity);
    material.depthWrite = false;
    material.needsUpdate = true;
  }
}

function isManagedStagePreview(modelRoot, detail = {}) {
  const data = modelRoot?.userData || {};
  const audit = data.managedStageCoordinateAudit || detail.previewCoordinateAudit || {};
  const text = [data.previewSource, data.previewSchema, data.sourceName, detail.sourceName, detail.source, audit.schema, audit.source]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return text.includes('managedstage') || text.includes('managed-stage') || text.includes('raw-managed-stage-json') || Boolean(audit.rows);
}

function isRawSourceLine(data) {
  return data.TYPE === 'MANAGED_STAGE_RAW_PREVIEW'
    && data.previewAdditiveCue !== true
    && (data.primitiveKind === 'raw-staged-source-line' || data.previewSourceGeometry === 'APOS_LPOS');
}

function componentFamily(data) {
  const tokens = [data.dtxr, data.rawType, data.stagedType, data.sourceName]
    .map(normalize)
    .filter(Boolean);
  if (tokens.some((token) => VALVE_LIKE.has(token))) return 'VALVE';
  if (tokens.some((token) => FLANGE_LIKE.has(token))) return 'FLANGE';
  return 'OTHER';
}

function inferObjectRadius(object, length, sourceDiameterMm = null) {
  if (Number.isFinite(sourceDiameterMm) && sourceDiameterMm > 0) return Math.max(sourceDiameterMm * 0.5, 2);
  const data = object.userData || {};
  const explicit = Number(data.pipeRadiusMm || data.radiusMm || 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const params = object.geometry?.parameters || {};
  const paramRadius = Number(params.radiusTop || params.radiusBottom || params.radius || 0);
  if (Number.isFinite(paramRadius) && paramRadius > 0) return paramRadius;
  object.geometry?.computeBoundingSphere?.();
  const sphereRadius = Number(object.geometry?.boundingSphere?.radius || 0);
  if (Number.isFinite(sphereRadius) && sphereRadius > 0) return clamp(sphereRadius * 0.32, 5, 80);
  return clamp(length * 0.045, 8, 80);
}

function inferSourceDiameterMm(data = {}) {
  const direct = parseMm(data.sourceDiameterMm || data.diameterMm || data.DIAMETER || data.BORE);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const attrs = data.sourceRawAttributes || data.rawAttributes || {};
  for (const field of DIAMETER_FIELDS) {
    const value = attrs[field] ?? attrs[field.toLowerCase?.()];
    const diameter = parseMm(value);
    if (Number.isFinite(diameter) && diameter > 0) return diameter;
  }
  return null;
}

function axisTokenFromDirection(dir) {
  const entries = [
    ['X', dir.x],
    ['Y', dir.y],
    ['Z', dir.z]
  ];
  entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const [axis, value] = entries[0];
  return `${value < 0 ? '-' : '+'}${axis}`;
}

function pointFrom(value) {
  if (!value) return null;
  if (value.isVector3) return value.clone();
  const x = Number(value.x ?? value.X ?? value[0]);
  const y = Number(value.y ?? value.Y ?? value[1]);
  const z = Number(value.z ?? value.Z ?? value[2]);
  if (![x, y, z].every(Number.isFinite)) return null;
  return new THREE.Vector3(x, y, z);
}

function clonePoint(value) {
  const point = pointFrom(value);
  return point ? { x: point.x, y: point.y, z: point.z } : null;
}

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function parseMm(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number.parseFloat(String(value).replace(/mm\b/gi, '').trim());
  return Number.isFinite(n) ? n : null;
}

function round(value) {
  if (!Number.isFinite(value)) return null;
  return Number(Number(value).toFixed(9));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
