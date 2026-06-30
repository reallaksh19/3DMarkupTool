import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertAttExportModelContract,
  assertGlbVisualModelContract,
  assertResolvedGeometryModelContract,
  assertResolvedPrimitiveModelContract,
  assertRvmExportModelContract,
  assertRvmTestArtifactByteProofContract,
  assertTestArtifactAdapterPlanContract,
  assertWriterAdapterPlanContract,
  validatePlantModelGraphContract,
  validateRvmTestArtifactByteProofContract
} from '../../src/contracts/index.js';
import { auditPlantGraphTopology } from '../../src/audit/plant-graph-topology-audit.js';
import { assertCatalogueBindingAudit } from '../../src/audit/catalogue-binding-audit.js';
import { assertGeometryResolutionAudit } from '../../src/audit/geometry-resolution-audit.js';
import { assertPrimitiveCompilationAudit } from '../../src/audit/primitive-compilation-audit.js';
import { assertExportModelCompilationAudit } from '../../src/audit/export-model-compilation-audit.js';
import { assertWriterAdapterAudit } from '../../src/audit/writer-adapter-audit.js';
import { assertTestArtifactAdapterAudit } from '../../src/audit/test-artifact-adapter-audit.js';
import { assertRvmTestArtifactByteProofAudit } from '../../src/audit/rvm-test-artifact-byte-proof-audit.js';
import { auditCatalogueBinding } from '../../src/catalogue/catalogue-binder.js';
import { loadCatalogueItemsFromMap, loadCatalogueRegistryFromText } from '../../src/catalogue/catalogue-registry-loader.js';
import { buildGeometryResolutionAudit, resolvePlantGraphGeometry } from '../../src/geometry/geometry-solver.js';
import { buildPrimitiveCompilationAudit, compileResolvedGeometryToPrimitives } from '../../src/primitives/primitive-compiler.js';
import { buildExportModelCompilationAudit, compileResolvedPrimitiveModelToExportModels } from '../../src/export-models/export-model-compilers.js';
import { buildWriterAdapterAudit, buildWriterAdapterPlan } from '../../src/writer-adapters/writer-adapters.js';
import { buildTestArtifactAdapterAudit, buildTestArtifactAdapterPlan } from '../../src/artifact-adapters/test-artifact-adapter.js';
import {
  buildRvmTestArtifactByteProof,
  buildRvmTestArtifactByteProofAudit
} from '../../src/artifact-adapters/rvm-test-byte-artifact-adapter.js';

const realGraph = await readJson('samples/artifact-adapters/rvm-byte-proof.real-geometry.input.plant-graph.json');
const oracle = await readJson('samples/artifact-adapters/rvm-byte-proof.real-geometry.expected-transform.json');
assert.equal(validatePlantModelGraphContract(realGraph).ok, true, 'real geometry PlantModelGraph validates');
assert.equal(realGraph.items.length, 10, 'real geometry item count');
assert.equal(realGraph.items.filter((entry) => entry.generator === 'straightPipe.v1').length, 5, 'real straight-pipe item count');
assert.equal(realGraph.items.filter((entry) => entry.family === 'valve').length, 1, 'real blocked valve count');
assert.equal(realGraph.items.filter((entry) => entry.family === 'flange').length, 1, 'real blocked flange count');
assert.equal(realGraph.items.filter((entry) => entry.family === 'elbow').length, 1, 'real blocked bend count');
assert.equal(realGraph.items.filter((entry) => entry.kind === 'support').length, 2, 'real deferred support count');

const topologyAudit = auditPlantGraphTopology(realGraph);
assert.equal(topologyAudit.ok, true, 'real topology audit ok');
const catalogueItems = await loadBasePipingCatalogueItems();
const bindingAudit = auditCatalogueBinding(realGraph, catalogueItems);
assert.equal(assertCatalogueBindingAudit(bindingAudit, {
  itemCount: 10,
  catalogueResolvedCount: 0,
  proceduralResolvedCount: 5,
  fallbackBlockedCount: 0,
  unresolvedCount: 3,
  supportIntentCount: 2,
  nearestMatchCount: 0,
  exportDecisionCount: 0
}).ok, true, 'real binding audit ok');

