import * as THREE from 'three';
import { createNodeLabel, createTextPlane, cylinderBetween, mat } from './geometry.js?v=bust-cache-4';

const PREVIEW_COLORS = {
  pipe: 0xf0f4f8,
  valve: 0x21d4c4,
  bend: 0x67d4ef,
  rigid: 0x8fb2d8,
  rest: 0xf8c34a,
  guide: 0x18d5c0,
  lineStop: 0xf2a93b,
  holddown: 0xf05ab9,
  spring: 0xd273ff,
  warning: 0xff8c73,
  default: 0xd8e3ee
};

const MATERIAL_BY_RVM_ID = new Map([
  [4, PREVIEW_COLORS.pipe],
  [5, PREVIEW_COLORS.rigid],
  [6, PREVIEW_COLORS.rigid],
  [7, PREVIEW_COLORS.valve],
  [8, PREVIEW_COLORS.rigid],
  [11, PREVIEW_COLORS.warning],
  [12, PREVIEW_COLORS.pipe],
  [17, PREVIEW_COLORS.guide],
  [19, PREVIEW_COLORS.lineStop],
  [22, PREVIEW_COLORS.holddown],
  [27, PREVIEW_COLORS.rigid],
  [31, PREVIEW_COLORS.spring]
]);

export const RVM_PREVIEW_PRIMITIVE_MESH_BUILDERS = new Map([
  ['cylinder', createCylinder],
  ['elbow', createElbow],
  ['snout', createSnout],
  ['sphere', createSphere],
  ['box', createBox],
  ['pyramid', createPyramid]
]);

/**
 * Creates a Three.js scene from the generated RVM export tree.
 * Parameters: export tree returned by convertInputXmlToRvmAtt or convertManagedStageJsonToRvmAtt.
 * Output: preview scene using the same RVM primitives written to disk.
 * Fallback: unsupported primitives throw errors so preview cannot drift from exported RVM content.
 */
export function createRvmPreviewScene(exportModel, options = {}) {
  const recenter = options.recenter !== false;
  const scene = new THREE.Scene();
  scene.name = options.sceneName || 'InputXML_RVM_PREVIEW_SCENE';
  scene.userData = {
    app: 'inputxml-glb-standalone',
    previewSource: 'generated-rvm-export-model',
    recentered: recenter
  };
  const root = new THREE.Group();
  root.name = 'RVM_PREVIEW_ROOT';
  scene.add(root);
  addNode(root, exportModel.root);
  if (recenter) frameScene(scene);
  return scene;
}

function addNode(parent, node) {
  const group = new THREE.Group();
  group.name = node.name;
  group.userData = normalizeUserData(node.attributes || {});
  parent.add(group);

  for (const primitive of node.primitives || []) {
    group.add(createPrimitiveMesh(primitive, node.material));
  }

  const annotation = createAnnotationOverlay(node);
  if (annotation) group.add(annotation);

  for (const child of node.children || []) {
    addNode(group, child);
  }
}

function createAnnotationOverlay(node) {
  const attributes = node.attributes || {};
  const center = firstPrimitiveCenter(node);
  if (!center) return null;

  if (attributes.TYPE === 'NODE') {
    const label = createNodeLabel(attributes.LABEL || `N${attributes.NODE}`, center.clone().add(new THREE.Vector3(42, 62, 36)), 42);
    label.name = `${node.name}_TEXT`;
    label.material.depthTest = false;
    label.renderOrder = 20;
    label.userData = normalizeUserData(attributes);
    return label;
  }

  if (attributes.TYPE === 'ISONOTE_NAME_PLATE') {
    const board = createTextPlane(attributes.BOARD_TEXT || attributes.SOURCE_NOTE_NAME || '', {
      width: 860,
      height: 260,
      fontSize: 30,
      scale: 38,
      name: `${node.name}_TEXT_BOARD`,
      bg: 'rgba(33,27,46,0.94)',
      border: '#f9a825'
    });
    board.position.copy(center.clone().add(new THREE.Vector3(0, 64, 0)));
    board.material.depthTest = false;
    board.renderOrder = 20;
    board.userData = normalizeUserData(attributes);
    return board;
  }

  return null;
}

