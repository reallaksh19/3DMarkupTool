import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertAttExportModelContract,
  assertGlbVisualModelContract,
  assertRvmExportModelContract,
  validateAttExportModelContract,
  validateGlbVisualModelContract,
  validateRvmExportModelContract
} from '../../src/contracts/index.js';

const rvm = await readJson('samples/export-models/minimal-export-model.expected.rvm-export-model.json');
const att = await readJson('samples/export-models/minimal-export-model.expected.att-export-model.json');
const glb = await readJson('samples/export-models/minimal-export-model.expected.glb-visual-model.json');

assert.equal(assertRvmExportModelContract(rvm).ok, true, 'RVM export model validates');
assert.equal(assertAttExportModelContract(att).ok, true, 'ATT export model validates');
assert.equal(assertGlbVisualModelContract(glb).ok, true, 'GLB visual model validates');

for (const forbidden of ['binary', 'bytes', 'buffer', 'arrayBuffer', 'chunk', 'cntb', 'primBody', 'fileBlob', 'downloadUrl', 'attText', 'glbBytes', 'gltfJson', 'threeObject', 'threeGeometry', 'meshGeometry', 'materialId', 'writerPayload']) {
  const badRvm = structuredClone(rvm);
  badRvm.primitives[0][forbidden] = forbidden;
  assert.equal(validateRvmExportModelContract(badRvm).ok, false, `RVM contract rejects ${forbidden}`);

  const badAtt = structuredClone(att);
  badAtt.records[0][forbidden] = forbidden;
  assert.equal(validateAttExportModelContract(badAtt).ok, false, `ATT contract rejects ${forbidden}`);

  const badGlb = structuredClone(glb);
  badGlb.visualItems[0][forbidden] = forbidden;
  assert.equal(validateGlbVisualModelContract(badGlb).ok, false, `GLB contract rejects ${forbidden}`);
}

console.log('export model contract tests passed');

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
