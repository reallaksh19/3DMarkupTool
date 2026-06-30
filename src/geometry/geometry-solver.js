import {
  collectForbiddenFieldHits,
  validateResolvedGeometryModelContract
} from '../contracts/index.js';

const RESOLVED_GEOMETRY_SCHEMA = 'ResolvedGeometryModel.v1';
const GEOMETRY_AUDIT_SCHEMA = 'GeometryResolutionAudit.v1';
const VECTOR_EPSILON = 1e-6;

export function resolvePlantGraphGeometry(graph, bindingAudit, options = {}) {
  const nodesById = new Map((Array.isArray(graph?.nodes) ? graph.nodes : []).map((node) => [String(node.id), node]));
  const routes = Array.isArray(graph?.routes) ? graph.routes : [];
  const items = Array.isArray(graph?.items) ? graph.items : [];
  const bindingByItemId = new Map((Array.isArray(bindingAudit?.bindings) ? bindingAudit.bindings : []).map((binding) => [String(binding.itemId), binding]));

  const routeFrames = routes.map((route) => routeFrame(route, nodesById));
  const routeFrameById = new Map(routeFrames.map((frame) => [frame.routeId, frame]));
  const itemFrames = [];
  const supportPlacements = [];
  const unresolvedGeometry = [];

  for (const item of items) {
    const binding = bindingByItemId.get(String(item.id));
    if (item.kind === 'generated' && item.generator === 'straightPipe.v1' && binding?.status === 'proceduralResolved') {
      const frame = routeFrameById.get(item.route);
      if (frame && frame.geometryStatus !== 'invalid') itemFrames.push(straightPipeFrame(item, frame));
      continue;
    }
    if (item.kind === 'support') {
      supportPlacements.push(supportPlacement(item, nodesById));
      continue;
    }
    if (binding?.status === 'catalogueResolved' && binding.family === 'elbow') {
      const bend = bendArcFrame(item, binding, nodesById, routeFrameById);
      if (bend.geometryStatus === 'resolved') itemFrames.push(bend);
      else unresolvedGeometry.push(bend);
      continue;
    }
    if (binding?.status === 'catalogueResolved') {
      itemFrames.push(catalogueComponentFrame(item, binding, nodesById, routeFrameById));
      continue;
    }
    if (item.kind === 'component') unresolvedGeometry.push(blockedGeometry(item, binding));
  }

  return {
    schema: RESOLVED_GEOMETRY_SCHEMA,
    graphId: graph?.id || options.graphId || '<unknown-graph>',
    units: graph?.project?.units || options.units || 'mm',
    axisBasis: { ...(graph?.project?.axisBasis || {}), authoring: graph?.project?.axisBasis?.authoring || options.authoringBasis || 'canvas-current' },
    nodes: (Array.isArray(graph?.nodes) ? graph.nodes : []).map((node) => ({ id: node.id, coord: [...node.coord], sourceRef: node.sourceRef })).map(compact),
    routeFrames,
    itemFrames,
    supportPlacements,
    unresolvedGeometry,
    sourceRefs: Array.isArray(graph?.sourceRefs) ? graph.sourceRefs : []
  };
}

