import * as THREE from 'three';
import { createManagedStageSupportPreviewObject } from './managed-stage-support-visual-resolver.js?v=bust-cache-4';
import { parseManagedStageIsonoteSupportRecords } from './managed-stage-isonote-support-mapper.js?v=bust-cache-4';
import { MANAGED_STAGE_SUPPORT_SOURCE_MODES, normalizeManagedStageSupportMapperRecord } from './managed-stage-support-mapper-config.js?v=bust-cache-4';

export const MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_BRIDGE_SCHEMA = 'ManagedStageSupportSourcePreviewBridge.v2';
export const MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_DIAGNOSTICS_SCHEMA = 'ManagedStageSupportSourcePreviewDiagnostics.v1';
export const MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_BRIDGE_CACHE_KEY = '20260628-support-basis-exclusive-source-records';
export const ISONOTE_SUPPORT_SOURCE_OVERLAY_ROOT = 'MANAGED_STAGE_SUPPORT_SOURCE_OVERLAY_ISONOTE';
export const STAGED_JSON_SUPPORT_SOURCE_OVERLAY_ROOT = 'MANAGED_STAGE_SUPPORT_SOURCE_OVERLAY_STAGED_JSON';
const MAX_PREFLIGHT_ISSUES = 50;
const MAX_RULE_PREVIEW_ROWS = 80;

const STAGED_JSON_SUPPORT_ATTR_KEY_PATTERN = /^(DTXR|RAW_TYPE|TYPE|NAME|REF|NODE|FROM_NODE|TO_NODE|TAG|SUPPORT(?:_|$)|RESTRAINT(?:_|$)|AXIS$|DIRECTION$|SIGN$|PLUS_MINUS$|.*GAP.*)/i;
const SUPPORT_TOKEN_PATTERN = /\b(ATTA|ANCI|SUPP|SUPPORT|PIPE_SUPPORT|PIPESUPPORT|REST|RESTRAINT|GUIDE|GUID|HOLDDOWN|HOLD_DOWN|LINE\s*STOP|LINE_STOP|LINESTOP|LIMIT|LIM|SPRING\s*CAN|SPRING_CAN|SPRINGCAN|ANCHOR)\b/i;

export function installManagedStageSupportSourcePreviewBridge({ win = globalThis.window, doc = globalThis.document } = {}) {
  if (!win || win.__3D_MARKUP_SUPPORT_SOURCE_PREVIEW_BRIDGE__?.schema === MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_BRIDGE_SCHEMA) return win?.__3D_MARKUP_SUPPORT_SOURCE_PREVIEW_BRIDGE__ || null;
  const api = { schema: MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_BRIDGE_SCHEMA, cacheKey: MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_BRIDGE_CACHE_KEY, apply: (root, options = {}) => applyManagedStageSupportSourcePreview(root, { ...options, doc }) };
  win.__3D_MARKUP_SUPPORT_SOURCE_PREVIEW_BRIDGE__ = api;
  win.addEventListener?.('viewer:managed-stage-json-loaded', (event) => {
    const ui = win.__3D_MARKUP_SUPPORT_SOURCE_UI__ || {};
    api.apply(event?.detail?.modelRoot, { sourceMode: ui.sourceMode, mapperConfig: ui.mapperConfig, isonoteText: readIsonoteText(doc) });
  });
  return api;
}

