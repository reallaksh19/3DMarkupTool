import { normalizeRvmMaterialId } from './rvm-material-layer-contract.js?v=bust-cache-4';

export const RVM_MATERIAL_ASSIGNMENT_POLICY_SCHEMA = 'RvmMaterialAssignmentPolicy.v1';

export const RVM_STABLE_MATERIAL_IDS = Object.freeze({
  DEFAULT: 0,
  PIPE: 12,
  RIGID_COMPONENT: 27,
  BEND: 6,
  REST: 6,
  GUIDE: 17,
  LINE_STOP: 19,
  HOLDDOWN: 22,
  SPRING: 31,
  WARNING: 11
});

/**
 * Technical Review/RVM material policy.
 *
 * The writer currently encodes material at CNTB/group scope only. This module
 * keeps that conservative behavior explicit while preventing silent fallback to
 * material 0 for generated export nodes. It intentionally does not introduce
 * MATL/MTRL/COLR/LAYR table chunks.
 */
export function assertRvmMaterialAssignmentPolicy(exportModel = {}) {
  const nodes = [];
  const primitives = [];
  const materialIds = new Set();
  const families = new Map();
  const mismatches = [];
  const missingNodeMaterials = [];

  visit(exportModel.root, (node) => {
    nodes.push(node);
    const classification = classifyRvmNodeMaterial(node);
    if (node.material === undefined || node.material === null || node.material === '') {
      missingNodeMaterials.push(classification.nodeName);
      return;
    }

    const actual = normalizeRvmMaterialId(node.material, `RVM material assignment for ${classification.nodeName}`);
    materialIds.add(actual);
    families.set(classification.family, (families.get(classification.family) || 0) + 1);

    if (actual !== classification.expectedMaterialId) {
      mismatches.push({
        node: classification.nodeName,
        family: classification.family,
        actualMaterialId: actual,
        expectedMaterialId: classification.expectedMaterialId
      });
    }

    for (const primitive of node.primitives || []) {
      primitives.push(primitive);
      if (primitive.material !== undefined && primitive.material !== null && primitive.material !== '') {
        materialIds.add(normalizeRvmMaterialId(primitive.material, `RVM primitive material for ${primitive.name || 'UNNAMED_PRIMITIVE'}`));
      }
    }
  });

  if (missingNodeMaterials.length) {
    throw new Error(`RVM material assignment requires explicit CNTB material ids for: ${missingNodeMaterials.join(', ')}`);
  }

  if (mismatches.length) {
    const summary = mismatches.map((item) => `${item.node}=${item.actualMaterialId}, expected ${item.expectedMaterialId} for ${item.family}`).join('; ');
    throw new Error(`RVM material assignment mismatch: ${summary}`);
  }

  return {
    schema: RVM_MATERIAL_ASSIGNMENT_POLICY_SCHEMA,
    failClosed: true,
    cntbMaterialIdsStableByFamily: true,
    materialTableChunksRequired: false,
    nodeCount: nodes.length,
    primitiveCount: primitives.length,
    materialIds: Array.from(materialIds).sort((a, b) => a - b),
    familyCounts: Object.fromEntries(Array.from(families.entries()).sort((a, b) => a[0].localeCompare(b[0]))),
    defaultMaterialFallbackAllowedForNodes: false
  };
}

export function classifyRvmNodeMaterial(node = {}) {
  const attrs = node.attributes || {};
  const type = String(attrs.TYPE || '').toUpperCase();
  const role = String(attrs.ROLE || '').toUpperCase();
  const family = String(attrs.FAMILY || attrs.SUPPORT_CATALOGUE_FAMILY || '').toUpperCase();
  const engineeringType = String(attrs.ENGINEERING_TYPE || '').toUpperCase();
  const nodeName = node.reviewName || node.name || 'UNNAMED';

  if (type === 'MODEL_ROOT') return materialClassification(nodeName, 'MODEL_ROOT', RVM_STABLE_MATERIAL_IDS.PIPE);
  if (role === 'PLANT_GEOMETRY') return materialClassification(nodeName, 'PLANT_GEOMETRY', RVM_STABLE_MATERIAL_IDS.PIPE);
  if (role === 'SUPPORTS_RESTRAINTS') return materialClassification(nodeName, 'SUPPORTS_RESTRAINTS', RVM_STABLE_MATERIAL_IDS.WARNING);
  if (role === 'ANNOTATIONS') return materialClassification(nodeName, 'ANNOTATIONS', RVM_STABLE_MATERIAL_IDS.WARNING);

  if (type === 'COMPONENT') {
    if (engineeringType.includes('BEND')) return materialClassification(nodeName, 'BEND', RVM_STABLE_MATERIAL_IDS.BEND);
    if (engineeringType.includes('PIPE') || engineeringType === '') return materialClassification(nodeName, 'PIPE', RVM_STABLE_MATERIAL_IDS.PIPE);
    return materialClassification(nodeName, 'RIGID_COMPONENT', RVM_STABLE_MATERIAL_IDS.RIGID_COMPONENT);
  }

  if (type === 'SUPPORT_RESTRAINT' || type === 'SUPPORT_MARKER') {
    return materialClassification(nodeName, `SUPPORT_${family || 'UNKNOWN'}`, supportFamilyMaterialId(family));
  }

  if (type === 'NODE' || type === 'ISONOTE_NAME_PLATE') {
    return materialClassification(nodeName, type, RVM_STABLE_MATERIAL_IDS.WARNING);
  }

  return materialClassification(nodeName, 'WARNING_FALLBACK', RVM_STABLE_MATERIAL_IDS.WARNING);
}

export function supportFamilyMaterialId(family) {
  const value = String(family || '').toUpperCase();
  if (value === 'REST') return RVM_STABLE_MATERIAL_IDS.REST;
  if (value === 'GUIDE') return RVM_STABLE_MATERIAL_IDS.GUIDE;
  if (value === 'LINE_STOP' || value === 'LINESTOP' || value === 'LIMIT' || value === 'LIMIT_STOP' || value === 'ANCHOR' || value === 'AXIS_RESTRAINT') return RVM_STABLE_MATERIAL_IDS.LINE_STOP;
  if (value === 'HOLDDOWN') return RVM_STABLE_MATERIAL_IDS.HOLDDOWN;
  if (value === 'SPRING' || value === 'SPRING_WARNING') return RVM_STABLE_MATERIAL_IDS.SPRING;
  return RVM_STABLE_MATERIAL_IDS.WARNING;
}

function materialClassification(nodeName, family, expectedMaterialId) {
  return { nodeName, family, expectedMaterialId };
}

function visit(node, callback) {
  if (!node) throw new Error('RVM material assignment policy requires an exportModel.root node');
  callback(node);
  for (const child of node.children || []) visit(child, callback);
}
