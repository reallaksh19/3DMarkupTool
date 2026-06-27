import {
  buildPipingContractPipeline as buildBasePipingContractPipeline,
  buildRenderInstructions,
  createFallbackLegacyContract
} from './piping-component-layer.js?v=bust-cache-4';

export const INPUTXML_SAFE_PIPELINE_SCHEMA = 'InputXmlSafePipingContractPipeline.v1';

const INPUTXML_FITTING_CLASSES_WITHOUT_CONTRACT_GEOMETRY = new Set(['BEND', 'ELBOW', 'TEE']);
const DELEGATED_TO_LEGACY_RENDERER = 'DELEGATED_TO_LEGACY_RENDERER';

export function buildInputXmlSafePipingContractPipeline(model, options = {}) {
  const pipeline = buildBasePipingContractPipeline(model, options);
  const delegatedIds = new Set();
  const components = pipeline.components.map((component) => {
    if (!shouldDelegate(component)) return component;
    delegatedIds.add(component.componentId);
    const reason = `${component.componentClass} InputXML record has no contract-grade fitting geometry; legacy renderer remains explicit fallback`;
    return {
      ...component,
      topology: {
        topologyStatus: DELEGATED_TO_LEGACY_RENDERER,
        legacyFromNode: component.topology?.fromNode || component.topology?.legacyFromNode || '',
        legacyToNode: component.topology?.toNode || component.topology?.legacyToNode || ''
      },
      geometryIntent: {
        geometryKind: 'FALLBACK_LEGACY',
        delegatedGeometryKind: component.geometryIntent?.geometryKind || 'UNKNOWN_PLACEHOLDER',
        catalogKey: component.geometryIntent?.catalogKey || 'unknown',
        reason
      },
      renderIntent: {
        ...(component.renderIntent || {}),
        renderRecipeId: 'fallback-legacy.v1',
        fallbackAllowed: true
      },
      metadata: {
        ...(component.metadata || {}),
        topologyResolution: DELEGATED_TO_LEGACY_RENDERER
      },
      diagnostics: Array.from(new Set([...(component.diagnostics || []), reason]))
    };
  });

  if (delegatedIds.size === 0) {
    return {
      ...pipeline,
      schemaVersion: INPUTXML_SAFE_PIPELINE_SCHEMA,
      diagnostics: withSafeDiagnostics(pipeline.diagnostics, [], pipeline.geometryContracts, pipeline.renderInstructions)
    };
  }

  const passthroughContracts = pipeline.geometryContracts.filter((contract) => !delegatedIds.has(contract.componentId));
  const fallbackContracts = components
    .filter((component) => delegatedIds.has(component.componentId))
    .map((component) => createFallbackLegacyContract(component, component.geometryIntent.reason));
  const geometryContracts = [...passthroughContracts, ...fallbackContracts];
  const renderInstructions = buildRenderInstructions(geometryContracts, components, options);

  return {
    ...pipeline,
    schemaVersion: INPUTXML_SAFE_PIPELINE_SCHEMA,
    components,
    geometryContracts,
    renderInstructions,
    diagnostics: withSafeDiagnostics(pipeline.diagnostics, Array.from(delegatedIds), geometryContracts, renderInstructions)
  };
}

function shouldDelegate(component) {
  return INPUTXML_FITTING_CLASSES_WITHOUT_CONTRACT_GEOMETRY.has(component.componentClass)
    && normalizeSourceType(component.sourceRef?.sourceType) === 'INPUTXML';
}

function withSafeDiagnostics(baseDiagnostics = {}, delegatedIds = [], geometryContracts = [], renderInstructions = []) {
  const fallbackRendered = renderInstructions.filter((instruction) => instruction.userData?.fallbackRendered === true).length;
  return {
    ...baseDiagnostics,
    geometryContractsTotal: geometryContracts.length,
    fallbackRendered,
    delegatedTopologyComponents: delegatedIds,
    unrenderableComponents: Array.isArray(baseDiagnostics.unrenderableComponents)
      ? baseDiagnostics.unrenderableComponents.filter((componentId) => !delegatedIds.includes(componentId))
      : [],
    phases: {
      ...(baseDiagnostics.phases || {}),
      geometryContractsTotal: geometryContracts.length,
      renderInstructionsTotal: renderInstructions.length
    }
  };
}

function normalizeSourceType(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}
