import * as THREE from 'three';

const SPRING_CAN_ORIENTATION_VERSION = 'spring-can-upward-orientation-20260620';
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const SUPPORT_TYPE = 'SUPPORT_RESTRAINT';
const RESOLVED_AXIS = 'BELOW_PIPE, FACING_UPWARD';
const RESOLVED_SIGN = '+Y / UPWARD';
const RESOLVER_NAME = 'spring-can-below-pipe-facing-upward';
const PROCESS_FLAG = '__springCanUpwardOrientationApplied';

const runtimeState = {
  scene: null,
  modelRoot: null,
  lastCount: 0
};

window.__3D_MARKUP_SPRING_CAN_ORIENTATION__ = {
  version: SPRING_CAN_ORIENTATION_VERSION,
  apply: () => applySpringCanOrientation('manual'),
  get lastCount() { return runtimeState.lastCount; }
};

window.addEventListener('viewer:runtime-context', (event) => {
  runtimeState.scene = event.detail?.scene || runtimeState.scene;
  runtimeState.modelRoot = event.detail?.modelRoot || runtimeState.modelRoot;
  scheduleApply('runtime-context');
});
window.addEventListener('markup:render-context', (event) => {
  runtimeState.scene = event.detail?.scene || runtimeState.scene;
  runtimeState.modelRoot = event.detail?.modelRoot || runtimeState.modelRoot;
  scheduleApply('render-context');
});
window.addEventListener('viewer:model-loaded', (event) => {
  runtimeState.modelRoot = event.detail?.modelRoot || event.detail?.scene || runtimeState.modelRoot;
  scheduleApply('model-loaded');
});
window.addEventListener('viewer:selection-changed', () => scheduleApply('selection-changed'));

scheduleApply('module-load');

function scheduleApply(reason) {
  window.requestAnimationFrame(() => applySpringCanOrientation(reason));
}

function applySpringCanOrientation(reason = 'apply') {
  const root = runtimeState.modelRoot || runtimeState.scene || window.__3D_MARKUP_VIEWER_RUNTIME__?.modelRoot || window.__3D_MARKUP_VIEWER_RUNTIME__?.scene;
  if (!root?.traverse) return 0;

  const targets = [];
  root.traverse((object) => {
    const data = object.userData || {};
    if (isSpringCanSupport(data)) targets.push(object);
  });

  let applied = 0;
  for (const target of targets) {
    patchSpringCanMetadata(target.userData);
    target.traverse?.((child) => patchSpringCanMetadata(child.userData || (child.userData = {})));
    if (target.userData?.[PROCESS_FLAG]) continue;
    const visual = replaceSpringCanVisual(target);
    if (visual) applied += 1;
  }

  runtimeState.lastCount = targets.length;
  window.dispatchEvent(new CustomEvent('viewer:spring-can-orientation-ready', {
    detail: { version: SPRING_CAN_ORIENTATION_VERSION, reason, targets: targets.length, visuals: applied }
  }));
  return targets.length;
}

function isSpringCanSupport(data = {}) {
  const type = String(data.TYPE || data.type || '').toUpperCase();
  if (type !== SUPPORT_TYPE) return false;
  const family = String(data.family || data.FAMILY || '').toUpperCase();
  const text = [
    family,
    data.axis || data.AXIS,
    data.sourceNoteName || data.SOURCE_NOTE_NAME,
    data.warningText || data.WARNING_TEXT,
    data.loadText || data.LOAD_TEXT,
    data.name || data.NAME
  ].join(' ').toUpperCase();
  return family === 'SPRING' || family === 'SPRING_WARNING' || /\b(CAN|SPRING|HANGER)\b/.test(text);
}

function patchSpringCanMetadata(data = {}) {
  data.axis = RESOLVED_AXIS;
  data.AXIS = RESOLVED_AXIS;
  data.sign = RESOLVED_SIGN;
  data.SIGN = RESOLVED_SIGN;
  data.supportAxis = 'BELOW_PIPE';
  data.SUPPORT_AXIS = 'BELOW_PIPE';
  data.facing = 'UPWARD';
  data.FACING = 'UPWARD';
  data.visualResolverApplied = true;
  data.visualResolver = RESOLVER_NAME;
  data.visualOrientation = RESOLVED_AXIS;
  data.orientationContract = 'CAN/SPRING_SUPPORT_BELOW_PIPE_FACING_UPWARD';
  return data;
}

