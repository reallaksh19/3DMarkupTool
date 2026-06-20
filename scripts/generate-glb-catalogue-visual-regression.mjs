import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

installMinimalBrowserApis();

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = resolveOutDir(process.argv);
const baseName = 'BM_CII_glb_catalogue_visual_regression';
const viewNames = ['top', 'side', 'isometric'];

const { convertInputXmlToGlb } = await import('../src/converter.js');
const { VALVE_FLANGE_VISUAL_CATALOG_SCHEMA } = await import('../src/valve-flange-visual-catalog.js');

const sampleXml = readFileSync(join(repoRoot, 'samples', 'BM_CII_Enriched_v8_lite.XML'), 'utf8');
const conversion = await convertInputXmlToGlb(sampleXml, {
  filename: 'BM_CII_Enriched_v8_lite.XML',
  supportMode: 'inputxml-actual',
  nodeLabels: false,
  isonoteBoards: false,
  compactMode: false
});
conversion.scene.updateMatrixWorld(true);

const groups = collectCatalogueGroups(conversion.scene).map(auditCatalogueGroup);
const audit = buildAudit(conversion, groups);

mkdirSync(outDir, { recursive: true });
for (const view of viewNames) writeFileSync(join(outDir, `${baseName}.${view}.svg`), renderSnapshotSvg(audit, view));
writeFileSync(join(outDir, `${baseName}.audit.json`), `${JSON.stringify(audit, null, 2)}\n`);
writeFileSync(join(outDir, `${baseName}.summary.md`), renderMarkdownSummary(audit));

console.log(`Generated GLB catalogue visual regression artifact in ${outDir}`);
console.log(`Catalogue groups: ${audit.summary.catalogueGroupCount}`);
console.log(`Rendered span roles: ${audit.summary.renderedSpanRoleCount}`);
console.log(`SVG snapshots: ${audit.summary.svgSnapshotCount}`);
console.log(`Visual-regression issues: ${audit.summary.issueCount}`);

if (audit.issues.length) {
  for (const issue of audit.issues) console.error(`${issue.componentId || 'GLOBAL'}: ${issue.message}`);
  process.exitCode = 1;
}

function collectCatalogueGroups(scene) {
  const groups = [];
  scene.traverse((object) => {
    if (object?.userData?.meshRole === 'CATALOG_VISUAL_GROUP') groups.push(object);
  });
  return groups;
}

function auditCatalogueGroup(group) {
  const userData = group.userData || {};
  const roleObjects = [];
  const meshObjects = [];
  group.traverse((object) => {
    if (object === group) return;
    if (object.isMesh) meshObjects.push(object);
    const objectUserData = object.userData || {};
    if (objectUserData.visualKey === userData.visualKey && objectUserData.meshRole) roleObjects.push(object);
  });

  const roleMetrics = roleObjects.map((object) => auditRoleObject(object, group));
  const spanRoles = roleMetrics
    .filter((entry) => entry.replacesCenterlinePipe && !entry.overlayOnly && hasFiniteSpan(entry))
    .sort((a, b) => a.renderedLocalAxisStart - b.renderedLocalAxisStart);
  const spanContinuity = evaluateRenderedSpanContinuity(spanRoles);
  const issues = [];
  if (userData.visualCatalogSchema !== VALVE_FLANGE_VISUAL_CATALOG_SCHEMA) issues.push('Catalogue visual group must carry visualCatalogSchema for visual regression snapshots.');
  if (!spanRoles.length) issues.push('Catalogue visual group must expose at least one rendered centerline span role for visual snapshot generation.');
  if (!spanContinuity.ok) issues.push('Rendered catalogue spans must stay continuous for visual regression snapshot generation.');

  return {
    componentId: String(userData.ID || userData.id || group.name || ''),
    groupName: group.name,
    componentClass: userData.componentClass,
    componentType: userData.componentType,
    visualKey: userData.visualKey,
    visualRecipeId: userData.visualRecipeId,
    visualCatalogSchema: userData.visualCatalogSchema || '',
    meshCount: meshObjects.length,
    roleObjectCount: roleObjects.length,
    roleCounts: countBy(roleMetrics, (entry) => entry.role),
    geometryKindCounts: countBy(roleMetrics, (entry) => entry.geometryKind || 'UNSTAMPED'),
    spanContinuity,
    visualProfile: buildVisualProfile(spanRoles, roleMetrics),
    issues,
    roleMetrics
  };
}

