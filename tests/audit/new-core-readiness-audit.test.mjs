import assert from 'node:assert/strict';
import {
  assertNewCoreReadinessAudit,
  CONTRACT_SCHEMA_SET,
  validateNewCoreReadinessAudit
} from '../../src/contracts/index.js';
import { buildNewCoreReadinessAudit } from '../../src/export-models/new-core-readiness-audit.js';

const input = buildFixture();
const audit = buildNewCoreReadinessAudit(input, { sourceName: 'new-core-readiness-fixture.managed-stage.json' });

assert.equal(CONTRACT_SCHEMA_SET.newCoreReadinessAudit, 'NewCoreReadinessAudit.v1');
assert.equal(audit.schema, 'NewCoreReadinessAudit.v1', 'NewCoreReadinessAudit.v1 is generated');
assert.equal(audit.ok, true, audit.errors.join('\n'));
assert.equal(assertNewCoreReadinessAudit(audit, { expectedItemIds: input.graph.items.map((item) => item.id) }).ok, true);
assert.equal(audit.itemCount, input.graph.items.length);
assert.equal(audit.traceRows.length, input.graph.items.length, 'every graph item has a trace row');
assert.deepEqual(audit.traceRows.map((row) => row.itemId), input.graph.items.map((item) => item.id));

const pipe = row(audit, 'PIPE-1');
assert.equal(pipe.bindingStatus, 'proceduralResolved');
assert.equal(pipe.primitiveStatus, 'primitiveResolved');
assert.equal(pipe.rvmExportStatus, 'exportPlanned');
assert.equal(pipe.attStatus, 'recordPlanned');
assert.equal(pipe.glbStatus, 'visualPlanned');
assert.equal(pipe.readinessStatus, 'production-ready', 'straight pipe reaches production-ready export readiness');

const bend = row(audit, 'BEND-1');
assert.equal(bend.bindingStatus, 'catalogueResolved');
assert.equal(bend.primitiveStatus, 'primitiveResolved');
assert.equal(bend.rvmExportStatus, 'test-byte-only');
assert.equal(bend.readinessStatus, 'test-byte-only', 'TORUS/code4 bend remains test-byte-only unless writer policy enables production');
assert.match(bend.reason, /TORUS\/code4|test-byte-only|test-only/i);

const flange = row(audit, 'FLANGE-1');
assert.equal(flange.bindingStatus, 'catalogueResolved');
assert.equal(flange.primitiveStatus, 'primitiveResolved');
assert.equal(flange.rvmExportStatus, 'deferred');
assert.equal(flange.readinessStatus, 'deferred', 'flange remains deferred without writer bridge');
assert.match(flange.reason, /FLANGE_CYLINDER|not implemented|writer bridge/i);

const support = row(audit, 'SUPPORT-1');
assert.equal(support.bindingStatus, 'supportIntent');
assert.equal(support.geometryStatus, 'intentOnly');
assert.equal(support.primitiveStatus, 'deferred');
assert.equal(support.readinessStatus, 'support-intent-only', 'supports remain support-intent-only with reason');
assert.match(support.reason, /support/i);

const unresolved = row(audit, 'UNKNOWN-1');
assert.equal(unresolved.bindingStatus, 'unresolved');
assert.equal(unresolved.readinessStatus, 'unresolved');
assert.match(unresolved.reason, /catalogue|binding|deterministic/i);

assert.equal(audit.productionReadyCount, 1);
assert.equal(audit.testByteOnlyCount, 1);
assert.equal(audit.deferredCount, 1);
assert.equal(audit.supportIntentOnlyCount, 1);
assert.equal(audit.unresolvedCount, 1);
assert.equal(audit.blockedCount, 0);
assert.equal(audit.rvmExportPrimitiveCount, 1);
assert.equal(audit.rvmDeferredExportCount, 3);
assert.equal(audit.rvmBlockedExportCount, 1);
assert.equal(audit.attRecordCount, 3);
assert.equal(audit.glbVisualCount, 1);
assert.equal(JSON.stringify(audit).includes('"bytes"'), false, 'audit contains no bytes field');
assert.equal(JSON.stringify(audit).includes('"binary"'), false, 'audit contains no binary field');
assert.equal(JSON.stringify(audit).includes('"primBody"'), false, 'audit contains no PRIM body field');

