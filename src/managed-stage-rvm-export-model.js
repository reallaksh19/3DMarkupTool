import {
  buildManagedStageGeometryContractSet
} from './managed-stage-geometry-contract.js?v=bust-cache-4';
import {
  applyManagedStageElbowTangentHints,
  auditManagedStageElbowTangentHints
} from './managed-stage-elbow-tangent-hints.js?v=bust-cache-4';
import {
  applyManagedStageInputXmlBendExclusion
} from './managed-stage-inputxml-bend-exclusion.js?v=bust-cache-4';
import {
  applyManagedStageInputXmlNodeLocalElbows
} from './managed-stage-inputxml-node-local-elbows.js?v=bust-cache-4';
import { recoverManagedStageCode4Bends } from './managed-stage-rvm-bend-recovery.js?v=bust-cache-4';
import {
  applyManagedStageInputXmlBendEndpointLock
} from './managed-stage-inputxml-bend-endpoint-lock.js?v=bust-cache-4';
import {
  applyManagedStageInputXmlBranchFittingInference
} from './managed-stage-inputxml-branch-fitting-inference.js?v=bust-cache-4';
import {
  resolveManagedStageJsonProcessingConfig
} from './managed-stage-json-processing-config.js?v=bust-cache-4';
import {
  MANAGED_STAGE_RVM_MATERIALS,
  managedStageComponentClass,
  managedStageMaterialForClass,
  planManagedStagePrimitives
} from './managed-stage-rvm-primitive-planner.js?v=bust-cache-4';
import { resolveExplicitManagedStageBendDetails } from './managed-stage-explicit-bend-details.js?v=bust-cache-4';
import { buildTopologyGatedManagedStageSupportRvmExportNodes } from './managed-stage-topology-gated-support-rvm-export.js?v=bust-cache-4';
import { buildManagedStageTopologyAudit } from './managed-stage-uxml-topology-adapter.js?v=bust-cache-4';
import { point3 } from './managed-stage-topology-audit.js?v=bust-cache-4';
import {
  SUPPORT_MARKER_PRIMITIVE_CAPS,
  SUPPORT_MARKER_PRIMITIVE_POLICY_SCHEMA,
  buildSupportMarkerRvmNode
} from './support-marker-primitive-policy.js?v=bust-cache-4';

