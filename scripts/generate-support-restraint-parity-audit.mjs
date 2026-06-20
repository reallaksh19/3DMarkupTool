import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

installMinimalDomParser();

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = resolveOutDir(process.argv);
const baseName = 'BM_CII_support_restraint_parity';
const writerSafeKinds = ['cylinder', 'box', 'pyramid', 'sphere'];
const requiredSupportCatalogueAttributes = [
  'SUPPORT_CATALOGUE_VISUAL',
  'SUPPORT_CATALOGUE_FAMILY',
  'SUPPORT_CATALOGUE_RECIPE_ID',
  'SUPPORT_CATALOGUE_SCHEMA',
  'SUPPORT_CATALOGUE_PROPORTIONAL_FALLBACK',
  'SUPPORT_CATALOGUE_VENDOR_DIMENSIONAL_DB_BACKED',
  'SUPPORT_CATALOGUE_EXPORT_PRODUCTION_WIRING'
];

const { convertInputXmlToRvmAtt } = await import('../src/rvm-converter.js');

const result = convertInputXmlToRvmAtt(readFileSync(join(repoRoot, 'samples', 'BM_CII_Enriched_v8_lite.XML'), 'utf8'), {
  filename: 'BM_CII_Enriched_v8_lite.XML',
  supportMode: 'compare',
  nodeLabels: false,
  isonoteBoards: false,
  isonoteText: readOptional(join(repoRoot, 'samples', 'BM_CII_ISONOTE_sideload.csv'), ''),
  lineNoText: readOptional(join(repoRoot, 'samples', 'BM_CII_LINE_NO_sideload.csv'), 'NODE,LINE_NO\n10,BM_CII_SAMPLE')
});

mkdirSync(outDir, { recursive: true });
const audit = buildAudit(result);
writeFileSync(join(outDir, `${baseName}.audit.json`), `${JSON.stringify(audit, null, 2)}\n`);
writeFileSync(join(outDir, `${baseName}.summary.md`), renderMarkdownSummary(audit));

console.log(`Generated support/restraint parity audit in ${outDir}`);
console.log(`Support nodes: ${audit.summary.supportNodeCount}`);
console.log(`Support primitives: ${audit.summary.supportPrimitiveCount}`);
console.log(`Catalogue metadata nodes: ${audit.summary.supportCatalogueMetadataNodeCount}`);
console.log(`Families: ${audit.summary.families.join(', ')}`);
console.log(`Catalogue families: ${audit.summary.supportCatalogueFamilies.join(', ')}`);
console.log(`Writer kinds: ${audit.summary.writerKinds.join(', ')}`);

