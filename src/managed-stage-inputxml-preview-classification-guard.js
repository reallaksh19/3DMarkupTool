const VERSION = 'managed-stage-inputxml-preview-classification-guard-20260621';
const SOURCE_LINE_COLOR = 0x3d74c5;
const ELBOW_CUE_COLOR = 0x3d74c5;
const BEND_LIKE = new Set(['BEND', 'ELBO', 'ELBOW']);

installManagedStageInputXmlPreviewClassificationGuard();

export function installManagedStageInputXmlPreviewClassificationGuard() {
  if (window.__3D_MARKUP_MANAGED_STAGE_INPUTXML_CLASSIFICATION_GUARD__?.version === VERSION) {
    return window.__3D_MARKUP_MANAGED_STAGE_INPUTXML_CLASSIFICATION_GUARD__;
  }

  const api = {
    version: VERSION,
    apply: applyInputXmlPreviewClassificationGuard,
    patchActiveArtifact,
    debug: () => window.__3D_MARKUP_MANAGED_STAGE_INPUTXML_CLASSIFICATION_GUARD_LAST__ || { version: VERSION, patchedObjects: 0 }
  };
  window.__3D_MARKUP_MANAGED_STAGE_INPUTXML_CLASSIFICATION_GUARD__ = api;

  window.addEventListener('viewer:managed-stage-json-loaded', (event) => {
    applyInputXmlPreviewClassificationGuard(event?.detail?.modelRoot, event?.detail || {});
  });
  window.addEventListener('viewer:model-loaded', (event) => {
    applyInputXmlPreviewClassificationGuard(event?.detail?.modelRoot, event?.detail || {});
  });
  window.addEventListener('viewer:managed-stage-json-ui-ready', () => patchActiveArtifact(), { passive: true });

  patchActiveArtifact();
  return api;
}

function patchActiveArtifact() {
  const artifact = window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__?.getActiveArtifact?.();
  if (artifact?.previewScene) {
    return applyInputXmlPreviewClassificationGuard(artifact.previewScene, { sourceName: artifact.sourceName, previewCoordinateAudit: artifact.previewCoordinateAudit });
  }
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__;
  return applyInputXmlPreviewClassificationGuard(runtime?.modelRoot, { source: runtime?.source });
}

function applyInputXmlPreviewClassificationGuard(modelRoot, detail = {}) {
  if (!modelRoot || modelRoot.__inputXmlPreviewClassificationGuard === VERSION) return null;
  if (!isInputXmlManagedStagePreview(modelRoot, detail)) return null;

  let patchedObjects = 0;
  let patchedSourceLines = 0;
  let patchedElbowCues = 0;

  modelRoot.traverse?.((object) => {
    const data = object.userData || {};
    if (isBendLikeSourceLine(data)) {
      recolorObject(object, SOURCE_LINE_COLOR);
      data.sourceDtxr = data.sourceDtxr || data.dtxr || data.rawType || data.stagedType;
      data.visualClassification = 'inputxml-source-centerline';
      data.visualIsBend = false;
      data.inputXmlBendVisualClassificationSuppressed = true;
      patchedObjects += 1;
      patchedSourceLines += 1;
    }
    if (isBendLikePreviewCue(data)) {
      recolorObject(object, ELBOW_CUE_COLOR);
      data.sourceCueKind = data.sourceCueKind || data.cueKind;
      data.cueKind = 'orthogonal-elbow-preview';
      data.visualClassification = 'inputxml-elbow-cue-source-color';
      data.inputXmlBendVisualClassificationSuppressed = true;
      patchedObjects += 1;
      patchedElbowCues += 1;
    }
  });

  patchAudit(modelRoot.userData?.managedStageCoordinateAudit);
  modelRoot.__inputXmlPreviewClassificationGuard = VERSION;
  modelRoot.userData = {
    ...(modelRoot.userData || {}),
    inputXmlPreviewClassificationGuard: {
      version: VERSION,
      policy: 'InputXML-managed staged records preserve source/default preview color; BEND records are not visually reclassified as pink bend elements.',
      patchedObjects,
      patchedSourceLines,
      patchedElbowCues
    }
  };

  const result = { version: VERSION, patchedObjects, patchedSourceLines, patchedElbowCues };
  window.__3D_MARKUP_MANAGED_STAGE_INPUTXML_CLASSIFICATION_GUARD_LAST__ = result;
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__;
  runtime?.renderOnce?.('managed-stage-inputxml-classification-guard');
  return result;
}

function isInputXmlManagedStagePreview(modelRoot, detail = {}) {
  const data = modelRoot.userData || {};
  const audit = data.managedStageCoordinateAudit || detail.previewCoordinateAudit || {};
  const sourceText = [data.SOURCE_FORMAT, data.previewSource, data.previewSchema, audit.source, detail.source, detail.sourceName, data.sourceName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return sourceText.includes('inputxml') || sourceText.includes('raw-managed-stage-json') || sourceText.includes('managedstagerawpreview');
}

function isBendLikeSourceLine(data) {
  if (data.TYPE !== 'MANAGED_STAGE_RAW_PREVIEW') return false;
  if (data.previewAdditiveCue) return false;
  return BEND_LIKE.has(normalize(data.dtxr)) || BEND_LIKE.has(normalize(data.rawType)) || BEND_LIKE.has(normalize(data.stagedType));
}

function isBendLikePreviewCue(data) {
  if (data.TYPE !== 'MANAGED_STAGE_PREVIEW_CUE') return false;
  return data.cueKind === 'bend' || BEND_LIKE.has(normalize(data.cueKind));
}

function patchAudit(audit) {
  if (!audit?.rows) return;
  audit.inputXmlPreviewClassificationPolicy = 'visualIsBend=false for InputXML source records; raw dtxr/isBend audit fields remain available for traceability';
  for (const row of audit.rows) {
    if (!row?.isBend) continue;
    row.visualIsBend = false;
    row.visualClassification = 'inputxml-source-centerline';
  }
}

function recolorObject(object, color) {
  const materials = Array.isArray(object.material) ? object.material : [object.material].filter(Boolean);
  for (const material of materials) {
    material?.color?.setHex?.(color);
    material.needsUpdate = true;
  }
}

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}
