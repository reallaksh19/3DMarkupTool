import { PLANT_MODEL_GRAPH_SCHEMA } from '../contracts/index.js';

const AUDIT_SCHEMA = 'ManagedStageToPlantGraphAudit.v1';
const CATALOGUE = {
  id: 'base-piping',
  version: '0.1.0',
  source: 'samples/contracts/base-piping.catalogue-registry.json'
};
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
  const routeByEndpoint = new Map();
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
      const route = compact({
        id: routeId,
        lineNo: value(a, 'LINE_NO', 'LINE_NUMBER', 'LINE', 'BRANCHNAME') || entry.context.lineNo,
        from,
        to,
        bore: value(a, 'NPS', 'BORE', 'DIAMETER', 'NOMINAL_SIZE'),
        schedule: value(a, 'SCHEDULE', 'SCH', 'WALL_THICK'),
        material: value(a, 'MATERIAL', 'MATL', 'MAT') || entry.context.material,
        sourceRef: id,
        topologyRole: isPipeRecord(record) ? 'pipe-run-segment' : 'inline-component-segment',
        componentClass: componentClass(record) || normType(record)
      });
      routes.push(route);
      routeByRecordId.set(id, routeId);
      routeByEndpoint.set(`${from}->${to}`, routeId);
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
      items.push(compact({
        id,
        kind: 'support',
        tagged: false,
        node: nodeId(value(a, 'NODE', 'AT_NODE', 'FROM_NODE', 'TO_NODE')),
        supportFamily: value(a, 'SUPPORT_KIND', 'SUPPORT_FAMILY', 'RESTRAINT', 'TYPE'),
        axis: value(a, 'SUPPORT_AXIS', 'AXIS', 'DIRECTION'),
        source: value(a, 'SOURCE', 'SOURCE_FORMAT'),
        placement: placement(value(a, 'POS', 'POSITION', 'APOS', 'LPOS')),
        sourceRef: id
      }));
    } else if (isComponent(record)) {
      items.push(componentItem(record, a, id, routes, routeByRecordId));
    }
  }

  const graph = {
    schema: PLANT_MODEL_GRAPH_SCHEMA,
    id: graphId,
    project: {
      name: source.source || graphId,
      units: units(source, options),
      axisBasis: { authoring: 'canvas-current', rvmExport: 'navis-review' }
    },
    catalogues: [{ ...CATALOGUE }],
    nodes,
    routes,
    items,
    sourceRefs: [{
      sourceType: 'managed-stage-json',
      name: sourceName,
      phase: options.phase || 'Phase 2 shadow importer benchmark'
    }]
  };
  if (typeof options.isonoteText === 'string' && options.isonoteText.trim()) {
    graph.annotations = [{ kind: 'ISONOTE', text: options.isonoteText }];
  }
  return graph;
}

export function auditManagedStageToPlantGraph(sourceText, graph, options = {}) {
  const parsed = parseJson(sourceText);
  const records = parsed.ok ? collectRecords(parsed.value) : [];
  const sourceCounts = countSourceRecords(records, parsed.value);
  const unsupportedRecords = parsed.ok
    ? records.filter((entry) => isUnsupported(entry.record)).map((entry) => ({
      id: recordId(entry.record),
      name: entry.record?.name,
      type: entry.record?.type || entry.record?.kind || 'UNKNOWN'
    }))
    : [];
  const items = Array.isArray(graph?.items) ? graph.items : [];
  const generatedItems = items.filter((item) => item.kind === 'generated');
  const componentItems = items.filter((item) => item.kind === 'component');
  const placeholderGeneratedComponentCount = generatedItems
    .filter((item) => /Placeholder\.v1$/i.test(String(item.generator || ''))).length;
  return {
    schema: AUDIT_SCHEMA,
    sourceName: options.sourceName || parsed.value?.source || 'managed-stage-json',
    parsed: parsed.ok,
    nodeCount: Array.isArray(graph?.nodes) ? graph.nodes.length : 0,
    routeCount: Array.isArray(graph?.routes) ? graph.routes.length : 0,
    itemCount: items.length,
    supportItemCount: items.filter((item) => item.kind === 'support').length,
    componentItemCount: componentItems.length,
    generatedItemCount: generatedItems.length,
    taggedItemCount: items.filter((item) => item.tagged === true).length,
    sourceComponentCount: sourceCounts.component,
    sourcePipeCount: sourceCounts.pipe,
    sourceFlangeCount: sourceCounts.flange,
    sourceValveCount: sourceCounts.valve,
    sourceBendCount: sourceCounts.bend,
    sourceSupportCount: sourceCounts.support,
    graphNodeCount: Array.isArray(graph?.nodes) ? graph.nodes.length : 0,
    graphRouteCount: Array.isArray(graph?.routes) ? graph.routes.length : 0,
    graphItemCount: items.length,
    generatedPipeItemCount: generatedItems.filter((item) => item.generator === 'straightPipe.v1').length,
    unresolvedComponentCount: componentItems.filter((item) => item.resolutionIntent === 'unresolved').length,
    placeholderGeneratedComponentCount,
    endpointTopologyRecordCount: records.filter((entry) => hasEndpointTopology(entry.record)).length,
    warnings: parsed.ok ? [] : [parsed.error],
    unsupportedRecords
  };
}