export function applyManagedStageSupportSourcePreview(modelRoot, options = {}) {
  if (!modelRoot?.traverse) return bridgeResult('skipped', { reason: 'missing modelRoot' });
  const sourceMode = normalizeSupportSourceMode(options.sourceMode);
  const mapperConfigApplied = hasMapperConfig(options.mapperConfig);

  // Remove generated support-source overlays before collecting raw source records.
  // This prevents STAGED_JSON_* preview symbols from being re-ingested as if they
  // were original InputXML/stagedJson supports, and keeps stagedJson vs ISONOTE
  // basis exclusive at the overlay layer.
  const removed = removeGeneratedSupportPreviewObjects(modelRoot, {
    removeStagedJsonSymbols: false,
    removeStagedOverlay: true,
    removeIsonoteOverlay: true
  });

  const pipeRecords = sourceMode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF ? [] : collectPreviewPipeRecordsFromScene(modelRoot);
  const stagedRecords = sourceMode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON ? collectStagedJsonSupportPreviewRecords(modelRoot, options) : [];

  if (sourceMode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF) {
    stampBridgeAudit(modelRoot, bridgeResult('off', { sourceMode, removed, mapperConfigApplied }));
    return modelRoot.userData.managedStageSupportSourcePreview;
  }

  if (sourceMode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON) {
    // stagedJson/InputXML basis uses the canonical grey SUPPORT_MARKER layer that
    // is already part of the converted model. Do not add a second green preview
    // overlay such as STAGED_JSON_10_REST_1.
    stampBridgeAudit(modelRoot, bridgeResult('stagedJson', {
      sourceMode,
      removed,
      mapperConfigApplied,
      pipeRecordCount: pipeRecords.length,
      stagedJsonSupportRecordCount: stagedRecords.length,
      overlayPrimitiveGroupCount: 0,
      canonicalSupportMarkerLayer: true,
      stagedJsonPreviewOverlaySuppressed: true
    }));
    return modelRoot.userData.managedStageSupportSourcePreview;
  }

  const supportRecords = buildIsonoteSupportPreviewRecords(options.isonoteText || '', pipeRecords, options);
  const overlay = createSupportOverlay(ISONOTE_SUPPORT_SOURCE_OVERLAY_ROOT, MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE, supportRecords, pipeRecords, options);
  if (overlay.children.length) modelRoot.add(overlay);
  stampBridgeAudit(modelRoot, bridgeResult('isonote', { sourceMode, removed, mapperConfigApplied, pipeRecordCount: pipeRecords.length, isonoteSupportRecordCount: supportRecords.length, overlayPrimitiveGroupCount: overlay.children.length }));
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
    if (isStagedJsonSupportSourceCandidate(data)) return;
    const apos = clonePoint(data.sourceAposMm);
    const lpos = clonePoint(data.sourceLposMm);
    if (!apos || !lpos) return;
    const sourceAttrs = collectStagedJsonRecordAttributes(data);
    records.push({
      node: null,
      attrs: { ...sourceAttrs, TYPE: String(data.stagedType || sourceAttrs.TYPE || 'PIPE'), DTXR: String(data.dtxr || data.rawType || sourceAttrs.DTXR || 'PIPE'), FROM_NODE: String(data.fromNode || sourceAttrs.FROM_NODE || ''), TO_NODE: String(data.toNode || sourceAttrs.TO_NODE || '') },
      rawName: String(data.sourceName || object.name || 'PIPE'),
      name: String(data.sourceName || object.name || 'PIPE'),
      path: String(data.sourcePath || object.name || 'PIPE'),
      type: String(data.stagedType || sourceAttrs.TYPE || 'PIPE'),
      rawType: String(data.rawType || data.dtxr || sourceAttrs.RAW_TYPE || ''),
      dtxr: String(data.dtxr || sourceAttrs.DTXR || 'PIPE'),
      fromNode: String(data.fromNode || sourceAttrs.FROM_NODE || ''),
      toNode: String(data.toNode || sourceAttrs.TO_NODE || ''),
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
    const mappedAxisAttrs = mappedAxisOverrideAttrs(entry.mapperRecord);
    const attrs = { ...(entry.attrs || {}), ...mappedAxisAttrs, TYPE: 'SUPPORT', DTXR: 'SUPPORT', RAW_TYPE: 'ISONOTE_SUPPORT', NODE: nodeId, SUPPORT_SOURCE_MODE: MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE, SUPPORTCOORD: supportCoord, POS: supportCoord };
    const family = entry.mapperRecord?.family || attrs.SUPPORT_KIND_MAPPED || attrs.SUPPORT_KIND || 'SUPPORT';
    return { node: null, attrs, rawName: `ISONOTE ${nodeId || 'NODE'} ${family} ${index + 1}`, name: `ISONOTE_${safeName(nodeId || 'NODE')}_${safeName(family)}_${index + 1}`, path: `ISONOTE/${safeName(nodeId || 'NODE')}/${safeName(family)}/${index + 1}`, type: 'SUPPORT', rawType: 'ISONOTE_SUPPORT', dtxr: 'SUPPORT', fromNode: nodeId, toNode: '', source: { supportCoord, pos: supportCoord, start: null, end: null }, isonoteMapperRecord: entry.mapperRecord, isonoteRawText: entry.rawText || '' };
  }).filter(Boolean);
}

