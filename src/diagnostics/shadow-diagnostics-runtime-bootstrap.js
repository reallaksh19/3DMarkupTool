import { isShadowDiagnosticsEnabled, getShadowDiagnosticsFlagSource } from './shadow-diagnostics-feature-flag.js';
import { buildDiagnosticPanelViewModel, validateDiagnosticPanelViewModel } from './diagnostic-panel-view-model.js';
import { mountShadowDiagnosticPanel } from '../ui/diagnostic-panel/shadow-diagnostic-panel.js';

const BRIDGE_NAME = '__3DMT_SHADOW_DIAGNOSTICS__';
const CONTAINER_ID = 'shadowDiagnosticPanelRoot';

export async function maybeMountShadowDiagnosticsPanel(options = {}) {
  const locationLike = options.locationLike ?? globalThis?.location;
  const storageLike = options.storageLike ?? globalThis?.localStorage;
  if (!isShadowDiagnosticsEnabled(locationLike, storageLike)) {
    return { schema: 'ShadowDiagnosticsRuntimeMount.v1', mounted: false, reason: 'feature flag disabled', heavyPipelineExecuted: false };
  }
  const documentLike = options.documentLike ?? globalThis?.document;
  if (!documentLike || typeof documentLike.createElement !== 'function') {
    return { schema: 'ShadowDiagnosticsRuntimeMount.v1', mounted: false, reason: 'document unavailable', heavyPipelineExecuted: false };
  }

  const container = options.container || ensureContainer(documentLike);
  const bridge = options.diagnosticState || globalThis?.[BRIDGE_NAME] || null;
  if (!bridge?.diagnosticPreviewModel || !bridge?.diagnosticPreviewAudit) {
    mountShadowDiagnosticPanel(container, null, options);
    return { schema: 'ShadowDiagnosticsRuntimeMount.v1', mounted: true, reason: 'no diagnostic model available yet', featureFlagSource: getShadowDiagnosticsFlagSource(locationLike, storageLike), heavyPipelineExecuted: false };
  }

  const viewModel = buildDiagnosticPanelViewModel(
    bridge.diagnosticPreviewModel,
    bridge.diagnosticPreviewAudit,
    bridge.rvmByteProof,
    bridge.rvmByteProofAudit,
    { featureFlagEnabled: true }
  );
  const validation = validateDiagnosticPanelViewModel(viewModel);
  if (!validation.ok) {
    mountShadowDiagnosticPanel(container, {
      schema: 'DiagnosticPanelViewModel.v1',
      graphId: bridge.diagnosticPreviewModel?.graphId || '<invalid-diagnostic-model>',
      mode: 'readOnlyDiagnostics',
      featureFlagEnabled: true,
      overallStatus: 'diagnostics-invalid',
      artifactCards: [],
      summaryCards: [],
      blockedGroups: [],
      deferredGroups: [],
      straightPipeSubsetCard: { status: 'NOT READY', fullModelReady: false },
      sourceTraceRows: [],
      warnings: [],
      errors: validation.errors
    }, options);
    return { schema: 'ShadowDiagnosticsRuntimeMount.v1', mounted: true, reason: 'diagnostic view model invalid', featureFlagSource: getShadowDiagnosticsFlagSource(locationLike, storageLike), heavyPipelineExecuted: false, errors: validation.errors };
  }
  mountShadowDiagnosticPanel(container, viewModel, options);
  return { schema: 'ShadowDiagnosticsRuntimeMount.v1', mounted: true, reason: 'mounted', featureFlagSource: getShadowDiagnosticsFlagSource(locationLike, storageLike), heavyPipelineExecuted: false, graphId: viewModel.graphId };
}

function ensureContainer(documentLike) {
  let container = typeof documentLike.getElementById === 'function' ? documentLike.getElementById(CONTAINER_ID) : null;
  if (container) return container;
  container = documentLike.createElement('aside');
  container.id = CONTAINER_ID;
  container.setAttribute('data-shadow-diagnostics-root', 'true');
  const host = documentLike.body || documentLike.documentElement;
  if (!host || typeof host.appendChild !== 'function') throw new Error('document host unavailable');
  host.appendChild(container);
  return container;
}
