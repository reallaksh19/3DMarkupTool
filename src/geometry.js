import * as THREE from 'three';
import { resolveSupportRestraintVisualSpec } from './support-restraint-visual-catalog.js';
import { buildSupportRestraintPrimitiveRecords, assertSupportRestraintWriterSafePrimitives } from './support-restraint-primitive-adapter.js';

export const COLORS = { pipe: 0xf0f4f8, rigid: 0x8fb2d8, valve: 0x21d4c4, bend: 0x67d4ef, rest: 0xf8c34a, guide: 0x18d5c0, lineStop: 0xf2a93b, holddown: 0xf05ab9, spring: 0xd273ff, warning: 0xff8c73, isonote: 0x211b2e, node: 0x66c8ff, text: 0xffffff };

export function mat(color, opts = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.04, side: THREE.DoubleSide, ...opts }); }
export function vectorFrom(p, scale = 0.01) { return new THREE.Vector3(p.x * scale, p.y * scale, p.z * scale); }

export function cylinderBetween(a, b, radius, material, radialSegments = 16, name = 'cylinder') {
  const delta = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, Math.max(delta.length(), 0.0001), radialSegments, 1, false), material);
  mesh.name = name;
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  return mesh;
}

export function coneArrow(start, dir, length, radius, material, name = 'arrow') {
  const group = new THREE.Group();
  group.name = name;
  const d = dir.clone().normalize();
  const stemLen = length * 0.68;
  const headLen = length * 0.32;
  group.add(cylinderBetween(start, start.clone().add(d.clone().multiplyScalar(stemLen)), radius * 0.35, material, 12, `${name}_stem`));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, headLen, 18), material);
  cone.name = `${name}_head`;
  cone.position.copy(start).add(d.clone().multiplyScalar(stemLen + headLen / 2));
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  group.add(cone);
  return group;
}

export function arrowToward(tip, dirTowardTip, length, radius, material, name = 'arrowToward') {
  const d = dirTowardTip.clone().normalize();
  return coneArrow(tip.clone().sub(d.clone().multiplyScalar(length)), d, length, radius, name);
}

export function createTextPlane(text, options = {}) {
  const { width = 512, height = 192, fontSize = 34, bg = 'rgba(20,18,32,0.90)', fg = '#ffffff', border = '#ffc56e', lineHeight = 1.18, padding = 18, scale = 1, name = 'text-plane' } = options;
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const fallback = new THREE.Mesh(
      new THREE.PlaneGeometry((width / 120) * scale, (height / 120) * scale),
      new THREE.MeshBasicMaterial({ color: COLORS.text, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
    );
    fallback.name = name;
    fallback.userData = { textPlaneFallback: true, text: String(text || '') };
    return fallback;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  roundRect(ctx, 5, 5, width - 10, height - 10, 18, bg, border, 4);
  ctx.font = `700 ${fontSize}px Arial, sans-serif`;
  ctx.fillStyle = fg;
  ctx.textBaseline = 'top';
  const lines = wrapText(ctx, String(text || ''), width - padding * 2, 5);
  const y0 = Math.max(padding, (height - lines.length * fontSize * lineHeight) / 2);
  lines.forEach((line, i) => ctx.fillText(line, padding, y0 + i * fontSize * lineHeight));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry((width / 120) * scale, (height / 120) * scale), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
  mesh.name = name;
  return mesh;
}

export function createNodeLabel(label, position, scale = 0.55) {
  const plane = createTextPlane(label, { width: 170, height: 78, fontSize: 34, bg: 'rgba(8,21,33,0.94)', border: '#7cc7ff', fg: '#eaffff', scale, name: `NODE_LABEL_${label}` });
  plane.position.copy(position);
  return plane;
}

export function createWarningTriangle(label = '!', scale = 0.8) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 1);
  shape.lineTo(-1, -0.75);
  shape.lineTo(1, -0.75);
  shape.closePath();
  const tri = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat(COLORS.warning, { emissive: 0x330010, emissiveIntensity: 0.2 }));
  tri.name = 'warning_triangle';
  tri.scale.setScalar(scale);
  const txt = createTextPlane(label, { width: 96, height: 96, fontSize: 66, bg: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)', fg: '#2b0010', scale: 0.42, name: 'warning_triangle_text' });
  txt.position.z = 0.02;
  const g = new THREE.Group();
  g.name = 'warning_marker';
  g.add(tri, txt);
  return g;
}

