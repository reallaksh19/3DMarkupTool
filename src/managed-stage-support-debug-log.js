export const MANAGED_STAGE_SUPPORT_DEBUG_LOG_SCHEMA = 'ManagedStageSupportDebugLog.v1';
export const MANAGED_STAGE_SUPPORT_DEBUG_LOG_CACHE_KEY = '20260623-support-debug-log-1';

const SUPPORT_TOKEN_PATTERN = /\b(ATTA|ANCI|SUPP|SUPPORT|PIPE_SUPPORT|PIPESUPPORT|REST|RESTRAINT|GUIDE|GUID|HOLDDOWN|HOLD_DOWN|LINE\s*STOP|LINE_STOP|LINESTOP|LIMIT|LIM|SPRING\s*CAN|SPRING_CAN|SPRINGCAN|ANCHOR)\b/i;
const SUPPORT_DEBUG_SAMPLE_LIMIT = 10;
const SUPPORT_DEBUG_RULE_ROW_LIMIT = 12;

installManagedStageSupportDebugLog();

export function installManagedStageSupportDebugLog({ win = globalThis.window, doc = globalThis.document } = {}) {
  if (!win || !doc || win.__3D_MARKUP_SUPPORT_DEBUG_LOG__?.schema === MANAGED_STAGE_SUPPORT_DEBUG_LOG_SCHEMA) {
    return win?.__3D_MARKUP_SUPPORT_DEBUG_LOG__ || null;
  }

  const api = {
    schema: MANAGED_STAGE_SUPPORT_DEBUG_LOG_SCHEMA,
    cacheKey: MANAGED_STAGE_SUPPORT_DEBUG_LOG_CACHE_KEY,
    dump: (options = {}) => dumpManagedStageSupportDebugToLog({ win, doc, ...options })
  };
  win.__3D_MARKUP_SUPPORT_DEBUG_LOG__ = api;

  const scheduleDump = (reason, modelRoot = null) => {
    win.clearTimeout?.(api.pendingTimer);
    api.pendingTimer = win.setTimeout?.(() => api.dump({ reason, modelRoot, automatic: true }), 40);
  };

  win.addEventListener?.('viewer:model-loaded', (event) => scheduleDump(`viewer:model-loaded:${event?.detail?.mode || 'unknown'}`, event?.detail?.modelRoot));
  win.addEventListener?.('viewer:managed-stage-json-loaded', (event) => scheduleDump('viewer:managed-stage-json-loaded', event?.detail?.modelRoot));
  win.addEventListener?.('managed-stage:support-preview-auto-apply-result', (event) => scheduleDump(`support-preview-auto-apply:${event?.detail?.status || 'unknown'}`, event?.detail?.modelRoot));
  win.addEventListener?.('managed-stage:support-settings-popup-ready', () => ensureSupportDebugButton({ win, doc, api }));
  win.addEventListener?.('markup:app-ready', () => ensureSupportDebugButton({ win, doc, api }));

  ensureSupportDebugButton({ win, doc, api });
  scheduleDump('support-debug-log-installed');
  return api;
}

export function dumpManagedStageSupportDebugToLog({ win = globalThis.window, doc = globalThis.document, modelRoot = null, reason = 'manual', automatic = false } = {}) {
  const report = buildManagedStageSupportDebugReport({ win, doc, modelRoot, reason, automatic });
  const text = formatManagedStageSupportDebugReport(report);
  appendDebugTextToAppLog(doc, text);
  if (win) {
    win.__3D_MARKUP_SUPPORT_DEBUG_LAST_REPORT__ = report;
    win.__3D_MARKUP_SUPPORT_DEBUG_LAST_TEXT__ = text;
  }
  return report;
}