const missingTraceAudit = {
  ...audit,
  traceRows: audit.traceRows.slice(0, -1),
  errors: [],
  hardErrorCount: 0,
  ok: true
};
const missingTraceValidation = validateNewCoreReadinessAudit(missingTraceAudit, { expectedItemIds: input.graph.items.map((item) => item.id) });
assert.equal(missingTraceValidation.ok, false, 'audit fails closed on missing traceability');
assert.ok(missingTraceValidation.errors.some((entry) => entry.includes('missing trace row') || entry.includes('itemCount')));

const tainted = buildFixture();
tainted.primitiveModel.primitives[0].bytes = [1, 2, 3];
const taintedAudit = buildNewCoreReadinessAudit(tainted, { sourceName: 'tainted.managed-stage.json' });
assert.equal(taintedAudit.ok, false, 'binary/writer fields fail closed');
assert.ok(taintedAudit.errors.some((entry) => entry.includes('writer/binary payload field')));

const missingPrimitive = buildFixture();
missingPrimitive.primitiveModel.primitives = missingPrimitive.primitiveModel.primitives.filter((primitive) => primitive.sourceItemId !== 'PIPE-1');
const missingPrimitiveAudit = buildNewCoreReadinessAudit(missingPrimitive, { sourceName: 'missing-primitive.managed-stage.json' });
const missingPrimitivePipe = row(missingPrimitiveAudit, 'PIPE-1');
assert.equal(missingPrimitivePipe.rvmExportStatus, 'exportPlanned', 'negative test keeps downstream RVM evidence present');
assert.equal(missingPrimitivePipe.attStatus, 'recordPlanned', 'negative test keeps downstream ATT evidence present');
assert.equal(missingPrimitivePipe.glbStatus, 'visualPlanned', 'negative test keeps downstream GLB evidence present');
assert.equal(missingPrimitivePipe.primitiveStatus, 'missing', 'negative test removes upstream primitive evidence');
assert.equal(missingPrimitivePipe.readinessStatus, 'blocked', 'missing primitive evidence blocks production readiness even when export rows exist');
assert.match(missingPrimitivePipe.reason, /missing resolved primitive evidence/i);
assert.equal(missingPrimitiveAudit.productionReadyCount, 0);
assert.equal(missingPrimitiveAudit.blockedCount, 1);

console.log('new-core readiness audit tests passed');

await import('./new-core-readiness-pipeline-smoke.test.mjs');

function row(auditValue, itemId) {
  const found = auditValue.traceRows.find((entry) => entry.itemId === itemId);
  assert.ok(found, `missing trace row for ${itemId}`);
  return found;
}