function createPrimitiveMesh(primitive, fallbackMaterialId) {
  const kind = String(primitive.kind || '');
  const buildMesh = RVM_PREVIEW_PRIMITIVE_MESH_BUILDERS.get(kind);
  if (!buildMesh) {
    throw new Error(`Unsupported RVM preview primitive: ${primitive.kind}`);
  }
  return buildMesh(primitive, fallbackMaterialId);
}

function createCylinder(primitive, fallbackMaterialId) {
  const center = v3(primitive.center);
  const dir = v3(primitive.direction).normalize();
  const half = Number(primitive.length) / 2;
  const start = center.clone().sub(dir.clone().multiplyScalar(half));
  const end = center.clone().add(dir.clone().multiplyScalar(half));
  const mesh = cylinderBetween(start, end, Number(primitive.radius), materialFor(primitive, fallbackMaterialId), 20, primitive.name);
  mesh.userData = { TYPE: 'RVM_PRIMITIVE', primitiveKind: primitive.kind, sourceName: primitive.name, primitiveCode: 8 };
  return mesh;
}

function createElbow(primitive, fallbackMaterialId) {
  const bendRadius = positiveNumber(primitive.bendRadius, 'bendRadius');
  const tubeRadius = positiveNumber(primitive.tubeRadius, 'tubeRadius');
  const sweep = positiveNumber(primitive.sweepAngleRad, 'sweepAngleRad');
  const geometry = new THREE.TorusGeometry(bendRadius, tubeRadius, 36, 12, sweep);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, materialFor(primitive, fallbackMaterialId));
  mesh.name = primitive.name;
  mesh.position.copy(v3(primitive.center));
  const basis = basisForPrimitive(primitive);
  const matrix = new THREE.Matrix4().makeBasis(basis.x, basis.y, basis.z);
  mesh.setRotationFromMatrix(matrix);
  mesh.userData = {
    TYPE: 'RVM_PRIMITIVE',
    primitiveKind: primitive.kind,
    sourceName: primitive.name,
    primitiveCode: 4,
    previewGeometry: 'torus-arc'
  };
  return mesh;
}

function createSnout(primitive, fallbackMaterialId) {
  const radiusBottom = nonNegativeNumber(primitive.radiusBottom, 'radiusBottom');
  const radiusTop = nonNegativeNumber(primitive.radiusTop, 'radiusTop');
  if (radiusBottom <= 0 && radiusTop <= 0) {
    throw new Error('Invalid RVM preview snout radii: at least one radius must be positive');
  }
  const height = positiveNumber(primitive.height, 'height');
  const offsetX = finiteNumberOrDefault(primitive.offsetX, 0, 'offsetX');
  const offsetY = finiteNumberOrDefault(primitive.offsetY, 0, 'offsetY');
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 24, 1, false);
  // Three.js CylinderGeometry is local-Y aligned. RVM Snout is local-Z aligned.
  geometry.rotateX(Math.PI / 2);
  applySnoutTopOffset(geometry, height, offsetX, offsetY);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, materialFor(primitive, fallbackMaterialId));
  mesh.name = primitive.name;
  mesh.position.copy(v3(primitive.center));
  const basis = basisForPrimitive(primitive);
  const matrix = new THREE.Matrix4().makeBasis(basis.x, basis.y, basis.z);
  mesh.setRotationFromMatrix(matrix);
  mesh.userData = {
    TYPE: 'RVM_PRIMITIVE',
    primitiveKind: primitive.kind,
    sourceName: primitive.name,
    primitiveCode: 7,
    previewGeometry: 'snout-frustum',
    heightAxis: 'basis.z'
  };
  return mesh;
}

