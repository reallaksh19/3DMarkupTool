import * as THREE from 'three';

export const VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA = 'ValveFlangeScenePostprocess.v3';

const BASE_CYLINDER_ALLOWED_ROLES = new Set([
  '',
  'PIPE',
  'FLANGED VALVE',
  'FLANGED_VALVE',
  'VALVE',
  'FLANGE',
  'FLANGE PAIR',
  'FLANGE_PAIR',
  'GATE VALVE',
  'GATE_VALVE',
  'BALL VALVE',
  'BALL_VALVE',
  'GLOBE VALVE',
  'GLOBE_VALVE',
  'CHECK VALVE',
  'CHECK_VALVE',
  'BUTTERFLY VALVE',
  'BUTTERFLY_VALVE',
  'CONTROL VALVE',
  'CONTROL_VALVE'
]);

const PIPE_ROLES = new Set(['PIPE', 'PIPE_RUN', 'PIPE_SEGMENT']);
const FLANGE_PAIR_ROLES = new Set([
  'WELD_NECK_A',
  'WELD_NECK_B',
  'FLANGE_DISC_A',
  'FLANGE_DISC_B',
  'FLANGE_CENTER_BORE_FILL',
  'GASKET_CENTER',
  'RAISED_FACE_A',
  'RAISED_FACE_B',
  'BLIND_CAP'
]);

/**
 * Catalogue components must be self-contained geometry.  This pass now has one
 * narrowly-scoped topology correction: InputXML single flanges are oriented from
 * their real From/To endpoints.  If one endpoint is shared by a pipe, the weld
 * neck/taper is placed on that pipe side and the raised face is placed on the
 * opposite endpoint.  This prevents the old symmetric flange-pair fallback from
 * putting a raised face on the same side as the pipe.
 */
export function hideCatalogReplacedBaseCylinders(sceneOrGroup, options = {}) {
  if (!sceneOrGroup || typeof sceneOrGroup !== 'object') throw new Error('sceneOrGroup is required');

  const stats = {
    schemaVersion: VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA,
    scannedObjects: 0,
    catalogVisualGroups: 0,
    hiddenBaseCylinders: 0,
    uprightValveCorrections: 0,
    flangeVisualCorrections: 0,
    flangeTopologyCorrections: 0,
    decorativeGeometryAdded: 0,
    geometryDecorationDisabled: true,
    untouchedNonCatalogObjects: 0,
    replacedComponentIds: []
  };

  const parentByChild = new Map();
  walk(sceneOrGroup, (object, parent) => {
    stats.scannedObjects += 1;
    if (parent) parentByChild.set(object, parent);
  });

  const catalogGroups = [];
  walk(sceneOrGroup, (object) => {
    if (isCatalogVisualGroup(object)) {
      catalogGroups.push(object);
      stats.catalogVisualGroups += 1;
    }
  });

  for (const visualGroup of catalogGroups) {
    const componentId = componentIdentity(visualGroup);
    if (!componentId) continue;
    const parent = parentByChild.get(visualGroup);
    const siblings = Array.isArray(parent?.children) ? parent.children : [];
    const base = siblings.find((candidate) => isLegacyBaseCylinderForComponent(candidate, componentId));

    if (isTopologyOrientedFlangeCandidate(visualGroup)) {
      const topology = flangeEndpointTopology(visualGroup, siblings, componentId);
      const corrected = topology ? orientSingleFlangeFromPipeEndpoint(visualGroup, topology, options) : null;
      if (corrected?.ok) {
        stats.flangeVisualCorrections += 1;
        stats.flangeTopologyCorrections += 1;
        stats.decorativeGeometryAdded += corrected.addedGeometry;
        stats.geometryDecorationDisabled = false;
      }
    }

    if (!base) continue;

    if (options.remove === true) {
      parent.children = siblings.filter((candidate) => candidate !== base);
    } else {
      base.visible = false;
    }

    base.userData = {
      ...(base.userData || {}),
      meshRole: 'CATALOG_REPLACED_BASE_CYLINDER',
      hiddenByVisualCatalog: true,
      hiddenByVisualCatalogSchema: VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA,
      hiddenByVisualCatalogReason: 'valve/flange catalogue visual replaces its own pipe-length base cylinder; adjacent pipes remain separate'
    };
    stats.hiddenBaseCylinders += 1;
    if (!stats.replacedComponentIds.includes(componentId)) stats.replacedComponentIds.push(componentId);
  }

  stats.untouchedNonCatalogObjects = Math.max(0, stats.scannedObjects - stats.catalogVisualGroups - stats.hiddenBaseCylinders);
  return stats;
}