export function buildManagedStageSupportDebugReport({ win = globalThis.window, doc = globalThis.document, modelRoot = null, reason = 'manual', automatic = false } = {}) {
  const runtime = win?.__3D_MARKUP_VIEWER_RUNTIME__ || win?.__3D_MARKUP_CLIP_RUNTIME__ || {};
  const root = modelRoot || runtime.getModelRoot?.() || runtime.modelRoot || null;
  const ui = win?.__3D_MARKUP_SUPPORT_SOURCE_UI__ || {};
  const bridge = win?.__3D_MARKUP_SUPPORT_SOURCE_PREVIEW_BRIDGE__ || null;
  const autoApplyApi = win?.__3D_MARKUP_SUPPORT_PREVIEW_AUTO_APPLY__ || null;
  const rootAudit = root?.userData?.managedStageSupportSourcePreview || {};
  const diagnostics = rootAudit?.diagnostics || {};
  const autoApply = root?.userData?.managedStageSupportPreviewAutoApply || win?.__3D_MARKUP_SUPPORT_PREVIEW_AUTO_APPLY_LAST_RESULT__ || {};
  const scene = inspectSupportScene(root);

  return {
    schema: MANAGED_STAGE_SUPPORT_DEBUG_LOG_SCHEMA,
    cacheKey: MANAGED_STAGE_SUPPORT_DEBUG_LOG_CACHE_KEY,
    timestamp: new Date().toISOString(),
    reason,
    automatic: Boolean(automatic),
    appLoaderVersion: String(win?.__3D_MARKUP_APP_LOADER_VERSION__ || ''),
    bundled: Boolean(win?.__3D_MARKUP_APP_BOOT_BUNDLED__),
    appBootComplete: Boolean(win?.__3D_MARKUP_APP_BOOT_COMPLETE__),
    sourceMode: String(ui.sourceMode || 'unknown'),
    mapperPresetId: String(ui.mapperPresetId || ui.mapperConfig?.mapperPresetId || 'unknown'),
    northSourceAxis: String(ui.axisBasis?.northSourceAxis || ''),
    northCanvasAxis: String(ui.axisBasis?.northCanvasAxis || ui.axisBasis?.axes?.[ui.axisBasis?.northSourceAxis]?.canvasAxis || ''),
    bridgePresent: Boolean(bridge?.apply),
    bridgeCacheKey: String(bridge?.cacheKey || ''),
    autoApplyPresent: Boolean(autoApplyApi?.apply),
    autoApplyCacheKey: String(autoApplyApi?.cacheKey || ''),
    runtimeModelRootPresent: Boolean(runtime.modelRoot || runtime.getModelRoot),
    modelRootPresent: Boolean(root?.traverse),
    modelRootName: String(root?.name || root?.type || ''),
    modelRootChildren: Number(root?.children?.length || 0),
    scene,
    diagnostics: summarizeDiagnostics(diagnostics),
    autoApply: summarizeAutoApply(autoApply),
    logElementPresent: Boolean(doc?.getElementById?.('log'))
  };
}

