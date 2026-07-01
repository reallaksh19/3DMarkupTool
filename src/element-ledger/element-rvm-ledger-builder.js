const LEDGER_SCHEMA = 'ElementRvmLedger.v1';
const SOURCE_SCHEMA = 'inputxml-managed-stage/v1';
const SOURCE_PROFILE = 'AVEVA_JSON_FOR_3D_RVM_VIEWER';
const SOURCE_EVIDENCE = 'staged-json-child';
const SOURCE_OF_TRUTH = 'PlantModelGraph.v1';
const TYPE_TO_FAMILY = Object.freeze({ PIPE: 'pipe', BEND: 'elbow', FLAN: 'flange', FLANGE: 'flange', VALV: 'valve', VALVE: 'valve', ATTA: 'support', SUPPORT: 'support', RESTRAINT: 'support', BRANCH: 'branch' });
const FAMILY_TO_TYPE = Object.freeze({ pipe: 'PIPE', elbow: 'BEND', bend: 'BEND', flange: 'FLAN', valve: 'VALV', support: 'ATTA', branch: 'BRANCH' });

export function buildElementRvmLedger(input, options = {}) {
  const source = normalizeInput(input);
  const graphId = options.graphId || source?.source || source?.id || 'managed-stage-json';
  const branches = findBranches(source);
  const sourceChildren = collectSourceChildren(source, branches);
  const primitiveBySource = buildPrimitiveMap(options.primitiveModel || input?.primitiveModel);
  const graphItemBySource = buildGraphItemMap(options.plantGraph || input?.plantGraph || options.graph || input?.graph);
  const entries = sourceChildren.map((child, index) => buildEntry(child, index + 1, primitiveBySource, graphItemBySource, graphId));
  const typeCounts = countTypes(entries, branches.length);
  const generationReadiness = {
    writableElementCount: entries.filter((entry) => entry.rvmElementUnitStatus === 'candidate').length,
    primitiveResolvedElementCount: entries.filter((entry) => entry.geometryStatus === 'primitiveResolved').length,
    blockedElementCount: entries.filter((entry) => entry.rvmElementUnitStatus === 'blocked').length,
    deferredElementCount: entries.filter((entry) => entry.rvmElementUnitStatus === 'deferred').length,
    fullRvmReady: false
  };
  return {
    schema: LEDGER_SCHEMA,
    graphId,
    sourceSchema: source?.schema || SOURCE_SCHEMA,
    sourceProfile: source?.profile || SOURCE_PROFILE,
    units: resolveUnits(source, options),
    branchCount: branches.length,
    totalElementCount: entries.length,
    componentElementCount: entries.filter((entry) => ['PIPE', 'BEND', 'FLAN', 'VALV'].includes(entry.sourceElementType)).length,
    supportElementCount: entries.filter((entry) => entry.sourceElementType === 'ATTA').length,
    typeCounts,
    generationReadiness,
    entries,
    warnings: entries.length === 0 ? ['No staged JSON branch children found for ElementRvmLedger.v1'] : [],
    errors: []
  };
}

