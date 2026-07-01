import { ELEMENT_RVM_LEDGER_SCHEMA } from './platform-contract-schemas.js';

const SOURCE_SCHEMA = 'inputxml-managed-stage/v1';
const SOURCE_PROFILE = 'AVEVA_JSON_FOR_3D_RVM_VIEWER';
const ELEMENT_TYPES = new Set(['PIPE', 'BEND', 'FLAN', 'VALV', 'ATTA', 'BRANCH', 'UNKNOWN']);
const FAMILIES = new Set(['pipe', 'elbow', 'flange', 'valve', 'support', 'branch', 'unknown']);
const GEOMETRY_STATUSES = new Set(['primitiveResolved', 'blocked', 'deferred', 'notApplicable']);
const PRIMITIVE_KINDS = new Set(['CYLINDER', 'TORUS', 'FLANGE_CYLINDER']);
const PRIMITIVE_CODES = new Set([8, 4]);
const UNIT_STATUSES = new Set(['candidate', 'blocked', 'deferred', 'notApplicable']);
const NOT_STARTED = 'notStarted';
const TYPE_KEYS = Object.freeze(['BRANCH', 'PIPE', 'BEND', 'FLAN', 'VALV', 'ATTA']);

export function validateElementRvmLedgerContract(ledger) {
  const errors = [];
  if (!ledger || typeof ledger !== 'object') errors.push('ledger must be an object');
  if (ledger?.schema !== ELEMENT_RVM_LEDGER_SCHEMA) errors.push(`schema must be ${ELEMENT_RVM_LEDGER_SCHEMA}`);
  if (!ledger?.graphId) errors.push('graphId is required');
  if (ledger?.sourceSchema !== SOURCE_SCHEMA) errors.push(`sourceSchema must be ${SOURCE_SCHEMA}`);
  if (ledger?.sourceProfile !== SOURCE_PROFILE) errors.push(`sourceProfile must be ${SOURCE_PROFILE}`);
  if (ledger?.units !== 'mm') errors.push('units must be mm');
  for (const key of ['branchCount', 'totalElementCount', 'componentElementCount', 'supportElementCount']) if (!nonNegativeInteger(ledger?.[key])) errors.push(`${key} must be a non-negative integer`);
  if (!ledger?.typeCounts || typeof ledger.typeCounts !== 'object') errors.push('typeCounts object is required');
  for (const key of TYPE_KEYS) if (!nonNegativeInteger(ledger?.typeCounts?.[key])) errors.push(`typeCounts.${key} must be a non-negative integer`);
  if (!ledger?.generationReadiness || typeof ledger.generationReadiness !== 'object') errors.push('generationReadiness object is required');
  for (const key of ['writableElementCount', 'primitiveResolvedElementCount', 'blockedElementCount', 'deferredElementCount']) if (!nonNegativeInteger(ledger?.generationReadiness?.[key])) errors.push(`generationReadiness.${key} must be a non-negative integer`);
  if (ledger?.generationReadiness?.fullRvmReady !== false) errors.push('generationReadiness.fullRvmReady must be false in Phase E1');
  if (!Array.isArray(ledger?.entries)) errors.push('entries array is required');
  if (!Array.isArray(ledger?.warnings)) errors.push('warnings array is required');
  if (!Array.isArray(ledger?.errors)) errors.push('errors array is required');

  const entries = Array.isArray(ledger?.entries) ? ledger.entries : [];
  const sourceIds = new Set();
  const sequenceIndexes = [];
  for (const [index, entry] of entries.entries()) validateEntry(entry, index, errors, sourceIds, sequenceIndexes);
  if (nonNegativeInteger(ledger?.totalElementCount) && ledger.totalElementCount !== entries.length) errors.push('totalElementCount must equal entries.length');
  const componentCount = entries.filter((entry) => ['PIPE', 'BEND', 'FLAN', 'VALV'].includes(entry.sourceElementType)).length;
  const supportCount = entries.filter((entry) => entry.sourceElementType === 'ATTA').length;
  if (nonNegativeInteger(ledger?.componentElementCount) && ledger.componentElementCount !== componentCount) errors.push('componentElementCount must equal PIPE+BEND+FLAN+VALV entries');
  if (nonNegativeInteger(ledger?.supportElementCount) && ledger.supportElementCount !== supportCount) errors.push('supportElementCount must equal ATTA entries');
  if (nonNegativeInteger(ledger?.branchCount) && ledger.typeCounts?.BRANCH !== ledger.branchCount) errors.push('typeCounts.BRANCH must equal branchCount');
  for (const key of ['PIPE', 'BEND', 'FLAN', 'VALV', 'ATTA']) {
    const actual = entries.filter((entry) => entry.sourceElementType === key).length;
    if (nonNegativeInteger(ledger?.typeCounts?.[key]) && ledger.typeCounts[key] !== actual) errors.push(`typeCounts.${key} must match entry count`);
  }
  const readiness = ledger?.generationReadiness || {};
  const resolvedCount = entries.filter((entry) => entry.geometryStatus === 'primitiveResolved').length;
  const blockedCount = entries.filter((entry) => entry.rvmElementUnitStatus === 'blocked').length;
  const deferredCount = entries.filter((entry) => entry.rvmElementUnitStatus === 'deferred').length;
  const writableCount = entries.filter((entry) => entry.rvmElementUnitStatus === 'candidate').length;
  if (nonNegativeInteger(readiness.primitiveResolvedElementCount) && readiness.primitiveResolvedElementCount !== resolvedCount) errors.push('primitiveResolvedElementCount must match primitiveResolved entries');
  if (nonNegativeInteger(readiness.blockedElementCount) && readiness.blockedElementCount !== blockedCount) errors.push('blockedElementCount must match blocked entries');
  if (nonNegativeInteger(readiness.deferredElementCount) && readiness.deferredElementCount !== deferredCount) errors.push('deferredElementCount must match deferred entries');
  if (nonNegativeInteger(readiness.writableElementCount) && readiness.writableElementCount !== writableCount) errors.push('writableElementCount must match candidate entries');
  const sorted = [...sequenceIndexes].sort((a, b) => a - b);
  for (let index = 0; index < sorted.length; index += 1) if (sorted[index] !== index + 1) errors.push('sequenceIndex must be deterministic contiguous 1..N');
  return { schema: 'ElementRvmLedgerValidation.v1', ok: errors.length === 0, errorCount: errors.length, errors };
}

