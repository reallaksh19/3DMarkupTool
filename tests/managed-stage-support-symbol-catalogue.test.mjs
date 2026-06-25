import assert from 'node:assert/strict';
import { normalizeManagedStageSupportMapperRecord } from '../src/managed-stage-support-mapper-config.js';
import {
  MANAGED_STAGE_SUPPORT_SYMBOL_CATALOGUE_SCHEMA,
  resolveManagedStageSupportSymbolCatalogue
} from '../src/managed-stage-support-symbol-catalogue.js';

function mapped(attrs, config = {}) {
  return normalizeManagedStageSupportMapperRecord({ attrs }, config);
}

function axes(symbol) {
  return symbol.primitives.map((primitive) => primitive.axis);
}

const rest = resolveManagedStageSupportSymbolCatalogue(mapped({ SUPPORT_TAG: 'PS-01 REST', DIAMETER: '300mm' }));
assert.equal(rest.schema, MANAGED_STAGE_SUPPORT_SYMBOL_CATALOGUE_SCHEMA);
assert.equal(rest.family, 'REST');
assert.equal(rest.graphicsRule, 'positive-y-upward-arrow');
assert.equal(rest.primitiveCount, 1);
assert.deepEqual(axes(rest), ['+Y']);
assert.equal(rest.odTwoThirdsResolverApplied, false);
assert.equal(rest.odTwoThirdsSymbolLengthMm, 0, 'ODx2/3 must not size non-axial REST symbols');
assert.equal(rest.primitiveBudgetOk, true);

const holddown = resolveManagedStageSupportSymbolCatalogue(mapped({ SUPPORT_KIND: 'HOLDDOWN' }));
assert.equal(holddown.family, 'HOLDDOWN');
assert.equal(holddown.primitiveCount, 2);
assert.deepEqual(axes(holddown), ['+Y', '-Y']);
assert.equal(holddown.primitiveBudgetOk, true);

const guideOnX = resolveManagedStageSupportSymbolCatalogue(mapped({ SUPPORT_KIND: 'GUIDE', SUPPORT_GAP_MM: '12mm', DIAMETER: '300mm' }), { pipeAxisSigned: '+X' });
assert.equal(guideOnX.family, 'GUIDE');
assert.deepEqual(axes(guideOnX), ['+Z', '-Z']);
assert.equal(guideOnX.primitiveCount, 2);
assert.equal(guideOnX.gapMm, 12);
assert.equal(guideOnX.gapVisualSeparationMm, 0, 'GUIDE gap must not use axial 10x separation rule');
assert.equal(guideOnX.odTwoThirdsResolverApplied, false);
assert.equal(guideOnX.odTwoThirdsSymbolLengthMm, 0, 'ODx2/3 must not size lateral GUIDE symbols');

const guideOnZ = resolveManagedStageSupportSymbolCatalogue(mapped({ SUPPORT_KIND: 'GUIDE' }), { pipeAxisSigned: '-Z' });
assert.deepEqual(axes(guideOnZ), ['+X', '-X']);
assert.equal(guideOnZ.primitiveCount, 2);

const guideOnVertical = resolveManagedStageSupportSymbolCatalogue(mapped({ SUPPORT_KIND: 'GUIDE' }), { pipeAxisSigned: '+Y' });
assert.deepEqual(axes(guideOnVertical), ['+X', '-X', '+Z', '-Z']);
assert.equal(guideOnVertical.primitiveCount, 4, 'vertical GUIDE must stay within the simple symbol primitive budget');
assert.equal(guideOnVertical.primitiveBudgetOk, true);

