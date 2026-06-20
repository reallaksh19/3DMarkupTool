import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

installMinimalBrowserApis();

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = resolveOutDir(process.argv);
const baseName = 'BM_CII_glb_support_restraint_visual_regression';
const viewNames = ['top', 'side', 'isometric'];
const SUPPORT_PARITY = 'CATALOGUE_GEOMETRY_ADAPTER';

const THREE = await import('three');
const { convertInputXmlToGlb } = await import('../src/converter.js');
const { SUPPORT_RESTRAINT_CATALOG_SCHEMA_VERSION } = await import('../src/support-restraint-visual-catalog.js');

const sampleXml = readFileSync(join(repoRoot, 'samples', 'BM_CII_Enriched_v8_lite.XML'), 'utf8');
const conversion = await convertInputXmlToGlb(sampleXml, {
  filename: 'BM_CII_Enriched_v8_lite.XML',
  supportMode: 'compare',
  nodeLabels: false,
  isonoteBoards: false,
  compactMode: false,
  isonoteText: readOptional(join(repoRoot, 'samples', 'BM_CII_ISONOTE_sideload.csv'), ''),
  lineNoText: readOptional(join(repoRoot, 'samples', 'BM_CII_LINE_NO_sideload.csv'), 'NODE,LINE_NO\n10,BM_CII_SAMPLE')
});
conversion.scene.updateMatrixWorld(true);

const symbols = collectSupportSymbols(conversion.scene).map(auditSupportSymbol);
const audit = buildAudit(conversion, symbols);

mkdirSync(outDir, { recursive: true });
for (const view of viewNames) writeFileSync(join(outDir, `${baseName}.${view}.svg`), renderSnapshotSvg(audit, view));
writeFileSync(join(outDir, `${baseName}.audit.json`), `${JSON.stringify(audit, null, 2)}\n`);
writeFileSync(join(outDir, `${baseName}.summary.md`), renderMarkdownSummary(audit));

console.log(`Generated GLB support/restraint visual-regression artifact in ${outDir}`);
console.log(`Support symbols: ${audit.summary.supportSymbolCount}`);
console.log(`Support parts: ${audit.summary.supportPartCount}`);
console.log(`SVG snapshots: ${audit.summary.svgSnapshotCount}`);
console.log(`Visual-regression issues: ${audit.summary.issueCount}`);

if (audit.issues.length) {
  for (const issue of audit.issues) console.error(`${issue.symbolName || 'support-scene'}: ${issue.message}`);
  process.exitCode = 1;
}

function collectSupportSymbols(scene) {
  const symbols = [];
  scene.traverse((object) => {
    if (object?.userData?.TYPE === 'SUPPORT_RESTRAINT') symbols.push(object);
  });
  return symbols;
}

