import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

installMinimalDomParserForInputXmlArtifact();

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = resolveOutDir(process.argv);
const baseName = 'BM_CII_catalogue_sample';

const { convertInputXmlToRvmAtt } = await import('../src/rvm-converter.js');

const sampleXml = readFileSync(join(repoRoot, 'samples', 'BM_CII_Enriched_v8_lite.XML'), 'utf8');
const sampleIsonote = readOptional(join(repoRoot, 'samples', 'BM_CII_ISONOTE_sideload.csv'), '');
const sampleLineNo = readOptional(join(repoRoot, 'samples', 'BM_CII_LINE_NO_sideload.csv'), 'NODE,LINE_NO\n10,BM_CII_SAMPLE');

const result = convertInputXmlToRvmAtt(sampleXml, {
  filename: 'BM_CII_Enriched_v8_lite.XML',
  supportMode: 'inputxml-actual',
  nodeLabels: false,
  isonoteBoards: false,
  isonoteText: sampleIsonote,
  lineNoText: sampleLineNo
});

mkdirSync(outDir, { recursive: true });

const rvmPath = join(outDir, `${baseName}.rvm`);
const attPath = join(outDir, `${baseName}.att`);
const auditPath = join(outDir, `${baseName}.audit.json`);
const summaryPath = join(outDir, `${baseName}.summary.md`);

const summary = buildSummary(result);
const audit = {
  schema: 'RvmCatalogueSampleArtifact.v1',
  generatedAt: new Date().toISOString(),
  sample: 'samples/BM_CII_Enriched_v8_lite.XML',
  outputs: {
    rvm: `${baseName}.rvm`,
    att: `${baseName}.att`,
    audit: `${baseName}.audit.json`,
    summary: `${baseName}.summary.md`
  },
  summary,
  audit: result.audit,
  catalogueNodes: collectNodes(result.exportModel.root)
    .filter((node) => node.attributes?.CATALOGUE_VISUAL === 'TRUE')
    .map((node) => ({
      name: node.name,
      catalogueClass: node.attributes.CATALOGUE_CLASS,
      catalogueType: node.attributes.CATALOGUE_TYPE,
      recipeId: node.attributes.CATALOGUE_RECIPE_ID,
      primitiveCount: (node.primitives || []).length,
      primitiveKinds: unique((node.primitives || []).map((primitive) => primitive.kind)),
      primitiveNames: (node.primitives || []).map((primitive) => primitive.name)
    }))
};

writeFileSync(rvmPath, Buffer.from(result.rvm));
writeFileSync(attPath, result.att);
writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
writeFileSync(summaryPath, renderMarkdownSummary(audit));

console.log(`Generated RVM catalogue sample artifact in ${outDir}`);
console.log(`RVM bytes: ${result.audit.rvmBytes}`);
console.log(`ATT bytes: ${result.audit.attBytes}`);
console.log(`Catalogue components: ${result.audit.rvmCatalogueComponentCount}`);
console.log(`Catalogue primitives: ${result.audit.rvmCataloguePrimitiveCount}`);

function resolveOutDir(args) {
  const outArg = args.find((arg) => arg.startsWith('--outdir='));
  if (outArg) return join(repoRoot, outArg.slice('--outdir='.length));
  return join(repoRoot, 'artifacts', 'rvm-catalogue-sample');
}

function readOptional(path, fallback) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return fallback;
  }
}