function buildFixture() {
  const sourceRefs = [{ sourceType: 'managed-stage-json', name: 'new-core-readiness-fixture.managed-stage.json', phase: 'Phase 01 readiness audit fixture' }];
  const graph = {
    schema: 'PlantModelGraph.v1',
    id: 'NEW-CORE-FIXTURE',
    project: { name: 'New Core Fixture', units: 'mm', axisBasis: { authoring: 'canvas-current', rvmExport: 'navis-review' } },
    catalogues: [{ id: 'base-piping', version: '0.1.0' }],
    nodes: [
      { id: 'N1', coord: [0, 0, 0] },
      { id: 'N2', coord: [1000, 0, 0] },
      { id: 'N3', coord: [1000, 1000, 0] },
      { id: 'N4', coord: [1600, 1000, 0] }
    ],
    routes: [
      { id: 'R-PIPE', from: 'N1', to: 'N2', bore: 100, schedule: 6.02, sourceRef: 'SRC-PIPE-1' },
      { id: 'R-BEND', from: 'N2', to: 'N3', bore: 100, schedule: 6.02, sourceRef: 'SRC-BEND-1' },
      { id: 'R-FLANGE', from: 'N3', to: 'N4', bore: 100, schedule: 6.02, sourceRef: 'SRC-FLANGE-1' }
    ],
    items: [
      { id: 'PIPE-1', kind: 'generated', generator: 'straightPipe.v1', route: 'R-PIPE', sourceRef: 'SRC-PIPE-1' },
      { id: 'BEND-1', kind: 'component', tagged: true, family: 'elbow', type: 'bend', route: 'R-BEND', catalogueRef: { catalogue: 'base-piping', family: 'elbow', type: 'bend' }, sourceRef: 'SRC-BEND-1' },
      { id: 'FLANGE-1', kind: 'component', tagged: true, family: 'flange', type: 'weld-neck', route: 'R-FLANGE', catalogueRef: { catalogue: 'base-piping', family: 'flange', type: 'weld-neck' }, sourceRef: 'SRC-FLANGE-1' },
      { id: 'SUPPORT-1', kind: 'support', tagged: false, node: 'N2', supportFamily: 'GUIDE', sourceRef: 'SRC-SUPPORT-1' },
      { id: 'UNKNOWN-1', kind: 'component', tagged: false, family: 'valve', type: 'unknown', route: 'R-FLANGE', sourceRef: 'SRC-UNKNOWN-1' }
    ],
    sourceRefs
  };

  const bindingAudit = {
    schema: 'CatalogueBindingAudit.v1',
    graphId: graph.id,
    itemCount: 5,
    catalogueResolvedCount: 2,
    proceduralResolvedCount: 1,
    fallbackBlockedCount: 0,
    unresolvedCount: 1,
    supportIntentCount: 1,
    nearestMatchCount: 0,
    exportDecisionCount: 0,
    bindings: [
      binding('PIPE-1', 'generated', 'proceduralResolved', 'pipe', 'straight', 'deterministic procedural straight pipe generator'),
      binding('BEND-1', 'component', 'catalogueResolved', 'elbow', 'bend', 'exact catalogue-backed bend evidence match', 'CAT-BEND-90LR'),
      binding('FLANGE-1', 'component', 'catalogueResolved', 'flange', 'weld-neck', 'exact catalogue-backed flange evidence match', 'CAT-FLANGE-WN'),
      binding('SUPPORT-1', 'support', 'supportIntent', 'support', 'GUIDE', 'support intent is preserved for later support binding'),
      binding('UNKNOWN-1', 'component', 'unresolved', 'valve', 'unknown', 'no exact catalogue item')
    ]
  };

  const resolvedGeometry = {
    schema: 'ResolvedGeometryModel.v1',
    graphId: graph.id,
    units: 'mm',
    axisBasis: { authoring: 'canvas-current', rvmExport: 'navis-review' },
    nodes: graph.nodes.map((node) => ({ id: node.id, coord: [...node.coord] })),
    routeFrames: [
      routeFrame('R-PIPE', 'N1', 'N2', [0, 0, 0], [1000, 0, 0], [1, 0, 0], 1000),
      routeFrame('R-BEND', 'N2', 'N3', [1000, 0, 0], [1000, 1000, 0], [0, 1, 0], 1000),
      routeFrame('R-FLANGE', 'N3', 'N4', [1000, 1000, 0], [1600, 1000, 0], [1, 0, 0], 600)
    ],
    itemFrames: [
      pipeFrame(),
      bendFrame(),
      flangeFrame()
    ],
    supportPlacements: [
      { itemId: 'SUPPORT-1', node: 'N2', position: [1000, 0, 0], axis: '+Y', supportFamily: 'GUIDE', geometryStatus: 'intentOnly', resolver: 'supportPlacementIntent.v1', sourceRef: 'SRC-SUPPORT-1' }
    ],
    unresolvedGeometry: [
      { itemId: 'UNKNOWN-1', routeId: 'R-FLANGE', family: 'valve', type: 'unknown', geometryStatus: 'blocked', reason: 'no deterministic catalogue/procedural geometry resolver', sourceRef: 'SRC-UNKNOWN-1' }
    ],
    sourceRefs
  };

  const primitiveModel = {
    schema: 'ResolvedPrimitiveModel.v1',
    graphId: graph.id,
    sourceGraphId: graph.id,
    sourceGeometryId: graph.id,
    units: 'mm',
    axisBasis: { authoring: 'canvas-current', rvmExport: 'navis-review' },
    items: graph.items.map((item) => ({ id: item.id, sourceGraphItemId: item.id, resolutionMode: item.id === 'SUPPORT-1' ? 'deferred' : item.id === 'UNKNOWN-1' ? 'blocked' : item.id === 'PIPE-1' ? 'procedural' : 'catalogue', sourceRef: item.sourceRef })),
    primitives: [pipePrimitive(), bendPrimitive(), flangePrimitive()],
    deferredPrimitives: [{ sourceItemId: 'SUPPORT-1', family: 'support', type: 'GUIDE', geometryStatus: 'deferred', reason: 'support primitive compiler not implemented in Phase 6', sourceRef: 'SRC-SUPPORT-1' }],
    blockedPrimitives: [{ sourceItemId: 'UNKNOWN-1', family: 'valve', type: 'unknown', geometryStatus: 'blocked', reason: 'unresolved geometry', sourceRef: 'SRC-UNKNOWN-1' }],
    sourceRefs
  };

  return {
    graph,
    bindingAudit,
    resolvedGeometry,
    primitiveModel,
    rvmExportModel: rvmExportModel(graph, sourceRefs),
    attExportModel: attExportModel(graph, sourceRefs),
    glbVisualModel: glbVisualModel(graph, sourceRefs)
  };
}

