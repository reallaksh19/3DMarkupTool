import assert from 'node:assert/strict';
import {
  CAESAR_TO_CANVAS_AXIS_BASIS_PRESET,
  DEFAULT_STAGED_JSON_SUPPORT_MAPPER_CONFIG,
  MANAGED_STAGE_SUPPORT_MAPPER_CONFIG_SCHEMA,
  MANAGED_STAGE_SUPPORT_SOURCE_MODES,
  mapManagedStageSupportAxisToCanvas,
  normalizeManagedStageSupportMapperRecord,
  resolveManagedStageSupportMapperConfig
} from '../src/managed-stage-support-mapper-config.js';

assert.equal(DEFAULT_STAGED_JSON_SUPPORT_MAPPER_CONFIG.schema, MANAGED_STAGE_SUPPORT_MAPPER_CONFIG_SCHEMA);
assert.deepEqual(DEFAULT_STAGED_JSON_SUPPORT_MAPPER_CONFIG.sourceModes, ['off', 'stagedJson', 'isonote']);
assert.ok(DEFAULT_STAGED_JSON_SUPPORT_MAPPER_CONFIG.fieldMapper.supportKindFields.includes('SUPPORT_TAG') === false, 'support tag and support kind must remain separate mapper columns');
assert.ok(DEFAULT_STAGED_JSON_SUPPORT_MAPPER_CONFIG.fieldMapper.supportTagFields.includes('SUPPORT_TAG'), 'SUPPORT_TAG should map to supportTag');
assert.ok(DEFAULT_STAGED_JSON_SUPPORT_MAPPER_CONFIG.fieldMapper.graphicsRuleFields.includes('SUPPORT_TAG'), 'supportTag can still drive a graphics rule match');

const caesarNorth = mapManagedStageSupportAxisToCanvas('-X', CAESAR_TO_CANVAS_AXIS_BASIS_PRESET);
assert.equal(caesarNorth.sourceAxis, '-X');
assert.equal(caesarNorth.engineeringDirection, 'NORTH');
assert.deepEqual(caesarNorth.canvasVector, { x: -1, y: 0, z: 0 });

const customNorthToCanvasZ = resolveManagedStageSupportMapperConfig({
  axisBasis: {
    name: 'Project north maps to Canvas +Z',
    axes: {
      '-X': { engineeringDirection: 'NORTH', canvasAxis: '+Z' }
    }
  }
});
const mappedNorth = mapManagedStageSupportAxisToCanvas('-X', customNorthToCanvasZ.axisBasis);
assert.equal(mappedNorth.sourceAxis, '-X');
assert.equal(mappedNorth.canvasAxis, '+Z');
assert.equal(mappedNorth.engineeringDirection, 'NORTH');
assert.deepEqual(mappedNorth.canvasVector, { x: 0, y: 0, z: 1 });

const stagedGuide = normalizeManagedStageSupportMapperRecord({
  name: 'PS-100 GUIDE NORTH',
  attrs: {
    SUPPORT_TAG: 'PS-100 GUIDE',
    CAESAR_AXIS: '-X',
    SUPPORT_AXIAL_GAP_MM: '4mm'
  }
}, {
  sourceMode: 'stagedJson',
  fieldMapper: {
    supportKindFields: ['SUPPORT_TAG'],
    axisFields: ['CAESAR_AXIS'],
    gapFields: ['SUPPORT_GAP_MM', '*GAP*']
  },
  axisBasis: {
    axes: {
      '-X': { engineeringDirection: 'NORTH', canvasAxis: '+Z' }
    }
  }
});
assert.equal(stagedGuide.schema, MANAGED_STAGE_SUPPORT_MAPPER_CONFIG_SCHEMA);
assert.equal(stagedGuide.sourceMode, MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON);
assert.equal(stagedGuide.supportTag, 'PS-100 GUIDE');
assert.equal(stagedGuide.family, 'GUIDE');
assert.equal(stagedGuide.axis.sourceAxis, '-X');
assert.equal(stagedGuide.axis.canvasAxis, '+Z');
assert.equal(stagedGuide.axis.engineeringDirection, 'NORTH');
assert.equal(stagedGuide.gap.value, '4mm');
assert.equal(stagedGuide.gap.sourceField, 'SUPPORT_AXIAL_GAP_MM');
assert.equal(stagedGuide.gap.recordScoped, true);
assert.equal(stagedGuide.gap.carryForward, false);
assert.equal(stagedGuide.attrs.SUPPORT_FIELD_MAPPER_CONFIGURED, 'TRUE');
assert.equal(stagedGuide.attrs.SUPPORT_AXIS_BASIS_CONFIGURED, 'TRUE');
assert.equal(stagedGuide.attrs.SUPPORT_GRAPHICS_RULE_CONFIGURED, 'TRUE');

const isonoteConfig = resolveManagedStageSupportMapperConfig({ sourceMode: 'isonote' });
assert.equal(isonoteConfig.sourceMode, MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE, 'ISONOTE must be a first-class support source toggle mode');

const lineStop = normalizeManagedStageSupportMapperRecord({
  attrs: {
    SUPPORT_TAG: 'PS-200',
    SUPPORT_KIND: 'LINE STOP',
    AXIS: 'X',
    SIGN: '-'
  }
});
assert.equal(lineStop.family, 'LINE_STOP');
assert.equal(lineStop.axis.sourceAxis, '-X');
assert.equal(lineStop.attrs.SUPPORT_AXIS_ENGINEERING, 'NORTH');
assert.equal(lineStop.attrs.SUPPORT_AXIS_CANVAS, '-X');
assert.equal(lineStop.attrs.SUPPORT_SIGN_MAPPED, '-');

console.log('managed-stage support mapper config: ok');