export function collectManagedStageSupportSourcePreviewDiagnostics(modelRoot, result = {}) {
  const diagnostics = { schema: MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_DIAGNOSTICS_SCHEMA, sourceMode: result.sourceMode || '', status: result.status || '', removed: Number(result.removed || 0), mapperConfigApplied: Boolean(result.mapperConfigApplied), pipeRecordCount: Number(result.pipeRecordCount || 0), stagedJsonSupportRecordCount: Number(result.stagedJsonSupportRecordCount || 0), isonoteSupportRecordCount: Number(result.isonoteSupportRecordCount || 0), overlayPrimitiveGroupCount: Number(result.overlayPrimitiveGroupCount || 0), stagedJsonPreviewOverlaySuppressed: Boolean(result.stagedJsonPreviewOverlaySuppressed), canonicalSupportMarkerLayer: Boolean(result.canonicalSupportMarkerLayer), stagedJsonOverlayRootCount: 0, isonoteOverlayRootCount: 0, supportSymbolCount: 0, stagedJsonSymbolCount: 0, isonoteSymbolCount: 0, supportVisualPartCount: 0, supportFamilyHistogram: {}, supportActionAxisHistogram: {}, supportCanvasAxisHistogram: {}, matchedPipeAxisHistogram: {}, axisBasisAppliedCount: 0, popupRequiredCount: 0, warningCount: 0, gapRecordScopedCount: 0, gapCarryForwardViolationCount: 0, mapperPreflightIssueCount: 0, mapperPreflightWarningCount: 0, mapperPreflightErrorCount: 0, mapperPreflightPopupRequiredCount: 0, mapperPreflightIssues: [], supportRulePreviewRows: [], maxGlyphLengthMm: 0, maxClusterOffsetMm: 0, maxGapVisualSeparationMm: 0, activeSourceExclusive: true, pass: true };
  modelRoot?.traverse?.((object) => {
    const data = object?.userData || {};
    if (object?.name === STAGED_JSON_SUPPORT_SOURCE_OVERLAY_ROOT) diagnostics.stagedJsonOverlayRootCount += 1;
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
    const itemMode = data.supportSourceMode || (data.isonoteSupportOverlay ? MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE : MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON);
    const mapperRecord = data.stagedJsonMapperRecord || data.isonoteMapperRecord || null;
    const supportActionAxes = Array.isArray(visual.supportActionAxes) && visual.supportActionAxes.length ? visual.supportActionAxes : (visual.coneSides || []).map((side) => side?.axis).filter(Boolean);
    const canvasAxis = mapperRecord?.axis?.canvasAxis || visual.canvasAxis || explicitAxisText(visual.explicitAxis);
    const matchedPipeAxis = visual.pipeAxisSigned || visual.pipeAxis || '';
    diagnostics.supportSymbolCount += 1;
    if (itemMode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE) diagnostics.isonoteSymbolCount += 1;
    else diagnostics.stagedJsonSymbolCount += 1;
    diagnostics.supportFamilyHistogram[family] = (diagnostics.supportFamilyHistogram[family] || 0) + 1;
    for (const axis of supportActionAxes) diagnostics.supportActionAxisHistogram[axis] = (diagnostics.supportActionAxisHistogram[axis] || 0) + 1;
    if (canvasAxis) diagnostics.supportCanvasAxisHistogram[canvasAxis] = (diagnostics.supportCanvasAxisHistogram[canvasAxis] || 0) + 1;
    if (matchedPipeAxis) diagnostics.matchedPipeAxisHistogram[matchedPipeAxis] = (diagnostics.matchedPipeAxisHistogram[matchedPipeAxis] || 0) + 1;
    if (mapperRecord?.attrs?.SUPPORT_AXIS_CANVAS_APPLIED === 'TRUE') diagnostics.axisBasisAppliedCount += 1;
    if (diagnostics.supportRulePreviewRows.length < MAX_RULE_PREVIEW_ROWS) {
      diagnostics.supportRulePreviewRows.push(buildSupportRulePreviewRow(object, data, visual, mapperRecord, { itemMode, family, canvasAxis, supportActionAxes, matchedPipeAxis }));
    }
    const preflight = mapperRecord?.preflight || null;
    if (preflight) {
      diagnostics.mapperPreflightIssueCount += Number(preflight.issueCount || 0);
      diagnostics.mapperPreflightWarningCount += Number(preflight.warningCount || 0);
      diagnostics.mapperPreflightErrorCount += Number(preflight.errorCount || 0);
      if (preflight.popupRequired) diagnostics.mapperPreflightPopupRequiredCount += 1;
      diagnostics.warningCount += Number(preflight.warningCount || 0);
      appendPreflightIssues(diagnostics, preflight, mapperRecord, { sourceMode: itemMode, family, supportTag: mapperRecord.supportTag || data.sourceName || data.sourcePath || '', node: visual.node || data.fromNode || data.toNode || '', axis: canvasAxis });
    }
    if (data.popupRequired || visual.popupRequired || preflight?.popupRequired) diagnostics.popupRequiredCount += 1;
    if (visual.popupRequired || visual.fallbackCrossRods || /WARNING|UNKNOWN/.test(family)) diagnostics.warningCount += 1;
    if (visual.gapRecordScoped) diagnostics.gapRecordScopedCount += 1;
    if (visual.gapCarryForward) diagnostics.gapCarryForwardViolationCount += 1;
    diagnostics.maxClusterOffsetMm = Math.max(diagnostics.maxClusterOffsetMm, numeric(visual.cluster?.offsetMagnitudeMm));
    diagnostics.maxGapVisualSeparationMm = Math.max(diagnostics.maxGapVisualSeparationMm, numeric(visual.gapVisualSeparationMm));
  });
  diagnostics.activeSourceExclusive = !(diagnostics.stagedJsonSymbolCount > 0 && diagnostics.isonoteSymbolCount > 0);
  diagnostics.pass = diagnostics.activeSourceExclusive && diagnostics.gapCarryForwardViolationCount === 0 && diagnostics.mapperPreflightErrorCount === 0 && (diagnostics.sourceMode !== MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF || diagnostics.supportSymbolCount === 0);
  diagnostics.maxGlyphLengthMm = round(diagnostics.maxGlyphLengthMm);
  diagnostics.maxClusterOffsetMm = round(diagnostics.maxClusterOffsetMm);
  diagnostics.maxGapVisualSeparationMm = round(diagnostics.maxGapVisualSeparationMm);
  return diagnostics;
}