const resolvedGeometry = resolvePlantGraphGeometry(realGraph, bindingAudit);
assert.equal(assertResolvedGeometryModelContract(resolvedGeometry, { expectedAuthoringBasis: realGraph.project.axisBasis.authoring }).ok, true, 'real geometry model ok');
const geometryAudit = buildGeometryResolutionAudit(realGraph, resolvedGeometry, bindingAudit);
assert.equal(assertGeometryResolutionAudit(geometryAudit, {
  ok: true,
  hardErrorCount: 0,
  navisTransformApplied: false,
  primitiveCodeCount: 0,
  exportDecisionCount: 0,
  routeFrameCount: 5,
  itemFrameCount: 5,
  resolvedStraightPipeCount: 5,
  supportPlacementCount: 2,
  blockedUnresolvedComponentCount: 3,
  unresolvedGeometryCount: 3
}).ok, true, 'real geometry audit ok');

const primitiveModel = compileResolvedGeometryToPrimitives(resolvedGeometry, geometryAudit);
assert.equal(assertResolvedPrimitiveModelContract(primitiveModel, { expectedAuthoringBasis: resolvedGeometry.axisBasis.authoring }).ok, true, 'real primitive model ok');
const primitiveAudit = buildPrimitiveCompilationAudit(resolvedGeometry, primitiveModel, geometryAudit);
assert.equal(assertPrimitiveCompilationAudit(primitiveAudit, {
  ok: true,
  hardErrorCount: 0,
  navisTransformApplied: false,
  writerCallCount: 0,
  exportDecisionCount: 0,
  primitiveCount: 5,
  cylinderPrimitiveCount: 5,
  torusPrimitiveCount: 0,
  boxPrimitiveCount: 0,
  spherePrimitiveCount: 0,
  pyramidPrimitiveCount: 0,
  supportPrimitiveCount: 0,
  deferredSupportPrimitiveCount: 2,
  blockedUnresolvedGeometryCount: 3,
  blockedPrimitiveCount: 3,
  missingDimensionCount: 0
}).ok, true, 'real primitive audit ok');

const exportModels = compileResolvedPrimitiveModelToExportModels(primitiveModel, primitiveAudit);
assert.equal(assertRvmExportModelContract(exportModels.rvmExportModel).ok, true, 'real RVM export model ok');
assert.equal(assertAttExportModelContract(exportModels.attExportModel).ok, true, 'real ATT export model ok');
assert.equal(assertGlbVisualModelContract(exportModels.glbVisualModel).ok, true, 'real GLB visual model ok');
assert.equal(exportModels.rvmExportModel.transformPolicy, 'final-review-transform.v1', 'final transform policy applied');
assert.equal(exportModels.rvmExportModel.transformApplied, true, 'RVM transformApplied true');
assertRealGeometryOracle(exportModels.rvmExportModel, oracle);

const exportAudit = buildExportModelCompilationAudit(primitiveModel, exportModels, primitiveAudit);
assert.equal(assertExportModelCompilationAudit(exportAudit, {
  ok: true,
  hardErrorCount: 0,
  transformPolicy: 'final-review-transform.v1',
  rvmTransformWarningCount: 0,
  navisTransformApplied: true,
  writerCallCount: 0,
  binaryPayloadCount: 0,
  textPayloadCount: 0,
  glbPayloadCount: 0,
  rvmPrimitivePlanCount: 5,
  rvmCylinderPlanCount: 5,
  rvmTorusPlanCount: 0,
  rvmBoxPlanCount: 0,
  rvmSpherePlanCount: 0,
  rvmPyramidPlanCount: 0,
  blockedUnresolvedExportCount: 3,
  deferredSupportExportCount: 2
}).ok, true, 'real export audit ok');

