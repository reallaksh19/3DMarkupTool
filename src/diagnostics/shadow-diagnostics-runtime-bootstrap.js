import { isShadowDiagnosticsEnabled, getShadowDiagnosticsFlagSource } from './shadow-diagnostics-feature-flag.js';
import { isShadowPreviewEnabled, getShadowPreviewFlagSource } from './shadow-preview-feature-flag.js';
import { buildDiagnosticPanelViewModel, validateDiagnosticPanelViewModel } from './diagnostic-panel-view-model.js';
import { buildControlledPreviewModel, validateControlledPreviewModel } from './controlled-preview-model.js';
import { mountShadowDiagnosticPanel } from '../ui/diagnostic-panel/shadow-diagnostic-panel.js';
import { mountControlledPreview } from '../ui/controlled-preview/controlled-preview-panel.js';

const BRIDGE_NAME = '__3DMT_SHADOW_DIAGNOSTICS__';
const CONTAINER_ID = 'shadowDiagnosticPanelRoot';
const PREVIEW_CONTAINER_ID = 'controlledPreviewPanelRoot';

export async function maybeMountShadowDiagnosticsPanel(options = {}) {
  const locationLike = options.locationLike ?? globalThis?.location;
  const storageLike = options.storageLike ?? globalThis?.localStorage;
  if (!isShadowDiagnosticsEnabled(locationLike, storageLike)) {
    return { schema: 'ShadowDiagnosticsRuntimeMount.v1', mounted: false, previewMounted: false, reason: 'feature flag disabled', heavyPipelineExecuted: false };
  }
  const documentLike = options.documentLike ?? globalThis?.document;
  if (!documentLike || typeof documentLike.createElement !== 'function') {
    return { schema: 'ShadowDiagnosticsRuntimeMount.v1', mounted: false, previewMounted: false, reason: 'document unavailable', heavyPipelineExecuted: false };
  }

  const container = options.container || ensureContainer(documentLike, CONTAINER_ID, 'data-shadow-diagnostics-root');
  const previewEnabled = isShadowPreviewEnabled(locationLike, storageLike);
  const bridge = options.diagnosticState || globalThis?.[BRIDGE_NAME] || null;
  if (!bridge?.diagnosticPreviewModel || !bridge?.diagnosticPreviewAudit) {
    mountShadowDiagnosticPanel(container, null, options);
    if (previewEnabled) mountControlledPreview(options.previewContainer || ensureContainer(documentLike, PREVIEW_CONTAINER_ID, 'data-controlled-preview-root'), null, options);
    return { schema: 'ShadowDiagnosticsRuntimeMount.v1', mounted: true, previewMounted: previewEnabled, reason: previewEnabled ? 'controlled preview unavailable: diagnostic/artifact state not available' : 'no diagnostic model available yet', featureFlagSource: getShadowDiagnosticsFlagSource(locationLike, storageLike), previewFlagSource: getShadowPreviewFlagSource(locationLike, storageLike), heavyPipelineExecuted: false };
  }

  const viewModel = buildDiagnosticPanelViewModel(bridge.diagnosticPreviewModel, bridge.diagnosticPreviewAudit, bridge.rvmByteProof, bridge.rvmByteProofAudit, { featureFlagEnabled: true });
  const validation = validateDiagnosticPanelViewModel(viewModel);
  if (!validation.ok) {
    mountShadowDiagnosticPanel(container, invalidPanelViewModel(bridge, validation.errors), options);
    if (previewEnabled) mountControlledPreview(options.previewContainer || ensureContainer(documentLike, PREVIEW_CONTAINER_ID, 'data-controlled-preview-root'), null, options);
    return { schema: 'ShadowDiagnosticsRuntimeMount.v1', mounted: true, previewMounted: previewEnabled, reason: 'diagnostic view model invalid', featureFlagSource: getShadowDiagnosticsFlagSource(locationLike, storageLike), previewFlagSource: getShadowPreviewFlagSource(locationLike, storageLike), heavyPipelineExecuted: false, errors: validation.errors };
  }
  mountShadowDiagnosticPanel(container, viewModel, options);
  if (!previewEnabled) {
    return { schema: 'ShadowDiagnosticsRuntimeMount.v1', mounted: true, previewMounted: false, reason: 'mounted', featureFlagSource: getShadowDiagnosticsFlagSource(locationLike, storageLike), previewFlagSource: 'disabled', heavyPipelineExecuted: false, graphId: viewModel.graphId };
  }
  const previewContainer = options.previewContainer || ensureContainer(documentLike, PREVIEW_CONTAINER_ID, 'data-controlled-preview-root');
  if (!bridge?.rvmByteProof || !bridge?.rvmByteProofAudit) {
    mountControlledPreview(previewContainer, null, options);
    return { schema: 'ShadowDiagnosticsRuntimeMount.v1', mounted: true, previewMounted: true, reason: 'controlled preview unavailable: diagnostic/artifact state not available', featureFlagSource: getShadowDiagnosticsFlagSource(locationLike, storageLike), previewFlagSource: getShadowPreviewFlagSource(locationLike, storageLike), heavyPipelineExecuted: false, graphId: viewModel.graphId };
  }
  const controlledPreviewModel = buildControlledPreviewModel(viewModel, bridge.diagnosticPreviewModel, bridge.diagnosticPreviewAudit, bridge.rvmByteProof, bridge.rvmByteProofAudit, { featureFlagEnabled: true });
  const previewValidation = validateControlledPreviewModel(controlledPreviewModel);
  if (!previewValidation.ok) {
    mountControlledPreview(previewContainer, null, options);
    return { schema: 'ShadowDiagnosticsRuntimeMount.v1', mounted: true, previewMounted: true, reason: 'controlled preview invalid', featureFlagSource: getShadowDiagnosticsFlagSource(locationLike, storageLike), previewFlagSource: getShadowPreviewFlagSource(locationLike, storageLike), heavyPipelineExecuted: false, graphId: viewModel.graphId, errors: previewValidation.errors };
  }
  mountControlledPreview(previewContainer, controlledPreviewModel, options);
  return { schema: 'ShadowDiagnosticsRuntimeMount.v1', mounted: true, previewMounted: true, reason: 'mounted with controlled preview', featureFlagSource: getShadowDiagnosticsFlagSource(locationLike, storageLike), previewFlagSource: getShadowPreviewFlagSource(locationLike, storageLike), heavyPipelineExecuted: false, graphId: viewModel.graphId };
}

function invalidPanelViewModel(bridge, errors) {
  return { schema: 'DiagnosticPanelViewModel.v1', graphId: bridge.diagnosticPreviewModel?.graphId || '<invalid-diagnostic-model>', mode: 'readOnlyDiagnostics', featureFlagEnabled: true, overallStatus: 'diagnostics-invalid', artifactCards: [], summaryCards: [], blockedGroups: [], deferredGroups: [], straightPipeSubsetCard: { status: 'NOT READY', fullModelReady: false }, sourceTraceRows: [], warnings: [], errors };
}

function ensureContainer(documentLike, id, dataAttribute) {
  let container = typeof documentLike.getElementById === 'function' ? documentLike.getElementById(id) : null;
  if (container) return container;
  container = documentLike.createElement('aside');
  container.id = id;
  container.setAttribute(dataAttribute, 'true');
  const host = documentLike.body || documentLike.documentElement;
  if (!host || typeof host.appendChild !== 'function') throw new Error('document host unavailable');
  host.appendChild(container);
  return container;
}
