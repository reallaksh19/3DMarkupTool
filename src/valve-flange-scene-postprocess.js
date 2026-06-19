import * as THREE from 'three';

export const VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA = 'ValveFlangeScenePostprocess.v1';

const BASE_CYLINDER_ALLOWED_ROLES = new Set([
  '',
  'PIPE',
  'FLANGED VALVE',
  'FLANGED_VALVE',
  'VALVE',
  'FLANGE',
  'FLANGE PAIR',
  'FLANGE_PAIR',
  'GATE VALVE',
  'GATE_VALVE',
  'BALL VALVE',
  'BALL_VALVE',
  'GLOBE VALVE',
  'GLOBE_VALVE',
  'CHECK VALVE',
  'CHECK_VALVE',
  'BUTTERFLY VALVE',
  'BUTTERFLY_VALVE',
  'CONTROL VALVE',
  'CONTROL_VALVE'
]);

const HANDWHEEL_VALVES = new Set(['VALVE_FLANGED', 'VALVE_GENERIC', 'VALVE_GATE', 'VALVE_GLOBE']);
const LEVER_VALVES = new Set(['VALVE_BALL', 'VALVE_BUTTERFLY']);
const ACTUATOR_VALVES = new Set(['VALVE_CONTROL']);
const ROUND_SHELL_VALVES = new Set(['VALVE_FLANGED', 'VALVE_GENERIC', 'VALVE_GATE']);

export function hideCatalogReplacedBaseCylinders(sceneOrGroup, options = {}) {
  if (!sceneOrGroup || typeof sceneOrGroup !== 'object') throw new Error('sceneOrGroup is required');

  const stats = {
    schemaVersion: VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA,
    scannedObjects: 0,
    catalogVisualGroups: 0,
    hiddenBaseCylinders: 0,
    uprightValveCorrections: 0,
    flangeVisualCorrections: 0,
    untouchedNonCatalogObjects: 0,
    replacedComponentIds: []
  };

  const parentByChild = new Map();
  walk(sceneOrGroup, (object, parent) => {
    stats.scannedObjects += 1;
    if (parent) parentByChild.set(object, parent);
  });

  const catalogGroups = [];
  walk(sceneOrGroup, (object) => {
    if (isCatalogVisualGroup(object)) {
      catalogGroups.push(object);
      stats.catalogVisualGroups += 1;
    }
  });

  for (const visualGroup of catalogGroups) {
    const componentId = componentIdentity(visualGroup);
    if (!componentId) continue;
    const parent = parentByChild.get(visualGroup);
    const siblings = Array.isArray(parent?.children) ? parent.children : [];
    const base = siblings.find((candidate) => isLegacyBaseCylinderForComponent(candidate, componentId));
    if (base) {
      if (options.remove === true) {
        parent.children = siblings.filter((candidate) => candidate !== base);
      } else {
        base.visible = false;
      }
      base.userData = {
        ...(base.userData || {}),
        meshRole: 'CATALOG_REPLACED_BASE_CYLINDER',
        hiddenByVisualCatalog: true,
        hiddenByVisualCatalogSchema: VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA,
        hiddenByVisualCatalogReason: 'valve/flange visual replaces its own pipe-length base cylinder; adjacent pipes remain separate'
      };
      stats.hiddenBaseCylinders += 1;
      if (!stats.replacedComponentIds.includes(componentId)) stats.replacedComponentIds.push(componentId);
    }

    if (correctValveCatalogVisual(visualGroup)) stats.uprightValveCorrections += 1;
    if (correctFlangeCatalogVisual(visualGroup)) stats.flangeVisualCorrections += 1;
  }

  stats.untouchedNonCatalogObjects = Math.max(0, stats.scannedObjects - stats.catalogVisualGroups - stats.hiddenBaseCylinders);
  return stats;
}

export function isCatalogVisualGroup(object) {
  const data = object?.userData || {};
  return data.meshRole === 'CATALOG_VISUAL_GROUP'
    && typeof data.visualCatalogSchema === 'string'
    && (data.componentClass === 'VALVE' || data.componentClass === 'FLANGE');
}

export function isLegacyBaseCylinderForComponent(object, componentId) {
  if (!object || isCatalogVisualGroup(object)) return false;
  const data = object.userData || {};
  if (data.visualCatalogSchema) return false;
  if (data.hiddenByVisualCatalog) return false;
  if (data.TYPE && data.TYPE !== 'COMPONENT') return false;
  const id = componentIdentity(object);
  if (!id || id !== componentId) return false;
  return hasLegacyBaseCylinderRole(data);
}