function collectRecords(source) {
  const roots = [];
  for (const key of ['hierarchy', 'geometryRecords', 'records', 'components', 'supports']) {
    if (Array.isArray(source?.[key])) roots.push(...source[key]);
  }
  if (!roots.length && source && typeof source === 'object') roots.push(source);
  const records = [];
  for (const root of roots) walk(root, {}, records);
  return records;
}

function walk(record, context, records) {
  if (!record || typeof record !== 'object') return;
  const a = attrs(record);
  const nextContext = {
    lineNo: value(a, 'LINE_NO', 'LINE_NUMBER', 'LINE', 'BRANCHNAME') || context.lineNo,
    material: value(a, 'MATERIAL', 'MATL', 'MAT') || context.material
  };
  if (record.type || record.kind || record.id || record.name) records.push({ record, context: nextContext });
  for (const key of ['children', 'items', 'records', 'components', 'supports', 'geometryRecords']) {
    for (const child of Array.isArray(record[key]) ? record[key] : []) walk(child, nextContext, records);
  }
}

function componentItem(record, a, id, routes, routeByRecordId) {
  const explicitFamily = value(a, 'CATALOGUE_FAMILY', 'CATALOG_FAMILY', 'FAMILY');
  const explicitType = value(a, 'CATALOGUE_TYPE', 'CATALOG_TYPE', 'COMPONENT_TYPE');
  const family = explicitFamily || inferredFamily(record);
  const type = explicitType || value(a, 'DTXR', 'RAW_TYPE', 'CANONICAL_TYPE', 'TYPE') || normType(record);
  const nps = value(a, 'NPS', 'BORE', 'DIAMETER', 'NOMINAL_SIZE');
  const schedule = value(a, 'SCHEDULE', 'SCH', 'WALL_THICK');
  const route = routeByRecordId.get(id);
  const hasCatalogueRef = Boolean(explicitFamily && explicitType);
  const item = hasCatalogueRef ? {
    id,
    kind: 'component',
    tagged: true,
    catalogueRef: compact({
      catalogue: CATALOGUE.id,
      family: explicitFamily,
      type: explicitType,
      nps,
      schedule
    }),
    placement: componentPlacement(record, a, routes, route),
    sourceRef: id
  } : {
    id,
    kind: 'component',
    tagged: false,
    family,
    type,
    resolutionIntent: 'unresolved',
    route,
    placement: componentPlacement(record, a, routes, route),
    sourceRef: id,
    dimensions: compact({
      diameterMm: numberValue(value(a, 'OUTSIDE_DIAMETER_MM', 'DIAMETER_MM', 'DIAMETER')),
      wallMm: numberValue(value(a, 'WALL_THICKNESS_MM', 'WALL_THICK'))
    }),
    bendEvidence: isBendRecord(record) ? bendEvidence(a) : undefined
  };
  return compact(item);
}

function componentPlacement(record, a, routes, route) {
  const from = nodeId(value(a, 'FROM_NODE', 'FROM', 'START_NODE'));
  const to = nodeId(value(a, 'TO_NODE', 'TO', 'END_NODE'));
  const position = point(value(a, 'POS', 'POSITION', 'CENTER', 'CPOS'));
  if (from && to) {
    return compact({ fromNode: from, toNode: to, route, position });
  }
  const node = nodeId(value(a, 'NODE', 'AT_NODE', 'FROM_NODE', 'TO_NODE'));
  const out = {};
  if (node) out.node = node;
  if (position) out.position = position;
  const inRoute = routes.find((candidate) => candidate.to === node)?.id;
  const outRoute = routes.find((candidate) => candidate.from === node)?.id;
  if (inRoute) out.inRoute = inRoute;
  if (outRoute) out.outRoute = outRoute;
  return Object.keys(out).length ? out : undefined;
}

