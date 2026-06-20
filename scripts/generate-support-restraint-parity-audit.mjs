import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

installMinimalDomParserForSupportAudit();

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = resolveOutDir(process.argv);
const baseName = 'BM_CII_support_restraint_parity';

const { convertInputXmlToRvmAtt } = await import('../src/rvm-converter.js');

const sampleXml = readFileSync(join(repoRoot, 'samples', 'BM_CII_Enriched_v8_lite.XML'), 'utf8');
const sampleIsonote = readOptional(join(repoRoot, 'samples', 'BM_CII_ISONOTE_sideload.csv'), '');
const sampleLineNo = readOptional(join(repoRoot, 'samples', 'BM_CII_LINE_NO_sideload.csv'), 'NODE,LINE_NO\n10,BM_CII_SAMPLE');

const result = convertInputXmlToRvmAtt(sampleXml, {
  filename: 'BM_CII_Enriched_v8_lite.XML',
  supportMode: 'compare',
  nodeLabels: false,
  isonoteBoards: false,
  isonoteText: sampleIsonote,
  lineNoText: sampleLineNo
});

mkdirSync(outDir, { recursive: true });

const auditPath = join(outDir, `${baseName}.audit.json`);
const summaryPath = join(outDir, `${baseName}.summary.md`);

const audit = buildAudit(result);
writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
writeFileSync(summaryPath, renderMarkdownSummary(audit));

console.log(`Generated support/restraint parity audit in ${outDir}`);
console.log(`Support nodes: ${audit.summary.supportNodeCount}`);
console.log(`Support primitives: ${audit.summary.supportPrimitiveCount}`);
console.log(`Families: ${audit.summary.families.join(', ')}`);
console.log(`Writer kinds: ${audit.summary.writerKinds.join(', ')}`);