export function assertElementRvmLedgerContract(ledger) {
  const result = validateElementRvmLedgerContract(ledger);
  if (!result.ok) throw new Error(`ElementRvmLedger contract invalid: ${result.errors.join('; ')}`);
  return result;
}

function validateEntry(entry, index, errors, sourceIds, sequenceIndexes) {
  const prefix = `entries[${index}]`;
  if (!entry || typeof entry !== 'object') { errors.push(`${prefix} must be an object`); return; }
  for (const key of ['ledgerEntryId', 'sourceElementId', 'sourceElementName', 'sourceElementType', 'normalizedFamily', 'branchId', 'branchName']) if (!entry[key]) errors.push(`${prefix}.${key} is required`);
  if (sourceIds.has(entry.sourceElementId)) errors.push(`${prefix}.sourceElementId must be unique`);
  if (entry.sourceElementId) sourceIds.add(entry.sourceElementId);
  if (!ELEMENT_TYPES.has(entry.sourceElementType)) errors.push(`${prefix}.sourceElementType is invalid`);
  if (!FAMILIES.has(entry.normalizedFamily)) errors.push(`${prefix}.normalizedFamily is invalid`);
  if (entry.lineName !== null && typeof entry.lineName !== 'string') errors.push(`${prefix}.lineName must be string or null`);
  if (!positiveInteger(entry.sequenceIndex)) errors.push(`${prefix}.sequenceIndex must be positive integer`);
  else sequenceIndexes.push(Number(entry.sequenceIndex));
  if (entry.fromNode !== null && (typeof entry.fromNode !== 'object' || Array.isArray(entry.fromNode))) errors.push(`${prefix}.fromNode must be object or null`);
  if (entry.toNode !== null && (typeof entry.toNode !== 'object' || Array.isArray(entry.toNode))) errors.push(`${prefix}.toNode must be object or null`);
  if (entry.catalogueRef !== null && (typeof entry.catalogueRef !== 'object' || Array.isArray(entry.catalogueRef))) errors.push(`${prefix}.catalogueRef must be object or null`);
  if (!GEOMETRY_STATUSES.has(entry.geometryStatus)) errors.push(`${prefix}.geometryStatus is invalid`);
  if (entry.primitiveKind !== null && !PRIMITIVE_KINDS.has(entry.primitiveKind)) errors.push(`${prefix}.primitiveKind is invalid`);
  if (entry.primitiveCode !== null && !PRIMITIVE_CODES.has(Number(entry.primitiveCode))) errors.push(`${prefix}.primitiveCode is invalid`);
  if (!UNIT_STATUSES.has(entry.rvmElementUnitStatus)) errors.push(`${prefix}.rvmElementUnitStatus is invalid`);
  if (entry.rvmByteStatus !== NOT_STARTED) errors.push(`${prefix}.rvmByteStatus must be notStarted`);
  if (entry.stitchStatus !== NOT_STARTED) errors.push(`${prefix}.stitchStatus must be notStarted`);
  if (entry.stitchOrder !== null) errors.push(`${prefix}.stitchOrder must be null in Phase E1`);
  if (entry.blockReason !== null && typeof entry.blockReason !== 'string') errors.push(`${prefix}.blockReason must be string or null`);
  if (entry.deferReason !== null && typeof entry.deferReason !== 'string') errors.push(`${prefix}.deferReason must be string or null`);
  if (!entry.sourceTrace || typeof entry.sourceTrace !== 'object' || Array.isArray(entry.sourceTrace)) errors.push(`${prefix}.sourceTrace object is required`);
}
function nonNegativeInteger(value) { return Number.isInteger(Number(value)) && Number(value) >= 0; }
function positiveInteger(value) { return Number.isInteger(Number(value)) && Number(value) > 0; }
