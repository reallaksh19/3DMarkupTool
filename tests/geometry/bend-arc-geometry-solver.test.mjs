import assert from 'node:assert/strict';
import { auditCatalogueBinding } from '../../src/catalogue/catalogue-binder.js';
import { buildGeometryResolutionAudit, resolvePlantGraphGeometry } from '../../src/geometry/geometry-solver.js';
import { assertGeometryResolutionAudit } from '../../src/audit/geometry-resolution-audit.js';
import { loadPhase11aCatalogueItems } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const catalogueItems = await loadPhase11aCatalogueItems();
const graph = bendGraph({ includeArc: true });
const bindingAudit = auditCatalogueBinding(graph, catalogueItems);
const resolved = resolvePlantGraphGeometry(graph, bindingAudit);
const audit = buildGeometryResolutionAudit(graph, resolved, bindingAudit);
assert.equal(assertGeometryResolutionAudit(audit, { ok: true, resolvedBendArcCount: 1, blockedBendGeometryCount: 0, missingBendTangentEvidenceCount: 0, chordMidpointTorusCenterCount: 0, navisTransformApplied: false, writerCallCount: 0, primitiveCodeCount: 0, exportDecisionCount: 0 }).ok, true);
const frame = resolved.itemFrames.find((entry) => entry.geometryKind === 'bendArcFrame.v1');
assert.ok(frame, 'bend arc frame exists');
for (const key of ['startPoint','endPoint','center','normal','startTangent','endTangent']) assert.equal(frame[key].length, 3, `${key} finite vector`);
assertAlmost(Math.hypot(...frame.normal), 1, 'normal normalized');
assertAlmost(Math.hypot(...frame.startTangent), 1, 'start tangent normalized');
assertAlmost(Math.hypot(...frame.endTangent), 1, 'end tangent normalized');
assert.ok(frame.majorRadiusMm > 0 && frame.tubeRadiusMm > 0 && frame.bendAngleDeg > 0 && frame.sweepAngleDeg > 0);
assert.notDeepEqual(frame.center, frame.evidence?.centerEstimate, 'chord midpoint is not center');

const blockedGraph = bendGraph({ includeArc: false });
const blockedBinding = auditCatalogueBinding(blockedGraph, catalogueItems);
const blockedResolved = resolvePlantGraphGeometry(blockedGraph, blockedBinding);
const blockedAudit = buildGeometryResolutionAudit(blockedGraph, blockedResolved, blockedBinding);
assert.equal(blockedAudit.resolvedBendArcCount, 0, 'missing tangent/arc evidence blocks geometry');
assert.equal(blockedAudit.blockedBendGeometryCount, 1);

console.log('bend arc geometry solver tests passed');

function bendGraph({ includeArc }) { return { schema: 'PlantModelGraph.v1', id: 'bend-arc-test', project: { units: 'mm', axisBasis: { authoring: 'canvas-current' } }, nodes: [{ id: 'N1', coord: [0,0,0] }, { id: 'N2', coord: [100,0,-50] }], routes: [], items: [{ id: 'BEND-1', kind: 'component', family: 'elbow', type: 'bend', placement: { fromNode: 'N1', toNode: 'N2' }, dimensions: { diameterMm: 114.299995, wallMm: 6.0 }, bendEvidence: { fromNode: 'N1', toNode: 'N2', startPosition: [0,0,0], endPosition: [100,0,-50], diameterMm: 114.299995, wallMm: 6.0, bendAngleDeg: 45, bendRadiusMm: 152.399994, centerEstimate: [50,0,-25], centerEstimateSource: 'inputxml-chord-midpoint-not-arc-center', ...(includeArc ? { arcCenter: [152.399994,0,0], normal: [0,1,0], startTangent: [1,0,0], endTangent: [0.707106781,0,-0.707106781] } : {}) }, sourceRef: 'BEND-1' }], sourceRefs: [] }; }
function assertAlmost(actual, expected, label) { assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual}`); }