function buildAudit(result) {
  const allNodes = collectNodes(result.exportModel.root);
  const supportGroup = allNodes.find((node) => node.attributes?.ROLE === 'SUPPORTS_RESTRAINTS');
  const supportNodes = (supportGroup?.children || []).filter((node) => node.attributes?.TYPE === 'SUPPORT_RESTRAINT');
  const supportPrimitives = supportNodes.flatMap((node) => node.primitives || []);
  const writerKinds = unique(supportPrimitives.map((primitive) => primitive.kind));
  const unsupportedWriterKinds = writerKinds.filter((kind) => !['cylinder', 'box', 'pyramid', 'sphere'].includes(kind));
  const families = unique(supportNodes.map((node) => node.attributes?.FAMILY));
  const sourceClasses = unique(supportNodes.map((node) => node.attributes?.SOURCE_CLASS));
  const primitiveNames = supportPrimitives.map((primitive) => primitive.name || '');
  const roleCoverage = {
    arrowStems: primitiveNames.filter((name) => name.endsWith('_STEM')).length,
    arrowHeads: primitiveNames.filter((name) => name.endsWith('_HEAD')).length,
    warningBoxes: primitiveNames.filter((name) => name.includes('WARNING_BOX') || name.includes('UNMAPPED_BOX')).length,
    springMarkers: primitiveNames.filter((name) => name.includes('_SPRING_')).length
  };
  const requiredAttributes = [
    'TYPE',
    'ID',
    'NODE',
    'FAMILY',
    'AXIS',
    'SIGN',
    'SOURCE_CLASS',
    'SOURCE',
    'SOURCE_MODE',
    'GAP_MM',
    'TARGET_VIEWER'
  ];
  const metadataIssues = [];
  for (const node of supportNodes) {
    for (const key of requiredAttributes) {
      if (!(key in (node.attributes || {}))) metadataIssues.push(`${node.name}: missing ${key}`);
    }
  }
  const finitePrimitiveIssues = [];
  for (const node of supportNodes) {
    for (const primitive of node.primitives || []) {
      if (!isFiniteVector(primitive.center)) finitePrimitiveIssues.push(`${node.name}/${primitive.name}: invalid center`);
      if (primitive.kind === 'cylinder' && (!isFiniteVector(primitive.direction) || !isPositive(primitive.radius) || !isPositive(primitive.length))) {
        finitePrimitiveIssues.push(`${node.name}/${primitive.name}: invalid cylinder dimensions`);
      }
      if (primitive.kind === 'pyramid' && (!isFiniteVector(primitive.direction) || !isPositive(primitive.height))) {
        finitePrimitiveIssues.push(`${node.name}/${primitive.name}: invalid pyramid dimensions`);
      }
      if (primitive.kind === 'box' && (!Array.isArray(primitive.lengths) || primitive.lengths.some((value) => !isPositive(value)))) {
        finitePrimitiveIssues.push(`${node.name}/${primitive.name}: invalid box dimensions`);
      }
      if (primitive.kind === 'sphere' && !isPositive(primitive.diameter)) {
        finitePrimitiveIssues.push(`${node.name}/${primitive.name}: invalid sphere diameter`);
      }
    }
  }
  const attMetadataPresent = {
    TYPE_SUPPORT_RESTRAINT: /TYPE := 'SUPPORT_RESTRAINT'/.test(result.att),
    FAMILY: /FAMILY := '[^']+'/.test(result.att),
    SOURCE_CLASS: /SOURCE_CLASS := '(ACTUAL|EXPECTED)'/.test(result.att),
    SOURCE_MODE: /SOURCE_MODE := '[^']+'/.test(result.att),
    GAP_MM: /GAP_MM := '[^']+'/.test(result.att),
    TARGET_VIEWER: /TARGET_VIEWER := 'Navisworks'/.test(result.att)
  };
  const issues = [];
  if (!supportGroup) issues.push('missing SUPPORTS_RESTRAINTS group');
  if (!supportNodes.length) issues.push('no support/restraint nodes exported from BM_CII sample');
  if (unsupportedWriterKinds.length) issues.push(`unsupported writer kinds: ${unsupportedWriterKinds.join(', ')}`);
  for (const [key, ok] of Object.entries(attMetadataPresent)) {
    if (!ok) issues.push(`ATT support metadata missing ${key}`);
  }
  issues.push(...metadataIssues, ...finitePrimitiveIssues);

  return {
    schema: 'SupportRestraintParityAudit.v1',
    generatedAt: new Date().toISOString(),
    sample: 'samples/BM_CII_Enriched_v8_lite.XML',
    outputs: {
      audit: `${baseName}.audit.json`,
      summary: `${baseName}.summary.md`
    },
    contract: {
      scope: 'support/restraint proportional fallback audit',
      supportCatalogueParity: 'FOUNDATION_ONLY',
      proportionalFallback: true,
      vendorDimensionalDbBacked: false,
      asmeDimensionalDbBacked: false,
      writerSafePrimitiveKinds: ['cylinder', 'box', 'pyramid', 'sphere'],
      productionRvmPath: true,
      productionAttPath: true,
      externalViewerExecutedInCi: false
    },
    summary: {
      exportSupportCount: result.exportModel.audit.supportCount,
      supportNodeCount: supportNodes.length,
      supportPrimitiveCount: supportPrimitives.length,
      families,
      sourceClasses,
      writerKinds,
      unsupportedWriterKinds,
      roleCoverage,
      attMetadataPresent,
      metadataIssueCount: metadataIssues.length,
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
      primitiveCount: (node.primitives || []).length,
      primitiveKinds: unique((node.primitives || []).map((primitive) => primitive.kind)),
      primitiveNames: (node.primitives || []).map((primitive) => primitive.name)
    })),
    issues,
    ok: issues.length === 0
  };
}

