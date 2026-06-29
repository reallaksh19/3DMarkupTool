const TOPOLOGY_AUDIT_SCHEMA = 'PlantGraphTopologyAudit.v1';

export function auditPlantGraphTopology(graph, options = {}) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const routes = Array.isArray(graph?.routes) ? graph.routes : [];
  const items = Array.isArray(graph?.items) ? graph.items : [];

  const nodeIds = nodes.map((node) => stringId(node?.id)).filter(Boolean);
  const routeIds = routes.map((route) => stringId(route?.id)).filter(Boolean);
  const itemIds = items.map((item) => stringId(item?.id)).filter(Boolean);
  const nodeSet = new Set(nodeIds);
  const routeSet = new Set(routeIds);

  const missingRouteNodeRefs = [];
  const routeNodeDegree = new Map();
  for (const route of routes) {
    const routeId = stringId(route?.id) || '<missing-route-id>';
    for (const field of ['from', 'to']) {
      const nodeId = stringId(route?.[field]);
      if (!nodeId || !nodeSet.has(nodeId)) {
        missingRouteNodeRefs.push({ routeId, field, nodeId: nodeId || '<missing-node-ref>' });
      } else {
        routeNodeDegree.set(nodeId, (routeNodeDegree.get(nodeId) || 0) + 1);
      }
    }
  }

  const missingItemNodeRefs = [];
  const missingItemRouteRefs = [];
  const supportNodeIds = new Set();

  for (const item of items) {
    const itemId = stringId(item?.id) || '<missing-item-id>';
    for (const entry of itemNodeRefs(item)) {
      if (!nodeSet.has(entry.nodeId)) missingItemNodeRefs.push({ itemId, field: entry.field, nodeId: entry.nodeId });
    }
    for (const entry of itemRouteRefs(item)) {
      if (!routeSet.has(entry.routeId)) missingItemRouteRefs.push({ itemId, field: entry.field, routeId: entry.routeId });
    }
    if (item?.kind === 'support') {
      const supportNodeId = stringId(item.node || item?.placement?.node);
      if (supportNodeId && nodeSet.has(supportNodeId)) supportNodeIds.add(supportNodeId);
    }
  }

  const duplicateNodeIds = duplicates(nodeIds);
  const duplicateRouteIds = duplicates(routeIds);
  const duplicateItemIds = duplicates(itemIds);
  const openRouteEnds = [...routeNodeDegree.entries()]
    .filter(([, degree]) => degree === 1)
    .map(([nodeId]) => nodeId)
    .sort(compareStable);
  const branchNodeIds = [...routeNodeDegree.entries()]
    .filter(([, degree]) => degree > 2)
    .map(([nodeId]) => nodeId)
    .sort(compareStable);

  const audit = {
    schema: TOPOLOGY_AUDIT_SCHEMA,
    graphId: graph?.id || options.graphId || '<unknown-graph>',
    nodeCount: nodes.length,
    routeCount: routes.length,
    itemCount: items.length,
    missingRouteNodeRefs: sortObjects(missingRouteNodeRefs, ['routeId', 'field', 'nodeId']),
    missingItemNodeRefs: sortObjects(missingItemNodeRefs, ['itemId', 'field', 'nodeId']),
    missingItemRouteRefs: sortObjects(missingItemRouteRefs, ['itemId', 'field', 'routeId']),
    duplicateNodeIds,
    duplicateRouteIds,
    duplicateItemIds,
    openRouteEnds,
    branchNodeIds,
    supportNodeIds: [...supportNodeIds].sort(compareStable),
    ok: true
  };

  audit.ok = audit.missingRouteNodeRefs.length === 0
    && audit.missingItemNodeRefs.length === 0
    && audit.missingItemRouteRefs.length === 0
    && audit.duplicateNodeIds.length === 0
    && audit.duplicateRouteIds.length === 0
    && audit.duplicateItemIds.length === 0;

  return audit;
}

export function assertPlantGraphTopologyAudit(audit, expectations = {}) {
  const errors = [];
  if (!audit || typeof audit !== 'object') errors.push('audit must be an object');
  if (audit?.schema !== TOPOLOGY_AUDIT_SCHEMA) errors.push(`schema must be ${TOPOLOGY_AUDIT_SCHEMA}`);
  for (const key of [
    'missingRouteNodeRefs',
    'missingItemNodeRefs',
    'missingItemRouteRefs',
    'duplicateNodeIds',
    'duplicateRouteIds',
    'duplicateItemIds',
    'openRouteEnds',
    'branchNodeIds',
    'supportNodeIds'
  ]) {
    if (!Array.isArray(audit?.[key])) errors.push(`${key} must be an array`);
  }
  for (const key of ['nodeCount', 'routeCount', 'itemCount']) {
    if (!Number.isInteger(Number(audit?.[key]))) errors.push(`${key} must be integer-like`);
  }
  if (typeof audit?.ok !== 'boolean') errors.push('ok must be boolean');
  for (const [key, expected] of Object.entries(expectations)) {
    if (JSON.stringify(audit?.[key]) !== JSON.stringify(expected)) errors.push(`${key} expectation failed`);
  }
  if (errors.length) throw new Error(`PlantGraph topology audit invalid: ${errors.join('; ')}`);
  return { schema: 'PlantGraphTopologyAuditAssertion.v1', ok: true, errorCount: 0, errors: [] };
}

function itemNodeRefs(item) {
  const refs = [];
  const topNode = stringId(item?.node);
  if (topNode) refs.push({ field: 'node', nodeId: topNode });
  const placementNode = stringId(item?.placement?.node);
  if (placementNode) refs.push({ field: 'placement.node', nodeId: placementNode });
  return refs;
}

function itemRouteRefs(item) {
  const refs = [];
  const route = stringId(item?.route);
  if (route) refs.push({ field: 'route', routeId: route });
  const inRoute = stringId(item?.placement?.inRoute);
  if (inRoute) refs.push({ field: 'placement.inRoute', routeId: inRoute });
  const outRoute = stringId(item?.placement?.outRoute);
  if (outRoute) refs.push({ field: 'placement.outRoute', routeId: outRoute });
  return refs;
}

function duplicates(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort(compareStable);
}

function sortObjects(values, keys) {
  return [...values].sort((a, b) => {
    for (const key of keys) {
      const result = compareStable(a[key], b[key]);
      if (result !== 0) return result;
    }
    return 0;
  });
}

function compareStable(a, b) {
  return String(a).localeCompare(String(b), 'en', { numeric: true });
}

function stringId(value) {
  const text = String(value ?? '').trim();
  return text || '';
}
