import { PLANT_MODEL_GRAPH_SCHEMA } from '../contracts/index.js';

const AUDIT_SCHEMA = 'ManagedStageToPlantGraphAudit.v1';
const CATALOGUE = { id: 'base-piping', version: '0.1.0', source: 'samples/contracts/base-piping.catalogue-registry.json' };
const ROUTE_TYPES = new Set(['PIPE', 'TUBE', 'ROUTE', 'SEGMENT']);
const SUPPORT_TYPES = new Set(['ATTA', 'SUPPORT', 'RESTRAINT']);
const CONTAINER_TYPES = new Set(['ROOT', 'GROUP', 'DISCIPLINE', 'BRANCH', 'LINE']);
const COMPONENT_TYPES = new Set(['ELBOW', 'BEND', 'TEE', 'OLET', 'FLANGE', 'FLAN', 'VALVE', 'VALV', 'REDUCER', 'COUPLING', 'CAP', 'BLIND', 'GASKET', 'WELD']);

export function convertManagedStageJsonToPlantGraph(sourceText, options = {}) {
  const parsed = parseJson(sourceText);
  if (!parsed.ok) return emptyGraph(options, [parsed.error]);
  const source = parsed.value;
  const sourceName = options.sourceName || source.source || 'managed-stage-json';
  const graphId = source.source || stripJsonSuffix(sourceName) || 'managed-stage-json';
  const records = collectRecords(source);
  const nodes = [];
  const nodeById = new Map();
  const routes = [];
  const routeByRecordId = new Map();
  const routeIds = new Set();
  for (const entry of records) {
    const record = entry.record;
    const a = attrs(record);
    const id = recordId(record, routes.length + 1);
    if (hasEndpointTopology(record)) {
      const from = nodeId(value(a, 'FROM_NODE', 'FROM', 'START_NODE'));
      const to = nodeId(value(a, 'TO_NODE', 'TO', 'END_NODE'));
      const start = point(value(a, 'APOS', 'START_POS', 'FROM_POS'));
      const end = point(value(a, 'LPOS', 'END_POS', 'TO_POS'));
      addNode(nodes, nodeById, from, start, `${id}.FROM_NODE`);
      addNode(nodes, nodeById, to, end, `${id}.TO_NODE`);
      const routeId = uniqueRouteId(`R-${from}-${to}`, routeIds, id);
      const route = compact({ id: routeId, lineNo: value(a, 'LINE_NO', 'LINE_NUMBER', 'LINE', 'BRANCHNAME') || entry.context.lineNo, from, to, bore: value(a, 'NPS', 'BORE', 'DIAMETER', 'NOMINAL_SIZE'), schedule: value(a, 'SCHEDULE', 'SCH', 'WALL_THICK'), material: value(a, 'MATERIAL', 'MATL', 'MAT') || entry.context.material, sourceRef: id, topologyRole: isPipeRecord(record) ? 'pipe-run-segment' : 'inline-component-segment', componentClass: componentClass(record) || normType(record) });
      routes.push(route);
      routeByRecordId.set(id, routeId);
    }
    if (isSupport(record)) {
      const supportNode = nodeId(value(a, 'NODE', 'AT_NODE', 'FROM_NODE', 'TO_NODE'));
      const supportPosition = point(value(a, 'POS', 'POSITION', 'APOS', 'LPOS'));
      addNode(nodes, nodeById, supportNode, supportPosition, `${id}.NODE`);
    } else if (isComponent(record) && !hasEndpointTopology(record)) {
      const node = nodeId(value(a, 'NODE', 'AT_NODE', 'FROM_NODE', 'TO_NODE'));
      const position = point(value(a, 'POS', 'POSITION', 'APOS', 'LPOS'));
      addNode(nodes, nodeById, node, position, `${id}.NODE`);
    }
  }
  const items = [];
  for (const entry of records) {
    const record = entry.record;
    const a = attrs(record);
    const id = recordId(record, items.length + 1);
    if (isPipeRecord(record) && hasEndpointTopology(record)) {
      const route = routeByRecordId.get(id);
      if (route) items.push({ id, kind: 'generated', generator: 'straightPipe.v1', route, sourceRef: id });
    } else if (isSupport(record)) {
      items.push(compact({ id, kind: 'support', tagged: false, node: nodeId(value(a, 'NODE', 'AT_NODE', 'FROM_NODE', 'TO_NODE')), supportFamily: value(a, 'SUPPORT_KIND', 'SUPPORT_FAMILY', 'RESTRAINT', 'TYPE'), axis: value(a, 'SUPPORT_AXIS', 'AXIS', 'DIRECTION'), source: value(a, 'SOURCE', 'SOURCE_FORMAT'), placement: placement(value(a, 'POS', 'POSITION', 'APOS', 'LPOS')), sourceRef: id }));
    } else if (isComponent(record)) {
      items.push(componentItem(record, a, id, routes, routeByRecordId));
    }
  }
  const graph = { schema: PLANT_MODEL_GRAPH_SCHEMA, id: graphId, project: { name: source.source || graphId, units: units(source, options), axisBasis: { authoring: 'canvas-current', rvmExport: 'navis-review' } }, catalogues: [{ ...CATALOGUE }], nodes, routes, items, sourceRefs: [{ sourceType: 'managed-stage-json', name: sourceName, phase: options.phase || 'Phase 2 shadow importer benchmark' }] };
  if (typeof options.isonoteText === 'string' && options.isonoteText.trim()) graph.annotations = [{ kind: 'ISONOTE', text: options.isonoteText }];
  return graph;
}

