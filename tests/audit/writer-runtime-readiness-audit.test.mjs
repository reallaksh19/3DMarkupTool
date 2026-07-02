import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertWriterRuntimeReadinessAudit,
  buildWriterRuntimeReadinessAudit,
  buildRvmWriterReadinessRows,
  traceWriterAdapterReadiness,
  validateWriterRuntimeReadinessAudit
} from '../../src/diagnostics/writer-runtime-readiness-audit.js';

const exportModels = await readJson('samples/writer-adapters/minimal-writer-adapter.input.export-models.json');
const phase01Audit = {
  schema: 'NewCoreReadinessAudit.v1',
  graphId: exportModels.rvmExportModel.graphId,
  sourceName: 'minimal-writer-adapter.input.export-models.json',
  ok: true,
  hardErrorCount: 0,
  errors: [],
  warnings: []
};

const phase02Models = withPhase02PolicyRows(exportModels);
const audit = buildWriterRuntimeReadinessAudit({ ...phase02Models, newCoreReadinessAudit: phase01Audit }, {
  changedFiles: ['src/diagnostics/writer-runtime-readiness-audit.js', 'tests/audit/writer-runtime-readiness-audit.test.mjs', 'docs/migration/phase-02-writer-runtime-proof.md']
});

assert.equal(audit.schema, 'WriterRuntimeReadinessAudit.v1');
assert.equal(audit.ok, true, audit.errors.join('\n'));
assert.equal(validateWriterRuntimeReadinessAudit(audit).ok, true);
assert.equal(assertWriterRuntimeReadinessAudit(audit).ok, true);
assert.equal(audit.runtimeUnchanged, true);
assert.equal(audit.runtimeFilesChanged, false);
assert.equal(audit.productionWriterCalled, false);
assert.equal(audit.binaryArtifactGenerated, false);

const rvmExpectedRows = phase02Models.rvmExportModel.primitives.length + phase02Models.rvmExportModel.testByteEligiblePrimitives.length + phase02Models.rvmExportModel.deferredExports.length + phase02Models.rvmExportModel.blockedExports.length;
assert.equal(rowsFor(audit, 'RvmExportModel.v1').length, rvmExpectedRows);
assert.equal(rowsFor(audit, 'AttExportModel.v1').length, phase02Models.attExportModel.records.length + phase02Models.attExportModel.deferredRecords.length + phase02Models.attExportModel.blockedRecords.length);
assert.equal(rowsFor(audit, 'GlbVisualModel.v1').length, phase02Models.glbVisualModel.visualItems.length + phase02Models.glbVisualModel.deferredVisuals.length + phase02Models.glbVisualModel.blockedVisuals.length);

const cylinder = audit.traceRows.find((row) => row.exportRowId === 'RVM-PRIM-PIPE-1');
assert.equal(cylinder.readinessStatus, 'dry-run-ready');
const torus = audit.traceRows.find((row) => row.exportRowId === 'RVM-PRIM-BEND-1');
assert.equal(torus.primitiveKind, 'TORUS');
assert.equal(Number(torus.primitiveCode), 4);
assert.equal(torus.readinessStatus, 'test-byte-only');
assert.match(torus.reason, /TORUS\/code4|test-byte-only/i);
const flange = audit.traceRows.find((row) => row.sourceItemId === 'FLANGE-1' && row.exportModel === 'RvmExportModel.v1');
assert.equal(flange.primitiveKind, 'FLANGE_CYLINDER');
assert.equal(flange.readinessStatus, 'deferred');
const support = audit.traceRows.find((row) => row.sourceItemId === 'SUPPORT-1' && row.exportModel === 'RvmExportModel.v1');
assert.equal(support.readinessStatus, 'deferred');

const unsupportedAudit = buildWriterRuntimeReadinessAudit({ ...withUnsupportedPrimitive(phase02Models), newCoreReadinessAudit: phase01Audit });
assert.equal(unsupportedAudit.ok, false);
assert.ok(unsupportedAudit.errors.some((entry) => entry.includes('unsupported primitive')));
assert.ok(unsupportedAudit.traceRows.some((row) => row.exportRowId === 'RVM-PRIM-CONE-1' && row.readinessStatus === 'blocked'));

const missingPhase01 = buildWriterRuntimeReadinessAudit(phase02Models);
assert.equal(missingPhase01.ok, false);
assert.ok(missingPhase01.errors.some((entry) => entry.includes('NewCoreReadinessAudit.v1 is missing')));
const badPhase01 = buildWriterRuntimeReadinessAudit({ ...phase02Models, newCoreReadinessAudit: { ...phase01Audit, ok: false, hardErrorCount: 1, errors: ['phase 01 failed'] } });
assert.equal(badPhase01.ok, false);
assert.ok(badPhase01.errors.some((entry) => entry.includes('not OK')));