function applySnoutTopOffset(geometry, height, offsetX, offsetY) {
  if (Math.abs(offsetX) < 1e-9 && Math.abs(offsetY) < 1e-9) return;
  const position = geometry.getAttribute('position');
  const topZ = height / 2;
  for (let index = 0; index < position.count; index += 1) {
    if (position.getZ(index) > topZ - 1e-6) {
      position.setX(index, position.getX(index) + offsetX);
      position.setY(index, position.getY(index) + offsetY);
    }
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

function createSphere(primitive, fallbackMaterialId) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(Number(primitive.diameter) / 2, 24, 16),
    materialFor(primitive, fallbackMaterialId)
  );
  mesh.name = primitive.name;
  mesh.position.copy(v3(primitive.center));
  mesh.userData = { TYPE: 'RVM_PRIMITIVE', primitiveKind: primitive.kind, sourceName: primitive.name };
  return mesh;
}

function createBox(primitive, fallbackMaterialId) {
  const lengths = primitive.lengths.map((value) => Number(value));
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(lengths[0], lengths[1], lengths[2]),
    materialFor(primitive, fallbackMaterialId)
  );
  mesh.name = primitive.name;
  mesh.position.copy(v3(primitive.center));
  if (primitive.basis?.x && primitive.basis?.y && primitive.basis?.z) {
    const matrix = new THREE.Matrix4().makeBasis(
      v3(primitive.basis.x).normalize(),
      v3(primitive.basis.y).normalize(),
      v3(primitive.basis.z).normalize()
    );
    mesh.setRotationFromMatrix(matrix);
  } else {
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v3(primitive.direction || [0, 0, 1]).normalize());
  }
  mesh.userData = { TYPE: 'RVM_PRIMITIVE', primitiveKind: primitive.kind, sourceName: primitive.name };
  return mesh;
}

function createPyramid(primitive, fallbackMaterialId) {
  const bottom = Math.max(Number(primitive.bottom[0]), Number(primitive.bottom[1])) / Math.sqrt(2);
  const top = Math.max(Number(primitive.top[0]), Number(primitive.top[1])) / Math.sqrt(2);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(top, bottom, Number(primitive.height), 4, 1, false),
    materialFor(primitive, fallbackMaterialId)
  );
  mesh.name = primitive.name;
  mesh.position.copy(v3(primitive.center));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v3(primitive.direction).normalize());
  mesh.userData = { TYPE: 'RVM_PRIMITIVE', primitiveKind: primitive.kind, sourceName: primitive.name };
  return mesh;
}