export function isCatalogVisualGroup(object) {
  const data = object?.userData || {};
  return data.meshRole === 'CATALOG_VISUAL_GROUP'
    && typeof data.visualCatalogSchema === 'string'
    && (data.componentClass === 'VALVE' || data.componentClass === 'FLANGE');
}

export function isLegacyBaseCylinderForComponent(object, componentId) {
  if (!object || isCatalogVisualGroup(object)) return false;
  const data = object.userData || {};
  if (data.visualCatalogSchema) return false;
  if (data.hiddenByVisualCatalog) return false;
  if (data.TYPE && data.TYPE !== 'COMPONENT') return false;
  const id = componentIdentity(object);
  if (!id || id !== componentId) return false;
  return hasLegacyBaseCylinderRole(data);
}

export function hasLegacyBaseCylinderRole(data = {}) {
  const role = normalizeRole(data.meshRole);
  if (BASE_CYLINDER_ALLOWED_ROLES.has(role)) return true;
  const typeText = normalizeRole(firstNonEmpty(data.engineeringType, data.rigidType, data.componentType, data.TYPE));
  return typeText.includes('VALVE') || typeText.includes('FLANGE');
}

function isTopologyOrientedFlangeCandidate(object) {
  const data = object?.userData || {};
  return data.componentClass === 'FLANGE'
    && data.visualCatalogSchema
    && Array.isArray(object.children)
    && object.children.some((child) => FLANGE_PAIR_ROLES.has(normalizeRole(child?.userData?.meshRole)));
}

function flangeEndpointTopology(visualGroup, siblings, componentId) {
  const data = visualGroup?.userData || {};
  const fromNode = nodeKey(data.fromNode);
  const toNode = nodeKey(data.toNode);
  if (!fromNode || !toNode || fromNode === toNode) return null;

  const pipeSiblings = siblings.filter((candidate) => candidate !== visualGroup
    && componentIdentity(candidate) !== componentId
    && isPipeLikeComponent(candidate));
  const fromSharedByPipe = pipeSiblings.some((candidate) => componentTouchesNode(candidate, fromNode));
  const toSharedByPipe = pipeSiblings.some((candidate) => componentTouchesNode(candidate, toNode));

  if (fromSharedByPipe && !toSharedByPipe) {
    return { pipeEndpoint: 'FROM', raisedFaceEndpoint: 'TO', fromNode, toNode };
  }
  if (toSharedByPipe && !fromSharedByPipe) {
    return { pipeEndpoint: 'TO', raisedFaceEndpoint: 'FROM', fromNode, toNode };
  }
  return null;
}