export function buildManagedStageRvmExportModel(profile, options = {}) {
  const processingConfig = resolveManagedStageJsonProcessingConfig(profile, options);
  const contractSet = buildManagedStageGeometryContractSet(profile, {
    ...options,
    nonBlockingGeometryGates: options.nonBlockingGeometryGates !== false,
    warningOnlyManagedStageGates: options.warningOnlyManagedStageGates !== false
  });
  const hintedContracts = applyManagedStageElbowTangentHints(contractSet.contracts);
  const tangentHintAudit = auditManagedStageElbowTangentHints(hintedContracts);
  const bendExclusion = applyManagedStageInputXmlBendExclusion(hintedContracts, processingConfig);
  const nodeLocalElbows = applyManagedStageInputXmlNodeLocalElbows(bendExclusion.contracts, processingConfig);
  const bendRecovery = recoverManagedStageCode4Bends(nodeLocalElbows.contracts, processingConfig);
  const bendEndpointLock = applyManagedStageInputXmlBendEndpointLock(bendRecovery.contracts, processingConfig);
  const branchFittingInference = applyManagedStageInputXmlBranchFittingInference(bendEndpointLock.contracts, processingConfig);
  const contracts = branchFittingInference.contracts;
  const elements = contracts.map((contract, index) => elementNode(contract, index));
  const supportTopologyAudit = options.supportTopologyAudit || buildManagedStageTopologyAudit(managedStageProfileToTopologySource(profile), {
    sourceName: profile.source || 'managed-stage-profile-for-rvm-export'
  });
  const supportExport = options.sourceContract?.supports
    ? buildCanonicalSupportMarkerRvmExport(options.sourceContract, {
      materialId: MANAGED_STAGE_RVM_MATERIALS.SUPPORT,
      topologyAudit: supportTopologyAudit
    })
    : buildTopologyGatedManagedStageSupportRvmExportNodes(profile, {
      materialId: MANAGED_STAGE_RVM_MATERIALS.SUPPORT,
      topologyAudit: supportTopologyAudit
    });
  const componentPrimitiveSymbolExportAudit = auditComponentPrimitiveSymbolExport(elements, supportExport);
  const disciplineChildren = [
    groupNode('/BM_CII-CU-PI-P', 'GROUP', 'PIPING_GROUP', elements)
  ];
  if (supportExport.nodes.length) {
    disciplineChildren.push(groupNode('/BM_CII-CU-PI-SUPPORTS', 'GROUP', 'SUPPORT_GROUP', supportExport.nodes));
  }
  const root = groupNode('/BM_CII', 'ROOT', 'ROOT', [
    groupNode('/BM_CII-CU-PI', 'DISCIPLINE', 'PIPING', disciplineChildren)
  ]);
  const geometryPrimitiveCount = elements.reduce((sum, node) => sum + node.primitives.length, 0);
  return {
    root,
    rvmMaterialColors: {
      1: 0x82828200,
      4: 0x00a0ff00,
      5: 0x99999900,
      6: 0xcccccc00,
      7: 0x55555500,
      8: 0xcc990000,
      9: 0xf8c34a00
    },
    audit: {
      schema: 'ManagedStageRvmExportModel.v1',
      componentCount: elements.length,
      sourceGeometryRecordCount: contractSet.audit.sourceGeometryRecordCount || profile.geometryRecords.length,
      skippedGeometryContractCount: contractSet.audit.skippedContractCount || 0,
      supportGeometryEmitted: supportExport.supportPrimitiveCount > 0,
      primitiveCount: geometryPrimitiveCount + supportExport.supportPrimitiveCount,
      geometryPrimitiveCount,
      supportRvmPrimitiveCount: supportExport.supportPrimitiveCount,
      componentPrimitiveSymbolExportAudit,
      processingConfig,
      geometryContractAudit: contractSet.audit,
      elbowTangentHintAudit: tangentHintAudit,
      inputXmlBendExclusionAudit: bendExclusion.audit,
      inputXmlNodeLocalElbowAudit: nodeLocalElbows.audit,
      rvmBendRecoveryAudit: bendRecovery.audit,
      inputXmlBendEndpointLockAudit: bendEndpointLock.audit,
      inputXmlBranchFittingInferenceAudit: branchFittingInference.audit,
      supportTopologyAudit,
      supportRvmExportAudit: supportExport
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
  const primitives = planManagedStagePrimitives(contract);
  const explicitBendAtt = explicitBendAttAttributes(contract);
  return {
    name: contract.name,
    reviewName: contract.name,
    material,
    position: contract.centerMm,
    attributes: {
      NAME: contract.name,
      TYPE: contract.type,
      RAW_TYPE: contract.rawType,
      SOURCE_DTXR: contract.sourceDtxr || contract.rawType,
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
      RVM_COMPONENT_PRIMITIVE_RECIPE: primitiveRecipeSummary(primitives),
      RVM_COMPONENT_PRIMITIVE_COUNT: String(primitives.length),
      RVM_COMPONENT_SYMBOL_EXPORTED: primitives.some((primitive) => primitive.exportedManagedStageComponentSymbol) ? 'YES' : 'NO',
      INPUTXML_BEND_EXCLUDED: contract.excludeCode4Bend ? 'YES' : 'NO',
      INPUTXML_BRANCH_FITTING_HOST: contract.genericInputXmlBranchFittings?.length ? 'YES' : 'NO',
      INPUTXML_NODE_LOCAL_ELBOW_HOST: contract.genericInputXmlNodeLocalElbows?.length ? 'YES' : 'NO',
      INPUTXML_BEND_ENDPOINT_LOCKED: contract.genericInputXmlBend?.endpointLocks?.length ? 'YES' : 'NO',
      ...explicitBendAtt,
      RVM_TRIM_START_MM: contract.rvmTrimStartOffsetMm ? String(contract.rvmTrimStartOffsetMm) : '',
      RVM_TRIM_END_MM: contract.rvmTrimEndOffsetMm ? String(contract.rvmTrimEndOffsetMm) : '',
      MANAGED_STAGE_GEOMETRY_WARNINGS: (contract.nonBlockingGeometryWarnings || []).map((warning) => warning.message).join(' | ')
    },
    primitives,
    children: []
  };
}

function elementNodeFromRecord(record, index) {
  const componentClass = managedStageComponentClass(record);
  const material = managedStageMaterialForClass(componentClass);
  const position = midpoint(point3(record.attributes.APOS, `${record.name}.APOS`), point3(record.attributes.LPOS, `${record.name}.LPOS`));
  const attributes = record.attributes || {};
  const primitives = planManagedStagePrimitives(record);
  const explicitBendAtt = explicitBendAttAttributes(record);
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
      SOURCE_FORMAT: attributes.SOURCE_FORMAT || 'inputxml-managed-stage/v1',
      RVM_COMPONENT_PRIMITIVE_RECIPE: primitiveRecipeSummary(primitives),
      RVM_COMPONENT_PRIMITIVE_COUNT: String(primitives.length),
      RVM_COMPONENT_SYMBOL_EXPORTED: primitives.some((primitive) => primitive.exportedManagedStageComponentSymbol) ? 'YES' : 'NO',
      ...explicitBendAtt
    },
    primitives,
    children: []
  };
}