function bendEvidence(a) {
  return compact({
    fromNode: nodeId(value(a, 'FROM_NODE', 'FROM', 'START_NODE')),
    toNode: nodeId(value(a, 'TO_NODE', 'TO', 'END_NODE')),
    startPosition: point(value(a, 'APOS', 'START_POS', 'FROM_POS')),
    endPosition: point(value(a, 'LPOS', 'END_POS', 'TO_POS')),
    rawType: value(a, 'RAW_TYPE', 'TYPE'),
    canonicalType: value(a, 'CANONICAL_TYPE', 'COMPONENT_CLASS'),
    diameterMm: numberValue(value(a, 'OUTSIDE_DIAMETER_MM', 'DIAMETER_MM', 'DIAMETER')),
    wallMm: numberValue(value(a, 'WALL_THICKNESS_MM', 'WALL_THICK')),
    bendAngleDeg: numberValue(value(a, 'BEND_ANGLE_DEG', 'BEND_ANGLE')),
    bendRadiusMm: numberValue(value(a, 'BEND_RADIUS_MM', 'BEND_RADIUS')),
    arcLengthMm: numberValue(value(a, 'ELBOW_ARC_LENGTH_MM', 'BEND_ELEMENT_LENGTH_MM', 'ELEMENT_LENGTH_IN_MM', 'ElementLengthInMm')),
    chordLengthMm: numberValue(value(a, 'BEND_CHORD_LENGTH_MM', 'ROUTE_LENGTH_MM', 'LENGTH_MM')),
    centerEstimate: point(value(a, 'BEND_CENTER_ESTIMATE', 'CPOS', 'CENTER')),
    centerEstimateSource: value(a, 'BEND_CENTER_ESTIMATE_SOURCE'),
    sourceBendAttrs: value(a, 'SOURCE_BEND_ATTRS')
  });
}

function countSourceRecords(records, source) {
  const sourceStats = source?.stats && typeof source.stats === 'object' ? source.stats : {};
  const counts = { component: 0, pipe: 0, flange: 0, valve: 0, bend: 0, support: 0 };
  for (const { record } of records) {
    if (isSupport(record)) {
      counts.support += 1;
      continue;
    }
    if (CONTAINER_TYPES.has(normType(record))) continue;
    if (hasEndpointTopology(record) || isComponent(record) || isPipeRecord(record)) {
      counts.component += hasEndpointTopology(record) ? 1 : 0;
      const family = inferredFamily(record);
      if (isPipeRecord(record)) counts.pipe += 1;
      else if (family === 'flange') counts.flange += 1;
      else if (family === 'valve') counts.valve += 1;
      else if (family === 'elbow') counts.bend += isBendRecord(record) ? 1 : 0;
    }
  }
  return {
    component: integerOr(sourceStats.components, counts.component),
    pipe: counts.pipe,
    flange: counts.flange,
    valve: counts.valve,
    bend: integerOr(sourceStats.bends, counts.bend),
    support: integerOr(sourceStats.emittedSupports, counts.support)
  };
}

function hasEndpointTopology(record) {
  const a = attrs(record);
  return Boolean(
    nodeId(value(a, 'FROM_NODE', 'FROM', 'START_NODE'))
    && nodeId(value(a, 'TO_NODE', 'TO', 'END_NODE'))
    && point(value(a, 'APOS', 'START_POS', 'FROM_POS'))
    && point(value(a, 'LPOS', 'END_POS', 'TO_POS'))
  );
}

function isPipeRecord(record) {
  const cls = componentClass(record);
  return ROUTE_TYPES.has(normType(record)) || cls === 'PIPE';
}

function isBendRecord(record) {
  const t = normType(record);
  const cls = componentClass(record);
  const canonical = String(value(attrs(record), 'CANONICAL_TYPE') || '').trim().toUpperCase();
  return t === 'BEND' || cls === 'ELBOW' || canonical === 'ELBOW';
}

function inferredFamily(record) {
  const t = normType(record);
  const cls = componentClass(record);
  const canonical = String(value(attrs(record), 'CANONICAL_TYPE') || '').trim().toUpperCase();
  if (t === 'FLAN' || t === 'FLANGE' || cls === 'FLANGE' || canonical === 'FLANGE') return 'flange';
  if (t === 'VALV' || t === 'VALVE' || cls === 'VALVE' || canonical === 'VALVE') return 'valve';
  if (t === 'BEND' || t === 'ELBOW' || cls === 'ELBOW' || canonical === 'ELBOW') return 'elbow';
  if (t === 'TEE' || cls === 'TEE' || canonical === 'TEE') return 'tee';
  if (t === 'REDUCER' || cls === 'REDUCER' || canonical === 'REDUCER') return 'reducer';
  if (t === 'PIPE' || cls === 'PIPE' || canonical === 'PIPE') return 'pipe';
  return t.toLowerCase() || undefined;
}