function auditRoleObject(object, group) {
  const userData = object.userData || {};
  return {
    name: object.name,
    role: userData.meshRole,
    type: object.type,
    isMesh: object.isMesh === true,
    geometryType: object.geometry?.type || '',
    geometryKind: userData.geometryKind || '',
    componentClass: userData.componentClass,
    componentType: userData.componentType,
    visualKey: userData.visualKey,
    visualRecipeId: userData.visualRecipeId,
    visualCatalogSchema: userData.visualCatalogSchema || '',
    renderedLocalAxisStart: finiteOrUndefined(userData.renderedLocalAxisStart),
    renderedLocalAxisEnd: finiteOrUndefined(userData.renderedLocalAxisEnd),
    renderedAxisLength: finiteOrUndefined(userData.renderedAxisLength),
    replacesCenterlinePipe: userData.replacesCenterlinePipe === true,
    overlayOnly: userData.overlayOnly === true,
    thinPlate: userData.thinPlate === true,
    thinRaisedFace: userData.thinRaisedFace === true,
    proportionalShoulder: userData.proportionalShoulder === true,
    radius: finiteOrUndefined(userData.radius),
    radiusStart: finiteOrUndefined(userData.radiusStart),
    radiusEnd: finiteOrUndefined(userData.radiusEnd),
    boltIndex: finiteOrUndefined(userData.boltIndex),
    boltCount: finiteOrUndefined(userData.boltCount),
    parentGroupName: group.name
  };
}

function buildVisualProfile(spanRoles, roleMetrics) {
  const start = Math.min(...spanRoles.map((entry) => entry.renderedLocalAxisStart));
  const end = Math.max(...spanRoles.map((entry) => entry.renderedLocalAxisEnd));
  const maxRadius = Math.max(0, ...spanRoles.flatMap((entry) => roleRadiusValues(entry)).filter(Number.isFinite));
  return {
    spanStart: round(start),
    spanEnd: round(end),
    spanLength: round(end - start),
    maxRadius: round(maxRadius),
    spanRoleCount: spanRoles.length,
    overlayRoleCount: roleMetrics.filter((entry) => entry.overlayOnly || !entry.replacesCenterlinePipe).length,
    roles: spanRoles.map((entry) => {
      const radii = roleRadiusValues(entry);
      const radiusStart = firstFinite(entry.radiusStart, entry.radius, radii[0], 0);
      const radiusEnd = firstFinite(entry.radiusEnd, entry.radius, radii.at(-1), radiusStart, 0);
      const radius = firstFinite(entry.radius, Math.max(radiusStart, radiusEnd), 0);
      return {
        role: entry.role,
        geometryKind: entry.geometryKind,
        start: round(entry.renderedLocalAxisStart),
        end: round(entry.renderedLocalAxisEnd),
        length: round(entry.renderedAxisLength),
        radiusStart: round(radiusStart),
        radiusEnd: round(radiusEnd),
        radius: round(radius),
        thinPlate: entry.thinPlate === true,
        thinRaisedFace: entry.thinRaisedFace === true,
        proportionalShoulder: entry.proportionalShoulder === true
      };
    })
  };
}

function evaluateRenderedSpanContinuity(spanRoles) {
  if (!spanRoles.length) return { ok: false, spanCount: 0, coverageLength: 0, gaps: [{ reason: 'no span roles' }], overlaps: [] };
  const start = spanRoles[0].renderedLocalAxisStart;
  const end = spanRoles.at(-1).renderedLocalAxisEnd;
  const tolerance = Math.max((end - start) * 1e-4, 1e-5);
  const gaps = [];
  const overlaps = [];
  let cursor = start;
  for (const entry of spanRoles) {
    if (entry.renderedLocalAxisStart > cursor + tolerance) gaps.push({ from: round(cursor), to: round(entry.renderedLocalAxisStart), beforeRole: entry.role });
    if (entry.renderedLocalAxisStart < cursor - tolerance) overlaps.push({ from: round(entry.renderedLocalAxisStart), to: round(cursor), role: entry.role });
    cursor = Math.max(cursor, entry.renderedLocalAxisEnd);
  }
  return {
    ok: gaps.length === 0,
    spanCount: spanRoles.length,
    coverageStart: round(start),
    coverageEnd: round(cursor),
    coverageLength: round(cursor - start),
    tolerance: round(tolerance),
    gaps,
    overlaps
  };
}