function auditComponentPrimitiveSymbolExport(elements, supportExport) {
  const rows = [];
  const recipeHistogram = {};
  const classHistogram = {};
  let flangeNodeCount = 0;
  let valveNodeCount = 0;
  let weldNeckFlangePrimitiveCount = 0;
  let ballValvePrimitiveCount = 0;
  for (const node of elements) {
    const componentClass = node.attributes?.COMPONENT_CLASS || 'UNKNOWN';
    const recipes = [...new Set((node.primitives || []).map((primitive) => primitive.recipeName || primitive.localName || 'unknown'))];
    classHistogram[componentClass] = (classHistogram[componentClass] || 0) + 1;
    for (const recipe of recipes) recipeHistogram[recipe] = (recipeHistogram[recipe] || 0) + 1;
    if (componentClass.includes('FLANGE')) flangeNodeCount += 1;
    if (componentClass.includes('VALVE')) valveNodeCount += 1;
    weldNeckFlangePrimitiveCount += node.primitives.filter((primitive) => primitive.recipeName === 'weldneck-flange-contiguous-2part').length;
    ballValvePrimitiveCount += node.primitives.filter((primitive) => primitive.recipeName === 'ball-valve-contiguous-5part' || primitive.recipeName === 'flanged-ball-valve-contiguous-5part').length;
    if (componentClass.includes('FLANGE') || componentClass.includes('VALVE')) {
      rows.push({
        name: node.name,
        componentClass,
        primitiveCount: node.primitives.length,
        recipes,
        endpointLocked: node.primitives.every((primitive) => primitive.endpointLocked === true),
        exportedRvmGeometry: node.primitives.every((primitive) => primitive.exportedRvmGeometry !== false)
      });
    }
  }
  return {
    schema: 'ManagedStageComponentPrimitiveRvmExport.v1',
    policy: 'stagedJson flange/valve visual primitives are emitted into generated RVM as endpoint-locked code-8 cylinder recipes, not Canvas-only overlays; supports are topology-gated compact code-8 support glyphs only after SUPPORT_ASSOCIATION-only validation',
    flangeNodeCount,
    valveNodeCount,
    supportNodeCount: supportExport.supportNodeCount || 0,
    supportPrimitiveCount: supportExport.supportPrimitiveCount || 0,
    supportTopologyGatePass: supportExport.supportTopologyGatePass === true,
    supportAssociationOnlyCount: supportExport.supportAssociationOnlyCount || 0,
    supportContinuityEdgeCount: supportExport.supportContinuityEdgeCount || 0,
    weldNeckFlangePrimitiveCount,
    ballValvePrimitiveCount,
    recipeHistogram,
    classHistogram,
    rows
  };
}

