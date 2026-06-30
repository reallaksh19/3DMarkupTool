import assert from 'node:assert/strict';
import { auditCatalogueBinding } from '../../src/catalogue/catalogue-binder.js';
import { buildGeometryResolutionAudit, resolvePlantGraphGeometry } from '../../src/geometry/geometry-solver.js';
import { buildPrimitiveCompilationAudit, compileResolvedGeometryToPrimitives } from '../../src/primitives/primitive-compiler.js';
import { assertResolvedPrimitiveModelContract } from '../../src/contracts/index.js';
import { assertPrimitiveCompilationAudit } from '../../src/audit/primitive-compilation-audit.js';
import { loadPhase11aCatalogueItems } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const graph = { schema: 'PlantModelGraph.v1', id: 'bend-torus-primitive-test', project: { units: 'mm', axisBasis: { authoring: 'canvas-current' } }, nodes: [{ id: 'N1', coord: [0,0,0] }, { id: 'N2', coord: [100,0,-50] }], routes: [], items: [{ id: 'BEND-1', kind: 'component', family: 'elbow', type: 'bend', dimensions: { diameterMm: 114.299995, wallMm: 6.0 }, bendEvidence: { startPosition: [0,0,0], endPosition: [100,0,-50], arcCenter: [152.399994,0,0], normal: [0,1,0], startTangent: [1,0,0], endTangent: [0.707106781,0,-0.707106781], diameterMm: 114.299995, wallMm: 6.0, bendAngleDeg: 45, bendRadiusMm: 152.399994, centerEstimate: [50,0,-25], centerEstimateSource: 'inputxml-chord-midpoint-not-arc-center' }, sourceRef: 'BEND-1' }], sourceRefs: [] };
const bindingAudit = auditCatalogueBinding(graph, await loadPhase11aCatalogueItems());
const resolved = resolvePlantGraphGeometry(graph, bindingAudit);
const geometryAudit = buildGeometryResolutionAudit(graph, resolved, bindingAudit);
const primitiveModel = compileResolvedGeometryToPrimitives(resolved, geometryAudit);
assert.equal(assertResolvedPrimitiveModelContract(primitiveModel, { expectedAuthoringBasis: 'canvas-current' }).ok, true);
const primitiveAudit = buildPrimitiveCompilationAudit(resolved, primitiveModel, geometryAudit);
assert.equal(assertPrimitiveCompilationAudit(primitiveAudit, { ok: true, primitiveCount: 1, cylinderPrimitiveCount: 0, torusPrimitiveCount: 1, bendTorusPrimitiveCount: 1, boxPrimitiveCount: 0, spherePrimitiveCount: 0, pyramidPrimitiveCount: 0, supportPrimitiveCount: 0, blockedBendPrimitiveCount: 0, chordMidpointTorusCenterCount: 0, navisTransformApplied: false, writerCallCount: 0, exportDecisionCount: 0 }).ok, true);
const torus = primitiveModel.primitives[0];
assert.equal(torus.primitiveKind, 'TORUS');
assert.equal(torus.primitiveCode, 4);
assert.equal(torus.resolver, 'bendArcTorusPrimitive.v1');
assert.equal(torus.basis, 'authoring');
assert.notDeepEqual(torus.center, [50,0,-25], 'does not compile from chord midpoint');

console.log('bend torus primitive compiler tests passed');
