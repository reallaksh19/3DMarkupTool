import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildValveFlangeExportPrimitives,
  buildValveFlangePrimitiveAdapterPlan,
  VALVE_FLANGE_PRIMITIVE_ADAPTER_SCHEMA,
  VALVE_FLANGE_EXPORT_PRIMITIVE_SCHEMA
} from '../src/valve-flange-primitive-adapter.js';

const adapterSource = readFileSync(new URL('../src/valve-flange-primitive-adapter.js', import.meta.url), 'utf8');
const exportModel = readFileSync(new URL('../src/export-model.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const flangedValve = {
  id: 'E_VALVE_001',
  rawType: 'FLANGED_VALVE',
  type: 'RIGID',
  props: {
    id: 'E_VALVE_001',
    bore: 100,
    rigidLength: 1000,
    rigidType: 'FLANGED_VALVE'
  }
};

const valvePlan = buildValveFlangePrimitiveAdapterPlan(flangedValve, { length: 1000, pipeRadius: 50 });
assert.ok(valvePlan, 'Flanged valve must resolve to an adapter plan.');
assert.equal(valvePlan.schemaVersion, VALVE_FLANGE_PRIMITIVE_ADAPTER_SCHEMA);
assert.equal(valvePlan.exportPrimitiveSchemaVersion, VALVE_FLANGE_EXPORT_PRIMITIVE_SCHEMA);
assert.equal(valvePlan.componentClass, 'VALVE');
assert.equal(valvePlan.componentType, 'VALVE_FLANGED');
assert.equal(valvePlan.policies.rendererNeutral, true, 'Adapter plan must be renderer neutral.');
assert.equal(valvePlan.policies.productionRvmExportEnabled, false, 'C2 must not silently enable production RVM catalogue export.');
assert.equal(valvePlan.policies.asmeDimensionalDatabaseBacked, false, 'C2 adapter must remain proportional fallback, not ASME DB-backed.');
assert.equal(valvePlan.continuity.ok, true, 'Valve length-partitioned primitives must remain continuous.');

const valveRoles = new Set(valvePlan.visiblePrimitives.map((primitive) => primitive.role));
assert.ok(valveRoles.has('END_COLLAR_A'), 'Valve adapter must preserve left end collar role.');
assert.ok(valveRoles.has('VALVE_NECK_A'), 'Valve adapter must preserve left tapered neck role.');
assert.ok(valveRoles.has('VALVE_BODY'), 'Valve adapter must preserve compact valve body role.');
assert.ok(valveRoles.has('VALVE_NECK_B'), 'Valve adapter must preserve right tapered neck role.');
assert.ok(valveRoles.has('END_COLLAR_B'), 'Valve adapter must preserve right end collar role.');

const valveBody = valvePlan.visiblePrimitives.find((primitive) => primitive.role === 'VALVE_BODY');
assert.equal(valveBody.exportKind, 'valve-body', 'Valve body must normalize to a valve-body export hint.');
assert.equal(valveBody.materialRole, 'valve', 'Valve body material role must remain valve.');

const taperedNeck = valvePlan.visiblePrimitives.find((primitive) => primitive.role === 'VALVE_NECK_A');
assert.equal(taperedNeck.exportKind, 'frustum', 'Tapered valve neck must normalize to a frustum export primitive.');
assert.ok(taperedNeck.radiusStart > 0 && taperedNeck.radiusEnd > 0, 'Frustum primitive must carry both radii.');

const flangePair = {
  id: 'E_FLANGE_001',
  rawType: 'FLANGE_WELD_NECK',
  type: 'RIGID',
  props: {
    id: 'E_FLANGE_001',
    bore: 150,
    rigidLength: 800,
    rigidType: 'WELD_NECK_FLANGE'
  }
};

const flangePlan = buildValveFlangePrimitiveAdapterPlan(flangePair, { length: 800, pipeRadius: 75 });
assert.ok(flangePlan, 'Weld-neck flange must resolve to an adapter plan.');
assert.equal(flangePlan.componentClass, 'FLANGE');
assert.equal(flangePlan.componentType, 'FLANGE_WELD_NECK');
assert.equal(flangePlan.continuity.ok, true, 'Flange pair primitives must remain continuous.');

const flangeRoles = new Set(flangePlan.visiblePrimitives.map((primitive) => primitive.role));
assert.ok(flangeRoles.has('WELD_NECK_A'), 'Flange adapter must preserve left weld-neck role.');
assert.ok(flangeRoles.has('FLANGE_DISC_A'), 'Flange adapter must preserve left flange plate role.');
assert.ok(flangeRoles.has('GASKET_CENTER'), 'Flange adapter must preserve gasket overlay role.');
assert.ok(flangeRoles.has('FLANGE_DISC_B'), 'Flange adapter must preserve right flange plate role.');
assert.ok(flangeRoles.has('WELD_NECK_B'), 'Flange adapter must preserve right weld-neck role.');
assert.ok(flangeRoles.has('BOLT_PATTERN'), 'Flange adapter must preserve bolt pattern role.');

const raisedFace = flangePlan.visiblePrimitives.find((primitive) => primitive.role === 'RAISED_FACE_A');
assert.equal(raisedFace.materialRole, 'raised-face', 'Raised face must retain raised-face material role.');
assert.equal(raisedFace.exportKind, 'cylinder', 'Raised face must be exportable as a short cylinder/disc.');

const boltPattern = flangePlan.visiblePrimitives.find((primitive) => primitive.role === 'BOLT_PATTERN');
assert.equal(boltPattern.exportKind, 'bolt-pattern', 'Bolt pattern must remain a structured export primitive.');
assert.equal(boltPattern.boltCount, 8, 'Bolt pattern must carry bolt count.');
assert.ok(boltPattern.boltCircleRadius > 0, 'Bolt pattern must carry bolt-circle radius.');

const exportPrimitives = buildValveFlangeExportPrimitives(flangedValve, { length: 1000, pipeRadius: 50 });
assert.deepEqual(exportPrimitives, valvePlan.visiblePrimitives, 'Export primitive helper must return visible adapter records.');

assert.match(adapterSource, /buildValveFlangePrimitiveAdapterPlan/, 'Adapter module must expose the shared plan builder.');
assert.match(adapterSource, /rendererNeutral: true/, 'Adapter must declare renderer-neutral policy.');
assert.match(adapterSource, /productionRvmExportEnabled: false/, 'C2 must keep production RVM export disabled.');
assert.doesNotMatch(adapterSource, /from 'three'|from "three"/, 'Shared adapter must not depend on Three.js.');
assert.doesNotMatch(adapterSource, /setInterval\(|MutationObserver|\.traverse\(/, 'Shared adapter must not poll, observe DOM, or traverse scene content.');

assert.doesNotMatch(
  exportModel,
  /valve-flange-primitive-adapter/,
  'C2 must not wire the adapter into production RVM export; that belongs to C3.'
);
assert.match(pkg.scripts.test, /valve-flange-primitive-adapter\.test\.mjs/, 'npm test must include the C2 primitive adapter gate.');

console.log('valve/flange primitive adapter gate passed');
