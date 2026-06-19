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
    if (!base) continue;

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
