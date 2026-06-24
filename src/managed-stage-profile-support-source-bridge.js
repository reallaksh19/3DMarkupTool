import * as THREE from 'three';

export const MANAGED_STAGE_PROFILE_SUPPORT_SOURCE_BRIDGE_SCHEMA = 'ManagedStageProfileSupportSourceBridge.v1';
export const MANAGED_STAGE_PROFILE_SUPPORT_SOURCE_BRIDGE_CACHE_KEY = '20260624-profile-support-source-canvas-1';
export const PROFILE_SUPPORT_SOURCE_RECORD_ROOT = 'MANAGED_STAGE_PROFILE_SUPPORT_SOURCE_RECORDS';

installManagedStageProfileSupportSourceBridge();

export function installManagedStageProfileSupportSourceBridge({ win = globalThis.window } = {}) {
  if (!win) return null;
  if (win.__3D_MARKUP_PROFILE_SUPPORT_SOURCE_BRIDGE__?.schema === MANAGED_STAGE_PROFILE_SUPPORT_SOURCE_BRIDGE_SCHEMA) {
    return win.__3D_MARKUP_PROFILE_SUPPORT_SOURCE_BRIDGE__;
  }

  const api = {
    schema: MANAGED_STAGE_PROFILE_SUPPORT_SOURCE_BRIDGE_SCHEMA,
    cacheKey: MANAGED_STAGE_PROFILE_SUPPORT_SOURCE_BRIDGE_CACHE_KEY,
    ensure: (modelRoot, options = {}) => ensureProfileSupportSourceRecords(modelRoot, { win, ...options })
  };
  win.__3D_MARKUP_PROFILE_SUPPORT_SOURCE_BRIDGE__ = api;

  const wrapBridgeApply = () => {
    const bridge = win.__3D_MARKUP_SUPPORT_SOURCE_PREVIEW_BRIDGE__;
    if (!bridge?.apply || bridge.__profileSupportSourceBridgeWrapped) return false;
    const originalApply = bridge.apply.bind(bridge);
    bridge.apply = (modelRoot, options = {}) => {
      api.ensure(modelRoot, { requestedBy: 'bridge-apply-wrapper' });
      return originalApply(modelRoot, options);
    };
    bridge.__profileSupportSourceBridgeWrapped = true;
    bridge.profileSupportSourceBridge = {
      schema: MANAGED_STAGE_PROFILE_SUPPORT_SOURCE_BRIDGE_SCHEMA,
      cacheKey: MANAGED_STAGE_PROFILE_SUPPORT_SOURCE_BRIDGE_CACHE_KEY
    };
    return true;
  };

  if (!wrapBridgeApply()) {
    win.setTimeout?.(wrapBridgeApply, 0);
    win.addEventListener?.('viewer:managed-stage-json-ui-ready', wrapBridgeApply);
    win.addEventListener?.('viewer:app-module-loaded', wrapBridgeApply);
  }

  win.addEventListener?.('viewer:managed-stage-json-loaded', (event) => {
    api.ensure(event?.detail?.modelRoot, { requestedBy: 'viewer:managed-stage-json-loaded' });
  });

  return api;
}

export function ensureProfileSupportSourceRecords(modelRoot, { win = globalThis.window, requestedBy = 'manual' } = {}) {
  if (!modelRoot?.traverse) return { schema: MANAGED_STAGE_PROFILE_SUPPORT_SOURCE_BRIDGE_SCHEMA, status: 'skipped', reason: 'missing-model-root', injectedCount: 0 };

  const supportRecords = resolveProfileSupportRecords(modelRoot, win);
  removePriorProfileSupportRecordRoot(modelRoot);

  const audit = {
    schema: MANAGED_STAGE_PROFILE_SUPPORT_SOURCE_BRIDGE_SCHEMA,
    cacheKey: MANAGED_STAGE_PROFILE_SUPPORT_SOURCE_BRIDGE_CACHE_KEY,
    status: supportRecords.length ? 'injected' : 'empty',
    requestedBy,
    profileSupportRecordCount: supportRecords.length,
    injectedCount: 0,
    skippedNoPositionCount: 0,
    skippedNoTokenCount: 0,
    source: supportRecords.source || 'none'
  };

  if (!supportRecords.length) {
    stampAudit(modelRoot, audit);
    return audit;
  }

  const host = new THREE.Group();
  host.name = PROFILE_SUPPORT_SOURCE_RECORD_ROOT;
  host.visible = false;
  host.userData = {
    TYPE: PROFILE_SUPPORT_SOURCE_RECORD_ROOT,
    schema: MANAGED_STAGE_PROFILE_SUPPORT_SOURCE_BRIDGE_SCHEMA,
    previewOnly: true,
    exportedRvmGeometry: false,
    profileSupportSourceHost: true
  };

  supportRecords.forEach((record, index) => {
    const source = profileSupportRecordToPreviewUserData(record, index);
    if (!source.tokenLike) {
      audit.skippedNoTokenCount += 1;
      return;
    }
    if (!source.position) {
      audit.skippedNoPositionCount += 1;
      return;
    }
    const object = new THREE.Object3D();
    object.name = source.name;
    object.position.set(source.position.x, source.position.y, source.position.z);
    object.userData = source.userData;
    host.add(object);
    audit.injectedCount += 1;
  });

  if (host.children.length) modelRoot.add(host);
  else disposeObject(host);
  stampAudit(modelRoot, audit);
  return audit;
}

