import { validateElementRvmLedgerContract } from '../contracts/index.js';

const AUDIT_SCHEMA = 'ElementRvmLedgerAudit.v1';
const ELEMENT_SCHEMA = 'ElementRvmLedger.v1';
const TYPE_KEYS = Object.freeze(['BRANCH', 'PIPE', 'BEND', 'FLAN', 'VALV', 'ATTA']);

export function buildElementRvmLedgerAudit(ledger, options = {}) {
  const validation = validateElementRvmLedgerContract(ledger);
  const errors = [...validation.errors];
  const entries = Array.isArray(ledger?.entries) ? ledger.entries : [];
  const sourceIds = entries.map((entry) => entry.sourceElementId);
  const duplicateIds = sourceIds.filter((id, index) => sourceIds.indexOf(id) !== index);
  const typeCounts = countTypes(entries, ledger?.branchCount || 0);
  const droppedExpectedCount = Number.isInteger(Number(options.expectedSourceChildCount)) && Number(options.expectedSourceChildCount) !== entries.length;
  if (droppedExpectedCount) errors.push(`expected source child count ${options.expectedSourceChildCount} does not match ledger entries ${entries.length}`);
  if (duplicateIds.length) errors.push(`duplicate sourceElementId values: ${[...new Set(duplicateIds)].join(', ')}`);
  for (const entry of entries) {
    if (!entry.sourceTrace || typeof entry.sourceTrace !== 'object') errors.push(`${entry.sourceElementId || '<unknown>'} missing sourceTrace`);
    if (entry.rvmByteStatus !== 'notStarted') errors.push(`${entry.sourceElementId || '<unknown>'} rvmByteStatus must be notStarted`);
    if (entry.stitchStatus !== 'notStarted') errors.push(`${entry.sourceElementId || '<unknown>'} stitchStatus must be notStarted`);
    if (entry.rvmElementUnitStatus === 'candidate' && entry.geometryStatus !== 'primitiveResolved') errors.push(`${entry.sourceElementId || '<unknown>'} candidate requires primitiveResolved geometryStatus`);
  }
  if (ledger?.generationReadiness?.fullRvmReady !== false) errors.push('fullRvmReady must be false in Phase E1');
  const audit = {
    schema: AUDIT_SCHEMA,
    ledgerSchema: ledger?.schema || '<missing-ledger-schema>',
    graphId: ledger?.graphId || options.graphId || '<unknown-graph>',
    sourceSchema: ledger?.sourceSchema || '<missing-source-schema>',
    sourceProfile: ledger?.sourceProfile || '<missing-source-profile>',
    totalElementCount: entries.length,
    componentElementCount: entries.filter((entry) => ['PIPE', 'BEND', 'FLAN', 'VALV'].includes(entry.sourceElementType)).length,
    supportElementCount: entries.filter((entry) => entry.sourceElementType === 'ATTA').length,
    branchCount: Number(ledger?.branchCount || 0),
    typeCounts,
    sourceElementIdCount: new Set(sourceIds).size,
    duplicateSourceElementIdCount: duplicateIds.length,
    missingSourceElementIdCount: entries.filter((entry) => !entry.sourceElementId).length,
    missingSourceElementTypeCount: entries.filter((entry) => !entry.sourceElementType).length,
    missingSequenceIndexCount: entries.filter((entry) => !Number.isInteger(Number(entry.sequenceIndex))).length,
    sequenceIndexDeterministic: isContiguousSequence(entries.map((entry) => Number(entry.sequenceIndex))),
    sourceTraceMissingCount: entries.filter((entry) => !entry.sourceTrace || typeof entry.sourceTrace !== 'object').length,
    primitiveResolvedElementCount: entries.filter((entry) => entry.geometryStatus === 'primitiveResolved').length,
    writableElementCount: entries.filter((entry) => entry.rvmElementUnitStatus === 'candidate').length,
    blockedElementCount: entries.filter((entry) => entry.rvmElementUnitStatus === 'blocked').length,
    deferredElementCount: entries.filter((entry) => entry.rvmElementUnitStatus === 'deferred').length,
    blockedValveCount: entries.filter((entry) => entry.sourceElementType === 'VALV' && entry.rvmElementUnitStatus === 'blocked').length,
    deferredSupportCount: entries.filter((entry) => entry.sourceElementType === 'ATTA' && entry.rvmElementUnitStatus === 'deferred').length,
    primitiveOnlyOrphanCount: entries.filter((entry) => entry.sourceTrace?.masterSource !== 'staged-json-child').length,
    rvmByteNotStartedCount: entries.filter((entry) => entry.rvmByteStatus === 'notStarted').length,
    stitchNotStartedCount: entries.filter((entry) => entry.stitchStatus === 'notStarted').length,
    fullRvmReady: ledger?.generationReadiness?.fullRvmReady === true,
    hardErrorCount: errors.length,
    warningCount: Array.isArray(ledger?.warnings) ? ledger.warnings.length : 0,
    ok: false,
    errors,
    warnings: Array.isArray(ledger?.warnings) ? [...ledger.warnings] : []
  };
  audit.ok = validation.ok && audit.hardErrorCount === 0 && audit.duplicateSourceElementIdCount === 0 && audit.missingSourceElementIdCount === 0 && audit.missingSourceElementTypeCount === 0 && audit.missingSequenceIndexCount === 0 && audit.sequenceIndexDeterministic === true && audit.sourceTraceMissingCount === 0 && audit.primitiveOnlyOrphanCount === 0 && audit.rvmByteNotStartedCount === audit.totalElementCount && audit.stitchNotStartedCount === audit.totalElementCount && audit.fullRvmReady === false;
  return audit;
}