function renderMarkdownSummary(audit) {
  const s = audit.summary;
  const c = audit.contract;
  return `# BM_CII Support / Restraint Parity Audit\n\n` +
    `Schema: \`${audit.schema}\`\n\n` +
    `Sample: \`${audit.sample}\`\n\n` +
    `## Scope\n\n` +
    `This is a support/restraint **foundation audit**. Current symbols are proportional fallback visual/export records, not vendor support catalogue geometry.\n\n` +
    `| Contract item | Value |\n|---|---:|\n` +
    `| Support catalogue parity | ${c.supportCatalogueParity} |\n` +
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
    `| Metadata issues | ${s.metadataIssueCount} |\n` +
    `| Primitive dimension issues | ${s.finitePrimitiveIssueCount} |\n` +
    `| Audit OK | ${s.ok ? 'YES' : 'NO'} |\n\n` +
    `## Families\n\n` +
    `${s.families.map((family) => `- \`${family}\``).join('\n') || '- none'}\n\n` +
    `## Source classes\n\n` +
    `${s.sourceClasses.map((sourceClass) => `- \`${sourceClass}\``).join('\n') || '- none'}\n\n` +
    `## Writer primitive kinds\n\n` +
    `${s.writerKinds.map((kind) => `- \`${kind}\``).join('\n') || '- none'}\n\n` +
    `Unsupported writer kinds: ${s.unsupportedWriterKinds.length ? s.unsupportedWriterKinds.map((kind) => `\`${kind}\``).join(', ') : '**none**'}\n\n` +
    `## Role coverage\n\n` +
    `| Role | Count |\n|---|---:|\n` +
    `| Arrow stems | ${s.roleCoverage.arrowStems} |\n` +
    `| Arrow heads | ${s.roleCoverage.arrowHeads} |\n` +
    `| Warning / unmapped boxes | ${s.roleCoverage.warningBoxes} |\n` +
    `| Spring markers | ${s.roleCoverage.springMarkers} |\n\n` +
    `## ATT metadata fields\n\n` +
    Object.entries(s.attMetadataPresent).map(([key, ok]) => `- ${ok ? '✅' : '❌'} \`${key}\``).join('\n') +
    `\n\n## Issues\n\n` +
    `${audit.issues.length ? audit.issues.map((issue) => `- ${issue}`).join('\n') : '- none'}\n`;
}

function resolveOutDir(args) {
  const outArg = args.find((arg) => arg.startsWith('--outdir='));
  if (outArg) return join(repoRoot, outArg.slice('--outdir='.length));
  return join(repoRoot, 'artifacts', 'support-restraint-parity');
}

function readOptional(path, fallback) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return fallback;
  }
}

function collectNodes(node) {
  return [node].concat((node.children || []).flatMap((child) => collectNodes(child)));
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value !== undefined && value !== null && value !== '')));
}

function isPositive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function isFiniteVector(value) {
  return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry)));
}

function installMinimalDomParserForSupportAudit() {
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
      const tokens = String(text || '').match(/<!--[^]*?-->|<\?[^]*?\?>|<!\[CDATA\[[^]*?\]\]>|<[^>]+>|[^<]+/g) || [];
      for (const token of tokens) {
        if (!token) continue;
        if (token.startsWith('<!--') || token.startsWith('<?')) continue;
        if (token.startsWith('<![CDATA[')) {
          stack[stack.length - 1]._text += token.slice(9, -3);
          continue;
        }
        if (token.startsWith('</')) {
          if (stack.length > 1) stack.pop();
          continue;
        }
        if (token.startsWith('<')) {
          const selfClosing = /\/\s*>$/.test(token);
          const inner = token.slice(1, selfClosing ? token.lastIndexOf('/') : -1).trim();
          if (!inner || inner.startsWith('!')) continue;
          const spaceIndex = inner.search(/\s/);
          const tagName = spaceIndex === -1 ? inner : inner.slice(0, spaceIndex);
          const attrText = spaceIndex === -1 ? '' : inner.slice(spaceIndex + 1);
          const node = new MinimalXmlNode(tagName, parseAttributes(attrText));
          node.parentNode = stack[stack.length - 1];
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
  while ((match = pattern.exec(text || ''))) {
    attrs[match[1]] = decodeXmlEntities(match[3] ?? match[4] ?? '');
  }
  return attrs;
}

function decodeXmlEntities(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