function buildAudit(exportResult) {
  const allNodes = collectNodes(exportResult.exportModel.root);
  const supportGroup = allNodes.find((node) => node.attributes?.ROLE === 'SUPPORTS_RESTRAINTS');
  const supportNodes = (supportGroup?.children || []).filter((node) => node.attributes?.TYPE === 'SUPPORT_RESTRAINT');
  const supportPrimitives = supportNodes.flatMap((node) => node.primitives || []);
  const writerKinds = unique(supportPrimitives.map((primitive) => primitive.kind));
  const unsupportedWriterKinds = writerKinds.filter((kind) => !writerSafeKinds.includes(kind));
  const families = unique(supportNodes.map((node) => node.attributes?.FAMILY));
  const sourceClasses = unique(supportNodes.map((node) => node.attributes?.SOURCE_CLASS));
  const supportCatalogueFamilies = unique(supportNodes.map((node) => node.attributes?.SUPPORT_CATALOGUE_FAMILY));
  const supportCatalogueSchemas = unique(supportNodes.map((node) => node.attributes?.SUPPORT_CATALOGUE_SCHEMA));
  const supportCatalogueRecipeIds = unique(supportNodes.map((node) => node.attributes?.SUPPORT_CATALOGUE_RECIPE_ID));
  const supportCatalogueMetadataNodes = supportNodes.filter((node) => hasAllSupportCatalogueAttributes(node.attributes || {}));
  const primitiveNames = supportPrimitives.map((primitive) => primitive.name || '');
  const roleCoverage = {
    arrowStems: primitiveNames.filter((name) => name.endsWith('_STEM')).length,
    arrowHeads: primitiveNames.filter((name) => name.endsWith('_HEAD')).length,
    warningBoxes: primitiveNames.filter((name) => name.includes('WARNING_BOX') || name.includes('UNMAPPED_BOX')).length,
    springMarkers: primitiveNames.filter((name) => name.includes('_SPRING_')).length
  };
  const attMetadataPresent = {
    TYPE_SUPPORT_RESTRAINT: /TYPE := 'SUPPORT_RESTRAINT'/.test(exportResult.att),
    FAMILY: /FAMILY := '[^']+'/.test(exportResult.att),
    SOURCE_CLASS: /SOURCE_CLASS := '(ACTUAL|EXPECTED)'/.test(exportResult.att),
    SOURCE_MODE: /SOURCE_MODE := '[^']+'/.test(exportResult.att),
    GAP_MM: /GAP_MM := '[^']+'/.test(exportResult.att),
    TARGET_VIEWER: /TARGET_VIEWER := 'Navisworks'/.test(exportResult.att),
    SUPPORT_CATALOGUE_VISUAL: /SUPPORT_CATALOGUE_VISUAL := 'TRUE'/.test(exportResult.att),
    SUPPORT_CATALOGUE_FAMILY: /SUPPORT_CATALOGUE_FAMILY := '[^']+'/.test(exportResult.att),
    SUPPORT_CATALOGUE_RECIPE_ID: /SUPPORT_CATALOGUE_RECIPE_ID := '[^']+'/.test(exportResult.att),
    SUPPORT_CATALOGUE_SCHEMA: /SUPPORT_CATALOGUE_SCHEMA := '[^']+'/.test(exportResult.att),
    SUPPORT_CATALOGUE_PROPORTIONAL_FALLBACK: /SUPPORT_CATALOGUE_PROPORTIONAL_FALLBACK := 'TRUE'/.test(exportResult.att),
    SUPPORT_CATALOGUE_VENDOR_DIMENSIONAL_DB_BACKED: /SUPPORT_CATALOGUE_VENDOR_DIMENSIONAL_DB_BACKED := 'FALSE'/.test(exportResult.att),
    SUPPORT_CATALOGUE_EXPORT_PRODUCTION_WIRING: /SUPPORT_CATALOGUE_EXPORT_PRODUCTION_WIRING := 'TRUE'/.test(exportResult.att)
  };
  const metadataIssues = collectMetadataIssues(supportNodes);
  const catalogueMetadataIssues = collectCatalogueMetadataIssues(supportNodes);
  const finitePrimitiveIssues = collectPrimitiveIssues(supportNodes);
  const issues = [];
  if (!supportGroup) issues.push('missing SUPPORTS_RESTRAINTS group');
  if (!supportNodes.length) issues.push('no support/restraint nodes exported from BM_CII sample');
  if (unsupportedWriterKinds.length) issues.push(`unsupported writer kinds: ${unsupportedWriterKinds.join(', ')}`);
  if (!exportResult.exportModel.audit?.supportCatalogueExportParity) issues.push('export model audit did not enable supportCatalogueExportParity');
  if (!exportResult.exportModel.audit?.supportCatalogueProductionWiring) issues.push('export model audit did not enable supportCatalogueProductionWiring');
  if (exportResult.exportModel.audit?.supportCatalogueRewrittenNodeCount !== supportNodes.length) issues.push(`support catalogue rewritten node count mismatch: ${exportResult.exportModel.audit?.supportCatalogueRewrittenNodeCount} !== ${supportNodes.length}`);
  if (supportCatalogueMetadataNodes.length !== supportNodes.length) issues.push(`support catalogue metadata incomplete: ${supportCatalogueMetadataNodes.length}/${supportNodes.length} nodes have required SUPPORT_CATALOGUE_* attributes`);
  for (const [key, ok] of Object.entries(attMetadataPresent)) if (!ok) issues.push(`ATT support metadata missing ${key}`);
  issues.push(...metadataIssues, ...catalogueMetadataIssues, ...finitePrimitiveIssues);

  return {
    schema: 'SupportRestraintParityAudit.v2',
    generatedAt: new Date().toISOString(),
    sample: 'samples/BM_CII_Enriched_v8_lite.XML',
    outputs: {
      audit: `${baseName}.audit.json`,
      summary: `${baseName}.summary.md`
    },
    contract: {
      scope: 'support/restraint production catalogue parity audit',
      supportCatalogueParity: 'PRODUCTION_WIRED',
      proportionalFallback: true,
      vendorDimensionalDbBacked: false,
      asmeDimensionalDbBacked: false,
      writerSafePrimitiveKinds: writerSafeKinds,
      productionRvmPath: true,
      productionAttPath: true,
      productionCatalogueWiring: true,
      externalViewerExecutedInCi: false
    },
    summary: {
      exportSupportCount: exportResult.exportModel.audit.supportCount,
      supportNodeCount: supportNodes.length,
      supportPrimitiveCount: supportPrimitives.length,
      supportCatalogueExportParity: Boolean(exportResult.exportModel.audit?.supportCatalogueExportParity),
      supportCatalogueProductionWiring: Boolean(exportResult.exportModel.audit?.supportCatalogueProductionWiring),
      supportCatalogueRewrittenNodeCount: exportResult.exportModel.audit?.supportCatalogueRewrittenNodeCount || 0,
      supportCataloguePrimitiveCount: exportResult.exportModel.audit?.supportCataloguePrimitiveCount || 0,
      supportCatalogueMetadataNodeCount: supportCatalogueMetadataNodes.length,
      supportCatalogueFamilies,
      supportCatalogueSchemas,
      supportCatalogueRecipeIds,
      families,
      sourceClasses,
      writerKinds,
      unsupportedWriterKinds,
      roleCoverage,
      attMetadataPresent,
      metadataIssueCount: metadataIssues.length,
      catalogueMetadataIssueCount: catalogueMetadataIssues.length,
      finitePrimitiveIssueCount: finitePrimitiveIssues.length,
      ok: issues.length === 0
    },
    supportNodes: supportNodes.map((node) => ({
      name: node.name,
      family: node.attributes?.FAMILY,
      node: node.attributes?.NODE,
      axis: node.attributes?.AXIS,
      sourceClass: node.attributes?.SOURCE_CLASS,
      sourceMode: node.attributes?.SOURCE_MODE,
      gapMm: node.attributes?.GAP_MM,
      targetViewer: node.attributes?.TARGET_VIEWER,
      supportCatalogueVisual: node.attributes?.SUPPORT_CATALOGUE_VISUAL,
      supportCatalogueFamily: node.attributes?.SUPPORT_CATALOGUE_FAMILY,
      supportCatalogueRecipeId: node.attributes?.SUPPORT_CATALOGUE_RECIPE_ID,
      supportCatalogueSchema: node.attributes?.SUPPORT_CATALOGUE_SCHEMA,
      supportCatalogueProportionalFallback: node.attributes?.SUPPORT_CATALOGUE_PROPORTIONAL_FALLBACK,
      supportCatalogueVendorDimensionalDbBacked: node.attributes?.SUPPORT_CATALOGUE_VENDOR_DIMENSIONAL_DB_BACKED,
      supportCatalogueExportProductionWiring: node.attributes?.SUPPORT_CATALOGUE_EXPORT_PRODUCTION_WIRING,
      primitiveCount: (node.primitives || []).length,
      primitiveKinds: unique((node.primitives || []).map((primitive) => primitive.kind)),
      primitiveNames: (node.primitives || []).map((primitive) => primitive.name)
    })),
    issues,
    ok: issues.length === 0
  };
}