export function createSpringCoil(center, axis = new THREE.Vector3(0, 1, 0), radius = 0.22, length = 1.0, material = mat(COLORS.spring), name = 'spring_coil') {
  const points = [];
  const coils = 5;
  const steps = 96;
  const dir = resolveSpringCoilAxis(axis, name);
  const a = orthogonal(dir);
  const b = new THREE.Vector3().crossVectors(dir, a).normalize();
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const theta = t * coils * Math.PI * 2;
    points.push(center.clone().add(dir.clone().multiplyScalar((t - 0.5) * length)).add(a.clone().multiplyScalar(Math.cos(theta) * radius)).add(b.clone().multiplyScalar(Math.sin(theta) * radius)));
  }
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 120, 0.035, 8, false), material);
  tube.name = name;
  return tube;
}

export function resolveSpringCoilAxis(axis = new THREE.Vector3(0, 1, 0), name = 'spring_coil') {
  const n = String(name || '').toUpperCase();
  if (n.includes('SPRING_WARNING') && n.includes('BELOW_PIPE')) return new THREE.Vector3(0, 1, 0);
  return axis.clone().normalize();
}

export function orthogonal(dir) {
  const d = dir.clone().normalize();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const projectedUp = worldUp.clone().sub(d.clone().multiplyScalar(worldUp.dot(d)));
  if (projectedUp.lengthSq() > 1e-8) return projectedUp.normalize();
  const worldX = new THREE.Vector3(1, 0, 0);
  const projectedX = worldX.clone().sub(d.clone().multiplyScalar(worldX.dot(d)));
  if (projectedX.lengthSq() > 1e-8) return projectedX.normalize();
  return new THREE.Vector3(0, 0, 1);
}

export function dominantAxis(vec) {
  const av = { x: Math.abs(vec.x), y: Math.abs(vec.y), z: Math.abs(vec.z) };
  if (av.x >= av.y && av.x >= av.z) return 'X';
  if (av.y >= av.x && av.y >= av.z) return 'Y';
  return 'Z';
}

export function axisVector(axis) {
  const sign = String(axis).startsWith('-') ? -1 : 1;
  const a = String(axis).replace(/[+\-]/g, '').toUpperCase();
  if (a === 'X') return new THREE.Vector3(sign, 0, 0);
  if (a === 'Y') return new THREE.Vector3(0, sign, 0);
  return new THREE.Vector3(0, 0, sign);
}

