import {
  collectControlledPreviewForbiddenFieldHits,
  validateControlledPreviewModelContract
} from '../contracts/index.js';

const SCHEMA = 'ControlledPreviewModel.v1';
const MODE = 'controlledPreview';
const PREVIEW_KIND = 'diagnosticArtifactState';

export function buildControlledPreviewModel(panelViewModel, diagnosticPreviewModel, diagnosticPreviewAudit, rvmByteProof, rvmByteProofAudit, options = {}) {
  const errors = [];
  const warnings = [];
  if (!panelViewModel || panelViewModel.schema !== 'DiagnosticPanelViewModel.v1') errors.push('DiagnosticPanelViewModel.v1 is required');
  if (!diagnosticPreviewModel || diagnosticPreviewModel.schema !== 'DiagnosticCanvasPreviewModel.v1') errors.push('DiagnosticCanvasPreviewModel.v1 is required');
  if (!diagnosticPreviewAudit || diagnosticPreviewAudit.schema !== 'DiagnosticCanvasPreviewAudit.v1') errors.push('DiagnosticCanvasPreviewAudit.v1 is required');
  if (diagnosticPreviewAudit?.ok !== true) errors.push('DiagnosticCanvasPreviewAudit.ok must be true');
  if (!rvmByteProof || rvmByteProof.schema !== 'RvmTestArtifactByteProof.v1') errors.push('RvmTestArtifactByteProof.v1 is required');
  if (!rvmByteProofAudit || rvmByteProofAudit.schema !== 'RvmTestArtifactByteProofAudit.v1') errors.push('RvmTestArtifactByteProofAudit.v1 is required');
  if (rvmByteProofAudit?.ok !== true) errors.push('RvmTestArtifactByteProofAudit.ok must be true');

  const sourceTraceRows = Array.isArray(panelViewModel?.sourceTraceRows) ? panelViewModel.sourceTraceRows : [];
  const straightRows = sourceTraceRows.filter((row) => row.primitiveStatus === 'primitiveResolved' && row.writerStatus === 'planned');
  const blockedRows = sourceTraceRows.filter((row) => row.artifactStatus === 'blocked');
  const deferredRows = sourceTraceRows.filter((row) => row.artifactStatus === 'deferred');
  const blockedFlanges = blockedRows.filter((row) => row.family === 'flange');
  const blockedValves = blockedRows.filter((row) => row.family === 'valve');
  const blockedBends = blockedRows.filter((row) => row.family === 'elbow');
  const deferredSupports = deferredRows.filter((row) => row.family === 'support');
  const rvmSubsetReady = rvmByteProofAudit?.rvmStraightPipeSubsetArtifactReady === true;
  const rvmFullReady = rvmByteProofAudit?.rvmFullModelArtifactReady === true;
  if (!rvmFullReady) warnings.push('RVM full model remains not ready because blocked/deferred content remains.');

  const straightPipeSubsetPreview = straightRows.map((row, index) => toPreviewItem(row, index, {
    status: 'rvmStraightPipeSubsetReady',
    readiness: rvmSubsetReady ? 'ready' : 'notReady',
    severity: rvmSubsetReady ? 'info' : 'warning',
    label: 'RVM straight-pipe subset ready',
    message: 'Proven test-only RVM byte proof covers this straight-pipe source row.'
  }));
  const blockedPreview = blockedRows.map((row, index) => toPreviewItem(row, index, {
    status: 'blockedComponent',
    readiness: 'blocked',
    severity: 'blocked',
    label: `${displayFamily(row.family)} blocked`,
    message: 'Component remains blocked; no placeholder/fallback geometry is shown.'
  }));
  const deferredPreview = deferredRows.map((row, index) => toPreviewItem(row, index, {
    status: 'deferredSupport',
    readiness: 'deferred',
    severity: 'warning',
    label: 'Support deferred',
    message: 'Support remains deferred; no support geometry is shown.'
  }));
  const sourceTracePreview = sourceTraceRows.map((row, index) => toPreviewItem(row, index, {
    status: row.artifactStatus === 'blocked' ? 'blockedComponent' : row.artifactStatus === 'deferred' ? 'deferredSupport' : row.writerStatus === 'planned' ? 'rvmStraightPipeSubsetReady' : 'diagnosticOnly',
    readiness: row.artifactStatus === 'blocked' ? 'blocked' : row.artifactStatus === 'deferred' ? 'deferred' : row.writerStatus === 'planned' ? 'ready' : 'diagnosticOnly',
    severity: row.artifactStatus === 'blocked' ? 'blocked' : row.artifactStatus === 'deferred' ? 'warning' : 'info',
    label: 'Source trace diagnostic row',
    message: 'Schematic diagnostic preview row; not geometry.'
  }));

  const model = {
    schema: SCHEMA,
    graphId: panelViewModel?.graphId || diagnosticPreviewModel?.graphId || options.graphId || '<unknown-graph>',
    mode: MODE,
    previewKind: PREVIEW_KIND,
    featureFlags: {
      shadowDiagnostics: true,
      shadowPreview: true
    },
    overallStatus: panelViewModel?.overallStatus || 'unavailable',
    provenance: {
      diagnosticPanelSchema: panelViewModel?.schema || null,
      diagnosticPreviewSchema: diagnosticPreviewModel?.schema || null,
      diagnosticPreviewAuditSchema: diagnosticPreviewAudit?.schema || null,
      rvmByteProofSchema: rvmByteProof?.schema || null,
      rvmByteProofAuditSchema: rvmByteProofAudit?.schema || null,
      source: 'Phase 10 controlled preview from already-proven diagnostic/artifact state only'
    },
    artifactReadiness: {
      rvmStraightPipeSubsetReady: rvmSubsetReady,
      rvmFullModelReady: rvmFullReady,
      attReady: false,
      glbReady: false,
      blockedFlangeCount: blockedFlanges.length,
      blockedValveCount: blockedValves.length,
      blockedBendCount: blockedBends.length,
      deferredSupportCount: deferredSupports.length,
      sourceTraceCount: sourceTraceRows.length,
      artifactByteLengthKnown: Number(rvmByteProof?.artifactByteLength || 0) > 0,
      checksumPresent: typeof rvmByteProof?.checksumSha256 === 'string' && /^[0-9a-f]{64}$/.test(rvmByteProof.checksumSha256)
    },
    previewSections: [
      { sectionId: 'rvm-straight-pipe-subset', title: 'RVM straight-pipe subset', count: straightPipeSubsetPreview.length, readiness: rvmSubsetReady ? 'ready' : 'notReady' },
      { sectionId: 'blocked-components', title: 'Blocked components', count: blockedPreview.length, readiness: 'blocked' },
      { sectionId: 'deferred-supports', title: 'Deferred supports', count: deferredPreview.length, readiness: 'deferred' },
      { sectionId: 'source-trace', title: 'Source trace', count: sourceTracePreview.length, readiness: 'diagnosticOnly' }
    ],
    straightPipeSubsetPreview,
    blockedPreview,
    deferredPreview,
    sourceTracePreview,
    warnings,
    errors
  };
  model.errors.push(...validateControlledPreviewModel(model).errors);
  return model;
}

export function validateControlledPreviewModel(model) {
  return validateControlledPreviewModelContract(model);
}

export { collectControlledPreviewForbiddenFieldHits };

function toPreviewItem(row, index, policy) {
  return {
    previewId: `CP-${String(index + 1).padStart(4, '0')}-${safeId(row.sourceItemId)}`,
    sourceItemId: row.sourceItemId || '<unknown-item>',
    family: row.family || 'unknown',
    type: row.type || '',
    previewStatus: policy.status,
    readiness: policy.readiness,
    severity: policy.severity,
    label: policy.label,
    message: policy.message,
    sourceRef: row.sourceRef || ''
  };
}

function displayFamily(family) {
  if (family === 'elbow') return 'Bend';
  return `${String(family || 'Component').slice(0, 1).toUpperCase()}${String(family || 'component').slice(1)}`;
}

function safeId(value) {
  return String(value || 'unknown').replace(/[^A-Za-z0-9_.:-]+/g, '_').slice(0, 80);
}
