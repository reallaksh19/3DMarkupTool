import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildRvmValveFlangeCatalogueExport,
  buildRvmValveFlangeCataloguePrimitives,
  RVM_CATALOGUE_PRIMITIVE_TRANSLATOR_SCHEMA,
  RVM_CATALOGUE_SUPPORTED_PRIMITIVE_KINDS
} from '../src/rvm-catalogue-primitive-translator.js';
import { writeRvm } from '../src/rvm-writer.js';
import { writeAtt } from '../src/att-writer.js';

const translatorSource = readFileSync(new URL('../src/rvm-catalogue-primitive-translator.js', import.meta.url), 'utf8');
const rvmWriterSource = readFileSync(new URL('../src/rvm-writer.js', import.meta.url), 'utf8');
const primitiveKindContractSource = readFileSync(new URL('../src/rvm-primitive-kind-contract.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const supportedRvmKindSet = new Set(RVM_CATALOGUE_SUPPORTED_PRIMITIVE_KINDS);

const flangedValve = {
  id: 'PE_004_VALVE_40_TO_50',
  rawType: 'FLANGED_VALVE',
  type: 'RIGID',
  props: {
    id: 'PE_004_VALVE_40_TO_50',
    type: 'FLANGED_VALVE',
    bore: 100,
    rigidLength: 1000,
    rigidType: 'FLANGED_VALVE'
  }
};

const flangePair = {
  id: 'PE_005_FLANGE_50_TO_60',
  rawType: 'FLANGE_WELD_NECK',
  type: 'RIGID',
  props: {
    id: 'PE_005_FLANGE_50_TO_60',
    type: 'FLANGE_WELD_NECK',
    bore: 150,
    rigidLength: 800,
    rigidType: 'WELD_NECK_FLANGE'
  }
};

const valveExport = buildRvmValveFlangeCatalogueExport(
  flangedValve,
  { length: 1000, pipeRadius: 50 },
  { start: [0, 0, 0], end: [1000, 0, 0], material: 27, namePrefix: flangedValve.id }
);
assert.ok(valveExport, 'Flanged valve must translate to an RVM catalogue export bundle.');
assert.equal(valveExport.schemaVersion, RVM_CATALOGUE_PRIMITIVE_TRANSLATOR_SCHEMA);
assert.equal(valveExport.componentClass, 'VALVE');
assert.equal(valveExport.componentType, 'VALVE_FLANGED');
assert.equal(valveExport.attributes.CATALOGUE_VISUAL, 'TRUE');
assert.equal(valveExport.attributes.CATALOGUE_CLASS, 'VALVE');
assert.equal(valveExport.attributes.CATALOGUE_TYPE, 'VALVE_FLANGED');
assert.equal(valveExport.attributes.PROPORTIONAL_FALLBACK, 'TRUE');
assert.equal(valveExport.attributes.ASME_DIMENSIONAL_DB_BACKED, 'FALSE');
assert.equal(valveExport.attributes.RVM_CATALOGUE_PARITY, 'TRUE');
assert.ok(valveExport.primitives.length >= 7, 'Flanged valve must emit segmented RVM catalogue primitives.');
assert.ok(valveExport.primitives.some((primitive) => /END_COLLAR_A/.test(primitive.name)), 'Valve export must include first end collar.');
assert.ok(valveExport.primitives.some((primitive) => /VALVE_NECK_A/.test(primitive.name)), 'Valve export must include stepped/taper neck primitives.');
assert.ok(valveExport.primitives.some((primitive) => /VALVE_BODY/.test(primitive.name)), 'Valve export must include compact body primitive.');
assert.ok(valveExport.primitives.some((primitive) => /END_COLLAR_B/.test(primitive.name)), 'Valve export must include second end collar.');

const flangeExport = buildRvmValveFlangeCatalogueExport(
  flangePair,
  { length: 800, pipeRadius: 75 },
  { start: [0, 0, 0], end: [0, 800, 0], material: 26, namePrefix: flangePair.id }
);
assert.ok(flangeExport, 'Weld-neck flange must translate to an RVM catalogue export bundle.');
assert.equal(flangeExport.componentClass, 'FLANGE');
assert.equal(flangeExport.componentType, 'FLANGE_WELD_NECK');
assert.equal(flangeExport.attributes.CATALOGUE_CLASS, 'FLANGE');
assert.equal(flangeExport.attributes.CATALOGUE_TYPE, 'FLANGE_WELD_NECK');
assert.ok(flangeExport.primitives.some((primitive) => /WELD_NECK/.test(primitive.name)), 'Flange export must include weld neck primitives.');
assert.ok(flangeExport.primitives.some((primitive) => /FLANGE_DISC/.test(primitive.name)), 'Flange export must include flange disc primitives.');
assert.ok(flangeExport.primitives.some((primitive) => /RAISED_FACE/.test(primitive.name)), 'Flange export must include raised face primitives.');
assert.ok(flangeExport.primitives.some((primitive) => /GASKET/.test(primitive.name)), 'Flange export must include gasket primitive.');
assert.ok(flangeExport.primitives.some((primitive) => /BOLT/.test(primitive.name)), 'Flange export must expand bolt pattern into writer-safe primitives.');

const combined = [...valveExport.primitives, ...flangeExport.primitives];
const emittedKinds = new Set(combined.map((primitive) => primitive.kind));
for (const kind of emittedKinds) {
  assert.ok(supportedRvmKindSet.has(kind), `Translated primitive kind ${kind} must be writer-supported.`);
}
assert.deepEqual(
  [...emittedKinds].sort(),
  [...emittedKinds].filter((kind) => ['cylinder', 'box', 'pyramid', 'sphere'].includes(kind)).sort(),
  'Translated catalogue primitives must not leak adapter-only kinds into RVM export.'
);

const adapterPrimitives = buildRvmValveFlangeCataloguePrimitives(
  flangedValve,
  { length: 1000, pipeRadius: 50 },
  { start: [0, 0, 0], end: [1000, 0, 0], material: 27, namePrefix: flangedValve.id }
);
assert.ok(adapterPrimitives.some((primitive) => primitive.sourceKind === 'frustum'), 'Frustum adapter hints should be tracked as sourceKind.');
assert.ok(adapterPrimitives.every((primitive) => supportedRvmKindSet.has(primitive.kind)), 'All translated primitive kinds must be writer-safe.');

const exportModel = {
  root: {
    name: 'INPUTXML_RVM_ROOT',
    material: 12,
    attributes: { TYPE: 'MODEL_ROOT', SOURCE: 'InputXML', EXPORT_FORMAT: 'RVM_ATT', TARGET_VIEWER: 'Navisworks' },
    primitives: [],
    children: [{
      name: 'PLANT_GEOMETRY',
      material: 12,
      attributes: { TYPE: 'GROUP', ROLE: 'PLANT_GEOMETRY' },
      primitives: [],
      children: [
        {
          name: 'VALVE_NODE',
          material: 27,
          attributes: { TYPE: 'COMPONENT', ENGINEERING_TYPE: 'VALVE', ...valveExport.attributes },
          primitives: valveExport.primitives,
          children: []
        },
        {
          name: 'FLANGE_NODE',
          material: 26,
          attributes: { TYPE: 'COMPONENT', ENGINEERING_TYPE: 'FLANGE', ...flangeExport.attributes },
          primitives: flangeExport.primitives,
          children: []
        }
      ]
    }]
  }
};

const rvmBuffer = writeRvm(exportModel);
assert.ok(rvmBuffer instanceof ArrayBuffer, 'RVM writer must accept translated catalogue primitives.');
assert.ok(rvmBuffer.byteLength > 0, 'RVM writer must produce binary output for catalogue primitives.');

const attText = writeAtt(exportModel);
assert.match(attText, /CADC_Attributes_File v1\.0/, 'ATT must retain the expected Navisworks-readable header.');
assert.match(attText, /CATALOGUE_VISUAL := 'TRUE'/, 'ATT must expose catalogue visual status.');
assert.match(attText, /CATALOGUE_CLASS := 'VALVE'/, 'ATT must expose valve catalogue class.');
assert.match(attText, /CATALOGUE_TYPE := 'VALVE_FLANGED'/, 'ATT must expose valve catalogue type.');
assert.match(attText, /CATALOGUE_TYPE := 'FLANGE_WELD_NECK'/, 'ATT must expose flange catalogue type.');
assert.match(attText, /PROPORTIONAL_FALLBACK := 'TRUE'/, 'ATT must expose proportional fallback status.');
assert.match(attText, /ASME_DIMENSIONAL_DB_BACKED := 'FALSE'/, 'ATT must prevent ASME/rating-size overclaim.');
assert.match(attText, /RVM_CATALOGUE_PARITY := 'TRUE'/, 'ATT must expose RVM catalogue parity status.');

assert.match(rvmWriterSource, /Unsupported RVM primitive kind/, 'RVM writer must continue rejecting unsupported primitive kinds explicitly.');
assert.match(rvmWriterSource, /rvmPrimitiveCodeForKind/, 'RVM writer must use the central primitive-kind contract.');
assert.match(primitiveKindContractSource, /pyramid:\s*1/, 'RVM primitive contract must keep pyramid support.');
assert.match(primitiveKindContractSource, /box:\s*2/, 'RVM primitive contract must keep box support.');
assert.match(primitiveKindContractSource, /cylinder:\s*8/, 'RVM primitive contract must keep cylinder support.');
assert.match(primitiveKindContractSource, /sphere:\s*9/, 'RVM primitive contract must keep sphere support.');

assert.match(translatorSource, /buildValveFlangePrimitiveAdapterPlan/, 'Translator must consume the C2 shared adapter plan.');
assert.match(translatorSource, /RVM_CATALOGUE_SUPPORTED_PRIMITIVE_KINDS/, 'Translator must declare writer-supported primitive kinds.');
assert.match(translatorSource, /steppedFrustum/, 'Translator must convert frustum hints into stepped cylinders.');
assert.match(translatorSource, /boltPatternSpheres/, 'Translator must expand bolt-pattern hints into writer-safe primitives.');
assert.doesNotMatch(translatorSource, /from 'three'|from "three"/, 'RVM catalogue translator must not depend on Three.js.');
assert.doesNotMatch(translatorSource, /MutationObserver|setInterval\(|\.traverse\(/, 'RVM catalogue translator must not observe DOM, poll, or traverse Three.js scenes.');
assert.match(pkg.scripts.test, /rvm-catalogue-primitive-requirements\.test\.mjs/, 'npm test must include the C3 RVM catalogue requirements gate.');

console.log('RVM catalogue primitive requirements gate passed');
