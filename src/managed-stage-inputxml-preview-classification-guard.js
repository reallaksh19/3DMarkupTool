import * as THREE from 'three';

const VERSION = 'managed-stage-inputxml-preview-classification-guard-20260621b';
const SOURCE_LINE_COLOR = 0x3d74c5;
const ELBOW_CUE_COLOR = 0x3d74c5;
const VALVE_VISUAL_COLOR = 0xcc2222;
const SUPPORT_FALLBACK_COLOR = 0x2a9fd6;
const BEND_LIKE = new Set(['BEND', 'ELBO', 'ELBOW']);
const VALVE_LIKE = new Set(['VALV', 'VALVE', 'FLANGED_VALVE']);
const SUPPORT_FALLBACK_FAMILIES = new Set(['UNKNOWN_RESTRAINT', 'SINGLE_AXIS_WARNING']);

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
  let patchedValveConePairs = 0;
  let patchedSupportFallbackCrossRods = 0;
  const valveTargets = [];
  const supportFallbackTargets = [];

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
    if (isValveLikeSourceLine(data)) valveTargets.push(object);
    if (isSupportFallback(data)) supportFallbackTargets.push(object);
  });

  for (const object of valveTargets) {
    if (addValveConePair(object)) {
      patchedValveConePairs += 1;
      patchedObjects += 1;
    }
  }
  for (const object of supportFallbackTargets) {
    if (addSupportFallbackCrossRods(object)) {
      patchedSupportFallbackCrossRods += 1;
      patchedObjects += 1;
    }
  }

  patchAudit(modelRoot.userData?.managedStageCoordinateAudit);
  modelRoot.__inputXmlPreviewClassificationGuard = VERSION;
  modelRoot.userData = {
    ...(modelRoot.userData || {}),
    inputXmlPreviewClassificationGuard: {
      version: VERSION,
      policy: 'InputXML-managed staged records preserve source/default preview color; BEND records are not visually reclassified as pink bend elements; VALVE records receive opposed cone-pair preview symbols; unknown/support fallback markers render as translucent crossed rods.',
      patchedObjects,
      patchedSourceLines,
      patchedElbowCues,
      patchedValveConePairs,
      patchedSupportFallbackCrossRods
    }
  };

  const result = { version: VERSION, patchedObjects, patchedSourceLines, patchedElbowCues, patchedValveConePairs, patchedSupportFallbackCrossRods };
  window.__3D_MARKUP_MANAGED_STAGE_INPUTXML_CLASSIFICATION_GUARD_LAST__ = result;
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__;
  runtime?.renderOnce?.('managed-stage-inputxml-classification-guard');
  return result;
}