const writerAdapterPlan = buildWriterAdapterPlan(exportModels, exportAudit);
assert.equal(assertWriterAdapterPlanContract(writerAdapterPlan).ok, true, 'real writer plan validates');
const writerAdapterAudit = buildWriterAdapterAudit(writerAdapterPlan, exportModels, exportAudit);
assert.equal(assertWriterAdapterAudit(writerAdapterAudit, {
  ok: true,
  hardErrorCount: 0,
  rvmWriterReady: true,
  writerCallCount: 0,
  binaryPayloadCount: 0,
  textPayloadCount: 0,
  glbPayloadCount: 0,
  downloadSideEffectCount: 0,
  runtimeMutationCount: 0,
  rvmPlannedChunkCount: 5,
  rvmPlannedPrimChunkCount: 5,
  rvmPlannedCylinderCount: 5,
  rvmPlannedTorusCount: 0,
  rvmPlannedBoxCount: 0,
  rvmPlannedSphereCount: 0,
  rvmPlannedPyramidCount: 0,
  blockedUnresolvedWriterCount: 3,
  deferredSupportWriterCount: 2
}).ok, true, 'real writer audit ok');

const testArtifactPlan = buildTestArtifactAdapterPlan(exportModels, exportAudit, writerAdapterPlan, writerAdapterAudit);
assert.equal(assertTestArtifactAdapterPlanContract(testArtifactPlan).ok, true, 'real test artifact plan validates');
const testArtifactAudit = buildTestArtifactAdapterAudit(testArtifactPlan, exportModels, writerAdapterPlan, writerAdapterAudit);
assert.equal(assertTestArtifactAdapterAudit(testArtifactAudit, {
  ok: true,
  hardErrorCount: 0,
  rvmArtifactReady: false,
  rvmArtifactGenerated: false,
  rvmArtifactBlocked: true,
  rvmArtifactByteLength: 0,
  rvmTransformReady: true,
  rvmStraightPipeSubsetReady: true,
  sourceTraceCount: 10,
  tracedStraightPipeCount: 5,
  tracedBlockedFlangeCount: 1,
  tracedBlockedValveCount: 1,
  tracedBlockedBendCount: 1,
  tracedDeferredSupportCount: 2,
  runtimeTouched: false,
  browserTouched: false,
  canvasTouched: false,
  objectUrlCount: 0,
  downloadSideEffectCount: 0,
  cacheKeyMutationCount: 0
}).ok, true, 'real test artifact audit ok');

const byteProof = buildRvmTestArtifactByteProof(exportModels, exportAudit, writerAdapterPlan, writerAdapterAudit, testArtifactPlan, testArtifactAudit);
const byteProofRepeat = buildRvmTestArtifactByteProof(exportModels, exportAudit, writerAdapterPlan, writerAdapterAudit, testArtifactPlan, testArtifactAudit);
assert.equal(assertRvmTestArtifactByteProofContract(byteProof).ok, true, 'real byte proof validates');
assert.equal(byteProof.artifactGenerated, true, 'real byte proof generated');
assert.ok(byteProof.artifactByteLength > 0, 'real byte proof length positive');
assert.match(byteProof.checksumSha256, /^[0-9a-f]{64}$/, 'real byte proof checksum present');
assert.equal(byteProof.checksumSha256, byteProofRepeat.checksumSha256, 'real byte proof checksum is stable across adapter runs');
assert.equal(byteProof.artifactByteLength, byteProofRepeat.artifactByteLength, 'real byte proof length is stable across adapter runs');
assert.equal(byteProof.primitiveCount, 5, 'real byte proof writes five primitives');
assert.equal(byteProof.cylinderPrimitiveCount, 5, 'real byte proof writes five cylinders');
assert.equal(byteProof.torusPrimitiveCount, 0, 'real byte proof writes no TORUS/code4');
assert.equal(byteProof.boxPrimitiveCount, 0, 'real byte proof writes no boxes');
assert.equal(byteProof.spherePrimitiveCount, 0, 'real byte proof writes no spheres');
assert.equal(byteProof.pyramidPrimitiveCount, 0, 'real byte proof writes no pyramids');
assert.equal(byteProof.supportPrimitiveCount, 0, 'real byte proof writes no supports');
assert.equal(byteProof.blockedArtifactItems.filter((entry) => entry.family === 'valve').length, 1, 'real blocked valve excluded');
assert.equal(byteProof.blockedArtifactItems.filter((entry) => entry.family === 'flange').length, 1, 'real blocked flange excluded');
assert.equal(byteProof.blockedArtifactItems.filter((entry) => entry.family === 'elbow').length, 1, 'real blocked bend excluded');
assert.equal(byteProof.deferredArtifactItems.filter((entry) => entry.family === 'support').length, 2, 'real deferred supports excluded');