export function buildGeometryResolutionAudit(graph, resolvedGeometry, bindingAudit, options = {}) {
  const validation = validateResolvedGeometryModelContract(resolvedGeometry, { expectedAuthoringBasis: graph?.project?.axisBasis?.authoring });
  const forbiddenHits = collectForbiddenFieldHits(resolvedGeometry);
  const primitiveCodeCount = forbiddenHits.filter((hit) => hit.field === 'primitiveCode' || hit.field === 'rvmCode').length;
  const navisTransformApplied = forbiddenHits.some((hit) => hit.field === 'navisTransform' || hit.field === 'exportTransform' || hit.field === 'rvmMatrix');
  const exportDecisionCount = forbiddenHits.filter((hit) => ['materialId', 'glbMesh', 'meshGeometry', 'attRecord'].includes(hit.field)).length;
  const routeFrameErrors = collectRouteFrameErrors(graph, resolvedGeometry);
  const errors = [...validation.errors, ...routeFrameErrors];
  if (!bindingAudit || bindingAudit.schema !== 'CatalogueBindingAudit.v1') errors.push('CatalogueBindingAudit.v1 is required');
  if (bindingAudit?.nearestMatchCount !== 0) errors.push('nearest-match binding audit is not allowed for geometry resolution');
  if (bindingAudit?.exportDecisionCount !== 0) errors.push('export decisions are not allowed before geometry resolution');

  const itemFrames = Array.isArray(resolvedGeometry?.itemFrames) ? resolvedGeometry.itemFrames : [];
  const unresolved = Array.isArray(resolvedGeometry?.unresolvedGeometry) ? resolvedGeometry.unresolvedGeometry : [];
  const bendFrames = itemFrames.filter((frame) => frame.geometryKind === 'bendArcFrame.v1');
  const audit = {
    schema: GEOMETRY_AUDIT_SCHEMA,
    graphId: resolvedGeometry?.graphId || graph?.id || options.graphId || '<unknown-graph>',
    routeFrameCount: Array.isArray(resolvedGeometry?.routeFrames) ? resolvedGeometry.routeFrames.length : 0,
    itemFrameCount: itemFrames.filter((frame) => frame.resolver === 'straightPipeGeometry.v1').length,
    supportPlacementCount: Array.isArray(resolvedGeometry?.supportPlacements) ? resolvedGeometry.supportPlacements.length : 0,
    unresolvedGeometryCount: unresolved.length,
    resolvedStraightPipeCount: itemFrames.filter((frame) => frame.resolver === 'straightPipeGeometry.v1').length,
    resolvedBendArcCount: bendFrames.length,
    catalogueFrameResolvedCount: itemFrames.filter((frame) => frame.geometryStatus === 'catalogueFrameResolved').length,
    blockedUnresolvedComponentCount: unresolved.filter((entry) => entry.geometryStatus === 'blocked').length,
    blockedBendGeometryCount: unresolved.filter((entry) => entry.family === 'elbow').length,
    missingBendCatalogueCount: (Array.isArray(bindingAudit?.bindings) ? bindingAudit.bindings : []).filter((entry) => entry.family === 'elbow' && entry.status === 'unresolved').length,
    missingBendTangentEvidenceCount: unresolved.filter((entry) => entry.reason === 'missing deterministic bend tangent/arc evidence').length,
    ambiguousBendPlaneCount: unresolved.filter((entry) => entry.reason === 'ambiguous bend plane evidence').length,
    chordMidpointTorusCenterCount: bendFrames.filter((frame) => frame.evidence?.centerSource === 'inputxml-chord-midpoint-not-arc-center').length,
    hardErrorCount: errors.length,
    navisTransformApplied,
    primitiveCodeCount,
    exportDecisionCount,
    writerCallCount: 0,
    ok: false,
    errors
  };
  if (audit.chordMidpointTorusCenterCount > 0) errors.push('chord midpoint was used as bend torus center');
  audit.hardErrorCount = errors.length;
  audit.ok = validation.ok
    && audit.hardErrorCount === 0
    && audit.navisTransformApplied === false
    && audit.primitiveCodeCount === 0
    && audit.exportDecisionCount === 0
    && audit.writerCallCount === 0
    && audit.chordMidpointTorusCenterCount === 0;
  return audit;
}

function routeFrame(route, nodesById) {
  const fromNode = String(route.from);
  const toNode = String(route.to);
  const start = pointOrNull(nodesById.get(fromNode)?.coord);
  const end = pointOrNull(nodesById.get(toNode)?.coord);
  const vector = start && end ? subtract(end, start) : null;
  const lengthMm = vector ? magnitude(vector) : undefined;
  const diameterMm = numberValue(route.diameterMm ?? route.diameter ?? route.bore);
  const wallMm = numberValue(route.wallMm ?? route.wall ?? route.schedule);
  const errors = [];
  if (!nodesById.has(fromNode)) errors.push(`route ${route.id} references missing from node ${fromNode}`);
  if (!nodesById.has(toNode)) errors.push(`route ${route.id} references missing to node ${toNode}`);
  if (nodesById.has(fromNode) && !start) errors.push(`route ${route.id} has invalid from-node coordinates`);
  if (nodesById.has(toNode) && !end) errors.push(`route ${route.id} has invalid to-node coordinates`);
  if (start && end && lengthMm === 0) errors.push(`route ${route.id} has zero length`);
  return compact({ routeId: route.id, fromNode, toNode, start, end, direction: vector && lengthMm > 0 ? vector.map((entry) => entry / lengthMm) : undefined, lengthMm: Number.isFinite(Number(lengthMm)) ? lengthMm : undefined, diameterMm, radiusMm: Number.isFinite(Number(diameterMm)) ? Number(diameterMm) / 2 : undefined, wallMm, sourceRef: route.sourceRef, topologyRole: route.topologyRole, geometryStatus: errors.length ? 'invalid' : undefined, errors: errors.length ? errors : undefined });
}