function basisForPrimitive(primitive) {
  if (primitive.basis?.x && primitive.basis?.y && primitive.basis?.z) {
    return {
      x: v3(primitive.basis.x).normalize(),
      y: v3(primitive.basis.y).normalize(),
      z: v3(primitive.basis.z).normalize()
    };
  }

  const z = v3(primitive.direction || [0, 0, 1]).normalize();
  const reference = Math.abs(z.y) < 0.85 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const x = new THREE.Vector3().crossVectors(reference, z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  return { x, y, z };
}

function materialFor(primitive, fallbackMaterialId) {
  const color = MATERIAL_BY_RVM_ID.get(primitive.material || fallbackMaterialId) || PREVIEW_COLORS.default;
  return mat(color, { roughness: 0.66, metalness: 0.08 });
}

function firstPrimitiveCenter(node) {
  const first = (node.primitives || [])[0];
  if (!first || !first.center) return null;
  return v3(first.center);
}

function normalizeUserData(attributes) {
  const out = { ...attributes };
  if (attributes.TYPE === 'COMPONENT') {
    out.lineNo = attributes.LINE_NO;
    out.lineNoSource = attributes.LINE_NO_SOURCE;
    out.fromNode = attributes.FROM_NODE;
    out.toNode = attributes.TO_NODE;
    out.engineeringType = attributes.ENGINEERING_TYPE;
    out.meshRole = attributes.MESH_ROLE;
    out.bore = attributes.BORE;
    out.wallThickness = attributes.WALL_THICKNESS;
    out.wallThicknessSource = attributes.WALL_THICKNESS_SOURCE;
    out.materialThickness = attributes.MATERIAL_THICKNESS;
    out.materialThicknessSource = attributes.MATERIAL_THICKNESS_SOURCE;
    out.material = attributes.MATERIAL;
    out.materialSource = attributes.MATERIAL_SOURCE;
    out.pressure = attributes.PRESSURE;
    out.pressureSource = attributes.PRESSURE_SOURCE;
    out.hydroPressure = attributes.HYDRO_PRESSURE;
    out.hydroPressureSource = attributes.HYDRO_PRESSURE_SOURCE;
    out.temp1 = attributes.TEMP1;
    out.temp1Source = attributes.TEMP1_SOURCE;
    out.temp2 = attributes.TEMP2;
    out.temp2Source = attributes.TEMP2_SOURCE;
    out.temp3 = attributes.TEMP3;
    out.temp3Source = attributes.TEMP3_SOURCE;
  }
  if (attributes.TYPE === 'SUPPORT_RESTRAINT') {
    out.node = attributes.NODE;
    out.family = attributes.FAMILY;
    out.axis = attributes.AXIS;
    out.source = attributes.SOURCE;
    out.sourceMode = attributes.SOURCE_MODE;
    out.loadText = attributes.LOAD_TEXT;
    out.gapMm = attributes.GAP_MM;
    out.sourceNoteName = attributes.SOURCE_NOTE_NAME;
    out.warningText = attributes.WARNING_TEXT;
    out.popupRequired = attributes.POPUP_REQUIRED === 'true';
  }
  if (attributes.TYPE === 'SUPPORT_MARKER') {
    out.supportMarkerId = attributes.SUPPORT_MARKER_ID || attributes.ID;
    out.node = attributes.NODE;
    out.family = attributes.FAMILY;
    out.axis = attributes.AXIS;
    out.axisRaw = attributes.AXIS_RAW;
    out.axisCanvas = attributes.AXIS_CANVAS;
    out.axisTransformApplied = attributes.AXIS_TRANSFORM_APPLIED === 'TRUE';
    out.axisTransform = parseJsonAttribute(attributes.AXIS_TRANSFORM_JSON);
    out.source = attributes.SOURCE;
    out.sourceKind = attributes.SOURCE_KIND;
    out.sourceMode = attributes.SOURCE_MODE;
    out.sourcePath = attributes.SOURCE_PATH;
    out.sourceAttributes = parseJsonAttribute(attributes.SOURCE_ATTRIBUTES_JSON);
    out.isonoteRawText = attributes.ISONOTE_RAW_TEXT;
    out.isonoteNoteName = attributes.ISONOTE_NOTE_NAME;
    out.matchMethod = attributes.ISONOTE_MATCH_METHOD;
    out.confidence = attributes.ISONOTE_MATCH_CONFIDENCE;
    out.warningCode = attributes.WARNING_CODE;
    out.warningMessage = attributes.WARNING_MESSAGE;
    out.diagnostics = parseJsonAttribute(attributes.DIAGNOSTICS_JSON) || [];
  }
  return out;
}

function parseJsonAttribute(value) {
  if (!value || value === 'N/A') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function frameScene(scene) {
  const box = new THREE.Box3().setFromObject(scene);
  const center = box.getCenter(new THREE.Vector3());
  scene.position.sub(center);
}

function v3(value) {
  return new THREE.Vector3(Number(value[0]), Number(value[1]), Number(value[2]));
}

function positiveNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid RVM preview ${fieldName}: expected positive number`);
  return parsed;
}

function nonNegativeNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid RVM preview ${fieldName}: expected non-negative number`);
  return parsed;
}

function finiteNumberOrDefault(value, defaultValue, fieldName) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid RVM preview ${fieldName}: expected finite number`);
  return parsed;
}
