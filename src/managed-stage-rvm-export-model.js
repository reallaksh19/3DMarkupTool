import {
  MANAGED_STAGE_RVM_MATERIALS,
  managedStageComponentClass,
  managedStageMaterialForClass,
  planManagedStagePrimitives
} from './managed-stage-rvm-primitive-planner.js';
import { point3 } from './managed-stage-topology-audit.js';

export function buildManagedStageRvmExportModel(profile) {
  const elements = profile.geometryRecords.map((record, index) => elementNode(record, index));
  return {
    root: groupNode('/BM_CII', 'ROOT', 'ROOT', [
      groupNode('/BM_CII-CU-PI', 'DISCIPLINE', 'PIPING', [
        groupNode('/BM_CII-CU-PI-P', 'GROUP', 'PIPING_GROUP', elements)
      ])
    ]),
    rvmMaterialColors: {
      1: 0x82828200,
      4: 0x00a0ff00,
      5: 0x99999900,
      6: 0xcccccc00,
      7: 0x55555500,
      8: 0xcc990000
    },
    audit: {
      schema: 'ManagedStageRvmExportModel.v1',
      componentCount: elements.length,
      supportGeometryEmitted: false,
      primitiveCount: elements.reduce((sum, node) => sum + node.primitives.length, 0)
    }
  };
}

function groupNode(reviewName, type, componentClass, children) {
  return {
    name: reviewName,
    reviewName,
    material: MANAGED_STAGE_RVM_MATERIALS.ROOT,
    position: [0, 0, 0],
    attributes: { NAME: reviewName, TYPE: type, COMPONENT_CLASS: componentClass, MATERIAL_ID: String(MANAGED_STAGE_RVM_MATERIALS.ROOT) },
    primitives: [],
    children
  };
}

function elementNode(record, index) {
  const componentClass = managedStageComponentClass(record);
  const material = managedStageMaterialForClass(componentClass);
  const position = midpoint(point3(record.attributes.APOS, `${record.name}.APOS`), point3(record.attributes.LPOS, `${record.name}.LPOS`));
  const attributes = record.attributes || {};
  return {
    name: record.name,
    reviewName: record.name,
    material,
    position,
    attributes: {
      NAME: record.name,
      TYPE: record.type,
      RAW_TYPE: attributes.RAW_TYPE || record.type,
      DTXR: attributes.DTXR || '',
      FROM_NODE: attributes.FROM_NODE || '',
      TO_NODE: attributes.TO_NODE || '',
      MATERIAL_ID: String(material),
      NOMINAL_SIZE: attributes.DIAMETER || attributes.BORE || '',
      DIAMETER: attributes.DIAMETER || '',
      WALL_THICK: attributes.WALL_THICK || '',
      COMPONENT_CLASS: componentClass,
      ELEMENT_INDEX: String(index + 1),
      SOURCE_ELEMENT_ID: attributes.SOURCE_ELEMENT_ID || record.name,
      SOURCE_FORMAT: attributes.SOURCE_FORMAT || 'inputxml-managed-stage/v1'
    },
    primitives: planManagedStagePrimitives(record),
    children: []
  };
}

function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}
