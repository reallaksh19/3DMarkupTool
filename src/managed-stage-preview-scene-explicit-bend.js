import { cylinderBetween, mat } from './geometry.js?v=professional-viewer-3';
import { createManagedStagePreviewScene as createRawManagedStagePreviewScene } from './managed-stage-preview-scene.js';
import { resolveExplicitManagedStageBendDetails, summarizeExplicitBendRows } from './managed-stage-explicit-bend-details.js';

export function createManagedStagePreviewScene(sourceTextOrJson, options = {}) {
  const json = parseManagedStageJson(sourceTextOrJson);
  const explicitBendRecords = collectExplicitBendRecords(json);
  const bendSummary = summarizeExplicitBendRows(explicitBendRecords);
  const explicitBendPathSet = new Set(explicitBendRecords.map((record) => record.path).filter(Boolean));
  const scene = createRawManagedStagePreviewScene(json, options);
  applyExplicitBendPreviewPolicy(scene, explicitBendRecords, explicitBendPathSet, bendSummary);
  return scene;
}

function applyExplicitBendPreviewPolicy(scene, explicitBendRecords, explicitBendPathSet, bendSummary) {
  const audit = scene?.userData?.managedStageCoordinateAudit;
  if (!audit) return scene;
  const detailsByPath = new Map(explicitBendRecords.map((record) => [record.path, resolveExplicitManagedStageBendDetails(record)]));
  removeSyntheticBendCues(scene, explicitBendPathSet);
  restoreExplicitBendMeshes(scene, detailsByPath);
  patchExplicitBendAuditRows(audit, detailsByPath);
  const trimmedRows = audit.rows.filter((row) => row.intentionalPreviewTrim);
  const trimmedBendRows = audit.rows.filter((row) => row.isBend && row.intentionalPreviewTrim);
  audit.planningPipeline = 'raw-staged-preview-with-explicit-inputxml-bend-source-truth-and-record-scoped-support-symbols';
  audit.explicitBendSummary = bendSummary;
  audit.explicitBendRecordCount = bendSummary.explicitBendRecordCount;
  audit.explicitBendDetailCount = bendSummary.explicitBendDetailCount;
  audit.missingExplicitBendDetailCount = bendSummary.missingExplicitBendDetailCount;
  audit.syntheticOrthogonalBendSkippedForExplicitBend = true;
  audit.trimmedBendSourceLineCount = trimmedBendRows.length;
  audit.trimmedSourceLineCount = trimmedRows.length;
  audit.trimmedNonBendSourceLineCount = trimmedRows.filter((row) => !row.isBend).length;
  audit.intentionalPreviewTrimRowCount = trimmedRows.length;
  audit.explicitBendTrimBlockedCount = audit.rows.filter((row) => row.explicitBendRecord && row.trimBlockedByExplicitBend).length;
  audit.elbowRadiusPolicy = 'Explicit stagedJson BEND_RADIUS/BEND_ANGLE are authoritative for InputXML-derived BEND records; synthetic orthogonal 1.5D trim/cue is blocked for those BEND rows.';
  return scene;
}

function removeSyntheticBendCues(scene, explicitBendPathSet) {
  const removals = [];
  scene.traverse?.((object) => {
    if (object?.userData?.TYPE !== 'MANAGED_STAGE_PREVIEW_CUE') return;
    if (object.userData.cueKind !== 'bend') return;
    if (explicitBendPathSet.has(object.userData.sourcePathA) || explicitBendPathSet.has(object.userData.sourcePathB)) removals.push(object);
  });
  for (const object of removals) object.parent?.remove(object);
}