const byteAudit = buildRvmTestArtifactByteProofAudit(byteProof, exportModels, writerAdapterPlan, writerAdapterAudit, testArtifactAudit);
assert.equal(assertRvmTestArtifactByteProofAudit(byteAudit, {
  ok: true,
  hardErrorCount: 0,
  rvmStraightPipeSubsetArtifactReady: true,
  rvmFullModelArtifactReady: false,
  artifactGenerated: true,
  artifactBlocked: false,
  artifactChecksumPresent: true,
  byteHeaderPresent: true,
  sourceTraceCount: 10,
  tracedStraightPipeCount: 5,
  tracedBlockedFlangeCount: 1,
  tracedBlockedValveCount: 1,
  tracedBlockedBendCount: 1,
  tracedDeferredSupportCount: 2,
  primitiveWriteCount: 5,
  cylinderWriteCount: 5,
  torusWriteCount: 0,
  boxWriteCount: 0,
  sphereWriteCount: 0,
  pyramidWriteCount: 0,
  supportWriteCount: 0,
  blockedFlangeCount: 1,
  blockedValveCount: 1,
  blockedBendCount: 1,
  deferredSupportWriterCount: 2,
  rvmWriterCallCount: 1,
  attWriterCallCount: 0,
  glbWriterCallCount: 0,
  binaryPayloadGenerated: true,
  attTextPayloadGenerated: false,
  glbPayloadGenerated: false,
  runtimeTouched: false,
  browserTouched: false,
  canvasTouched: false,
  objectUrlCount: 0,
  downloadSideEffectCount: 0,
  productionPathMutationCount: 0,
  cacheKeyMutationCount: 0
}).ok, true, 'real byte proof audit ok');
assert.ok(byteAudit.artifactByteLength > 0, 'real audit byte length positive');
assert.equal(JSON.stringify({ byteProof, byteAudit }).includes('inputxml-chord-midpoint-not-arc-center'), false, 'bend chord midpoint never enters byte proof');
assert.equal(JSON.stringify({ byteProof, byteAudit }).includes('objectUrl'), false, 'no object URLs');
assert.equal(JSON.stringify({ byteProof, byteAudit }).includes('downloadUrl'), false, 'no download URLs');
assert.equal(JSON.stringify({ byteProof, byteAudit }).includes('attText'), false, 'no ATT payload');
assert.equal(JSON.stringify({ byteProof, byteAudit }).includes('glbBytes'), false, 'no GLB payload');

await runMinimalGoldenFixtureChecks();
await assertSourceGuards();

console.log('RVM real-geometry test byte artifact adapter tests passed');

