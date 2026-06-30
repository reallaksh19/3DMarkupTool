import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertResolvedPrimitiveModelContract } from '../../src/contracts/index.js';
import { assertPrimitiveCompilationAudit } from '../../src/audit/primitive-compilation-audit.js';
import {
  buildPrimitiveCompilationAudit,
  compileResolvedGeometryToPrimitives
} from '../../src/primitives/primitive-compiler.js';

const geometry = JSON.parse(await readFile('samples/primitives/minimal-primitive-compiler.input.resolved-geometry.json', 'utf8'));
const geometryAudit = JSON.parse(await readFile('samples/primitives/minimal-primitive-compiler.input.geometry-audit.json', 'utf8'));
const expectedModel = JSON.parse(await readFile('samples/primitives/minimal-primitive-compiler.expected.resolved-primitive-model.json', 'utf8'));
const expectedAudit = JSON.parse(await readFile('samples/primitives/minimal-primitive-compiler.expected.audit.json', 'utf8'));

const model = compileResolvedGeometryToPrimitives(geometry, geometryAudit);
assert.deepEqual(model, expectedModel, 'primitive compiler output must match golden fixture');
assert.equal(assertResolvedPrimitiveModelContract(model, { expectedAuthoringBasis: geometry.axisBasis.authoring }).ok, true, 'primitive model validates');
assert.equal(model.axisBasis.authoring, geometry.axisBasis.authoring, 'authoring basis preserved');
assert.equal(model.primitives.length, 1, 'one primitive compiled');
assert.equal(model.primitives[0].primitiveKind, 'CYLINDER', 'straight pipe becomes CYLINDER');
assert.equal(model.primitives[0].primitiveCode, 8, 'straight pipe gets writer-neutral code 8 marker');
assert.equal(model.primitives[0].basis, 'authoring', 'primitive remains in authoring basis');
assert.equal(model.deferredPrimitives.find((entry) => entry.sourceItemId === 'ELBOW-1').reason, 'component primitive compiler not implemented in Phase 6');
assert.equal(model.deferredPrimitives.find((entry) => entry.sourceItemId === 'SUPPORT-1').reason, 'support primitive compiler not implemented in Phase 6');
assert.equal(model.blockedPrimitives.find((entry) => entry.sourceItemId === 'VALVE-1').reason, 'no exact catalogue item');

const audit = buildPrimitiveCompilationAudit(geometry, model, geometryAudit);
assert.deepEqual(audit, expectedAudit, 'primitive audit must match golden fixture');
assert.equal(assertPrimitiveCompilationAudit(audit, {
  ok: true,
  primitiveCount: 1,
  cylinderPrimitiveCount: 1,
  torusPrimitiveCount: 0,
  boxPrimitiveCount: 0,
  spherePrimitiveCount: 0,
  pyramidPrimitiveCount: 0,
  supportPrimitiveCount: 0,
  deferredSupportPrimitiveCount: 1,
  blockedUnresolvedGeometryCount: 1,
  missingDimensionCount: 0,
  navisTransformApplied: false,
  writerCallCount: 0,
  exportDecisionCount: 0
}).ok, true);

const missingRadiusGeometry = structuredClone(geometry);
delete missingRadiusGeometry.itemFrames[0].radiusMm;
delete missingRadiusGeometry.itemFrames[0].diameterMm;
const missingRadiusModel = compileResolvedGeometryToPrimitives(missingRadiusGeometry, geometryAudit);
assert.equal(missingRadiusModel.primitives.length, 0, 'missing radius must not fabricate cylinder');
assert.equal(missingRadiusModel.deferredPrimitives.find((entry) => entry.sourceItemId === 'PIPE-1').reason, 'missing pipe diameter/radius evidence');
const missingRadiusAudit = buildPrimitiveCompilationAudit(missingRadiusGeometry, missingRadiusModel, geometryAudit);
assert.equal(missingRadiusAudit.ok, false, 'missing pipe dimensions must fail audit');
assert.equal(missingRadiusAudit.missingDimensionCount, 1, 'missing dimension count');

const failedGeometryAudit = { ...geometryAudit, ok: false, hardErrorCount: 1, errors: ['route frame error'] };
const failedModel = compileResolvedGeometryToPrimitives(geometry, failedGeometryAudit);
assert.equal(failedModel.primitives.length, 0, 'failed geometry audit must create no primitives');
const failedAudit = buildPrimitiveCompilationAudit(geometry, failedModel, failedGeometryAudit);
assert.equal(failedAudit.ok, false, 'failed geometry audit must fail primitive audit');
assert.ok(failedAudit.errors.some((entry) => entry.includes('GeometryResolutionAudit.ok')));

const compilerSource = await readFile('src/primitives/primitive-compiler.js', 'utf8');
for (const forbidden of ['catalogue-binder', 'geometry-solver', 'rvm-writer', 'att-writer', 'managed-stage-rvm-converter', 'canvas', 'app-loader', 'safe-ui-loader', "from 'three'", 'from "three"', 'window.', 'document.']) {
  assert.equal(compilerSource.includes(forbidden), false, `primitive compiler must not reference ${forbidden}`);
}

console.log('primitive compiler tests passed');
