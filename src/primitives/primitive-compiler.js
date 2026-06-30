import {
  collectResolvedPrimitiveForbiddenFieldHits,
  validateResolvedPrimitiveModelContract
} from '../contracts/resolved-primitive-model-contract.js';

const PRIMITIVE_MODEL_SCHEMA = 'ResolvedPrimitiveModel.v1';
const PRIMITIVE_AUDIT_SCHEMA = 'PrimitiveCompilationAudit.v1';

export function compileResolvedGeometryToPrimitives(resolvedGeometry, geometryAudit, options = {}) {
  const graphId = resolvedGeometry?.graphId || options.graphId || '<unknown-graph>';
  const items = [];
  const primitives = [];
  const blockedPrimitives = [];
  const deferredPrimitives = [];
  const canCompile = geometryAudit?.schema === 'GeometryResolutionAudit.v1' && geometryAudit.ok === true;

  for (const frame of Array.isArray(resolvedGeometry?.itemFrames) ? resolvedGeometry.itemFrames : []) {
    const mode = frame.geometryKind === 'bendArcFrame.v1' ? 'catalogue' : frame.geometryStatus === 'catalogueFrameResolved' ? 'deferred' : 'procedural';
    items.push(itemRecord(frame.itemId, mode, frame.sourceRef));
    if (!canCompile) continue;
    if (frame.geometryStatus === 'resolved' && frame.resolver === 'straightPipeGeometry.v1') {
      const radiusMm = deterministicRadius(frame);
      if (!Number.isFinite(radiusMm)) { deferredPrimitives.push(deferred(frame, 'missing pipe diameter/radius evidence')); continue; }
      primitives.push(straightPipeCylinder(frame, radiusMm));
      continue;
    }
    if (frame.geometryKind === 'bendArcFrame.v1' && frame.resolver === 'catalogueBackedBendArcGeometry.v1') {
      primitives.push(bendArcTorus(frame));
      continue;
    }
    if (frame.geometryStatus === 'catalogueFrameResolved') deferredPrimitives.push(deferred(frame, 'component primitive compiler not implemented in Phase 6'));
  }

  for (const support of Array.isArray(resolvedGeometry?.supportPlacements) ? resolvedGeometry.supportPlacements : []) {
    items.push(itemRecord(support.itemId, 'deferred', support.sourceRef));
    if (!canCompile) continue;
    deferredPrimitives.push({ sourceItemId: support.itemId, family: 'support', type: support.supportFamily, geometryStatus: 'deferred', reason: 'support primitive compiler not implemented in Phase 6', sourceRef: support.sourceRef });
  }

  for (const unresolved of Array.isArray(resolvedGeometry?.unresolvedGeometry) ? resolvedGeometry.unresolvedGeometry : []) {
    items.push(itemRecord(unresolved.itemId, 'blocked', unresolved.sourceRef));
    if (!canCompile) continue;
    blockedPrimitives.push({ sourceItemId: unresolved.itemId, family: unresolved.family, type: unresolved.type, geometryStatus: 'blocked', reason: unresolved.reason || 'unresolved geometry', sourceRef: unresolved.sourceRef });
  }

  return { schema: PRIMITIVE_MODEL_SCHEMA, graphId, sourceGraphId: graphId, sourceGeometryId: resolvedGeometry?.id || resolvedGeometry?.graphId || graphId, units: resolvedGeometry?.units || options.units || 'mm', axisBasis: { ...(resolvedGeometry?.axisBasis || {}), authoring: resolvedGeometry?.axisBasis?.authoring || options.authoringBasis || 'canvas-current' }, items, primitives, blockedPrimitives, deferredPrimitives, sourceRefs: Array.isArray(resolvedGeometry?.sourceRefs) ? resolvedGeometry.sourceRefs : [] };
}

