const LEDGER_SCHEMA = 'ManagedStageGeometryLedger.v1';
const VERSION = 'managed-stage-geometry-ledger-20260621a';
const EPS_MM = 0.05;
const BRANCH_COLLINEAR_DOT = -0.92;

const COMPONENT_ORDER = ['PIPE', 'BEND', 'TEE', 'OLET_BRANCH', 'FLANGE', 'VALVE', 'RIGID'];
const COMPONENT_ICONS = Object.freeze({
  PIPE: '🟦',
  BEND: '🟡',
  TEE: '🔱',
  OLET_BRANCH: '🟣',
  FLANGE: '⏸️',
  VALVE: '◀▶',
  RIGID: '⬛',
  UNKNOWN: '❓'
});
const COMPONENT_LABELS = Object.freeze({
  PIPE: 'PIPE',
  BEND: 'BEND',
  TEE: 'TEE',
  OLET_BRANCH: 'OLET/BRANCH',
  FLANGE: 'FLANGE',
  VALVE: 'VALVE',
  RIGID: 'RIGID',
  UNKNOWN: 'UNKNOWN'
});

if (typeof window !== 'undefined') installManagedStageGeometryLedger();

export function installManagedStageGeometryLedger() {
  if (typeof window === 'undefined') {
    return { version: VERSION, apply: applyManagedStageGeometryLedger, debug: () => null };
  }
  if (window.__3D_MARKUP_MANAGED_STAGE_GEOMETRY_LEDGER__?.version === VERSION) {
    return window.__3D_MARKUP_MANAGED_STAGE_GEOMETRY_LEDGER__;
  }

  const api = {
    version: VERSION,
    apply: applyManagedStageGeometryLedger,
    patchActiveArtifact,
    debug: () => window.__3D_MARKUP_MANAGED_STAGE_GEOMETRY_LEDGER_LAST__ || null
  };
  window.__3D_MARKUP_MANAGED_STAGE_GEOMETRY_LEDGER__ = api;

  window.addEventListener?.('viewer:managed-stage-json-loaded', (event) => {
    applyManagedStageGeometryLedger(event?.detail?.modelRoot, event?.detail || {});
  });
  window.addEventListener?.('viewer:model-loaded', (event) => {
    applyManagedStageGeometryLedger(event?.detail?.modelRoot, event?.detail || {});
  });
  window.addEventListener?.('viewer:managed-stage-json-ui-ready', () => patchActiveArtifact(), { passive: true });

  patchActiveArtifact();
  return api;
}

function patchActiveArtifact() {
  if (typeof window === 'undefined') return null;
  const artifact = window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__?.getActiveArtifact?.();
  if (artifact?.previewScene) {
    return applyManagedStageGeometryLedger(artifact.previewScene, {
      sourceName: artifact.sourceName,
      previewCoordinateAudit: artifact.previewCoordinateAudit
    });
  }
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__;
  return applyManagedStageGeometryLedger(runtime?.modelRoot, { source: runtime?.source });
}

export function applyManagedStageGeometryLedger(modelRoot, detail = {}) {
  if (!modelRoot || !isManagedStagePreview(modelRoot, detail)) return null;
  const ledger = buildManagedStageGeometryLedgerFromScene(modelRoot, detail);
  modelRoot.userData = {
    ...(modelRoot.userData || {}),
    managedStageGeometryLedger: ledger,
    managedStageGeometryLedgerSummary: summarizeManagedStageGeometryLedger(ledger)
  };
  if (typeof window !== 'undefined') {
    window.__3D_MARKUP_MANAGED_STAGE_GEOMETRY_LEDGER_LAST__ = ledger;
    window.dispatchEvent?.(new CustomEvent('viewer:managed-stage-geometry-ledger-ready', {
      detail: { version: VERSION, pass: ledger.pass, summary: modelRoot.userData.managedStageGeometryLedgerSummary }
    }));
  }
  return ledger;
}