export function hasLegacyBaseCylinderRole(data = {}) {
  const role = normalizeRole(data.meshRole);
  if (BASE_CYLINDER_ALLOWED_ROLES.has(role)) return true;
  const typeText = normalizeRole(firstNonEmpty(data.engineeringType, data.rigidType, data.componentType, data.TYPE));
  return typeText.includes('VALVE') || typeText.includes('FLANGE');
}

function correctValveCatalogVisual(visualGroup) {
  const data = visualGroup?.userData || {};
  if (normalizeRole(data.componentClass) !== 'VALVE') return false;
  if (visualGroup.userData?.catalogValveOrientationCorrectionApplied) return false;

  const body = findChildByRole(visualGroup, 'VALVE_BODY');
  const collarA = findChildByRole(visualGroup, 'END_COLLAR_A');
  const collarB = findChildByRole(visualGroup, 'END_COLLAR_B');
  if (!body || !collarA || !collarB) return false;
  if (!body.position?.clone || !collarA.position?.clone || !collarB.position?.clone || typeof visualGroup.add !== 'function') return false;

  const axis = collarB.position.clone().sub(collarA.position);
  if (axis.lengthSq() < 1e-8) return false;
  const dir = axis.normalize();
  const up = preferredValveUpVector(dir);
  const side = stableSideVector(dir, up);
  const type = normalizeRole(data.componentType);

  hideChildrenByRoles(visualGroup, ['BONNET_STEM', 'HANDWHEEL', 'LEVER_HANDLE', 'ACTUATOR']);

  const bodyRadius = cylinderRadius(body) || userNumber(body.userData?.radius, 0.35);
  const bodyMaterial = body.material || collarA.material || collarB.material;
  const center = body.position.clone();

  addValveContinuityNecks(visualGroup, center, dir, body, collarA, collarB, bodyRadius, bodyMaterial);

  if (ROUND_SHELL_VALVES.has(type)) {
    body.visible = false;
    body.userData = {
      ...(body.userData || {}),
      hiddenByUprightValveCorrection: true,
      hiddenByUprightValveCorrectionSchema: VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA
    };
    const shell = new THREE.Mesh(new THREE.SphereGeometry(Math.max(bodyRadius * 0.88, 0.08), 28, 16), bodyMaterial);
    shell.name = `${visualGroup.name || componentIdentity(visualGroup)}_VALVE_BODY_UPRIGHT`;
    shell.position.copy(center);
    shell.scale.set(1.1, 0.92, 1.1);
    shell.userData = correctedUserData(visualGroup, 'VALVE_BODY', {
      uprightValveCorrection: true,
      catalogOrientationCorrection: true,
      uprightValveCorrectionReason: 'valve must read as a body with operator, not horizontal pipe barrel'
    });
    visualGroup.add(shell);
  }

  if (HANDWHEEL_VALVES.has(type)) {
    addUprightStemAndHandwheel(visualGroup, center, up, bodyRadius, bodyMaterial, type);
  } else if (LEVER_VALVES.has(type)) {
    addUprightStemAndLever(visualGroup, center, up, side, bodyRadius, bodyMaterial, type);
  } else if (ACTUATOR_VALVES.has(type)) {
    addUprightStemAndActuator(visualGroup, center, up, side, bodyRadius, bodyMaterial, type);
  } else if (type === 'VALVE_CHECK') {
    addCheckValveCover(visualGroup, center, up, bodyRadius, bodyMaterial);
  }

  visualGroup.userData = {
    ...visualGroup.userData,
    catalogValveOrientationCorrectionApplied: true,
    uprightValveCorrectionApplied: true,
    valveContinuityCorrectionApplied: true,
    uprightValveCorrectionSchema: VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA,
    operatorUpBasis: 'preferred-world-up-projected-off-pipe-axis'
  };
  return true;
}