function collectMetadataIssues(supportNodes) {
  const required = ['TYPE', 'ID', 'NODE', 'FAMILY', 'AXIS', 'SIGN', 'SOURCE_CLASS', 'SOURCE', 'SOURCE_MODE', 'GAP_MM', 'TARGET_VIEWER'];
  const issues = [];
  for (const node of supportNodes) for (const key of required) if (!(key in (node.attributes || {}))) issues.push(`${node.name}: missing ${key}`);
  return issues;
}

function collectCatalogueMetadataIssues(supportNodes) {
  const issues = [];
  for (const node of supportNodes) {
    const attrs = node.attributes || {};
    for (const key of requiredSupportCatalogueAttributes) if (!(key in attrs)) issues.push(`${node.name}: missing ${key}`);
    if (attrs.SUPPORT_CATALOGUE_VISUAL !== 'TRUE') issues.push(`${node.name}: SUPPORT_CATALOGUE_VISUAL must be TRUE`);
    if (attrs.SUPPORT_CATALOGUE_PROPORTIONAL_FALLBACK !== 'TRUE') issues.push(`${node.name}: SUPPORT_CATALOGUE_PROPORTIONAL_FALLBACK must be TRUE`);
    if (attrs.SUPPORT_CATALOGUE_VENDOR_DIMENSIONAL_DB_BACKED !== 'FALSE') issues.push(`${node.name}: SUPPORT_CATALOGUE_VENDOR_DIMENSIONAL_DB_BACKED must be FALSE`);
    if (attrs.SUPPORT_CATALOGUE_EXPORT_PRODUCTION_WIRING !== 'TRUE') issues.push(`${node.name}: SUPPORT_CATALOGUE_EXPORT_PRODUCTION_WIRING must be TRUE`);
  }
  return issues;
}