function auditSupportSymbol(symbol) {
  const userData = symbol.userData || {};
  const parts = [];
  symbol.traverse?.((child) => {
    if (child === symbol) return;
    if (child?.userData?.TYPE === 'SUPPORT_RESTRAINT_PART') parts.push(auditSupportPart(child));
  });
  const box = new THREE.Box3().setFromObject(symbol);
  const finiteBounds = !box.isEmpty() && finiteVector(box.min) && finiteVector(box.max);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const issues = [];
  if (userData.TYPE !== 'SUPPORT_RESTRAINT') issues.push('Support visual card must come from TYPE=SUPPORT_RESTRAINT scene object.');
  if (!parts.length) issues.push('Support visual card must contain adapter-generated SUPPORT_RESTRAINT_PART children.');
  if (!finiteBounds) issues.push('Support visual card world bounds must be finite.');
  if (userData.supportCatalogueSceneParity !== SUPPORT_PARITY) issues.push(`Support scene parity must be ${SUPPORT_PARITY}.`);
  if (userData.SUPPORT_CATALOGUE_SCHEMA !== SUPPORT_RESTRAINT_CATALOG_SCHEMA_VERSION) issues.push('Support catalogue schema must be stamped on scene object.');
  if (userData.SUPPORT_CATALOGUE_VENDOR_DIMENSIONAL_DB_BACKED !== false) issues.push('Vendor dimensional DB backing must remain false.');
  if (userData.SUPPORT_CATALOGUE_PROPORTIONAL_FALLBACK !== true) issues.push('Proportional fallback must remain explicit.');
  if (parts.some((part) => part.issues.length)) issues.push('All support visual parts must have clean adapter metadata and finite bounds.');
  return {
    symbolName: symbol.name || '',
    family: userData.SUPPORT_CATALOGUE_FAMILY || userData.family || '',
    recipeId: userData.SUPPORT_CATALOGUE_RECIPE_ID || '',
    schema: userData.SUPPORT_CATALOGUE_SCHEMA || '',
    node: userData.node || '',
    sourceClass: userData.sourceClass || '',
    axis: userData.axis || '',
    parity: userData.supportCatalogueSceneParity || '',
    visualProfile: {
      center: vectorRecord(center),
      size: { ...vectorRecord(size), maxAxis: round(Math.max(size.x, size.y, size.z)) },
      finiteBounds,
      partCount: parts.length,
      primitiveKindCounts: countBy(parts, (part) => part.primitiveKind || 'UNSTAMPED'),
      roles: parts
    },
    issues
  };
}

function auditSupportPart(part) {
  const userData = part.userData || {};
  const box = new THREE.Box3().setFromObject(part);
  const finiteBounds = !box.isEmpty() && finiteVector(box.min) && finiteVector(box.max);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const issues = [];
  if (userData.supportCataloguePrimitiveAdapter !== true) issues.push('Support part must be marked supportCataloguePrimitiveAdapter=true.');
  if (userData.supportCatalogueSceneParity !== SUPPORT_PARITY) issues.push(`Support part parity must be ${SUPPORT_PARITY}.`);
  if (!['cylinder', 'box', 'pyramid', 'sphere'].includes(userData.primitiveKind)) issues.push(`Unsupported support visual primitive kind: ${userData.primitiveKind}`);
  if (!finiteBounds) issues.push('Support visual part bounds must be finite.');
  if (userData.supportCatalogueSchema !== SUPPORT_RESTRAINT_CATALOG_SCHEMA_VERSION) issues.push('Support part must carry supportCatalogueSchema.');
  return {
    name: part.name || '',
    meshRole: userData.meshRole || '',
    primitiveKind: userData.primitiveKind || '',
    family: userData.supportCatalogueFamily || userData.supportVisualFamily || '',
    recipeId: userData.supportCatalogueRecipeId || userData.supportVisualRecipeId || '',
    schema: userData.supportCatalogueSchema || '',
    adapterOrdinal: finiteOrUndefined(userData.adapterOrdinal),
    center: vectorRecord(center),
    size: { ...vectorRecord(size), maxAxis: round(Math.max(size.x, size.y, size.z)) },
    finiteBounds,
    issues
  };
}