function componentClass(record) {
  return String(value(attrs(record), 'COMPONENT_CLASS', 'CANONICAL_TYPE') || '').trim().toUpperCase();
}

function emptyGraph(options, warnings) {
  const sourceName = options.sourceName || 'managed-stage-json';
  const name = stripJsonSuffix(sourceName) || 'managed-stage-json';
  const graph = {
    schema: PLANT_MODEL_GRAPH_SCHEMA,
    id: name,
    project: { name, units: options.units || 'mm', axisBasis: { authoring: 'canvas-current', rvmExport: 'navis-review' } },
    catalogues: [{ ...CATALOGUE }],
    nodes: [],
    routes: [],
    items: [],
    sourceRefs: [{ sourceType: 'managed-stage-json', name: sourceName, phase: options.phase || 'Phase 2 shadow importer benchmark' }]
  };
  if (warnings?.length) graph.importWarnings = warnings;
  return graph;
}

function uniqueRouteId(base, routeIds, recordIdValue) {
  const cleanBase = base || `R-${recordIdValue}`;
  if (!routeIds.has(cleanBase)) {
    routeIds.add(cleanBase);
    return cleanBase;
  }
  let candidate = `${cleanBase}-${recordIdValue}`;
  let index = 2;
  while (routeIds.has(candidate)) candidate = `${cleanBase}-${recordIdValue}-${index++}`;
  routeIds.add(candidate);
  return candidate;
}

function units(source, options) {
  if (typeof source?.units === 'string') return source.units;
  if (typeof source?.units?.length === 'string') return source.units.length;
  return options.units || 'mm';
}

function attrs(record) { return record?.attributes && typeof record.attributes === 'object' ? record.attributes : record || {}; }
function normType(record) { return String(record?.type || record?.kind || record?.attributes?.TYPE || '').trim().toUpperCase(); }
function isSupport(record) { return SUPPORT_TYPES.has(normType(record)); }
function isComponent(record) { const t = normType(record); return Boolean(t && !CONTAINER_TYPES.has(t) && !isPipeRecord(record) && !isSupport(record) && (COMPONENT_TYPES.has(t) || value(attrs(record), 'CATALOGUE_FAMILY', 'CATALOG_FAMILY', 'COMPONENT_CLASS'))); }
function isUnsupported(record) { const t = normType(record); return Boolean(t && !CONTAINER_TYPES.has(t) && !isPipeRecord(record) && !isSupport(record) && !isComponent(record)); }
function recordId(record, fallback = 0) { return String(record?.id || record?.attributes?.SOURCE_ELEMENT_ID || record?.name || `REC-${fallback}`); }
function nodeId(raw) { const text = String(raw ?? '').trim(); return text ? (/^N[A-Za-z0-9_-]+$/.test(text) ? text : `N${text.replace(/[^A-Za-z0-9_-]/g, '')}`) : undefined; }
function point(raw) {
  if (Array.isArray(raw)) {
    const p = raw.slice(0, 3).map(Number);
    return p.length === 3 && p.every(Number.isFinite) ? p : null;
  }
  if (raw && typeof raw === 'object') {
    const p = [raw.x, raw.y, raw.z].map(Number);
    return p.length === 3 && p.every(Number.isFinite) ? p : null;
  }
  return null;
}
function placement(raw) { const p = point(raw); return p ? { position: p } : undefined; }
function addNode(nodes, nodeById, id, coord, sourceRef) { if (!id || nodeById.has(id)) return; const node = { id, coord: coord || [0, 0, 0], sourceRef }; nodeById.set(id, node); nodes.push(node); }
function compact(object) { return Object.fromEntries(Object.entries(object).filter(([, entry]) => entry !== undefined)); }
function value(object, ...keys) { for (const key of keys) { const found = Object.keys(object || {}).find((candidate) => candidate.toLowerCase() === key.toLowerCase()); if (found && object[found] !== undefined && object[found] !== null && object[found] !== '') return object[found]; } }
function parseJson(sourceText) { try { const value = typeof sourceText === 'string' ? JSON.parse(sourceText) : sourceText; return value && typeof value === 'object' ? { ok: true, value } : { ok: false, error: 'managed-stage JSON root must be an object' }; } catch (error) { return { ok: false, error: `managed-stage JSON parse failed: ${error.message}` }; } }
function stripJsonSuffix(name) { return String(name || '').replace(/\.input\.json$/i, '').replace(/\.fixture\.json$/i, '').replace(/\.json$/i, ''); }
function numberValue(raw) { const n = Number(raw); return Number.isFinite(n) ? n : undefined; }
function integerOr(raw, fallback) { const n = Number(raw); return Number.isInteger(n) ? n : fallback; }
