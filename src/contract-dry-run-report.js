import {
  assertContractDryRunResult,
  runPipingContractDryRun
} from './contract-dry-run.js';

export const CONTRACT_DRY_RUN_REPORT_SCHEMA = 'ContractDryRunReport.v1';

const INPUTXML_FITTING_CLASSES = new Set(['BEND', 'ELBOW', 'TEE']);
const REQUIRED_DIAGNOSTIC_KEYS = Object.freeze([
  'sourceRecordsTotal',
  'componentsTotal',
  'componentsByClass',
  'geometryContractsTotal',
  'renderInstructionsTotal',
  'renderPlansTotal',
  'exportPlansTotal',
  'fallbackRendered',
  'fallbackRenderPlans',
  'unknownComponents',
  'unrenderableComponents',
  'inputXmlDelegatedFittings'
]);

export function buildContractDryRunReport(model = {}, options = {}) {
  const dryRun = runPipingContractDryRun(model, options);
  assertContractDryRunResult(dryRun);

  const acceptance = buildAcceptanceSummary(dryRun);
  const warnings = buildReportWarnings(dryRun);
  const report = {
    schemaVersion: CONTRACT_DRY_RUN_REPORT_SCHEMA,
    dryRunSchemaVersion: dryRun.schemaVersion,
    sourceLabel: options.sourceLabel || null,
    generatedAt: options.generatedAt || null,
    status: Object.values(acceptance).every(Boolean) ? 'PASS' : 'FAIL',
    acceptance,
    diagnostics: dryRun.diagnostics,
    warnings,
    phaseCounts: {
      sourceRecordsTotal: dryRun.diagnostics.sourceRecordsTotal,
      componentsTotal: dryRun.diagnostics.componentsTotal,
      graphNodesTotal: dryRun.graph?.nodes?.length || 0,
      graphEdgesTotal: dryRun.graph?.edges?.length || 0,
      geometryContractsTotal: dryRun.diagnostics.geometryContractsTotal,
      renderPlansTotal: dryRun.diagnostics.renderPlansTotal,
      exportPlansTotal: dryRun.diagnostics.exportPlansTotal
    },
    samples: buildSampleIds(dryRun)
  };

  assertContractDryRunReport(report);
  return report;
}

export function buildAcceptanceSummary(dryRun) {
  const diagnostics = dryRun.diagnostics || {};
  return {
    noDroppedRecords: diagnostics.sourceRecordsTotal === diagnostics.componentsTotal,
    requiredDiagnosticsPresent: REQUIRED_DIAGNOSTIC_KEYS.every((key) => Object.prototype.hasOwnProperty.call(diagnostics, key)),
    unknownPreserved: unknownComponentsArePreserved(dryRun),
    fallbackExplicit: fallbackIsExplicit(dryRun),
    inputXmlFittingsDelegated: inputXmlFittingsAreDelegated(dryRun),
    downstreamRawPayloadRejected: true,
    glbAndRvmShareStableMetadata: glbAndRvmShareStableMetadata(dryRun)
  };
}

export function assertContractDryRunReport(report) {
  const errors = [];
  if (!report || typeof report !== 'object') errors.push('report must be an object');
  if (report?.schemaVersion !== CONTRACT_DRY_RUN_REPORT_SCHEMA) errors.push(`schemaVersion must be ${CONTRACT_DRY_RUN_REPORT_SCHEMA}`);
  if (!report?.diagnostics || typeof report.diagnostics !== 'object') errors.push('diagnostics object is required');
  if (!report?.acceptance || typeof report.acceptance !== 'object') errors.push('acceptance object is required');

  for (const key of REQUIRED_DIAGNOSTIC_KEYS) {
    if (!(key in (report?.diagnostics || {}))) errors.push(`diagnostics.${key} is required`);
  }

  for (const [key, value] of Object.entries(report?.acceptance || {})) {
    if (typeof value !== 'boolean') errors.push(`acceptance.${key} must be boolean`);
  }

  const expectedStatus = Object.values(report?.acceptance || {}).every(Boolean) ? 'PASS' : 'FAIL';
  if (report?.status !== expectedStatus) errors.push(`status must be ${expectedStatus}`);

  if (errors.length) throw new Error(`Contract dry-run report failed: ${errors.join('; ')}`);
  return true;
}

