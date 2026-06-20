import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalogue = readFileSync(new URL('../src/valve-flange-visual-catalog.js', import.meta.url), 'utf8');
const adapter = readFileSync(new URL('../src/valve-flange-primitive-adapter.js', import.meta.url), 'utf8');
const converter = readFileSync(new URL('../src/converter.js', import.meta.url), 'utf8');
const exportModel = readFileSync(new URL('../src/export-model.js', import.meta.url), 'utf8');
const rvmConverter = readFileSync(new URL('../src/rvm-converter.js', import.meta.url), 'utf8');
const rvmWiring = readFileSync(new URL('../src/rvm-catalogue-export-wiring.js', import.meta.url), 'utf8');
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
  adapter,
  /VALVE_FLANGE_PRIMITIVE_ADAPTER_SCHEMA/,
  'C2 adapter must define a shared primitive adapter schema.'
);

assert.match(
  adapter,
  /buildValveFlangePrimitiveAdapterPlan/,
  'C2 adapter must expose a shared renderer-neutral primitive plan builder.'
);

assert.match(
  adapter,
  /productionRvmExportEnabled: false/,
  'C2 adapter must remain a neutral bridge and must not itself write production RVM.'
);

assert.doesNotMatch(
  adapter,
  /from 'three'|from "three"/,
  'C2 shared adapter must not depend on Three.js.'
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
  /valve-flange-visual-catalog|valve-flange-primitive-adapter|rvm-catalogue-primitive-translator/,
  'C3B keeps export-model.js as the neutral base tree builder; catalogue parity is applied at the production RVM converter boundary.'
);

assert.match(
  exportModel,
  /kind:\s*['"]cylinder['"]/,
  'Neutral export model must retain simplified cylinder fallback primitives for non-catalogue and base-tree paths.'
);

assert.match(
  rvmWiring,
  /applyRvmCatalogueExportParity/,
  'C3B must provide a production wiring step for RVM catalogue parity.'
);

assert.match(
  rvmWiring,
  /buildRvmValveFlangeCatalogueExport/,
  'C3B wiring must consume the C3 writer-safe catalogue translator.'
);

assert.match(
  rvmWiring,
  /CATALOGUE_EXPORT_PRODUCTION_WIRING/,
  'C3B wiring must expose production wiring metadata into ATT attributes.'
);

assert.match(
  rvmConverter,
  /buildRvmExportModel[\s\S]*applyRvmCatalogueExportParity[\s\S]*normalizeNavisExportModelNames/,
  'Production RVM converter must build the base export model, apply catalogue parity, then normalize Navis names.'
);

assert.match(
  auditDoc,
  /Current catalogue = proportional GLB visual fallback/,
  'Audit document must classify current catalogue scope.'
);

assert.match(
  auditDoc,
  /C3B production RVM converter now applies catalogue parity/,
  'Audit document must record the current C3B production wiring status.'
);

assert.match(
  auditDoc,
  /C2 — Shared valve\/flange primitive adapter/,
  'Audit document must define the shared primitive adapter phase.'
);

assert.match(
  auditDoc,
  /Status: complete when `src\/valve-flange-primitive-adapter\.js`/,
  'Audit document must record C2 adapter completion criteria.'
);

assert.match(
  auditDoc,
  /C3B — Production RVM catalogue export wiring/,
  'Audit document must define the production RVM parity wiring phase.'
);

assert.match(
  pkg.scripts.test,
  /valve-flange-catalog-scope-audit\.test\.mjs/,
  'npm test must include the valve/flange catalogue scope audit gate.'
);

console.log('valve/flange catalogue scope audit gate passed');
