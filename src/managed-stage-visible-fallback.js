import * as THREE from 'three';
import { cylinderBetween, mat } from './geometry.js?v=professional-viewer-3';

const FALLBACK_GROUP_NAME = 'MANAGED_STAGE_VISIBLE_FALLBACK';
const MAX_FALLBACK_OBJECTS = 6000;

const FALLBACK_COLORS = Object.freeze({
  PIPE: 0x3d74c5,
  FLAN: 0x9a9a9a,
  FLANGE: 0x9a9a9a,
  VALV: 0xcc2222,
  VALVE: 0xcc2222,
  BEND: 0xaa55aa,
  ELBOW: 0xaa55aa,
  TEE: 0x55aa55,
  OLET: 0x55aa55,
  SUPPORT: 0x2a9fd6,
  ATTA: 0x2a9fd6,
  BRANCH: 0x446688,
  UNKNOWN: 0x73b9ff
});

export function appendManagedStageVisibleFallback(previewScene, sourceText, options = {}) {
  if (!previewScene || !sourceText) return null;
  const json = parseManagedStageJson(sourceText);
  const roots = Array.isArray(json?.hierarchy) ? json.hierarchy : [json].filter(Boolean);
  const { candidates, radiusBasis } = collectRenderableCandidates(roots);
  const existingNames = collectExistingNames(previewScene);
  const group = new THREE.Group();
  group.name = FALLBACK_GROUP_NAME;
  group.userData = {
    TYPE: 'MANAGED_STAGE_VISIBLE_FALLBACK',
    source: 'managed-stage-raw-json-preview-fallback',
    exportedRvmGeometry: false
  };

  const radius = Math.max(Math.min(radiusBasis * 0.02, 80), 5);
  const pointRadius = Math.max(radius * 1.6, 12);
  let supportMarkerCount = 0;
  let rawGeometryFallbackCount = 0;
  let added = 0;

  for (const candidate of candidates) {
    if (added >= (options.maxFallbackObjects || MAX_FALLBACK_OBJECTS)) break;
    const supportLike = isSupportLike(candidate.type);
    const represented = candidate.keys.some((key) => existingNames.has(key));
    if (represented && !supportLike) continue;
    const mesh = candidate.start && candidate.end && !supportLike
      ? createFallbackCylinder(candidate, radius)
      : createFallbackPointMarker(candidate, pointRadius);
    if (!mesh) continue;
    mesh.name = candidate.path;
    mesh.userData = {
      ...(mesh.userData || {}),
      TYPE: supportLike ? 'SUPPORT_RESTRAINT' : 'MANAGED_STAGE_RAW_FALLBACK',
      sourceName: candidate.name,
      sourcePath: candidate.path,
      rawType: candidate.rawType,
      stagedType: candidate.type,
      fallbackRenderable: true,
      exportedRvmGeometry: false,
      supportKind: candidate.supportKind || '',
      node: candidate.node || '',
      fromNode: candidate.fromNode || '',
      toNode: candidate.toNode || ''
    };
    group.add(mesh);
    if (supportLike) supportMarkerCount += 1;
    else rawGeometryFallbackCount += 1;
    added += 1;
  }

  if (!group.children.length) {
    return { schema: 'ManagedStageVisibleFallback.v1', candidateCount: candidates.length, meshCount: 0, supportMarkerCount: 0, rawGeometryFallbackCount: 0 };
  }

  previewScene.add(group);
  const audit = {
    schema: 'ManagedStageVisibleFallback.v1',
    source: 'raw managed-stage JSON APOS/LPOS/POS/BPOS fallback overlay',
    candidateCount: candidates.length,
    meshCount: group.children.length,
    supportMarkerCount,
    rawGeometryFallbackCount,
    exportedRvmGeometry: false
  };
  previewScene.userData = { ...(previewScene.userData || {}), managedStageVisibleFallback: audit };
  return audit;
}

export function collectRenderableCandidates(rootNodes) {
  const candidates = [];
  const lengths = [];
  const walk = (node, parentPath = '') => {
    if (!node || typeof node !== 'object') return;
    const attrs = attrsOf(node);
    const name = String(node.name || node.id || attrs.NAME || attrs.REF || 'Node').trim() || 'Node';
    const path = parentPath ? `${parentPath}/${name}` : name;
    const type = nodeType(node);
    const start = pickPoint(node, ['APOS', 'A_POS', 'HPOS', 'H_POS', 'START', 'EP1', 'ABOP']);
    const end = pickPoint(node, ['LPOS', 'L_POS', 'TPOS', 'T_POS', 'END', 'EP2', 'LBOP']);
    const pos = pickPoint(node, ['POS', 'CPOS', 'CO_ORDS', 'COORDS', 'CO_ORD', 'BPOS', 'BRANCH_POINT', 'SUPPORTCOORD', 'SUPPORT_COORD']);
    const distance = start && end ? pointDistance(start, end) : 0;
    if (start && end && distance > 0.001) {
      lengths.push(distance);
      candidates.push(candidateFrom(node, attrs, path, name, type, { start, end }));
    } else if (pos || start || end) {
      candidates.push(candidateFrom(node, attrs, path, name, type, { pos: pos || start || end }));
    }
    for (const child of Array.isArray(node.children) ? node.children : []) walk(child, path);
  };
  for (const root of Array.isArray(rootNodes) ? rootNodes : [rootNodes].filter(Boolean)) walk(root, '');
  return { candidates, radiusBasis: median(lengths) };
}

