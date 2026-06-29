const BINDING_AUDIT_SCHEMA = 'CatalogueBindingAudit.v1';
const STATUS = Object.freeze({
  CATALOGUE_RESOLVED: 'catalogueResolved',
  PROCEDURAL_RESOLVED: 'proceduralResolved',
  FALLBACK_BLOCKED: 'fallbackBlocked',
  UNRESOLVED: 'unresolved',
  SUPPORT_INTENT: 'supportIntent'
});

export function bindPlantGraphToCatalogue(graph, catalogueItems = [], options = {}) {
  return auditCatalogueBinding(graph, catalogueItems, options).bindings;
}

export function auditCatalogueBinding(graph, catalogueItems = [], options = {}) {
  const items = Array.isArray(graph?.items) ? graph.items : [];
  const routesById = new Map((Array.isArray(graph?.routes) ? graph.routes : []).map((route) => [route.id, route]));
  const catalogueIndex = buildCatalogueIndex(catalogueItems);
  const bindings = items.map((item) => bindItem(item, routesById, catalogueIndex));

  return {
    schema: BINDING_AUDIT_SCHEMA,
    graphId: graph?.id || options.graphId || '<unknown-graph>',
    itemCount: items.length,
    catalogueResolvedCount: countStatus(bindings, STATUS.CATALOGUE_RESOLVED),
    proceduralResolvedCount: countStatus(bindings, STATUS.PROCEDURAL_RESOLVED),
    fallbackBlockedCount: countStatus(bindings, STATUS.FALLBACK_BLOCKED),
    unresolvedCount: countStatus(bindings, STATUS.UNRESOLVED),
    supportIntentCount: countStatus(bindings, STATUS.SUPPORT_INTENT),
    nearestMatchCount: 0,
    exportDecisionCount: 0,
    bindings
  };
}

function bindItem(item, routesById, catalogueIndex) {
  const base = {
    itemId: item?.id || '<missing-item-id>',
    itemKind: item?.kind || '<missing-kind>',
    sourceRef: item?.sourceRef
  };

  if (item?.kind === 'support') {
    return compact({
      ...base,
      status: STATUS.SUPPORT_INTENT,
      family: 'support',
      type: item.supportFamily,
      node: item.node || item?.placement?.node,
      reason: 'support intent is preserved for later support binding'
    });
  }

  if (isBlockedFallback(item)) {
    return compact({
      ...base,
      status: STATUS.FALLBACK_BLOCKED,
      family: item.family,
      type: item.type,
      reason: item?.fallback?.reason || item.reason || 'fallback policy blocks automatic binding'
    });
  }

  if (item?.kind === 'generated' && item.generator === 'straightPipe.v1') {
    const route = routesById.get(item.route);
    return compact({
      ...base,
      status: STATUS.PROCEDURAL_RESOLVED,
      family: 'pipe',
      type: 'straight',
      route: item.route,
      identityKey: identityKey({ family: 'pipe', type: 'straight', nps: route?.bore, schedule: route?.schedule }),
      resolver: 'straightPipe.v1',
      reason: 'deterministic procedural straight pipe generator'
    });
  }

  if (item?.kind === 'component') {
    const identity = componentIdentity(item);
    const match = findExactCatalogueItem(identity, catalogueIndex);
    if (match) {
      return compact({
        ...base,
        status: STATUS.CATALOGUE_RESOLVED,
        family: identity.family,
        type: identity.type,
        catalogueItemKey: match.key,
        reason: 'exact catalogue item match'
      });
    }
    return compact({
      ...base,
      status: STATUS.UNRESOLVED,
      family: identity.family,
      type: identity.type,
      route: item.route,
      identityKey: identityKey(identity),
      reason: 'no exact catalogue item'
    });
  }

  return compact({
    ...base,
    status: STATUS.UNRESOLVED,
    reason: 'unsupported item kind for catalogue binding audit'
  });
}

function buildCatalogueIndex(catalogueItems) {
  const exactKeys = new Map();
  for (const item of Array.isArray(catalogueItems) ? catalogueItems : []) {
    for (const key of itemIdentityKeys(item)) {
      if (!exactKeys.has(key)) exactKeys.set(key, { key, item });
    }
  }
  return exactKeys;
}

function findExactCatalogueItem(identity, catalogueIndex) {
  for (const key of itemIdentityKeys(identity)) {
    const match = catalogueIndex.get(key);
    if (match) return match;
  }
  return null;
}

function componentIdentity(item) {
  const ref = item.catalogueRef || {};
  const dimensions = item.dimensions || {};
  return {
    family: canonicalFamily(ref.family || item.family),
    type: canonicalType(ref.type || item.type),
    nps: ref.nps || item.nps,
    schedule: ref.schedule || item.schedule,
    diameterMm: dimensions.diameterMm || dimensions.odMm || item.diameterMm,
    wallMm: dimensions.wallMm || item.wallMm
  };
}

function itemIdentityKeys(item) {
  const family = canonicalFamily(item.family);
  const type = canonicalType(item.type);
  const dimensions = item.dimensions || {};
  const nps = item.nps;
  const schedule = item.schedule;
  const diameterMm = item.diameterMm || dimensions.diameterMm || dimensions.odMm;
  const wallMm = item.wallMm || dimensions.wallMm;
  const keys = [];
  if (family && type && nps && schedule) keys.push(identityKey({ family, type, nps, schedule }));
  if (family && type && diameterMm !== undefined && wallMm !== undefined) keys.push(identityKey({ family, type, diameterMm, wallMm }));
  return keys;
}

function identityKey(identity) {
  return [
    canonicalFamily(identity.family),
    canonicalType(identity.type),
    identity.nps ? `nps:${normalize(identity.nps)}` : '',
    identity.schedule ? `schedule:${normalize(identity.schedule)}` : '',
    identity.diameterMm !== undefined ? `diameterMm:${normalizeNumber(identity.diameterMm)}` : '',
    identity.wallMm !== undefined ? `wallMm:${normalizeNumber(identity.wallMm)}` : ''
  ].filter(Boolean).join('|');
}

function canonicalFamily(value) {
  const text = normalize(value);
  if (text === 'flan') return 'flange';
  if (text === 'valv') return 'valve';
  if (text === 'bend') return 'elbow';
  return text;
}

function canonicalType(value) {
  const text = normalize(value);
  if (text === 'flan') return 'flange';
  if (text === 'valv') return 'valve';
  if (text === 'bend') return 'bend';
  return text;
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(/"/g, '');
}

function normalizeNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return normalize(value);
  return String(Math.round(numeric * 1000) / 1000);
}

function isBlockedFallback(item) {
  return item?.fallback?.fallbackKind === 'blocked' || item?.fallbackKind === 'blocked' || item?.resolutionIntent === 'blocked';
}

function countStatus(bindings, status) {
  return bindings.filter((binding) => binding.status === status).length;
}

function compact(value) {
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined && entry !== null && entry !== '') out[key] = entry;
  }
  return out;
}