const runtimeChanged = buildWriterRuntimeReadinessAudit({ ...phase02Models, newCoreReadinessAudit: phase01Audit }, { changedFiles: ['src/rvm-writer.js'] });
assert.equal(runtimeChanged.ok, false);
assert.ok(runtimeChanged.errors.some((entry) => entry.includes('Production runtime files')));
const coreChanged = buildWriterRuntimeReadinessAudit({ ...phase02Models, newCoreReadinessAudit: phase01Audit }, { changedFiles: ['src/contracts/index.js'] });
assert.equal(coreChanged.ok, false);
assert.ok(coreChanged.errors.some((entry) => entry.includes('Core contract')));
const catalogueLookup = buildWriterRuntimeReadinessAudit({ ...phase02Models, newCoreReadinessAudit: phase01Audit }, { writerAdapterCatalogueLookup: true });
assert.equal(catalogueLookup.ok, false);
assert.ok(catalogueLookup.errors.some((entry) => entry.includes('catalogue lookup')));
const geometrySolving = buildWriterRuntimeReadinessAudit({ ...phase02Models, newCoreReadinessAudit: phase01Audit }, { writerAdapterSolvesGeometry: true });
assert.equal(geometrySolving.ok, false);
assert.ok(geometrySolving.errors.some((entry) => entry.includes('solves geometry')));
const secondTransform = buildWriterRuntimeReadinessAudit({ ...phase02Models, newCoreReadinessAudit: phase01Audit }, { secondFinalReviewTransformApplied: true });
assert.equal(secondTransform.ok, false);
assert.ok(secondTransform.errors.some((entry) => entry.includes('second Navis/final-review transform')));

assert.ok(buildRvmWriterReadinessRows(phase02Models.rvmExportModel, null, null).length >= rvmExpectedRows);
assert.deepEqual(traceWriterAdapterReadiness({ writerStatus: 'testByteEligible', reason: 'test only' }), { readinessStatus: 'test-byte-only', reason: 'test only' });

console.log('writer runtime readiness audit tests passed');

function withPhase02PolicyRows(base) {
  const copy = structuredClone(base);
  copy.rvmExportModel.testByteEligiblePrimitives = [
    {
      exportPrimitiveId: 'RVM-PRIM-BEND-1',
      sourcePrimitiveId: 'PRIM-BEND-1',
      sourceItemId: 'BEND-1',
      primitiveKind: 'TORUS',
      primitiveCode: 4,
      center: [1000, 0, 0],
      normal: [0, 0, 1],
      startTangent: [1, 0, 0],
      endTangent: [0, 1, 0],
      majorRadiusMm: 500,
      tubeRadiusMm: 57.15,
      bendAngleDeg: 90,
      sweepAngleDeg: 90,
      basis: 'navis-review',
      transformPolicy: 'final-review-transform.v1',
      transformApplied: true,
      writerReady: false,
      testByteEligible: true,
      byteBridge: 'test-only',
      resolver: 'bendArcTorusPrimitive.v1',
      reason: 'TORUS/code4 is test-byte-only',
      sourceRef: 'fixture/BEND-1',
      evidence: { centerSource: 'explicit-bend-arc-center' }
    }
  ];
  copy.rvmExportModel.deferredExports = [
    ...copy.rvmExportModel.deferredExports.map((entry) => entry.sourceItemId === 'SUPPORT-1' ? { ...entry, sourcePrimitiveId: 'PRIM-SUPPORT-1', primitiveKind: 'SUPPORT_INTENT', reason: 'support remains support-intent-only/deferred in Phase 02' } : entry),
    { sourceItemId: 'FLANGE-1', sourcePrimitiveId: 'PRIM-FLANGE-1', family: 'flange', type: 'flange', primitiveKind: 'FLANGE_CYLINDER', primitiveCode: 8, exportStatus: 'deferred', reason: 'flange writer bridge remains deferred until byte proof exists', sourceRef: 'fixture/FLANGE-1' }
  ];
  return copy;
}

function withUnsupportedPrimitive(base) {
  const copy = structuredClone(base);
  copy.rvmExportModel.primitives = [
    ...copy.rvmExportModel.primitives,
    { exportPrimitiveId: 'RVM-PRIM-CONE-1', sourcePrimitiveId: 'PRIM-CONE-1', sourceItemId: 'CONE-1', primitiveKind: 'CONE', primitiveCode: 99, center: [0, 0, 0], axis: [1, 0, 0], lengthMm: 100, radiusMm: 10, basis: 'navis-review', transformPolicy: 'final-review-transform.v1', sourceRef: 'fixture/CONE-1' }
  ];
  return copy;
}

function rowsFor(audit, exportModel) {
  return audit.traceRows.filter((row) => row.exportModel === exportModel);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
