import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const outDir = mkdtempSync(join(tmpdir(), 'support-restraint-parity-'));

execFileSync('node', [
  'scripts/generate-support-restraint-parity-audit.mjs',
  `--outdir=${outDir}`
], {
  cwd: process.cwd(),
  stdio: 'pipe'
});

const audit = JSON.parse(readFileSync(join(outDir, 'BM_CII_support_restraint_parity.audit.json'), 'utf8'));
const summary = readFileSync(join(outDir, 'BM_CII_support_restraint_parity.summary.md'), 'utf8');

assert.equal(audit.schema, 'SupportRestraintParityAudit.v1');
assert.equal(audit.contract.scope, 'support/restraint proportional fallback audit');
assert.equal(audit.contract.supportCatalogueParity, 'FOUNDATION_ONLY');
assert.equal(audit.contract.proportionalFallback, true);
assert.equal(audit.contract.vendorDimensionalDbBacked, false);
assert.equal(audit.contract.asmeDimensionalDbBacked, false);
assert.equal(audit.contract.productionRvmPath, true);
assert.equal(audit.contract.productionAttPath, true);
assert.equal(audit.contract.externalViewerExecutedInCi, false);

assert.ok(audit.summary.supportNodeCount > 0, 'BM_CII sample must produce support/restraint nodes');
assert.ok(audit.summary.supportPrimitiveCount >= audit.summary.supportNodeCount, 'support primitives must be present');
assert.equal(audit.summary.supportNodeCount, audit.supportNodes.length, 'support node detail count must match summary');
assert.deepEqual(audit.summary.unsupportedWriterKinds, [], 'support/restraint export must use writer-safe RVM primitive kinds only');
assert.equal(audit.summary.metadataIssueCount, 0, 'support/restraint ATT metadata must remain complete');
assert.equal(audit.summary.finitePrimitiveIssueCount, 0, 'support/restraint primitives must have finite dimensions');
assert.equal(audit.ok, true, `support/restraint audit must pass: ${audit.issues.join('; ')}`);

for (const kind of audit.summary.writerKinds) {
  assert.ok(['cylinder', 'box', 'pyramid', 'sphere'].includes(kind), `unsupported writer kind leaked: ${kind}`);
}
assert.ok(audit.summary.writerKinds.includes('cylinder'), 'support arrows/springs should emit cylinder primitives');
assert.ok(audit.summary.writerKinds.includes('pyramid'), 'support arrows should emit pyramid head primitives');
assert.ok(audit.summary.roleCoverage.arrowStems > 0, 'support symbols should expose arrow stems');
assert.ok(audit.summary.roleCoverage.arrowHeads > 0, 'support symbols should expose arrow heads');

for (const [field, present] of Object.entries(audit.summary.attMetadataPresent)) {
  assert.equal(present, true, `ATT support metadata field missing: ${field}`);
}

for (const node of audit.supportNodes) {
  assert.ok(node.name, 'support node needs a stable export name');
  assert.ok(node.family, `${node.name} must expose FAMILY`);
  assert.ok(node.node, `${node.name} must expose NODE`);
  assert.ok(['ACTUAL', 'EXPECTED'].includes(node.sourceClass), `${node.name} must expose source class`);
  assert.equal(node.targetViewer, 'Navisworks', `${node.name} must expose target viewer`);
  assert.ok(node.primitiveCount > 0, `${node.name} must emit primitives`);
  for (const kind of node.primitiveKinds) {
    assert.ok(['cylinder', 'box', 'pyramid', 'sphere'].includes(kind), `${node.name} leaked unsupported kind ${kind}`);
  }
}

assert.match(summary, /Support \/ Restraint Parity Audit/);
assert.match(summary, /FOUNDATION_ONLY/);
assert.match(summary, /Proportional fallback/);
assert.match(summary, /Vendor dimensional DB backed/);
assert.match(summary, /ASME dimensional DB backed/);
assert.match(summary, /Writer primitive kinds/);
assert.match(summary, /ATT metadata fields/);
assert.match(summary, /External viewer executed in CI/);
