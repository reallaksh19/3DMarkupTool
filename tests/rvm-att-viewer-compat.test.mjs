import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outDirRelative = 'artifacts/rvm-att-viewer-compat-test';
const outDir = join(repoRoot, outDirRelative);

rmSync(outDir, { recursive: true, force: true });

execFileSync(process.execPath, [
  join(repoRoot, 'scripts', 'generate-rvm-att-viewer-compat-report.mjs'),
  `--outdir=${outDirRelative}`
], {
  cwd: repoRoot,
  stdio: 'pipe'
});

const sampleBaseName = 'BM_CII_catalogue_sample';
const reportBaseName = 'BM_CII_rvm_att_viewer_compat';
const expectedFiles = [
  `${sampleBaseName}.rvm`,
  `${sampleBaseName}.att`,
  `${sampleBaseName}.audit.json`,
  `${sampleBaseName}.summary.md`,
  `${reportBaseName}.audit.json`,
  `${reportBaseName}.summary.md`
];

for (const file of expectedFiles) {
  assert.ok(existsSync(join(outDir, file)), `expected viewer compatibility artifact file: ${file}`);
}

const report = JSON.parse(readFileSync(join(outDir, `${reportBaseName}.audit.json`), 'utf8'));
const summary = readFileSync(join(outDir, `${reportBaseName}.summary.md`), 'utf8');

assert.equal(report.schema, 'RvmAttViewerCompatibility.v1', 'viewer compatibility report schema must remain explicit.');
assert.equal(report.ok, true, 'viewer compatibility report must pass.');
assert.deepEqual(report.issues, [], 'viewer compatibility report must not carry issues.');
assert.equal(report.compatibilityLevel, 'STRUCTURAL_AND_PROPERTY_VISIBILITY_AUDIT', 'compatibility level must not overclaim external viewer execution.');

assert.equal(report.scope.verifiesReviewStyleChunkGrammar, true, 'C12 must verify Review-style RVM chunk grammar.');
assert.equal(report.scope.verifiesAttPropertyBlocks, true, 'C12 must verify ATT property blocks.');
assert.equal(report.scope.verifiesRvmAttNodeCountCorrespondence, true, 'C12 must verify RVM/ATT node count correspondence.');
assert.equal(report.scope.verifiesCataloguePropertyVisibility, true, 'C12 must verify catalogue property visibility.');
assert.equal(report.scope.verifiesPrimitiveOwnershipCounts, true, 'C12 must verify primitive ownership counts.');
assert.equal(report.scope.externalViewerImportWasExecuted, false, 'C12 must not claim an external viewer import was executed in CI.');
assert.equal(report.scope.byteForByteReferenceEquivalence, false, 'C12 must not claim byte-for-byte RHBG/RVM equivalence.');
assert.equal(report.scope.asmeDimensionalDatabaseBacked, false, 'C12 must keep the non-ASME proportional fallback status explicit.');

assert.ok(report.expectedCounts.nodeCount >= 30, 'BM_CII compatibility artifact must have a non-trivial node tree.');
assert.ok(report.expectedCounts.primitiveCount >= 300, 'BM_CII compatibility artifact must have catalogue-expanded primitives.');
assert.ok(report.expectedCounts.catalogueComponentCount >= 10, 'BM_CII compatibility artifact must include catalogue components.');

assert.equal(report.rvm.ok, true, 'RVM binary audit must pass.');
assert.equal(report.rvm.firstChunk, 'HEAD', 'RVM must start with HEAD.');
assert.equal(report.rvm.secondChunk, 'MODL', 'RVM second chunk must be MODL.');
assert.equal(report.rvm.terminalChunk, 'END:', 'RVM terminal chunk must be END:.');
assert.equal(report.rvm.allChunkMarkersOne, true, 'RVM chunk markers must use Review-style marker 1.');
assert.equal(report.rvm.balancedCntbCnte, true, 'RVM CNTB/CNTE chunks must be balanced.');
assert.equal(report.rvm.contiguousUntilEnd, true, 'RVM chunks must be contiguous through END:.');
assert.equal(report.rvm.endBodyLength, 4, 'END: chunk must retain the RHBG-style 4-byte marker body.');
assert.equal(report.rvm.containerChunkCount, report.expectedCounts.nodeCount, 'RVM CNTB count must match export node count.');
assert.equal(report.rvm.closeContainerChunkCount, report.expectedCounts.nodeCount, 'RVM CNTE count must match export node count.');
assert.equal(report.rvm.primitiveChunkCount, report.expectedCounts.primitiveCount, 'RVM PRIM count must match export primitive count.');

assert.equal(report.att.ok, true, 'ATT property-block audit must pass.');
assert.equal(report.att.headerOk, true, 'ATT header must match Review/Navis attribute-file contract.');
assert.equal(report.att.blockCount, report.expectedCounts.nodeCount, 'ATT NEW block count must match export node count.');
assert.equal(report.att.catalogueBlockCount, report.expectedCounts.catalogueComponentCount, 'ATT catalogue block count must match export catalogue component count.');
assert.deepEqual(report.att.duplicateNames, [], 'ATT block names must be unique after Navis-safe normalization.');

for (const [blockName, present] of Object.entries(report.att.topLevelBlocksPresent)) {
  assert.equal(present, true, `ATT top-level block must be visible: ${blockName}`);
}

for (const [key, visibleCount] of Object.entries(report.att.catalogueAttributeCoverage)) {
  assert.equal(
    visibleCount,
    report.expectedCounts.catalogueComponentCount,
    `ATT catalogue attribute must be visible on every catalogue block: ${key}`
  );
}

for (const requiredText of [
  'Compatibility level: `STRUCTURAL_AND_PROPERTY_VISIBILITY_AUDIT`',
  'Byte-for-byte reference equivalence claimed | NO',
  'External viewer import executed | NO',
  'ASME dimensional database backed | NO',
  '## Count correspondence',
  '## ATT property visibility',
  '## Catalogue ATT attribute coverage',
  'does not execute an external Navisworks/AVEVA Review import',
  'does not claim byte-for-byte equivalence with RHBG.RVM'
]) {
  assert.ok(summary.includes(requiredText), `viewer compatibility summary must include: ${requiredText}`);
}

rmSync(outDir, { recursive: true, force: true });
console.log('RVM/ATT viewer compatibility gate passed');