function roundRect(ctx, x, y, w, h, r, fill, stroke, lineWidth) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.lineWidth = lineWidth; ctx.strokeStyle = stroke; ctx.stroke(); }
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth || !line) line = trial;
    else {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (words.length && lines.length === maxLines && words.join(' ').length > lines.join(' ').length) lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s+\S+$/, '')} ...`;
  return lines;
}

const SUPPORT_SCENE_SCALE = 0.01;
const supportUserDataStore = new WeakMap();
const supportCatalogueGeometryFlag = Symbol.for('3DMarkupTool.supportRestraintCatalogueGeometryAdapter.v1');
const supportUserDataStampFlag = Symbol.for('3DMarkupTool.supportRestraintCatalogueUserDataStamp.v1');

function installSupportRestraintCatalogueUserDataStamping() {
  const proto = THREE.Object3D?.prototype;
  if (!proto || proto[supportUserDataStampFlag]) return;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'userData');
  if (descriptor && descriptor.configurable === false) return;
  Object.defineProperty(proto, 'userData', {
    configurable: true,
    enumerable: true,
    get() {
      if (!supportUserDataStore.has(this)) supportUserDataStore.set(this, {});
      return supportUserDataStore.get(this);
    },
    set(value) {
      const stamped = stampSupportRestraintCatalogueUserData(value);
      supportUserDataStore.set(this, stamped);
      replaceSupportRestraintGeometryWithCatalogueAdapter(this, stamped);
    }
  });
  Object.defineProperty(proto, supportUserDataStampFlag, { configurable: false, value: true });
}

function stampSupportRestraintCatalogueUserData(value) {
  if (!value || typeof value !== 'object' || value.TYPE !== 'SUPPORT_RESTRAINT') return value;
  const spec = resolveSupportRestraintVisualSpec({ family: value.family || value.FAMILY || value.axis });
  return {
    ...value,
    SUPPORT_CATALOGUE_VISUAL: true,
    SUPPORT_CATALOGUE_FAMILY: spec.family,
    SUPPORT_CATALOGUE_RECIPE_ID: spec.recipeId,
    SUPPORT_CATALOGUE_SCHEMA: spec.catalogSchemaVersion,
    SUPPORT_CATALOGUE_PROPORTIONAL_FALLBACK: spec.proportionalFallback,
    SUPPORT_CATALOGUE_VENDOR_DIMENSIONAL_DB_BACKED: spec.vendorDimensionalDbBacked,
    SUPPORT_CATALOGUE_EXPORT_PRODUCTION_WIRING: true,
    supportCatalogueVisual: true,
    supportCatalogueFamily: spec.family,
    supportCatalogueRecipeId: spec.recipeId,
    supportCatalogueSchema: spec.catalogSchemaVersion,
    supportCatalogueProportionalFallback: spec.proportionalFallback,
    supportCatalogueVendorDimensionalDbBacked: spec.vendorDimensionalDbBacked,
    supportCatalogueExportProductionWiring: true,
    supportCatalogueSceneParity: 'CATALOGUE_GEOMETRY_ADAPTER',
    supportCatalogueSceneMetadataOnly: false,
    supportCatalogueSceneGeometryAdapter: true
  };
}

function replaceSupportRestraintGeometryWithCatalogueAdapter(object, userData) {
  if (!object || object[supportCatalogueGeometryFlag] || !userData || userData.TYPE !== 'SUPPORT_RESTRAINT') return;
  const spec = resolveSupportRestraintVisualSpec({ family: userData.family || userData.FAMILY || userData.axis });
  const context = inferSupportCatalogueSceneContext(object, userData, spec);
  let primitives = [];
  try {
    primitives = buildSupportRestraintPrimitiveRecords(userData, context);
    assertSupportRestraintWriterSafePrimitives(primitives);
  } catch (error) {
    supportUserDataStore.set(object, { ...userData, supportCatalogueSceneGeometryAdapterError: String(error?.message || error) });
    return;
  }
  if (!primitives.length) return;
  while (object.children?.length) object.remove(object.children[0]);
  if (object.isMesh) {
    object.visible = false;
    object.renderOrder = -1;
  }
  for (const primitive of primitives) {
    const child = createSupportCataloguePrimitiveObject(primitive, spec);
    if (child) object.add(child);
  }
  Object.defineProperty(object, supportCatalogueGeometryFlag, { configurable: false, value: true });
}

function inferSupportCatalogueSceneContext(object, userData, spec) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
  const size = box.isEmpty() ? new THREE.Vector3(1, 1, 1) : box.getSize(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z, 0.8);
  const od = Math.max(100, Math.min(800, (maxAxis / SUPPORT_SCENE_SCALE) * 0.45));
  return {
    point: [center.x / SUPPORT_SCENE_SCALE, center.y / SUPPORT_SCENE_SCALE, center.z / SUPPORT_SCENE_SCALE],
    tangent: supportTangentFromUserData(userData),
    od,
    gapMm: finiteNumber(userData.gapMm, 0),
    sourceClass: userData.sourceClass || 'SUPPORT',
    node: userData.node || 'NODE',
    material: supportMaterialCodeForFamily(spec.family)
  };
}

function createSupportCataloguePrimitiveObject(primitive, spec) {
  const material = supportMaterialForPrimitive(primitive, spec);
  const name = primitive.name || `SUPPORT_${primitive.role || primitive.kind}`;
  let object = null;
  if (primitive.kind === 'cylinder') {
    const center = sceneVectorFromArray(primitive.center);
    const dir = sceneDirectionFromArray(primitive.direction);
    const half = Math.max(primitive.length * SUPPORT_SCENE_SCALE, 0.0001) / 2;
    object = cylinderBetween(center.clone().sub(dir.clone().multiplyScalar(half)), center.clone().add(dir.clone().multiplyScalar(half)), Math.max(primitive.radius * SUPPORT_SCENE_SCALE, 0.001), material, 12, name);
  } else if (primitive.kind === 'pyramid') {
    const dir = sceneDirectionFromArray(primitive.direction);
    const height = Math.max(primitive.height * SUPPORT_SCENE_SCALE, 0.0001);
    const radius = Math.max(Math.max(...(primitive.bottom || [primitive.height * 0.5, primitive.height * 0.5])) * SUPPORT_SCENE_SCALE * 0.5, 0.001);
    object = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 4), material);
    object.name = name;
    object.position.copy(sceneVectorFromArray(primitive.center));
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  } else if (primitive.kind === 'box') {
    const lengths = primitive.lengths || [100, 100, 100];
    object = new THREE.Mesh(new THREE.BoxGeometry(Math.max(lengths[0] * SUPPORT_SCENE_SCALE, 0.001), Math.max(lengths[1] * SUPPORT_SCENE_SCALE, 0.001), Math.max(lengths[2] * SUPPORT_SCENE_SCALE, 0.001)), material);
    object.name = name;
    object.position.copy(sceneVectorFromArray(primitive.center));
  } else if (primitive.kind === 'sphere') {
    object = new THREE.Mesh(new THREE.SphereGeometry(Math.max((primitive.diameter || 50) * SUPPORT_SCENE_SCALE * 0.5, 0.001), 12, 8), material);
    object.name = name;
    object.position.copy(sceneVectorFromArray(primitive.center));
  }
  if (object) {
    object.userData = {
      TYPE: 'SUPPORT_RESTRAINT_PART',
      meshRole: primitive.role,
      primitiveKind: primitive.kind,
      supportCataloguePrimitiveAdapter: true,
      supportCatalogueSceneParity: 'CATALOGUE_GEOMETRY_ADAPTER',
      supportCatalogueFamily: spec.family,
      supportCatalogueRecipeId: spec.recipeId,
      supportCatalogueSchema: spec.catalogSchemaVersion,
      supportCatalogueProportionalFallback: spec.proportionalFallback,
      supportCatalogueVendorDimensionalDbBacked: spec.vendorDimensionalDbBacked,
      supportVisualKey: primitive.supportVisualKey,
      supportVisualRecipeId: primitive.supportVisualRecipeId,
      supportVisualFamily: primitive.supportVisualFamily,
      adapterOrdinal: primitive.adapterOrdinal
    };
  }
  return object;
}

function supportTangentFromUserData(userData = {}) {
  const axis = String(userData.axis || '').toUpperCase();
  if (/^[+-]?[XYZ]$/.test(axis)) {
    const v = axisVector(axis.startsWith('+') || axis.startsWith('-') ? axis : `+${axis}`);
    return [v.x, v.y, v.z];
  }
  return [1, 0, 0];
}

function sceneVectorFromArray(value = [0, 0, 0]) {
  return new THREE.Vector3((Number(value[0]) || 0) * SUPPORT_SCENE_SCALE, (Number(value[1]) || 0) * SUPPORT_SCENE_SCALE, (Number(value[2]) || 0) * SUPPORT_SCENE_SCALE);
}

function sceneDirectionFromArray(value = [1, 0, 0]) {
  const v = new THREE.Vector3(Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0);
  return v.lengthSq() > 1e-12 ? v.normalize() : new THREE.Vector3(1, 0, 0);
}

function supportMaterialCodeForFamily(family) {
  if (family === 'GUIDE') return COLORS.guide;
  if (family === 'LINE_STOP' || family === 'LIMIT_STOP' || family === 'AXIS_RESTRAINT') return COLORS.lineStop;
  if (family === 'HOLDDOWN') return COLORS.holddown;
  if (family === 'SPRING') return COLORS.spring;
  if (family === 'UNKNOWN_RESTRAINT') return COLORS.warning;
  return COLORS.rest;
}

function supportMaterialForPrimitive(primitive, spec) {
  const color = Number.isFinite(primitive.material) && primitive.material > 0 ? primitive.material : supportMaterialCodeForFamily(spec.family);
  return mat(color, { emissive: Math.max(0, color & 0x1f1f1f), emissiveIntensity: 0.16 });
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

installSupportRestraintCatalogueUserDataStamping();
