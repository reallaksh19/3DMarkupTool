import assert from 'node:assert/strict';
import { assertElementRvmLedgerContract, validateElementRvmLedgerContract } from '../../src/contracts/index.js';

const valid = ledger();
assert.equal(validateElementRvmLedgerContract(valid).ok, true);
assert.equal(assertElementRvmLedgerContract(valid).ok, true);

for (const [label, mutate] of [
  ['missing sourceElementId', (m) => { delete m.entries[0].sourceElementId; }],
  ['missing sourceElementType', (m) => { delete m.entries[0].sourceElementType; }],
  ['bad counts', (m) => { m.totalElementCount = 99; }],
  ['non deterministic sequence', (m) => { m.entries[1].sequenceIndex = 1; }],
  ['full ready true', (m) => { m.generationReadiness.fullRvmReady = true; }],
  ['rvm bytes started', (m) => { m.entries[0].rvmByteStatus = 'ready'; }],
  ['stitch started', (m) => { m.entries[0].stitchStatus = 'planned'; }]
]) {
  const copy = structuredClone(valid);
  mutate(copy);
  assert.equal(validateElementRvmLedgerContract(copy).ok, false, label);
}

console.log('ElementRvmLedger contract tests passed');

function ledger() {
  const entries = [entry(1, 'PIPE-1', 'PIPE', 'pipe', 'primitiveResolved', 'CYLINDER', 8, 'candidate'), entry(2, 'VALVE-1', 'VALV', 'valve', 'blocked', null, null, 'blocked', 'Valve primitive solver is not implemented in Phase E1'), entry(3, 'SUPPORT-1', 'ATTA', 'support', 'deferred', null, null, 'deferred', null, 'Support deferred')];
  return { schema: 'ElementRvmLedger.v1', graphId: 'contract-ledger', sourceSchema: 'inputxml-managed-stage/v1', sourceProfile: 'AVEVA_JSON_FOR_3D_RVM_VIEWER', units: 'mm', branchCount: 1, totalElementCount: entries.length, componentElementCount: 2, supportElementCount: 1, typeCounts: { BRANCH: 1, PIPE: 1, BEND: 0, FLAN: 0, VALV: 1, ATTA: 1 }, generationReadiness: { writableElementCount: 1, primitiveResolvedElementCount: 1, blockedElementCount: 1, deferredElementCount: 1, fullRvmReady: false }, entries, warnings: [], errors: [] };
}
function entry(sequenceIndex, id, type, family, geometryStatus, primitiveKind, primitiveCode, unitStatus, blockReason = null, deferReason = null) { return { ledgerEntryId: `ELR-${sequenceIndex}`, sourceElementId: id, sourceElementName: id, sourceElementType: type, normalizedFamily: family, branchId: 'BRANCH-1', branchName: '/BRANCH-1', lineName: null, sequenceIndex, fromNode: null, toNode: null, sourceRef: id, catalogueRef: null, geometryStatus, primitiveKind, primitiveCode, rvmElementUnitStatus: unitStatus, rvmByteStatus: 'notStarted', stitchStatus: 'notStarted', stitchOrder: null, blockReason, deferReason, sourceTrace: { masterSource: 'staged-json-child', sequenceIndex } }; }