function buildSummary(result) {
  const allNodes = collectNodes(result.exportModel.root);
  const allPrimitives = allNodes.flatMap((node) => node.primitives || []);
  const catalogueNodes = allNodes.filter((node) => node.attributes?.CATALOGUE_VISUAL === 'TRUE');
  const valveNodes = catalogueNodes.filter((node) => node.attributes?.CATALOGUE_CLASS === 'VALVE');
  const flangeNodes = catalogueNodes.filter((node) => node.attributes?.CATALOGUE_CLASS === 'FLANGE');
  const writerKinds = unique(allPrimitives.map((primitive) => primitive.kind));
  const unsupportedKinds = writerKinds.filter((kind) => !['cylinder', 'box', 'pyramid', 'sphere'].includes(kind));

  return {
    rvmBytes: result.audit.rvmBytes,
    attBytes: result.audit.attBytes,
    sourceKind: result.audit.sourceKind,
    rvmCatalogueParity: result.audit.rvmCatalogueParity,
    rvmCatalogueExportWiringSchema: result.audit.rvmCatalogueExportWiringSchema,
    catalogueComponentCount: result.audit.rvmCatalogueComponentCount,
    cataloguePrimitiveCount: result.audit.rvmCataloguePrimitiveCount,
    valveCatalogueNodeCount: valveNodes.length,
    flangeCatalogueNodeCount: flangeNodes.length,
    totalNodeCount: allNodes.length,
    totalPrimitiveCount: allPrimitives.length,
    writerKinds,
    unsupportedKinds,
    attMetadataPresent: {
      CATALOGUE_VISUAL: /CATALOGUE_VISUAL := 'TRUE'/.test(result.att),
      CATALOGUE_CLASS: /CATALOGUE_CLASS := '(VALVE|FLANGE)'/.test(result.att),
      CATALOGUE_TYPE: /CATALOGUE_TYPE := '[^']+'/.test(result.att),
      CATALOGUE_RECIPE_ID: /CATALOGUE_RECIPE_ID := '[^']+'/.test(result.att),
      CATALOGUE_SCHEMA: /CATALOGUE_SCHEMA := '[^']+'/.test(result.att),
      PROPORTIONAL_FALLBACK: /PROPORTIONAL_FALLBACK := 'TRUE'/.test(result.att),
      ASME_DIMENSIONAL_DB_BACKED: /ASME_DIMENSIONAL_DB_BACKED := 'FALSE'/.test(result.att),
      RVM_CATALOGUE_PARITY: /RVM_CATALOGUE_PARITY := 'TRUE'/.test(result.att),
      CATALOGUE_EXPORT_PRODUCTION_WIRING: /CATALOGUE_EXPORT_PRODUCTION_WIRING := 'TRUE'/.test(result.att)
    }
  };
}

function renderMarkdownSummary(audit) {
  const s = audit.summary;
  return `# BM_CII RVM Catalogue Sample Artifact\n\n` +
    `Schema: \`${audit.schema}\`\n\n` +
    `Sample: \`${audit.sample}\`\n\n` +
    `## Outputs\n\n` +
    `| File | Purpose |\n|---|---|\n` +
    `| \`${audit.outputs.rvm}\` | Binary RVM generated through production export path |\n` +
    `| \`${audit.outputs.att}\` | ATT metadata generated from the same export model |\n` +
    `| \`${audit.outputs.audit}\` | Machine-readable catalogue audit |\n` +
    `| \`${audit.outputs.summary}\` | Human-readable summary |\n\n` +
    `## Catalogue parity summary\n\n` +
    `| Metric | Value |\n|---|---:|\n` +
    `| RVM bytes | ${s.rvmBytes} |\n` +
    `| ATT bytes | ${s.attBytes} |\n` +
    `| Catalogue components | ${s.catalogueComponentCount} |\n` +
    `| Catalogue primitives | ${s.cataloguePrimitiveCount} |\n` +
    `| Valve catalogue nodes | ${s.valveCatalogueNodeCount} |\n` +
    `| Flange catalogue nodes | ${s.flangeCatalogueNodeCount} |\n` +
    `| Total nodes | ${s.totalNodeCount} |\n` +
    `| Total primitives | ${s.totalPrimitiveCount} |\n\n` +
    `## Writer primitive kinds\n\n` +
    `${s.writerKinds.map((kind) => `- \`${kind}\``).join('\n')}\n\n` +
    `Unsupported writer kinds: ${s.unsupportedKinds.length ? s.unsupportedKinds.map((kind) => `\`${kind}\``).join(', ') : '**none**'}\n\n` +
    `## Metadata flags\n\n` +
    Object.entries(s.attMetadataPresent).map(([key, ok]) => `- ${ok ? '✅' : '❌'} \`${key}\``).join('\n') +
    `\n\n## Scope note\n\n` +
    `This artifact demonstrates proportional catalogue parity in the RVM/ATT export path. It does not claim ASME/rating-size dimensional database backing.\n`;
}

