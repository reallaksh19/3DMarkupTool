import { collectControlledPreviewForbiddenFieldHits, validateControlledPreviewModelContract } from '../contracts/index.js';

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
  const rows = Array.isArray(panelViewModel?.sourceTraceRows) ? panelViewModel.sourceTraceRows : [];
  const straightRows = rows.filter((row) => row.primitiveStatus === 'primitiveResolved' && ['planned', 'byteProven'].includes(row.writerStatus));
  const bendTorusByteRows = rows.filter((row) => row.family === 'elbow' && row.primitiveKind === 'TORUS' && row.writerStatus === 'byteProven');
  const bendTorusDeferredRows = rows.filter((row) => row.family === 'elbow' && row.primitiveKind === 'TORUS' && row.writerStatus === 'deferred');
  const blockedRows = rows.filter((row) => row.artifactStatus === 'blocked');
  const supportRows = rows.filter((row) => row.family === 'support' && row.artifactStatus === 'deferred');
  const deferredRows = [...bendTorusDeferredRows, ...supportRows];
  const rvmSubsetReady = rvmByteProofAudit?.rvmStraightPipeSubsetArtifactReady === true;
  const rvmPipeBendReady = rvmByteProofAudit?.rvmPipeBendSubsetArtifactReady === true;
  const rvmFullReady = rvmByteProofAudit?.rvmFullModelArtifactReady === true;
  if (!rvmFullReady) warnings.push('RVM full model remains not ready because flanges/valves/supports remain unresolved/deferred.');
  const straightPipeSubsetPreview = straightRows.map((row, index) => toPreviewItem(row, index, rvmPipeBendReady ? 'rvmPipeBendSubsetReady' : 'rvmStraightPipeSubsetReady', rvmSubsetReady ? 'ready' : 'notReady', rvmSubsetReady ? 'info' : 'warning', 'RVM straight-pipe subset ready', 'Proven test-only RVM byte proof covers this straight-pipe source row.'));
  const blockedPreview = blockedRows.map((row, index) => toPreviewItem(row, index, 'blockedComponent', 'blocked', 'blocked', `${displayFamily(row.family)} blocked`, 'Component remains blocked; no placeholder/fallback geometry is shown.'));
  const bendBytePreview = bendTorusByteRows.map((row, index) => toPreviewItem(row, index, 'bendTorusByteProven', 'ready', 'info', 'Bend TORUS test byte proof ready', 'Bend TORUS/code4 is included in the isolated test-only RVM byte proof.'));
  const deferredPreview = [...bendBytePreview, ...deferredRows.map((row, index) => row.family === 'elbow' ? toPreviewItem(row, index, 'bendTorusWriterDeferred', 'deferred', 'warning', 'Bend TORUS primitive resolved; writer/artifact deferred', 'Bend TORUS byte proof is not available.') : toPreviewItem(row, index, 'deferredSupport', 'deferred', 'warning', 'Support deferred', 'Support remains deferred; no support geometry is shown.'))];
  const sourceTracePreview = rows.map((row, index) => {
    if (row.family === 'elbow' && row.primitiveKind === 'TORUS' && row.writerStatus === 'byteProven') return toPreviewItem(row, index, 'bendTorusByteProven', 'ready', 'info', 'Source trace diagnostic row', 'Bend TORUS/code4 byte proof ready.');
    if (row.family === 'elbow' && row.primitiveKind === 'TORUS' && row.writerStatus === 'deferred') return toPreviewItem(row, index, 'bendTorusWriterDeferred', 'deferred', 'warning', 'Source trace diagnostic row', 'Bend TORUS primitive resolved; writer/artifact deferred.');
    if (row.artifactStatus === 'blocked') return toPreviewItem(row, index, 'blockedComponent', 'blocked', 'blocked', 'Source trace diagnostic row', 'Blocked diagnostic row; not geometry.');
    if (row.artifactStatus === 'deferred') return toPreviewItem(row, index, 'deferredSupport', 'deferred', 'warning', 'Source trace diagnostic row', 'Deferred diagnostic row; not geometry.');
    if (row.writerStatus === 'planned' || row.writerStatus === 'byteProven') return toPreviewItem(row, index, rvmPipeBendReady ? 'rvmPipeBendSubsetReady' : 'rvmStraightPipeSubsetReady', 'ready', 'info', 'Source trace diagnostic row', 'Schematic diagnostic preview row; not geometry.');
    return toPreviewItem(row, index, 'diagnosticOnly', 'diagnosticOnly', 'info', 'Source trace diagnostic row', 'Schematic diagnostic preview row; not geometry.');
  });
  const blockedFlanges = blockedRows.filter((row) => row.family === 'flange');
  const blockedValves = blockedRows.filter((row) => row.family === 'valve');
  const blockedBends = blockedRows.filter((row) => row.family === 'elbow');
  const model = { schema: SCHEMA, graphId: panelViewModel?.graphId || diagnosticPreviewModel?.graphId || options.graphId || '<unknown-graph>', mode: MODE, previewKind: PREVIEW_KIND, featureFlags: { shadowDiagnostics: true, shadowPreview: true }, overallStatus: panelViewModel?.overallStatus || 'unavailable', provenance: { diagnosticPanelSchema: panelViewModel?.schema || null, diagnosticPreviewSchema: diagnosticPreviewModel?.schema || null, diagnosticPreviewAuditSchema: diagnosticPreviewAudit?.schema || null, rvmByteProofSchema: rvmByteProof?.schema || null, rvmByteProofAuditSchema: rvmByteProofAudit?.schema || null, source: 'Phase 11B controlled preview from already-proven pipe+bend diagnostic/artifact state only' }, artifactReadiness: { rvmPipeBendSubsetReady: rvmPipeBendReady, rvmStraightPipeSubsetReady: rvmSubsetReady, rvmFullModelReady: rvmFullReady, attReady: false, glbReady: false, bendTorusPrimitiveResolvedCount: bendTorusByteRows.length + bendTorusDeferredRows.length, bendTorusByteProvenCount: bendTorusByteRows.length, bendTorusWriterDeferredCount: bendTorusDeferredRows.length, blockedFlangeCount: blockedFlanges.length, blockedValveCount: blockedValves.length, blockedBendCount: blockedBends.length, deferredSupportCount: supportRows.length, sourceTraceCount: rows.length, artifactByteLengthKnown: Number(rvmByteProof?.artifactByteLength || 0) > 0, checksumPresent: typeof rvmByteProof?.checksumSha256 === 'string' && /^[0-9a-f]{64}$/.test(rvmByteProof.checksumSha256) }, previewSections: [{ sectionId: 'rvm-pipe-bend-subset', title: 'RVM pipe+bend subset', count: straightPipeSubsetPreview.length + bendBytePreview.length, readiness: rvmPipeBendReady ? 'ready' : 'notReady' }, { sectionId: 'bend-torus-byte-proof', title: 'Bend TORUS test byte proof ready', count: bendBytePreview.length, readiness: rvmPipeBendReady ? 'ready' : 'notReady' }, { sectionId: 'blocked-components', title: 'Blocked components', count: blockedPreview.length, readiness: 'blocked' }, { sectionId: 'deferred-items', title: 'Deferred items', count: deferredPreview.length, readiness: 'deferred' }, { sectionId: 'source-trace', title: 'Source trace', count: sourceTracePreview.length, readiness: 'diagnosticOnly' }], straightPipeSubsetPreview, blockedPreview, deferredPreview, sourceTracePreview, warnings, errors };
  model.errors.push(...validateControlledPreviewModel(model).errors);
  return model;
}

export function validateControlledPreviewModel(model) { return validateControlledPreviewModelContract(model); }
export { collectControlledPreviewForbiddenFieldHits };
function toPreviewItem(row, index, previewStatus, readiness, severity, label, message) { return { previewId: `CP-${String(index + 1).padStart(4, '0')}-${safeId(row.sourceItemId)}`, sourceItemId: row.sourceItemId || '<unknown-item>', family: row.family || 'unknown', type: row.type || '', previewStatus, readiness, severity, label, message, sourceRef: row.sourceRef || '' }; }
function displayFamily(family) { if (family === 'elbow') return 'Bend'; return `${String(family || 'Component').slice(0, 1).toUpperCase()}${String(family || 'component').slice(1)}`; }
function safeId(value) { return String(value || 'unknown').replace(/[^A-Za-z0-9_.:-]+/g, '_').slice(0, 80); }