function collectPrimitiveIssues(supportNodes) {
  const issues = [];
  for (const node of supportNodes) {
    for (const primitive of node.primitives || []) {
      if (!isFiniteVector(primitive.center)) issues.push(`${node.name}/${primitive.name}: invalid center`);
      if (primitive.kind === 'cylinder' && (!isFiniteVector(primitive.direction) || !isPositive(primitive.radius) || !isPositive(primitive.length))) issues.push(`${node.name}/${primitive.name}: invalid cylinder dimensions`);
      if (primitive.kind === 'pyramid' && (!isFiniteVector(primitive.direction) || !isPositive(primitive.height))) issues.push(`${node.name}/${primitive.name}: invalid pyramid dimensions`);
      if (primitive.kind === 'box' && (!Array.isArray(primitive.lengths) || primitive.lengths.some((value) => !isPositive(value)))) issues.push(`${node.name}/${primitive.name}: invalid box dimensions`);
      if (primitive.kind === 'sphere' && !isPositive(primitive.diameter)) issues.push(`${node.name}/${primitive.name}: invalid sphere diameter`);
    }
  }
  return issues;
}

function renderMarkdownSummary(audit) {
  const s = audit.summary;
  const c = audit.contract;
  return `# BM_CII Support / Restraint Parity Audit\n\n` +
    `Schema: \`${audit.schema}\`\n\n` +
    `Sample: \`${audit.sample}\`\n\n` +
    `## Scope\n\n` +
    `This is a support/restraint **production catalogue wiring audit**. Current symbols are proportional fallback visual/export records, not vendor support catalogue geometry.\n\n` +
    `| Contract item | Value |\n|---|---:|\n` +
    `| Support catalogue parity | ${c.supportCatalogueParity} |\n` +
    `| Production catalogue wiring | ${c.productionCatalogueWiring ? 'TRUE' : 'FALSE'} |\n` +
    `| Proportional fallback | ${c.proportionalFallback ? 'TRUE' : 'FALSE'} |\n` +
    `| Vendor dimensional DB backed | ${c.vendorDimensionalDbBacked ? 'TRUE' : 'FALSE'} |\n` +
    `| ASME dimensional DB backed | ${c.asmeDimensionalDbBacked ? 'TRUE' : 'FALSE'} |\n` +
    `| Production RVM path | ${c.productionRvmPath ? 'TRUE' : 'FALSE'} |\n` +
    `| Production ATT path | ${c.productionAttPath ? 'TRUE' : 'FALSE'} |\n` +
    `| External viewer executed in CI | ${c.externalViewerExecutedInCi ? 'TRUE' : 'FALSE'} |\n\n` +
    `## Export summary\n\n` +
    `| Metric | Value |\n|---|---:|\n` +
    `| Export audit support count | ${s.exportSupportCount} |\n` +
    `| Support nodes | ${s.supportNodeCount} |\n` +
    `| Support primitives | ${s.supportPrimitiveCount} |\n` +
    `| Support catalogue export parity | ${s.supportCatalogueExportParity ? 'TRUE' : 'FALSE'} |\n` +
    `| Support catalogue production wiring | ${s.supportCatalogueProductionWiring ? 'TRUE' : 'FALSE'} |\n` +
    `| Support catalogue rewritten nodes | ${s.supportCatalogueRewrittenNodeCount} |\n` +
    `| Support catalogue primitives | ${s.supportCataloguePrimitiveCount} |\n` +
    `| Nodes with SUPPORT_CATALOGUE_* metadata | ${s.supportCatalogueMetadataNodeCount} |\n` +
    `| Metadata issues | ${s.metadataIssueCount} |\n` +
    `| Catalogue metadata issues | ${s.catalogueMetadataIssueCount} |\n` +
    `| Primitive dimension issues | ${s.finitePrimitiveIssueCount} |\n` +
    `| Audit OK | ${s.ok ? 'YES' : 'NO'} |\n\n` +
    `## Families\n\n${s.families.map((family) => `- \`${family}\``).join('\n') || '- none'}\n\n` +
    `## Support catalogue families\n\n${s.supportCatalogueFamilies.map((family) => `- \`${family}\``).join('\n') || '- none'}\n\n` +
    `## Support catalogue schemas\n\n${s.supportCatalogueSchemas.map((schema) => `- \`${schema}\``).join('\n') || '- none'}\n\n` +
    `## Support catalogue recipe ids\n\n${s.supportCatalogueRecipeIds.map((recipeId) => `- \`${recipeId}\``).join('\n') || '- none'}\n\n` +
    `## Source classes\n\n${s.sourceClasses.map((sourceClass) => `- \`${sourceClass}\``).join('\n') || '- none'}\n\n` +
    `## Writer primitive kinds\n\n${s.writerKinds.map((kind) => `- \`${kind}\``).join('\n') || '- none'}\n\n` +
    `Unsupported writer kinds: ${s.unsupportedWriterKinds.length ? s.unsupportedWriterKinds.map((kind) => `\`${kind}\``).join(', ') : '**none**'}\n\n` +
    `## Role coverage\n\n| Role | Count |\n|---|---:|\n` +
    `| Arrow stems | ${s.roleCoverage.arrowStems} |\n` +
    `| Arrow heads | ${s.roleCoverage.arrowHeads} |\n` +
    `| Warning / unmapped boxes | ${s.roleCoverage.warningBoxes} |\n` +
    `| Spring markers | ${s.roleCoverage.springMarkers} |\n\n` +
    `## ATT metadata fields\n\n` +
    Object.entries(s.attMetadataPresent).map(([key, ok]) => `- ${ok ? '✅' : '❌'} \`${key}\``).join('\n') +
    `\n\n## Issues\n\n${audit.issues.length ? audit.issues.map((issue) => `- ${issue}`).join('\n') : '- none'}\n`;
}