function straightPipeFrame(item, frame) {
  return compact({ itemId: item.id, routeId: item.route, center: midpoint(frame.start, frame.end), axis: [...frame.direction], lengthMm: frame.lengthMm, diameterMm: frame.diameterMm, radiusMm: frame.radiusMm, wallMm: frame.wallMm, geometryStatus: 'resolved', resolver: 'straightPipeGeometry.v1', sourceRef: item.sourceRef });
}

function bendArcFrame(item, binding, nodesById) {
  const evidence = item.bendEvidence || {};
  const startPoint = pointOrNull(evidence.startPosition) || pointOrNull(nodesById.get(String(evidence.fromNode || item?.placement?.fromNode))?.coord);
  const endPoint = pointOrNull(evidence.endPosition) || pointOrNull(nodesById.get(String(evidence.toNode || item?.placement?.toNode))?.coord);
  const center = pointOrNull(evidence.arcCenter);
  const normal = normalizedOrNull(evidence.normal);
  const startTangent = normalizedOrNull(evidence.startTangent);
  const endTangent = normalizedOrNull(evidence.endTangent);
  const majorRadiusMm = numberValue(evidence.bendRadiusMm);
  const bendAngleDeg = numberValue(evidence.bendAngleDeg);
  const tubeRadiusMm = numberValue(evidence.diameterMm) / 2;
  if (!startPoint || !endPoint || !center || !normal || !startTangent || !endTangent || !finitePositive(majorRadiusMm) || !finitePositive(tubeRadiusMm) || !finitePositive(bendAngleDeg)) {
    return compact({ itemId: item.id, routeId: item.route, family: 'elbow', type: binding.type || item.type, geometryStatus: 'blocked', reason: 'missing deterministic bend tangent/arc evidence', sourceRef: item.sourceRef });
  }
  if (evidence.centerEstimateSource === 'inputxml-chord-midpoint-not-arc-center' && samePoint(center, evidence.centerEstimate)) {
    return compact({ itemId: item.id, routeId: item.route, family: 'elbow', type: binding.type || item.type, geometryStatus: 'blocked', reason: 'chord midpoint cannot be used as bend torus center', sourceRef: item.sourceRef });
  }
  return compact({
    frameId: `BEND-FRAME-${item.id}`,
    itemId: item.id,
    routeId: item.route,
    family: 'elbow',
    type: binding.type || item.type,
    geometryKind: 'bendArcFrame.v1',
    geometryStatus: 'resolved',
    resolver: 'catalogueBackedBendArcGeometry.v1',
    basis: 'authoring',
    startPoint,
    endPoint,
    center,
    normal,
    startTangent,
    endTangent,
    bendAngleDeg,
    sweepAngleDeg: bendAngleDeg,
    majorRadiusMm,
    tubeRadiusMm,
    catalogueItemId: binding.catalogueItemId,
    catalogueRef: binding.catalogueRef || binding.catalogueItemKey,
    sourceRef: item.sourceRef,
    evidence: {
      arcCenterSource: 'explicit-bend-arc-center',
      centerSource: 'explicit-bend-arc-center',
      normalSource: 'explicit-bend-plane-normal',
      tangentSource: 'explicit-bend-tangents',
      rejectedCenterEstimateSource: evidence.centerEstimateSource,
      chordMidpointRejected: evidence.centerEstimateSource === 'inputxml-chord-midpoint-not-arc-center'
    }
  });
}

function supportPlacement(item, nodesById) {
  const node = item.node || item?.placement?.node;
  const nodePosition = node ? nodesById.get(String(node))?.coord : null;
  const placementPosition = pointOrNull(item?.placement?.position);
  return compact({ itemId: item.id, node, position: point(nodePosition || placementPosition || [0, 0, 0]), axis: item.axis || '+Y', supportFamily: item.supportFamily, geometryStatus: 'intentOnly', resolver: 'supportPlacementIntent.v1', sourceRef: item.sourceRef });
}

