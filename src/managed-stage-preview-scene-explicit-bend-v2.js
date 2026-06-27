import * as THREE from 'three';
import { cylinderBetween, mat } from './geometry.js?v=bust-cache-4';
import { createManagedStagePreviewScene as createRawManagedStagePreviewScene } from './managed-stage-preview-scene.js?v=bust-cache-4';
import { resolveExplicitManagedStageBendDetails, summarizeExplicitBendRows } from './managed-stage-explicit-bend-details.js?v=bust-cache-4';

export function createManagedStagePreviewScene(sourceTextOrJson, options = {}) {
  const json = parseManagedStageJson(sourceTextOrJson);
  const explicitBendRecords = collectExplicitBendRecords(json);
  const bendSummary = summarizeExplicitBendRows(explicitBendRecords);
  const explicitBendPathSet = new Set(explicitBendRecords.map((record) => record.path).filter(Boolean));
  const scene = createRawManagedStagePreviewScene(json, options);
  const audit = scene?.userData?.managedStageCoordinateAudit;
  if (!audit) return scene;
  const detailsByPath = new Map(explicitBendRecords.map((record) => [record.path, resolveExplicitManagedStageBendDetails(record)]));
  removeSyntheticBendCues(scene, explicitBendPathSet);
  restoreExplicitBendMeshes(scene, detailsByPath);
  patchExplicitBendAuditRows(audit, detailsByPath);
  const trimmedRows = audit.rows.filter((row) => row.intentionalPreviewTrim);
  audit.planningPipeline = 'raw-staged-preview-with-explicit-inputxml-bend-source-truth-and-record-scoped-support-symbols';
  audit.explicitBendSummary = bendSummary;
  audit.explicitBendRecordCount = bendSummary.explicitBendRecordCount;
  audit.explicitBendDetailCount = bendSummary.explicitBendDetailCount;
  audit.missingExplicitBendDetailCount = bendSummary.missingExplicitBendDetailCount;
  audit.syntheticOrthogonalBendSkippedForExplicitBend = true;
  audit.trimmedBendSourceLineCount = audit.rows.filter((row) => row.isBend && row.intentionalPreviewTrim).length;
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
  // First, map objects by their TO and FROM nodes
  const objectsByNode = new Map();
  scene.traverse?.((object) => {
    if (!object.isMesh || !object.userData?.sourcePath) return;
    const toNode = object.userData.sourceToNode;
    const fromNode = object.userData.sourceFromNode;
    if (toNode) {
      if (!objectsByNode.has(toNode)) objectsByNode.set(toNode, []);
      objectsByNode.get(toNode).push(object);
    }
    if (fromNode) {
      if (!objectsByNode.has(fromNode)) objectsByNode.set(fromNode, []);
      objectsByNode.get(fromNode).push(object);
    }
  });

  const newMeshes = [];
  scene.traverse?.((object) => {
    const path = object?.userData?.sourcePath;
    const details = detailsByPath.get(path);
    if (!details || !object.isMesh) return;
    
    // Do NOT replace the geometry of the straight pipe!
    // Instead, tag it.
    object.userData = {
      ...object.userData,
      explicitBendRecord: true,
      explicitBendDetailsPresent: details.hasExplicitBendDetails,
      bendRadiusMm: details.bendRadiusMm,
      bendAngleDeg: details.bendAngleDeg,
      bendSource: details.bendSource,
      synthetic1p5DTrimBlocked: true
    };
    
    // Check both TO and FROM nodes to find the connecting sibling
    const toNode = object.userData.sourceToNode;
    const fromNode = object.userData.sourceFromNode;
    let siblings = [];
    
    if (toNode && objectsByNode.has(toNode)) {
      siblings = objectsByNode.get(toNode).filter(sib => sib !== object);
    }
    if (siblings.length === 0 && fromNode && objectsByNode.has(fromNode)) {
      siblings = objectsByNode.get(fromNode).filter(sib => sib !== object);
    }
    if (siblings.length === 0) return;
    
    const sibling = siblings[0];
    
    const start = new THREE.Vector3().copy(object.userData.sourceStartMm || object.userData.sourceAposMm || {x:0, y:0, z:0});
    const end = new THREE.Vector3().copy(object.userData.sourceEndMm || object.userData.sourceLposMm || {x:0, y:0, z:0});
    const sibStart = new THREE.Vector3().copy(sibling.userData.sourceStartMm || sibling.userData.sourceAposMm || {x:0, y:0, z:0});
    const sibEnd = new THREE.Vector3().copy(sibling.userData.sourceEndMm || sibling.userData.sourceLposMm || {x:0, y:0, z:0});
    
    const dStartStart = start.distanceToSq(sibStart);
    const dStartEnd = start.distanceToSq(sibEnd);
    const dEndStart = end.distanceToSq(sibStart);
    const dEndEnd = end.distanceToSq(sibEnd);
    
    const minD = Math.min(dStartStart, dStartEnd, dEndStart, dEndEnd);
    
    let intersectionPoint, oppositePoint, sibOppositePoint;
    if (minD === dStartStart) {
      intersectionPoint = start.clone().add(sibStart).multiplyScalar(0.5);
      oppositePoint = end;
      sibOppositePoint = sibEnd;
    } else if (minD === dStartEnd) {
      intersectionPoint = start.clone().add(sibEnd).multiplyScalar(0.5);
      oppositePoint = end;
      sibOppositePoint = sibStart;
    } else if (minD === dEndStart) {
      intersectionPoint = end.clone().add(sibStart).multiplyScalar(0.5);
      oppositePoint = start;
      sibOppositePoint = sibEnd;
    } else {
      intersectionPoint = end.clone().add(sibEnd).multiplyScalar(0.5);
      oppositePoint = start;
      sibOppositePoint = sibStart;
    }
    
    const dirA = oppositePoint.clone().sub(intersectionPoint).normalize();
    const dirB = sibOppositePoint.clone().sub(intersectionPoint).normalize();
    const radiusMm = details.bendRadiusMm || 100;
    
    const tangentA = intersectionPoint.clone().add(dirA.clone().multiplyScalar(radiusMm));
    const tangentB = intersectionPoint.clone().add(dirB.clone().multiplyScalar(radiusMm));
    
    const radius = inferRadius(object);
    const curve = new THREE.QuadraticBezierCurve3(tangentA, intersectionPoint, tangentB);
    const tubeGeom = new THREE.TubeGeometry(curve, 24, radius, 14, false);
    const bendMesh = new THREE.Mesh(tubeGeom, object.material || mat(0xaa55aa));
    bendMesh.name = `${object.name || path}_EXPLICIT_CORNER`;
    bendMesh.userData = { ...object.userData, TYPE: 'MANAGED_STAGE_PREVIEW_CUE', cueKind: 'bend' };
    newMeshes.push(bendMesh);
  });
  
  for (const mesh of newMeshes) {
    scene.add(mesh);
  }
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
    row.rendered = { ...row.rendered, startMm: clonePoint(row.APOS || row.beforePlanning?.startMm), endMm: clonePoint(row.LPOS || row.beforePlanning?.endMm), posMm: null };
    row.afterPlanning = { ...row.afterPlanning, policy: 'explicit stagedJson BEND_RADIUS/BEND_ANGLE retained; synthetic orthogonal 1.5D preview trim blocked', previewTrim: null, explicitBendDetails: details };
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
    if (resolveExplicitManagedStageBendDetails(record).explicitBendRecord) records.push(record);
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

function inferRadius(object) { return Number(object?.userData?.pipeRadiusMm || object?.userData?.radiusMm || object?.geometry?.parameters?.radiusTop || object?.geometry?.parameters?.radius || 8) || 8; }
function toVec(point) { return new THREE.Vector3(Number(point.x) || 0, Number(point.y) || 0, Number(point.z) || 0); }
function clonePoint(point) { return point ? { x: Number(point.x) || 0, y: Number(point.y) || 0, z: Number(point.z) || 0 } : null; }
