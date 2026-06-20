import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalogue = readFileSync(new URL('../src/valve-flange-visual-catalog.js', import.meta.url), 'utf8');
const converter = readFileSync(new URL('../src/converter.js', import.meta.url), 'utf8');
const exportModel = readFileSync(new URL('../src/export-model.js', import.meta.url), 'utf8');
const rvmConverter = readFileSync(new URL('../src/rvm-converter.js', import.meta.url), 'utf8');
const auditDoc = readFileSync(new URL('../docs/core-valve-flange-catalog-audit.md', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(
  catalogue,
  /Canvas visual catalogue, not an ASME dimensional database/,
  'Valve/flange catalogue must remain clearly labelled as a proportional visual fallback until a dimensional DB exists.'
);

assert.match(
  catalogue,
  /VALVE_FLANGED/,
  'Catalogue must retain flanged valve profile coverage.'
);

assert.match(
  catalogue,
  /FLANGE_WELD_NECK/,
  'Catalogue must retain weld-neck flange profile coverage.'
);

assert.match(
  catalogue,
  /buildLinearVisualPrimitivePlan/,
  'Catalogue must expose a linear primitive plan builder.'
);

assert.match(
  catalogue,
  /validateLinearVisualPrimitiveContinuity/,
  'Catalogue must retain continuity guardrails for proportional visual plans.'
);

assert.match(
  converter,
  /getValveFlangeVisualSpec/,
  'GLB converter must use the valve/flange visual catalogue resolver.'
);

assert.match(
  converter,
  /buildLinearVisualPrimitivePlan/,
  'GLB converter must render catalogue primitive plans.'
);

assert.doesNotMatch(
  exportModel,
  /valve-flange-visual-catalog/,
  'Audit baseline: RVM export-model does not yet import the valve/flange catalogue. This must only change in the future RVM parity implementation PR.'
);

assert.match(
  exportModel,
  /kind:\s*['"]cylinder['"]/,
  'Audit baseline: RVM export still emits simplified cylinder primitives for component bodies.'
);

assert.doesNotMatch(
  exportModel,
  /FLANGE_PLATE|RAISED_FACE|VALVE_BODY|TAPERED_SHOULDER/,
  'Audit baseline: RVM export does not yet emit catalogue primitive roles for valve/flange components.'
);

assert.match(
  rvmConverter,
  /buildRvmExportModel/,
  'RVM converter must continue using the renderer-neutral export model boundary.'
);

assert.match(
  auditDoc,
  /Current catalogue = proportional GLB visual fallback/,
  'Audit document must classify current catalogue scope.'
);

assert.match(
  auditDoc,
  /RVM export does not yet use the catalogue/,
  'Audit document must record the current RVM parity gap.'
);

assert.match(
  auditDoc,
  /C2 — Shared valve\/flange primitive adapter/,
  'Audit document must define the next implementation phase.'
);

assert.match(
  auditDoc,
  /C3 — RVM catalogue export parity/,
  'Audit document must define the RVM parity phase.'
);

assert.match(
  pkg.scripts.test,
  /valve-flange-catalog-scope-audit\.test\.mjs/,
  'npm test must include the valve/flange catalogue scope audit gate.'
);

console.log('valve/flange catalogue scope audit gate passed');
