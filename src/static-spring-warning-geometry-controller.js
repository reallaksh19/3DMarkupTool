import * as THREE from 'three';

// Narrow runtime geometry correction for ISONOTE SPRING_WARNING symbols.
// This must never classify LINE_STOP / LIMIT / REST / GUIDE as spring geometry.
// It only replaces an already-exported SPRING_WARNING/SPRING coil mesh that is
// lying along the pipe tangent with a vertical below-pipe spring symbol.
const VERSION = 'spring-warning-vertical-geometry-20260620';
const TARGET_FAMILIES = new Set(['SPRING_WARNING', 'SPRING']);
const EXCLUDED_FAMILIES = new Set(['LINE_STOP', 'LIMIT', 'REST', 'HOLDDOWN', 'GUIDE', 'AXIS_RESTRAINT', 'AXIS_RESTRAINT_UNRESOLVED']);
const REPLACEMENT_SUFFIX = '_VERTICAL_CAN_SPRING_SYMBOL';

let modelRoot = null;
let pendingRefresh = 0;

bootstrapSpringWarningGeometryController();

function bootstrapSpringWarningGeometryController() {
  window.__3D_MARKUP_SPRING_WARNING_GEOMETRY_VERSION__ = VERSION;
  window.addEventListener('viewer:runtime-context', (event) => scheduleRuntimeUpdate(event.detail || {}));
  window.addEventListener('markup:render-context', (event) => scheduleRuntimeUpdate(event.detail || {}));
  window.addEventListener('viewer:model-loaded', (event) => {
    scheduleRuntimeUpdate({ ...(event.detail || {}), ...(window.__3D_MARKUP_VIEWER_RUNTIME__ || {}) });
  });
  window.setTimeout(() => scheduleRuntimeUpdate(window.__3D_MARKUP_VIEWER_RUNTIME__ || {}), 0);
  window.setTimeout(() => scheduleRuntimeUpdate(window.__3D_MARKUP_VIEWER_RUNTIME__ || {}), 900);
  window.setTimeout(() => scheduleRuntimeUpdate(window.__3D_MARKUP_VIEWER_RUNTIME__ || {}), 2400);
}

function scheduleRuntimeUpdate(detail = {}) {
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || {};
  modelRoot = detail.modelRoot || runtime.modelRoot || modelRoot;
  if (!modelRoot?.traverse) return;
  window.clearTimeout(pendingRefresh);
  pendingRefresh = window.setTimeout(() => applySpringWarningGeometry(modelRoot), 0);
}

function applySpringWarningGeometry(root) {
  const targets = [];
  root.traverse((object) => {
    if (isTargetHorizontalSpringCoil(object)) targets.push(object);
  });

  let replaced = 0;
  for (const object of targets) {
    if (replaceHorizontalSpringCoil(object)) replaced += 1;
  }

  window.dispatchEvent(new CustomEvent('viewer:spring-warning-geometry-ready', {
    detail: { version: VERSION, candidates: targets.length, replaced }
  }));
}

function isTargetHorizontalSpringCoil(object) {
  if (!object?.isMesh) return false;
  const data = object.userData || {};
  const type = String(data.TYPE || data.type || '').toUpperCase();
  const family = String(data.family || data.FAMILY || '').toUpperCase();
  const name = String(object.name || '').toUpperCase();

  if (type !== 'SUPPORT_RESTRAINT') return false;
  if (!TARGET_FAMILIES.has(family)) return false;
  if (EXCLUDED_FAMILIES.has(family)) return false;
  if (!name.includes('SPRING_COIL')) return false;
  if (object.userData.springWarningGeometryVersion === VERSION) return false;
  if (object.parent?.getObjectByName?.(`${object.name}${REPLACEMENT_SUFFIX}`)) return false;
  return true;
}