function hasAllSupportCatalogueAttributes(attrs) {
  return requiredSupportCatalogueAttributes.every((key) => key in attrs);
}

function resolveOutDir(args) {
  const outArg = args.find((arg) => arg.startsWith('--outdir='));
  if (outArg) {
    const requested = outArg.slice('--outdir='.length);
    return isAbsolute(requested) ? requested : join(repoRoot, requested);
  }
  return join(repoRoot, 'artifacts', 'support-restraint-parity');
}

function readOptional(path, fallback) {
  try { return readFileSync(path, 'utf8'); } catch { return fallback; }
}

function collectNodes(node) { return [node].concat((node.children || []).flatMap((child) => collectNodes(child))); }
function unique(values) { return Array.from(new Set(values.filter((value) => value !== undefined && value !== null && value !== ''))); }
function isPositive(value) { return Number.isFinite(Number(value)) && Number(value) > 0; }
function isFiniteVector(value) { return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry))); }

function installMinimalDomParser() {
  if (globalThis.DOMParser) return;
  class MinimalXmlNode {
    constructor(tagName = '', attributes = {}) { this.tagName = tagName; this.attributes = attributes; this.children = []; this._text = ''; }
    getAttribute(name) { return this.attributes[name] ?? this.attributes[String(name).toLowerCase()] ?? null; }
    get textContent() { return decodeXmlEntities(this._text + this.children.map((child) => child.textContent).join('')); }
    getElementsByTagName(name) {
      const wanted = String(name).toUpperCase();
      const hits = [];
      const visit = (node) => { if (String(node.tagName || '').toUpperCase() === wanted) hits.push(node); for (const child of node.children) visit(child); };
      for (const child of this.children) visit(child);
      return hits;
    }
  }
  class MinimalXmlDocument extends MinimalXmlNode { querySelector(selector) { return selector === 'parsererror' ? null : null; } }
  globalThis.DOMParser = class MinimalDomParser {
    parseFromString(text) {
      const document = new MinimalXmlDocument('#document', {});
      const stack = [document];
      const tokens = String(text || '').match(/<!--[^]*?-->|<\?[^]*?\?>|<!\[CDATA\[[^]*?\]\]>|<[^>]+>|[^<]+/g) || [];
      for (const token of tokens) {
        if (!token || token.startsWith('<!--') || token.startsWith('<?')) continue;
        if (token.startsWith('<![CDATA[')) { stack[stack.length - 1]._text += token.slice(9, -3); continue; }
        if (token.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
        if (token.startsWith('<')) {
          const selfClosing = /\/\s*>$/.test(token);
          const inner = token.slice(1, selfClosing ? token.lastIndexOf('/') : -1).trim();
          if (!inner || inner.startsWith('!')) continue;
          const spaceIndex = inner.search(/\s/);
          const tagName = spaceIndex === -1 ? inner : inner.slice(0, spaceIndex);
          const attrText = spaceIndex === -1 ? '' : inner.slice(spaceIndex + 1);
          const node = new MinimalXmlNode(tagName, parseAttributes(attrText));
          stack[stack.length - 1].children.push(node);
          if (!selfClosing) stack.push(node);
          continue;
        }
        stack[stack.length - 1]._text += token;
      }
      return document;
    }
  };
}

function parseAttributes(text) {
  const attrs = {};
  const pattern = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = pattern.exec(text || ''))) attrs[match[1]] = decodeXmlEntities(match[3] ?? match[4] ?? '');
  return attrs;
}

function decodeXmlEntities(value) {
  return String(value || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