function collectStagedJsonSupportPreviewRecords(modelRoot, options = {}) {
  const records = [];
  const seen = new Set();
  modelRoot?.traverse?.((object) => {
    const data = object?.userData || {};
    if (data.isonoteSupportOverlay || data.stagedJsonSupportOverlay || data.managedStageSupportVisual) return;
    if (!isStagedJsonSupportSourceCandidate(data)) return;
    const pos = supportRecordPositionFromData(data);
    if (!pos) return;
    const baseAttrs = buildStagedJsonSupportMapperAttrs(data, {}, pos);
    pushStagedJsonSupportRecord(records, seen, data, {}, baseAttrs, pos, options);
  });
  return records;
}

function pushStagedJsonSupportRecord(records, seen, data, visual, baseAttrs, pos, options) {
  const identity = String(data.sourcePath || data.sourceName || baseAttrs.REF || baseAttrs.NAME || records.length);
  if (seen.has(identity)) return;
  seen.add(identity);
  const mapperRecord = normalizeManagedStageSupportMapperRecord({ attrs: baseAttrs }, options.mapperConfig || {});
  const mappedAxisAttrs = mappedAxisOverrideAttrs(mapperRecord);
  const attrs = { ...baseAttrs, ...(mapperRecord.attrs || {}), ...mappedAxisAttrs, TYPE: 'SUPPORT', DTXR: 'SUPPORT', RAW_TYPE: 'STAGED_JSON_SUPPORT', SUPPORT_SOURCE_MODE: MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON, SUPPORTCOORD: pos, POS: pos };
  const family = mapperRecord.family || attrs.SUPPORT_KIND_MAPPED || visual.family || attrs.SUPPORT_KIND || 'SUPPORT';
  const nodeId = String(attrs.NODE || data.fromNode || data.toNode || visual.node || '').trim();
  const index = records.length + 1;
  records.push({ node: null, attrs, rawName: `STAGED_JSON ${nodeId || 'NODE'} ${family} ${index}`, name: `STAGED_JSON_${safeName(nodeId || 'NODE')}_${safeName(family)}_${index}`, path: `STAGED_JSON/${safeName(nodeId || 'NODE')}/${safeName(family)}/${index}`, type: 'SUPPORT', rawType: 'STAGED_JSON_SUPPORT', dtxr: 'SUPPORT', fromNode: nodeId, toNode: '', source: { supportCoord: pos, pos, start: null, end: null }, stagedJsonMapperRecord: mapperRecord });
}