export function buildPrimitiveCompilationAudit(resolvedGeometry, primitiveModel, geometryAudit, options = {}) {
  const validation = validateResolvedPrimitiveModelContract(primitiveModel, { expectedAuthoringBasis: resolvedGeometry?.axisBasis?.authoring });
  const forbiddenHits = collectResolvedPrimitiveForbiddenFieldHits(primitiveModel);
  const primitives = Array.isArray(primitiveModel?.primitives) ? primitiveModel.primitives : [];
  const deferredPrimitives = Array.isArray(primitiveModel?.deferredPrimitives) ? primitiveModel.deferredPrimitives : [];
  const blockedPrimitives = Array.isArray(primitiveModel?.blockedPrimitives) ? primitiveModel.blockedPrimitives : [];
  const errors = [...validation.errors];
  if (!geometryAudit || geometryAudit.schema !== 'GeometryResolutionAudit.v1') errors.push('GeometryResolutionAudit.v1 is required');
  if (geometryAudit?.ok !== true) errors.push('GeometryResolutionAudit.ok must be true before primitive compilation');
  const navisTransformApplied = forbiddenHits.some((hit) => ['navisTransform', 'exportTransform', 'rvmMatrix'].includes(hit.field));
  const writerCallCount = forbiddenHits.filter((hit) => ['binary', 'bytes', 'chunk', 'cntb', 'primBody'].includes(hit.field)).length;
  const exportDecisionCount = forbiddenHits.filter((hit) => ['attRecord', 'glbMesh', 'meshGeometry', 'threeGeometry', 'materialId'].includes(hit.field)).length;
  const missingDimensionCount = deferredPrimitives.filter((entry) => entry.reason === 'missing pipe diameter/radius evidence').length;
  if (missingDimensionCount > 0) errors.push('missing pipe diameter/radius evidence');
  const torusPrimitives = primitives.filter((entry) => entry.primitiveKind === 'TORUS' || entry.kind === 'TORUS');
  const audit = {
    schema: PRIMITIVE_AUDIT_SCHEMA,
    graphId: primitiveModel?.graphId || resolvedGeometry?.graphId || options.graphId || '<unknown-graph>',
    primitiveCount: primitives.length,
    cylinderPrimitiveCount: primitives.filter((entry) => entry.primitiveKind === 'CYLINDER' || entry.kind === 'CYLINDER').length,
    torusPrimitiveCount: torusPrimitives.length,
    bendTorusPrimitiveCount: torusPrimitives.filter((entry) => entry.resolver === 'bendArcTorusPrimitive.v1').length,
    boxPrimitiveCount: primitives.filter((entry) => entry.primitiveKind === 'BOX' || entry.kind === 'BOX').length,
    spherePrimitiveCount: primitives.filter((entry) => entry.primitiveKind === 'SPHERE' || entry.kind === 'SPHERE').length,
    pyramidPrimitiveCount: primitives.filter((entry) => entry.primitiveKind === 'PYRAMID' || entry.kind === 'PYRAMID').length,
    supportPrimitiveCount: primitives.filter((entry) => entry.family === 'support').length,
    deferredPrimitiveCount: deferredPrimitives.length,
    deferredSupportPrimitiveCount: deferredPrimitives.filter((entry) => entry.family === 'support').length,
    blockedPrimitiveCount: blockedPrimitives.length,
    blockedUnresolvedGeometryCount: blockedPrimitives.filter((entry) => entry.geometryStatus === 'blocked').length,
    blockedCatalogueFrameCount: deferredPrimitives.filter((entry) => entry.reason === 'component primitive compiler not implemented in Phase 6').length,
    blockedFlangePrimitiveCount: blockedPrimitives.filter((entry) => entry.family === 'flange').length,
    blockedValvePrimitiveCount: blockedPrimitives.filter((entry) => entry.family === 'valve').length,
    blockedBendPrimitiveCount: blockedPrimitives.filter((entry) => entry.family === 'elbow').length,
    chordMidpointTorusCenterCount: torusPrimitives.filter((entry) => entry.evidence?.centerSource === 'inputxml-chord-midpoint-not-arc-center').length,
    missingDimensionCount,
    hardErrorCount: errors.length,
    navisTransformApplied,
    writerCallCount,
    exportDecisionCount,
    ok: false,
    errors
  };
  if (audit.chordMidpointTorusCenterCount > 0) errors.push('chord midpoint was used as torus center');
  audit.hardErrorCount = errors.length;
  audit.ok = validation.ok && audit.hardErrorCount === 0 && audit.navisTransformApplied === false && audit.writerCallCount === 0 && audit.exportDecisionCount === 0 && audit.chordMidpointTorusCenterCount === 0;
  return audit;
}

function itemRecord(id, resolutionMode, sourceRef) { return { id, sourceGraphItemId: id, resolutionMode, sourceRef }; }

function straightPipeCylinder(frame, radiusMm) {
  return { primitiveId: `PRIM-${frame.itemId}`, sourceItemId: frame.itemId, sourceRouteId: frame.routeId, primitiveKind: 'CYLINDER', primitiveCode: 8, center: [...frame.center], axis: [...frame.axis], lengthMm: Number(frame.lengthMm), radiusMm, basis: 'authoring', resolver: 'straightPipeCylinderPrimitive.v1', geometryStatus: 'primitiveResolved', sourceRef: frame.sourceRef };
}

function bendArcTorus(frame) {
  return { primitiveId: `PRIM-${frame.itemId}`, sourceItemId: frame.itemId, sourceRouteId: frame.routeId, primitiveKind: 'TORUS', primitiveCode: 4, center: [...frame.center], normal: [...frame.normal], startTangent: [...frame.startTangent], endTangent: [...frame.endTangent], majorRadiusMm: Number(frame.majorRadiusMm), tubeRadiusMm: Number(frame.tubeRadiusMm), bendAngleDeg: Number(frame.bendAngleDeg), sweepAngleDeg: Number(frame.sweepAngleDeg), basis: 'authoring', resolver: 'bendArcTorusPrimitive.v1', geometryStatus: 'primitiveResolved', family: 'elbow', type: frame.type || 'bend', catalogueItemId: frame.catalogueItemId, catalogueRef: frame.catalogueRef, sourceRef: frame.sourceRef, evidence: { ...frame.evidence } };
}

function deferred(frame, reason) { return { sourceItemId: frame.itemId, family: frame.family, type: frame.type, geometryStatus: 'deferred', reason, sourceRef: frame.sourceRef }; }
function deterministicRadius(frame) { const radius = Number(frame?.radiusMm); if (Number.isFinite(radius) && radius > 0) return radius; const diameter = Number(frame?.diameterMm); if (Number.isFinite(diameter) && diameter > 0) return diameter / 2; return undefined; }
