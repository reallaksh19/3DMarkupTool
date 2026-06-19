import {
  buildPipingContractPipeline,
  buildRenderInstructions
} from './piping-component-layer.js';
import { buildRenderPlans, rejectRawSourcePayload } from './render-plan-adapter.js';
import { buildExportPlans, assertExportPlan } from './export-plan-adapter.js';

export const CONTRACT_DRY_RUN_SCHEMA = 'ContractDryRun.v1';
export const DEFAULT_RENDER_TARGETS = Object.freeze(['VIEWER', 'GLB', 'RVM_ATT']);
export const DEFAULT_EXPORT_TARGETS = Object.freeze(['GLB', 'RVM_ATT']);

export function runPipingContractDryRun(model = {}, options = {}) {
  const renderTargets = normalizeList(options.renderTargets || DEFAULT_RENDER_TARGETS);
  const exportTargets = normalizeList(options.exportTargets || DEFAULT_EXPORT_TARGETS);
  const primaryTarget = options.primaryTarget || renderTargets[0] || 'VIEWER';

  const pipeline = buildPipingContractPipeline(model, {
    ...options,
    target: primaryTarget
  });

  const renderInstructionsByTarget = {};
  const renderPlansByTarget = {};

  for (const target of renderTargets) {
    const renderInstructions = target === primaryTarget
      ? pipeline.renderInstructions
      : buildRenderInstructions(pipeline.geometryContracts, pipeline.components, { ...options, target });

    const renderPlans = buildRenderPlans(pipeline.geometryContracts, renderInstructions, {
      ...options,
      knownComponents: pipeline.components
    });

    renderInstructionsByTarget[target] = renderInstructions;
    renderPlansByTarget[target] = renderPlans;
  }

  const exportRenderPlans = exportTargets.flatMap((target) => renderPlansByTarget[target] || []);
  const exportPlans = buildExportPlans(exportRenderPlans, {
    ...options,
    targets: exportTargets
  });
  exportPlans.forEach(assertExportPlan);

  const result = {
    schemaVersion: CONTRACT_DRY_RUN_SCHEMA,
    sourceRecords: pipeline.sourceRecords,
    components: pipeline.components,
    graph: pipeline.graph,
    geometryContracts: pipeline.geometryContracts,
    renderInstructionsByTarget,
    renderPlansByTarget,
    exportPlans,
    diagnostics: buildDryRunDiagnostics(pipeline, renderInstructionsByTarget, renderPlansByTarget, exportPlans)
  };

  assertContractDryRunResult(result);
  return result;
}

export function buildDryRunDiagnostics(pipeline, renderInstructionsByTarget, renderPlansByTarget, exportPlans) {
  const sourceRecords = pipeline.sourceRecords || [];
  const components = pipeline.components || [];
  const geometryContracts = pipeline.geometryContracts || [];
  const allRenderInstructions = Object.values(renderInstructionsByTarget || {}).flat();
  const allRenderPlans = Object.values(renderPlansByTarget || {}).flat();
  const fallbackContracts = geometryContracts.filter((contract) => contract.geometryKind === 'FALLBACK_LEGACY' || contract.fallbackRendered === true);
  const fallbackPlans = allRenderPlans.filter((plan) => plan.primitive?.primitiveKind === 'LEGACY_FALLBACK_REF' || plan.userData?.fallbackRendered === true);
  const unknownComponents = components.filter((component) => component.componentClass === 'UNKNOWN').map((component) => component.componentId);
  const contractedComponentIds = new Set(geometryContracts.map((contract) => contract.componentId));
  const unrenderableComponents = components
    .filter((component) => !contractedComponentIds.has(component.componentId))
    .map((component) => component.componentId);

  return {
    sourceRecordsTotal: sourceRecords.length,
    componentsTotal: components.length,
    componentsByClass: countBy(components, 'componentClass'),
    geometryContractsTotal: geometryContracts.length,
    renderInstructionsTotal: allRenderInstructions.length,
    renderPlansTotal: allRenderPlans.length,
    exportPlansTotal: exportPlans.length,
    fallbackRendered: fallbackContracts.length,
    fallbackRenderPlans: fallbackPlans.length,
    unknownComponents,
    unrenderableComponents,
    inputXmlDelegatedFittings: components
      .filter((component) => component.topology?.topologyStatus === 'DELEGATED_TO_LEGACY_RENDERER')
      .map((component) => component.componentId),
    renderPlansByTarget: Object.fromEntries(
      Object.entries(renderPlansByTarget || {}).map(([target, plans]) => [target, {
        renderPlansTotal: plans.length,
        fallbackRendered: plans.filter((plan) => plan.userData?.fallbackRendered === true).length,
        byPrimitiveKind: countBy(plans.map((plan) => ({ primitiveKind: plan.primitive?.primitiveKind || 'UNKNOWN_PRIMITIVE' })), 'primitiveKind')
      }])
    ),
    exportPlansByTarget: Object.fromEntries((exportPlans || []).map((plan) => [plan.target, plan.counts]))
  };
}

export function assertContractDryRunResult(result) {
  const errors = [];
  if (!result || typeof result !== 'object') errors.push('result must be an object');
  if (result?.schemaVersion !== CONTRACT_DRY_RUN_SCHEMA) errors.push(`schemaVersion must be ${CONTRACT_DRY_RUN_SCHEMA}`);

  const diagnostics = result?.diagnostics || {};
  for (const key of [
    'sourceRecordsTotal',
    'componentsTotal',
    'componentsByClass',
    'geometryContractsTotal',
    'renderInstructionsTotal',
    'renderPlansTotal',
    'fallbackRendered',
    'unknownComponents',
    'unrenderableComponents'
  ]) {
    if (!(key in diagnostics)) errors.push(`diagnostics.${key} is required`);
  }

  if (!Array.isArray(diagnostics.unknownComponents)) errors.push('diagnostics.unknownComponents must be an array');
  if (!Array.isArray(diagnostics.unrenderableComponents)) errors.push('diagnostics.unrenderableComponents must be an array');

  for (const [target, plans] of Object.entries(result?.renderPlansByTarget || {})) {
    try {
      rejectRawSourcePayload(plans, `RenderPlan dry-run target ${target}`);
    } catch (error) {
      errors.push(error.message);
    }
  }

  for (const plan of result?.exportPlans || []) {
    try {
      assertExportPlan(plan);
      rejectRawSourcePayload(plan, `ExportPlan dry-run target ${plan.target}`);
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (errors.length) throw new Error(`Contract dry-run failed: ${errors.join('; ')}`);
  return true;
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item?.[key] || 'UNKNOWN';
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function normalizeList(value) {
  return Array.isArray(value) ? value : [value];
}
