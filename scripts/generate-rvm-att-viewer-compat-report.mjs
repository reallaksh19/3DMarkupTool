import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outDirRelative = resolveOutDirRelative(process.argv);
const outDir = join(repoRoot, outDirRelative);
const sampleBaseName = 'BM_CII_catalogue_sample';
const reportBaseName = 'BM_CII_rvm_att_viewer_compat';

const { auditRvmBinary } = await import('../src/rvm-binary-audit.js');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

execFileSync(process.execPath, [
  join(repoRoot, 'scripts', 'generate-rvm-catalogue-sample-artifact.mjs'),
  `--outdir=${outDirRelative}`
], {
  cwd: repoRoot,
  stdio: 'pipe'
});

const rvmPath = join(outDir, `${sampleBaseName}.rvm`);
const attPath = join(outDir, `${sampleBaseName}.att`);
const sourceAuditPath = join(outDir, `${sampleBaseName}.audit.json`);
const compatAuditPath = join(outDir, `${reportBaseName}.audit.json`);
const compatSummaryPath = join(outDir, `${reportBaseName}.summary.md`);

for (const path of [rvmPath, attPath, sourceAuditPath]) {
  if (!existsSync(path)) throw new Error(`Missing generated compatibility input: ${path}`);
}

const rvm = readFileSync(rvmPath);
const att = readFileSync(attPath, 'utf8');
const sourceAudit = JSON.parse(readFileSync(sourceAuditPath, 'utf8'));
const rvmBinaryAudit = auditRvmBinary(rvm);
const attAudit = auditAttBlocks(att);
const compatibility = buildViewerCompatibilityAudit(sourceAudit, rvmBinaryAudit, attAudit);

writeFileSync(compatAuditPath, `${JSON.stringify(compatibility, null, 2)}\n`);
writeFileSync(compatSummaryPath, renderCompatibilityMarkdown(compatibility));

console.log(`Generated RVM/ATT viewer compatibility report in ${outDir}`);
console.log(`Compatibility OK: ${compatibility.ok ? 'YES' : 'NO'}`);
console.log(`ATT blocks: ${compatibility.att.blockCount}`);
console.log(`RVM PRIM chunks: ${compatibility.rvm.primitiveChunkCount}`);

if (!compatibility.ok) {
  throw new Error(`RVM/ATT viewer compatibility audit failed: ${compatibility.issues.join('; ')}`);
}

function resolveOutDirRelative(args) {
  const outArg = args.find((arg) => arg.startsWith('--outdir='));
  if (outArg) return outArg.slice('--outdir='.length).replace(/^\/+/, '');
  return 'artifacts/rvm-att-viewer-compat';
}