function binding(itemId, itemKind, status, family, type, reason, catalogueItemId) {
  return { itemId, itemKind, sourceRef: `SRC-${itemId}`, status, family, type, catalogueItemId, catalogueRef: catalogueItemId ? { catalogue: 'base-piping', family, type } : undefined, reason };
}

function routeFrame(routeId, fromNode, toNode, start, end, direction, lengthMm) {
  return { routeId, fromNode, toNode, start, end, direction, lengthMm };
}

function pipeFrame() {
  return { itemId: 'PIPE-1', routeId: 'R-PIPE', center: [500, 0, 0], axis: [1, 0, 0], lengthMm: 1000, radiusMm: 50, diameterMm: 100, wallMm: 6.02, geometryStatus: 'resolved', resolver: 'straightPipeGeometry.v1', sourceRef: 'SRC-PIPE-1' };
}

function bendFrame() {
  return { frameId: 'BEND-FRAME-BEND-1', itemId: 'BEND-1', routeId: 'R-BEND', family: 'elbow', type: 'bend', geometryKind: 'bendArcFrame.v1', geometryStatus: 'resolved', resolver: 'catalogueBackedBendArcGeometry.v1', basis: 'authoring', startPoint: [1000, 0, 0], endPoint: [1000, 1000, 0], center: [1000, 500, 0], normal: [0, 0, 1], startTangent: [1, 0, 0], endTangent: [0, 1, 0], majorRadiusMm: 500, tubeRadiusMm: 50, bendAngleDeg: 90, sweepAngleDeg: 90, catalogueItemId: 'CAT-BEND-90LR', catalogueRef: { catalogue: 'base-piping', family: 'elbow', type: 'bend' }, evidence: { centerSource: 'explicit-bend-arc-center' }, sourceRef: 'SRC-BEND-1' };
}

function flangeFrame() {
  return { frameId: 'FLANGE-FRAME-FLANGE-1', itemId: 'FLANGE-1', routeId: 'R-FLANGE', family: 'flange', type: 'weld-neck', geometryKind: 'flangeFrame.v1', geometryStatus: 'resolved', resolver: 'catalogueBackedFlangeGeometry.v1', basis: 'authoring', center: [1300, 1000, 0], axis: [1, 0, 0], startPoint: [1200, 1000, 0], endPoint: [1400, 1000, 0], lengthMm: 200, boreRadiusMm: 50, outerRadiusMm: 90, faceThicknessMm: 10, hubRadiusMm: 65, hubLengthMm: 80, flangeType: 'weld-neck', facing: 'RF', rating: '150', connectionType: 'butt-weld', catalogueItemId: 'CAT-FLANGE-WN', catalogueRef: { catalogue: 'base-piping', family: 'flange', type: 'weld-neck' }, evidence: { fallbackUsed: false, placementSource: 'endpoint-topology' }, sourceRef: 'SRC-FLANGE-1' };
}