async function runMinimalGoldenFixtureChecks() {
  const exportModelsFixture = await readJson('samples/artifact-adapters/rvm-byte-proof.input.export-models.json');
  const exportAuditFixture = await readJson('samples/artifact-adapters/rvm-byte-proof.input.export-audit.json');
  const writerAdapterPlanFixture = await readJson('samples/artifact-adapters/rvm-byte-proof.input.writer-adapter-plan.json');
  const writerAdapterAuditFixture = await readJson('samples/artifact-adapters/rvm-byte-proof.input.writer-adapter-audit.json');
  const testArtifactPlanFixture = await readJson('samples/artifact-adapters/rvm-byte-proof.input.test-artifact-plan.json');
  const testArtifactAuditFixture = await readJson('samples/artifact-adapters/rvm-byte-proof.input.test-artifact-audit.json');
  const expectedProof = await readJson('samples/artifact-adapters/rvm-byte-proof.expected.proof.json');
  const expectedAudit = await readJson('samples/artifact-adapters/rvm-byte-proof.expected.audit.json');
  const proof = buildRvmTestArtifactByteProof(exportModelsFixture, exportAuditFixture, writerAdapterPlanFixture, writerAdapterAuditFixture, testArtifactPlanFixture, testArtifactAuditFixture);
  assert.equal(assertRvmTestArtifactByteProofContract(proof).ok, true, 'minimal proof validates');
  assert.deepEqual(normalizeProof(proof), { ...expectedProof, supportPrimitiveCount: 0 }, 'minimal normalized proof matches golden fixture');
  for (const forbidden of ['objectUrl', 'downloadUrl', 'domNode', 'canvas', 'threeObject', 'threeGeometry', 'meshGeometry', 'runtimeMutation', 'userVisibleDownload', 'productionWrite', 'appStateMutation', 'cacheKeyMutation', 'attText', 'glbBytes', 'gltfJson', 'fileBlob']) {
    const bad = structuredClone(proof);
    bad.blockedArtifactItems[0][forbidden] = forbidden;
    const result = validateRvmTestArtifactByteProofContract(bad);
    assert.equal(result.ok, false, `contract rejects ${forbidden}`);
    assert.ok(result.errors.some((entry) => entry.includes(forbidden)), `error list mentions ${forbidden}`);
  }
  const noFinalPolicyModels = structuredClone(exportModelsFixture);
  noFinalPolicyModels.rvmExportModel.transformPolicy = 'phase7-authoring-to-navis-review.identity-placeholder.v1';
  const noFinalPolicyProof = buildRvmTestArtifactByteProof(noFinalPolicyModels, exportAuditFixture, writerAdapterPlanFixture, writerAdapterAuditFixture, testArtifactPlanFixture, testArtifactAuditFixture);
  assert.equal(noFinalPolicyProof.artifactGenerated, false, 'adapter refuses missing final policy');
  assert.ok(noFinalPolicyProof.errors.some((entry) => entry.includes('final-review-transform.v1')));
  const noTransformModels = structuredClone(exportModelsFixture);
  noTransformModels.rvmExportModel.transformApplied = false;
  const noTransformProof = buildRvmTestArtifactByteProof(noTransformModels, exportAuditFixture, writerAdapterPlanFixture, writerAdapterAuditFixture, testArtifactPlanFixture, testArtifactAuditFixture);
  assert.equal(noTransformProof.artifactGenerated, false, 'adapter refuses transformApplied false');
  assert.ok(noTransformProof.errors.some((entry) => entry.includes('transformApplied true')));
  const withTorus = structuredClone(exportModelsFixture);
  withTorus.rvmExportModel.primitives.push({ exportPrimitiveId: 'RVM-PRIM-ELBOW-1', sourcePrimitiveId: 'PRIM-ELBOW-1', sourceItemId: 'ELBOW-1', primitiveKind: 'TORUS', primitiveCode: 4, center: [0, 0, 0], axis: [0, 0, 1], lengthMm: 100, radiusMm: 10, basis: 'navis-review', transformPolicy: 'final-review-transform.v1' });
  const torusProof = buildRvmTestArtifactByteProof(withTorus, exportAuditFixture, writerAdapterPlanFixture, writerAdapterAuditFixture, testArtifactPlanFixture, testArtifactAuditFixture);
  assert.equal(torusProof.artifactGenerated, false, 'adapter refuses mixed TORUS primitive plans');
  const audit = buildRvmTestArtifactByteProofAudit(proof, exportModelsFixture, writerAdapterPlanFixture, writerAdapterAuditFixture, testArtifactAuditFixture);
  assert.deepEqual(normalizeAudit(audit), expectedAudit, 'minimal normalized audit matches golden fixture');
}

