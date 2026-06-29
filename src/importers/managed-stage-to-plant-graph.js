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
const COMPONENT_TYPES = new Set(['ELBOW', 'BEND', 'TEE', 'OLET', 'FLANGE', 'VALVE', 'REDUCER', 'COUPLING', 'CAP', 'BLIND', 'GASKET', 'WELD']);

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

  for (const entry of records) {
    const record = entry.record;
    if (!isRoute(record)) continue;
    const a = attrs(record);
    const from = nodeId(value(a, 'FROM_NODE', 'FROM', 'START_NODE'));
    const to = nodeId(value(a, 'TO_NODE', 'TO', 'END_NODE'));
    if (!from || !to) continue;
    const id = recordId(record, routes.length + 1);
    addNode(nodes, nodeById, from, point(value(a, 'APOS', 'START_POS', 'FROM_POS', 'POS')), `${id}.FROM_NODE`);
    addNode(nodes, nodeById, to, point(value(a, 'LPOS', 'END_POS', 'TO_POS')), `${id}.TO_NODE`);
    const routeId = `R-${from}-${to}`;
    routes.push(compact({
      id: routeId,
      lineNo: value(a, 'LINE_NO', 'LINE_NUMBER', 'LINE', 'BRANCHNAME') || entry.context.lineNo,
      from,
      to,
      bore: value(a, 'NPS', 'BORE', 'DIAMETER', 'NOMINAL_SIZE'),
      schedule: value(a, 'SCHEDULE', 'SCH', 'WALL_THICK'),
      material: value(a, 'MATERIAL', 'MATL', 'MAT') || entry.context.material,
      sourceRef: id
    }));
    routeByEndpoint.set(`${from}->${to}`, routeId);
  }

  const items = [];
  for (const entry of records) {
    const record = entry.record;
    const a = attrs(record);
    const id = recordId(record, items.length + 1);
    if (isRoute(record)) {
      const from = nodeId(value(a, 'FROM_NODE', 'FROM', 'START_NODE'));
      const to = nodeId(value(a, 'TO_NODE', 'TO', 'END_NODE'));
      const route = routeByEndpoint.get(`${from}->${to}`);
      if (route) items.push({ id, kind: 'generated', generator: 'straightPipe.v1', route, sourceRef: id });
    } else if (isSupport(record)) {
      items.push(compact({
        id,
        kind: 'support',
        tagged: false,
        node: nodeId(value(a, 'NODE', 'AT_NODE')),
        supportFamily: value(a, 'SUPPORT_KIND', 'SUPPORT_FAMILY', 'RESTRAINT', 'TYPE'),
        axis: value(a, 'SUPPORT_AXIS', 'AXIS', 'DIRECTION'),
        source: value(a, 'SOURCE', 'SOURCE_FORMAT'),
        placement: placement(value(a, 'POS', 'POSITION', 'APOS')),
        sourceRef: id
      }));
    } else if (isComponent(record)) {
      items.push(componentItem(record, a, id, routes));
    }
  }

  const graph = {
    schema: PLANT_MODEL_GRAPH_SCHEMA,
    id: graphId,
    project: {
      name: source.source || graphId,
      units: source.units || options.units || 'mm',
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
  const unsupportedRecords = parsed.ok
    ? collectRecords(parsed.value).filter((entry) => isUnsupported(entry.record)).map((entry) => ({
      id: recordId(entry.record),
      name: entry.record?.name,
      type: entry.record?.type || entry.record?.kind || 'UNKNOWN'
    }))
    : [];
  const items = Array.isArray(graph?.items) ? graph.items : [];
  return {
    schema: AUDIT_SCHEMA,
    sourceName: options.sourceName || parsed.value?.source || 'managed-stage-json',
    parsed: parsed.ok,
    nodeCount: Array.isArray(graph?.nodes) ? graph.nodes.length : 0,
    routeCount: Array.isArray(graph?.routes) ? graph.routes.length : 0,
    itemCount: items.length,
    supportItemCount: items.filter((item) => item.kind === 'support').length,
    componentItemCount: items.filter((item) => item.kind === 'component').length,
    generatedItemCount: items.filter((item) => item.kind === 'generated').length,
    taggedItemCount: items.filter((item) => item.tagged === true).length,
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

function componentItem(record, a, id, routes) {
  const node = nodeId(value(a, 'NODE', 'AT_NODE', 'FROM_NODE', 'TO_NODE'));
  const family = value(a, 'CATALOGUE_FAMILY', 'CATALOG_FAMILY', 'FAMILY');
  const type = value(a, 'CATALOGUE_TYPE', 'CATALOG_TYPE', 'COMPONENT_TYPE') || normType(record);
  const item = family && type ? {
    id,
    kind: 'component',
    tagged: true,
    catalogueRef: compact({
      catalogue: CATALOGUE.id,
      family,
      type,
      nps: value(a, 'NPS', 'BORE', 'DIAMETER', 'NOMINAL_SIZE'),
      schedule: value(a, 'SCHEDULE', 'SCH', 'WALL_THICK')
    }),
    placement: componentPlacement(node, routes),
    sourceRef: id
  } : {
    id,
    kind: 'generated',
    generator: `${normType(record).toLowerCase() || 'component'}Placeholder.v1`,
    tagged: false,
    placement: componentPlacement(node, routes),
    sourceRef: id
  };
  return compact(item);
}

function componentPlacement(node, routes) {
  const out = {};
  if (node) out.node = node;
  const inRoute = routes.find((route) => route.to === node)?.id;
  const outRoute = routes.find((route) => route.from === node)?.id;
  if (inRoute) out.inRoute = inRoute;
  if (outRoute) out.outRoute = outRoute;
  return Object.keys(out).length ? out : undefined;
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

function attrs(record) { return record?.attributes && typeof record.attributes === 'object' ? record.attributes : record || {}; }
function normType(record) { return String(record?.type || record?.kind || record?.attributes?.TYPE || '').trim().toUpperCase(); }
function isRoute(record) { const a = attrs(record); return ROUTE_TYPES.has(normType(record)) && value(a, 'FROM_NODE', 'FROM', 'START_NODE') && value(a, 'TO_NODE', 'TO', 'END_NODE'); }
function isSupport(record) { return SUPPORT_TYPES.has(normType(record)); }
function isComponent(record) { const t = normType(record); return Boolean(t && !CONTAINER_TYPES.has(t) && (COMPONENT_TYPES.has(t) || value(attrs(record), 'CATALOGUE_FAMILY', 'CATALOG_FAMILY', 'COMPONENT_CLASS'))); }
function isUnsupported(record) { const t = normType(record); return Boolean(t && !CONTAINER_TYPES.has(t) && !isRoute(record) && !isSupport(record) && !isComponent(record)); }
function recordId(record, fallback = 0) { return String(record?.id || record?.attributes?.SOURCE_ELEMENT_ID || record?.name || `REC-${fallback}`); }
function nodeId(raw) { const text = String(raw ?? '').trim(); return text ? (/^N[A-Za-z0-9_-]+$/.test(text) ? text : `N${text.replace(/[^A-Za-z0-9_-]/g, '')}`) : undefined; }
function point(raw) { const p = Array.isArray(raw) ? raw.slice(0, 3).map(Number) : []; return p.length === 3 && p.every(Number.isFinite) ? p : null; }
function placement(raw) { const p = point(raw); return p ? { position: p } : undefined; }
function addNode(nodes, nodeById, id, coord, sourceRef) { if (!id || nodeById.has(id)) return; const node = { id, coord: coord || [0, 0, 0], sourceRef }; nodeById.set(id, node); nodes.push(node); }
function compact(object) { return Object.fromEntries(Object.entries(object).filter(([, entry]) => entry !== undefined)); }
function value(object, ...keys) { for (const key of keys) { const found = Object.keys(object || {}).find((candidate) => candidate.toLowerCase() === key.toLowerCase()); if (found && object[found] !== undefined && object[found] !== null && object[found] !== '') return object[found]; } }
function parseJson(sourceText) { try { const value = typeof sourceText === 'string' ? JSON.parse(sourceText) : sourceText; return value && typeof value === 'object' ? { ok: true, value } : { ok: false, error: 'managed-stage JSON root must be an object' }; } catch (error) { return { ok: false, error: `managed-stage JSON parse failed: ${error.message}` }; } }
function stripJsonSuffix(name) { return String(name || '').replace(/\.input\.json$/i, '').replace(/\.fixture\.json$/i, '').replace(/\.json$/i, ''); }