function replaceSpringCanVisual(target) {
  const parent = target.parent;
  if (!parent) return null;

  const box = new THREE.Box3().setFromObject(target);
  if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) return null;

  const worldCenter = box.getCenter(new THREE.Vector3());
  const worldSize = box.getSize(new THREE.Vector3());
  const height = clamp(Math.max(worldSize.x, worldSize.y, worldSize.z, 0.95), 0.95, 1.8);
  const radius = clamp(Math.min(Math.max(worldSize.x, worldSize.z) * 0.22, 0.32), 0.14, 0.32);

  target.visible = false;
  target.userData[PROCESS_FLAG] = true;
  patchSpringCanMetadata(target.userData);

  const parentInvWorld = new THREE.Matrix4().copy(parent.matrixWorld).invert();
  const localCenter = parent.worldToLocal(worldCenter.clone());
  const localUp = WORLD_UP.clone().transformDirection(parentInvWorld).normalize();
  const sideA = orthogonal(localUp);
  const sideB = new THREE.Vector3().crossVectors(localUp, sideA).normalize();

  const group = new THREE.Group();
  group.name = `${target.name || 'SPRING_CAN'}_FACING_UPWARD_VISUAL`;
  group.position.copy(localCenter);
  group.userData = { ...target.userData, meshRole: 'SPRING_CAN_FACING_UPWARD_VISUAL', [PROCESS_FLAG]: true };

  const material = makeSpringMaterial(target);
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0x332400, emissiveIntensity: 0.18, roughness: 0.68, metalness: 0.08, transparent: true, opacity: 0.96, side: THREE.DoubleSide });

  const coil = new THREE.Mesh(createVerticalCoilGeometry(localUp, sideA, sideB, radius, height * 0.54), material);
  coil.name = `${group.name}_COIL_VERTICAL_UPWARD`;
  coil.userData = { ...group.userData, meshRole: 'SPRING_COIL_VERTICAL', axisDirection: '+Y', facing: 'UPWARD' };
  group.add(coil);

  const bottomCenter = localUp.clone().multiplyScalar(-height * 0.43);
  const base = cylinderAt(bottomCenter, localUp, height * 0.18, radius * 1.45, frameMaterial, `${group.name}_CAN_BASE`);
  base.userData = { ...group.userData, meshRole: 'SPRING_CAN_BASE' };
  group.add(base);

  const topCenter = localUp.clone().multiplyScalar(height * 0.36);
  const topPad = cylinderAt(topCenter, localUp, height * 0.08, radius * 1.28, frameMaterial, `${group.name}_TOP_PAD_FACING_PIPE`);
  topPad.userData = { ...group.userData, meshRole: 'SPRING_TOP_PAD_FACING_UPWARD' };
  group.add(topPad);

  const upwardArrow = upwardDirectionMarker(localUp, sideA, radius, height, frameMaterial, `${group.name}_UPWARD_FACE_MARKER`);
  upwardArrow.userData = { ...group.userData, meshRole: 'SPRING_FACING_UPWARD_MARKER' };
  group.add(upwardArrow);

  parent.add(group);
  return group;
}

function makeSpringMaterial(target) {
  const source = firstMeshMaterial(target);
  if (source?.clone) {
    const material = source.clone();
    material.depthTest = true;
    material.depthWrite = true;
    material.side = THREE.DoubleSide;
    material.transparent = true;
    material.opacity = Math.max(0.82, material.opacity || 1);
    return material;
  }
  return new THREE.MeshStandardMaterial({ color: 0xd273ff, emissive: 0x331021, emissiveIntensity: 0.22, roughness: 0.68, metalness: 0.04, side: THREE.DoubleSide });
}

function firstMeshMaterial(object) {
  let material = null;
  object.traverse?.((child) => {
    if (!material && child.isMesh && child.material) material = Array.isArray(child.material) ? child.material[0] : child.material;
  });
  return material;
}

function createVerticalCoilGeometry(axis, sideA, sideB, radius, height) {
  const points = [];
  const coils = 5;
  const steps = 96;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const theta = t * coils * Math.PI * 2;
    points.push(axis.clone().multiplyScalar((t - 0.5) * height)
      .add(sideA.clone().multiplyScalar(Math.cos(theta) * radius))
      .add(sideB.clone().multiplyScalar(Math.sin(theta) * radius)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 120, Math.max(0.025, radius * 0.15), 8, false);
}

function cylinderAt(center, axis, length, radius, material, name) {
  const geometry = new THREE.CylinderGeometry(radius, radius, Math.max(length, 0.001), 24, 1, false);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(center);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
  return mesh;
}

function upwardDirectionMarker(axis, sideA, radius, height, material, name) {
  const group = new THREE.Group();
  group.name = name;
  const start = axis.clone().multiplyScalar(-height * 0.12).add(sideA.clone().multiplyScalar(radius * 1.75));
  const stemLength = height * 0.34;
  const stem = cylinderAt(start.clone().add(axis.clone().multiplyScalar(stemLength * 0.5)), axis, stemLength, radius * 0.12, material, `${name}_STEM`);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.34, height * 0.18, 18), material);
  cone.name = `${name}_HEAD`;
  cone.position.copy(start.clone().add(axis.clone().multiplyScalar(stemLength + height * 0.09)));
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
  group.add(stem, cone);
  return group;
}

function orthogonal(axis) {
  const d = axis.clone().normalize();
  const projectedX = new THREE.Vector3(1, 0, 0).sub(d.clone().multiplyScalar(d.x));
  if (projectedX.lengthSq() > 1e-8) return projectedX.normalize();
  const projectedZ = new THREE.Vector3(0, 0, 1).sub(d.clone().multiplyScalar(d.z));
  if (projectedZ.lengthSq() > 1e-8) return projectedZ.normalize();
  return new THREE.Vector3(0, 0, 1);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