function assertRealGeometryOracle(rvmExportModel, expected) {
  const bySourceItemId = new Map(rvmExportModel.primitives.map((primitive) => [primitive.sourceItemId, primitive]));
  assert.equal(expected.pipes.length, 5, 'oracle pipe count');
  for (const pipe of expected.pipes) {
    const primitive = bySourceItemId.get(pipe.sourceItemId);
    assert.ok(primitive, `missing export primitive for ${pipe.sourceItemId}`);
    assert.equal(primitive.primitiveKind, pipe.primitiveKind, `${pipe.sourceItemId} primitive kind`);
    assert.equal(Number(primitive.primitiveCode), pipe.primitiveCode, `${pipe.sourceItemId} primitive code`);
    assertAlmostArray(primitive.center, pipe.navisCenter, expected.metricToleranceMm, `${pipe.sourceItemId} navis center`);
    assertAlmostArray(primitive.axis, pipe.navisAxis, expected.axisTolerance, `${pipe.sourceItemId} navis axis`);
    assertAlmost(Math.hypot(...primitive.axis), 1, expected.axisTolerance, `${pipe.sourceItemId} normalized axis`);
    assertAlmost(Number(primitive.lengthMm), pipe.lengthMm, expected.metricToleranceMm, `${pipe.sourceItemId} length`);
    assertAlmost(Number(primitive.radiusMm), pipe.radiusMm, expected.metricToleranceMm, `${pipe.sourceItemId} radius`);
  }
}

async function assertSourceGuards() {
  const adapterSource = await readFile('src/artifact-adapters/rvm-test-byte-artifact-adapter.js', 'utf8');
  assert.match(adapterSource, /\.\.\/rvm-writer\.js/, 'byte adapter may import rvm-writer.js only here');
  for (const forbidden of ['app.js', 'safe-ui-loader', 'app-loader', 'managed-stage-json-ui-controller', 'managed-stage-rvm-converter', "from 'three'", 'from "three"', 'window.', 'document.', 'createObjectURL']) {
    assert.equal(adapterSource.includes(forbidden), false, `byte adapter must not reference ${forbidden}`);
  }
  for (const runtimePath of ['src/app.js', 'src/safe-ui-loader.js', 'src/app-loader.js', 'src/managed-stage-json-ui-controller.js', 'src/managed-stage-rvm-converter.js']) {
    const source = await readFile(runtimePath, 'utf8');
    assert.equal(source.includes('rvm-test-byte-artifact-adapter'), false, `${runtimePath} must not import byte proof adapter`);
  }
}

function assertAlmostArray(actual, expected, tolerance, label) {
  assert.equal(actual.length, expected.length, `${label} length`);
  actual.forEach((value, index) => assertAlmost(Number(value), Number(expected[index]), tolerance, `${label}[${index}]`));
}

function assertAlmost(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

function normalizeProof(value) {
  return { ...value, artifactByteLength: 1, checksumSha256: '0000000000000000000000000000000000000000000000000000000000000000', byteHeaderHex: '0000' };
}

function normalizeAudit(value) {
  return { ...value, artifactByteLength: 1 };
}

async function loadBasePipingCatalogueItems() {
  const registryPath = 'catalogues/base-piping/catalogue-registry.json';
  const indexPath = 'catalogues/base-piping/base-piping.index.json';
  const itemPaths = ['catalogues/base-piping/items/pipe-straight-4in-std.json', 'catalogues/base-piping/items/elbow-90lr-4in-std.json', 'catalogues/base-piping/items/support-rest-generic.json'];
  const registryResult = loadCatalogueRegistryFromText(await readFile(registryPath, 'utf8'), { sourceName: registryPath });
  assert.equal(registryResult.validation.ok, true);
  const fileMap = new Map();
  fileMap.set(indexPath, await readFile(indexPath, 'utf8'));
  for (const itemPath of itemPaths) fileMap.set(itemPath, await readFile(itemPath, 'utf8'));
  const itemResult = loadCatalogueItemsFromMap(registryResult.registry, fileMap, { sourceName: indexPath });
  assert.equal(itemResult.audit.itemCount, 3);
  assert.equal(itemResult.audit.invalidItemCount, 0);
  return itemResult.items;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