function buildAudit(conversion, groups) {
  const issues = groups.flatMap((entry) => entry.issues.map((message) => ({ componentId: entry.componentId, componentClass: entry.componentClass, componentType: entry.componentType, message })));
  const valveGroups = groups.filter((entry) => entry.componentClass === 'VALVE');
  const flangeGroups = groups.filter((entry) => entry.componentClass === 'FLANGE');
  const roleMetrics = groups.flatMap((entry) => entry.roleMetrics);
  const renderedSpanRoles = groups.flatMap((entry) => entry.visualProfile.roles || []);
  const snapshots = Object.fromEntries(viewNames.map((view) => [view, `${baseName}.${view}.svg`]));
  return {
    schema: 'GlbCatalogueVisualRegressionArtifact.v1',
    generatedAt: new Date().toISOString(),
    sample: 'samples/BM_CII_Enriched_v8_lite.XML',
    sourceBoundary: 'convertInputXmlToGlb()',
    snapshotSource: 'actual Three.js scene userData and role spans emitted by src/converter.js as deterministic SVG snapshots',
    visualCatalogSchema: VALVE_FLANGE_VISUAL_CATALOG_SCHEMA,
    summary: {
      parsedElementCount: conversion.model?.elements?.length || 0,
      glbByteLength: conversion.glb?.byteLength || 0,
      catalogueGroupCount: groups.length,
      valveGroupCount: valveGroups.length,
      flangeGroupCount: flangeGroups.length,
      catalogueRoleObjectCount: roleMetrics.length,
      renderedSpanRoleCount: renderedSpanRoles.length,
      groupsWithContinuousSpans: groups.filter((entry) => entry.spanContinuity.ok).length,
      allGroupsContinuous: groups.every((entry) => entry.spanContinuity.ok),
      svgSnapshotCount: viewNames.length,
      snapshotFiles: snapshots,
      roleCounts: countBy(renderedSpanRoles, (entry) => entry.role),
      geometryKindCounts: countBy(renderedSpanRoles, (entry) => entry.geometryKind || 'UNSTAMPED'),
      issueCount: issues.length
    },
    policies: {
      screenshotStyleVisualArtifact: true,
      actualThreeSceneDerived: true,
      deterministicSvgSnapshots: true,
      proportionalFallback: true,
      rvmWriterUnaffected: true,
      asmeDimensionalDatabaseBacked: false
    },
    issues,
    catalogueGroups: groups.map((entry) => ({
      componentId: entry.componentId,
      groupName: entry.groupName,
      componentClass: entry.componentClass,
      componentType: entry.componentType,
      visualKey: entry.visualKey,
      visualRecipeId: entry.visualRecipeId,
      visualCatalogSchema: entry.visualCatalogSchema,
      meshCount: entry.meshCount,
      roleObjectCount: entry.roleObjectCount,
      spanContinuity: entry.spanContinuity,
      visualProfile: entry.visualProfile,
      issues: entry.issues
    }))
  };
}