export function formatManagedStageSupportDebugReport(report = {}) {
  const lines = [
    '=== SUPPORT_DEBUG_BEGIN ===',
    `schema=${report.schema || ''}`,
    `cacheKey=${report.cacheKey || ''}`,
    `timestamp=${report.timestamp || ''}`,
    `reason=${report.reason || ''}`,
    `automatic=${Boolean(report.automatic)}`,
    `appLoaderVersion=${report.appLoaderVersion || ''}`,
    `bundled=${Boolean(report.bundled)} appBootComplete=${Boolean(report.appBootComplete)}`,
    `ui sourceMode=${report.sourceMode || ''} mapperPreset=${report.mapperPresetId || ''} north=${report.northSourceAxis || ''}->${report.northCanvasAxis || ''}`,
    `modules bridge=${present(report.bridgePresent)} bridgeCache=${report.bridgeCacheKey || ''} autoApply=${present(report.autoApplyPresent)} autoApplyCache=${report.autoApplyCacheKey || ''}`,
    `runtime modelRoot=${present(report.modelRootPresent)} runtimeModelRoot=${present(report.runtimeModelRootPresent)} rootName=${report.modelRootName || ''} rootChildren=${num(report.modelRootChildren)}`,
    `scene objects=${num(report.scene?.totalObjects)} rawLine=${num(report.scene?.rawStagedLineCount)} rawPoint=${num(report.scene?.rawStagedPointCount)} rawOther=${num(report.scene?.rawStagedOtherCount)}`,
    `support candidates=${num(report.scene?.rawSupportCandidateCount)} noPosition=${num(report.scene?.rawSupportCandidateNoPositionCount)} rejectedNoToken=${num(report.scene?.rawRejectedNoSupportTokenCount)}`,
    `scene supportSymbols=${num(report.scene?.managedSupportSymbolCount)} supportVisualParts=${num(report.scene?.managedSupportVisualPartCount)} stagedOverlayRoots=${num(report.scene?.stagedOverlayRootCount)} isonoteOverlayRoots=${num(report.scene?.isonoteOverlayRootCount)}`,
    `bridge status=${report.diagnostics?.status || ''} sourceMode=${report.diagnostics?.sourceMode || ''} pass=${report.diagnostics?.pass}`,
    `bridge counts pipeRecords=${num(report.diagnostics?.pipeRecordCount)} stagedRecords=${num(report.diagnostics?.stagedJsonSupportRecordCount)} isonoteRecords=${num(report.diagnostics?.isonoteSupportRecordCount)} overlayGroups=${num(report.diagnostics?.overlayPrimitiveGroupCount)} supportSymbolCount=${num(report.diagnostics?.supportSymbolCount)}`,
    `bridge warnings popupRequired=${num(report.diagnostics?.popupRequiredCount)} warning=${num(report.diagnostics?.warningCount)} preflightIssues=${num(report.diagnostics?.mapperPreflightIssueCount)} gapCarryForwardViolations=${num(report.diagnostics?.gapCarryForwardViolationCount)}`,
    `familyHistogram=${json(report.diagnostics?.supportFamilyHistogram || {})}`,
    `canvasAxisHistogram=${json(report.diagnostics?.supportCanvasAxisHistogram || {})}`,
    `autoApply status=${report.autoApply?.status || ''} requestedBy=${report.autoApply?.requestedBy || ''} supportSymbolCount=${num(report.autoApply?.supportSymbolCount)} bridgeStatus=${report.autoApply?.bridgeStatus || ''}`,
    `logElementPresent=${Boolean(report.logElementPresent)}`
  ];

  if (Array.isArray(report.scene?.candidateSamples) && report.scene.candidateSamples.length) {
    lines.push('candidateSamples:');
    for (const sample of report.scene.candidateSamples) {
      lines.push(`- idx=${sample.index} kind=${sample.primitiveKind || ''} name=${sample.name || ''} type=${sample.type || ''} dtxr=${sample.dtxr || ''} path=${sample.path || ''} hasPosition=${sample.hasPosition} token=${sample.token || ''}`);
    }
  } else {
    lines.push('candidateSamples: none');
  }

  if (Array.isArray(report.diagnostics?.supportRulePreviewRows) && report.diagnostics.supportRulePreviewRows.length) {
    lines.push('supportRulePreviewRows:');
    for (const row of report.diagnostics.supportRulePreviewRows.slice(0, SUPPORT_DEBUG_RULE_ROW_LIMIT)) {
      lines.push(`- tag=${row.supportTag || ''} family=${row.family || ''} node=${row.node || ''} sourceAxis=${row.sourceAxis || ''} canvasAxis=${row.canvasAxis || ''} sign=${row.sign || ''} gap=${row.gapMm ?? ''} emitted=${row.emittedSymbolCount ?? ''} popup=${Boolean(row.popupRequired)}`);
    }
  } else {
    lines.push('supportRulePreviewRows: none');
  }

  lines.push('=== SUPPORT_DEBUG_END ===');
  return lines.join('\n');
}

