import assert from 'node:assert/strict';
import { createBmCiiManagedStageSampleJson } from '../src/managed-stage-bm-cii-json-sample-data.js';
import { detectSourceType, parseMarkupSource } from '../src/source-parser.js';
import {
  STAGEDJSON_SOURCE_CONTRACT_SCHEMA,
  assertStagedJsonSourceContract,
  parseStagedJsonSourceContract
} from '../src/stagedjson-source-contract.js';

const sourceText = createBmCiiManagedStageSampleJson();
const isonoteText = `NODE,ISONOTE
35,:/PS-35 :ISONOTE 'GUIDE, LINE STOP GAP 5mm'
205,:/PS-205 :ISONOTE 'REST, LINE STOP'`;

const detected = detectSourceType(sourceText, 'BM_CII_INPUT_managed_stage.json');
assert.equal(detected.kind, 'stagedjson');
assert.equal(detected.label, 'stagedJson');

const contract = parseStagedJsonSourceContract(sourceText, {
  filename: 'BM_CII_INPUT_managed_stage.json',
  isonoteText
});

assert.equal(contract.schema, STAGEDJSON_SOURCE_CONTRACT_SCHEMA);
assert.equal(contract.sourceKind, 'stagedJson');
assert.equal(contract.sourceFile, 'BM_CII_INPUT_managed_stage.json');
assert.equal(contract.components.length, 40);
assert.equal(contract.pipeSegments.length, 40);
assert.equal(contract.supports.length, 12);
assert.ok(contract.isonoteRecords.length >= 4);
assert.ok(contract.diagnostics.some((entry) => entry.code === 'STAGEDJSON_SOURCE_CONTRACT_BUILT'));
assertStagedJsonSourceContract(contract);

const rest = contract.supports.find((support) => support.nodeNumber === '10' && support.supportFamily === 'REST');
assert.ok(rest, 'REST support should be normalized into contract');
assert.equal(rest.pipeRadiusMm, 57.15);
assert.equal(rest.pipeOdMm, 114.3);
assert.ok(rest.positionMm);
assert.ok(rest.sourcePath.includes('SUPPORT INPUTXML-10-REST'));
assert.ok(rest.matchedPipeRef, 'REST support should retain the matched pipe/component reference path');
assert.equal(rest.axisTransformApplied, false);

const guide = contract.supports.find((support) => support.nodeNumber === '35' && support.supportFamily === 'GUIDE');
assert.ok(guide, 'GUIDE support should be normalized into contract');
assert.equal(guide.matchedIsonoteRecord.nodeId, '35');
assert.match(guide.isonoteRawText, /GUIDE/i);
assert.equal(guide.matchMethod, 'node-family');
assert.equal(guide.confidence, 1);

const lineStop = contract.supports.find((support) => support.nodeNumber === '35' && support.supportFamily === 'LINESTOP');
assert.ok(lineStop, 'LINESTOP support should be normalized into contract');
assert.equal(lineStop.matchedIsonoteRecord.nodeId, '35');
assert.match(lineStop.isonoteRawText, /LINE STOP/i);

const parsedViaMainRoute = parseMarkupSource(sourceText, {
  filename: 'BM_CII_INPUT_managed_stage.json',
  isonoteText
});
assert.equal(parsedViaMainRoute.schema, STAGEDJSON_SOURCE_CONTRACT_SCHEMA);
assert.equal(parsedViaMainRoute.detectedSource.kind, 'stagedjson');
assert.equal(parsedViaMainRoute.elements.length, 40);
assert.equal(parsedViaMainRoute.nodes.size > 0, true);
assert.equal(parsedViaMainRoute.restraints.length, 12);
assert.ok(parsedViaMainRoute.restraints.some((record) => record.family === 'LINE_STOP'));

for (const support of parsedViaMainRoute.supports) {
  assert.equal(support.sourceKind, 'stagedJson');
  assert.ok(typeof support.sourcePath === 'string');
  assert.ok(['REST', 'GUIDE', 'LINESTOP', 'LIMIT', 'HOLDDOWN', 'ANCHOR', 'SPRING', 'UNKNOWN'].includes(support.supportFamily));
  assert.ok('axisRaw' in support);
  assert.ok('axisCanvas' in support);
  assert.ok('matchedIsonoteRecord' in support);
  assert.ok('warningCode' in support);
  assert.ok('warningMessage' in support);
}

console.log(JSON.stringify({
  schema: parsedViaMainRoute.schema,
  sourceKind: parsedViaMainRoute.sourceKind,
  components: parsedViaMainRoute.components.length,
  pipeSegments: parsedViaMainRoute.pipeSegments.length,
  supports: parsedViaMainRoute.supports.length,
  restraints: parsedViaMainRoute.restraints.length,
  isonoteRecords: parsedViaMainRoute.isonoteRecords.length,
  matchedIsonoteSupports: parsedViaMainRoute.supports.filter((support) => support.matchedIsonoteRecord).length
}, null, 2));