export function assertElementRvmLedgerAudit(audit, expectations = {}) {
  const errors = [];
  if (!audit || typeof audit !== 'object') errors.push('audit must be an object');
  if (audit?.schema !== AUDIT_SCHEMA) errors.push(`schema must be ${AUDIT_SCHEMA}`);
  if (audit?.ledgerSchema !== ELEMENT_SCHEMA) errors.push(`ledgerSchema must be ${ELEMENT_SCHEMA}`);
  if (!audit?.graphId) errors.push('graphId is required');
  for (const key of ['totalElementCount', 'componentElementCount', 'supportElementCount', 'branchCount', 'sourceElementIdCount', 'duplicateSourceElementIdCount', 'missingSourceElementIdCount', 'missingSourceElementTypeCount', 'missingSequenceIndexCount', 'sourceTraceMissingCount', 'primitiveResolvedElementCount', 'writableElementCount', 'blockedElementCount', 'deferredElementCount', 'blockedValveCount', 'deferredSupportCount', 'primitiveOnlyOrphanCount', 'rvmByteNotStartedCount', 'stitchNotStartedCount', 'hardErrorCount', 'warningCount']) if (!Number.isInteger(Number(audit?.[key]))) errors.push(`${key} must be integer-like`);
  for (const key of TYPE_KEYS) if (!Number.isInteger(Number(audit?.typeCounts?.[key]))) errors.push(`typeCounts.${key} must be integer-like`);
  for (const key of ['sequenceIndexDeterministic', 'fullRvmReady', 'ok']) if (typeof audit?.[key] !== 'boolean') errors.push(`${key} must be boolean`);
  if (!Array.isArray(audit?.errors)) errors.push('errors array is required');
  if (!Array.isArray(audit?.warnings)) errors.push('warnings array is required');
  for (const [key, expected] of Object.entries(expectations)) {
    const actual = key.startsWith('typeCounts.') ? audit?.typeCounts?.[key.slice('typeCounts.'.length)] : audit?.[key];
    if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push(`${key} expectation failed`);
  }
  if (errors.length) throw new Error(`ElementRvmLedgerAudit invalid: ${errors.join('; ')}`);
  return { schema: 'ElementRvmLedgerAuditAssertion.v1', ok: true, errorCount: 0, errors: [] };
}

function countTypes(entries, branchCount) { const out = { BRANCH: Number(branchCount || 0), PIPE: 0, BEND: 0, FLAN: 0, VALV: 0, ATTA: 0 }; for (const entry of entries) if (Object.hasOwn(out, entry.sourceElementType)) out[entry.sourceElementType] += 1; return out; }
function isContiguousSequence(values) { if (!values.length) return true; const sorted = [...values].sort((a, b) => a - b); return sorted.every((value, index) => value === index + 1); }
