import assert from 'node:assert/strict';
import { buildElementRvmLedger } from '../../src/element-ledger/element-rvm-ledger-builder.js';
import { buildElementRvmLedgerAudit } from '../../src/audit/element-rvm-ledger-audit.js';
import { buildBmCiiStyleManagedStageFixture } from '../fixtures/bm-cii-managed-stage-fixture.mjs';

const staged = buildBmCiiStyleManagedStageFixture();
const branch = staged.hierarchy.find((entry) => entry.type === 'BRANCH');
const sourceChildren = branch.children;
const ledger = buildElementRvmLedger(staged);
const audit = buildElementRvmLedgerAudit(ledger, { expectedSourceChildCount: sourceChildren.length });

assert.equal(audit.ok, true, audit.errors.join('; '));
assert.equal(sourceChildren.length, 52);
assert.equal(ledger.entries.length, sourceChildren.length);
assert.equal(new Set(ledger.entries.map((entry) => entry.sourceElementId)).size, 52);

for (const [index, child] of sourceChildren.entries()) {
  const expectedId = child.attributes.SOURCE_ELEMENT_ID;
  const matches = ledger.entries.filter((entry) => entry.sourceElementId === expectedId);
  assert.equal(matches.length, 1, `${expectedId} has exactly one ledger entry`);
  assert.equal(matches[0].sequenceIndex, index + 1, `${expectedId} preserves source order`);
  assert.equal(matches[0].sourceTrace.masterSource, 'staged-json-child', `${expectedId} trace source`);
}

assert.equal(ledger.entries.some((entry) => entry.sourceTrace.masterSource !== 'staged-json-child'), false, 'no primitive-only orphan entry');
assert.equal(ledger.entries.every((entry) => entry.rvmByteStatus === 'notStarted'), true, 'byte status not started');
assert.equal(ledger.entries.every((entry) => entry.stitchStatus === 'notStarted'), true, 'stitch status not started');
assert.equal(ledger.generationReadiness.fullRvmReady, false, 'full RVM not ready');

console.log('ElementRvmLedger no source drop test passed');