function catalogueComponentFrame(item, binding, nodesById, routeFrameById) {
  const placement = item.placement || {};
  const routeFrame = item.route ? routeFrameById.get(item.route) : null;
  const nodePosition = placement.node ? nodesById.get(String(placement.node))?.coord : null;
  const fromPosition = placement.fromNode ? nodesById.get(String(placement.fromNode))?.coord : null;
  const toPosition = placement.toNode ? nodesById.get(String(placement.toNode))?.coord : null;
  const position = pointOrNull(placement.position) || (fromPosition && toPosition ? midpoint(fromPosition, toPosition) : null) || nodePosition || (routeFrame?.geometryStatus !== 'invalid' ? midpoint(routeFrame.start, routeFrame.end) : null) || [0, 0, 0];
  const axis = routeFrame?.geometryStatus !== 'invalid' ? routeFrame?.direction : undefined;
  return compact({ itemId: item.id, routeId: item.route, position: point(position), axis: axis || (fromPosition && toPosition ? unit(subtract(toPosition, fromPosition)) : [1, 0, 0]), family: binding.family, type: binding.type, catalogueItemKey: binding.catalogueItemKey, geometryStatus: 'catalogueFrameResolved', resolver: 'catalogueComponentFrame.v1', sourceRef: item.sourceRef });
}

function blockedGeometry(item, binding = {}) {
  return compact({ itemId: item.id, family: binding.family || item.family || item.catalogueRef?.family, type: binding.type || item.type || item.catalogueRef?.type, geometryStatus: 'blocked', reason: binding.reason || 'no exact catalogue item', sourceRef: item.sourceRef });
}

function collectRouteFrameErrors(graph, resolvedGeometry) {
  const framesById = new Map((Array.isArray(resolvedGeometry?.routeFrames) ? resolvedGeometry.routeFrames : []).map((frame) => [String(frame.routeId), frame]));
  const errors = [];
  for (const route of Array.isArray(graph?.routes) ? graph.routes : []) {
    const frame = framesById.get(String(route.id));
    if (!frame) { errors.push(`route ${route.id} has no route frame`); continue; }
    if (Array.isArray(frame.errors)) errors.push(...frame.errors);
    if (!pointOrNull(frame.start)) errors.push(`route ${route.id} frame start is invalid`);
    if (!pointOrNull(frame.end)) errors.push(`route ${route.id} frame end is invalid`);
    if (!pointOrNull(frame.direction)) errors.push(`route ${route.id} frame direction is invalid`);
    if (!Number.isFinite(Number(frame.lengthMm))) errors.push(`route ${route.id} frame length is invalid`);
    if (Number(frame.lengthMm) === 0) errors.push(`route ${route.id} frame length is zero`);
  }
  return errors;
}

function point(value) { return Array.isArray(value) && value.length === 3 ? value.map(Number) : [0, 0, 0]; }
function pointOrNull(value) { return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry))) ? value.map(Number) : null; }
function numberValue(value) { if (value === undefined || value === null || value === '') return undefined; const number = Number(value); return Number.isFinite(number) ? number : undefined; }
function finitePositive(value) { return Number.isFinite(Number(value)) && Number(value) > 0; }
function subtract(a, b) { return [Number(a[0]) - Number(b[0]), Number(a[1]) - Number(b[1]), Number(a[2]) - Number(b[2])]; }
function midpoint(a, b) { return [(Number(a[0]) + Number(b[0])) / 2, (Number(a[1]) + Number(b[1])) / 2, (Number(a[2]) + Number(b[2])) / 2]; }
function magnitude(vector) { return Math.hypot(Number(vector[0]), Number(vector[1]), Number(vector[2])); }
function unit(vector) { const length = magnitude(vector); return length > 0 ? vector.map((entry) => entry / length) : [0, 0, 0]; }
function normalizedOrNull(value) { const p = pointOrNull(value); if (!p) return null; const length = magnitude(p); if (!Number.isFinite(length) || length <= 0) return null; const out = p.map((entry) => entry / length); return Math.abs(magnitude(out) - 1) <= VECTOR_EPSILON ? out : null; }
function samePoint(a, b) { return pointOrNull(a) && pointOrNull(b) && pointOrNull(a).every((entry, index) => Math.abs(Number(entry) - Number(pointOrNull(b)[index])) <= VECTOR_EPSILON); }
function compact(value) { if (!value || typeof value !== 'object') return value; const out = {}; for (const [key, entry] of Object.entries(value)) if (entry !== undefined && entry !== null && entry !== '') out[key] = entry; return out; }