function addValveContinuityNecks(visualGroup, center, dir, body, collarA, collarB, bodyRadius, material) {
  const hasExisting = findChildByRole(visualGroup, 'VALVE_NECK_A') && findChildByRole(visualGroup, 'VALVE_NECK_B');
  if (hasExisting) {
    visualGroup.userData = {
      ...visualGroup.userData,
      valveContinuityCorrectionApplied: true,
      valveContinuityCorrectionSchema: VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA,
      valveContinuityBasis: 'catalog-direct-neck-fillers'
    };
    return false;
  }

  const collarRadius = Math.max(cylinderRadius(collarA) || 0, cylinderRadius(collarB) || 0, bodyRadius * 0.7);
  const collarALength = cylinderLength(collarA) || userNumber(collarA.userData?.length, bodyRadius * 0.28);
  const collarBLength = cylinderLength(collarB) || userNumber(collarB.userData?.length, bodyRadius * 0.28);
  const bodyLength = cylinderLength(body) || userNumber(body.userData?.length, bodyRadius * 1.2);
  const collarDistance = collarA.position.distanceTo(collarB.position);
  const bodyHalf = Math.min(Math.max(bodyLength / 2, bodyRadius * 0.62), collarDistance * 0.43);
  const neckRadius = Math.max(Math.min(bodyRadius * 0.62, collarRadius * 0.82), 0.045);

  const segments = [
    {
      role: 'VALVE_NECK_A',
      start: collarA.position.clone().add(dir.clone().multiplyScalar(collarALength * 0.28)),
      end: center.clone().sub(dir.clone().multiplyScalar(bodyHalf * 0.92))
    },
    {
      role: 'VALVE_NECK_B',
      start: center.clone().add(dir.clone().multiplyScalar(bodyHalf * 0.92)),
      end: collarB.position.clone().sub(dir.clone().multiplyScalar(collarBLength * 0.28))
    }
  ];

  let added = false;
  for (const segment of segments) {
    if (segment.start.distanceTo(segment.end) <= Math.max(neckRadius * 0.18, 0.012)) continue;
    const neck = cylinderBetween(segment.start, segment.end, neckRadius, material, 22, `${visualGroup.name || componentIdentity(visualGroup)}_${segment.role}`);
    neck.userData = correctedUserData(visualGroup, segment.role, {
      valveContinuityCorrection: true,
      valveContinuityCorrectionReason: 'close visible shoulder gap between valve body and end flange/collar after centerline pipe is hidden',
      proportionalShoulder: true
    });
    visualGroup.add(neck);
    added = true;
  }

  if (added) {
    visualGroup.userData = {
      ...visualGroup.userData,
      valveContinuityCorrectionApplied: true,
      valveContinuityCorrectionSchema: VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA,
      valveContinuityBasis: 'postprocess-shoulder-fillers'
    };
  }
  return added;
}

function addUprightStemAndHandwheel(visualGroup, center, up, bodyRadius, material, type) {
  const stemLength = Math.max(bodyRadius * (type === 'VALVE_GATE' ? 1.0 : 0.72), 0.16);
  const stemRadius = Math.max(bodyRadius * 0.05, 0.022);
  const stemStart = center.clone().add(up.clone().multiplyScalar(bodyRadius * 0.78));
  const stemEnd = stemStart.clone().add(up.clone().multiplyScalar(stemLength));
  const stem = cylinderBetween(stemStart, stemEnd, stemRadius, material, 14, `${visualGroup.name || componentIdentity(visualGroup)}_BONNET_STEM_UPRIGHT`);
  stem.userData = correctedUserData(visualGroup, 'BONNET_STEM');
  visualGroup.add(stem);

  const wheelRadius = Math.max(bodyRadius * 0.34, 0.13);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius, Math.max(wheelRadius * 0.055, 0.016), 8, 32), material);
  wheel.name = `${visualGroup.name || componentIdentity(visualGroup)}_HANDWHEEL_UPRIGHT`;
  wheel.position.copy(stemEnd.clone().add(up.clone().multiplyScalar(wheelRadius * 0.16)));
  wheel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up.clone().normalize());
  wheel.userData = correctedUserData(visualGroup, 'HANDWHEEL');
  visualGroup.add(wheel);
}

function addUprightStemAndLever(visualGroup, center, up, side, bodyRadius, material, type) {
  const stemLength = Math.max(bodyRadius * 0.5, 0.11);
  const stemStart = center.clone().add(up.clone().multiplyScalar(bodyRadius * 0.72));
  const stemEnd = stemStart.clone().add(up.clone().multiplyScalar(stemLength));
  const stem = cylinderBetween(stemStart, stemEnd, Math.max(bodyRadius * 0.04, 0.018), material, 10, `${visualGroup.name || componentIdentity(visualGroup)}_LEVER_STEM_UPRIGHT`);
  stem.userData = correctedUserData(visualGroup, 'BONNET_STEM', { valveOperatorStyle: 'lever-stem' });
  visualGroup.add(stem);

  const leverLength = Math.max(bodyRadius * (type === 'VALVE_BUTTERFLY' ? 1.35 : 1.6), 0.32);
  const leverCenter = stemEnd.clone().add(up.clone().multiplyScalar(bodyRadius * 0.08));
  const lever = cylinderBetween(
    leverCenter.clone().sub(side.clone().multiplyScalar(leverLength / 2)),
    leverCenter.clone().add(side.clone().multiplyScalar(leverLength / 2)),
    Math.max(bodyRadius * 0.04, 0.016),
    material,
    10,
    `${visualGroup.name || componentIdentity(visualGroup)}_LEVER_HANDLE_UPRIGHT`
  );
  lever.userData = correctedUserData(visualGroup, 'LEVER_HANDLE');
  visualGroup.add(lever);
}