function inspectSupportScene(root) {
  const scene = {
    totalObjects: 0,
    rawStagedLineCount: 0,
    rawStagedPointCount: 0,
    rawStagedOtherCount: 0,
    rawSupportCandidateCount: 0,
    rawSupportCandidateNoPositionCount: 0,
    rawRejectedNoSupportTokenCount: 0,
    managedSupportSymbolCount: 0,
    managedSupportVisualPartCount: 0,
    stagedOverlayRootCount: 0,
    isonoteOverlayRootCount: 0,
    candidateSamples: []
  };

  if (!root?.traverse) return scene;
  let candidateIndex = 0;
  root.traverse((object) => {
    scene.totalObjects += 1;
    const data = object?.userData || {};
    const primitiveKind = String(data.primitiveKind || '');
    const isRawLine = primitiveKind === 'raw-staged-source-line';
    const isRawPoint = primitiveKind === 'raw-staged-source-point';
    const isRawStaged = primitiveKind.startsWith('raw-staged-source');
    if (isRawLine) scene.rawStagedLineCount += 1;
    else if (isRawPoint) scene.rawStagedPointCount += 1;
    else if (isRawStaged) scene.rawStagedOtherCount += 1;

    if (object?.name === 'MANAGED_STAGE_SUPPORT_SOURCE_OVERLAY_STAGED_JSON') scene.stagedOverlayRootCount += 1;
    if (object?.name === 'MANAGED_STAGE_SUPPORT_SOURCE_OVERLAY_ISONOTE') scene.isonoteOverlayRootCount += 1;
    if (data.managedStageSupportVisual && data.primitiveKind === 'managed-stage-support-symbol') scene.managedSupportSymbolCount += 1;
    if (data.managedStageSupportVisualPart) scene.managedSupportVisualPartCount += 1;

    if (!isRawLine && !isRawPoint) return;
    const token = supportTokenFromData(data);
    if (!token) {
      scene.rawRejectedNoSupportTokenCount += 1;
      return;
    }
    const hasPosition = Boolean(resolveSupportPosition(data));
    scene.rawSupportCandidateCount += 1;
    if (!hasPosition) scene.rawSupportCandidateNoPositionCount += 1;
    if (scene.candidateSamples.length < SUPPORT_DEBUG_SAMPLE_LIMIT) {
      scene.candidateSamples.push({
        index: candidateIndex,
        primitiveKind,
        name: String(data.sourceName || object.name || ''),
        type: String(data.TYPE || data.stagedType || data.rawType || ''),
        dtxr: String(data.DTXR || data.dtxr || data.rawType || ''),
        path: String(data.sourcePath || ''),
        token,
        hasPosition
      });
    }
    candidateIndex += 1;
  });

  return scene;
}

function supportTokenFromData(data = {}) {
  const text = [
    data.TYPE,
    data.stagedType,
    data.rawType,
    data.dtxr,
    data.sourceName,
    data.sourcePath,
    attrsText(data.sourceAttributes),
    attrsText(data.stagedJsonAttributes),
    attrsText(data.rawAttributes),
    attrsText(data.attributes),
    attrsText(data.attrs)
  ].filter(Boolean).join(' ');
  const match = text.match(SUPPORT_TOKEN_PATTERN);
  return match?.[0] || '';
}

function attrsText(value) {
  if (!value || typeof value !== 'object') return '';
  return Object.entries(value).map(([key, item]) => `${key}=${stringifyScalar(item)}`).join(' ');
}

function resolveSupportPosition(data = {}) {
  return clonePointLike(data.previewPosMm)
    || clonePointLike(data.sourcePosMm)
    || clonePointLike(data.sourceSupportCoordMm)
    || clonePointLike(data.supportCoordMm)
    || clonePointLike(data.SUPPORTCOORD)
    || clonePointLike(data.SUPPORT_COORD)
    || clonePointLike(data.POS)
    || midpointPoint(data.sourceAposMm, data.sourceLposMm)
    || clonePointLike(data.previewStartMm)
    || clonePointLike(data.sourceAposMm)
    || clonePointLike(data.sourceLposMm);
}

function clonePointLike(value) {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const x = Number(value.x ?? value.X ?? value.e ?? value.E);
    const y = Number(value.y ?? value.Y ?? value.u ?? value.U);
    const z = Number(value.z ?? value.Z ?? value.n ?? value.N);
    if ([x, y, z].every(Number.isFinite)) return { x, y, z };
  }
  if (Array.isArray(value) && value.length >= 3) {
    const [x, y, z] = value.map(Number);
    if ([x, y, z].every(Number.isFinite)) return { x, y, z };
  }
  if (typeof value === 'string') {
    const numbers = value.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
    if (numbers.length >= 3 && numbers.slice(0, 3).every(Number.isFinite)) return { x: numbers[0], y: numbers[1], z: numbers[2] };
  }
  return null;
}