export function buildManagedStageGeometryLedgerFromScene(modelRoot, detail = {}) {
  const rootData = modelRoot?.userData || {};
  const audit = rootData.managedStageCoordinateAudit || detail.previewCoordinateAudit || {};
  const sourceRows = buildSourceRows(audit.rows || []);
  const sourceByPath = new Map(sourceRows.map((row) => [row.sourcePath, row]));
  const sourceByName = new Map(sourceRows.map((row) => [row.sourceName, row]));
  const nodes = buildNodeLedger(sourceRows);
  const generatedCues = [];
  const sourceObjectCountByPath = new Map();
  const cueObjectCountByKind = new Map();
  const branchCueNodes = new Set();
  const valveCuePaths = new Set();
  const detachedElbowCues = [];

  modelRoot?.traverse?.((object) => {
    const data = object.userData || {};
    if (isCanvasSourceObject(data)) {
      const path = data.sourcePath || object.name || '';
      sourceObjectCountByPath.set(path, (sourceObjectCountByPath.get(path) || 0) + 1);
      const row = sourceByPath.get(path) || sourceByName.get(data.sourceName);
      if (row) {
        row.canvasObjects.push(canvasObjectSummary(object, data));
        row.canvasSourceFound = true;
        row.canvasVisible = row.canvasVisible && object.visible !== false;
        if (data.previewTrimmedForOrthogonalElbow) row.previewTrimmed = true;
      }
      return;
    }

    if (!isGeneratedCueObject(data)) return;
    const cue = cueSummary(object, data);
    generatedCues.push(cue);
    cueObjectCountByKind.set(cue.cueKind, (cueObjectCountByKind.get(cue.cueKind) || 0) + 1);

    if (cue.cueKind === 'branch-fitting') branchCueNodes.add(String(data.node || ''));
    if (cue.cueKind === 'valve-opposed-cone-pair' && !data.cuePart) {
      const path = data.sourceValvePath || data.sourcePath || '';
      if (path) valveCuePaths.add(path);
    }
    attachCueToParents(cue, data, sourceByPath, sourceByName);

    if (isElbowCue(data, object)) {
      const check = validateElbowCueAttachment(data, sourceByPath, sourceByName);
      cue.attachment = check;
      if (!check.ok) detachedElbowCues.push({ name: cue.name, node: cue.node, reason: check.reason, maxGapMm: check.maxGapMm });
    }
  });

  const missingSourceRows = sourceRows.filter((row) => !row.canvasSourceFound);
  const hiddenSourceRows = sourceRows.filter((row) => row.canvasSourceFound && row.canvasVisible === false);
  const branchNodes = nodes.filter((node) => node.degree >= 3).map((node) => resolveBranchNode(node, branchCueNodes));
  const missingBranchCueNodes = branchNodes.filter((node) => !node.hasBranchCue);
  const unresolvedBranchNodes = branchNodes.filter((node) => !node.hasMainRunPair);
  const valveRows = sourceRows.filter((row) => row.componentClass === 'VALVE');
  const valveRowsWithoutCue = valveRows.filter((row) => !valveCuePaths.has(row.sourcePath));
  const componentSummary = buildComponentSummary(sourceRows, branchNodes, generatedCues, sourceObjectCountByPath, valveCuePaths);
  const failures = [
    ...missingSourceRows.map((row) => failure('FAIL_SOURCE_OMITTED', row.sourceName, 'source APOS/LPOS row has no Canvas source object')),
    ...hiddenSourceRows.map((row) => failure('FAIL_SOURCE_HIDDEN', row.sourceName, 'Canvas source object is hidden')),
    ...detachedElbowCues.map((cue) => failure('FAIL_DETACHED_ELBOW_CUE', cue.name, cue.reason || 'elbow cue tangent does not attach to source span')),
    ...missingBranchCueNodes.map((node) => failure('FAIL_BRANCH_CUE_MISSING', node.nodeId, 'degree-3+ branch node has no additive OLET/branch cue')),
    ...unresolvedBranchNodes.map((node) => failure('FAIL_BRANCH_MAIN_RUN_UNRESOLVED', node.nodeId, 'degree-3+ node has no collinear main-run pair')),
    ...valveRowsWithoutCue.map((row) => failure('FAIL_VALVE_CUE_MISSING', row.sourceName, 'VALVE source row has no opposed cone-pair cue'))
  ];

  return {
    schema: LEDGER_SCHEMA,
    version: VERSION,
    sourceName: detail.sourceName || rootData.sourceName || rootData.source || 'managed-stage-preview',
    units: 'mm',
    focus: 'geometry-first: pipe, bends, tees, flanges, olet/branch, valves, rigids',
    sourceRowCount: sourceRows.length,
    canvasSourceFoundCount: sourceRows.filter((row) => row.canvasSourceFound).length,
    hiddenSourceRowCount: hiddenSourceRows.length,
    generatedCueCount: generatedCues.length,
    elbowCueCount: generatedCues.filter((cue) => cue.family === 'ELBOW').length,
    detachedElbowCueCount: detachedElbowCues.length,
    branchNodeCount: branchNodes.length,
    branchCueNodeCount: branchNodes.filter((node) => node.hasBranchCue).length,
    missingBranchCueNodeCount: missingBranchCueNodes.length,
    unresolvedBranchNodeCount: unresolvedBranchNodes.length,
    valveSourceRowCount: valveRows.length,
    valveCueSourceRowCount: valveCuePaths.size,
    valveRowsWithoutCueCount: valveRowsWithoutCue.length,
    componentSummary,
    nodes,
    branchNodes,
    sourceRows,
    generatedCues,
    failures,
    pass: failures.length === 0,
    pasteableComponentBreakdown: buildPasteableComponentBreakdown({ componentSummary, sourceRows, branchNodes, generatedCues })
  };
}

