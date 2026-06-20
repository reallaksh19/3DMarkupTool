import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  SUPPORT_RESTRAINT_CATALOG_SCHEMA_VERSION,
  listSupportRestraintVisualProfiles,
  normalizeSupportRestraintFamily,
  resolveSupportRestraintVisualSpec
} from '../src/support-restraint-visual-catalog.js';
import {
  assertSupportRestraintWriterSafePrimitives,
  buildSupportRestraintPrimitiveRecords
} from '../src/support-restraint-primitive-adapter.js';

const writerSafeKinds = new Set(['cylinder', 'pyramid', 'box', 'sphere']);
const representativeRecords = [
  { family: 'REST', node: '10', sourceClass: 'ACTUAL' },
  { family: 'GUIDE', node: '20', sourceClass: 'ACTUAL', gapMm: 5 },
  { family: 'LINE_STOP', node: '30', sourceClass: 'ACTUAL', gapMm: 10 },
  { family: 'LIMIT_STOP', node: '40', sourceClass: 'ACTUAL' },
  { family: 'ANCHOR', node: '50', sourceClass: 'ACTUAL' },
  { family: 'HOLDDOWN', node: '60', sourceClass: 'EXPECTED' },
  { family: 'SPRING', node: '70', sourceClass: 'EXPECTED' },
  { family: 'AXIS_RESTRAINT', axis: '+Z', node: '80', sourceClass: 'ACTUAL' },
  { family: 'UNKNOWN_RESTRAINT', node: '90', sourceClass: 'ACTUAL' }
];

function assertPrimitiveMetadata(primitive, spec) {
  assert.equal(primitive.supportCatalogue, true, `${primitive.name} must be marked as support catalogue primitive`);
  assert.equal(primitive.supportVisualKey, spec.visualKey, `${primitive.name} visual key mismatch`);
  assert.equal(primitive.supportVisualRecipeId, spec.recipeId, `${primitive.name} recipe mismatch`);
  assert.equal(primitive.supportVisualSchema, SUPPORT_RESTRAINT_CATALOG_SCHEMA_VERSION, `${primitive.name} schema mismatch`);
  assert.equal(primitive.proportionalFallback, true, `${primitive.name} must remain proportional fallback`);
  assert.equal(primitive.vendorDimensionalDbBacked, false, `${primitive.name} must not claim vendor dimensional DB backing`);
  assert(writerSafeKinds.has(primitive.kind), `${primitive.name} must use RVM-writer-safe primitive kind, got ${primitive.kind}`);
}

function assertPositiveFinite(value, label) {
  assert(Number.isFinite(value) && value > 0, `${label} must be a positive finite number`);
}

for (const family of ['REST', 'GUIDE', 'LINE_STOP', 'LIMIT_STOP', 'ANCHOR', 'HOLDDOWN', 'SPRING', 'AXIS_RESTRAINT', 'UNKNOWN_RESTRAINT']) {
  assert.equal(normalizeSupportRestraintFamily(family), family, `${family} should normalize to itself`);
}

assert.equal(normalizeSupportRestraintFamily('line stop'), 'LINE_STOP');
assert.equal(normalizeSupportRestraintFamily('limit'), 'LIMIT_STOP');
assert.equal(normalizeSupportRestraintFamily('hanger'), 'SPRING');
assert.equal(normalizeSupportRestraintFamily('+X'), 'AXIS_RESTRAINT');
assert.equal(normalizeSupportRestraintFamily('unmapped-inputxml-code-999'), 'UNKNOWN_RESTRAINT');

const unknownSpec = resolveSupportRestraintVisualSpec({ family: 'UNMAPPED_INPUTXML_CODE_999' });
assert.equal(unknownSpec.family, 'UNKNOWN_RESTRAINT', 'unknown restraints must remain UNKNOWN_RESTRAINT');
assert.notEqual(unknownSpec.family, 'REST', 'unknown restraints must not silently become REST');
assert.notEqual(unknownSpec.family, 'ANCHOR', 'unknown restraints must not silently become ANCHOR');
assert.notEqual(unknownSpec.family, 'AXIS_RESTRAINT', 'unknown restraints must not silently become AXIS_RESTRAINT');