function addValveConePair(object) {
  const data = object.userData || {};
  if (data.inputXmlValveConePairApplied || object.__inputXmlValveConePairApplied) return false;
  const start = pointFrom(data.previewStartMm || data.sourceStartMm || data.sourceAposMm);
  const end = pointFrom(data.previewEndMm || data.sourceEndMm || data.sourceLposMm);
  if (!start || !end) return false;
  const span = end.clone().sub(start);
  const length = span.length();
  if (!(length > 0.001)) return false;
  const dir = span.clone().normalize();
  const center = start.clone().add(end).multiplyScalar(0.5);
  const inferredPipeRadius = inferObjectRadius(object, length);
  const coneLength = Math.max(inferredPipeRadius * 3.4, Math.min(length * 0.28, 220));
  const coneRadius = Math.max(inferredPipeRadius * 1.85, 8);
  const centerGap = Math.min(Math.max(inferredPipeRadius * 0.18, 2), coneLength * 0.18);
  const material = new THREE.MeshStandardMaterial({ color: VALVE_VISUAL_COLOR, roughness: 0.72, metalness: 0.04, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
  const group = new THREE.Group();
  group.name = `${object.name || data.sourceName || 'MANAGED_STAGE_VALVE'}_OPPOSED_CONE_PAIR`;
  group.userData = {
    ...(data || {}),
    TYPE: 'MANAGED_STAGE_PREVIEW_CUE',
    cueKind: 'valve-opposed-cone-pair',
    visualClassification: 'inputxml-valve-opposed-cone-pair',
    previewOnly: true,
    exportedRvmGeometry: false,
    previewAdditiveCue: true,
    sourceValvePath: data.sourcePath || object.name || '',
    coordinatePolicy: 'additive staged VALVE preview symbol; source APOS/LPOS line remains auditable and is not exported as fallback geometry'
  };
  const leftTip = center.clone().sub(dir.clone().multiplyScalar(centerGap));
  const rightTip = center.clone().add(dir.clone().multiplyScalar(centerGap));
  const leftCone = createPointCone(leftTip, dir, coneLength, coneRadius, material, `${group.name}_A_TO_CENTER`);
  const rightCone = createPointCone(rightTip, dir.clone().multiplyScalar(-1), coneLength, coneRadius, material, `${group.name}_B_TO_CENTER`);
  leftCone.userData = { ...group.userData, cuePart: 'valve-cone-a', pointsTowardValveCenter: true };
  rightCone.userData = { ...group.userData, cuePart: 'valve-cone-b', pointsTowardValveCenter: true };
  group.add(leftCone, rightCone);
  object.parent?.add?.(group);
  softenSourceValveLine(object);
  data.inputXmlValveConePairApplied = true;
  data.visualClassification = 'inputxml-valve-source-line-with-opposed-cone-pair';
  object.__inputXmlValveConePairApplied = VERSION;
  return true;
}

function addSupportFallbackCrossRods(object) {
  const data = object.userData || {};
  if (data.supportFallbackCrossRodsApplied || object.__supportFallbackCrossRodsApplied) return false;
  const visual = data.supportVisual || {};
  const center = pointFrom(data.previewPosMm || data.sourcePosMm || visual.pointMm) || object.position?.clone?.() || new THREE.Vector3();
  const diameter = Number(visual.pipeDiameterMm || data.pipeDiameterMm || 0);
  const rodLength = Math.max(diameter * 1.8 || 0, 140);
  const rodRadius = Math.max(rodLength * 0.035, 5);
  const material = new THREE.MeshStandardMaterial({ color: SUPPORT_FALLBACK_COLOR, roughness: 0.68, metalness: 0.02, transparent: true, opacity: 0.42, depthWrite: false });
  const group = new THREE.Group();
  group.name = `${object.name || 'MANAGED_STAGE_SUPPORT'}_TRANSLUCENT_X_RODS`;
  group.userData = {
    TYPE: 'MANAGED_STAGE_SUPPORT_VISUAL_PART',
    supportFallbackCrossRods: true,
    supportFamily: visual.family || data.supportFamily || 'UNKNOWN_RESTRAINT',
    popupRequired: Boolean(visual.popupRequired || data.popupRequired),
    previewOnly: true,
    exportedRvmGeometry: false,
    coordinatePolicy: 'support fallback preview uses translucent crossed rods; no box/sphere fallback and no RVM export contamination'
  };
  const diagA = new THREE.Vector3(1, 0, 1).normalize().multiplyScalar(rodLength * 0.5);
  const diagB = new THREE.Vector3(1, 0, -1).normalize().multiplyScalar(rodLength * 0.5);
  const rodA = cylinderBetween(center.clone().sub(diagA), center.clone().add(diagA), rodRadius, material, `${group.name}_A`);
  const rodB = cylinderBetween(center.clone().sub(diagB), center.clone().add(diagB), rodRadius, material, `${group.name}_B`);
  rodA.userData = { ...group.userData, cuePart: 'cross-rod-a' };
  rodB.userData = { ...group.userData, cuePart: 'cross-rod-b' };
  group.add(rodA, rodB);
  for (const child of object.children || []) child.visible = false;
  object.add(group);
  data.supportFallbackCrossRodsApplied = true;
  data.visualClassification = 'translucent-cross-rod-support-fallback';
  object.__supportFallbackCrossRodsApplied = VERSION;
  return true;
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

function isValveLikeSourceLine(data) {
  if (data.TYPE !== 'MANAGED_STAGE_RAW_PREVIEW') return false;
  if (data.previewAdditiveCue) return false;
  return VALVE_LIKE.has(normalize(data.dtxr)) || VALVE_LIKE.has(normalize(data.rawType)) || VALVE_LIKE.has(normalize(data.stagedType));
}

function isSupportFallback(data) {
  if (data.TYPE !== 'MANAGED_STAGE_SUPPORT_RESTRAINT_PREVIEW') return false;
  const family = normalize(data.supportVisual?.family || data.supportFamily);
  if (family === 'SPRING_CAN') return false;
  return SUPPORT_FALLBACK_FAMILIES.has(family) || (Boolean(data.supportVisual?.popupRequired || data.popupRequired) && !Array.isArray(data.supportVisual?.coneSides));
}

function patchAudit(audit) {
  if (!audit?.rows) return;
  audit.inputXmlPreviewClassificationPolicy = 'visualIsBend=false for InputXML source records; raw dtxr/isBend audit fields remain available for traceability; VALVE source rows may have additive opposed cone-pair symbols; unresolved support fallback rows may have translucent cross-rod symbols';
  for (const row of audit.rows) {
    if (row?.isBend) {
      row.visualIsBend = false;
      row.visualClassification = 'inputxml-source-centerline';
    }
    if (VALVE_LIKE.has(normalize(row?.dtxr || row?.type || row?.rawType))) {
      row.visualClassification = 'inputxml-valve-opposed-cone-pair';
      row.valvePreviewSymbol = 'opposed-cone-pair';
    }
    if (SUPPORT_FALLBACK_FAMILIES.has(normalize(row?.supportVisual?.family))) {
      row.visualClassification = 'translucent-cross-rod-support-fallback';
      row.supportFallbackSymbol = 'translucent-x-rods';
    }
  }
}

function recolorObject(object, color) {
  const materials = Array.isArray(object.material) ? object.material : [object.material].filter(Boolean);
  for (const material of materials) {
    material?.color?.setHex?.(color);
    material.needsUpdate = true;
  }
}

function softenSourceValveLine(object) {
  const materials = Array.isArray(object.material) ? object.material : [object.material].filter(Boolean);
  for (const material of materials) {
    material.transparent = true;
    material.opacity = Math.min(Number(material.opacity) || 1, 0.26);
    material.depthWrite = false;
    material.needsUpdate = true;
  }
}

function createPointCone(tip, dirTowardTip, length, radius, material, name) {
  const d = dirTowardTip.clone();
  if (d.lengthSq() <= 0.000001) d.set(0, 1, 0);
  d.normalize();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, length, 28), material);
  cone.name = name;
  cone.position.copy(tip).add(d.clone().multiplyScalar(-length / 2));
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  return cone;
}

function cylinderBetween(a, b, radius, material, name = 'cylinder') {
  const delta = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, Math.max(delta.length(), 0.0001), 16, 1, false), material);
  mesh.name = name;
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  return mesh;
}

function inferObjectRadius(object, length) {
  const data = object.userData || {};
  const explicit = Number(data.pipeRadiusMm || data.radiusMm || 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const geom = object.geometry;
  geom?.computeBoundingSphere?.();
  const sphereRadius = Number(geom?.boundingSphere?.radius || 0);
  if (Number.isFinite(sphereRadius) && sphereRadius > 0) return Math.max(Math.min(sphereRadius * 0.32, 80), 5);
  return Math.max(Math.min(length * 0.045, 80), 8);
}

function pointFrom(value) {
  if (!value) return null;
  if (value.isVector3) return value.clone();
  const x = Number(value.x ?? value.X ?? value[0]);
  const y = Number(value.y ?? value.Y ?? value[1]);
  const z = Number(value.z ?? value.Z ?? value[2]);
  if (![x, y, z].every(Number.isFinite)) return null;
  return new THREE.Vector3(x, y, z);
}

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}