const lineStopPair = resolveManagedStageSupportSymbolCatalogue(mapped({ SUPPORT_KIND: 'LINE STOP', SUPPORT_GAP_MM: '6mm', DIAMETER: '300mm' }), { pipeAxisSigned: '-Z' });
assert.equal(lineStopPair.family, 'LINE_STOP');
assert.deepEqual(axes(lineStopPair), ['-Z', '+Z']);
assert.equal(lineStopPair.primitiveCount, 2);
assert.equal(lineStopPair.gapMm, 6);
assert.equal(lineStopPair.gapVisualSeparationMm, 60);
assert.deepEqual(lineStopPair.primitives.map((primitive) => primitive.tipSeparationMm), [30, 30], 'axial pair shares 10x gap separation around the support point');
assert.equal(lineStopPair.axialNoOdHalfRadialContact, true);
assert.equal(lineStopPair.axialTipsTouchUnlessGap, true);
assert.equal(lineStopPair.odTwoThirdsResolverApplied, true);
assert.equal(lineStopPair.odTwoThirdsSymbolLengthMm, 200, 'ODx2/3 sizing must be exposed only for final axial symbols');
assert.equal(lineStopPair.gapRecordScoped, true);
assert.equal(lineStopPair.gapCarryForward, false);
assert.match(lineStopPair.gapVisualRule, /10x record-local gap/);

const explicitLineStop = resolveManagedStageSupportSymbolCatalogue(mapped({ SUPPORT_KIND: 'LIMIT', CAESAR_AXIS: '-X', SUPPORT_GAP_MM: '5mm', DIAMETER: '450mm' }, {
  fieldMapper: { axisFields: ['CAESAR_AXIS'] },
  axisBasis: { axes: { '-X': { engineeringDirection: 'NORTH', canvasAxis: '+Z' } } }
}), { pipeAxisSigned: '+X' });
assert.equal(explicitLineStop.family, 'LINE_STOP');
assert.equal(explicitLineStop.graphicsRule, 'axial-pair-or-explicit-sign');
assert.deepEqual(axes(explicitLineStop), ['+Z']);
assert.equal(explicitLineStop.primitiveCount, 1, 'explicit signed LIMIT/LINE STOP restraint should emit one directional axial symbol');
assert.equal(explicitLineStop.primitives[0].tipSeparationMm, 50, 'explicit signed axial restraint uses the full positive 10x gap separation');
assert.equal(explicitLineStop.odTwoThirdsResolverApplied, true);
assert.equal(explicitLineStop.odTwoThirdsSymbolLengthMm, 300);
assert.equal(explicitLineStop.primitives[0].odTwoThirdsEligible, true);

const axisOnlyWarning = resolveManagedStageSupportSymbolCatalogue(mapped({ AXIS: 'X', DIAMETER: '300mm' }, {
  fieldMapper: { axisFields: ['AXIS'] }
}));
assert.equal(axisOnlyWarning.family, 'UNKNOWN');
assert.equal(axisOnlyWarning.graphicsRule, 'unknown-cross-warning');
assert.equal(axisOnlyWarning.popupRequired, true);
assert.equal(axisOnlyWarning.primitiveCount, 3);
assert.equal(axisOnlyWarning.primitiveBudgetOk, true);
assert.ok(axisOnlyWarning.warnings.some((warning) => warning.includes('unknown support kind')));
assert.equal(axisOnlyWarning.odTwoThirdsResolverApplied, false);
assert.equal(axisOnlyWarning.odTwoThirdsSymbolLengthMm, 0, 'ODx2/3 must not size unresolved warning symbols');

const spring = resolveManagedStageSupportSymbolCatalogue(mapped({ SUPPORT_TAG: 'PS-04 CAN SPRING', DIAMETER: '300mm' }));
assert.equal(spring.family, 'SPRING_CAN');
assert.equal(spring.graphicsRule, 'warning-coil-below-pipe');
assert.equal(spring.popupRequired, true);
assert.equal(spring.primitiveCount, 4);
assert.equal(spring.primitiveBudgetOk, true);
assert.deepEqual(axes(spring), ['-Y', '-Y', '-Y', '-Y']);
assert.equal(spring.odTwoThirdsResolverApplied, false);
assert.equal(spring.odTwoThirdsSymbolLengthMm, 0, 'ODx2/3 must not size spring warning coil symbols');

console.log('managed-stage support symbol catalogue: ok');
