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

console.log('new-core readiness audit tests passed');

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
      { itemId: 'PIPE-1', itemKind: 'generated', sourceRef: 'SRC-PIPE-1', status: 'proceduralResolved', family: 'pipe', type: 'straight', reason: 'deterministic procedural straight pipe generator' },
      { itemId: 'BEND-1', itemKind: 'component', sourceRef: 'SRC-BEND-1', status: 'catalogueResolved', family: 'elbow', type: 'bend', catalogueItemId: 'CAT-BEND-90LR', catalogueRef: { catalogue: 'base-piping', family: 'elbow', type: 'bend' }, reason: 'exact catalogue-backed bend evidence match' },
      { itemId: 'FLANGE-1', itemKind: 'component', sourceRef: 'SRC-FLANGE-1', status: 'catalogueResolved', family: 'flange', type: 'weld-neck', catalogueItemId: 'CAT-FLANGE-WN', catalogueRef: { catalogue: 'base-piping', family: 'flange', type: 'weld-neck' }, reason: 'exact catalogue-backed flange evidence match' },
      { itemId: 'SUPPORT-1', itemKind: 'support', sourceRef: 'SRC-SUPPORT-1', status: 'supportIntent', family: 'support', type: 'GUIDE', reason: 'support intent is preserved for later support binding' },
      { itemId: 'UNKNOWN-1', itemKind: 'component', sourceRef: 'SRC-UNKNOWN-1', status: 'unresolved', family: 'valve', type: 'unknown', reason: 'no exact catalogue item' }
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
      { itemId: 'PIPE-1', routeId: 'R-PIPE', center: [500, 0, 0], axis: [1, 0, 0], lengthMm: 1000, radiusMm: 50, diameterMm: 100, wallMm: 6.02, geometryStatus: 'resolved', resolver: 'straightPipeGeometry.v1', sourceRef: 'SRC-PIPE-1' },
      { frameId: 'BEND-FRAME-BEND-1', itemId: 'BEND-1', routeId: 'R-BEND', family: 'elbow', type: 'bend', geometryKind: 'bendArcFrame.v1', geometryStatus: 'resolved', resolver: 'catalogueBackedBendArcGeometry.v1', basis: 'authoring', startPoint: [1000, 0, 0], endPoint: [1000, 1000, 0], center: [1000, 500, 0], normal: [0, 0, 1], startTangent: [1, 0, 0], endTangent: [0, 1, 0], majorRadiusMm: 500, tubeRadiusMm: 50, bendAngleDeg: 90, sweepAngleDeg: 90, catalogueItemId: 'CAT-BEND-90LR', catalogueRef: { catalogue: 'base-piping', family: 'elbow', type: 'bend' }, evidence: { centerSource: 'explicit-bend-arc-center' }, sourceRef: 'SRC-BEND-1' },
      { frameId: 'FLANGE-FRAME-FLANGE-1', itemId: 'FLANGE-1', routeId: 'R-FLANGE', family: 'flange', type: 'weld-neck', geometryKind: 'flangeFrame.v1', geometryStatus: 'resolved', resolver: 'catalogueBackedFlangeGeometry.v1', basis: 'authoring', center: [1300, 1000, 0], axis: [1, 0, 0], startPoint: [1200, 1000, 0], endPoint: [1400, 1000, 0], lengthMm: 200, boreRadiusMm: 50, outerRadiusMm: 90, faceThicknessMm: 10, hubRadiusMm: 65, hubLengthMm: 80, flangeType: 'weld-neck', facing: 'RF', rating: '150', connectionType: 'butt-weld', catalogueItemId: 'CAT-FLANGE-WN', catalogueRef: { catalogue: 'base-piping', family: 'flange', type: 'weld-neck' }, evidence: { fallbackUsed: false, placementSource: 'endpoint-topology' }, sourceRef: 'SRC-FLANGE-1' }
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
    items: [
      { id: 'PIPE-1', sourceGraphItemId: 'PIPE-1', resolutionMode: 'procedural', sourceRef: 'SRC-PIPE-1' },
      { id: 'BEND-1', sourceGraphItemId: 'BEND-1', resolutionMode: 'catalogue', sourceRef: 'SRC-BEND-1' },
      { id: 'FLANGE-1', sourceGraphItemId: 'FLANGE-1', resolutionMode: 'catalogue', sourceRef: 'SRC-FLANGE-1' },
      { id: 'SUPPORT-1', sourceGraphItemId: 'SUPPORT-1', resolutionMode: 'deferred', sourceRef: 'SRC-SUPPORT-1' },
      { id: 'UNKNOWN-1', sourceGraphItemId: 'UNKNOWN-1', resolutionMode: 'blocked', sourceRef: 'SRC-UNKNOWN-1' }
    ],
    primitives: [
      { primitiveId: 'PRIM-PIPE-1', sourceItemId: 'PIPE-1', sourceRouteId: 'R-PIPE', primitiveKind: 'CYLINDER', primitiveCode: 8, center: [500, 0, 0], axis: [1, 0, 0], lengthMm: 1000, radiusMm: 50, basis: 'authoring', resolver: 'straightPipeCylinderPrimitive.v1', geometryStatus: 'primitiveResolved', sourceRef: 'SRC-PIPE-1' },
      { primitiveId: 'PRIM-BEND-1', sourceItemId: 'BEND-1', sourceRouteId: 'R-BEND', primitiveKind: 'TORUS', primitiveCode: 4, center: [1000, 500, 0], normal: [0, 0, 1], startTangent: [1, 0, 0], endTangent: [0, 1, 0], majorRadiusMm: 500, tubeRadiusMm: 50, bendAngleDeg: 90, sweepAngleDeg: 90, basis: 'authoring', resolver: 'bendArcTorusPrimitive.v1', geometryStatus: 'primitiveResolved', family: 'elbow', type: 'bend', catalogueItemId: 'CAT-BEND-90LR', catalogueRef: { catalogue: 'base-piping', family: 'elbow', type: 'bend' }, evidence: { centerSource: 'explicit-bend-arc-center' }, sourceRef: 'SRC-BEND-1' },
      { primitiveId: 'PRIM-FLANGE-1', sourceItemId: 'FLANGE-1', sourceRouteId: 'R-FLANGE', family: 'flange', type: 'weld-neck', primitiveKind: 'FLANGE_CYLINDER', primitiveCode: 8, center: [1300, 1000, 0], axis: [1, 0, 0], lengthMm: 200, boreRadiusMm: 50, outerRadiusMm: 90, bodyPrimitive: { primitiveKind: 'CYLINDER', primitiveCode: 8, radiusMm: 90, lengthMm: 200 }, optionalSubPrimitives: [], basis: 'authoring', resolver: 'flangeCylinderPrimitive.v1', geometryStatus: 'primitiveResolved', writerReady: false, testByteEligible: false, byteBridge: 'not-implemented-phase-11c', flangeType: 'weld-neck', facing: 'RF', rating: '150', connectionType: 'butt-weld', catalogueItemId: 'CAT-FLANGE-WN', catalogueRef: { catalogue: 'base-piping', family: 'flange', type: 'weld-neck' }, evidence: { fallbackUsed: false }, sourceRef: 'SRC-FLANGE-1' }
    ],
    deferredPrimitives: [
      { sourceItemId: 'SUPPORT-1', family: 'support', type: 'GUIDE', geometryStatus: 'deferred', reason: 'support primitive compiler not implemented in Phase 6', sourceRef: 'SRC-SUPPORT-1' }
    ],
    blockedPrimitives: [
      { sourceItemId: 'UNKNOWN-1', family: 'valve', type: 'unknown', geometryStatus: 'blocked', reason: 'no deterministic catalogue/procedural geometry resolver', sourceRef: 'SRC-UNKNOWN-1' }
    ],
    sourceRefs
  };

  const rvmExportModel = {
    schema: 'RvmExportModel.v1',
    graphId: graph.id,
    units: 'mm',
    sourceAxisBasis: { authoring: 'canvas-current', rvmExport: 'navis-review' },
    exportAxisBasis: { review: 'navis-review' },
    transformPolicy: 'final-review-transform.v1',
    transformApplied: true,
    transformWarnings: [],
    primitives: [
      { exportPrimitiveId: 'RVM-PRIM-PIPE-1', sourcePrimitiveId: 'PRIM-PIPE-1', sourceItemId: 'PIPE-1', primitiveKind: 'CYLINDER', primitiveCode: 8, center: [500, 0, 0], axis: [1, 0, 0], lengthMm: 1000, radiusMm: 50, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', sourceRef: 'SRC-PIPE-1' }
    ],
    testByteEligiblePrimitives: [
      { exportPrimitiveId: 'RVM-PRIM-BEND-1', sourcePrimitiveId: 'PRIM-BEND-1', sourceItemId: 'BEND-1', primitiveKind: 'TORUS', primitiveCode: 4, center: [1000, 500, 0], normal: [0, 0, 1], startTangent: [1, 0, 0], endTangent: [0, 1, 0], majorRadiusMm: 500, tubeRadiusMm: 50, bendAngleDeg: 90, sweepAngleDeg: 90, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', transformApplied: true, writerReady: false, testByteEligible: true, byteBridge: 'test-only', resolver: 'bendArcTorusPrimitive.v1', catalogueItemId: 'CAT-BEND-90LR', catalogueRef: { catalogue: 'base-piping', family: 'elbow', type: 'bend' }, evidence: { centerSource: 'explicit-bend-arc-center' }, sourceRef: 'SRC-BEND-1' }
    ],
    deferredExports: [
      { sourcePrimitiveId: 'PRIM-BEND-1', sourceItemId: 'BEND-1', family: 'elbow', type: 'bend', primitiveKind: 'TORUS', primitiveCode: 4, exportStatus: 'deferred', writerReady: false, testByteEligible: true, byteBridge: 'test-only', reason: 'TORUS/code4 is eligible for Phase 11B test-only byte proof; production writer remains disabled', resolver: 'bendArcTorusPrimitive.v1', catalogueItemId: 'CAT-BEND-90LR', catalogueRef: { catalogue: 'base-piping', family: 'elbow', type: 'bend' }, sourceRef: 'SRC-BEND-1' },
      { sourcePrimitiveId: 'PRIM-FLANGE-1', sourceItemId: 'FLANGE-1', family: 'flange', type: 'weld-neck', primitiveKind: 'FLANGE_CYLINDER', primitiveCode: 8, exportStatus: 'deferred', writerReady: false, testByteEligible: false, byteBridge: 'not-implemented-phase-11c', reason: 'FLANGE_CYLINDER/code8 RVM byte writer bridge not implemented in Phase 11C', resolver: 'flangeCylinderPrimitive.v1', catalogueItemId: 'CAT-FLANGE-WN', catalogueRef: { catalogue: 'base-piping', family: 'flange', type: 'weld-neck' }, sourceRef: 'SRC-FLANGE-1' },
      { sourceItemId: 'SUPPORT-1', family: 'support', type: 'GUIDE', exportStatus: 'deferred', reason: 'support primitive compiler not implemented in Phase 6', sourceRef: 'SRC-SUPPORT-1' }
    ],
    blockedExports: [
      { sourceItemId: 'UNKNOWN-1', family: 'valve', type: 'unknown', exportStatus: 'blocked', reason: 'no deterministic catalogue/procedural geometry resolver', sourceRef: 'SRC-UNKNOWN-1' }
    ],
    sourceRefs
  };

  const attExportModel = {
    schema: 'AttExportModel.v1',
    graphId: graph.id,
    units: 'mm',
    records: [
      { recordId: 'ATT-PIPE-1', sourceItemId: 'PIPE-1', sourceRef: 'SRC-PIPE-1', resolutionMode: 'procedural', exportStatus: 'recordPlanned' },
      { recordId: 'ATT-BEND-1', sourceItemId: 'BEND-1', sourceRef: 'SRC-BEND-1', resolutionMode: 'catalogue', exportStatus: 'recordPlanned' },
      { recordId: 'ATT-FLANGE-1', sourceItemId: 'FLANGE-1', sourceRef: 'SRC-FLANGE-1', resolutionMode: 'catalogue', exportStatus: 'recordPlanned' }
    ],
    deferredRecords: [
      { sourceItemId: 'SUPPORT-1', family: 'support', type: 'GUIDE', recordStatus: 'deferred', reason: 'support primitive compiler not implemented in Phase 6', sourceRef: 'SRC-SUPPORT-1' }
    ],
    blockedRecords: [
      { sourceItemId: 'UNKNOWN-1', family: 'valve', type: 'unknown', recordStatus: 'blocked', reason: 'no deterministic catalogue/procedural geometry resolver', sourceRef: 'SRC-UNKNOWN-1' }
    ],
    sourceRefs
  };

  const glbVisualModel = {
    schema: 'GlbVisualModel.v1',
    graphId: graph.id,
    units: 'mm',
    sourceAxisBasis: { authoring: 'canvas-current', rvmExport: 'navis-review' },
    visualItems: [
      { visualItemId: 'VIS-PRIM-PIPE-1', sourcePrimitiveId: 'PRIM-PIPE-1', sourceItemId: 'PIPE-1', visualKind: 'cylinder', center: [500, 0, 0], axis: [1, 0, 0], lengthMm: 1000, radiusMm: 50, basis: 'authoring', visualStatus: 'visualPlanned', sourceRef: 'SRC-PIPE-1' }
    ],
    deferredVisuals: [
      { sourceItemId: 'BEND-1', family: 'elbow', type: 'bend', visualStatus: 'deferred', reason: 'TORUS GLB visual bridge not production-enabled in Phase 01 audit', sourceRef: 'SRC-BEND-1' },
      { sourceItemId: 'FLANGE-1', family: 'flange', type: 'weld-neck', visualStatus: 'deferred', reason: 'flange GLB visual bridge not production-enabled in Phase 01 audit', sourceRef: 'SRC-FLANGE-1' },
      { sourceItemId: 'SUPPORT-1', family: 'support', type: 'GUIDE', visualStatus: 'deferred', reason: 'support visual generation not implemented in Phase 01 audit', sourceRef: 'SRC-SUPPORT-1' }
    ],
    blockedVisuals: [
      { sourceItemId: 'UNKNOWN-1', family: 'valve', type: 'unknown', visualStatus: 'blocked', reason: 'no deterministic catalogue/procedural geometry resolver', sourceRef: 'SRC-UNKNOWN-1' }
    ],
    sourceRefs
  };

  return { graph, bindingAudit, resolvedGeometry, primitiveModel, exportModels: { rvmExportModel, attExportModel, glbVisualModel } };
}

function routeFrame(routeId, fromNode, toNode, start, end, direction, lengthMm) {
  return { routeId, fromNode, toNode, start, end, direction, lengthMm, diameterMm: 100, radiusMm: 50, wallMm: 6.02 };
}