function buildStagedJsonSupportMapperAttrs(data = {}, visual = {}, pos = null) {
  const sourceAttrs = collectStagedJsonRecordAttributes(data);
  const sourceAxis = visual.explicitAxis ? `${visual.explicitAxis.sign || ''}${visual.explicitAxis.axis || ''}` : '';
  const gapText = visual.gapMm ? `${visual.gapMm}mm` : '';
  const node = firstText(sourceAttrs.NODE, data.node, visual.node, data.fromNode, data.toNode);
  const supportTag = firstText(sourceAttrs.SUPPORT_TAG, sourceAttrs.SUPPORT_NO, sourceAttrs.SUPPORT_ID, sourceAttrs.TAG, data.supportTag, data.sourceName, data.sourcePath);
  const supportKind = firstText(sourceAttrs.SUPPORT_KIND, sourceAttrs.SUPPORT_TYPE, sourceAttrs.RESTRAINT_KIND, sourceAttrs.RESTRAINT, sourceAttrs.DTXR, sourceAttrs.RAW_TYPE, sourceAttrs.TYPE, visual.rawKind, visual.family, data.supportFamily, data.dtxr, data.rawType, data.stagedType);
  const graphicsRule = firstText(sourceAttrs.SUPPORT_GRAPHICS_RULE, sourceAttrs.SUPPORT_RULE, sourceAttrs.GRAPHICS_RULE, sourceAttrs.SUPPORT_KIND, sourceAttrs.SUPPORT_TYPE, sourceAttrs.DTXR, sourceAttrs.NAME, visual.rawKind, visual.family);

  return {
    ...sourceAttrs,
    TYPE: firstText(sourceAttrs.TYPE, data.stagedType, 'SUPPORT'),
    DTXR: firstText(sourceAttrs.DTXR, data.dtxr, data.rawType, sourceAttrs.SUPPORT_KIND, 'SUPPORT'),
    RAW_TYPE: firstText(sourceAttrs.RAW_TYPE, data.rawType, visual.rawKind, visual.family, 'SUPPORT'),
    NAME: firstText(sourceAttrs.NAME, data.sourceName, data.sourcePath),
    REF: firstText(sourceAttrs.REF, data.sourcePath, data.sourceName),
    NODE: node,
    FROM_NODE: firstText(sourceAttrs.FROM_NODE, data.fromNode),
    TO_NODE: firstText(sourceAttrs.TO_NODE, data.toNode),
    SUPPORT_TAG: supportTag,
    SUPPORT_KIND: supportKind,
    SUPPORT_TYPE: firstText(sourceAttrs.SUPPORT_TYPE, supportKind),
    SUPPORT_GRAPHICS_RULE: graphicsRule,
    SUPPORT_AXIS: firstText(sourceAttrs.SUPPORT_AXIS, sourceAttrs.RESTRAINT_AXIS, sourceAttrs.AXIS, sourceAttrs.DIRECTION, sourceAxis),
    RESTRAINT_AXIS: firstText(sourceAttrs.RESTRAINT_AXIS, sourceAttrs.SUPPORT_AXIS, sourceAttrs.AXIS, sourceAttrs.DIRECTION, sourceAxis),
    AXIS: firstText(sourceAttrs.AXIS, sourceAttrs.SUPPORT_AXIS, sourceAttrs.RESTRAINT_AXIS, sourceAttrs.DIRECTION, sourceAxis),
    DIRECTION: firstText(sourceAttrs.DIRECTION, sourceAttrs.SUPPORT_AXIS, sourceAttrs.RESTRAINT_AXIS, sourceAttrs.AXIS, sourceAxis),
    SUPPORT_SIGN: firstText(sourceAttrs.SUPPORT_SIGN, sourceAttrs.RESTRAINT_SIGN, sourceAttrs.SIGN, visual.explicitAxis?.sign),
    SUPPORT_GAP_MM: firstText(sourceAttrs.SUPPORT_GAP_MM, gapText),
    GAP: firstText(sourceAttrs.GAP, gapText),
    SUPPORTCOORD: pos,
    POS: pos
  };
}