function resolveProfileSupportRecords(modelRoot, win) {
  const direct = asArray(modelRoot?.userData?.managedStageProfileSupportRecords);
  if (direct.length) {
    direct.source = 'modelRoot.userData.managedStageProfileSupportRecords';
    return direct;
  }
  const artifact = win?.__3D_MARKUP_MANAGED_STAGE_JSON_UI__?.getActiveArtifact?.();
  const fromArtifact = asArray(artifact?.profile?.supportRecords);
  if (fromArtifact.length) {
    fromArtifact.source = 'activeArtifact.profile.supportRecords';
    modelRoot.userData = { ...(modelRoot.userData || {}), managedStageProfileSupportRecords: fromArtifact };
    return fromArtifact;
  }
  return [];
}

function profileSupportRecordToPreviewUserData(record = {}, index = 0) {
  const attrs = normalizeAttributes(record.attributes || record.attrs || {});
  const position = firstPoint(attrs.SUPPORTCOORD, attrs.SUPPORT_COORD, attrs.SCOORD, attrs.SUPPORT_POINT, attrs.SUPPORT_POS, attrs.POS, attrs.BPOS);
  const sourceName = firstText(record.name, record.rawName, attrs.NAME, attrs.SUPPORT_TAG, `PROFILE_SUPPORT_${index + 1}`);
  const sourcePath = firstText(record.path, attrs.REF, sourceName);
  const stagedType = firstText(record.type, attrs.TYPE, 'SUPPORT');
  const dtxr = firstText(attrs.DTXR, attrs.RAW_TYPE, attrs.SUPPORT_KIND, attrs.SUPPORT_TYPE, stagedType, 'SUPPORT');
  const rawType = firstText(attrs.RAW_TYPE, stagedType, dtxr, 'SUPPORT');
  const tokenText = [stagedType, dtxr, rawType, attrs.SUPPORT_KIND, attrs.SUPPORT_TYPE, attrs.RESTRAINT_KIND, attrs.RESTRAINT, attrs.SUPPORT_GRAPHICS_RULE, attrs.GRAPHICS_RULE, attrs.NAME, sourceName, sourcePath].filter(Boolean).join(' ');
  const tokenLike = /\b(ATTA|ANCI|SUPP|SUPPORT|PIPE_SUPPORT|PIPESUPPORT|REST|RESTRAINT|GUIDE|GUID|HOLDDOWN|HOLD_DOWN|LINE\s*STOP|LINE_STOP|LINESTOP|LIMIT|LIM|SPRING\s*CAN|SPRING_CAN|SPRINGCAN|ANCHOR)\b/i.test(tokenText);

  const userData = {
    TYPE: 'MANAGED_STAGE_PROFILE_SUPPORT_SOURCE_RECORD',
    primitiveKind: 'raw-staged-source-point',
    profileSupportSourceRecord: true,
    previewOnly: true,
    exportedRvmGeometry: false,
    sourceName,
    sourcePath,
    rawType,
    stagedType,
    dtxr,
    fromNode: firstText(attrs.FROM_NODE, attrs.NODE),
    toNode: firstText(attrs.TO_NODE),
    sourceAttributes: attrs,
    stagedJsonAttributes: attrs,
    rawAttributes: attrs,
    previewPosMm: clonePoint(position),
    sourcePosMm: clonePoint(position),
    sourceSupportCoordMm: clonePoint(position),
    supportCoordMm: clonePoint(position),
    SUPPORTCOORD: clonePoint(position),
    POS: clonePoint(position),
    coordinatePolicy: 'profile parser supportRecords injected as non-rendered raw-staged-source-point records for stagedJson support overlay bridge'
  };

  return { name: `PROFILE_SUPPORT_SOURCE_${index + 1}_${safeName(sourceName)}`, position, tokenLike, userData };
}

function normalizeAttributes(attrs = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(attrs || {})) {
    if (!key || value === undefined || value === null) continue;
    normalized[String(key).trim()] = value;
  }
  return normalized;
}

function removePriorProfileSupportRecordRoot(modelRoot) {
  const prior = [];
  modelRoot.traverse?.((object) => {
    if (object?.parent && (object.name === PROFILE_SUPPORT_SOURCE_RECORD_ROOT || object.userData?.profileSupportSourceHost)) prior.push(object);
  });
  for (const object of prior) {
    object.parent?.remove?.(object);
    disposeObject(object);
  }
}

function disposeObject(object) {
  object?.traverse?.((node) => {
    node.geometry?.dispose?.();
    const material = node.material;
    if (Array.isArray(material)) material.forEach((item) => item?.dispose?.());
    else material?.dispose?.();
  });
}

function stampAudit(modelRoot, audit) {
  modelRoot.userData = {
    ...(modelRoot.userData || {}),
    managedStageProfileSupportSourceBridge: audit
  };
}

function asArray(value) {
  return Array.isArray(value) ? [...value] : [];
}

function firstText(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function firstPoint(...values) {
  for (const value of values) {
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

function asNumber(value) {
  const n = Number.parseFloat(String(value ?? '').replace(/mm\b/gi, '').trim());
  return Number.isFinite(n) ? n : null;
}

function clonePoint(point) {
  return point ? { x: point.x, y: point.y, z: point.z } : null;
}

function safeName(value) {
  return String(value || 'SUPPORT').replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'SUPPORT';
}