export function summarizeManagedStageGeometryLedger(ledger) {
  if (!ledger) return null;
  return {
    schema: ledger.schema,
    version: ledger.version,
    pass: ledger.pass,
    sourceRowCount: ledger.sourceRowCount,
    canvasSourceFoundCount: ledger.canvasSourceFoundCount,
    hiddenSourceRowCount: ledger.hiddenSourceRowCount,
    detachedElbowCueCount: ledger.detachedElbowCueCount,
    branchNodeCount: ledger.branchNodeCount,
    branchCueNodeCount: ledger.branchCueNodeCount,
    valveSourceRowCount: ledger.valveSourceRowCount,
    valveCueSourceRowCount: ledger.valveCueSourceRowCount,
    failures: ledger.failures,
    componentSummary: ledger.componentSummary,
    pasteableComponentBreakdown: ledger.pasteableComponentBreakdown
  };
}

export function assertManagedStageGeometryLedger(ledger) {
  if (!ledger || ledger.schema !== LEDGER_SCHEMA) throw new Error('Invalid managed-stage geometry ledger');
  if (!ledger.pass) {
    const failures = ledger.failures.map((item) => `${item.code}:${item.ref}:${item.reason}`).join('; ');
    throw new Error(`Managed-stage geometry ledger continuity failed: ${failures}`);
  }
  return { ok: true, sourceRowCount: ledger.sourceRowCount, branchNodeCount: ledger.branchNodeCount };
}

function buildSourceRows(rows) {
  const out = [];
  for (const row of rows || []) {
    if (row.supportLike) continue;
    if (row.sourceCoordinateKind !== 'APOS_LPOS') continue;
    const componentClass = classifyComponent(row);
    if (!COMPONENT_ORDER.includes(componentClass)) continue;
    out.push({
      sourceRecordId: row.path || row.name || row.recordName || `source-${out.length + 1}`,
      sourcePath: row.path || row.name || row.recordName || '',
      sourceName: row.name || row.recordName || row.path || '',
      componentClass,
      type: normalize(row.type),
      dtxr: normalize(row.dtxr),
      rawType: normalize(row.rawType),
      fromNode: String(row.fromNode || ''),
      toNode: String(row.toNode || ''),
      APOS: clonePoint(row.APOS || row.beforePlanning?.startMm),
      LPOS: clonePoint(row.LPOS || row.beforePlanning?.endMm),
      renderedStart: clonePoint(row.rendered?.startMm),
      renderedEnd: clonePoint(row.rendered?.endMm),
      previewTrimmed: Boolean(row.intentionalPreviewTrim),
      canvasObjects: [],
      generatedCueRefs: [],
      canvasSourceFound: false,
      canvasVisible: true,
      status: 'PENDING'
    });
  }
  return out;
}

function buildNodeLedger(sourceRows) {
  const byNode = new Map();
  const add = (nodeId, row, point, otherPoint, endpointKind) => {
    if (!nodeId || !point || !otherPoint) return;
    if (!byNode.has(nodeId)) byNode.set(nodeId, { nodeId, point: clonePoint(point), entries: [] });
    byNode.get(nodeId).entries.push({
      sourcePath: row.sourcePath,
      sourceName: row.sourceName,
      componentClass: row.componentClass,
      endpointKind,
      point: clonePoint(point),
      otherPoint: clonePoint(otherPoint),
      direction: unitDirection(point, otherPoint)
    });
  };
  for (const row of sourceRows) {
    add(row.fromNode, row, row.APOS, row.LPOS, 'start');
    add(row.toNode, row, row.LPOS, row.APOS, 'end');
  }
  return [...byNode.values()].map((node) => ({ ...node, degree: node.entries.length }));
}