function collectStagedJsonRecordAttributes(data = {}) {
  const attrs = {};
  copyAttributeBag(attrs, data.sourceAttributes);
  copyAttributeBag(attrs, data.stagedJsonAttributes);
  copyAttributeBag(attrs, data.rawAttributes);
  copyAttributeBag(attrs, data.attributes);
  copyAttributeBag(attrs, data.attrs);

  for (const [key, value] of Object.entries(data || {})) {
    if (!STAGED_JSON_SUPPORT_ATTR_KEY_PATTERN.test(String(key || ''))) continue;
    copyMeaningfulAttribute(attrs, key, value);
  }

  return attrs;
}

function copyAttributeBag(target, bag) {
  if (!bag || typeof bag !== 'object' || Array.isArray(bag)) return;
  for (const [key, value] of Object.entries(bag)) copyMeaningfulAttribute(target, key, value);
}

function copyMeaningfulAttribute(target, key, value) {
  if (!key || value === undefined || value === null) return;
  if (typeof value === 'string' && !value.trim()) return;
  if (typeof value === 'function') return;
  target[String(key).trim()] = value;
}

function createSupportOverlay(rootName, sourceMode, supportRecords, pipeRecords, options = {}) {
  const overlay = new THREE.Group();
  overlay.name = rootName;
  overlay.userData = { TYPE: rootName, schema: MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_BRIDGE_SCHEMA, sourceMode, previewOnly: true, exportedRvmGeometry: false, supportSourceModeExclusive: true, mapperConfigApplied: hasMapperConfig(options.mapperConfig) };
  const allRecords = [...pipeRecords, ...supportRecords];
  for (const record of supportRecords) {
    const preview = createManagedStageSupportPreviewObject(record, { ...options, records: allRecords, pointRadius: options.pointRadius || 30, fallbackRadius: options.fallbackRadius || 12 });
    if (!preview?.object) continue;
    preview.object.userData = { ...(preview.object.userData || {}), supportSourceMode: sourceMode, stagedJsonSupportOverlay: sourceMode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON, isonoteSupportOverlay: sourceMode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE, isonoteRawText: record.isonoteRawText || '', stagedJsonMapperRecord: record.stagedJsonMapperRecord || null, isonoteMapperRecord: record.isonoteMapperRecord || null, mapperConfigApplied: hasMapperConfig(options.mapperConfig) };
    overlay.add(preview.object);
  }
  return overlay;
}

function removeGeneratedSupportPreviewObjects(modelRoot, { removeStagedJsonSymbols = false, removeStagedOverlay = true, removeIsonoteOverlay = true } = {}) {
  let removed = 0;
  const toRemove = [];
  modelRoot.traverse((object) => {
    if (!object?.parent) return;
    const data = object.userData || {};
    if (removeStagedOverlay && (object.name === STAGED_JSON_SUPPORT_SOURCE_OVERLAY_ROOT || data.stagedJsonSupportOverlay)) { toRemove.push(object); return; }
    if (removeIsonoteOverlay && (object.name === ISONOTE_SUPPORT_SOURCE_OVERLAY_ROOT || data.isonoteSupportOverlay)) { toRemove.push(object); return; }
    if (removeStagedJsonSymbols && data.managedStageSupportVisual && data.primitiveKind === 'managed-stage-support-symbol') toRemove.push(object);
  });
  for (const object of toRemove) { object.parent?.remove?.(object); disposeObject(object); removed += 1; }
  return removed;
}

function isStagedJsonSupportSourceCandidate(data = {}) {
  if (data.primitiveKind !== 'raw-staged-source-line' && data.primitiveKind !== 'raw-staged-source-point') return false;
  if (data.managedStageSupportVisual || data.stagedJsonSupportOverlay || data.isonoteSupportOverlay) return false;
  const attrs = collectStagedJsonRecordAttributes(data);
  const candidates = [data.TYPE, data.stagedType, data.rawType, data.dtxr, data.sourceName, data.sourcePath, attrs.TYPE, attrs.RAW_TYPE, attrs.DTXR, attrs.SUPPORT_KIND, attrs.SUPPORT_TYPE, attrs.RESTRAINT_KIND, attrs.RESTRAINT, attrs.SUPPORT_GRAPHICS_RULE, attrs.GRAPHICS_RULE, attrs.NAME].filter(Boolean).join(' ');
  return Boolean(data.previewOnly) || SUPPORT_TOKEN_PATTERN.test(candidates);
}