const profiles = listSupportRestraintVisualProfiles();
assert(profiles.length >= representativeRecords.length, 'catalogue should expose representative support/restraint profiles');
for (const profile of profiles) {
  assert.equal(profile.componentClass, 'SUPPORT_RESTRAINT');
  assert.equal(profile.catalogSchemaVersion, SUPPORT_RESTRAINT_CATALOG_SCHEMA_VERSION);
  assert.equal(profile.proportionalFallback, true);
  assert.equal(profile.vendorDimensionalDbBacked, false);
  assert(profile.recipeId, `${profile.family} should expose recipeId`);
  assert(profile.visualKey, `${profile.family} should expose visualKey`);
}

for (const record of representativeRecords) {
  const spec = resolveSupportRestraintVisualSpec(record);
  const primitives = buildSupportRestraintPrimitiveRecords(record, {
    point: [100, 200, 300],
    tangent: [1, 0, 0],
    od: 120,
    material: 17
  });
  assert(primitives.length > 0, `${spec.family} should emit at least one visual primitive`);
  assertSupportRestraintWriterSafePrimitives(primitives);
  for (const primitive of primitives) {
    assertPrimitiveMetadata(primitive, spec);
    if (primitive.kind === 'cylinder') {
      assertPositiveFinite(primitive.radius, `${primitive.name}.radius`);
      assertPositiveFinite(primitive.length, `${primitive.name}.length`);
    }
    if (primitive.kind === 'pyramid') {
      assertPositiveFinite(primitive.height, `${primitive.name}.height`);
    }
    if (primitive.kind === 'box') {
      assert.equal(primitive.lengths.length, 3, `${primitive.name}.lengths must have 3 dimensions`);
      primitive.lengths.forEach((value, index) => assertPositiveFinite(value, `${primitive.name}.lengths[${index}]`));
    }
  }
}

const guide = buildSupportRestraintPrimitiveRecords({ family: 'GUIDE', node: '100' }, { point: [0, 0, 0], tangent: [1, 0, 0], od: 100 });
assert(guide.some((primitive) => primitive.kind === 'cylinder'), 'GUIDE should include arrow stem cylinders');
assert(guide.some((primitive) => primitive.kind === 'pyramid'), 'GUIDE should include arrow heads');
assert(guide.some((primitive) => primitive.role.includes('GUIDE_PLUS')), 'GUIDE should expose plus-side role');
assert(guide.some((primitive) => primitive.role.includes('GUIDE_MINUS')), 'GUIDE should expose minus-side role');

const spring = buildSupportRestraintPrimitiveRecords({ family: 'SPRING', node: '200' }, { point: [0, 0, 0], tangent: [0, 0, 1], od: 90 });
assert(spring.length >= 5, 'SPRING should emit a visible spring stack');
assert(spring.every((primitive) => primitive.kind === 'cylinder'), 'SPRING stack should remain writer-safe cylinders');

const unknown = buildSupportRestraintPrimitiveRecords({ family: 'MYSTERY_RESTRAINT', node: '300' }, { point: [0, 0, 0], od: 100 });
assert.equal(unknown[0].supportVisualFamily, 'UNKNOWN_RESTRAINT');
assert.equal(unknown[0].kind, 'box', 'unknown restraint should emit warning box, not a misleading support arrow');

const catalogueSource = readFileSync(new URL('../src/support-restraint-visual-catalog.js', import.meta.url), 'utf8');
const adapterSource = readFileSync(new URL('../src/support-restraint-primitive-adapter.js', import.meta.url), 'utf8');
assert(!catalogueSource.includes('three'), 'support/restraint visual catalogue must not depend on Three.js');
assert(!adapterSource.includes('three'), 'support/restraint primitive adapter must not depend on Three.js');
assert(!adapterSource.includes('MutationObserver'), 'support/restraint primitive adapter must not patch UI/DOM');
assert(!adapterSource.includes('setInterval'), 'support/restraint primitive adapter must not poll');

console.log('support-restraint-visual-catalog gate passed');
