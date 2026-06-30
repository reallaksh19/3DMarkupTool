const VIEW_MODEL_SCHEMA = 'DiagnosticPanelViewModel.v1';
const MODE = 'readOnlyDiagnostics';

export function buildDiagnosticPanelViewModel(diagnosticPreviewModel, diagnosticPreviewAudit, rvmByteProof = null, rvmByteProofAudit = null, options = {}) {
  const errors = [];
  const warnings = [];
  if (!diagnosticPreviewModel || diagnosticPreviewModel.schema !== 'DiagnosticCanvasPreviewModel.v1') errors.push('DiagnosticCanvasPreviewModel.v1 is required');
  if (!diagnosticPreviewAudit || diagnosticPreviewAudit.schema !== 'DiagnosticCanvasPreviewAudit.v1') errors.push('DiagnosticCanvasPreviewAudit.v1 is required');
  if (diagnosticPreviewAudit?.ok !== true) errors.push('DiagnosticCanvasPreviewAudit.ok must be true');
  if (rvmByteProof && rvmByteProof.schema !== 'RvmTestArtifactByteProof.v1') errors.push('RvmTestArtifactByteProof.v1 expected when byte proof is provided');
  if (rvmByteProofAudit && rvmByteProofAudit.schema !== 'RvmTestArtifactByteProofAudit.v1') errors.push('RvmTestArtifactByteProofAudit.v1 expected when byte proof audit is provided');
  if (rvmByteProofAudit && rvmByteProofAudit.ok !== true) errors.push('RvmTestArtifactByteProofAudit.ok must be true when provided');

  const previewItems = Array.isArray(diagnosticPreviewModel?.previewItems) ? diagnosticPreviewModel.previewItems : [];
  const traceRows = Array.isArray(diagnosticPreviewModel?.sourceTrace) ? diagnosticPreviewModel.sourceTrace : [];
  const blockedFlanges = previewItems.filter((item) => item.family === 'flange' && item.diagnosticKind === 'blockedComponent');
  const blockedValves = previewItems.filter((item) => item.family === 'valve' && item.diagnosticKind === 'blockedComponent');
  const blockedBends = previewItems.filter((item) => item.family === 'elbow' && item.diagnosticKind === 'blockedComponent');
  const deferredSupports = previewItems.filter((item) => item.family === 'support' && item.diagnosticKind === 'deferredSupport');
  const straightPipes = previewItems.filter((item) => item.diagnosticKind === 'straightPipeWriterPlan');
  const rvmSubsetReady = rvmByteProofAudit?.rvmStraightPipeSubsetArtifactReady === true || rvmByteProof?.artifactReady === true;
  const rvmFullReady = rvmByteProofAudit?.rvmFullModelArtifactReady === true;
  const blockedCount = blockedFlanges.length + blockedValves.length + blockedBends.length;
  const supportCount = deferredSupports.length;

  if (!rvmByteProof || !rvmByteProofAudit) warnings.push('RVM byte proof is not available to the diagnostic panel.');
  if (blockedCount || supportCount) warnings.push('RVM full model remains not ready because blocked/deferred content remains.');

  return {
    schema: VIEW_MODEL_SCHEMA,
    graphId: diagnosticPreviewModel?.graphId || options.graphId || '<unknown-graph>',
    mode: MODE,
    featureFlagEnabled: options.featureFlagEnabled === true,
    overallStatus: rvmSubsetReady && !rvmFullReady ? 'partial-rvm-subset-ready' : 'diagnostics-only',
    artifactCards: [
      { key: 'rvmStraightPipeSubset', title: 'RVM straight-pipe subset byte proof', status: rvmSubsetReady ? 'READY' : 'NOT READY', ready: rvmSubsetReady, reason: rvmSubsetReady ? 'Straight-pipe CYLINDER/code8 byte proof is available.' : 'Straight-pipe byte proof is not available.' },
      { key: 'rvmFullModel', title: 'RVM full model', status: rvmFullReady ? 'READY' : 'NOT READY', ready: rvmFullReady, reason: rvmFullReady ? 'Full model artifact is ready.' : 'blocked/deferred content remains' },
      { key: 'att', title: 'ATT', status: 'BLOCKED', ready: false, reason: 'ATT writer bridge remains blocked.' },
      { key: 'glb', title: 'GLB', status: 'BLOCKED', ready: false, reason: 'GLB artifact bridge remains blocked.' }
    ],
    summaryCards: [
      { key: 'straightPipeCount', label: 'Straight-pipe subset ready count', value: straightPipes.length },
      { key: 'blockedFlangeCount', label: 'Flanges blocked', value: blockedFlanges.length },
      { key: 'blockedValveCount', label: 'Valves blocked', value: blockedValves.length },
      { key: 'blockedBendCount', label: 'Bends blocked', value: blockedBends.length },
      { key: 'deferredSupportCount', label: 'Supports deferred', value: deferredSupports.length },
      { key: 'sourceTraceRows', label: 'Source trace rows', value: traceRows.length }
    ],
    blockedGroups: [
      { key: 'flange', label: 'Flanges blocked', count: blockedFlanges.length, rows: blockedFlanges.map(toGroupRow) },
      { key: 'valve', label: 'Valves blocked', count: blockedValves.length, rows: blockedValves.map(toGroupRow) },
      { key: 'bend', label: 'Bends blocked', count: blockedBends.length, rows: blockedBends.map(toGroupRow) }
    ],
    deferredGroups: [
      { key: 'support', label: 'Supports deferred', count: deferredSupports.length, rows: deferredSupports.map(toGroupRow) }
    ],
    straightPipeSubsetCard: {
      key: 'straightPipeSubset',
      ready: rvmSubsetReady,
      status: rvmSubsetReady ? 'READY' : 'NOT READY',
      count: straightPipes.length,
      fullModelReady: rvmFullReady,
      artifactByteLength: Number(rvmByteProof?.artifactByteLength || 0),
      checksumPresent: typeof rvmByteProof?.checksumSha256 === 'string' && /^[0-9a-f]{64}$/.test(rvmByteProof.checksumSha256)
    },
    sourceTraceRows: traceRows.map((row) => ({
      sourceItemId: row.sourceItemId,
      family: row.family || 'pipe',
      type: row.type || '',
      bindingStatus: row.bindingStatus || '',
      geometryStatus: row.geometryStatus || '',
      primitiveStatus: row.primitiveStatus || '',
      exportStatus: row.exportStatus || '',
      writerStatus: row.writerStatus || '',
      artifactStatus: row.artifactStatus || '',
      sourceRef: row.sourceRef || ''
    })),
    warnings,
    errors
  };
}