function pipePrimitive() {
  return { primitiveId: 'PRIM-PIPE-1', sourceItemId: 'PIPE-1', sourceRouteId: 'R-PIPE', primitiveKind: 'CYLINDER', primitiveCode: 8, center: [500, 0, 0], axis: [1, 0, 0], lengthMm: 1000, radiusMm: 50, basis: 'authoring', resolver: 'straightPipeCylinderPrimitive.v1', geometryStatus: 'primitiveResolved', sourceRef: 'SRC-PIPE-1' };
}

function bendPrimitive() {
  return { primitiveId: 'PRIM-BEND-1', sourceItemId: 'BEND-1', sourceRouteId: 'R-BEND', primitiveKind: 'TORUS', primitiveCode: 4, center: [1000, 500, 0], normal: [0, 0, 1], startTangent: [1, 0, 0], endTangent: [0, 1, 0], majorRadiusMm: 500, tubeRadiusMm: 50, bendAngleDeg: 90, sweepAngleDeg: 90, basis: 'authoring', resolver: 'bendArcTorusPrimitive.v1', geometryStatus: 'primitiveResolved', family: 'elbow', type: 'bend', catalogueItemId: 'CAT-BEND-90LR', catalogueRef: { catalogue: 'base-piping', family: 'elbow', type: 'bend' }, sourceRef: 'SRC-BEND-1', evidence: { centerSource: 'explicit-bend-arc-center' } };
}

function flangePrimitive() {
  return { primitiveId: 'PRIM-FLANGE-1', sourceItemId: 'FLANGE-1', sourceRouteId: 'R-FLANGE', family: 'flange', type: 'weld-neck', primitiveKind: 'FLANGE_CYLINDER', primitiveCode: 8, center: [1300, 1000, 0], axis: [1, 0, 0], lengthMm: 200, boreRadiusMm: 50, outerRadiusMm: 90, bodyPrimitive: { primitiveKind: 'CYLINDER', primitiveCode: 8, radiusMm: 90, lengthMm: 200 }, optionalSubPrimitives: [], basis: 'authoring', resolver: 'flangeCylinderPrimitive.v1', geometryStatus: 'primitiveResolved', writerReady: false, testByteEligible: false, byteBridge: 'not-implemented-phase-11c', flangeType: 'weld-neck', facing: 'RF', rating: '150', connectionType: 'butt-weld', catalogueItemId: 'CAT-FLANGE-WN', catalogueRef: { catalogue: 'base-piping', family: 'flange', type: 'weld-neck' }, sourceRef: 'SRC-FLANGE-1', evidence: { fallbackUsed: false } };
}