function midpointPoint(a, b) {
  const pa = clonePointLike(a);
  const pb = clonePointLike(b);
  if (!pa || !pb) return null;
  return { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2, z: (pa.z + pb.z) / 2 };
}

function summarizeDiagnostics(diagnostics = {}) {
  return {
    status: String(diagnostics.status || ''),
    sourceMode: String(diagnostics.sourceMode || ''),
    pass: diagnostics.pass,
    pipeRecordCount: Number(diagnostics.pipeRecordCount || 0),
    stagedJsonSupportRecordCount: Number(diagnostics.stagedJsonSupportRecordCount || 0),
    isonoteSupportRecordCount: Number(diagnostics.isonoteSupportRecordCount || 0),
    overlayPrimitiveGroupCount: Number(diagnostics.overlayPrimitiveGroupCount || 0),
    supportSymbolCount: Number(diagnostics.supportSymbolCount || 0),
    popupRequiredCount: Number(diagnostics.popupRequiredCount || 0),
    warningCount: Number(diagnostics.warningCount || 0),
    mapperPreflightIssueCount: Number(diagnostics.mapperPreflightIssueCount || 0),
    gapCarryForwardViolationCount: Number(diagnostics.gapCarryForwardViolationCount || 0),
    supportFamilyHistogram: diagnostics.supportFamilyHistogram || {},
    supportCanvasAxisHistogram: diagnostics.supportCanvasAxisHistogram || {},
    supportRulePreviewRows: Array.isArray(diagnostics.supportRulePreviewRows) ? diagnostics.supportRulePreviewRows.slice(0, SUPPORT_DEBUG_RULE_ROW_LIMIT) : []
  };
}

function summarizeAutoApply(autoApply = {}) {
  return {
    status: String(autoApply.status || ''),
    requestedBy: String(autoApply.requestedBy || ''),
    sourceMode: String(autoApply.sourceMode || ''),
    supportSymbolCount: Number(autoApply.supportSymbolCount || 0),
    bridgeStatus: String(autoApply.bridgeStatus || ''),
    reason: String(autoApply.reason || '')
  };
}

function ensureSupportDebugButton({ win, doc, api }) {
  const shell = doc?.getElementById?.('supportMappingSettingsShell');
  if (!shell || shell.querySelector?.('[data-support-debug-log-action]')) return null;
  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = 'Dump support debug to Log';
  button.setAttribute('data-support-debug-log-action', 'dump');
  button.style.cssText = 'width:100%;min-height:30px;border-radius:8px;border:1px solid rgba(251,191,36,.55);background:rgba(120,53,15,.45);color:#fde68a;font-weight:700;cursor:pointer;';
  button.addEventListener?.('click', (event) => {
    event.preventDefault?.();
    api.dump({ reason: 'manual-button', automatic: false });
  });
  const launcher = shell.querySelector?.('.support-mapping-settings-launcher') || shell;
  launcher.appendChild(button);
  win?.dispatchEvent?.(new CustomEvent('managed-stage:support-debug-button-ready', { detail: { cacheKey: MANAGED_STAGE_SUPPORT_DEBUG_LOG_CACHE_KEY } }));
  return button;
}

function appendDebugTextToAppLog(doc, text) {
  const log = doc?.getElementById?.('log');
  if (!log) return false;
  const ts = new Date().toLocaleTimeString();
  const stamped = String(text || '').split('\n').map((line) => `[${ts}] ${line}`).join('\n');
  log.textContent += `${stamped}\n`;
  log.scrollTop = log.scrollHeight;
  return true;
}

function present(value) {
  return value ? 'present' : 'missing';
}

function num(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function stringifyScalar(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch (_) { return String(value); }
  }
  return String(value);
}

function json(value) {
  try { return JSON.stringify(value || {}); } catch (_) { return '{}'; }
}