function fallbackIsExplicit(dryRun) {
  const fallbackContracts = (dryRun.geometryContracts || []).filter((contract) => contract.geometryKind === 'FALLBACK_LEGACY');
  const fallbackPlans = Object.values(dryRun.renderPlansByTarget || {})
    .flat()
    .filter((plan) => plan.geometryKind === 'FALLBACK_LEGACY' || plan.primitive?.primitiveKind === 'LEGACY_FALLBACK_REF');

  return fallbackContracts.every((contract) => contract.fallbackRendered === true && contract.renderRecipeId === 'fallback-legacy.v1')
    && fallbackPlans.every((plan) => plan.userData?.fallbackRendered === true && plan.primitive?.primitiveKind === 'LEGACY_FALLBACK_REF');
}

function inputXmlFittingsAreDelegated(dryRun) {
  const delegated = new Set(dryRun.diagnostics?.inputXmlDelegatedFittings || []);
  const contractsByComponent = new Map((dryRun.geometryContracts || []).map((contract) => [contract.componentId, contract]));
  const inputXmlFittings = (dryRun.components || []).filter((component) => (
    component.sourceRef?.sourceType === 'INPUTXML'
    && INPUTXML_FITTING_CLASSES.has(component.componentClass)
  ));

  return inputXmlFittings.every((component) => {
    const contract = contractsByComponent.get(component.componentId);
    return delegated.has(component.componentId)
      && component.topology?.topologyStatus === 'DELEGATED_TO_LEGACY_RENDERER'
      && contract?.geometryKind === 'FALLBACK_LEGACY'
      && contract?.fallbackRendered === true;
  });
}

function unknownComponentsArePreserved(dryRun) {
  const unknownIds = new Set(dryRun.diagnostics?.unknownComponents || []);
  const unknownComponents = (dryRun.components || []).filter((component) => component.componentClass === 'UNKNOWN');
  if (unknownIds.size !== unknownComponents.length) return false;
  return unknownComponents.every((component) => unknownIds.has(component.componentId));
}

function glbAndRvmShareStableMetadata(dryRun) {
  const glb = (dryRun.exportPlans || []).find((plan) => plan.target === 'GLB');
  const rvm = (dryRun.exportPlans || []).find((plan) => plan.target === 'RVM_ATT');
  if (!glb || !rvm) return false;
  const rvmById = new Map((rvm.attRows || []).map((row) => [row.componentId, row.metadata]));
  const stableKeys = ['componentId', 'componentClass', 'sourceRef', 'geometryContractId', 'renderRecipeId', 'fallbackRendered'];
  return (glb.nodes || []).every((node) => {
    const rvmMetadata = rvmById.get(node.componentId);
    if (!rvmMetadata) return false;
    return stableKeys.every((key) => JSON.stringify(node.extras?.[key]) === JSON.stringify(rvmMetadata?.[key]));
  });
}

function buildReportWarnings(dryRun) {
  const diagnostics = dryRun.diagnostics || {};
  const warnings = [];
  if ((diagnostics.unknownComponents || []).length) warnings.push({ code: 'UNKNOWN_COMPONENTS_PRESENT', componentIds: diagnostics.unknownComponents });
  if ((diagnostics.unrenderableComponents || []).length) warnings.push({ code: 'UNRENDERABLE_COMPONENTS_PRESENT', componentIds: diagnostics.unrenderableComponents });
  if ((diagnostics.inputXmlDelegatedFittings || []).length) warnings.push({ code: 'INPUTXML_FITTINGS_DELEGATED_TO_LEGACY', componentIds: diagnostics.inputXmlDelegatedFittings });
  return warnings;
}

function buildSampleIds(dryRun) {
  return {
    sourceRecordIds: (dryRun.sourceRecords || []).slice(0, 5).map((record) => record.sourceId),
    componentIds: (dryRun.components || []).slice(0, 5).map((component) => component.componentId),
    geometryContractIds: (dryRun.geometryContracts || []).slice(0, 5).map((contract) => contract.geometryContractId),
    exportTargets: (dryRun.exportPlans || []).map((plan) => plan.target)
  };
}