function auditAttBlocks(text) {
  const lines = String(text || '').split(/\r?\n/).filter((line) => line.length > 0);
  const issues = [];
  const blocks = [];
  const stack = [];
  const header = lines[0] || '';
  const expectedHeader = 'CADC_Attributes_File v1.0 , start: NEW , end: END , name_end: := , sep: &end&';

  if (header !== expectedHeader) issues.push('ATT header does not match Review/Navis attribute contract header.');

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('NEW ')) {
      const name = trimmed.slice(4).trim();
      if (!name) issues.push(`ATT NEW block without a name at line ${index + 1}`);
      const block = { name, attributes: {}, line: index + 1 };
      blocks.push(block);
      stack.push(block);
      continue;
    }

    if (trimmed === 'END') {
      if (!stack.length) {
        issues.push(`ATT END without matching NEW at line ${index + 1}`);
      } else {
        stack.pop();
      }
      continue;
    }

    const attr = trimmed.match(/^([A-Z0-9_]+)\s*:=\s*'(.*)'$/);
    if (!attr) {
      issues.push(`Malformed ATT attribute line ${index + 1}: ${trimmed}`);
      continue;
    }
    if (!stack.length) {
      issues.push(`ATT attribute outside a NEW block at line ${index + 1}: ${trimmed}`);
      continue;
    }
    const [, key, value] = attr;
    stack[stack.length - 1].attributes[key] = value;
  }

  if (stack.length) issues.push(`ATT has ${stack.length} unclosed NEW block(s).`);

  const blockNames = blocks.map((block) => block.name);
  const catalogueBlocks = blocks.filter((block) => block.attributes.CATALOGUE_VISUAL === 'TRUE');
  const requiredCatalogueAttributes = [
    'CATALOGUE_VISUAL',
    'CATALOGUE_CLASS',
    'CATALOGUE_TYPE',
    'CATALOGUE_RECIPE_ID',
    'CATALOGUE_SCHEMA',
    'PROPORTIONAL_FALLBACK',
    'ASME_DIMENSIONAL_DB_BACKED',
    'RVM_CATALOGUE_PARITY',
    'CATALOGUE_EXPORT_PRODUCTION_WIRING'
  ];

  const catalogueAttributeCoverage = Object.fromEntries(requiredCatalogueAttributes.map((key) => [key, 0]));
  const catalogueBlockIssues = [];
  for (const block of catalogueBlocks) {
    for (const key of requiredCatalogueAttributes) {
      const value = block.attributes[key];
      if (value != null && value !== '' && value !== 'N/A') catalogueAttributeCoverage[key] += 1;
      else catalogueBlockIssues.push(`${block.name} is missing catalogue ATT attribute ${key}`);
    }
    if (!/^(VALVE|FLANGE)$/.test(block.attributes.CATALOGUE_CLASS || '')) {
      catalogueBlockIssues.push(`${block.name} has unsupported CATALOGUE_CLASS=${block.attributes.CATALOGUE_CLASS || 'N/A'}`);
    }
    if (block.attributes.PROPORTIONAL_FALLBACK !== 'TRUE') {
      catalogueBlockIssues.push(`${block.name} must keep PROPORTIONAL_FALLBACK := 'TRUE'`);
    }
    if (block.attributes.ASME_DIMENSIONAL_DB_BACKED !== 'FALSE') {
      catalogueBlockIssues.push(`${block.name} must keep ASME_DIMENSIONAL_DB_BACKED := 'FALSE'`);
    }
  }

  const duplicateNames = findDuplicates(blockNames);
  if (duplicateNames.length) issues.push(`ATT block names must be unique after Navis-safe normalization: ${duplicateNames.join(', ')}`);
  issues.push(...catalogueBlockIssues);

  return {
    schema: 'AttViewerPropertyAudit.v1',
    header,
    expectedHeader,
    headerOk: header === expectedHeader,
    lineCount: lines.length,
    blockCount: blocks.length,
    blockNames,
    topLevelBlocksPresent: {
      INPUTXML_RVM_ROOT: blockNames.includes('INPUTXML_RVM_ROOT'),
      PLANT_GEOMETRY: blockNames.includes('PLANT_GEOMETRY'),
      SUPPORTS_RESTRAINTS: blockNames.includes('SUPPORTS_RESTRAINTS'),
      ANNOTATIONS: blockNames.includes('ANNOTATIONS')
    },
    catalogueBlockCount: catalogueBlocks.length,
    catalogueBlockNames: catalogueBlocks.map((block) => block.name),
    catalogueAttributeCoverage,
    duplicateNames,
    issues,
    ok: issues.length === 0
  };
}

