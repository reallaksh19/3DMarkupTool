import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outDirRelative = 'artifacts/rvm-catalogue-artifact-inspection-test';
const outDir = join(repoRoot, outDirRelative);

rmSync(outDir, { recursive: true, force: true });

execFileSync(process.execPath, [
  join(repoRoot, 'scripts', 'generate-rvm-catalogue-sample-artifact.mjs'),
  `--outdir=${outDirRelative}`
], {
  cwd: repoRoot,
  stdio: 'pipe'
});

const baseName = 'BM_CII_catalogue_sample';
const rvmPath = join(outDir, `${baseName}.rvm`);
const attPath = join(outDir, `${baseName}.att`);
const auditPath = join(outDir, `${baseName}.audit.json`);
const summaryPath = join(outDir, `${baseName}.summary.md`);

for (const path of [rvmPath, attPath, auditPath, summaryPath]) {
  assert.ok(existsSync(path), `expected generated artifact file: ${path}`);
}

const audit = JSON.parse(readFileSync(auditPath, 'utf8'));
const summary = readFileSync(summaryPath, 'utf8');

assert.equal(audit.schema, 'RvmCatalogueSampleArtifact.v2', 'artifact inspection gate must use the C6/C7 schema with binary audit data.');
assert.equal(audit.sample, 'samples/BM_CII_Enriched_v8_lite.XML', 'artifact inspection gate must stay tied to the BM_CII sample.');

assert.equal(audit.outputs.rvm, `${baseName}.rvm`, 'audit must identify the generated RVM output.');
assert.equal(audit.outputs.att, `${baseName}.att`, 'audit must identify the generated ATT output.');
assert.equal(audit.outputs.audit, `${baseName}.audit.json`, 'audit must identify the generated audit JSON output.');
assert.equal(audit.outputs.summary, `${baseName}.summary.md`, 'audit must identify the generated markdown summary output.');

assert.ok(audit.summary.rvmBytes > 0, 'generated RVM must be non-empty.');
assert.ok(audit.summary.attBytes > 0, 'generated ATT must be non-empty.');
assert.ok(audit.summary.catalogueComponentCount >= 10, 'BM_CII artifact must contain catalogue-rendered valve/flange components.');
assert.ok(audit.summary.cataloguePrimitiveCount >= 100, 'BM_CII artifact must contain segmented catalogue primitives.');
assert.ok(audit.summary.valveCatalogueNodeCount >= 3, 'BM_CII artifact must contain catalogue valve nodes.');
assert.ok(audit.summary.flangeCatalogueNodeCount >= 3, 'BM_CII artifact must contain catalogue flange nodes.');
assert.ok(audit.summary.totalNodeCount >= audit.summary.catalogueComponentCount, 'total node count must include catalogue nodes.');
assert.ok(audit.summary.totalPrimitiveCount >= audit.summary.cataloguePrimitiveCount, 'total primitive count must include catalogue primitives.');

const binary = audit.rvmBinaryAudit;
assert.equal(binary.ok, true, 'binary audit must pass.');
assert.equal(binary.firstChunk, 'HEAD', 'RVM must start with HEAD.');
assert.equal(binary.secondChunk, 'MODL', 'RVM second chunk must be MODL.');
assert.equal(binary.terminalChunk, 'END:', 'RVM must terminate with END:.');
assert.equal(binary.endBodyLength, 4, 'END: chunk must retain the RHBG-style marker body.');
assert.equal(binary.allChunkMarkersOne, true, 'all RVM chunk header markers must be 1.');
assert.equal(binary.balancedCntbCnte, true, 'CNTB/CNTE chunk pairs must be balanced.');
assert.equal(binary.contiguousUntilEnd, true, 'RVM chunks must be contiguous through END:.');
assert.deepEqual(binary.issues, [], 'binary audit must not report issues.');

assert.equal(binary.counts.PRIM, audit.summary.totalPrimitiveCount, 'PRIM chunk count must match generated primitive count.');
assert.equal(binary.primitiveChunkCount, audit.audit.primitiveCount, 'binary primitive count must match export model audit count.');
assert.equal(binary.counts.CNTB, audit.summary.totalNodeCount, 'CNTB count must match generated node count.');
assert.equal(binary.counts.CNTE, audit.summary.totalNodeCount, 'CNTE count must match generated node count.');

const allowedWriterKinds = new Set(['cylinder', 'box', 'pyramid', 'sphere']);
for (const kind of audit.summary.writerKinds) {
  assert.ok(allowedWriterKinds.has(kind), `writer kind must be RVM-writer safe: ${kind}`);
}
assert.deepEqual(audit.summary.unsupportedKinds, [], 'unsupported writer kinds must not reach the RVM artifact.');

for (const [key, present] of Object.entries(audit.summary.attMetadataPresent)) {
  assert.equal(present, true, `ATT metadata flag must be present: ${key}`);
}

assert.ok(Array.isArray(audit.catalogueNodes), 'artifact audit must include catalogue node details.');
assert.equal(audit.catalogueNodes.length, audit.summary.catalogueComponentCount, 'catalogue node detail count must match summary count.');
for (const node of audit.catalogueNodes) {
  assert.ok(node.name, 'catalogue node must include a name.');
  assert.match(node.catalogueClass, /^(VALVE|FLANGE)$/, 'catalogue node class must remain explicit.');
  assert.ok(node.catalogueType, 'catalogue node must include catalogue type.');
  assert.ok(node.recipeId, 'catalogue node must include recipe id.');
  assert.ok(node.primitiveCount > 0, 'catalogue node must include segmented primitives.');
  assert.equal(node.primitiveNames.length, node.primitiveCount, 'catalogue node primitive names must match primitive count.');
  for (const kind of node.primitiveKinds) {
    assert.ok(allowedWriterKinds.has(kind), `catalogue node primitive kind must be writer-safe: ${kind}`);
  }
}

for (const requiredText of [
  '## Catalogue parity summary',
  '## RVM binary compatibility',
  'Unsupported writer kinds: **none**',
  'CATALOGUE_VISUAL',
  'ASME_DIMENSIONAL_DB_BACKED',
  'This artifact demonstrates proportional catalogue parity'
]) {
  assert.ok(summary.includes(requiredText), `artifact summary must include: ${requiredText}`);
}

rmSync(outDir, { recursive: true, force: true });
console.log('RVM catalogue artifact inspection gate passed');