function orientSingleFlangeFromPipeEndpoint(visualGroup, topology, options = {}) {
  if (visualGroup.userData?.singleFlangeTopologyOriented) return null;
  if (typeof visualGroup.add !== 'function') return null;

  const axis = inferLocalAxisFromCatalogChildren(visualGroup);
  if (!axis) return null;

  const material = firstMaterial(visualGroup.children) || new THREE.MeshBasicMaterial();
  const dims = inferSingleFlangeDimensions(visualGroup.children, axis.halfLength);
  const faceAtTo = topology.raisedFaceEndpoint === 'TO';
  const spans = singleFlangeSpans(axis.halfLength, dims, faceAtTo);
  if (!spans) return null;

  for (const child of visualGroup.children) {
    const role = normalizeRole(child?.userData?.meshRole);
    if (FLANGE_PAIR_ROLES.has(role) || role.includes('_BOLT')) {
      child.visible = false;
      child.userData = {
        ...(child.userData || {}),
        hiddenBySingleFlangeTopology: true,
        hiddenBySingleFlangeTopologySchema: VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA,
        hiddenBySingleFlangeTopologyReason: 'single flange rebuilt from From/To pipe endpoint rule; pipe side and raised-face side must not coincide'
      };
    }
  }

  const id = componentIdentity(visualGroup);
  const neck = createFrustumSegment(axis, spans.neck, dims.pipeRadius, dims.neckOuterRadius, faceAtTo, material, `${id}_WELD_NECK_PIPE_SIDE`);
  const plate = createCylinderSegment(axis, spans.plate, dims.plateRadius, material, `${id}_FLANGE_PLATE`);
  const raisedFace = createCylinderSegment(axis, spans.raisedFace, dims.raisedFaceRadius, material, `${id}_RAISED_FACE`);

  stampSingleFlangeMesh(neck, visualGroup, 'WELD_NECK_PIPE_SIDE', spans.neck, topology, {
    geometryKind: 'FRUSTUM',
    radiusStart: faceAtTo ? dims.pipeRadius : dims.neckOuterRadius,
    radiusEnd: faceAtTo ? dims.neckOuterRadius : dims.pipeRadius,
    pipeSide: true
  });
  stampSingleFlangeMesh(plate, visualGroup, 'FLANGE_PLATE', spans.plate, topology, {
    geometryKind: 'CYLINDER',
    radius: dims.plateRadius,
    thinPlate: true
  });
  stampSingleFlangeMesh(raisedFace, visualGroup, 'RAISED_FACE', spans.raisedFace, topology, {
    geometryKind: 'CYLINDER',
    radius: dims.raisedFaceRadius,
    thinRaisedFace: true,
    raisedFaceSide: true
  });

  const boltCount = addBoltMarkers(visualGroup, axis, spans.plate, dims, material, id, topology, options);
  visualGroup.add(neck, plate, raisedFace);
  visualGroup.userData = {
    ...(visualGroup.userData || {}),
    singleFlangeTopologyOriented: true,
    singleFlangeTopologySchema: VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA,
    pipeEndpoint: topology.pipeEndpoint,
    raisedFaceEndpoint: topology.raisedFaceEndpoint
  };

  return { ok: true, addedGeometry: 3 + boltCount };
}

function inferLocalAxisFromCatalogChildren(group) {
  const axial = (group.children || [])
    .filter((child) => child?.position?.isVector3 && child.userData)
    .map((child) => {
      const data = child.userData || {};
      const start = Number(data.renderedLocalAxisStart ?? data.localAxisStart);
      const end = Number(data.renderedLocalAxisEnd ?? data.localAxisEnd);
      const role = normalizeRole(data.meshRole);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
      if (!FLANGE_PAIR_ROLES.has(role)) return null;
      return { child, role, start, end, center: (start + end) / 2 };
    })
    .filter(Boolean);
  if (axial.length < 2) return null;

  const negative = axial.find((entry) => entry.role === 'WELD_NECK_A') || axial.find((entry) => entry.role === 'FLANGE_DISC_A') || axial[0];
  const positive = axial.find((entry) => entry.role === 'WELD_NECK_B') || axial.find((entry) => entry.role === 'FLANGE_DISC_B') || axial[axial.length - 1];
  const dir = positive.child.position.clone().sub(negative.child.position);
  if (dir.lengthSq() < 1e-10) return null;
  dir.normalize();

  const mid = new THREE.Vector3();
  let samples = 0;
  let halfLength = 0;
  for (const entry of axial) {
    mid.add(entry.child.position.clone().sub(dir.clone().multiplyScalar(entry.center)));
    halfLength = Math.max(halfLength, Math.abs(entry.start), Math.abs(entry.end));
    samples += 1;
  }
  if (!samples || halfLength <= 1e-8) return null;
  mid.multiplyScalar(1 / samples);
  return { dir, mid, halfLength };
}

