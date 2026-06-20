import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildRvmExportModel } from '../src/export-model.js';
import { applyRvmCatalogueExportParity } from '../src/rvm-catalogue-export-wiring.js';
import { normalizeNavisExportModelNames } from '../src/navis-safe-export-model.js';
import { writeRvm } from '../src/rvm-writer.js';
import { writeAtt } from '../src/att-writer.js';
import { RVM_CATALOGUE_SUPPORTED_PRIMITIVE_KINDS } from '../src/rvm-catalogue-primitive-translator.js';

const wiringSource = readFileSync(new URL('../src/rvm-catalogue-export-wiring.js', import.meta.url), 'utf8');
const converterSource = readFileSync(new URL('../src/rvm-converter.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const model = syntheticCatalogueModel();
const baseExportModel = buildRvmExportModel(model, { supportMode: 'inputxml-actual', nodeLabels: false, isonoteBoards: false });
const basePlant = findChild(baseExportModel.root, 'PLANT_GEOMETRY');
const baseValveNode = findChild(basePlant, 'PE_002_FLANGED_VALVE_20_TO_30');
const baseFlangeNode = findChild(basePlant, 'PE_003_FLANGE_WN_30_TO_40');
const basePipeNode = findChild(basePlant, 'PE_001_PIPE_10_TO_20');

assert.ok(baseValveNode, 'baseline export must contain the valve node');
assert.ok(baseFlangeNode, 'baseline export must contain the flange node');
assert.ok(basePipeNode, 'baseline export must contain the pipe fallback node');
assert.equal(baseValveNode.primitives.length, 2, 'baseline rigid valve should be generic body + rigid marker before C3B wiring');
assert.equal(baseFlangeNode.primitives.length, 2, 'baseline rigid flange should be generic body + rigid marker before C3B wiring');
assert.equal(basePipeNode.primitives.length, 1, 'baseline pipe fallback should remain one body primitive');

const wiredExportModel = normalizeNavisExportModelNames(applyRvmCatalogueExportParity(baseExportModel, model));
const plant = findChild(wiredExportModel.root, 'PLANT_GEOMETRY');
const valveNode = findChild(plant, 'PE_002_FLANGED_VALVE_20_TO_30');
const flangeNode = findChild(plant, 'PE_003_FLANGE_WN_30_TO_40');
const pipeNode = findChild(plant, 'PE_001_PIPE_10_TO_20');

assert.ok(valveNode, 'wired export must retain the valve node');
assert.ok(flangeNode, 'wired export must retain the flange node');
assert.ok(pipeNode, 'wired export must retain the pipe node');

assert.ok(valveNode.primitives.length > baseValveNode.primitives.length, 'flanged valve must be replaced by segmented catalogue primitives');
assert.ok(flangeNode.primitives.length > baseFlangeNode.primitives.length, 'weld-neck flange must be replaced by segmented catalogue primitives');
assert.equal(pipeNode.primitives.length, 1, 'non-catalogue pipe must retain existing fallback primitive path');
assert.match(pipeNode.primitives[0].name, /PIPE_10_TO_20_BODY/, 'pipe fallback body primitive must be preserved');

assert.equal(valveNode.attributes.CATALOGUE_VISUAL, 'TRUE');
assert.equal(valveNode.attributes.CATALOGUE_CLASS, 'VALVE');
assert.equal(valveNode.attributes.CATALOGUE_TYPE, 'VALVE_FLANGED');
assert.equal(valveNode.attributes.CATALOGUE_EXPORT_PRODUCTION_WIRING, 'TRUE');
assert.equal(valveNode.attributes.PROPORTIONAL_FALLBACK, 'TRUE');
assert.equal(valveNode.attributes.ASME_DIMENSIONAL_DB_BACKED, 'FALSE');
assert.equal(valveNode.attributes.RVM_CATALOGUE_PARITY, 'TRUE');

assert.equal(flangeNode.attributes.CATALOGUE_VISUAL, 'TRUE');
assert.equal(flangeNode.attributes.CATALOGUE_CLASS, 'FLANGE');
assert.equal(flangeNode.attributes.CATALOGUE_TYPE, 'FLANGE_WELD_NECK');
assert.equal(flangeNode.attributes.CATALOGUE_EXPORT_PRODUCTION_WIRING, 'TRUE');
assert.equal(flangeNode.attributes.PROPORTIONAL_FALLBACK, 'TRUE');
assert.equal(flangeNode.attributes.ASME_DIMENSIONAL_DB_BACKED, 'FALSE');
assert.equal(flangeNode.attributes.RVM_CATALOGUE_PARITY, 'TRUE');

const valvePrimitiveNames = valveNode.primitives.map((primitive) => primitive.name).join('\n');
assert.match(valvePrimitiveNames, /END_COLLAR_A/, 'production valve export must include left collar');
assert.match(valvePrimitiveNames, /VALVE_NECK_A_STEP_01/, 'production valve export must step tapered necks into cylinders');
assert.match(valvePrimitiveNames, /VALVE_BODY/, 'production valve export must include valve body');
assert.match(valvePrimitiveNames, /VALVE_NECK_B_STEP_03/, 'production valve export must include right stepped neck');
assert.match(valvePrimitiveNames, /END_COLLAR_B/, 'production valve export must include right collar');

const flangePrimitiveNames = flangeNode.primitives.map((primitive) => primitive.name).join('\n');
assert.match(flangePrimitiveNames, /WELD_NECK_A_STEP_01/, 'production flange export must include left weld-neck steps');
assert.match(flangePrimitiveNames, /FLANGE_DISC_A/, 'production flange export must include left flange disc');
assert.match(flangePrimitiveNames, /RAISED_FACE_A/, 'production flange export must include raised face');
assert.match(flangePrimitiveNames, /GASKET_CENTER/, 'production flange export must include gasket center');
assert.match(flangePrimitiveNames, /FLANGE_DISC_B/, 'production flange export must include right flange disc');
assert.match(flangePrimitiveNames, /BOLT_PATTERN_01/, 'production flange export must expand bolt pattern to writer-safe primitives');

const allPrimitives = collectNodes(wiredExportModel.root).flatMap((node) => node.primitives || []);
for (const primitive of allPrimitives) {
  assert.ok(RVM_CATALOGUE_SUPPORTED_PRIMITIVE_KINDS.includes(primitive.kind), `unsupported primitive kind reached production RVM export: ${primitive.kind}`);
}
assert.ok(!allPrimitives.some((primitive) => ['frustum', 'torus', 'bolt-pattern', 'valve-body', 'radial-cylinder'].includes(primitive.kind)), 'adapter-only primitive hints must not reach production RVM export');

assert.equal(wiredExportModel.audit.rvmCatalogueParity, true);
assert.equal(wiredExportModel.audit.rvmCatalogueComponentCount, 2);
assert.ok(wiredExportModel.audit.rvmCataloguePrimitiveCount > 10, 'catalogue primitive count should reflect segmented valve/flange output');
assert.equal(wiredExportModel.audit.primitiveCount, allPrimitives.length, 'audit primitive count must be recomputed after catalogue replacement');

const rvmBuffer = writeRvm(wiredExportModel);
assert.ok(rvmBuffer instanceof ArrayBuffer, 'production wired export must remain RVM-writer compatible');
assert.ok(rvmBuffer.byteLength > 512, 'RVM output should remain non-empty after catalogue wiring');

const attText = writeAtt(wiredExportModel);
assert.match(attText, /CATALOGUE_EXPORT_PRODUCTION_WIRING := 'TRUE'/, 'ATT must expose production catalogue wiring status');
assert.match(attText, /CATALOGUE_CLASS := 'VALVE'/, 'ATT must expose valve catalogue class');
assert.match(attText, /CATALOGUE_TYPE := 'VALVE_FLANGED'/, 'ATT must expose valve catalogue type');
assert.match(attText, /CATALOGUE_TYPE := 'FLANGE_WELD_NECK'/, 'ATT must expose flange catalogue type');
assert.match(attText, /PROPORTIONAL_FALLBACK := 'TRUE'/, 'ATT must keep proportional fallback declaration');
assert.match(attText, /ASME_DIMENSIONAL_DB_BACKED := 'FALSE'/, 'ATT must not overclaim ASME backing');
assert.match(attText, /RVM_CATALOGUE_PARITY := 'TRUE'/, 'ATT must expose RVM catalogue parity');

assert.match(converterSource, /applyRvmCatalogueExportParity/, 'production RVM converter must apply C3B catalogue parity before writing RVM/ATT');
assert.match(converterSource, /buildRvmExportModel[\s\S]*applyRvmCatalogueExportParity[\s\S]*normalizeNavisExportModelNames/, 'production path must build, apply catalogue parity, then normalize names');
assert.match(wiringSource, /buildRvmValveFlangeCatalogueExport/, 'C3B wiring must consume the C3 translator seam');
assert.match(wiringSource, /RVM_CATALOGUE_SUPPORTED_PRIMITIVE_KINDS/, 'C3B wiring must enforce writer-safe primitive kinds');
assert.doesNotMatch(wiringSource, /from 'three'|from "three"/, 'C3B wiring must not depend on Three.js');
assert.doesNotMatch(wiringSource, /MutationObserver|setInterval\(|\.traverse\(/, 'C3B wiring must not observe DOM, poll, or traverse Three.js scenes');
assert.match(pkg.scripts.test, /rvm-catalogue-export-wiring\.test\.mjs/, 'npm test must include the C3B production RVM catalogue wiring gate');

console.log('RVM catalogue production export wiring gate passed');

function syntheticCatalogueModel() {
  const nodes = new Map([
    ['10', node('10', 0, 0, 0)],
    ['20', node('20', 1000, 0, 0)],
    ['30', node('30', 2000, 0, 0)],
    ['40', node('40', 2800, 0, 0)]
  ]);

  const elements = [
    element(nodes, 'PE_001_PIPE_10_TO_20', 'PIPE', 'PIPE', '10', '20'),
    element(nodes, 'PE_002_FLANGED_VALVE_20_TO_30', 'FLANGED_VALVE', 'RIGID', '20', '30', { rigidType: 'FLANGED_VALVE', rigidLength: 1000, rigidWeight: 128 }),
    element(nodes, 'PE_003_FLANGE_WN_30_TO_40', 'FLANGE_WELD_NECK', 'RIGID', '30', '40', { rigidType: 'WELD_NECK_FLANGE', rigidLength: 800, rigidWeight: 45 })
  ];

  return {
    sourceKind: 'InputXML',
    sourceSchemaVersion: 'c3b-rvm-catalogue-wiring-fixture',
    diagnostics: [],
    nodes,
    elements,
    restraints: [],
    isonoteMap: new Map()
  };
}

function node(id, x, y, z) {
  return { id, x, y, z };
}

function element(nodes, id, rawType, type, fromNode, toNode, overrides = {}) {
  const from = nodes.get(fromNode);
  const to = nodes.get(toNode);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  return {
    id,
    rawType,
    type,
    fromNode,
    toNode,
    from,
    to,
    dx,
    dy,
    dz,
    props: {
      id,
      refNo: id,
      type,
      meshRole: rawType,
      lineNo: 'C3B-CATALOGUE-LINE',
      lineNoSource: 'c3b-gate',
      fromNode,
      toNode,
      bore: 120,
      wallThickness: { value: 6, source: 'explicit' },
      materialThickness: { value: 6, source: 'explicit' },
      material: { value: 'CS', source: 'explicit' },
      pressure: { value: 1000, source: 'explicit' },
      hydroPressure: { value: 1500, source: 'explicit' },
      temp1: { value: 80, source: 'explicit' },
      temp2: { value: 120, source: 'explicit' },
      temp3: { value: 160, source: 'explicit' },
      rigidType: overrides.rigidType || '',
      rigidLength: overrides.rigidLength || '',
      rigidWeight: overrides.rigidWeight || '',
      bendRadius: overrides.bendRadius || '',
      bendAngle: overrides.bendAngle || '',
      source: 'InputXML C3B catalogue wiring fixture'
    }
  };
}

function findChild(node, name) {
  return (node?.children || []).find((child) => child.name === name) || null;
}

function collectNodes(node) {
  return [node].concat((node.children || []).flatMap((child) => collectNodes(child)));
}