export function auditManagedStageToPlantGraph(sourceText, graph, options = {}) {
  const parsed = parseJson(sourceText);
  const records = parsed.ok ? collectRecords(parsed.value) : [];
  const sourceCounts = countSourceRecords(records, parsed.value);
  const unsupportedRecords = parsed.ok ? records.filter((entry) => isUnsupported(entry.record)).map((entry) => ({ id: recordId(entry.record), name: entry.record?.name, type: entry.record?.type || entry.record?.kind || 'UNKNOWN' })) : [];
  const items = Array.isArray(graph?.items) ? graph.items : [];
  const generatedItems = items.filter((item) => item.kind === 'generated');
  const componentItems = items.filter((item) => item.kind === 'component');
  const placeholderGeneratedComponentCount = generatedItems.filter((item) => /Placeholder\.v1$/i.test(String(item.generator || ''))).length;
  return { schema: AUDIT_SCHEMA, sourceName: options.sourceName || parsed.value?.source || 'managed-stage-json', parsed: parsed.ok, nodeCount: Array.isArray(graph?.nodes) ? graph.nodes.length : 0, routeCount: Array.isArray(graph?.routes) ? graph.routes.length : 0, itemCount: items.length, supportItemCount: items.filter((item) => item.kind === 'support').length, componentItemCount: componentItems.length, generatedItemCount: generatedItems.length, taggedItemCount: items.filter((item) => item.tagged === true).length, sourceComponentCount: sourceCounts.component, sourcePipeCount: sourceCounts.pipe, sourceFlangeCount: sourceCounts.flange, sourceValveCount: sourceCounts.valve, sourceBendCount: sourceCounts.bend, sourceSupportCount: sourceCounts.support, graphNodeCount: Array.isArray(graph?.nodes) ? graph.nodes.length : 0, graphRouteCount: Array.isArray(graph?.routes) ? graph.routes.length : 0, graphItemCount: items.length, generatedPipeItemCount: generatedItems.filter((item) => item.generator === 'straightPipe.v1').length, unresolvedComponentCount: componentItems.filter((item) => item.resolutionIntent === 'unresolved').length, placeholderGeneratedComponentCount, endpointTopologyRecordCount: records.filter((entry) => hasEndpointTopology(entry.record)).length, bendArcEvidenceCount: componentItems.filter((item) => item.bendEvidence?.arcCenter && item.bendEvidence?.normal && item.bendEvidence?.startTangent && item.bendEvidence?.endTangent).length, flangeEvidenceCount: componentItems.filter((item) => item.flangeEvidence?.placementSource && item.flangeEvidence?.lengthMm && item.flangeEvidence?.outerDiameterMm).length, warnings: parsed.ok ? [] : [parsed.error], unsupportedRecords };
}