function resolveBranchNode(node, branchCueNodes) {
  let bestPair = null;
  let bestDot = 1;
  for (let i = 0; i < node.entries.length; i += 1) {
    for (let j = i + 1; j < node.entries.length; j += 1) {
      const a = node.entries[i];
      const b = node.entries[j];
      const dot = dotPoint(a.direction, b.direction);
      if (Number.isFinite(dot) && dot < bestDot) {
        bestDot = dot;
        bestPair = [a, b];
      }
    }
  }
  const hasMainRunPair = Boolean(bestPair && bestDot <= BRANCH_COLLINEAR_DOT);
  const mainRun = hasMainRunPair ? bestPair.map((entry) => entry.sourceName) : [];
  const branchLegs = hasMainRunPair
    ? node.entries.filter((entry) => !bestPair.includes(entry)).map((entry) => entry.sourceName)
    : node.entries.map((entry) => entry.sourceName);
  return {
    nodeId: node.nodeId,
    degree: node.degree,
    point: clonePoint(node.point),
    hasMainRunPair,
    mainRun,
    branchLegs,
    bestOppositeDot: round(bestDot),
    hasBranchCue: branchCueNodes.has(String(node.nodeId)),
    status: hasMainRunPair && branchCueNodes.has(String(node.nodeId)) ? 'OK_INFERRED_OLET_BRANCH' : 'REVIEW'
  };
}

function buildComponentSummary(sourceRows, branchNodes, generatedCues, sourceObjectCountByPath, valveCuePaths) {
  const rows = [];
  for (const component of COMPONENT_ORDER) {
    const sourceCount = component === 'OLET_BRANCH' ? 0 : sourceRows.filter((row) => row.componentClass === component).length;
    const canvasSourceFound = component === 'OLET_BRANCH'
      ? 0
      : sourceRows.filter((row) => row.componentClass === component && sourceObjectCountByPath.has(row.sourcePath)).length;
    const generatedCueCount = generatedCueCountFor(component, branchNodes, generatedCues, valveCuePaths);
    rows.push({
      icon: COMPONENT_ICONS[component],
      component,
      label: COMPONENT_LABELS[component],
      jsonSourceCount: sourceCount,
      canvasSourceFound,
      generatedCueCount,
      status: summaryStatus(component, sourceCount, canvasSourceFound, generatedCueCount, branchNodes, valveCuePaths)
    });
  }
  return rows;
}

function generatedCueCountFor(component, branchNodes, generatedCues, valveCuePaths) {
  if (component === 'BEND') return generatedCues.filter((cue) => cue.family === 'ELBOW').length;
  if (component === 'OLET_BRANCH') return branchNodes.filter((node) => node.hasBranchCue).length;
  if (component === 'VALVE') return valveCuePaths.size;
  return 0;
}

function summaryStatus(component, sourceCount, canvasSourceFound, generatedCueCount, branchNodes, valveCuePaths) {
  if (component === 'OLET_BRANCH') return branchNodes.length === generatedCueCount ? 'OK_INFERRED_CUES' : 'CHECK_BRANCH_CUES';
  if (sourceCount !== canvasSourceFound) return 'CHECK_CANVAS_SOURCE';
  if (component === 'VALVE' && sourceCount !== valveCuePaths.size) return 'CHECK_VALVE_CUES';
  return 'OK_CANVAS_SOURCE';
}