function rvmExportModel(graph, sourceRefs) {
  return {
    schema: 'RvmExportModel.v1',
    graphId: graph.id,
    units: 'mm',
    sourceAxisBasis: { authoring: 'authoring' },
    exportAxisBasis: { review: 'navis-review' },
    transformPolicy: 'final-review-transform.v1',
    transformApplied: true,
    transformWarnings: [],
    primitives: [{ exportPrimitiveId: 'RVM-PRIM-PIPE-1', sourcePrimitiveId: 'PRIM-PIPE-1', sourceItemId: 'PIPE-1', primitiveKind: 'CYLINDER', primitiveCode: 8, center: [0, 0, 0], axis: [1, 0, 0], lengthMm: 1000, radiusMm: 50, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', sourceRef: 'SRC-PIPE-1' }],
    testByteEligiblePrimitives: [{ exportPrimitiveId: 'RVM-PRIM-BEND-1', sourcePrimitiveId: 'PRIM-BEND-1', sourceItemId: 'BEND-1', primitiveKind: 'TORUS', primitiveCode: 4, center: [1000, 500, 0], normal: [0, 0, 1], startTangent: [1, 0, 0], endTangent: [0, 1, 0], majorRadiusMm: 500, tubeRadiusMm: 50, bendAngleDeg: 90, sweepAngleDeg: 90, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', writerReady: false, testByteEligible: true, byteBridge: 'test-only', resolver: 'bendArcTorusPrimitive.v1', reason: 'TORUS/code4 is test-byte-only until production writer policy explicitly allows it', sourceRef: 'SRC-BEND-1' }],
    deferredExports: [{ sourcePrimitiveId: 'PRIM-BEND-1', sourceItemId: 'BEND-1', family: 'elbow', type: 'bend', primitiveKind: 'TORUS', primitiveCode: 4, exportStatus: 'deferred', writerReady: false, testByteEligible: true, byteBridge: 'test-only', reason: 'TORUS/code4 is test-byte-only until production writer policy explicitly allows it', sourceRef: 'SRC-BEND-1' }, { sourcePrimitiveId: 'PRIM-FLANGE-1', sourceItemId: 'FLANGE-1', family: 'flange', type: 'weld-neck', primitiveKind: 'FLANGE_CYLINDER', primitiveCode: 8, exportStatus: 'deferred', reason: 'FLANGE_CYLINDER/code8 RVM byte writer bridge not implemented in Phase 11C', sourceRef: 'SRC-FLANGE-1' }, { sourceItemId: 'SUPPORT-1', family: 'support', type: 'GUIDE', exportStatus: 'deferred', reason: 'support primitive compiler not implemented in Phase 6', sourceRef: 'SRC-SUPPORT-1' }],
    blockedExports: [{ sourceItemId: 'UNKNOWN-1', family: 'valve', type: 'unknown', exportStatus: 'blocked', reason: 'unresolved geometry', sourceRef: 'SRC-UNKNOWN-1' }],
    sourceRefs
  };
}

function attExportModel(graph, sourceRefs) {
  return { schema: 'AttExportModel.v1', graphId: graph.id, units: 'mm', records: ['PIPE-1', 'BEND-1', 'FLANGE-1'].map((id) => ({ recordId: `ATT-${id}`, sourceItemId: id, resolutionMode: id === 'PIPE-1' ? 'procedural' : 'catalogue', exportStatus: 'recordPlanned', sourceRef: `SRC-${id}` })), deferredRecords: [{ sourceItemId: 'SUPPORT-1', recordStatus: 'deferred', reason: 'support ATT bridge deferred', sourceRef: 'SRC-SUPPORT-1' }], blockedRecords: [{ sourceItemId: 'UNKNOWN-1', recordStatus: 'blocked', reason: 'unresolved component ATT record blocked', sourceRef: 'SRC-UNKNOWN-1' }], sourceRefs };
}

function glbVisualModel(graph, sourceRefs) {
  return { schema: 'GlbVisualModel.v1', graphId: graph.id, units: 'mm', sourceAxisBasis: { authoring: 'canvas-current' }, visualItems: [{ visualItemId: 'GLB-PIPE-1', sourceItemId: 'PIPE-1', sourcePrimitiveId: 'PRIM-PIPE-1', visualKind: 'cylinder', center: [500, 0, 0], axis: [1, 0, 0], lengthMm: 1000, radiusMm: 50, basis: 'authoring', visualStatus: 'visualPlanned', sourceRef: 'SRC-PIPE-1' }], deferredVisuals: [{ sourceItemId: 'BEND-1', visualStatus: 'deferred', reason: 'bend GLB visual deferred in fixture', sourceRef: 'SRC-BEND-1' }, { sourceItemId: 'FLANGE-1', visualStatus: 'deferred', reason: 'flange GLB visual deferred in fixture', sourceRef: 'SRC-FLANGE-1' }, { sourceItemId: 'SUPPORT-1', visualStatus: 'deferred', reason: 'support GLB visual deferred in fixture', sourceRef: 'SRC-SUPPORT-1' }], blockedVisuals: [{ sourceItemId: 'UNKNOWN-1', visualStatus: 'blocked', reason: 'unresolved component GLB visual blocked', sourceRef: 'SRC-UNKNOWN-1' }], sourceRefs };
}
