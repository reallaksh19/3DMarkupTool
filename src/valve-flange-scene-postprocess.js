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

export function hideCatalogReplacedBaseCylinders(sceneOrGroup, options = {}) {
  if (!sceneOrGroup || typeof sceneOrGroup !== 'object') throw new Error('sceneOrGroup is required');

  const stats = {
    schemaVersion: VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA,
    scannedObjects: 0,
    catalogVisualGroups: 0,
    hiddenBaseCylinders: 0,
    uprightValveCorrections: 0,
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

    if (correctFlangedValveUprightVisual(visualGroup)) {
      stats.uprightValveCorrections += 1;
    }
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

function correctFlangedValveUprightVisual(visualGroup) {
  const data = visualGroup?.userData || {};
  if (normalizeRole(data.componentType) !== 'VALVE_FLANGED') return false;
  if (visualGroup.userData?.uprightValveCorrectionApplied) return false;

  const body = findChildByRole(visualGroup, 'VALVE_BODY');
  const collarA = findChildByRole(visualGroup, 'END_COLLAR_A');
  const collarB = findChildByRole(visualGroup, 'END_COLLAR_B');
  if (!body || !collarA || !collarB) return false;

  const axis = collarB.position.clone().sub(collarA.position);
  if (axis.lengthSq() < 1e-8) return false;
  const dir = axis.normalize();
  const up = preferredValveUpVector(dir);

  const originalStem = findChildByRole(visualGroup, 'BONNET_STEM');
  const originalWheel = findChildByRole(visualGroup, 'HANDWHEEL');
  if (originalStem) originalStem.visible = false;
  if (originalWheel) originalWheel.visible = false;

  const bodyRadius = cylinderRadius(body) || userNumber(body.userData?.radius, 0.35);
  const bodyMaterial = body.material || originalStem?.material || originalWheel?.material;
  const center = body.position.clone();

  // The generated flanged-valve body previously used a horizontal capsule. Replace
  // that visual with a round valve-body shell so it reads as a valve, not a pipe spool.
  body.visible = false;
  body.userData = {
    ...(body.userData || {}),
    hiddenByUprightValveCorrection: true,
    hiddenByUprightValveCorrectionSchema: VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA
  };

  const roundBody = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(bodyRadius * 0.86, 0.08), 28, 16),
    bodyMaterial
  );
  roundBody.name = `${visualGroup.name || componentIdentity(visualGroup)}_VALVE_BODY_UPRIGHT`;
  roundBody.position.copy(center);
  roundBody.scale.set(1.12, 0.92, 1.12);
  roundBody.userData = {
    ...(body.userData || {}),
    meshRole: 'VALVE_BODY',
    uprightValveCorrection: true,
    uprightValveCorrectionSchema: VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA,
    uprightValveCorrectionReason: 'flanged valve must read as upright valve body, not horizontal pipe barrel'
  };
  visualGroup.add(roundBody);

  const stemLength = userNumber(originalStem?.userData?.length, bodyRadius * 0.78);
  const stemRadius = Math.max(bodyRadius * 0.055, 0.025);
  const stemStart = center.clone().add(up.clone().multiplyScalar(bodyRadius * 0.78));
  const stemEnd = stemStart.clone().add(up.clone().multiplyScalar(stemLength));
  const stem = cylinderBetween(stemStart, stemEnd, stemRadius, bodyMaterial, 14, `${visualGroup.name || componentIdentity(visualGroup)}_BONNET_STEM_UPRIGHT`);
  stem.userData = {
    ...(originalStem?.userData || data),
    meshRole: 'BONNET_STEM',
    uprightValveCorrection: true,
    uprightValveCorrectionSchema: VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA
  };
  visualGroup.add(stem);

  const wheelRadius = Math.max(userNumber(originalWheel?.userData?.radius, bodyRadius * 0.42), bodyRadius * 0.35);
  const wheel = new THREE.Mesh(
    new THREE.TorusGeometry(wheelRadius, Math.max(wheelRadius * 0.06, 0.018), 8, 32),
    bodyMaterial
  );
  wheel.name = `${visualGroup.name || componentIdentity(visualGroup)}_HANDWHEEL_UPRIGHT`;
  wheel.position.copy(stemEnd.clone().add(up.clone().multiplyScalar(wheelRadius * 0.18)));
  wheel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up.clone().normalize());
  wheel.userData = {
    ...(originalWheel?.userData || data),
    meshRole: 'HANDWHEEL',
    uprightValveCorrection: true,
    uprightValveCorrectionSchema: VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA
  };
  visualGroup.add(wheel);

  visualGroup.userData = {
    ...visualGroup.userData,
    uprightValveCorrectionApplied: true,
    uprightValveCorrectionSchema: VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA
  };
  return true;
}

function findChildByRole(group, role) {
  return (Array.isArray(group?.children) ? group.children : []).find((child) => normalizeRole(child?.userData?.meshRole) === role);
}

function preferredValveUpVector(dir) {
  const d = dir.clone().normalize();
  const candidates = [
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(1, 0, 0)
  ];
  for (const candidate of candidates) {
    const projected = candidate.clone().sub(d.clone().multiplyScalar(candidate.dot(d)));
    if (projected.lengthSq() > 1e-6) return projected.normalize();
  }
  return new THREE.Vector3(0, 1, 0);
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

function cylinderRadius(mesh) {
  const params = mesh?.geometry?.parameters || {};
  return userNumber(params.radiusTop, userNumber(params.radiusBottom, userNumber(params.radius, null)));
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