function buildAudit(conversion, symbols) {
  const issues = symbols.flatMap((entry) => entry.issues.map((message) => ({ symbolName: entry.symbolName, family: entry.family, node: entry.node, message })));
  if (!symbols.length) issues.push({ symbolName: 'supports.restraints', message: 'BM_CII GLB scene must emit support/restraint visual symbols.' });
  const parts = symbols.flatMap((entry) => entry.visualProfile.roles || []);
  const snapshotFiles = Object.fromEntries(viewNames.map((view) => [view, `${baseName}.${view}.svg`]));
  return {
    schema: 'GlbSupportRestraintVisualRegressionArtifact.v1',
    generatedAt: new Date().toISOString(),
    sample: 'samples/BM_CII_Enriched_v8_lite.XML',
    sourceBoundary: 'convertInputXmlToGlb()',
    snapshotSource: 'actual Three.js support/restraint scene objects and adapter-generated primitive parts from src/geometry.js',
    supportCatalogueSchema: SUPPORT_RESTRAINT_CATALOG_SCHEMA_VERSION,
    supportCatalogueSceneParity: SUPPORT_PARITY,
    summary: {
      parsedElementCount: conversion.model?.elements?.length || 0,
      glbByteLength: conversion.glb?.byteLength || 0,
      supportSymbolCount: symbols.length,
      supportPartCount: parts.length,
      symbolsWithFiniteBounds: symbols.filter((entry) => entry.visualProfile.finiteBounds).length,
      allSymbolsFinite: symbols.length > 0 && symbols.every((entry) => entry.visualProfile.finiteBounds),
      symbolsWithAdapterParts: symbols.filter((entry) => entry.visualProfile.partCount > 0).length,
      allSymbolsUseAdapterParts: symbols.length > 0 && symbols.every((entry) => entry.visualProfile.partCount > 0),
      families: unique(symbols.map((entry) => entry.family)),
      sourceClasses: unique(symbols.map((entry) => entry.sourceClass)),
      primitiveKindCounts: countBy(parts, (entry) => entry.primitiveKind || 'UNSTAMPED'),
      roleCounts: countBy(parts, (entry) => entry.meshRole || 'UNSTAMPED'),
      svgSnapshotCount: viewNames.length,
      snapshotFiles,
      issueCount: issues.length
    },
    policies: {
      screenshotStyleVisualArtifact: true,
      actualThreeSceneDerived: true,
      deterministicSvgSnapshots: true,
      supportCatalogueGeometryAdapterRequired: true,
      proportionalFallback: true,
      vendorDimensionalDatabaseBacked: false,
      asmeDimensionalDatabaseBacked: false,
      rvmWriterUnaffected: true,
      valveFlangeUnaffected: true,
      uiUnaffected: true
    },
    issues,
    supportSymbols: symbols,
    ok: issues.length === 0
  };
}