export function validateDiagnosticPanelViewModel(viewModel) {
  const errors = [];
  if (!viewModel || typeof viewModel !== 'object') errors.push('viewModel must be an object');
  if (viewModel?.schema !== VIEW_MODEL_SCHEMA) errors.push(`schema must be ${VIEW_MODEL_SCHEMA}`);
  if (viewModel?.mode !== MODE) errors.push(`mode must be ${MODE}`);
  if (!viewModel?.graphId) errors.push('graphId is required');
  for (const key of ['artifactCards', 'summaryCards', 'blockedGroups', 'deferredGroups', 'sourceTraceRows', 'warnings', 'errors']) {
    if (!Array.isArray(viewModel?.[key])) errors.push(`${key} array is required`);
  }
  const forbiddenHits = collectPanelForbiddenFieldHits(viewModel);
  errors.push(...forbiddenHits.map((hit) => `forbidden field ${hit.field} at ${hit.path}`));
  return { schema: 'DiagnosticPanelViewModelValidation.v1', ok: errors.length === 0, errorCount: errors.length, errors, forbiddenFieldCount: forbiddenHits.length, forbiddenFields: forbiddenHits };
}

export function collectPanelForbiddenFieldHits(value, path = '$', hits = []) {
  const forbidden = ['geometry', 'mesh', 'meshGeometry', 'threeObject', 'threeGeometry', 'rvmBytes', 'bytes', 'binary', 'attText', 'glbBytes', 'gltfJson', 'objectUrl', 'downloadUrl', 'fileBlob', 'canvas', 'runtimeMutation'];
  if (!value || typeof value !== 'object') return hits;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectPanelForbiddenFieldHits(entry, `${path}[${index}]`, hits));
    return hits;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (forbidden.includes(key)) hits.push({ path: `${path}.${key}`, field: key });
    collectPanelForbiddenFieldHits(entry, `${path}.${key}`, hits);
  }
  return hits;
}

function toGroupRow(item) {
  return {
    sourceItemId: item.sourceItemId,
    family: item.family,
    type: item.type || '',
    status: item.diagnosticStatus || item.artifactStatus || 'blocked',
    reason: item.message || item.label || 'blocked',
    sourceRef: item.sourceRef || ''
  };
}