function addUprightStemAndActuator(visualGroup, center, up, side, bodyRadius, material, type) {
  const stemStart = center.clone().add(up.clone().multiplyScalar(bodyRadius * 0.76));
  const stemEnd = stemStart.clone().add(up.clone().multiplyScalar(Math.max(bodyRadius * 0.62, 0.16)));
  const stem = cylinderBetween(stemStart, stemEnd, Math.max(bodyRadius * 0.05, 0.022), material, 12, `${visualGroup.name || componentIdentity(visualGroup)}_ACTUATOR_STEM_UPRIGHT`);
  stem.userData = correctedUserData(visualGroup, 'BONNET_STEM', { valveOperatorStyle: 'actuator-stem' });
  visualGroup.add(stem);

  const actuatorLength = Math.max(bodyRadius * 1.25, 0.32);
  const actuatorRadius = Math.max(bodyRadius * 0.36, 0.1);
  const actuatorCenter = stemEnd.clone().add(up.clone().multiplyScalar(actuatorRadius * 0.35));
  const actuator = cylinderBetween(
    actuatorCenter.clone().sub(side.clone().multiplyScalar(actuatorLength / 2)),
    actuatorCenter.clone().add(side.clone().multiplyScalar(actuatorLength / 2)),
    actuatorRadius,
    material,
    18,
    `${visualGroup.name || componentIdentity(visualGroup)}_ACTUATOR_UPRIGHT`
  );
  actuator.userData = correctedUserData(visualGroup, 'ACTUATOR', { valveOperatorStyle: 'actuator-cylinder' });
  visualGroup.add(actuator);
}

function addCheckValveCover(visualGroup, center, up, bodyRadius, material) {
  const coverCenter = center.clone().add(up.clone().multiplyScalar(bodyRadius * 0.82));
  const cover = cylinderBetween(
    coverCenter.clone().sub(up.clone().multiplyScalar(bodyRadius * 0.07)),
    coverCenter.clone().add(up.clone().multiplyScalar(bodyRadius * 0.07)),
    Math.max(bodyRadius * 0.26, 0.07),
    material,
    18,
    `${visualGroup.name || componentIdentity(visualGroup)}_CHECK_COVER_UPRIGHT`
  );
  cover.userData = correctedUserData(visualGroup, 'CHECK_COVER');
  visualGroup.add(cover);
}

function correctFlangeCatalogVisual(visualGroup) {
  const data = visualGroup?.userData || {};
  if (normalizeRole(data.componentClass) !== 'FLANGE') return false;
  if (visualGroup.userData?.catalogFlangeVisualCorrectionApplied) return false;
  if (typeof visualGroup.add !== 'function') return false;

  const discA = findChildByRole(visualGroup, 'FLANGE_DISC_A');
  const discB = findChildByRole(visualGroup, 'FLANGE_DISC_B');
  if (!discA || !discB || !discA.position?.clone || !discB.position?.clone) return false;
  const axis = discB.position.clone().sub(discA.position);
  if (axis.lengthSq() < 1e-8) return false;
  const dir = axis.normalize();
  const mid = discA.position.clone().add(discB.position).multiplyScalar(0.5);
  const radius = Math.max(cylinderRadius(discA) || 0, cylinderRadius(discB) || 0, userNumber(discA.userData?.radius, 0.35));
  const discALength = cylinderLength(discA) || userNumber(discA.userData?.length, radius * 0.16);
  const discBLength = cylinderLength(discB) || userNumber(discB.userData?.length, radius * 0.16);
  const material = discA.material || discB.material || new THREE.MeshBasicMaterial({ color: 0x77aeda });

  const fillStart = discA.position.clone().add(dir.clone().multiplyScalar(discALength / 2));
  const fillEnd = discB.position.clone().sub(dir.clone().multiplyScalar(discBLength / 2));
  if (!findChildByRole(visualGroup, 'FLANGE_CENTER_BORE_FILL') && fillStart.distanceTo(fillEnd) > Math.max(radius * 0.05, 0.015)) {
    const boreFill = cylinderBetween(fillStart, fillEnd, Math.max(radius * 0.30, 0.04), material, 24, `${visualGroup.name || componentIdentity(visualGroup)}_FLANGE_CENTER_BORE_FILL`);
    boreFill.userData = correctedUserData(visualGroup, 'FLANGE_CENTER_BORE_FILL', {
      flangeVisualCorrection: true,
      flangeVisualCorrectionReason: 'close visual gap between flange plates after component base pipe is hidden',
      proportionalBoreFill: true
    });
    visualGroup.add(boreFill);
  }

  if (!findChildByRole(visualGroup, 'GASKET_CENTER')) {
    const gasketMaterial = new THREE.MeshBasicMaterial({ color: 0x1e2632 });
    const gasket = cylinderAlongAxis(mid, dir, Math.max(radius * 0.045, 0.018), Math.max(radius * 0.56, 0.06), gasketMaterial, 24, `${visualGroup.name || componentIdentity(visualGroup)}_GASKET_CENTER`);
    gasket.userData = correctedUserData(visualGroup, 'GASKET_CENTER', {
      flangeVisualCorrection: true,
      flangeVisualCorrectionReason: 'flange pair needs a visible gasket/face reference after centerline pipe is removed',
      proportionalGasket: true
    });
    visualGroup.add(gasket);
  }

  visualGroup.userData = {
    ...visualGroup.userData,
    catalogFlangeVisualCorrectionApplied: true,
    flangeContinuityCorrectionApplied: true,
    flangeVisualCorrectionSchema: VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA
  };
  return true;
}

