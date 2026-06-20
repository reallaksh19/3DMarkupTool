import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

installMinimalBrowserApis();

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = resolveOutDir(process.argv);
const baseName = 'BM_CII_glb_support_restraint_scene';

const THREE = await import('three');
const { convertInputXmlToGlb } = await import('../src/converter.js');
const {
  SUPPORT_RESTRAINT_CATALOG_SCHEMA_VERSION,
  resolveSupportRestraintVisualSpec
} = await import('../src/support-restraint-visual-catalog.js');

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

const supportGroup = conversion.scene.getObjectByName?.('supports.restraints') || null;
const supportSymbols = collectSupportSymbols(conversion.scene).map(auditSupportSymbol);
const audit = buildAudit(conversion, supportGroup, supportSymbols);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${baseName}.audit.json`), `${JSON.stringify(audit, null, 2)}\n`);
writeFileSync(join(outDir, `${baseName}.summary.md`), renderMarkdownSummary(audit));

console.log(`Generated GLB support/restraint scene audit in ${outDir}`);
console.log(`Support scene symbols: ${audit.summary.supportSymbolCount}`);
console.log(`Support scene meshes: ${audit.summary.supportMeshCount}`);
console.log(`GLB support catalogue scene parity: ${audit.summary.glbSupportCatalogueSceneParity}`);
console.log(`Scene issues: ${audit.summary.issueCount}`);
console.log(`Scene warnings: ${audit.summary.warningCount}`);

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

function auditSupportSymbol(object) {
  const userData = object.userData || {};
  const expectedSpec = resolveSupportRestraintVisualSpec({ family: userData.family || userData.FAMILY || userData.axis });
  const meshCount = countDescendantMeshes(object);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const finiteBounds = [size.x, size.y, size.z, center.x, center.y, center.z].every(Number.isFinite);
  const sceneMetadata = sceneSupportCatalogueMetadata(userData);
  const issues = [];
  const warnings = [];
  if (userData.TYPE !== 'SUPPORT_RESTRAINT') issues.push('Support symbol must retain TYPE=SUPPORT_RESTRAINT in scene userData.');
  if (!userData.family) issues.push('Support symbol must retain family metadata in scene userData.');
  if (!userData.node) issues.push('Support symbol must retain node metadata in scene userData.');
  if (!userData.sourceClass) issues.push('Support symbol must retain sourceClass metadata in scene userData.');
  if (!meshCount) issues.push('Support symbol must contain at least one actual mesh descendant.');
  if (!finiteBounds) issues.push('Support symbol world bounds must be finite after GLB scene construction.');
  if (!sceneMetadata.hasCatalogueMetadata) {
    warnings.push('GLB support/restraint scene object is still legacy inline metadata; SUPPORT_CATALOGUE_* scene stamping is pending C18.');
  }
  if (sceneMetadata.schema && sceneMetadata.schema !== SUPPORT_RESTRAINT_CATALOG_SCHEMA_VERSION) {
    issues.push(`Support catalogue scene schema mismatch: ${sceneMetadata.schema}`);
  }
  return {
    symbolName: object.name,
    objectType: object.type,
    isMesh: object.isMesh === true,
    meshCount,
    childCount: object.children?.length || 0,
    family: userData.family || '',
    expectedCatalogueFamily: expectedSpec.family,
    expectedCatalogueRecipeId: expectedSpec.recipeId,
    expectedCatalogueSchema: expectedSpec.catalogSchemaVersion,
    node: userData.node,
    axis: userData.axis,
    sign: userData.sign,
    sourceClass: userData.sourceClass,
    source: userData.source,
    sourceMode: userData.sourceMode,
    gapMm: finiteOrUndefined(userData.gapMm),
    mappingContract: userData.mappingContract || '',
    engineeringContact: userData.engineeringContact || '',
    visualResolverApplied: userData.visualResolverApplied === true,
    sceneCatalogueMetadata: sceneMetadata,
    worldBounds: {
      center: { x: round(center.x), y: round(center.y), z: round(center.z) },
      size: { x: round(size.x), y: round(size.y), z: round(size.z), maxAxis: round(Math.max(size.x, size.y, size.z)) },
      finite: finiteBounds
    },
    issues,
    warnings
  };
}

function sceneSupportCatalogueMetadata(userData = {}) {
  const visualFlag = userData.SUPPORT_CATALOGUE_VISUAL ?? userData.supportCatalogueVisual ?? userData.supportVisual ?? userData.supportCatalogue;
  const family = userData.SUPPORT_CATALOGUE_FAMILY ?? userData.supportCatalogueFamily ?? userData.supportVisualFamily;
  const recipeId = userData.SUPPORT_CATALOGUE_RECIPE_ID ?? userData.supportCatalogueRecipeId ?? userData.supportVisualRecipeId;
  const schema = userData.SUPPORT_CATALOGUE_SCHEMA ?? userData.supportCatalogueSchema ?? userData.supportVisualSchema;
  const proportionalFallback = userData.SUPPORT_CATALOGUE_PROPORTIONAL_FALLBACK ?? userData.supportCatalogueProportionalFallback ?? userData.proportionalFallback;
  const vendorDb = userData.SUPPORT_CATALOGUE_VENDOR_DIMENSIONAL_DB_BACKED ?? userData.supportCatalogueVendorDimensionalDbBacked ?? userData.vendorDimensionalDbBacked;
  return {
    hasCatalogueMetadata: Boolean(visualFlag || family || recipeId || schema),
    visual: normalBoolean(visualFlag),
    family: family || '',
    recipeId: recipeId || '',
    schema: schema || '',
    proportionalFallback: normalBoolean(proportionalFallback),
    vendorDimensionalDbBacked: normalBoolean(vendorDb)
  };
}

function buildAudit(conversion, supportGroup, symbols) {
  const issues = symbols.flatMap((entry) => entry.issues.map((message) => ({ symbolName: entry.symbolName, family: entry.family, sourceClass: entry.sourceClass, message })));
  const warnings = symbols.flatMap((entry) => entry.warnings.map((message) => ({ symbolName: entry.symbolName, family: entry.family, sourceClass: entry.sourceClass, message })));
  if (!supportGroup) issues.push({ symbolName: 'supports.restraints', message: 'GLB scene must contain supports.restraints group.' });
  if (!symbols.length) issues.push({ symbolName: 'supports.restraints', message: 'BM_CII GLB scene must emit support/restraint symbols.' });
  const metadataCount = symbols.filter((entry) => entry.sceneCatalogueMetadata.hasCatalogueMetadata).length;
  const parity = metadataCount === symbols.length && symbols.length > 0 ? 'PRODUCTION_WIRED' : 'LEGACY_INLINE_SYMBOLS';
  const families = unique(symbols.map((entry) => entry.family));
  const expectedFamilies = unique(symbols.map((entry) => entry.expectedCatalogueFamily));
  const sourceClasses = unique(symbols.map((entry) => entry.sourceClass));
  return {
    schema: 'GlbSupportRestraintSceneVisualAudit.v1',
    generatedAt: new Date().toISOString(),
    sample: 'samples/BM_CII_Enriched_v8_lite.XML',
    sourceKind: conversion.model?.sourceKind || conversion.scene?.userData?.sourceKind || 'unknown',
    actualScenePath: {
      converterBoundary: 'convertInputXmlToGlb()',
      sceneSource: 'Three.js Scene returned by src/converter.js',
      supportSceneGroup: 'supports.restraints',
      note: 'This audit inspects actual GLB scene support/restraint symbols. C17 is an audit phase; production support catalogue scene stamping is a follow-up.'
    },
    contract: {
      scope: 'GLB support/restraint scene visual audit',
      glbSupportCatalogueSceneParity: parity,
      proportionalFallback: true,
      vendorDimensionalDbBacked: false,
      asmeDimensionalDbBacked: false,
      rvmWriterUnaffected: true,
      uiUnaffected: true,
      externalViewerExecutedInCi: false
    },
    summary: {
      sceneName: conversion.scene?.name || '',
      parsedElementCount: conversion.model?.elements?.length || 0,
      parsedInputXmlRestraints: conversion.model?.restraints?.length || 0,
      converterAuditSupportSymbols: conversion.audit?.supportSymbols?.length || 0,
      glbByteLength: conversion.glb?.byteLength || 0,
      hasSupportSceneGroup: Boolean(supportGroup),
      supportSymbolCount: symbols.length,
      supportMeshCount: sum(symbols, (entry) => entry.meshCount),
      supportCatalogueSceneMetadataSymbolCount: metadataCount,
      glbSupportCatalogueSceneParity: parity,
      families,
      expectedCatalogueFamilies: expectedFamilies,
      sourceClasses,
      expectedCatalogueSchema: SUPPORT_RESTRAINT_CATALOG_SCHEMA_VERSION,
      symbolsWithFiniteBounds: symbols.filter((entry) => entry.worldBounds.finite).length,
      issueCount: issues.length,
      warningCount: warnings.length,
      ok: issues.length === 0
    },
    policies: {
      actualThreeSceneAudit: true,
      supportCatalogueSceneMetadataRequired: false,
      supportCatalogueSceneMetadataFollowUp: 'C18',
      proportionalFallback: true,
      vendorDimensionalDatabaseBacked: false,
      rvmWriterUnaffected: true,
      uiUnaffected: true
    },
    issues,
    warnings,
    supportSymbols: symbols,
    ok: issues.length === 0
  };
}

function renderMarkdownSummary(audit) {
  const s = audit.summary;
  const c = audit.contract;
  return `# BM_CII GLB Support / Restraint Scene Visual Audit\n\n` +
    `Schema: \`${audit.schema}\`\n\n` +
    `Sample: \`${audit.sample}\`\n\n` +
    `## Scope\n\n` +
    `This report audits actual Three.js scene objects emitted by \`convertInputXmlToGlb()\` for support/restraint symbols. It verifies presence, finite bounds, source/family/node metadata, and records the current GLB-side catalogue parity status.\n\n` +
    `| Contract item | Value |\n|---|---:|\n` +
    `| GLB support catalogue scene parity | ${c.glbSupportCatalogueSceneParity} |\n` +
    `| Proportional fallback | ${c.proportionalFallback ? 'TRUE' : 'FALSE'} |\n` +
    `| Vendor dimensional DB backed | ${c.vendorDimensionalDbBacked ? 'TRUE' : 'FALSE'} |\n` +
    `| ASME dimensional DB backed | ${c.asmeDimensionalDbBacked ? 'TRUE' : 'FALSE'} |\n` +
    `| RVM writer affected | ${c.rvmWriterUnaffected ? 'FALSE' : 'TRUE'} |\n` +
    `| UI affected | ${c.uiUnaffected ? 'FALSE' : 'TRUE'} |\n` +
    `| External viewer executed in CI | ${c.externalViewerExecutedInCi ? 'TRUE' : 'FALSE'} |\n\n` +
    `## Scene summary\n\n` +
    `| Metric | Value |\n|---|---:|\n` +
    `| GLB bytes | ${s.glbByteLength} |\n` +
    `| Support scene group present | ${s.hasSupportSceneGroup ? 'TRUE' : 'FALSE'} |\n` +
    `| Parsed InputXML restraints | ${s.parsedInputXmlRestraints} |\n` +
    `| Converter audit support symbols | ${s.converterAuditSupportSymbols} |\n` +
    `| Scene support symbols | ${s.supportSymbolCount} |\n` +
    `| Scene support meshes | ${s.supportMeshCount} |\n` +
    `| Symbols with finite bounds | ${s.symbolsWithFiniteBounds} / ${s.supportSymbolCount} |\n` +
    `| Symbols with support catalogue scene metadata | ${s.supportCatalogueSceneMetadataSymbolCount} / ${s.supportSymbolCount} |\n` +
    `| Scene issues | ${s.issueCount} |\n` +
    `| Scene warnings | ${s.warningCount} |\n\n` +
    `## Families\n\n${renderList(s.families)}\n` +
    `## Expected catalogue families\n\n${renderList(s.expectedCatalogueFamilies)}\n` +
    `## Source classes\n\n${renderList(s.sourceClasses)}\n` +
    `## C17 result\n\n` +
    `- ${s.ok ? '✅' : '❌'} support/restraint scene objects are present and finite\n` +
    `- ${s.glbSupportCatalogueSceneParity === 'LEGACY_INLINE_SYMBOLS' ? '⚠️' : '✅'} GLB support catalogue scene parity: \`${s.glbSupportCatalogueSceneParity}\`\n` +
    `- ✅ proportional fallback remains explicit\n` +
    `- ✅ no vendor/ASME dimensional database claim\n` +
    `- ✅ no UI or RVM writer behavior change\n\n` +
    `## Follow-up\n\n` +
    `C18 should wire/stamp the support-restraint catalogue into the GLB scene path so support/restraint scene objects expose SUPPORT_CATALOGUE_* or equivalent camelCase userData, matching the RVM/ATT path already proven by C16.\n`;
}