function inferSingleFlangeDimensions(children, halfLength) {
  const byRole = (role) => children.find((child) => normalizeRole(child?.userData?.meshRole) === role)?.userData || {};
  const disc = byRole('FLANGE_DISC_A').radius ? byRole('FLANGE_DISC_A') : byRole('FLANGE_DISC_B');
  const raised = byRole('RAISED_FACE_A').radius ? byRole('RAISED_FACE_A') : byRole('RAISED_FACE_B');
  const neck = byRole('WELD_NECK_A').radius ? byRole('WELD_NECK_A') : byRole('WELD_NECK_B');

  const plateRadius = positiveNumber(disc.radius, positiveNumber(neck.outerRadius, halfLength * 0.32));
  const raisedFaceRadius = Math.min(
    positiveNumber(raised.radius, plateRadius * 0.64),
    plateRadius * 0.74
  );
  const pipeRadius = positiveNumber(neck.innerRadius, positiveNumber(neck.radiusStart, plateRadius * 0.48));
  const neckOuterRadius = Math.max(positiveNumber(neck.outerRadius, plateRadius * 0.54), pipeRadius * 1.06);
  const plateThickness = clamp(positiveNumber(disc.length, halfLength * 0.08), halfLength * 0.025, halfLength * 0.14);
  const raisedFaceThickness = clamp(positiveNumber(raised.length, plateThickness * 0.16), halfLength * 0.008, Math.min(plateThickness * 0.28, halfLength * 0.06));

  return { plateRadius, raisedFaceRadius, pipeRadius, neckOuterRadius, plateThickness, raisedFaceThickness };
}

function singleFlangeSpans(half, dims, faceAtTo) {
  if (half <= dims.plateThickness + dims.raisedFaceThickness) return null;
  if (faceAtTo) {
    const raisedFace = { start: half - dims.raisedFaceThickness, end: half };
    const plate = { start: raisedFace.start - dims.plateThickness, end: raisedFace.start };
    return { neck: { start: -half, end: plate.start }, plate, raisedFace };
  }
  const raisedFace = { start: -half, end: -half + dims.raisedFaceThickness };
  const plate = { start: raisedFace.end, end: raisedFace.end + dims.plateThickness };
  return { raisedFace, plate, neck: { start: plate.end, end: half } };
}

function createCylinderSegment(axis, span, radius, material, name) {
  const center = pointAt(axis, (span.start + span.end) / 2);
  const length = Math.max(span.end - span.start, 0.0001);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(radius, 0.004), Math.max(radius, 0.004), length, 28), material);
  mesh.name = name;
  mesh.position.copy(center);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.dir.clone().normalize());
  return mesh;
}

function createFrustumSegment(axis, span, pipeRadius, neckOuterRadius, faceAtTo, material, name) {
  const center = pointAt(axis, (span.start + span.end) / 2);
  const length = Math.max(span.end - span.start, 0.0001);
  const radiusStart = faceAtTo ? pipeRadius : neckOuterRadius;
  const radiusEnd = faceAtTo ? neckOuterRadius : pipeRadius;
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(Math.max(radiusEnd, 0.004), Math.max(radiusStart, 0.004), length, 24, 1, false),
    material
  );
  mesh.name = name;
  mesh.position.copy(center);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.dir.clone().normalize());
  return mesh;
}