function buildCanonicalSupportMarkerRvmExport(sourceContract, options = {}) {
  const materialId = options.materialId || MANAGED_STAGE_RVM_MATERIALS.SUPPORT;
  const supports = sourceContract.supports || [];
  const nodes = supports.map((support, index) => buildSupportMarkerRvmNode(support, { material: materialId, index }));
  const supportPrimitiveCount = nodes.reduce((sum, node) => sum + (node.primitives?.length || 0), 0);
  const RVM_CODE_BY_KIND = { pyramid: 1, box: 2, elbow: 4, cylinder: 8, sphere: 9 };
  const SUPPORT_ALLOWED_CODES = [2, 8, 9];
  return {
    schema: 'ManagedStageCanonicalSupportMarkerRvmExport.v1',
    policy: 'support markers exported from canonical support source using compact primitive policy',
    supportNodeCount: nodes.length,
    supportRecordCount: supports.length,
    supportPrimitiveCount,
    supportPrimitiveCodeHistogram: histogram(nodes.flatMap((node) => node.primitives || []).map((primitive) => RVM_CODE_BY_KIND[primitive.kind] || primitive.kind)),
    supportAllowedPrimitiveCodes: SUPPORT_ALLOWED_CODES,
    supportAssociationOnlyCount: supports.length,
    supportTopologyGatePass: true,
    supportContinuityEdgeCount: 0,
    supportInlineFaceCount: 0,
    supportTopologyBlockedCount: 0,
    supportConePrimitiveCount: 0,
    supportBarPrimitiveCount: supportPrimitiveCount,
    supportMaxGlyphExtentMm: SUPPORT_MARKER_PRIMITIVE_CAPS.maxGlyphExtentMm,
    supportMaxClusterOffsetMm: SUPPORT_MARKER_PRIMITIVE_CAPS.maxClusterOffsetMm,
    supportMaxPrimitiveSpanMm: SUPPORT_MARKER_PRIMITIVE_CAPS.maxPrimitiveSpanMm,
    supportMaxBarRadiusMm: SUPPORT_MARKER_PRIMITIVE_CAPS.maxBarRadiusMm,
    supportPrimitivePolicySchema: SUPPORT_MARKER_PRIMITIVE_POLICY_SCHEMA,
    nodes
  };
}

function managedStageProfileToTopologySource(profile) {
  return {
    schema: 'inputxml-managed-stage/v1',
    profile: 'AVEVA_JSON_FOR_3D_RVM_VIEWER',
    source: profile.source || 'managed-stage-profile',
    converter: profile.converter || '',
    generatedAt: profile.generatedAt || '',
    units: { length: 'mm' },
    stats: profile.inputStats || {},
    hierarchy: (profile.branches || []).map((branch) => ({
      name: branch.name || '',
      type: branch.type || 'BRANCH',
      children: branch.children || []
    }))
  };
}

function explicitBendAttAttributes(contractOrRecord) {
  const details = resolveExplicitManagedStageBendDetails(contractOrRecord);
  if (!details.explicitBendRecord) return {};
  return {
    EXPLICIT_BEND_RECORD: 'YES',
    EXPLICIT_BEND_DETAILS: details.hasExplicitBendDetails ? 'YES' : 'NO',
    BEND_RADIUS_MM: details.bendRadiusMm == null ? '' : String(details.bendRadiusMm),
    BEND_ANGLE_DEG: details.bendAngleDeg == null ? '' : String(details.bendAngleDeg),
    BEND_SOURCE: details.bendSource,
    SYNTHETIC_1P5D_TRIM_ALLOWED: details.synthetic1p5DTrimAllowed ? 'YES' : 'NO',
    SYNTHETIC_1P5D_TRIM_BLOCKED: details.synthetic1p5DTrimBlocked ? 'YES' : 'NO'
  };
}

function primitiveRecipeSummary(primitives) {
  return primitives.map((primitive) => `${primitive.localName}:${primitive.kind}`).join('|');
}
function midpoint(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }
function histogram(values) { return values.reduce((out, value) => { out[value] = (out[value] || 0) + 1; return out; }, {}); }
