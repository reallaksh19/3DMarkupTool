import assert from 'node:assert/strict';
import {
  MANAGED_STAGE_SUPPORT_MAPPER_DIAGNOSTICS_UI_SCHEMA,
  buildManagedStageSupportMapperDiagnosticsRows,
  supportMapperDiagnosticsSummary,
  renderManagedStageSupportMapperDiagnostics
} from '../src/managed-stage-support-mapper-diagnostics-ui.js';

const diagnostics = {
  schema: 'ManagedStageSupportSourcePreviewDiagnostics.v1',
  sourceMode: 'isonote',
  status: 'isonote',
  mapperConfigApplied: true,
  pipeRecordCount: 2,
  stagedJsonSupportRecordCount: 0,
  isonoteSupportRecordCount: 3,
  supportSymbolCount: 3,
  stagedJsonSymbolCount: 0,
  isonoteSymbolCount: 3,
  supportVisualPartCount: 9,
  axisBasisAppliedCount: 2,
  mapperPreflightIssueCount: 1,
  mapperPreflightWarningCount: 1,
  mapperPreflightErrorCount: 0,
  mapperPreflightPopupRequiredCount: 1,
  popupRequiredCount: 1,
  warningCount: 1,
  gapRecordScopedCount: 2,
  gapCarryForwardViolationCount: 0,
  maxGapVisualSeparationMm: 70,
  maxGlyphLengthMm: 182,
  supportFamilyHistogram: { REST: 1, GUIDE: 1, LINESTOP: 1 },
  supportCanvasAxisHistogram: { '+Y': 1, '+Z': 2 },
  activeSourceExclusive: true,
  pass: true
};

assert.equal(MANAGED_STAGE_SUPPORT_MAPPER_DIAGNOSTICS_UI_SCHEMA, 'ManagedStageSupportMapperDiagnosticsUi.v1');

const rows = buildManagedStageSupportMapperDiagnosticsRows(diagnostics);
assert.equal(rows.some((row) => row.key === 'sourceMode' && row.value === 'isonote'), true);
assert.equal(rows.some((row) => row.key === 'supportSymbolCount' && row.value === '3'), true);
assert.equal(rows.some((row) => row.key === 'mapperPreflightIssueCount' && row.value === '1'), true);
assert.equal(rows.some((row) => row.key === 'mapperPreflightPopupRequiredCount' && row.value === '1'), true);
assert.equal(rows.some((row) => row.key === 'gapCarryForwardViolationCount' && row.value === '0'), true);
assert.equal(rows.some((row) => row.key === 'supportFamilyHistogram' && row.value.includes('GUIDE:1')), true);
assert.equal(rows.some((row) => row.key === 'supportCanvasAxisHistogram' && row.value.includes('+Z:2')), true);

const summary = supportMapperDiagnosticsSummary(diagnostics);
assert.equal(summary.includes('isonote'), true);
assert.equal(summary.includes('symbols 3'), true);
assert.equal(summary.includes('preflight 0E/1W'), true);
assert.equal(summary.includes('gap carry-forward 0'), true);
assert.equal(summary.endsWith('PASS.'), true);

const html = renderManagedStageSupportMapperDiagnostics(diagnostics);
assert.equal(html.includes('Support mapper diagnostics'), true);
assert.equal(html.includes('Mapper preflight issues'), true);
assert.equal(html.includes('Family histogram'), true);
assert.equal(html.includes('REST:1'), true);
assert.equal(html.includes('+Z:2'), true);

const failingSummary = supportMapperDiagnosticsSummary({ ...diagnostics, pass: false, mapperPreflightErrorCount: 1, gapCarryForwardViolationCount: 1 });
assert.equal(failingSummary.includes('preflight 1E/1W'), true);
assert.equal(failingSummary.includes('gap carry-forward 1'), true);
assert.equal(failingSummary.endsWith('CHECK.'), true);

console.log('managed-stage support mapper diagnostics UI: ok');