function renderSnapshotSvg(audit, view) {
  const width = 1200;
  const rowHeight = 132;
  const headerHeight = 88;
  const footerHeight = 52;
  const rows = audit.supportSymbols.length;
  const height = headerHeight + rows * rowHeight + footerHeight;
  const title = view === 'isometric' ? 'Isometric-style support cards' : `${capitalize(view)} support cards`;
  const cards = audit.supportSymbols.map((symbol, index) => renderSymbolCard(symbol, index, view, width, headerHeight, rowHeight)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="BM_CII GLB support restraint ${view} visual regression snapshot">\n` +
    `<defs><style><![CDATA[.bg{fill:#f8fafc}.panel{fill:#ffffff;stroke:#cbd5e1;stroke-width:1}.axis{stroke:#94a3b8;stroke-width:1;stroke-dasharray:4 4}.title{font:700 20px Arial,sans-serif;fill:#0f172a}.subtitle{font:12px Arial,sans-serif;fill:#475569}.label{font:11px Arial,sans-serif;fill:#0f172a}.small{font:10px Arial,sans-serif;fill:#475569}.kind-cylinder{fill:#dbeafe;stroke:#2563eb;stroke-width:1}.kind-box{fill:#dcfce7;stroke:#16a34a;stroke-width:1}.kind-pyramid{fill:#ede9fe;stroke:#7c3aed;stroke-width:1}.kind-sphere{fill:#fef3c7;stroke:#d97706;stroke-width:1}.kind-other{fill:#e2e8f0;stroke:#64748b;stroke-width:1}.warning{fill:#fff7ed;stroke:#fb923c;stroke-width:1}.ok{fill:#ecfdf5;stroke:#10b981;stroke-width:1}]]></style></defs>\n` +
    `<rect class="bg" x="0" y="0" width="${width}" height="${height}"/>\n` +
    `<text class="title" x="28" y="34">BM_CII GLB Support / Restraint Visual Regression — ${escapeXml(title)}</text>\n` +
    `<text class="subtitle" x="28" y="58">Scene-derived deterministic SVG from convertInputXmlToGlb(); proportional fallback only, not vendor/ASME dimensional validation.</text>\n` +
    `<text class="subtitle" x="28" y="76">Symbols: ${audit.summary.supportSymbolCount} | Parts: ${audit.summary.supportPartCount} | Parity: ${escapeXml(audit.supportCatalogueSceneParity)} | Issues: ${audit.summary.issueCount}</text>\n` +
    `${cards}\n` +
    `<text class="subtitle" x="28" y="${height - 22}">Legend: blue=cylinder, green=box, purple=pyramid, amber=sphere. Generated for CI artifact review; not WebGL raster screenshots.</text>\n` +
    `</svg>\n`;
}

function renderSymbolCard(symbol, index, view, width, headerHeight, rowHeight) {
  const y = headerHeight + index * rowHeight + 10;
  const labelWidth = 278;
  const chartX = labelWidth + 30;
  const chartW = width - chartX - 38;
  const chartH = rowHeight - 26;
  const profile = symbol.visualProfile;
  const parts = profile.roles || [];
  const maxAxis = Math.max(profile.size?.maxAxis || 1, ...parts.map((part) => part.size?.maxAxis || 0), 1e-9);
  const scale = Math.min(chartW / Math.max(maxAxis, 1e-9), chartH / Math.max(maxAxis, 1e-9), 42);
  const centerX = chartX + chartW / 2;
  const centerY = y + chartH / 2 + 8;
  const shapes = parts.map((part) => renderPartShape(part, view, centerX, centerY, scale)).join('\n');
  const statusClass = symbol.issues.length ? 'warning' : 'ok';
  return `<g data-symbol-name="${escapeXml(symbol.symbolName)}" data-family="${escapeXml(symbol.family)}" data-node="${escapeXml(symbol.node)}">\n` +
    `<rect class="panel" x="18" y="${y}" width="${width - 36}" height="${rowHeight - 18}" rx="10"/>\n` +
    `<rect class="${statusClass}" x="30" y="${y + 12}" width="10" height="10" rx="2"/>\n` +
    `<text class="label" x="48" y="${y + 20}">${escapeXml(symbol.family || 'SUPPORT')} · ${escapeXml(symbol.sourceClass || '')}</text>\n` +
    `<text class="small" x="48" y="${y + 38}">${escapeXml(symbol.symbolName)}</text>\n` +
    `<text class="small" x="48" y="${y + 56}">node: ${escapeXml(symbol.node || '')} axis: ${escapeXml(symbol.axis || '')}</text>\n` +
    `<text class="small" x="48" y="${y + 74}">recipe: ${escapeXml(symbol.recipeId || '')}</text>\n` +
    `<text class="small" x="48" y="${y + 92}">parts: ${profile.partCount}, max: ${profile.size?.maxAxis ?? ''}</text>\n` +
    `<line class="axis" x1="${chartX}" y1="${centerY}" x2="${chartX + chartW}" y2="${centerY}"/>\n` +
    `${shapes}\n` +
    `</g>`;
}

function renderPartShape(part, view, centerX, centerY, scale) {
  const projected = projectPart(part, view, centerX, centerY, scale);
  const cls = `kind-${['cylinder', 'box', 'pyramid', 'sphere'].includes(part.primitiveKind) ? part.primitiveKind : 'other'}`;
  const attrs = `data-role="${escapeXml(part.meshRole)}" data-primitive-kind="${escapeXml(part.primitiveKind)}" data-adapter-ordinal="${part.adapterOrdinal ?? ''}"`;
  if (part.primitiveKind === 'sphere') {
    const r = Math.max(Math.min(projected.w, projected.h) / 2, 3);
    return `<circle class="${cls}" ${attrs} cx="${round(projected.x + projected.w / 2)}" cy="${round(projected.y + projected.h / 2)}" r="${round(r)}"/>`;
  }
  if (part.primitiveKind === 'pyramid') {
    const x = projected.x;
    const y = projected.y;
    const w = projected.w;
    const h = projected.h;
    return `<polygon class="${cls}" ${attrs} points="${round(x + w / 2)},${round(y)} ${round(x + w)},${round(y + h)} ${round(x)},${round(y + h)}"/>`;
  }
  return `<rect class="${cls}" ${attrs} x="${round(projected.x)}" y="${round(projected.y)}" width="${round(projected.w)}" height="${round(projected.h)}" rx="3"/>`;
}

function projectPart(part, view, centerX, centerY, scale) {
  const c = part.center || { x: 0, y: 0, z: 0 };
  const s = part.size || { x: 0.1, y: 0.1, z: 0.1 };
  let px;
  let py;
  let w;
  let h;
  if (view === 'top') {
    px = c.x; py = c.z; w = s.x; h = s.z;
  } else if (view === 'side') {
    px = c.x; py = -c.y; w = s.x; h = s.y;
  } else {
    px = c.x * 0.82 + c.z * 0.42; py = -c.y * 0.86 + c.z * 0.28; w = Math.max(s.x, s.z) * 0.9; h = Math.max(s.y, s.z) * 0.72;
  }
  const drawW = Math.max(w * scale, 4);
  const drawH = Math.max(h * scale, 4);
  return { x: centerX + px * scale - drawW / 2, y: centerY + py * scale - drawH / 2, w: drawW, h: drawH };
}

function renderMarkdownSummary(audit) {
  const s = audit.summary;
  return `# BM_CII GLB Support / Restraint Visual Regression Artifact\n\n` +
    `Schema: \`${audit.schema}\`\n\n` +
    `Sample: \`${audit.sample}\`\n\n` +
    `This report generates deterministic screenshot-style SVG snapshots from actual Three.js support/restraint scene objects emitted by \`convertInputXmlToGlb()\`. These are not WebGL raster screenshots and are not vendor/ASME dimensional validation.\n\n` +
    `## Summary\n\n` +
    `| Metric | Value |\n|---|---:|\n` +
    `| GLB bytes | ${s.glbByteLength} |\n` +
    `| Support symbols | ${s.supportSymbolCount} |\n` +
    `| Adapter primitive parts | ${s.supportPartCount} |\n` +
    `| Symbols with finite bounds | ${s.symbolsWithFiniteBounds} / ${s.supportSymbolCount} |\n` +
    `| Symbols using adapter parts | ${s.symbolsWithAdapterParts} / ${s.supportSymbolCount} |\n` +
    `| Visual-regression issues | ${s.issueCount} |\n` +
    `| SVG snapshots | ${s.svgSnapshotCount} |\n\n` +
    `## Snapshot files\n\n` +
    renderList(Object.values(s.snapshotFiles || {})) +
    `\n## Primitive kinds\n\n${renderCountMap(s.primitiveKindCounts)}\n` +
    `## Families\n\n${renderList(s.families)}\n` +
    `## Scope / non-claims\n\n` +
    `- ✅ Actual Three.js scene-derived support/restraint visual artifact\n` +
    `- ✅ Catalogue geometry adapter parts required\n` +
    `- ✅ Proportional fallback remains explicit\n` +
    `- ✅ No vendor/ASME dimensional database claim\n` +
    `- ✅ No UI or RVM writer behavior change\n`;
}

function countBy(values, fn) {
  return values.reduce((acc, value) => {
    const key = String(fn(value) || 'UNKNOWN');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}
function finiteVector(vector) { return [vector.x, vector.y, vector.z].every(Number.isFinite); }
function vectorRecord(vector) { return { x: round(vector.x), y: round(vector.y), z: round(vector.z) }; }
function finiteOrUndefined(value) { const n = Number(value); return Number.isFinite(n) ? n : undefined; }
function round(value) { const n = Number(value); return Number.isFinite(n) ? Math.round(n * 1000000) / 1000000 : undefined; }
function unique(values) { return Array.from(new Set((values || []).filter((value) => value !== undefined && value !== null && String(value).trim() !== '').map(String))).sort((a, b) => a.localeCompare(b)); }
function renderList(values) { return values?.length ? values.map((value) => `- \`${value}\``).join('\n') + '\n' : '- none\n'; }
function renderCountMap(map = {}) { const entries = Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])); return entries.length ? entries.map(([key, value]) => `- \`${key}\`: ${value}`).join('\n') + '\n' : '- none\n'; }
function capitalize(value) { return String(value || '').slice(0, 1).toUpperCase() + String(value || '').slice(1); }
function escapeXml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function readOptional(path, fallback = '') { try { return readFileSync(path, 'utf8'); } catch { return fallback; } }
function resolveOutDir(args) { const outArg = args.find((arg) => arg.startsWith('--outdir=')); if (!outArg) return join(repoRoot, 'artifacts', 'glb-support-restraint-visual-regression'); const value = outArg.slice('--outdir='.length); return isAbsolute(value) ? value : join(repoRoot, value); }

function installMinimalBrowserApis() {
  installMinimalDomParser();
  if (!globalThis.FileReader) {
    globalThis.FileReader = class MinimalFileReader {
      constructor() { this.result = null; this.onerror = null; this.onloadend = null; }
      async readAsArrayBuffer(blob) {
        try { this.result = await blob.arrayBuffer(); this.onloadend?.({ target: this }); } catch (error) { this.onerror?.(error); }
      }
    };
  }
}
function installMinimalDomParser() {
  if (globalThis.DOMParser) return;
  class MinimalXmlNode {
    constructor(tagName = '', attributes = {}) { this.tagName = tagName; this.attributes = attributes; this.children = []; this._text = ''; }
    getAttribute(name) { return this.attributes[name] ?? this.attributes[String(name).toLowerCase()] ?? null; }
    get textContent() { return decodeXmlEntities(this._text + this.children.map((child) => child.textContent).join('')); }
    getElementsByTagName(name) { const wanted = String(name || '').toUpperCase(); const hits = []; const visit = (node) => { if (String(node.tagName || '').toUpperCase() === wanted) hits.push(node); for (const child of node.children) visit(child); }; for (const child of this.children) visit(child); return hits; }
    querySelector(selector) { return selector === 'parsererror' ? null : null; }
  }
  globalThis.DOMParser = class MinimalDomParser {
    parseFromString(text) {
      const document = new MinimalXmlNode('#document', {});
      const stack = [document];
      const pattern = /<([^>]+)>|([^<]+)/g;
      let match;
      while ((match = pattern.exec(String(text || '')))) {
        const tag = match[1];
        const rawText = match[2];
        if (rawText) { stack[stack.length - 1]._text += rawText; continue; }
        const trimmed = String(tag || '').trim();
        if (!trimmed || trimmed.startsWith('?') || trimmed.startsWith('!')) continue;
        if (trimmed.startsWith('/')) { const closing = normalizeTagName(trimmed.slice(1).trim().split(/\s+/)[0]); while (stack.length > 1 && stack[stack.length - 1].tagName !== closing) stack.pop(); if (stack.length > 1) stack.pop(); continue; }
        const selfClosing = /\/\s*$/.test(trimmed);
        const cleaned = trimmed.replace(/\/\s*$/, '').trim();
        const spaceIndex = cleaned.search(/\s/);
        const rawName = spaceIndex === -1 ? cleaned : cleaned.slice(0, spaceIndex);
        const attrText = spaceIndex === -1 ? '' : cleaned.slice(spaceIndex + 1);
        const node = new MinimalXmlNode(normalizeTagName(rawName), parseAttributes(attrText));
        stack[stack.length - 1].children.push(node);
        if (!selfClosing) stack.push(node);
      }
      return document;
    }
  };
}
function normalizeTagName(name) { return String(name || '').split(':').pop().toUpperCase(); }
function parseAttributes(text) { const attrs = {}; const pattern = /([A-Za-z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g; let match; while ((match = pattern.exec(String(text || '')))) { const key = match[1]; const value = decodeXmlEntities(match[3] ?? match[4] ?? ''); attrs[key] = value; attrs[key.toLowerCase()] = value; } return attrs; }
function decodeXmlEntities(value) { return String(value || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); }