function addBoltMarkers(group, axis, plateSpan, dims, material, id, topology, options = {}) {
  if (options.flangeTopologyBoltMarkers === false) return 0;
  const count = 8;
  const centerOffset = (plateSpan.start + plateSpan.end) / 2;
  const up = orthogonal(axis.dir);
  const side = new THREE.Vector3().crossVectors(axis.dir, up).normalize();
  const boltRadius = Math.max(Math.min(dims.plateRadius * 0.035, dims.pipeRadius * 0.08), 0.018);
  const boltCircleRadius = Math.max(dims.raisedFaceRadius * 1.16, dims.plateRadius * 0.78);
  for (let i = 0; i < count; i += 1) {
    const theta = (Math.PI * 2 * i) / count;
    const center = pointAt(axis, centerOffset)
      .add(up.clone().multiplyScalar(Math.cos(theta) * boltCircleRadius))
      .add(side.clone().multiplyScalar(Math.sin(theta) * boltCircleRadius));
    const bolt = new THREE.Mesh(new THREE.SphereGeometry(boltRadius, 10, 6), material);
    bolt.name = `${id}_FLANGE_TOPOLOGY_BOLT_${i + 1}`;
    bolt.position.copy(center);
    stampSingleFlangeMesh(bolt, group, 'FLANGE_TOPOLOGY_BOLT', { start: centerOffset, end: centerOffset }, topology, {
      geometryKind: 'BOLT_MARKER',
      boltIndex: i + 1,
      boltCount: count,
      radius: boltRadius
    });
    group.add(bolt);
  }
  return count;
}

function stampSingleFlangeMesh(mesh, group, role, span, topology, extra = {}) {
  mesh.userData = {
    ...(group.userData || {}),
    meshRole: role,
    componentClass: 'FLANGE',
    singleFlangeTopologyOriented: true,
    singleFlangeTopologySchema: VALVE_FLANGE_SCENE_POSTPROCESS_SCHEMA,
    pipeEndpoint: topology.pipeEndpoint,
    raisedFaceEndpoint: topology.raisedFaceEndpoint,
    renderedLocalAxisStart: span.start,
    renderedLocalAxisEnd: span.end,
    renderedAxisLength: Math.max(span.end - span.start, 0),
    replacesCenterlinePipe: true,
    ...extra
  };
}

function pointAt(axis, offset) {
  return axis.mid.clone().add(axis.dir.clone().multiplyScalar(offset));
}

function isPipeLikeComponent(object) {
  const data = object?.userData || {};
  if (data.visualCatalogSchema || data.hiddenByVisualCatalog) return false;
  const role = normalizeRole(data.meshRole);
  const type = normalizeRole(firstNonEmpty(data.engineeringType, data.rigidType, data.componentType, data.TYPE));
  return PIPE_ROLES.has(role) || type === 'PIPE' || /^PIPE(?:_|$)/.test(type);
}

function componentTouchesNode(object, node) {
  const data = object?.userData || {};
  return nodeKey(data.fromNode) === node || nodeKey(data.toNode) === node;
}

function componentIdentity(object) {
  const data = object?.userData || {};
  return firstNonEmpty(data.componentId, data.ID, data.id, object?.name);
}

function firstMaterial(children = []) {
  for (const child of children) {
    const material = child?.material;
    if (Array.isArray(material) && material[0]) return material[0];
    if (material) return material;
  }
  return null;
}

function nodeKey(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const n = Number(text);
  return Number.isFinite(n) ? String(n) : text;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function normalizeRole(value) {
  return String(value ?? '').trim().replace(/[\s-]+/g, '_').toUpperCase();
}

function positiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function orthogonal(dir) {
  const axis = Math.abs(dir.y) < 0.85 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  return new THREE.Vector3().crossVectors(dir, axis).normalize();
}

function walk(root, visit, parent = null) {
  visit(root, parent);
  for (const child of Array.isArray(root.children) ? root.children : []) {
    walk(child, visit, root);
  }
}
