import assert from 'node:assert/strict';
import { buildElementRvmLedger } from '../../src/element-ledger/element-rvm-ledger-builder.js';
import { buildElementRvmLedgerAudit, assertElementRvmLedgerAudit } from '../../src/audit/element-rvm-ledger-audit.js';
import { assertElementRvmLedgerContract } from '../../src/contracts/index.js';
import { buildBmCiiPhase11aState } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
const ledger = buildElementRvmLedger(state.sourceText, { graphId: state.graph.id, plantGraph: state.graph, primitiveModel: state.primitiveModel });
assert.equal(assertElementRvmLedgerContract(ledger).ok, true);
const audit = buildElementRvmLedgerAudit(ledger, { expectedSourceChildCount: 52 });
assert.equal(assertElementRvmLedgerAudit(audit, { ok: true, totalElementCount: 52, componentElementCount: 40, supportElementCount: 12, branchCount: 1, 'typeCounts.BRANCH': 1, 'typeCounts.PIPE': 19, 'typeCounts.BEND': 7, 'typeCounts.FLAN': 8, 'typeCounts.VALV': 6, 'typeCounts.ATTA': 12, primitiveResolvedElementCount: 34, writableElementCount: 34, blockedElementCount: 6, deferredElementCount: 12, blockedValveCount: 6, deferredSupportCount: 12, rvmByteNotStartedCount: 52, stitchNotStartedCount: 52, primitiveOnlyOrphanCount: 0, fullRvmReady: false }).ok, true);

assert.equal(ledger.schema, 'ElementRvmLedger.v1');
assert.equal(ledger.totalElementCount, 52);
assert.equal(ledger.entries.filter((entry) => entry.sourceElementType === 'PIPE').length, 19);
assert.equal(ledger.entries.filter((entry) => entry.sourceElementType === 'BEND').length, 7);
assert.equal(ledger.entries.filter((entry) => entry.sourceElementType === 'FLAN').length, 8);
assert.equal(ledger.entries.filter((entry) => entry.sourceElementType === 'VALV').length, 6);
assert.equal(ledger.entries.filter((entry) => entry.sourceElementType === 'ATTA').length, 12);
assert.equal(ledger.entries.filter((entry) => entry.sourceElementType === 'PIPE').every((entry) => entry.primitiveKind === 'CYLINDER' && entry.primitiveCode === 8 && entry.rvmElementUnitStatus === 'candidate'), true);
assert.equal(ledger.entries.filter((entry) => entry.sourceElementType === 'BEND').every((entry) => entry.primitiveKind === 'TORUS' && entry.primitiveCode === 4 && entry.rvmElementUnitStatus === 'candidate'), true);
assert.equal(ledger.entries.filter((entry) => entry.sourceElementType === 'FLAN').every((entry) => entry.primitiveKind === 'FLANGE_CYLINDER' && entry.primitiveCode === 8 && entry.rvmElementUnitStatus === 'candidate'), true);
assert.equal(ledger.entries.filter((entry) => entry.sourceElementType === 'VALV').every((entry) => entry.rvmElementUnitStatus === 'blocked' && entry.blockReason), true);
assert.equal(ledger.entries.filter((entry) => entry.sourceElementType === 'ATTA').every((entry) => entry.rvmElementUnitStatus === 'deferred' && entry.deferReason), true);
assert.deepEqual(ledger.entries.map((entry) => entry.sequenceIndex), Array.from({ length: 52 }, (_, index) => index + 1));

console.log('BM CII ElementRvmLedger inventory test passed');
