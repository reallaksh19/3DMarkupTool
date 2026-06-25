import assert from 'node:assert/strict';
import { parseManagedStageIsonoteSupportRecords } from '../src/managed-stage-isonote-support-mapper.js';
import { resolveManagedStageSupportSymbolCatalogue } from '../src/managed-stage-support-symbol-catalogue.js';

const text = ['NODE,ISONOTE', '35,REST; GUIDE; LINE STOP', '130,SINGLE AXIS Z', '205,REST; HOLDDOWN; LINE STOP; SPRING CAN'].join('\n');
const records = parseManagedStageIsonoteSupportRecords(text);
assert.equal(records.length, 8);
assert.ok(records.every((record) => record.sourceMode === 'isonote'));
assert.ok(records.every((record) => record.mapperRecord.gap.recordScoped === true));
assert.ok(records.every((record) => record.mapperRecord.gap.carryForward === false));

const families = records.map((record) => record.mapperRecord.family);
assert.ok(families.includes('REST'));
assert.ok(families.includes('GUIDE'));
assert.ok(families.includes('LINE_STOP'));
assert.ok(families.includes('HOLDDOWN'));
assert.ok(families.includes('SPRING_CAN'));

const warning = records.find((record) => record.nodeId === '130');
assert.equal(warning.mapperRecord.family, 'UNKNOWN');
assert.equal(warning.mapperRecord.axis.sourceAxis, '+Z');
assert.equal(warning.mapperRecord.preflight.popupRequired, true);
assert.equal(warning.mapperRecord.preflight.issues.some((issue) => issue.code === 'unknown-support-family'), true);
const warningSymbol = resolveManagedStageSupportSymbolCatalogue(warning.mapperRecord, { pipeAxisSigned: '+X' });
assert.equal(warningSymbol.family, 'UNKNOWN');
assert.equal(warningSymbol.popupRequired, true);
assert.match(warningSymbol.graphicsRule, /unknown/);

const gapRows = parseManagedStageIsonoteSupportRecords('NODE,ISONOTE\n10,GUIDE GAP=5mm\n20,LINE STOP\n');
assert.equal(gapRows[0].mapperRecord.gap.value, '5mm');
assert.equal(gapRows[0].mapperRecord.gap.sourceField, 'SUPPORT_GAP_MM');
assert.equal(gapRows[1].mapperRecord.gap.value, '');

console.log('managed-stage ISONOTE support mapper: ok');
