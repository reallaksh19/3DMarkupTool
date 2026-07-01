import assert from 'node:assert/strict';
import { auditCatalogueBinding } from '../../src/catalogue/catalogue-binder.js';
import { buildGeometryResolutionAudit, resolvePlantGraphGeometry } from '../../src/geometry/geometry-solver.js';
import { assertGeometryResolutionAudit } from '../../src/audit/geometry-resolution-audit.js';
import { buildBmCiiPhase11aState } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.geometryAudit.ok, true);
assert.equal(assertGeometryResolutionAudit(state.geometryAudit, { ok: true, routeFrameCount: 40, itemFrameCount: 19, resolvedStraightPipeCount: 19, resolvedBendArcCount: 7, resolvedFlangeFrameCount: 8, blockedFlangeGeometryCount: 0, missingFlangeCatalogueCount: 0, missingFlangePlacementEvidenceCount: 0, ambiguousFlangeAxisCount: 0, fallbackFlangeGeometryCount: 0, supportPlacementCount: 12, primitiveCodeCount: 0, writerCallCount: 0, exportDecisionCount: 0 }).ok, true);
for (const frame of state.resolvedGeometry.itemFrames.filter((entry) => entry.geometryKind === 'flangeFrame.v1')) {
  assert.equal(frame.family, 'flange');
  assert.equal(frame.geometryStatus, 'resolved');
  assert.equal(frame.basis, 'authoring');
  assert.equal(Math.abs(Math.hypot(...frame.axis) - 1) < 1e-6, true);
  assert.ok(frame.lengthMm > 0);
  assert.ok(frame.outerRadiusMm > frame.boreRadiusMm);
  assert.ok(frame.catalogueItemId);
  assert.equal(frame.evidence.fallbackUsed, false);
}

const noPlacementGraph = structuredClone(state.graph);
const flange = noPlacementGraph.items.find((item) => item.family === 'flange');
delete flange.placement;
delete flange.flangeEvidence.startPosition;
delete flange.flangeEvidence.endPosition;
delete flange.flangeEvidence.center;
const binding = auditCatalogueBinding(noPlacementGraph, state.catalogueItems);
const resolved = resolvePlantGraphGeometry(noPlacementGraph, binding);
const audit = buildGeometryResolutionAudit(noPlacementGraph, resolved, binding);
assert.equal(audit.resolvedFlangeFrameCount, 7);
assert.equal(audit.blockedFlangeGeometryCount, 1);
assert.equal(audit.fallbackFlangeGeometryCount, 0);

console.log('flange frame geometry solver tests passed');
