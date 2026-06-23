import * as THREE from 'three';
import { createManagedStageSupportPreviewObject } from './managed-stage-support-visual-resolver.js';
import { parseManagedStageIsonoteSupportRecords } from './managed-stage-isonote-support-mapper.js';
import { MANAGED_STAGE_SUPPORT_SOURCE_MODES } from './managed-stage-support-mapper-config.js';

export const MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_BRIDGE_SCHEMA = 'ManagedStageSupportSourcePreviewBridge.v1';
export const MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_DIAGNOSTICS_SCHEMA = 'ManagedStageSupportSourcePreviewDiagnostics.v1';
export const MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_BRIDGE_CACHE_KEY = '20260623-staged-json-support-source-preview-3';
export const ISONOTE_SUPPORT_SOURCE_OVERLAY_ROOT = 'MANAGED_STAGE_SUPPORT_SOURCE_OVERLAY_ISONOTE';

export function installManagedStageSupportSourcePreviewBridge({ win = globalThis.window, doc = globalThis.document } = {}) {
  if (!win || win.__3D_MARKUP_SUPPORT_SOURCE_PREVIEW_BRIDGE__?.schema === MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_BRIDGE_SCHEMA) {
    return win?.__3D_MARKUP_SUPPORT_SOURCE_PREVIEW_BRIDGE__ || null;
  }
  const api = {
    schema: MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_BRIDGE_SCHEMA,
    cacheKey: MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_BRIDGE_CACHE_KEY,
    apply: (modelRoot, options = {}) => applyManagedStageSupportSourcePreview(modelRoot, { ...options, doc })
  };
  win.__3D_MARKUP_SUPPORT_SOURCE_PREVIEW_BRIDGE__ = api;
  win.addEventListener?.('viewer:managed-stage-json-loaded', (event) => {
    const root = event?.detail?.modelRoot;
    const ui = win.__3D_MARKUP_SUPPORT_SOURCE_UI__ || {};
    api.apply(root, {
      sourceMode: ui.sourceMode,
      mapperConfig: ui.mapperConfig,
      isonoteText: readIsonoteText(doc)
    });
  });
  return api;
}

export function applyManagedStageSupportSourcePreview(modelRoot, options = {}) {
  if (!modelRoot?.traverse) {
    return bridgeResult('skipped', { reason: 'missing modelRoot' });
  }
  const sourceMode = normalizeSupportSourceMode(options.sourceMode);
  const mapperConfigApplied = hasMapperConfig(options.mapperConfig);
  const removed = removeGeneratedSupportPreviewObjects(modelRoot, {
    removeStagedJsonSymbols: sourceMode !== MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON,
    removeIsonoteOverlay: true
  });

  if (sourceMode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF) {
    stampBridgeAudit(modelRoot, bridgeResult('off', { sourceMode, removed, mapperConfigApplied }));
    return modelRoot.userData.managedStageSupportSourcePreview;
  }

  if (sourceMode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON) {
    stampBridgeAudit(modelRoot, bridgeResult('stagedJson', { sourceMode, removed, mapperConfigApplied }));
    return modelRoot.userData.managedStageSupportSourcePreview;
  }

  const pipeRecords = collectPreviewPipeRecordsFromScene(modelRoot);
  const supportRecords = buildIsonoteSupportPreviewRecords(options.isonoteText || '', pipeRecords, options);
  const overlay = createIsonoteSupportOverlay(supportRecords, pipeRecords, options);
  if (overlay.children.length) modelRoot.add(overlay);
  stampBridgeAudit(modelRoot, bridgeResult('isonote', {
    sourceMode,
    removed,
    mapperConfigApplied,
    pipeRecordCount: pipeRecords.length,
    isonoteSupportRecordCount: supportRecords.length,
    overlayPrimitiveGroupCount: overlay.children.length
  }));
  return modelRoot.userData.managedStageSupportSourcePreview;
}

export function normalizeSupportSourceMode(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'off' || text === 'none' || text === 'disabled') return MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF;
  if (text === 'isonote' || text === 'iso_note' || text === 'iso-note' || text === 'note') return MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE;
  return MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON;
}

export function collectPreviewPipeRecordsFromScene(modelRoot) {
  const records = [];
  modelRoot?.traverse?.((object) => {
    const data = object?.userData || {};
    if (data.primitiveKind !== 'raw-staged-source-line') return;
    const apos = clonePoint(data.sourceAposMm);
    const lpos = clonePoint(data.sourceLposMm);
    if (!apos || !lpos) return;
    records.push({
      node: null,
      attrs: {
        TYPE: String(data.stagedType || 'PIPE'),
        DTXR: String(data.dtxr || data.rawType || 'PIPE'),
        FROM_NODE: String(data.fromNode || ''),
        TO_NODE: String(data.toNode || '')
      },
      rawName: String(data.sourceName || object.name || 'PIPE'),
      name: String(data.sourceName || object.name || 'PIPE'),
      path: String(data.sourcePath || object.name || 'PIPE'),
      type: String(data.stagedType || 'PIPE'),
      rawType: String(data.rawType || data.dtxr || ''),
      dtxr: String(data.dtxr || 'PIPE'),
      fromNode: String(data.fromNode || ''),
      toNode: String(data.toNode || ''),
      source: { apos, lpos, start: apos, end: lpos }
    });
  });
  return records;
}