function supportRecordPositionFromData(data = {}) {
  return clonePoint(data.previewPosMm || data.sourcePosMm || data.sourceSupportCoordMm || data.supportCoordMm)
    || midpointPoint(data.sourceAposMm, data.sourceLposMm)
    || clonePoint(data.previewStartMm)
    || clonePoint(data.sourceAposMm)
    || clonePoint(data.sourceLposMm);
}

function midpointPoint(a, b) {
  if (!a || !b) return null;
  return { x: ((Number(a.x) || 0) + (Number(b.x) || 0)) / 2, y: ((Number(a.y) || 0) + (Number(b.y) || 0)) / 2, z: ((Number(a.z) || 0) + (Number(b.z) || 0)) / 2 };
}

function buildNodePointMap(records = []) {
  const map = new Map();
  for (const record of records) {
    if (record.fromNode && record.source?.apos && !map.has(String(record.fromNode))) map.set(String(record.fromNode), record.source.apos);
    if (record.toNode && record.source?.lpos && !map.has(String(record.toNode))) map.set(String(record.toNode), record.source.lpos);
  }
  return map;
}

function mappedAxisOverrideAttrs(mapperRecord) {
  const canvasAxis = String(mapperRecord?.axis?.canvasAxis || mapperRecord?.attrs?.SUPPORT_AXIS_CANVAS || '').trim();
  if (!canvasAxis) return {};
  const sourceAxis = String(mapperRecord?.axis?.sourceAxis || mapperRecord?.attrs?.SUPPORT_AXIS_SOURCE || '').trim();
  return {
    AXIS: canvasAxis,
    DIRECTION: canvasAxis,
    RESTRAINT_AXIS: canvasAxis,
    SUPPORT_AXIS_CANVAS_APPLIED: 'TRUE',
    SUPPORT_AXIS_SOURCE_ORIGINAL: sourceAxis
  };
}

function buildSupportRulePreviewRow(object, data, visual, mapperRecord, context = {}) {
  const explicitAxis = visual.explicitAxis || null;
  const supportActionAxes = Array.isArray(context.supportActionAxes) && context.supportActionAxes.length
    ? context.supportActionAxes
    : (visual.supportActionAxes || (visual.coneSides || []).map((side) => side?.axis).filter(Boolean));
  const sourceAxis = mapperRecord?.axis?.sourceAxis || data?.SUPPORT_AXIS_SOURCE_ORIGINAL || visual.sourceAxis || '';
  const canvasAxis = context.canvasAxis || mapperRecord?.axis?.canvasAxis || visual.canvasAxis || explicitAxisText(explicitAxis) || '';
  const matchedPipeAxis = context.matchedPipeAxis || visual.pipeAxisSigned || visual.pipeAxis || '';
  const sign = axisSign(canvasAxis || supportActionAxes[0]) || mapperRecord?.attrs?.SUPPORT_SIGN_MAPPED || explicitAxis?.sign || (visual.explicitSignApplied ? explicitAxis?.sign : '');
  const emittedSymbolCount = countSupportVisualParts(object);
  return {
    sourceMode: context.itemMode || data.supportSourceMode || '',
    sourceRow: data.isonoteRawText || mapperRecord?.attrs?.REF || data.sourcePath || data.sourceName || object.name || '',
    supportTag: mapperRecord?.supportTag || data.sourceName || data.sourcePath || object.name || '',
    family: context.family || mapperRecord?.family || visual.family || 'UNKNOWN',
    node: String(visual.node || data.fromNode || data.toNode || mapperRecord?.attrs?.NODE || ''),
    sourceAxis,
    canvasAxis,
    supportActionAxes,
    matchedPipeAxis,
    sign,
    gapMm: round(visual.gapMm),
    gapVisualSeparationMm: round(visual.gapVisualSeparationMm),
    graphicsRule: mapperRecord?.graphicsRule || visualRuleName(visual),
    emittedSymbolCount,
    symbolRoleCount: Number(visual.directionalGlyphCount || visual.coneCount || 0),
    popupRequired: Boolean(data.popupRequired || visual.popupRequired || mapperRecord?.preflight?.popupRequired),
    preflightPass: mapperRecord?.preflight ? Boolean(mapperRecord.preflight.pass) : true
  };
}

