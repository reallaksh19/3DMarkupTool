import {
  buildManagedStageGeometryContractSet
} from './managed-stage-geometry-contract.js';
import {
  applyManagedStageElbowTangentHints,
  auditManagedStageElbowTangentHints
} from './managed-stage-elbow-tangent-hints.js';
import {
  applyManagedStageInputXmlBendExclusion
} from './managed-stage-inputxml-bend-exclusion.js';
import {
  applyManagedStageInputXmlBendEndpointLock
} from './managed-stage-inputxml-bend-endpoint-lock.js';
import {
  applyManagedStageInputXmlBranchFittingInference
} from './managed-stage-inputxml-branch-fitting-inference.js';
import {
  resolveManagedStageJsonProcessingConfig
} from './managed-stage-json-processing-config.js';
import {
  MANAGED_STAGE_RVM_MATERIALS,
  managedStageComponentClass,
  managedStageMaterialForClass,
  planManagedStagePrimitives
} from './managed-stage-rvm-primitive-planner.js';
import { point3 } from './managed-stage-topology-audit.js';

export function buildManagedStageRvmExportModel(profile, options = {}) {
  const processingConfig = resolveManagedStageJsonProcessingConfig(profile, options);
  const contractSet = buildManagedStageGeometryContractSet(profile);
  const hintedContracts = applyManagedStageElbowTangentHints(contractSet.contracts);
  const tangentHintAudit = auditManagedStageElbowTangentHints(hintedContracts);
  const bendExclusion = applyManagedStageInputXmlBendExclusion(hintedContracts, processingConfig);
  const bendEndpointLock = applyManagedStageInputXmlBendEndpointLock(bendExclusion.contracts, processingConfig);
  const branchFittingInference = applyManagedStageInputXmlBranchFittingInference(bendEndpointLock.contracts, processingConfig);
  const contracts = branchFittingInference.contracts;
  const elements = contracts.map((contract, index) => elementNode(contract, index));
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
      primitiveCount: elements.reduce((sum, node) => sum + node.primitives.length, 0),
      processingConfig,
      geometryContractAudit: contractSet.audit,
      elbowTangentHintAudit: tangentHintAudit,
      inputXmlBendExclusionAudit: bendExclusion.audit,
      inputXmlBendEndpointLockAudit: bendEndpointLock.audit,
      inputXmlBranchFittingInferenceAudit: branchFittingInference.audit
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

function elementNode(recordOrContract, index) {
  if (recordOrContract?.schema === 'ManagedStageGeometryContract.v1') return elementNodeFromContract(recordOrContract, index);
  return elementNodeFromRecord(recordOrContract, index);
}

function elementNodeFromContract(contract, index) {
  const componentClass = managedStageComponentClass(contract);
  const material = managedStageMaterialForClass(componentClass);
  return {
    name: contract.name,
    reviewName: contract.name,
    material,
    position: contract.centerMm,
    attributes: {
      NAME: contract.name,
      TYPE: contract.type,
      RAW_TYPE: contract.rawType,
      DTXR: contract.dtxr,
      FROM_NODE: contract.fromNode,
      TO_NODE: contract.toNode,
      MATERIAL_ID: String(material),
      NOMINAL_SIZE: `${contract.diameterMm}mm`,
      DIAMETER: `${contract.diameterMm}mm`,
      WALL_THICK: contract.wallThickMm ? `${contract.wallThickMm}mm` : '',
      COMPONENT_CLASS: componentClass,
      ELEMENT_INDEX: String(index + 1),
      SOURCE_ELEMENT_ID: contract.sourceElementId || contract.elementId || contract.name,
      SOURCE_FORMAT: contract.sourceFormat || 'inputxml-managed-stage/v1',
      INPUTXML_BEND_EXCLUDED: contract.excludeCode4Bend ? 'YES' : 'NO',
      INPUTXML_BRANCH_FITTING_HOST: contract.genericInputXmlBranchFittings?.length ? 'YES' : 'NO',
      INPUTXML_BEND_ENDPOINT_LOCKED: contract.genericInputXmlBend?.endpointLocks?.length ? 'YES' : 'NO',
      RVM_TRIM_START_MM: contract.rvmTrimStartOffsetMm ? String(contract.rvmTrimStartOffsetMm) : '',
      RVM_TRIM_END_MM: contract.rvmTrimEndOffsetMm ? String(contract.rvmTrimEndOffsetMm) : ''
    },
    primitives: planManagedStagePrimitives(contract),
    children: []
  };
}

function elementNodeFromRecord(record, index) {
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