function buildPasteableComponentBreakdown({ componentSummary, sourceRows, branchNodes }) {
  const totalSources = sourceRows.length;
  const totalCanvas = sourceRows.filter((row) => row.canvasSourceFound).length;
  const lines = [
    '🧾 BM_CII CANVAS GEOMETRY LEDGER',
    'Focus: Pipe / Bends / Tees / Flanges / Olet / Valves / Rigids',
    '',
    'Icon  Component     JSON Source  Canvas Source  Canvas Cue  Status'
  ];
  for (const row of componentSummary) {
    lines.push(`${row.icon}    ${String(row.label).padEnd(13)} ${String(row.jsonSourceCount).padStart(5)}        ${String(row.canvasSourceFound).padStart(5)}        ${String(row.generatedCueCount).padStart(5)}       ${row.status}`);
  }
  lines.push('');
  lines.push(`TOTAL GEOMETRY SOURCE ROWS = ${totalSources}`);
  lines.push(`TOTAL CANVAS SOURCE ROWS FOUND = ${totalCanvas}`);
  lines.push(`INFERRED OLET / BRANCH NODES = ${branchNodes.length}`);
  for (const node of branchNodes) {
    lines.push(`🟣 Node ${node.nodeId}: main=${node.mainRun.join(' + ') || 'UNRESOLVED'}; branch=${node.branchLegs.join(' + ') || 'none'}; cue=${node.hasBranchCue ? 'yes' : 'missing'}; status=${node.status}`);
  }
  return lines.join('\n');
}

function attachCueToParents(cue, data, sourceByPath, sourceByName) {
  const parentPaths = [data.sourcePathA, data.sourcePathB, data.sourceValvePath, data.sourcePath].filter(Boolean);
  const parentNames = [data.sourceRecordA, data.sourceRecordB, data.sourceName].filter(Boolean);
  for (const path of parentPaths) {
    const row = sourceByPath.get(path);
    if (row) row.generatedCueRefs.push(cue.name);
  }
  for (const name of parentNames) {
    const row = sourceByName.get(name);
    if (row && !row.generatedCueRefs.includes(cue.name)) row.generatedCueRefs.push(cue.name);
  }
}

function validateElbowCueAttachment(data, sourceByPath, sourceByName) {
  const parentA = sourceByPath.get(data.sourcePathA) || sourceByName.get(data.sourceRecordA);
  const parentB = sourceByPath.get(data.sourcePathB) || sourceByName.get(data.sourceRecordB);
  if (!parentA || !parentB) return { ok: false, reason: 'missing parent source row', maxGapMm: null };
  const gapA = pointToRenderedEndpointGap(data.tangentA, parentA);
  const gapB = pointToRenderedEndpointGap(data.tangentB, parentB);
  const maxGapMm = round(Math.max(gapA, gapB));
  return {
    ok: Number.isFinite(maxGapMm) && maxGapMm <= EPS_MM,
    reason: Number.isFinite(maxGapMm) && maxGapMm <= EPS_MM ? 'attached to rendered source tangent endpoints' : 'tangent endpoint is detached from rendered source endpoint',
    maxGapMm
  };
}

function pointToRenderedEndpointGap(point, row) {
  const p = pointFrom(point);
  const a = pointFrom(row.canvasObjects[0]?.previewStartMm || row.renderedStart || row.APOS);
  const b = pointFrom(row.canvasObjects[0]?.previewEndMm || row.renderedEnd || row.LPOS);
  if (!p || !a || !b) return Number.POSITIVE_INFINITY;
  return Math.min(pointDistance(p, a), pointDistance(p, b));
}

function canvasObjectSummary(object, data) {
  return {
    name: object.name || data.sourceName || '',
    sourcePath: data.sourcePath || '',
    primitiveKind: data.primitiveKind || '',
    visible: object.visible !== false,
    previewStartMm: clonePoint(data.previewStartMm || data.sourceStartMm || data.sourceAposMm),
    previewEndMm: clonePoint(data.previewEndMm || data.sourceEndMm || data.sourceLposMm),
    previewTrimmedForOrthogonalElbow: Boolean(data.previewTrimmedForOrthogonalElbow)
  };
}

function cueSummary(object, data) {
  const kind = normalizeCueKind(data.cueKind || data.sourceCueKind || object.name);
  return {
    name: object.name || kind,
    cueKind: kind,
    family: cueFamily(kind, object),
    node: String(data.node || ''),
    previewOnly: data.previewOnly !== false,
    exportedRvmGeometry: data.exportedRvmGeometry === true,
    parentSourcePaths: [data.sourcePathA, data.sourcePathB, data.sourceValvePath, data.sourcePath].filter(Boolean),
    parentSourceNames: [data.sourceRecordA, data.sourceRecordB, data.sourceName].filter(Boolean)
  };
}