function buildViewerCompatibilityAudit(sourceAudit, rvmBinaryAudit, attAudit) {
  const issues = [];
  const sourceSummary = sourceAudit.summary || {};
  const exportAudit = sourceAudit.audit || {};
  const expectedNodeCount = Number(sourceSummary.totalNodeCount || 0);
  const expectedPrimitiveCount = Number(sourceSummary.totalPrimitiveCount || 0);
  const expectedCatalogueCount = Number(sourceSummary.catalogueComponentCount || 0);

  if (!rvmBinaryAudit.ok) issues.push(...rvmBinaryAudit.issues.map((issue) => `RVM binary: ${issue}`));
  if (!attAudit.ok) issues.push(...attAudit.issues.map((issue) => `ATT: ${issue}`));
  if (rvmBinaryAudit.containerChunkCount !== expectedNodeCount) {
    issues.push(`RVM CNTB count ${rvmBinaryAudit.containerChunkCount} does not match export node count ${expectedNodeCount}.`);
  }
  if (rvmBinaryAudit.closeContainerChunkCount !== expectedNodeCount) {
    issues.push(`RVM CNTE count ${rvmBinaryAudit.closeContainerChunkCount} does not match export node count ${expectedNodeCount}.`);
  }
  if (rvmBinaryAudit.primitiveChunkCount !== expectedPrimitiveCount) {
    issues.push(`RVM PRIM count ${rvmBinaryAudit.primitiveChunkCount} does not match export primitive count ${expectedPrimitiveCount}.`);
  }
  if (attAudit.blockCount !== expectedNodeCount) {
    issues.push(`ATT NEW block count ${attAudit.blockCount} does not match export node count ${expectedNodeCount}.`);
  }
  if (attAudit.catalogueBlockCount !== expectedCatalogueCount) {
    issues.push(`ATT catalogue block count ${attAudit.catalogueBlockCount} does not match export catalogue component count ${expectedCatalogueCount}.`);
  }
  for (const [name, present] of Object.entries(attAudit.topLevelBlocksPresent)) {
    if (!present) issues.push(`ATT is missing top-level export block ${name}.`);
  }
  for (const [key, count] of Object.entries(attAudit.catalogueAttributeCoverage)) {
    if (count !== expectedCatalogueCount) {
      issues.push(`ATT catalogue attribute ${key} is visible on ${count}/${expectedCatalogueCount} catalogue blocks.`);
    }
  }
  if (sourceSummary.unsupportedKinds?.length) {
    issues.push(`Unsupported RVM writer primitive kinds reached source artifact: ${sourceSummary.unsupportedKinds.join(', ')}`);
  }
  if (exportAudit.rvmCatalogueParity !== true) issues.push('Export audit did not report rvmCatalogueParity=true.');

  return {
    schema: 'RvmAttViewerCompatibility.v1',
    generatedAt: new Date().toISOString(),
    compatibilityLevel: 'STRUCTURAL_AND_PROPERTY_VISIBILITY_AUDIT',
    sample: sourceAudit.sample,
    sourceArtifactSchema: sourceAudit.schema,
    scope: {
      verifiesReviewStyleChunkGrammar: true,
      verifiesAttPropertyBlocks: true,
      verifiesRvmAttNodeCountCorrespondence: true,
      verifiesCataloguePropertyVisibility: true,
      verifiesPrimitiveOwnershipCounts: true,
      byteForByteReferenceEquivalence: false,
      externalViewerImportWasExecuted: false,
      asmeDimensionalDatabaseBacked: false
    },
    expectedCounts: {
      nodeCount: expectedNodeCount,
      primitiveCount: expectedPrimitiveCount,
      catalogueComponentCount: expectedCatalogueCount,
      valveCatalogueNodeCount: sourceSummary.valveCatalogueNodeCount,
      flangeCatalogueNodeCount: sourceSummary.flangeCatalogueNodeCount
    },
    rvm: {
      schema: rvmBinaryAudit.schema,
      byteLength: rvmBinaryAudit.byteLength,
      chunkCount: rvmBinaryAudit.chunkCount,
      firstChunk: rvmBinaryAudit.firstChunk,
      secondChunk: rvmBinaryAudit.secondChunk,
      terminalChunk: rvmBinaryAudit.terminalChunk,
      primitiveChunkCount: rvmBinaryAudit.primitiveChunkCount,
      containerChunkCount: rvmBinaryAudit.containerChunkCount,
      closeContainerChunkCount: rvmBinaryAudit.closeContainerChunkCount,
      allChunkMarkersOne: rvmBinaryAudit.allChunkMarkersOne,
      balancedCntbCnte: rvmBinaryAudit.balancedCntbCnte,
      contiguousUntilEnd: rvmBinaryAudit.contiguousUntilEnd,
      endBodyLength: rvmBinaryAudit.endBodyLength,
      ok: rvmBinaryAudit.ok
    },
    att: {
      schema: attAudit.schema,
      headerOk: attAudit.headerOk,
      lineCount: attAudit.lineCount,
      blockCount: attAudit.blockCount,
      topLevelBlocksPresent: attAudit.topLevelBlocksPresent,
      catalogueBlockCount: attAudit.catalogueBlockCount,
      catalogueAttributeCoverage: attAudit.catalogueAttributeCoverage,
      duplicateNames: attAudit.duplicateNames,
      ok: attAudit.ok
    },
    issues,
    ok: issues.length === 0
  };
}

