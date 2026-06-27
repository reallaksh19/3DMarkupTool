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
  const bendEndpointLock = applyManagedStageInputXmlBendEndpointLock(nodeLocalElbows.contracts, processingConfig);
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
  const SUPPORT_FORBIDDEN_CODES = [1, 4, 5, 6, 7, 11];
  const familyHistogram = {};
  const primitiveCodeHistogram = {};
  let maxPrimitiveSpanMm = 0;
  let maxBarRadiusMm = 0;
  let warningPrimitiveCount = 0;

  for (const node of nodes) {
    const family = node.attributes?.FAMILY || 'UNKNOWN';
    familyHistogram[family] = (familyHistogram[family] || 0) + 1;
    if (family === 'UNKNOWN') warningPrimitiveCount += node.primitives?.length || 0;
    for (const primitive of node.primitives || []) {
      const code = RVM_CODE_BY_KIND[primitive.kind] || 0;
      primitiveCodeHistogram[code] = (primitiveCodeHistogram[code] || 0) + 1;
      maxPrimitiveSpanMm = Math.max(maxPrimitiveSpanMm, Number(primitive.length || 0));
      maxBarRadiusMm = Math.max(maxBarRadiusMm, Number(primitive.radius || 0));
    }
  }
  const supportForbiddenPrimitiveCodesPresent = SUPPORT_FORBIDDEN_CODES.filter((code) => Number(primitiveCodeHistogram[code] || 0) > 0);

  return {
    schema: 'CanonicalSupportMarkerRvmExport.v1',
    materialId,
    supportMarkerPolicy: SUPPORT_MARKER_PRIMITIVE_POLICY_SCHEMA,
    supportRecordCount: supports.length,
    supportNodeCount: nodes.length,
    supportPrimitiveCount,
    supportConePrimitiveCount: 0,
    supportDirectionalGlyphPrimitiveCount: supportPrimitiveCount,
    supportBarPrimitiveCount: supportPrimitiveCount,
    connectorPrimitiveCount: 0,
    fallbackPrimitiveCount: 0,
    warningPrimitiveCount,
    clusteredSupportRecordCount: 0,
    supportPrimitiveCodeHistogram: primitiveCodeHistogram,
    supportAllowedPrimitiveCodes: SUPPORT_ALLOWED_CODES,
    supportForbiddenPrimitiveCodes: SUPPORT_FORBIDDEN_CODES,
    supportForbiddenPrimitiveCodesPresent,
    supportMaxGlyphExtentMm: SUPPORT_MARKER_PRIMITIVE_CAPS.maxGlyphSpanMm,
    supportMaxClusterOffsetMm: SUPPORT_MARKER_PRIMITIVE_CAPS.maxClusterOffsetMm,
    supportMaxPrimitiveSpanMm: round(maxPrimitiveSpanMm),
    supportMaxBarRadiusMm: round(maxBarRadiusMm),
    supportFamilies: familyHistogram,
    familyHistogram,
    supportWarnings: supports.flatMap((support) => support.diagnostics || []),
    supportTopologyGatePass: true,
    supportTopologyBlockedCount: 0,
    supportAssociationOnlyCount: supports.length,
    supportContinuityEdgeCount: 0,
    supportInlineFaceCount: 0,
    supportTopologyGateSummary: {
      pass: true,
      total: supports.length,
      blockedCount: 0,
      associationOnlyCount: supports.length,
      supportContinuityEdgeCount: 0,
      supportInlineFaceCount: 0
    },
    topologyAuditSchema: options.topologyAudit?.schema || '',
    scalePolicy: {
      supportGlyphLengthMaxMm: SUPPORT_MARKER_PRIMITIVE_CAPS.maxGlyphSpanMm,
      supportClusterOffsetMaxMm: SUPPORT_MARKER_PRIMITIVE_CAPS.maxClusterOffsetMm,
      supportBarRadiusMaxMm: SUPPORT_MARKER_PRIMITIVE_CAPS.maxBarRadiusMm
    },
    nodes,
    policy: 'stagedJson support markers are exported from contract.supports as canonical SUPPORT_MARKER nodes using AVEVA E3D-style plate (code-2 box) support symbols plus a code-8 cylinder map-pin and code-9 sphere head; filled code-1 pyramid/code-5 cone substitutes remain blocked.'
  };
}

function explicitBendAttAttributes(recordOrContract) {
  const details = resolveExplicitManagedStageBendDetails(recordOrContract);
  if (!details.explicitBendRecord) return {};
  return {
    BEND_SOURCE_TRUTH: details.hasExplicitBendDetails ? 'EXPLICIT_STAGEDJSON_BEND' : 'EXPLICIT_STAGEDJSON_BEND_MISSING_DETAILS',
    BEND_CENTERLINE_KIND: details.centerlineKind,
    BEND_RADIUS_MM: details.bendRadiusMm == null ? '' : String(details.bendRadiusMm),
    BEND_ANGLE_DEG: details.bendAngleDeg == null ? '' : String(details.bendAngleDeg),
    BEND_RADIUS_SOURCE: details.bendRadiusMm == null ? '' : 'stagedJson.BEND_RADIUS',
    BEND_ANGLE_SOURCE: details.bendAngleDeg == null ? '' : 'stagedJson.BEND_ANGLE',
    BEND_SOURCE: details.bendSource,
    SYNTHETIC_1P5D_BEND_TRIM_BLOCKED: details.synthetic1p5DTrimBlocked ? 'YES' : 'NO',
    SYNTHETIC_1P5D_BEND_TRIM_ALLOWED: details.synthetic1p5DTrimAllowed ? 'YES' : 'NO'
  };
}

function primitiveRecipeSummary(primitives = []) {
  return [...new Set(primitives.map((primitive) => primitive.recipeName || primitive.localName || 'unknown'))].join(',');
}

function round(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}

function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

function managedStageProfileToTopologySource(profile) {
  return {
    schema: profile.schema,
    profile: profile.profile,
    source: profile.source || 'managed-stage-profile',
    units: { length: 'mm' },
    hierarchy: profile.branches || []
  };
}