function restoreExplicitBendMeshes(scene, detailsByPath) {
  scene.traverse?.((object) => {
    const path = object?.userData?.sourcePath;
    const details = detailsByPath.get(path);
    if (!details || !object.isMesh) return;
    const start = object.userData.sourceStartMm || object.userData.sourceAposMm;
    const end = object.userData.sourceEndMm || object.userData.sourceLposMm;
    if (!start || !end) return;
    const replacement = cylinderBetween(toVec(start), toVec(end), inferRadius(object), object.material || mat(0xaa55aa), 18, object.name || path);
    object.geometry?.dispose?.();
    object.geometry = replacement.geometry;
    object.position.copy(replacement.position);
    object.quaternion.copy(replacement.quaternion);
    object.userData = {
      ...object.userData,
      primitiveKind: 'explicit-staged-bend-source-route',
      previewSourceGeometry: 'BEND_APOS_LPOS',
      previewStartMm: clonePoint(start),
      previewEndMm: clonePoint(end),
      previewTrimmedForOrthogonalElbow: false,
      previewTrim: null,
      explicitBendRecord: true,
      explicitBendDetailsPresent: details.hasExplicitBendDetails,
      bendRadiusMm: details.bendRadiusMm,
      bendAngleDeg: details.bendAngleDeg,
      bendSource: details.bendSource,
      synthetic1p5DTrimBlocked: true,
      coordinatePolicy: 'explicit stagedJson BEND_RADIUS/BEND_ANGLE retained; no synthetic 1.5D corner trim applied to this BEND source route'
    };
  });
}

function patchExplicitBendAuditRows(audit, detailsByPath) {
  for (const row of audit.rows || []) {
    const details = detailsByPath.get(row.path);
    if (!details) continue;
    row.isBend = true;
    row.explicitBendRecord = true;
    row.explicitBendDetailsPresent = details.hasExplicitBendDetails;
    row.bendRadiusMm = details.bendRadiusMm;
    row.bendAngleDeg = details.bendAngleDeg;
    row.bendSource = details.bendSource;
    row.synthetic1p5DTrimBlocked = true;
    row.trimBlockedByExplicitBend = Boolean(row.intentionalPreviewTrim || row.previewTrim);
    row.intentionalPreviewTrim = false;
    row.previewTrim = null;
    row.deltaMm = { start: 0, end: 0, pos: 0, max: 0 };
    row.deltaReason = '';
    row.rendered = {
      ...row.rendered,
      startMm: clonePoint(row.APOS || row.beforePlanning?.startMm),
      endMm: clonePoint(row.LPOS || row.beforePlanning?.endMm),
      posMm: null
    };
    row.afterPlanning = {
      ...row.afterPlanning,
      policy: 'explicit stagedJson BEND_RADIUS/BEND_ANGLE retained; synthetic orthogonal 1.5D preview trim blocked',
      previewTrim: null,
      explicitBendDetails: details
    };
  }
}

function collectExplicitBendRecords(json) {
  const roots = Array.isArray(json?.hierarchy) ? json.hierarchy : [json].filter(Boolean);
  const records = [];
  const walk = (node, parentPath = '') => {
    if (!node || typeof node !== 'object') return;
    const attrs = node.attributes && typeof node.attributes === 'object' ? node.attributes : {};
    const rawName = String(node.name || attrs.NAME || node.id || 'Node').trim() || 'Node';
    const name = String(attrs.NAME || rawName).trim() || rawName;
    const path = parentPath ? `${parentPath}/${rawName}` : rawName;
    const record = { node, attributes: attrs, attrs, rawName, name, path, type: node.type || attrs.TYPE || 'UNKNOWN', dtxr: attrs.DTXR || attrs.RAW_TYPE || node.type || 'UNKNOWN', fromNode: String(attrs.FROM_NODE || ''), toNode: String(attrs.TO_NODE || '') };
    const details = resolveExplicitManagedStageBendDetails(record);
    if (details.explicitBendRecord) records.push(record);
    for (const child of Array.isArray(node.children) ? node.children : []) walk(child, path);
  };
  for (const root of roots) walk(root, '');
  return records;
}

function parseManagedStageJson(sourceTextOrJson) {
  if (typeof sourceTextOrJson === 'string') return JSON.parse(sourceTextOrJson);
  if (sourceTextOrJson && typeof sourceTextOrJson === 'object') return sourceTextOrJson;
  throw new Error('Managed-stage preview expects JSON text or object');
}

function inferRadius(object) {
  return Number(object?.userData?.pipeRadiusMm || object?.userData?.radiusMm || object?.geometry?.parameters?.radiusTop || object?.geometry?.parameters?.radius || 8) || 8;
}

function toVec(point) { return { x: Number(point.x) || 0, y: Number(point.y) || 0, z: Number(point.z) || 0 }; }
function clonePoint(point) { return point ? { x: Number(point.x) || 0, y: Number(point.y) || 0, z: Number(point.z) || 0 } : null; }