function replaceHorizontalSpringCoil(object) {
  const parent = object.parent;
  if (!parent) return false;

  const worldBox = new THREE.Box3().setFromObject(object);
  if (worldBox.isEmpty()) return false;

  const worldCenter = worldBox.getCenter(new THREE.Vector3());
  const worldSize = worldBox.getSize(new THREE.Vector3());
  const localCenter = parent.worldToLocal(worldCenter.clone());
  const maxExtent = Math.max(worldSize.x, worldSize.y, worldSize.z, 0.75);
  const minExtent = Math.max(Math.min(worldSize.x, worldSize.y, worldSize.z), 0.05);
  const height = clamp(maxExtent, 0.85, 2.05);
  const radius = clamp(Math.max(minExtent * 1.35, height * 0.18), 0.18, 0.42);

  const group = new THREE.Group();
  group.name = `${object.name}${REPLACEMENT_SUFFIX}`;
  group.position.copy(localCenter);
  group.userData = {
    ...(object.userData || {}),
    meshRole: 'SPRING_WARNING_VERTICAL_GEOMETRY',
    visualResolverApplied: true,
    visualResolver: 'spring-warning-below-pipe-vertical-geometry',
    springWarningGeometryVersion: VERSION,
    originalMeshName: object.name,
    originalGeometryHidden: true,
    axis: 'BELOW_PIPE, FACING_UPWARD',
    sign: '+Y / UPWARD'
  };

  const material = cloneOrCreateSpringMaterial(object.material);
  const plateMaterial = material.clone();
  plateMaterial.color = new THREE.Color(0xf0bf54);
  plateMaterial.emissive = new THREE.Color(0x3a2300);
  plateMaterial.emissiveIntensity = Math.max(plateMaterial.emissiveIntensity || 0, 0.16);

  const coil = createVerticalCoil(radius, height, material, `${object.name}_VERTICAL_COIL`);
  const topPlate = createPlate(radius * 1.34, height / 2, plateMaterial, `${object.name}_TOP_PLATE`);
  const bottomPlate = createPlate(radius * 1.42, -height / 2, plateMaterial, `${object.name}_BOTTOM_PLATE`);
  const guideRod = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, height * 1.18, 14), plateMaterial);
  guideRod.name = `${object.name}_CENTER_ROD`;
  guideRod.userData = { ...group.userData, meshRole: 'SPRING_WARNING_CENTER_ROD' };

  for (const child of [bottomPlate, coil, topPlate, guideRod]) {
    child.userData = { ...group.userData, meshRole: child.name.endsWith('COIL') ? 'SPRING_WARNING_VERTICAL_COIL' : child.name.replace(`${object.name}_`, '') };
    child.renderOrder = Math.max(child.renderOrder || 0, 18);
    group.add(child);
  }

  object.visible = false;
  object.userData.springWarningGeometryVersion = VERSION;
  object.userData.hiddenBySpringWarningGeometryResolver = true;
  parent.add(group);
  return true;
}

function createVerticalCoil(radius, height, material, name) {
  const points = [];
  const coils = 5.25;
  const steps = 126;
  const wireRadius = clamp(radius * 0.12, 0.026, 0.052);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const theta = t * coils * Math.PI * 2;
    points.push(new THREE.Vector3(
      Math.cos(theta) * radius,
      (t - 0.5) * height,
      Math.sin(theta) * radius
    ));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, steps, wireRadius, 10, false), material);
  mesh.name = name;
  return mesh;
}

function createPlate(radius, y, material, name) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.12, 28), material);
  mesh.name = name;
  mesh.position.y = y;
  return mesh;
}

function cloneOrCreateSpringMaterial(material) {
  const base = Array.isArray(material) ? material[0] : material;
  const cloned = base?.clone?.() || new THREE.MeshStandardMaterial({ color: 0xd273ff, roughness: 0.62, metalness: 0.08 });
  cloned.side = THREE.DoubleSide;
  cloned.transparent = false;
  cloned.opacity = 1;
  cloned.depthTest = true;
  cloned.depthWrite = true;
  cloned.needsUpdate = true;
  return cloned;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || min));
}
