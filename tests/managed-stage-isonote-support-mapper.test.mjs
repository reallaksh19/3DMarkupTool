import assert from 'node:assert/strict';
import { parseManagedStageIsonoteSupportRecords } from '../src/managed-stage-isonote-support-mapper.js';

const text = ['NODE,ISONOTE', '35,REST GUIDE LINE STOP', '130,SINGLE AXIS Z'].join('\n');
const records = parseManagedStageIsonoteSupportRecords(text);
assert.ok(records.length >= 3);
assert.ok(records.every((record) => record.sourceMode === 'isonote'));
assert.ok(records.every((record) => record.mapperRecord.gap.recordScoped === true));
assert.ok(records.every((record) => record.mapperRecord.gap.carryForward === false));

const families = records.map((record) => record.mapperRecord.family);
assert.ok(families.includes('REST'));
assert.ok(families.includes('GUIDE'));
assert.ok(families.includes('LINE_STOP'));

const gapRows = parseManagedStageIsonoteSupportRecords('NODE,ISONOTE\n10,GUIDE GAP=5mm\n20,LINE STOP\n');
assert.equal(gapRows[0].mapperRecord.gap.value, '5mm');
assert.equal(gapRows[1].mapperRecord.gap.value, '');

console.log('managed-stage ISONOTE support mapper: ok');