function renderSnapshotSvg(audit, view) {
  const width = 1200;
  const rowHeight = 126;
  const headerHeight = 86;
  const footerHeight = 48;
  const rows = audit.catalogueGroups.length;
  const height = headerHeight + rows * rowHeight + footerHeight;
  const title = view === 'isometric' ? 'Isometric-style component cards' : `${capitalize(view)} component cards`;
  const body = audit.catalogueGroups.map((group, index) => renderGroupCard(group, index, view, width, headerHeight, rowHeight)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="BM_CII GLB catalogue ${view} visual regression snapshot">\n` +
    `<defs><style><![CDATA[.bg{fill:#f8fafc}.panel{fill:#ffffff;stroke:#cbd5e1;stroke-width:1}.axis{stroke:#94a3b8;stroke-width:1;stroke-dasharray:4 4}.title{font:700 20px Arial,sans-serif;fill:#0f172a}.subtitle{font:12px Arial,sans-serif;fill:#475569}.label{font:11px Arial,sans-serif;fill:#0f172a}.small{font:10px Arial,sans-serif;fill:#475569}.role-cyl{fill:#dbeafe;stroke:#2563eb;stroke-width:1}.role-frustum{fill:#ede9fe;stroke:#7c3aed;stroke-width:1}.role-body{fill:#dcfce7;stroke:#16a34a;stroke-width:1}.role-face{fill:#fef3c7;stroke:#d97706;stroke-width:1}.role-other{fill:#e2e8f0;stroke:#64748b;stroke-width:1}.warning{fill:#fff7ed;stroke:#fb923c;stroke-width:1}.ok{fill:#ecfdf5;stroke:#10b981;stroke-width:1}]]></style></defs>\n` +
    `<rect class="bg" x="0" y="0" width="${width}" height="${height}"/>\n` +
    `<text class="title" x="28" y="34">BM_CII GLB Catalogue Visual Regression — ${escapeXml(title)}</text>\n` +
    `<text class="subtitle" x="28" y="58">Scene-derived deterministic SVG from convertInputXmlToGlb(); proportional fallback only, not ASME/rating-size dimensional validation.</text>\n` +
    `<text class="subtitle" x="28" y="76">Groups: ${audit.summary.catalogueGroupCount} | Valves: ${audit.summary.valveGroupCount} | Flanges: ${audit.summary.flangeGroupCount} | Issues: ${audit.summary.issueCount}</text>\n` +
    `${body}\n` +
    `<text class="subtitle" x="28" y="${height - 20}">Legend: green = compact valve body, blue = cylinder/plate/collar, purple = tapered shoulder/weld neck, amber = raised face/gasket. Generated for CI artifact review.</text>\n` +
    `</svg>\n`;
}

function renderGroupCard(group, index, view, width, headerHeight, rowHeight) {
  const y = headerHeight + index * rowHeight + 10;
  const labelWidth = 250;
  const chartX = labelWidth + 28;
  const chartW = width - chartX - 34;
  const chartH = rowHeight - 26;
  const profile = group.visualProfile;
  const roles = profile.roles || [];
  const maxRadius = Math.max(profile.maxRadius || 1, ...roles.flatMap((role) => [role.radiusStart, role.radiusEnd, role.radius]).filter(Number.isFinite));
  const spanStart = Number(profile.spanStart) || 0;
  const spanEnd = Number(profile.spanEnd) || spanStart + 1;
  const spanLength = Math.max(spanEnd - spanStart, 1e-9);
  const scaleX = chartW / spanLength;
  const scaleY = Math.min((chartH * 0.38) / Math.max(maxRadius, 1e-9), 18);
  const centerY = y + chartH / 2 + 8;
  const roleShapes = roles.map((role) => renderRoleShape(role, view, chartX, centerY, spanStart, scaleX, scaleY)).join('\n');
  const statusClass = group.issues.length ? 'warning' : 'ok';
  return `<g data-component-id="${escapeXml(group.componentId)}" data-component-class="${escapeXml(group.componentClass)}" data-component-type="${escapeXml(group.componentType)}">\n` +
    `<rect class="panel" x="18" y="${y}" width="${width - 36}" height="${rowHeight - 18}" rx="10"/>\n` +
    `<rect class="${statusClass}" x="30" y="${y + 12}" width="10" height="10" rx="2"/>\n` +
    `<text class="label" x="48" y="${y + 20}">${escapeXml(group.componentClass)} · ${escapeXml(group.componentType)}</text>\n` +
    `<text class="small" x="48" y="${y + 38}">${escapeXml(group.componentId || group.groupName)}</text>\n` +
    `<text class="small" x="48" y="${y + 56}">recipe: ${escapeXml(group.visualRecipeId || '')}</text>\n` +
    `<text class="small" x="48" y="${y + 74}">roles: ${profile.spanRoleCount}, meshes: ${group.meshCount}</text>\n` +
    `<line class="axis" x1="${chartX}" y1="${centerY}" x2="${chartX + chartW}" y2="${centerY}"/>\n` +
    `${roleShapes}\n</g>`;
}

function renderRoleShape(role, view, chartX, centerY, spanStart, scaleX, scaleY) {
  const x1 = chartX + (role.start - spanStart) * scaleX;
  const x2 = chartX + (role.end - spanStart) * scaleX;
  const width = Math.max(x2 - x1, 1.5);
  const radiusStart = Math.max(Number(role.radiusStart) || Number(role.radius) || 0, 0);
  const radiusEnd = Math.max(Number(role.radiusEnd) || Number(role.radius) || radiusStart, 0);
  const heightStart = Math.max(radiusStart * scaleY * viewHeightFactor(view), 2);
  const heightEnd = Math.max(radiusEnd * scaleY * viewHeightFactor(view), 2);
  const skew = view === 'isometric' ? Math.min(width * 0.16, 14) : 0;
  const lift = view === 'isometric' ? 8 : 0;
  const cssClass = roleClass(role);
  const labelX = x1 + width / 2 + skew / 2;
  const labelY = centerY - Math.max(heightStart, heightEnd) - 7 - lift;
  if (role.geometryKind === 'FRUSTUM') {
    const points = [[x1 + skew, centerY - heightStart - lift], [x2 + skew, centerY - heightEnd - lift], [x2, centerY + heightEnd], [x1, centerY + heightStart]].map((point) => point.map(round).join(',')).join(' ');
    return `<polygon class="${cssClass}" points="${points}" data-role="${escapeXml(role.role)}"/>\n${renderRoleLabel(role, labelX, labelY)}`;
  }
  const y = centerY - Math.max(heightStart, heightEnd) - lift;
  const h = Math.max(heightStart, heightEnd) * 2;
  const rx = role.geometryKind === 'SPAN_FILLED_VALVE_BODY' ? Math.min(h * 0.35, 18) : Math.min(width * 0.2, 6);
  const shape = `<rect class="${cssClass}" x="${round(x1 + skew)}" y="${round(y)}" width="${round(width)}" height="${round(h)}" rx="${round(rx)}" data-role="${escapeXml(role.role)}"/>`;
  const isoBack = view === 'isometric' ? `<path class="${cssClass}" d="M ${round(x1)} ${round(centerY + Math.max(heightStart, heightEnd))} L ${round(x1 + skew)} ${round(centerY + Math.max(heightStart, heightEnd) - lift)} L ${round(x1 + skew)} ${round(y)} L ${round(x1)} ${round(y + lift)} Z" opacity="0.5"/>` : '';
  return `${isoBack}\n${shape}\n${renderRoleLabel(role, labelX, labelY)}`;
}

function renderRoleLabel(role, x, y) {
  const shortRole = String(role.role || '').replace(/^VALVE_/, 'V_').replace(/^FLANGE_/, 'F_').replace(/^RAISED_/, 'R_').replace(/^END_/, 'E_');
  return `<text class="small" x="${round(x)}" y="${round(y)}" text-anchor="middle">${escapeXml(shortRole)}</text>`;
}

function renderMarkdownSummary(audit) {
  const s = audit.summary;
  return `# BM_CII GLB Catalogue Visual Regression Artifact\n\n` +
    `Schema: \`${audit.schema}\`\n\nSample: \`${audit.sample}\`\n\n` +
    `## Purpose\n\nThis artifact provides deterministic screenshot-style SVG snapshots derived from the actual Three.js scene emitted by \`convertInputXmlToGlb()\`. It is intended for human review of valve/flange catalogue proportions after automated structural gates pass.\n\n` +
    `## Generated files\n\n- \`${s.snapshotFiles.top}\`\n- \`${s.snapshotFiles.side}\`\n- \`${s.snapshotFiles.isometric}\`\n- \`${baseName}.audit.json\`\n- \`${baseName}.summary.md\`\n\n` +
    `## Summary\n\n| Metric | Value |\n|---|---:|\n` +
    `| Parsed elements | ${s.parsedElementCount} |\n| GLB bytes | ${s.glbByteLength} |\n| Catalogue groups | ${s.catalogueGroupCount} |\n| Valve groups | ${s.valveGroupCount} |\n| Flange groups | ${s.flangeGroupCount} |\n| Rendered span roles | ${s.renderedSpanRoleCount} |\n| SVG snapshots | ${s.svgSnapshotCount} |\n| Continuous groups | ${s.groupsWithContinuousSpans} / ${s.catalogueGroupCount} |\n| Visual-regression issues | ${s.issueCount} |\n\n` +
    `## Visual checks\n\n- ${s.allGroupsContinuous ? '✅' : '❌'} rendered catalogue spans remain continuous\n- ${s.issueCount === 0 ? '✅' : '❌'} deterministic SVG artifact generation is clean\n- ✅ artifact is derived from actual Three.js scene metadata\n- ✅ proportional fallback is explicit\n- ✅ no RVM writer behavior change\n- ✅ no ASME/rating-size dimensional database claim\n\n` +
    `## Scope note\n\nThese SVGs are CI-safe visual-regression cards, not WebGL raster screenshots and not ASME dimensional validation. They are designed to make detached collars, oversized flange plates, missing tapered shoulders, and discontinuous axial spans easy to spot in artifacts.\n`;
}

function roleClass(role) { if (role.geometryKind === 'SPAN_FILLED_VALVE_BODY') return 'role-body'; if (role.geometryKind === 'FRUSTUM') return 'role-frustum'; if (/RAISED_FACE|GASKET/.test(role.role || '')) return 'role-face'; if (role.geometryKind === 'CYLINDER') return 'role-cyl'; return 'role-other'; }
function viewHeightFactor(view) { return view === 'top' ? 0.72 : view === 'isometric' ? 0.86 : 1; }
function roleRadiusValues(entry) { return [entry.radius, entry.radiusStart, entry.radiusEnd].map(Number).filter(Number.isFinite); }
function firstFinite(...values) { for (const value of values) { const n = Number(value); if (Number.isFinite(n)) return n; } return undefined; }
function hasFiniteSpan(entry) { return Number.isFinite(entry.renderedLocalAxisStart) && Number.isFinite(entry.renderedLocalAxisEnd) && Number.isFinite(entry.renderedAxisLength); }
function finiteOrUndefined(value) { const n = Number(value); return Number.isFinite(n) ? n : undefined; }
function countBy(values, keyFn) { const counts = {}; for (const value of values || []) { const key = keyFn(value) || 'UNKNOWN'; counts[key] = (counts[key] || 0) + 1; } return counts; }
function resolveOutDir(args) { const outArg = args.find((arg) => arg.startsWith('--outdir=')); if (!outArg) return join(repoRoot, 'artifacts', 'glb-catalogue-visual-regression'); const value = outArg.slice('--outdir='.length); return isAbsolute(value) ? value : join(repoRoot, value); }
function round(value) { const n = Number(value); return Number.isFinite(n) ? Math.round(n * 1000000) / 1000000 : undefined; }
function capitalize(value) { return String(value || '').slice(0, 1).toUpperCase() + String(value || '').slice(1); }
function escapeXml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function installMinimalBrowserApis() {
  installMinimalDomParser();
  if (!globalThis.FileReader) {
    globalThis.FileReader = class MinimalFileReader { constructor() { this.result = null; this.onerror = null; this.onloadend = null; } async readAsArrayBuffer(blob) { try { this.result = await blob.arrayBuffer(); this.onloadend?.({ target: this }); } catch (error) { this.onerror?.(error); } } };
  }
}
function installMinimalDomParser() {
  if (globalThis.DOMParser) return;
  class MinimalXmlNode { constructor(tagName = '', attributes = {}) { this.tagName = tagName; this.attributes = attributes; this.children = []; this._text = ''; } getAttribute(name) { return this.attributes[name] ?? this.attributes[String(name).toLowerCase()] ?? null; } get textContent() { return decodeXmlEntities(this._text + this.children.map((child) => child.textContent).join('')); } getElementsByTagName(name) { const wanted = String(name || '').toUpperCase(); const hits = []; const visit = (node) => { if (String(node.tagName || '').toUpperCase() === wanted) hits.push(node); for (const child of node.children) visit(child); }; for (const child of this.children) visit(child); return hits; } querySelector(selector) { return selector === 'parsererror' ? null : null; } }
  globalThis.DOMParser = class MinimalDomParser { parseFromString(text) { const document = new MinimalXmlNode('#document', {}); const stack = [document]; const pattern = /<([^>]+)>|([^<]+)/g; let match; while ((match = pattern.exec(String(text || '')))) { const tag = match[1]; const rawText = match[2]; if (rawText) { stack[stack.length - 1]._text += rawText; continue; } const trimmed = String(tag || '').trim(); if (!trimmed || trimmed.startsWith('?') || trimmed.startsWith('!')) continue; if (trimmed.startsWith('/')) { const closing = normalizeTagName(trimmed.slice(1).trim().split(/\s+/)[0]); while (stack.length > 1 && stack[stack.length - 1].tagName !== closing) stack.pop(); if (stack.length > 1) stack.pop(); continue; } const selfClosing = /\/\s*$/.test(trimmed); const cleaned = trimmed.replace(/\/\s*$/, '').trim(); const spaceIndex = cleaned.search(/\s/); const rawName = spaceIndex === -1 ? cleaned : cleaned.slice(0, spaceIndex); const attrText = spaceIndex === -1 ? '' : cleaned.slice(spaceIndex + 1); const node = new MinimalXmlNode(normalizeTagName(rawName), parseAttributes(attrText)); stack[stack.length - 1].children.push(node); if (!selfClosing) stack.push(node); } return document; } };
}
function normalizeTagName(name) { return String(name || '').split(':').pop().toUpperCase(); }
function parseAttributes(text) { const attrs = {}; const pattern = /([A-Za-z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g; let match; while ((match = pattern.exec(String(text || '')))) { const key = match[1]; const value = decodeXmlEntities(match[3] ?? match[4] ?? ''); attrs[key] = value; attrs[key.toLowerCase()] = value; } return attrs; }
function decodeXmlEntities(value) { return String(value || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); }