function visualRuleName(visual = {}) {
  const family = String(visual.family || '').toUpperCase();
  if (family === 'REST') return 'positive-y-upward-arrow';
  if (family === 'HOLDDOWN') return 'double-vertical-y-arrows';
  if (family === 'GUIDE') return 'lateral-by-pipe-orientation';
  if (family === 'LINE_STOP' || family === 'LIMIT_STOP') return 'axial-pair-or-explicit-sign';
  if (family === 'SPRING_CAN') return 'warning-coil-below-pipe';
  if (family === 'SINGLE_AXIS_WARNING') return 'warning-marker-popup-required';
  if (visual.fallbackCrossRods) return 'fallback-cross-rods';
  return 'unknown-support-rule';
}

function countSupportVisualParts(object) {
  let count = 0;
  object?.traverse?.((child) => {
    if (child !== object && child?.userData?.managedStageSupportVisualPart) count += 1;
  });
  return count;
}

function appendPreflightIssues(diagnostics, preflight, mapperRecord, context = {}) {
  const issues = Array.isArray(preflight?.issues) ? preflight.issues : [];
  if (!issues.length) return;
  for (const issue of issues) {
    if (diagnostics.mapperPreflightIssues.length >= MAX_PREFLIGHT_ISSUES) break;
    diagnostics.mapperPreflightIssues.push({
      sourceMode: context.sourceMode || mapperRecord?.sourceMode || '',
      severity: String(issue.severity || 'warning'),
      code: String(issue.code || 'mapper-preflight-issue'),
      message: String(issue.message || ''),
      supportTag: String(context.supportTag || mapperRecord?.supportTag || ''),
      family: String(context.family || mapperRecord?.family || 'UNKNOWN'),
      node: String(context.node || mapperRecord?.attrs?.NODE || ''),
      axis: String(context.axis || mapperRecord?.axis?.canvasAxis || ''),
      sourceField: String(mapperRecord?.attrs?.SUPPORT_KIND_SOURCE_FIELD || mapperRecord?.attrs?.SUPPORT_AXIS_SOURCE_FIELD || '')
    });
  }
}

function explicitAxisText(axisInfo) {
  if (!axisInfo?.axis) return '';
  return `${axisInfo.sign || '+'}${axisInfo.axis}`;
}

function axisSign(axisToken) {
  const text = String(axisToken || '').trim();
  if (text.startsWith('-')) return '-';
  if (text.startsWith('+')) return '+';
  return '';
}

function firstText(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function stampBridgeAudit(modelRoot, result) {
  const diagnostics = collectManagedStageSupportSourcePreviewDiagnostics(modelRoot, result);
  modelRoot.userData = { ...(modelRoot.userData || {}), managedStageSupportSourcePreview: { ...result, diagnostics } };
}

function bridgeResult(status, extra = {}) { return { schema: MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_BRIDGE_SCHEMA, cacheKey: MANAGED_STAGE_SUPPORT_SOURCE_PREVIEW_BRIDGE_CACHE_KEY, status, ...extra }; }
function readIsonoteText(doc) { return doc?.getElementById?.('isonoteText')?.value || ''; }
function disposeObject(object) { object.traverse?.((child) => { child.geometry?.dispose?.(); const material = child.material; if (Array.isArray(material)) material.forEach((entry) => entry?.dispose?.()); else material?.dispose?.(); }); }
function clonePoint(point) { return point ? { x: Number(point.x) || 0, y: Number(point.y) || 0, z: Number(point.z) || 0 } : null; }
function safeName(value) { return String(value || 'SUPPORT').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '') || 'SUPPORT'; }
function numeric(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function round(value) { const n = Number(value); return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0; }
function hasMapperConfig(config) { return Boolean(config && typeof config === 'object' && Object.keys(config).length > 0); }

if (typeof window !== 'undefined') {
  const start = () => installManagedStageSupportSourcePreviewBridge();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('markup:app-ready', start, { once: true });
}