function normalizeInput(input) {
  if (typeof input === 'string') return JSON.parse(input);
  if (input?.sourceText && typeof input.sourceText === 'string') return JSON.parse(input.sourceText);
  if (input?.managedStage) return input.managedStage;
  if (input?.stagedJson) return input.stagedJson;
  return input || {};
}
function findBranches(source) {
  const branches = [];
  walk(source, null, (record, parent) => {
    const type = normalizeType(record);
    if (type === 'BRANCH') branches.push({ record, parent });
  });
  return branches;
}
function collectSourceChildren(source, branches) {
  const children = [];
  if (branches.length) {
    for (const branch of branches) for (const child of Array.isArray(branch.record?.children) ? branch.record.children : []) if (isLedgerChild(child)) children.push({ record: child, branch: branch.record });
    return children;
  }
  for (const key of ['children', 'items', 'records', 'components', 'supports', 'geometryRecords']) for (const record of Array.isArray(source?.[key]) ? source[key] : []) if (isLedgerChild(record)) children.push({ record, branch: null });
  return children;
}
function buildEntry(child, sequenceIndex, primitiveBySource, graphItemBySource, graphId) {
  const record = child.record;
  const branch = child.branch;
  const a = attrs(record);
  const branchAttrs = attrs(branch);
  const rawType = normalizeType(record);
  const sourceElementType = normalizeLedgerType(rawType, a);
  const normalizedFamily = familyFor(sourceElementType, a);
  const sourceElementName = String(value(a, 'NAME') || record?.name || `${sourceElementType}-${sequenceIndex}`);
  const sourceElementId = String(value(a, 'SOURCE_ELEMENT_ID', 'ID', 'GUID') || sanitizeId(sourceElementName) || `${sourceElementType}-${sequenceIndex}`);
  const primitive = primitiveBySource.get(sourceElementId) || primitiveBySource.get(sourceElementName);
  const graphItem = graphItemBySource.get(sourceElementId) || graphItemBySource.get(sourceElementName);
  const catalogueRef = primitive?.catalogueRef || graphItem?.catalogueRef || null;
  const primitiveKind = primitive ? primitive.primitiveKind || null : null;
  const primitiveCode = primitive ? Number(primitive.primitiveCode) || null : null;
  const status = statusFor(sourceElementType, primitive);
  const branchName = String(value(branchAttrs, 'NAME', 'BRANCHNAME') || branch?.name || '<unknown-branch>');
  const branchId = String(value(branchAttrs, 'SOURCE_ELEMENT_ID', 'ID', 'NAME') || sanitizeId(branchName));
  return {
    ledgerEntryId: `ELR-${String(sequenceIndex).padStart(4, '0')}-${sanitizeId(sourceElementId)}`,
    sourceElementId,
    sourceElementName,
    sourceElementType,
    normalizedFamily,
    branchId,
    branchName,
    lineName: value(a, 'LINE_NO', 'LINE_NUMBER', 'LINE', 'BRANCHNAME') || value(branchAttrs, 'LINE_NO', 'LINE_NUMBER', 'LINE', 'BRANCHNAME') || null,
    sequenceIndex,
    fromNode: endpointNode(a, 'from'),
    toNode: endpointNode(a, 'to'),
    sourceRef: sourceElementId,
    catalogueRef,
    geometryStatus: status.geometryStatus,
    primitiveKind,
    primitiveCode,
    rvmElementUnitStatus: status.rvmElementUnitStatus,
    rvmByteStatus: 'notStarted',
    stitchStatus: 'notStarted',
    stitchOrder: null,
    blockReason: status.blockReason,
    deferReason: status.deferReason,
    sourceTrace: {
      sourceEvidence: SOURCE_EVIDENCE,
      sourceOfTruth: SOURCE_OF_TRUTH,
      sourceSchema: SOURCE_SCHEMA,
      sourceProfile: SOURCE_PROFILE,
      graphId,
      graphItemId: graphItem?.id || null,
      graphSourceRef: graphItem?.sourceRef || sourceElementId,
      branchId,
      branchName,
      sequenceIndex,
      originalType: rawType,
      originalName: record?.name || null,
      sourceElementId,
      sourceElementName,
      fromNode: value(a, 'FROM_NODE', 'FROM', 'START_NODE') || null,
      toNode: value(a, 'TO_NODE', 'TO', 'END_NODE') || null,
      node: value(a, 'NODE', 'AT_NODE') || null,
      futureUnitIntent: futureUnitIntent(sourceElementType, primitive)
    }
  };
}
function statusFor(sourceElementType, primitive) {
  if (primitive) return { geometryStatus: 'primitiveResolved', rvmElementUnitStatus: 'candidate', blockReason: null, deferReason: null };
  if (sourceElementType === 'ATTA') return { geometryStatus: 'deferred', rvmElementUnitStatus: 'deferred', blockReason: null, deferReason: 'Support element preserved for future support unit/compiler decision; deferred in Phase E1' };
  if (sourceElementType === 'VALV') return { geometryStatus: 'blocked', rvmElementUnitStatus: 'blocked', blockReason: 'Valve primitive solver is not implemented in Phase E1', deferReason: null };
  if (sourceElementType === 'UNKNOWN') return { geometryStatus: 'blocked', rvmElementUnitStatus: 'blocked', blockReason: 'Unknown staged JSON element type cannot become an RVM element unit in Phase E1', deferReason: null };
  return { geometryStatus: 'blocked', rvmElementUnitStatus: 'blocked', blockReason: 'Primitive geometry is not available in ElementRvmLedger input; source element preserved for future unit generation', deferReason: null };
}
function futureUnitIntent(sourceElementType, primitive) {
  if (primitive) return `${primitive.primitiveKind || 'primitive'} element unit candidate`;
  if (sourceElementType === 'ATTA') return 'future support/restraint element unit decision';
  if (sourceElementType === 'VALV') return 'future valve element unit after catalogue-backed valve solver';
  return 'future RVM element unit after primitive/frame resolution';
}
function buildPrimitiveMap(primitiveModel) {
  const map = new Map();
  for (const primitive of Array.isArray(primitiveModel?.primitives) ? primitiveModel.primitives : []) {
    if (primitive?.sourceItemId) map.set(String(primitive.sourceItemId), primitive);
    if (primitive?.sourceRef) map.set(String(primitive.sourceRef), primitive);
  }
  return map;
}
function buildGraphItemMap(graph) {
  const map = new Map();
  for (const item of Array.isArray(graph?.items) ? graph.items : []) {
    if (item?.id) map.set(String(item.id), item);
    if (item?.sourceRef) map.set(String(item.sourceRef), item);
  }
  return map;
}
function endpointNode(a, side) {
  const id = side === 'from' ? value(a, 'FROM_NODE', 'FROM', 'START_NODE') : value(a, 'TO_NODE', 'TO', 'END_NODE');
  const position = side === 'from' ? point(value(a, 'APOS', 'START_POS', 'FROM_POS')) : point(value(a, 'LPOS', 'END_POS', 'TO_POS'));
  if (!id && !position) return null;
  return { id: id ? String(id) : null, position: position || null };
}
function countTypes(entries, branchCount) { return { BRANCH: branchCount, PIPE: entries.filter((entry) => entry.sourceElementType === 'PIPE').length, BEND: entries.filter((entry) => entry.sourceElementType === 'BEND').length, FLAN: entries.filter((entry) => entry.sourceElementType === 'FLAN').length, VALV: entries.filter((entry) => entry.sourceElementType === 'VALV').length, ATTA: entries.filter((entry) => entry.sourceElementType === 'ATTA').length }; }
function resolveUnits(source, options) { return options.units || source?.units?.length || source?.units || 'mm'; }
function isLedgerChild(record) { const type = normalizeLedgerType(normalizeType(record), attrs(record)); return ['PIPE', 'BEND', 'FLAN', 'VALV', 'ATTA', 'UNKNOWN'].includes(type); }
function normalizeLedgerType(rawType, a) { const type = String(rawType || value(a, 'TYPE', 'RAW_TYPE', 'DTXR') || 'UNKNOWN').toUpperCase(); if (type === 'FLANGE' || type === 'FLAN') return 'FLAN'; if (type === 'VALVE' || type === 'VALV') return 'VALV'; if (type === 'ELBOW' || type === 'BEND') return 'BEND'; if (type === 'SUPPORT' || type === 'RESTRAINT' || type === 'ATTA') return 'ATTA'; if (type === 'PIPE' || type === 'TUBE') return 'PIPE'; if (type === 'BRANCH' || type === 'BRAN') return 'BRANCH'; return 'UNKNOWN'; }
function familyFor(sourceElementType, a) { const explicit = String(value(a, 'CATALOGUE_FAMILY', 'CATALOG_FAMILY', 'FAMILY') || '').toLowerCase(); if (explicit && ['pipe', 'elbow', 'flange', 'valve', 'support', 'branch'].includes(explicit)) return explicit; return TYPE_TO_FAMILY[sourceElementType] || FAMILY_TO_TYPE[sourceElementType] || 'unknown'; }
function normalizeType(record) { return String(record?.type || record?.kind || attrs(record).TYPE || 'UNKNOWN').toUpperCase(); }
function attrs(record) { return record?.attributes && typeof record.attributes === 'object' ? record.attributes : record || {}; }
function value(a, ...keys) { for (const key of keys) if (a && a[key] !== undefined && a[key] !== null && a[key] !== '') return a[key]; return null; }
function point(value) { return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry))) ? value.map(Number) : null; }
function walk(value, parent, visit) { if (!value || typeof value !== 'object') return; visit(value, parent); for (const key of ['hierarchy', 'children', 'items', 'records', 'components', 'supports', 'geometryRecords']) for (const child of Array.isArray(value[key]) ? value[key] : []) walk(child, value, visit); }
function sanitizeId(value) { return String(value || '').replace(/[^A-Za-z0-9_.:-]+/g, '_').slice(0, 120); }