function classifyComponent(row) {
  const raw = normalize(row.dtxr || row.type || row.rawType);
  const type = normalize(row.type || row.rawType);
  if (raw === 'PIPE' && normalize(row.rawType) === 'UNSPECIFIED') return 'RIGID';
  if (raw === 'UNSPECIFIED') return 'RIGID';
  if (raw === 'BEND' || type === 'BEND' || type === 'ELBO' || type === 'ELBOW') return 'BEND';
  if (raw === 'FLANGE' || raw === 'FLANGE_PAIR' || type === 'FLAN') return 'FLANGE';
  if (raw === 'VALVE' || raw === 'FLANGED_VALVE' || type === 'VALV') return 'VALVE';
  if (raw === 'TEE' || type === 'TEE') return 'TEE';
  if (raw.includes('OLET') || type.includes('OLET')) return 'OLET_BRANCH';
  if (raw === 'PIPE') return 'PIPE';
  return 'UNKNOWN';
}

function isManagedStagePreview(modelRoot, detail) {
  const data = modelRoot?.userData || {};
  const audit = data.managedStageCoordinateAudit || detail.previewCoordinateAudit || {};
  const text = [data.previewSource, data.previewSchema, data.sourceName, detail.sourceName, audit.schema, audit.source]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return text.includes('managedstage') || text.includes('managed-stage') || text.includes('raw-managed-stage-json') || Boolean(audit.rows);
}

function isCanvasSourceObject(data) {
  return data.TYPE === 'MANAGED_STAGE_RAW_PREVIEW'
    && data.previewAdditiveCue !== true
    && (data.primitiveKind === 'raw-staged-source-line' || data.previewSourceGeometry === 'APOS_LPOS');
}

function isGeneratedCueObject(data) {
  if (data.previewAdditiveCue === true) return true;
  if (data.TYPE === 'MANAGED_STAGE_PREVIEW_CUE') return true;
  return false;
}

function isElbowCue(data, object) {
  const kind = normalizeCueKind(data.cueKind || data.sourceCueKind || object?.name);
  return kind === 'orthogonal-elbow-preview' || kind === 'bend' || String(object?.name || '').startsWith('MANAGED_STAGE_1_5D_ELBOW_NODE_');
}

function normalizeCueKind(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'unknown-cue';
  const lower = raw.toLowerCase();
  if (lower === 'bend') return 'bend';
  if (lower === 'orthogonal-elbow-preview') return 'orthogonal-elbow-preview';
  if (lower === 'branch-fitting') return 'branch-fitting';
  if (lower === 'branch-fitting-leg') return 'branch-fitting-leg';
  if (lower === 'valve-opposed-cone-pair') return 'valve-opposed-cone-pair';
  return lower;
}

function cueFamily(kind, object) {
  if (kind === 'bend' || kind === 'orthogonal-elbow-preview' || String(object?.name || '').startsWith('MANAGED_STAGE_1_5D_ELBOW_NODE_')) return 'ELBOW';
  if (kind === 'branch-fitting' || kind === 'branch-fitting-leg') return 'BRANCH';
  if (kind === 'valve-opposed-cone-pair') return 'VALVE';
  return 'OTHER';
}

function failure(code, ref, reason) {
  return { code, ref, reason };
}

function unitDirection(from, to) {
  const a = pointFrom(from);
  const b = pointFrom(to);
  if (!a || !b) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (!(len > 0)) return null;
  return { x: dx / len, y: dy / len, z: dz / len };
}

function dotPoint(a, b) {
  if (!a || !b) return Number.NaN;
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function pointDistance(a, b) {
  const pa = pointFrom(a);
  const pb = pointFrom(b);
  if (!pa || !pb) return Number.POSITIVE_INFINITY;
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const dz = pb.z - pa.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function pointFrom(value) {
  if (!value) return null;
  const x = Number(value.x ?? value.X ?? value[0]);
  const y = Number(value.y ?? value.Y ?? value[1]);
  const z = Number(value.z ?? value.Z ?? value[2]);
  if (![x, y, z].every(Number.isFinite)) return null;
  return { x, y, z };
}

function clonePoint(value) {
  const point = pointFrom(value);
  return point ? { x: point.x, y: point.y, z: point.z } : null;
}

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function round(value) {
  if (!Number.isFinite(value)) return null;
  return Number(Number(value).toFixed(6));
}