function renderCompatibilityMarkdown(report) {
  return `# BM_CII RVM/ATT Viewer Compatibility Audit\n\n` +
    `Schema: \`${report.schema}\`\n\n` +
    `Compatibility level: \`${report.compatibilityLevel}\`\n\n` +
    `Sample: \`${report.sample}\`\n\n` +
    `Overall result: **${report.ok ? 'PASS' : 'FAIL'}**\n\n` +
    `## Scope\n\n` +
    `| Verification | Status |\n|---|---:|\n` +
    `| Review-style RVM chunk grammar | ${yes(report.scope.verifiesReviewStyleChunkGrammar)} |\n` +
    `| ATT property blocks | ${yes(report.scope.verifiesAttPropertyBlocks)} |\n` +
    `| RVM/ATT node-count correspondence | ${yes(report.scope.verifiesRvmAttNodeCountCorrespondence)} |\n` +
    `| Catalogue property visibility | ${yes(report.scope.verifiesCataloguePropertyVisibility)} |\n` +
    `| Primitive ownership counts | ${yes(report.scope.verifiesPrimitiveOwnershipCounts)} |\n` +
    `| External viewer import executed | ${yes(report.scope.externalViewerImportWasExecuted)} |\n` +
    `| Byte-for-byte reference equivalence claimed | ${yes(report.scope.byteForByteReferenceEquivalence)} |\n` +
    `| ASME dimensional database backed | ${yes(report.scope.asmeDimensionalDatabaseBacked)} |\n\n` +
    `## Count correspondence\n\n` +
    `| Count | Export model | RVM/ATT |\n|---|---:|---:|\n` +
    `| Nodes | ${report.expectedCounts.nodeCount} | RVM CNTB ${report.rvm.containerChunkCount}; ATT NEW ${report.att.blockCount} |\n` +
    `| Primitives | ${report.expectedCounts.primitiveCount} | RVM PRIM ${report.rvm.primitiveChunkCount} |\n` +
    `| Catalogue components | ${report.expectedCounts.catalogueComponentCount} | ATT catalogue blocks ${report.att.catalogueBlockCount} |\n` +
    `| Valve catalogue nodes | ${report.expectedCounts.valveCatalogueNodeCount} | tracked in source audit |\n` +
    `| Flange catalogue nodes | ${report.expectedCounts.flangeCatalogueNodeCount} | tracked in source audit |\n\n` +
    `## RVM binary checks\n\n` +
    `| Check | Value |\n|---|---:|\n` +
    `| Binary OK | ${yes(report.rvm.ok)} |\n` +
    `| First chunk | ${report.rvm.firstChunk} |\n` +
    `| Second chunk | ${report.rvm.secondChunk} |\n` +
    `| Terminal chunk | ${report.rvm.terminalChunk} |\n` +
    `| Chunk markers = 1 | ${yes(report.rvm.allChunkMarkersOne)} |\n` +
    `| CNTB/CNTE balanced | ${yes(report.rvm.balancedCntbCnte)} |\n` +
    `| Contiguous to END | ${yes(report.rvm.contiguousUntilEnd)} |\n` +
    `| END body length | ${report.rvm.endBodyLength} |\n\n` +
    `## ATT property visibility\n\n` +
    `| Check | Value |\n|---|---:|\n` +
    `| ATT header OK | ${yes(report.att.headerOk)} |\n` +
    `| ATT block count | ${report.att.blockCount} |\n` +
    `| Catalogue property blocks | ${report.att.catalogueBlockCount} |\n` +
    Object.entries(report.att.topLevelBlocksPresent).map(([key, present]) => `| ${key} block present | ${yes(present)} |`).join('\n') +
    `\n\n## Catalogue ATT attribute coverage\n\n` +
    `| Attribute | Blocks visible |\n|---|---:|\n` +
    Object.entries(report.att.catalogueAttributeCoverage).map(([key, count]) => `| \`${key}\` | ${count}/${report.expectedCounts.catalogueComponentCount} |`).join('\n') +
    `\n\n## Issues\n\n` +
    (report.issues.length ? report.issues.map((issue) => `- ${issue}`).join('\n') : '- none') +
    `\n\n## Compatibility note\n\n` +
    `This audit verifies structural RVM chunk grammar and ATT property-block visibility for the generated BM_CII sample. It does not execute an external Navisworks/AVEVA Review import, and it does not claim byte-for-byte equivalence with RHBG.RVM. The catalogue remains a proportional fallback and is not ASME/rating-size database-backed.\n`;
}

function yes(value) {
  return value ? 'YES' : 'NO';
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return Array.from(duplicates);
}