function collectRecords(source) { const roots = []; for (const key of ['hierarchy', 'geometryRecords', 'records', 'components', 'supports']) if (Array.isArray(source?.[key])) roots.push(...source[key]); if (!roots.length && source && typeof source === 'object') roots.push(source); const records = []; for (const root of roots) walk(root, {}, records); return records; }
function walk(record, context, records) { if (!record || typeof record !== 'object') return; const a = attrs(record); const nextContext = { lineNo: value(a, 'LINE_NO', 'LINE_NUMBER', 'LINE', 'BRANCHNAME') || context.lineNo, material: value(a, 'MATERIAL', 'MATL', 'MAT') || context.material }; if (record.type || record.kind || record.id || record.name) records.push({ record, context: nextContext }); for (const key of ['children', 'items', 'records', 'components', 'supports', 'geometryRecords']) for (const child of Array.isArray(record[key]) ? record[key] : []) walk(child, nextContext, records); }
function componentItem(record, a, id, routes, routeByRecordId) { const explicitFamily = value(a, 'CATALOGUE_FAMILY', 'CATALOG_FAMILY', 'FAMILY'); const explicitType = value(a, 'CATALOGUE_TYPE', 'CATALOG_TYPE', 'COMPONENT_TYPE'); const family = explicitFamily || inferredFamily(record); const type = explicitType || value(a, 'DTXR', 'RAW_TYPE', 'CANONICAL_TYPE', 'TYPE') || normType(record); const nps = value(a, 'NPS', 'BORE', 'DIAMETER', 'NOMINAL_SIZE'); const schedule = value(a, 'SCHEDULE', 'SCH', 'WALL_THICK'); const route = routeByRecordId.get(id); const dims = componentDimensions(a); const hasCatalogueRef = Boolean(explicitFamily && explicitType); const item = hasCatalogueRef ? { id, kind: 'component', tagged: true, catalogueRef: compact({ catalogue: CATALOGUE.id, family: explicitFamily, type: explicitType, nps, schedule }), family, type, dimensions: dims, placement: componentPlacement(record, a, routes, route), flangeEvidence: isFlangeRecord(record) ? flangeEvidence(a) : undefined, bendEvidence: isBendRecord(record) ? bendEvidence(a) : undefined, route, sourceRef: id } : { id, kind: 'component', tagged: false, family, type, resolutionIntent: 'unresolved', route, placement: componentPlacement(record, a, routes, route), sourceRef: id, dimensions: dims, flangeEvidence: isFlangeRecord(record) ? flangeEvidence(a) : undefined, bendEvidence: isBendRecord(record) ? bendEvidence(a) : undefined }; return compact(item); }
function componentDimensions(a) { return compact({ diameterMm: numberValue(value(a, 'OUTSIDE_DIAMETER_MM', 'DIAMETER_MM', 'DIAMETER')), wallMm: numberValue(value(a, 'WALL_THICKNESS_MM', 'WALL_THICK')), lengthMm: numberValue(value(a, 'FLANGE_LENGTH_MM', 'LENGTH_MM', 'ELEMENT_LENGTH_MM')), outerDiameterMm: numberValue(value(a, 'FLANGE_OD_MM', 'OUTER_DIAMETER_MM')), boreDiameterMm: numberValue(value(a, 'BORE_DIAMETER_MM', 'BORE_MM')), faceThicknessMm: numberValue(value(a, 'FACE_THICKNESS_MM', 'RAISED_FACE_THICKNESS_MM')), hubDiameterMm: numberValue(value(a, 'HUB_DIAMETER_MM')), hubLengthMm: numberValue(value(a, 'HUB_LENGTH_MM')) }); }
function componentPlacement(record, a, routes, route) { const from = nodeId(value(a, 'FROM_NODE', 'FROM', 'START_NODE')); const to = nodeId(value(a, 'TO_NODE', 'TO', 'END_NODE')); const position = point(value(a, 'POS', 'POSITION', 'CENTER', 'CPOS')); if (from && to) return compact({ fromNode: from, toNode: to, route, position }); const node = nodeId(value(a, 'NODE', 'AT_NODE', 'FROM_NODE', 'TO_NODE')); const out = {}; if (node) out.node = node; if (position) out.position = position; const inRoute = routes.find((candidate) => candidate.to === node)?.id; const outRoute = routes.find((candidate) => candidate.from === node)?.id; if (inRoute) out.inRoute = inRoute; if (outRoute) out.outRoute = outRoute; return Object.keys(out).length ? out : undefined; }
function bendEvidence(a) { return compact({ fromNode: nodeId(value(a, 'FROM_NODE', 'FROM', 'START_NODE')), toNode: nodeId(value(a, 'TO_NODE', 'TO', 'END_NODE')), startPosition: point(value(a, 'APOS', 'START_POS', 'FROM_POS')), endPosition: point(value(a, 'LPOS', 'END_POS', 'TO_POS')), arcCenter: point(value(a, 'BEND_ARC_CENTER', 'ARC_CENTER', 'TRUE_BEND_CENTER')), normal: unitPoint(value(a, 'BEND_PLANE_NORMAL', 'ARC_NORMAL', 'BEND_NORMAL')), startTangent: unitPoint(value(a, 'BEND_START_TANGENT', 'START_TANGENT', 'IN_TANGENT')), endTangent: unitPoint(value(a, 'BEND_END_TANGENT', 'END_TANGENT', 'OUT_TANGENT')), rawType: value(a, 'RAW_TYPE', 'TYPE'), canonicalType: value(a, 'CANONICAL_TYPE', 'COMPONENT_CLASS'), diameterMm: numberValue(value(a, 'OUTSIDE_DIAMETER_MM', 'DIAMETER_MM', 'DIAMETER')), wallMm: numberValue(value(a, 'WALL_THICKNESS_MM', 'WALL_THICK')), bendAngleDeg: numberValue(value(a, 'BEND_ANGLE_DEG', 'BEND_ANGLE')), bendRadiusMm: numberValue(value(a, 'BEND_RADIUS_MM', 'BEND_RADIUS')), arcLengthMm: numberValue(value(a, 'ELBOW_ARC_LENGTH_MM', 'BEND_ELEMENT_LENGTH_MM', 'ELEMENT_LENGTH_IN_MM', 'ElementLengthInMm')), chordLengthMm: numberValue(value(a, 'BEND_CHORD_LENGTH_MM', 'ROUTE_LENGTH_MM', 'LENGTH_MM')), centerEstimate: point(value(a, 'BEND_CENTER_ESTIMATE', 'CPOS', 'CENTER')), centerEstimateSource: value(a, 'BEND_CENTER_ESTIMATE_SOURCE'), sourceBendAttrs: value(a, 'SOURCE_BEND_ATTRS') }); }
function flangeEvidence(a) { return compact({ fromNode: nodeId(value(a, 'FROM_NODE', 'FROM', 'START_NODE')), toNode: nodeId(value(a, 'TO_NODE', 'TO', 'END_NODE')), startPosition: point(value(a, 'APOS', 'START_POS', 'FROM_POS')), endPosition: point(value(a, 'LPOS', 'END_POS', 'TO_POS')), center: point(value(a, 'POS', 'POSITION', 'CENTER', 'CPOS')), lengthMm: numberValue(value(a, 'FLANGE_LENGTH_MM', 'LENGTH_MM', 'ELEMENT_LENGTH_MM')), boreDiameterMm: numberValue(value(a, 'BORE_DIAMETER_MM', 'BORE_MM', 'DIAMETER_MM', 'DIAMETER')), outerDiameterMm: numberValue(value(a, 'FLANGE_OD_MM', 'OUTER_DIAMETER_MM')), faceThicknessMm: numberValue(value(a, 'FACE_THICKNESS_MM', 'RAISED_FACE_THICKNESS_MM')), hubDiameterMm: numberValue(value(a, 'HUB_DIAMETER_MM')), hubLengthMm: numberValue(value(a, 'HUB_LENGTH_MM')), flangeType: value(a, 'FLANGE_TYPE', 'CATALOGUE_TYPE', 'COMPONENT_TYPE'), facing: value(a, 'FACING', 'FLANGE_FACING'), rating: value(a, 'RATING', 'PRESSURE_CLASS', 'CLASS'), connectionType: value(a, 'CONNECTION_TYPE', 'END_CONNECTION'), placementSource: value(a, 'FLANGE_PLACEMENT_SOURCE', 'INLINE_PLACEMENT_SOURCE') || (value(a, 'FROM_NODE') && value(a, 'TO_NODE') && value(a, 'APOS') && value(a, 'LPOS') ? 'endpoint-topology' : undefined) }); }
function countSourceRecords(records, source) { const counts = { component: 0, pipe: 0, flange: 0, valve: 0, bend: 0, support: 0 }; for (const { record } of records) { if (isSupport(record)) { counts.support += 1; continue; } if (!isComponent(record) && !isPipeRecord(record)) continue; counts.component += isPipeRecord(record) ? 0 : 1; if (isPipeRecord(record)) counts.pipe += 1; else if (isFlangeRecord(record)) counts.flange += 1; else if (isValveRecord(record)) counts.valve += 1; else if (isBendRecord(record)) counts.bend += 1; } return { component: Number(source?.stats?.componentRows ?? source?.stats?.components ?? counts.component), pipe: counts.pipe, flange: Number(source?.stats?.flanges ?? counts.flange), valve: Number(source?.stats?.valves ?? counts.valve), bend: Number(source?.stats?.bends ?? counts.bend), support: Number(source?.stats?.validRestraints ?? source?.stats?.emittedSupports ?? counts.support) }; }
function emptyGraph(options, warnings = []) { return { schema: PLANT_MODEL_GRAPH_SCHEMA, id: options.graphId || 'managed-stage-json', project: { name: options.graphId || 'managed-stage-json', units: options.units || 'mm', axisBasis: { authoring: 'canvas-current', rvmExport: 'navis-review' } }, catalogues: [{ ...CATALOGUE }], nodes: [], routes: [], items: [], sourceRefs: [], warnings }; }
function attrs(record) { return record?.attributes && typeof record.attributes === 'object' ? record.attributes : record; }
function value(source, ...keys) { for (const key of keys) if (source && source[key] !== undefined && source[key] !== null && source[key] !== '') return source[key]; return undefined; }
function parseJson(text) { try { return { ok: true, value: typeof text === 'string' ? JSON.parse(text) : text }; } catch (error) { return { ok: false, error: error.message || String(error) }; } }
function stripJsonSuffix(value) { return String(value || '').replace(/\.json$/i, ''); }
function nodeId(value) { return value === undefined || value === null || value === '' ? undefined : String(value); }
function point(value) { return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry))) ? value.map(Number) : undefined; }
function unitPoint(value) { const p = point(value); if (!p) return undefined; const m = Math.hypot(...p); return m > 0 ? p.map((entry) => entry / m) : undefined; }
function placement(value) { const p = point(value); return p ? { position: p } : undefined; }
function addNode(nodes, nodeById, id, coord, sourceRef) { if (!id || !coord) return; if (!nodeById.has(id)) { const node = { id, coord, sourceRef }; nodes.push(node); nodeById.set(id, node); } }
function uniqueRouteId(base, routeIds, fallback) { let id = base; let index = 2; while (routeIds.has(id)) id = `${base}-${index++}`; routeIds.add(id); return id || `R-${fallback}`; }
function isSupport(record) { return SUPPORT_TYPES.has(normType(record)); }
function isPipeRecord(record) { return ROUTE_TYPES.has(normType(record)) || normType(record) === 'PIPE'; }
function isComponent(record) { return COMPONENT_TYPES.has(normType(record)) && !isPipeRecord(record); }
function isUnsupported(record) { return !isSupport(record) && !isPipeRecord(record) && !isComponent(record) && !CONTAINER_TYPES.has(normType(record)); }
function hasEndpointTopology(record) { const a = attrs(record); return Boolean(value(a, 'FROM_NODE', 'FROM', 'START_NODE') && value(a, 'TO_NODE', 'TO', 'END_NODE') && value(a, 'APOS', 'START_POS', 'FROM_POS') && value(a, 'LPOS', 'END_POS', 'TO_POS')); }
function normType(record) { const a = attrs(record); return String(record?.type || record?.kind || value(a, 'TYPE', 'DTXR', 'RAW_TYPE') || '').trim().toUpperCase(); }
function componentClass(record) { const a = attrs(record); return value(a, 'COMPONENT_CLASS', 'CANONICAL_TYPE'); }
function inferredFamily(record) { if (isFlangeRecord(record)) return 'flange'; if (isValveRecord(record)) return 'valve'; if (isBendRecord(record)) return 'elbow'; return String(componentClass(record) || normType(record)).toLowerCase(); }
function isFlangeRecord(record) { return ['FLANGE', 'FLAN'].includes(normType(record)); }
function isValveRecord(record) { return ['VALVE', 'VALV'].includes(normType(record)); }
function isBendRecord(record) { return ['ELBOW', 'BEND'].includes(normType(record)); }
function units(source, options) { return source?.units?.length || source?.units || options.units || 'mm'; }
function compact(value) { if (!value || typeof value !== 'object') return value; const out = {}; for (const [key, entry] of Object.entries(value)) if (entry !== undefined && entry !== null && entry !== '') out[key] = entry; return out; }
function numberValue(value) { if (value === undefined || value === null || value === '') return undefined; const number = Number(value); return Number.isFinite(number) ? number : undefined; }
function recordId(record, fallback = 1) { const a = attrs(record); return String(value(a, 'SOURCE_ELEMENT_ID', 'ID', 'NAME') || record.id || record.name || `ITEM-${fallback}`); }
