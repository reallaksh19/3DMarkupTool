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
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

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
assert.equal(valveExport.attributes.PROPORTIONAL_FALLBACK, 'TRUE');
assert.equal(valveExport.attributes.ASME_DIMENSIONAL_DB_BACKED, 'FALSE');
assert.equal(valveExport.attributes.RVM_CATALOGUE_PARITY, 'TRUE');
assert.equal(valveExport.attributes.RVM_CATALOGUE_TRANSLATOR_SCHEMA, RVM_CATALOGUE_PRIMITIVE_TRANSLATOR_SCHEMA);
assert.equal(valveExport.policies.writerSupportedKindsOnly, true, 'Translator must emit only RVM-writer-supported primitive kinds.');
assert.equal(valveExport.policies.translatedBeforeRvmWriter, true, 'Adapter primitives must be translated before the RVM writer receives them.');
assert.ok(valveExport.primitives.length > 5, 'Flanged valve must not collapse to one generic body primitive.');

const valveNames = valveExport.primitives.map((primitive) => primitive.name).join('\n');
assert.match(valveNames, /END_COLLAR_A/, 'Flanged valve RVM primitives must include left end collar.');
assert.match(valveNames, /VALVE_NECK_A_STEP_01/, 'Flanged valve tapered neck must be stepped into cylinders.');
assert.match(valveNames, /VALVE_BODY/, 'Flanged valve RVM primitives must include valve body.');
assert.match(valveNames, /VALVE_NECK_B_STEP_03/, 'Flanged valve right tapered neck must be stepped into cylinders.');
assert.match(valveNames, /END_COLLAR_B/, 'Flanged valve RVM primitives must include right end collar.');
assert.ok(!valveNames.includes('_BODY\n') || valveExport.primitives.length > 2, 'Catalogue valve export must not be only the legacy generic BODY cylinder.');

const flangeExport = buildRvmValveFlangeCatalogueExport(
  flangePair,
  { length: 800, pipeRadius: 75 },
  { start: [1000, 0, 0], end: [1800, 0, 0], material: 27, namePrefix: flangePair.id }
);
assert.ok(flangeExport, 'Weld-neck flange pair must translate to an RVM catalogue export bundle.');
assert.equal(flangeExport.componentClass, 'FLANGE');
assert.equal(flangeExport.componentType, 'FLANGE_WELD_NECK');
assert.equal(flangeExport.attributes.CATALOGUE_VISUAL, 'TRUE');
assert.equal(flangeExport.attributes.ASME_DIMENSIONAL_DB_BACKED, 'FALSE');

const flangeNames = flangeExport.primitives.map((primitive) => primitive.name).join('\n');
assert.match(flangeNames, /WELD_NECK_A_STEP_01/, 'Weld-neck flange must include stepped left weld neck.');
assert.match(flangeNames, /FLANGE_DISC_A/, 'Weld-neck flange must include left flange plate/disc.');
assert.match(flangeNames, /RAISED_FACE_A/, 'Weld-neck flange must include raised face.');
assert.match(flangeNames, /GASKET_CENTER/, 'Weld-neck flange must include gasket center.');
assert.match(flangeNames, /FLANGE_DISC_B/, 'Weld-neck flange must include right flange plate/disc.');
assert.match(flangeNames, /WELD_NECK_B_STEP_03/, 'Weld-neck flange must include stepped right weld neck.');
assert.match(flangeNames, /BOLT_PATTERN_01/, 'Weld-neck flange must expand bolt pattern to writer-safe primitives.');

const allCataloguePrimitives = valveExport.primitives.concat(flangeExport.primitives);
const emittedKinds = new Set(allCataloguePrimitives.map((primitive) => primitive.kind));
assert.deepEqual(
  [...emittedKinds].sort(),
  [...emittedKinds].filter((kind) => RVM_CATALOGUE_SUPPORTED_PRIMITIVE_KINDS.includes(kind)).sort(),
  'Translated catalogue primitives must use only cylinder/box/pyramid/sphere.'
);
assert.ok(!emittedKinds.has('frustum'), 'Frustum adapter hints must not be passed directly to RVM writer.');
assert.ok(!emittedKinds.has('torus'), 'Torus adapter hints must not be passed directly to RVM writer.');
assert.ok(!emittedKinds.has('bolt-pattern'), 'Bolt-pattern adapter hints must not be passed directly to RVM writer.');
assert.ok(!emittedKinds.has('valve-body'), 'Valve-body adapter hints must not be passed directly to RVM writer.');
assert.ok(!emittedKinds.has('radial-cylinder'), 'Radial-cylinder adapter hints must not be passed directly to RVM writer.');

const primitiveHelper = buildRvmValveFlangeCataloguePrimitives(
  flangedValve,
  { length: 1000, pipeRadius: 50 },
  { start: [0, 0, 0], end: [1000, 0, 0], material: 27, namePrefix: flangedValve.id }
);
assert.deepEqual(primitiveHelper, valveExport.primitives, 'Primitive helper must return the translated writer-safe primitives.');

const exportModel = {
  root: {
    name: 'INPUTXML_RVM_ROOT',
    material: 12,
    attributes: { TYPE: 'MODEL_ROOT', EXPORT_FORMAT: 'RVM_ATT' },
    primitives: [],
    children: [{
      name: 'PLANT_GEOMETRY',
      material: 12,
      attributes: { TYPE: 'GROUP', ROLE: 'PLANT_GEOMETRY' },
      primitives: [],
      children: [
        {
          name: flangedValve.id,
          material: 27,
          attributes: { TYPE: 'COMPONENT', ENGINEERING_TYPE: 'VALVE', ...valveExport.attributes },
          primitives: valveExport.primitives,
          children: []
        },
        {
          name: flangePair.id,
          material: 27,
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
assert.match(rvmWriterSource, /if \(kind === 'pyramid'\) return 1/, 'RVM writer must keep pyramid support.');
assert.match(rvmWriterSource, /if \(kind === 'box'\) return 2/, 'RVM writer must keep box support.');
assert.match(rvmWriterSource, /if \(kind === 'cylinder'\) return 8/, 'RVM writer must keep cylinder support.');
assert.match(rvmWriterSource, /if \(kind === 'sphere'\) return 9/, 'RVM writer must keep sphere support.');

assert.match(translatorSource, /buildValveFlangePrimitiveAdapterPlan/, 'Translator must consume the C2 shared adapter plan.');
assert.match(translatorSource, /RVM_CATALOGUE_SUPPORTED_PRIMITIVE_KINDS/, 'Translator must declare writer-supported primitive kinds.');
assert.match(translatorSource, /steppedFrustum/, 'Translator must convert frustum hints into stepped cylinders.');
assert.match(translatorSource, /boltPatternSpheres/, 'Translator must expand bolt-pattern hints into writer-safe primitives.');
assert.doesNotMatch(translatorSource, /from 'three'|from "three"/, 'RVM catalogue translator must not depend on Three.js.');
assert.doesNotMatch(translatorSource, /MutationObserver|setInterval\(|\.traverse\(/, 'RVM catalogue translator must not observe DOM, poll, or traverse Three.js scenes.');
assert.match(pkg.scripts.test, /rvm-catalogue-primitive-requirements\.test\.mjs/, 'npm test must include the C3 RVM catalogue requirements gate.');

console.log('RVM catalogue primitive requirements gate passed');