function countDescendantMeshes(object) { let count = 0; object.traverse?.((child) => { if (child.isMesh) count += 1; }); return count; }
function finiteOrUndefined(value) { const n = Number(value); return Number.isFinite(n) ? n : undefined; }
function normalBoolean(value) { if (value === true || value === 'TRUE') return true; if (value === false || value === 'FALSE') return false; return undefined; }
function sum(values, fn) { return values.reduce((acc, value) => acc + (Number(fn(value)) || 0), 0); }
function unique(values) { return Array.from(new Set((values || []).filter((value) => value !== undefined && value !== null && String(value).trim() !== '').map(String))).sort((a, b) => a.localeCompare(b)); }
function renderList(values) { return values?.length ? values.map((value) => `- \`${value}\``).join('\n') + '\n' : '- none\n'; }
function resolveOutDir(args) { const outArg = args.find((arg) => arg.startsWith('--outdir=')); if (!outArg) return join(repoRoot, 'artifacts', 'glb-support-restraint-scene-audit'); const value = outArg.slice('--outdir='.length); return isAbsolute(value) ? value : join(repoRoot, value); }
function round(value) { const n = Number(value); return Number.isFinite(n) ? Math.round(n * 1000000) / 1000000 : undefined; }
function readOptional(path, fallback = '') { try { return readFileSync(path, 'utf8'); } catch { return fallback; } }

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