function candidateFrom(node, attrs, path, name, type, geometry) {
  const sourceName = String(attrs.NAME || attrs.SOURCE_ELEMENT_ID || attrs.SUPPORT_TAG || name || '').trim();
  return {
    path,
    name: sourceName || name,
    keys: [path, name, sourceName, attrs.SOURCE_ELEMENT_ID, attrs.REF, attrs.SUPPORT_TAG].filter(Boolean).map(String),
    type,
    rawType: String(attrs.RAW_TYPE || type || ''),
    supportKind: String(attrs.SUPPORT_KIND || attrs.SUPPORT_TYPE || attrs.CMPSUPTYPE || ''),
    node: String(attrs.NODE || ''),
    fromNode: String(attrs.FROM_NODE || ''),
    toNode: String(attrs.TO_NODE || ''),
    ...geometry
  };
}

function createFallbackCylinder(candidate, radius) {
  const mesh = cylinderBetween(toVec(candidate.start), toVec(candidate.end), radius, mat(colorFor(candidate.type)), 10, candidate.path);
  mesh.userData = { TYPE: 'MANAGED_STAGE_RAW_FALLBACK', primitiveKind: 'raw-staged-cylinder' };
  return mesh;
}

function createFallbackPointMarker(candidate, radius) {
  const pos = candidate.pos || candidate.start || candidate.end;
  if (!pos) return null;
  const geometry = isSupportLike(candidate.type)
    ? new THREE.BoxGeometry(radius * 1.8, radius * 1.8, radius * 1.8)
    : new THREE.SphereGeometry(radius, 12, 8);
  const mesh = new THREE.Mesh(geometry, mat(colorFor(candidate.type)));
  mesh.position.copy(toVec(pos));
  mesh.userData = { TYPE: isSupportLike(candidate.type) ? 'SUPPORT_RESTRAINT' : 'MANAGED_STAGE_RAW_FALLBACK', primitiveKind: 'raw-staged-point-marker' };
  return mesh;
}

function collectExistingNames(scene) {
  const names = new Set();
  scene?.traverse?.((object) => {
    for (const value of [object.name, object.userData?.sourceName, object.userData?.NAME, object.userData?.SOURCE_ELEMENT_ID]) {
      if (value) names.add(String(value));
    }
  });
  return names;
}

function parseManagedStageJson(sourceText) {
  try {
    return JSON.parse(sourceText);
  } catch {
    return null;
  }
}

function attrsOf(node) {
  return node && typeof node === 'object' && node.attributes && typeof node.attributes === 'object' ? node.attributes : {};
}

function nodeType(node) {
  const raw = String(node?.type || attrsOf(node).TYPE || '').toUpperCase();
  if (raw === 'VALV') return 'VALVE';
  if (raw === 'FLAN') return 'FLANGE';
  if (raw === 'ELBO') return 'ELBOW';
  if (raw === 'REDU') return 'REDUCER';
  if (raw === 'BRAN') return 'BRANCH';
  if (raw === 'ATTA' || raw === 'ANCI' || raw === 'SUPP' || raw === 'SUPC') return 'SUPPORT';
  return raw || 'UNKNOWN';
}

function colorFor(type) {
  return FALLBACK_COLORS[type] || FALLBACK_COLORS.UNKNOWN;
}

function isSupportLike(type) {
  return type === 'SUPPORT' || type === 'ATTA';
}

function toVec(point) {
  return new THREE.Vector3(point.x, point.y, point.z);
}

function pointDistance(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function median(values) {
  const list = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  return list.length ? list[Math.floor(list.length * 0.5)] : 100;
}

function pickPoint(node, keys) {
  const attrs = attrsOf(node);
  for (const key of keys) {
    const value = attrs[key] ?? attrs[key.toLowerCase?.()] ?? node?.[key] ?? node?.[key.toLowerCase?.()];
    const point = pointFrom(value);
    if (point) return point;
  }
  return null;
}

function pointFrom(value) {
  if (!value && value !== 0) return null;
  if (Array.isArray(value) && value.length >= 3) return pointFromArray(value);
  if (typeof value === 'object') return pointFromObject(value);
  const directional = parseDirectional(value);
  if (directional) return directional;
  const nums = String(value || '').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number).filter(Number.isFinite) || [];
  return nums.length >= 3 ? { x: nums[0], y: nums[1], z: nums[2] } : null;
}

function pointFromArray(value) {
  const x = asNumber(value[0]);
  const y = asNumber(value[1]);
  const z = asNumber(value[2]);
  return x == null || y == null || z == null ? null : { x, y, z };
}

function pointFromObject(value) {
  const x = asNumber(value.x ?? value.X ?? value.e ?? value.E);
  const y = asNumber(value.y ?? value.Y ?? value.n ?? value.N);
  const z = asNumber(value.z ?? value.Z ?? value.u ?? value.U);
  return x == null || y == null || z == null ? null : { x, y, z };
}

function asNumber(value) {
  const n = Number.parseFloat(String(value ?? '').replace(/mm/gi, '').trim());
  return Number.isFinite(n) ? n : null;
}

function parseDirectional(text) {
  const src = String(text || '').trim();
  if (!src) return null;
  const tokens = src.split(/\s+/g);
  const out = { x: 0, y: 0, z: 0 };
  let parsed = false;
  for (let i = 0; i < tokens.length - 1; i += 2) {
    const axis = String(tokens[i] || '').toUpperCase();
    const value = asNumber(tokens[i + 1]);
    if (value == null) continue;
    if (axis === 'E') { out.x = value; parsed = true; }
    else if (axis === 'W') { out.x = -value; parsed = true; }
    else if (axis === 'N') { out.y = value; parsed = true; }
    else if (axis === 'S') { out.y = -value; parsed = true; }
    else if (axis === 'U') { out.z = value; parsed = true; }
    else if (axis === 'D') { out.z = -value; parsed = true; }
  }
  return parsed ? out : null;
}