export function buildIsonoteSupportPreviewRecords(isonoteText = '', pipeRecords = [], options = {}) {
  const parsed = parseManagedStageIsonoteSupportRecords(isonoteText, options.mapperConfig || {});
  const nodePoints = buildNodePointMap(pipeRecords);
  return parsed.map((entry, index) => {
    const nodeId = String(entry.nodeId || entry.attrs?.NODE || '').trim();
    const supportCoord = clonePoint(nodePoints.get(nodeId));
    if (!supportCoord) return null;
    const attrs = {
      ...(entry.attrs || {}),
      TYPE: 'SUPPORT',
      DTXR: 'SUPPORT',
      RAW_TYPE: 'ISONOTE_SUPPORT',
      NODE: nodeId,
      SUPPORT_SOURCE_MODE: MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE,
      SUPPORTCOORD: supportCoord,
      POS: supportCoord
    };
    const family = entry.mapperRecord?.family || attrs.SUPPORT_KIND_MAPPED || attrs.SUPPORT_KIND || 'SUPPORT';
    return {
      node: null,
      attrs,
      rawName: `ISONOTE ${nodeId || 'NODE'} ${family} ${index + 1}`,
      name: `ISONOTE_${safeName(nodeId || 'NODE')}_${safeName(family)}_${index + 1}`,
      path: `ISONOTE/${safeName(nodeId || 'NODE')}/${safeName(family)}/${index + 1}`,
      type: 'SUPPORT',
      rawType: 'ISONOTE_SUPPORT',
      dtxr: 'SUPPORT',
      fromNode: nodeId,
      toNode: '',
      source: { supportCoord, pos: supportCoord, start: null, end: null },
      isonoteMapperRecord: entry.mapperRecord,
      isonoteRawText: entry.rawText || ''
    };
  }).filter(Boolean);
}

export function collectManagedStageSupportSourcePreviewDiagnostics(modelRoot, result = {}) {
  const diagnostics = {
    schema: MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_DIAGNOSTICS_SCHEMA,
    sourceMode: result.sourceMode || '',
    status: result.status || '',
    removed: Number(result.removed || 0),
    mapperConfigApplied: Boolean(result.mapperConfigApplied),
    pipeRecordCount: Number(result.pipeRecordCount || 0),
    isonoteSupportRecordCount: Number(result.isonoteSupportRecordCount || 0),
    overlayPrimitiveGroupCount: Number(result.overlayPrimitiveGroupCount || 0),
    isonoteOverlayRootCount: 0,
    supportSymbolCount: 0,
    stagedJsonSymbolCount: 0,
    isonoteSymbolCount: 0,
    supportVisualPartCount: 0,
    supportFamilyHistogram: {},
    popupRequiredCount: 0,
    warningCount: 0,
    gapRecordScopedCount: 0,
    gapCarryForwardViolationCount: 0,
    maxGlyphLengthMm: 0,
    maxClusterOffsetMm: 0,
    maxGapVisualSeparationMm: 0,
    activeSourceExclusive: true,
    pass: true
  };

  modelRoot?.traverse?.((object) => {
    const data = object?.userData || {};
    if (object?.name === ISONOTE_SUPPORT_SOURCE_OVERLAY_ROOT) diagnostics.isonoteOverlayRootCount += 1;

    if (data.managedStageSupportVisualPart) {
      diagnostics.supportVisualPartCount += 1;
      diagnostics.maxGlyphLengthMm = Math.max(diagnostics.maxGlyphLengthMm, numeric(data.supportGlyphLengthMm));
      if (data.gapCarryForward === true || data.gapCarryForward === 'TRUE') diagnostics.gapCarryForwardViolationCount += 1;
      return;
    }

    if (!(data.managedStageSupportVisual && data.primitiveKind === 'managed-stage-support-symbol')) return;

    const visual = data.supportVisual || {};
    const family = String(visual.family || data.supportFamily || 'UNKNOWN').trim() || 'UNKNOWN';
    const sourceMode = data.supportSourceMode || (data.isonoteSupportOverlay ? MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE : MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON);
    diagnostics.supportSymbolCount += 1;
    if (sourceMode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE) diagnostics.isonoteSymbolCount += 1;
    else diagnostics.stagedJsonSymbolCount += 1;
    diagnostics.supportFamilyHistogram[family] = (diagnostics.supportFamilyHistogram[family] || 0) + 1;

    if (data.popupRequired || visual.popupRequired) diagnostics.popupRequiredCount += 1;
    if (visual.popupRequired || visual.fallbackCrossRods || /WARNING|UNKNOWN/.test(family)) diagnostics.warningCount += 1;
    if (visual.gapRecordScoped) diagnostics.gapRecordScopedCount += 1;
    if (visual.gapCarryForward) diagnostics.gapCarryForwardViolationCount += 1;
    diagnostics.maxClusterOffsetMm = Math.max(diagnostics.maxClusterOffsetMm, numeric(visual.cluster?.offsetMagnitudeMm));
    diagnostics.maxGapVisualSeparationMm = Math.max(diagnostics.maxGapVisualSeparationMm, numeric(visual.gapVisualSeparationMm));
  });

  diagnostics.activeSourceExclusive = !(diagnostics.stagedJsonSymbolCount > 0 && diagnostics.isonoteSymbolCount > 0);
  diagnostics.pass = diagnostics.activeSourceExclusive
    && diagnostics.gapCarryForwardViolationCount === 0
    && (diagnostics.sourceMode !== MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF || diagnostics.supportSymbolCount === 0);
  diagnostics.maxGlyphLengthMm = round(diagnostics.maxGlyphLengthMm);
  diagnostics.maxClusterOffsetMm = round(diagnostics.maxClusterOffsetMm);
  diagnostics.maxGapVisualSeparationMm = round(diagnostics.maxGapVisualSeparationMm);
  return diagnostics;
}