function collectNodes(node) {
  return [node].concat((node.children || []).flatMap((child) => collectNodes(child)));
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function installMinimalDomParserForInputXmlArtifact() {
  if (globalThis.DOMParser) return;

  class MinimalXmlNode {
    constructor(tagName = '', attributes = {}) {
      this.tagName = tagName;
      this.attributes = attributes;
      this.children = [];
      this.parentNode = null;
      this._text = '';
    }

    getAttribute(name) {
      return this.attributes[name] ?? this.attributes[String(name).toLowerCase()] ?? null;
    }

    get textContent() {
      const body = this._text + this.children.map((child) => child.textContent).join('');
      return decodeXmlEntities(body);
    }

    getElementsByTagName(name) {
      const wanted = String(name).toUpperCase();
      const hits = [];
      const visit = (node) => {
        if (String(node.tagName || '').toUpperCase() === wanted) hits.push(node);
        for (const child of node.children) visit(child);
      };
      for (const child of this.children) visit(child);
      return hits;
    }
  }

  class MinimalXmlDocument extends MinimalXmlNode {
    constructor() {
      super('#document', {});
    }

    querySelector(selector) {
      if (selector === 'parsererror') return null;
      return null;
    }
  }

  globalThis.DOMParser = class MinimalDomParser {
    parseFromString(text) {
      const document = new MinimalXmlDocument();
      const stack = [document];
      const pattern = /<([^>]+)>|([^<]+)/g;
      let match;
      while ((match = pattern.exec(String(text || '')))) {
        const tag = match[1];
        const rawText = match[2];
        if (rawText) {
          stack[stack.length - 1]._text += rawText;
          continue;
        }
        const trimmed = String(tag || '').trim();
        if (!trimmed || trimmed.startsWith('?') || trimmed.startsWith('!')) continue;
        if (trimmed.startsWith('/')) {
          const closingName = normalizeTagName(trimmed.slice(1).trim().split(/\s+/)[0]);
          while (stack.length > 1 && stack[stack.length - 1].tagName !== closingName) stack.pop();
          if (stack.length > 1) stack.pop();
          continue;
        }

        const selfClosing = /\/\s*$/.test(trimmed);
        const cleaned = trimmed.replace(/\/\s*$/, '').trim();
        const spaceIndex = cleaned.search(/\s/);
        const rawName = spaceIndex === -1 ? cleaned : cleaned.slice(0, spaceIndex);
        const attrText = spaceIndex === -1 ? '' : cleaned.slice(spaceIndex + 1);
        const node = new MinimalXmlNode(normalizeTagName(rawName), parseAttributes(attrText));
        node.parentNode = stack[stack.length - 1];
        stack[stack.length - 1].children.push(node);
        if (!selfClosing) stack.push(node);
      }
      return document;
    }
  };
}

function normalizeTagName(name) {
  return String(name || '').split(':').pop().toUpperCase();
}

function parseAttributes(text) {
  const attributes = {};
  const pattern = /([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = pattern.exec(String(text || '')))) {
    const key = String(match[1]);
    const value = match[3] ?? match[4] ?? '';
    attributes[key] = decodeXmlEntities(value);
    attributes[key.toLowerCase()] = decodeXmlEntities(value);
  }
  return attributes;
}

function decodeXmlEntities(text) {
  return String(text || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
