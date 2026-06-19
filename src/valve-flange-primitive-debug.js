import * as THREE from 'three';

export const VALVE_FLANGE_PRIMITIVE_DEBUG_SCHEMA = 'ValveFlangePrimitiveDebug.v1';

export function debugLinearPrimitivePlan(plan = []) {
  return plan.map((p, index) => ({
    schemaVersion: VALVE_FLANGE_PRIMITIVE_DEBUG_SCHEMA,
    index,
    primitiveName: p.role || '',
    primitiveKind: p.kind || '',
    localAxisStart: axisStart(p),
    localAxisEnd: axisEnd(p),
    center: finite(p.axialOffset),
    length: finite(p.length),
    radius: finite(p.radius),
    radiusStart: finite(p.radiusStart),
    radiusEnd: finite(p.radiusEnd),
    material: p.visualMaterial || p.material || ''
  }));
}

export function debugValveFlangePrimitiveMeshes(sceneOrGroup, componentId) {
  const wanted = String(componentId || '');
  const rows = [];
  walk(sceneOrGroup, (object) => {
    const d = object?.userData || {};
    const id = String(d.componentId || d.ID || d.id || '');
    if (id !== wanted || !d.visualCatalogSchema || d.meshRole === 'CATALOG_VISUAL_GROUP' || object.visible === false) return;
    const worldPosition = new THREE.Vector3();
    object.getWorldPosition?.(worldPosition);
    const box = new THREE.Box3().setFromObject(object);
    rows.push({
      schemaVersion: VALVE_FLANGE_PRIMITIVE_DEBUG_SCHEMA,
      primitiveName: d.meshRole || object.name || '',
      primitiveKind: d.kind || d.geometryKind || object.geometry?.type || object.type || '',
      localAxisStart: axisStart(d),
      localAxisEnd: axisEnd(d),
      center: finite(d.axialOffset),
      length: finite(d.length),
      radius: finite(d.radius),
      radiusStart: finite(d.radiusStart),
      radiusEnd: finite(d.radiusEnd),
      material: object.material?.name || (object.material?.color?.getHexString ? `#${object.material.color.getHexString()}` : ''),
      meshName: object.name || '',
      worldPosition: vec(worldPosition),
      boundingBox: box.isEmpty() ? null : { min: vec(box.min), max: vec(box.max) }
    });
  });
  return rows.sort((a, b) => (a.localAxisStart ?? 1e9) - (b.localAxisStart ?? 1e9));
}

function axisStart(p) {
  if (Number.isFinite(p.localAxisStart)) return finite(p.localAxisStart);
  return Number.isFinite(p.axialOffset) && Number.isFinite(p.length) ? finite(p.axialOffset - p.length / 2) : null;
}

function axisEnd(p) {
  if (Number.isFinite(p.localAxisEnd)) return finite(p.localAxisEnd);
  return Number.isFinite(p.axialOffset) && Number.isFinite(p.length) ? finite(p.axialOffset + p.length / 2) : null;
}

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(6)) : null;
}

function vec(v) {
  return { x: finite(v.x), y: finite(v.y), z: finite(v.z) };
}

function walk(root, visit) {
  visit(root);
  for (const child of Array.isArray(root?.children) ? root.children : []) walk(child, visit);
}