function createIsonoteSupportOverlay(supportRecords, pipeRecords, options = {}) {
  const overlay = new THREE.Group();
  overlay.name = ISONOTE_SUPPORT_SOURCE_OVERLAY_ROOT;
  overlay.userData = {
    TYPE: ISONOTE_SUPPORT_SOURCE_OVERLAY_ROOT,
    schema: MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_BRIDGE_SCHEMA,
    sourceMode: MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE,
    previewOnly: true,
    exportedRvmGeometry: false,
    supportSourceModeExclusive: true,
    mapperConfigApplied: hasMapperConfig(options.mapperConfig)
  };
  const allRecords = [...pipeRecords, ...supportRecords];
  for (const record of supportRecords) {
    const preview = createManagedStageSupportPreviewObject(record, {
      ...options,
      records: allRecords,
      pointRadius: options.pointRadius || 30,
      fallbackRadius: options.fallbackRadius || 12
    });
    if (!preview?.object) continue;
    preview.object.userData = {
      ...(preview.object.userData || {}),
      supportSourceMode: MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE,
      isonoteSupportOverlay: true,
      isonoteRawText: record.isonoteRawText || '',
      mapperConfigApplied: hasMapperConfig(options.mapperConfig)
    };
    overlay.add(preview.object);
  }
  return overlay;
}

function removeGeneratedSupportPreviewObjects(modelRoot, { removeStagedJsonSymbols = false, removeIsonoteOverlay = true } = {}) {
  let removed = 0;
  const toRemove = [];
  modelRoot.traverse((object) => {
    if (!object?.parent) return;
    const data = object.userData || {};
    if (removeIsonoteOverlay && (object.name === ISONOTE_SUPPORT_SOURCE_OVERLAY_ROOT || data.isonoteSupportOverlay)) {
      toRemove.push(object);
      return;
    }
    if (removeStagedJsonSymbols && data.managedStageSupportVisual && data.primitiveKind === 'managed-stage-support-symbol') {
      toRemove.push(object);
    }
  });
  for (const object of toRemove) {
    object.parent?.remove?.(object);
    disposeObject(object);
    removed += 1;
  }
  return removed;
}

function buildNodePointMap(records = []) {
  const map = new Map();
  for (const record of records) {
    if (record.fromNode && record.source?.apos && !map.has(String(record.fromNode))) map.set(String(record.fromNode), record.source.apos);
    if (record.toNode && record.source?.lpos && !map.has(String(record.toNode))) map.set(String(record.toNode), record.source.lpos);
  }
  return map;
}

function stampBridgeAudit(modelRoot, result) {
  const diagnostics = collectManagedStageSupportSourcePreviewDiagnostics(modelRoot, result);
  modelRoot.userData = {
    ...(modelRoot.userData || {}),
    managedStageSupportSourcePreview: {
      ...result,
      diagnostics
    }
  };
}

function bridgeResult(status, extra = {}) {
  return {
    schema: MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_BRIDGE_SCHEMA,
    cacheKey: MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_BRIDGE_CACHE_KEY,
    status,
    ...extra
  };
}

function readIsonoteText(doc) {
  return doc?.getElementById?.('isonoteText')?.value || '';
}

function disposeObject(object) {
  object.traverse?.((child) => {
    if (child.geometry?.dispose) child.geometry.dispose();
    const material = child.material;
    if (Array.isArray(material)) material.forEach((entry) => entry?.dispose?.());
    else material?.dispose?.();
  });
}

function clonePoint(point) {
  return point ? { x: Number(point.x) || 0, y: Number(point.y) || 0, z: Number(point.z) || 0 } : null;
}

function safeName(value) {
  return String(value || 'SUPPORT').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '') || 'SUPPORT';
}

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0;
}

function hasMapperConfig(config) {
  return Boolean(config && typeof config === 'object' && Object.keys(config).length > 0);
}

if (typeof window !== 'undefined') {
  const start = () => installManagedStageSupportSourcePreviewBridge();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('markup:app-ready', start, { once: true });
}