function correctedUserData(visualGroup, meshRole, extra = {}) {
  return {
    ...(visualGroup.userData || {}),
    meshRole,
    uprightValveCorrection: true,
    catalogOrientationCorrection: true,
    uprightValveCorrectionSchema: VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA,
    ...extra
  };
}

function hideChildrenByRoles(group, roles) {
  const wanted = new Set(roles.map(normalizeRole));
  for (const child of Array.isArray(group?.children) ? group.children : []) {
    if (wanted.has(normalizeRole(child?.userData?.meshRole)) && !child.userData?.catalogOrientationCorrection) {
      child.visible = false;
      child.userData = {
        ...(child.userData || {}),
        hiddenByUprightValveCorrection: true,
        hiddenByUprightValveCorrectionSchema: VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA
      };
    }
  }
}

function findChildByRole(group, role) {
  return (Array.isArray(group?.children) ? group.children : []).find((child) => normalizeRole(child?.userData?.meshRole) === role);
}

function preferredValveUpVector(dir) {
  const d = dir.clone().normalize();
  const candidates = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)];
  for (const candidate of candidates) {
    const projected = candidate.clone().sub(d.clone().multiplyScalar(candidate.dot(d)));
    if (projected.lengthSq() > 1e-6) return projected.normalize();
  }
  return new THREE.Vector3(0, 1, 0);
}

function stableSideVector(dir, up) {
  const side = new THREE.Vector3().crossVectors(dir, up);
  if (side.lengthSq() > 1e-8) return side.normalize();
  return preferredValveUpVector(up);
}

function cylinderBetween(a, b, radius, material, radialSegments = 16, name = 'cylinder') {
  const start = a.clone();
  const end = b.clone();
  const delta = end.clone().sub(start);
  const length = delta.length();
  const geom = new THREE.CylinderGeometry(Math.max(radius, 0.004), Math.max(radius, 0.004), Math.max(length, 0.0001), radialSegments, 1, false);
  const mesh = new THREE.Mesh(geom, material);
  mesh.name = name;
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  return mesh;
}

function cylinderAlongAxis(center, dir, length, radius, material, radialSegments, name) {
  const half = dir.clone().normalize().multiplyScalar(Math.max(length, 0.0001) / 2);
  return cylinderBetween(center.clone().sub(half), center.clone().add(half), Math.max(radius, 0.004), material, radialSegments, name);
}

function cylinderRadius(mesh) {
  const params = mesh?.geometry?.parameters || {};
  return userNumber(params.radiusTop, userNumber(params.radiusBottom, userNumber(params.radius, null)));
}

function cylinderLength(mesh) {
  const params = mesh?.geometry?.parameters || {};
  return userNumber(params.height, userNumber(mesh?.userData?.length, null));
}

function userNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeRole(value) {
  return String(value ?? '').trim().replace(/[\s-]+/g, '_').toUpperCase();
}

function componentIdentity(object) {
  const data = object?.userData || {};
  return firstNonEmpty(data.componentId, data.ID, data.id, object?.name);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function walk(root, visit, parent = null) {
  visit(root, parent);
  for (const child of Array.isArray(root.children) ? root.children : []) {
    walk(child, visit, root);
  }
}
