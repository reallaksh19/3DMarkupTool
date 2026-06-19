import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  assertContractDryRunReport,
  buildContractDryRunReport
} from '../src/contract-dry-run-report.js';

function phase(name, fn) {
  fn();
  console.log(`✔ ${name}`);
}

const fixturePath = path.resolve('fixtures/contract-dry-run/inputxml-delegated-fittings.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const report = buildContractDryRunReport(fixture, {
  sourceLabel: 'inputxml-delegated-fittings-fixture',
  generatedAt: 'TEST_RUN'
});

phase('report satisfies stable report schema', () => {
  assert.equal(report.schemaVersion, 'ContractDryRunReport.v1');
  assert.equal(report.dryRunSchemaVersion, 'ContractDryRun.v1');
  assert.equal(report.sourceLabel, 'inputxml-delegated-fittings-fixture');
  assert.equal(report.generatedAt, 'TEST_RUN');
  assert.equal(report.status, 'PASS');
  assertContractDryRunReport(report);
});

phase('report carries required diagnostics and phase counts', () => {
  assert.equal(report.diagnostics.sourceRecordsTotal, 5);
  assert.equal(report.diagnostics.componentsTotal, 5);
  assert.equal(report.diagnostics.geometryContractsTotal, 5);
  assert.equal(report.diagnostics.exportPlansTotal, 2);
  assert.equal(report.phaseCounts.sourceRecordsTotal, 5);
  assert.equal(report.phaseCounts.componentsTotal, 5);
  assert.equal(report.phaseCounts.geometryContractsTotal, 5);
  assert.equal(report.phaseCounts.exportPlansTotal, 2);
});

phase('report proves InputXML bend/tee fallback is explicit', () => {
  assert.deepEqual(new Set(report.diagnostics.inputXmlDelegatedFittings), new Set(['BEND_20_30', 'TEE_30_40']));
  assert.equal(report.acceptance.inputXmlFittingsDelegated, true);
  assert.equal(report.acceptance.fallbackExplicit, true);
  assert.equal(report.diagnostics.renderPlansByTarget.GLB.byPrimitiveKind.LEGACY_FALLBACK_REF, 2);
  assert.equal(report.warnings.some((warning) => warning.code === 'INPUTXML_FITTINGS_DELEGATED_TO_LEGACY'), true);
});

phase('report proves records are not dropped and unknown remains unknown', () => {
  assert.equal(report.acceptance.noDroppedRecords, true);
  assert.equal(report.acceptance.unknownPreserved, true);
  assert.deepEqual(report.diagnostics.unknownComponents, ['UNMAPPED_1']);
  assert.equal(report.diagnostics.componentsByClass.UNKNOWN, 1);
});

phase('report proves downstream boundaries and export metadata parity', () => {
  assert.equal(report.acceptance.downstreamRawPayloadRejected, true);
  assert.equal(report.acceptance.glbAndRvmShareStableMetadata, true);
  assert.deepEqual(report.samples.exportTargets, ['GLB', 'RVM_ATT']);
});

phase('report status fails if an acceptance gate is false', () => {
  const corrupted = {
    ...report,
    acceptance: {
      ...report.acceptance,
      fallbackExplicit: false
    },
    status: 'PASS'
  };

  assert.throws(
    () => assertContractDryRunReport(corrupted),
    /status must be FAIL/
  );
});
