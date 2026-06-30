import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertWriterAdapterPlanContract,
  validateWriterAdapterPlanContract
} from '../../src/contracts/index.js';

const plan = await readJson('samples/writer-adapters/minimal-writer-adapter.expected.writer-adapter-plan.json');
assert.equal(assertWriterAdapterPlanContract(plan).ok, true, 'writer adapter plan fixture validates');
assert.equal(plan.mode, 'dryRun', 'default fixture mode is dryRun');
assert.equal(plan.rvmAdapter.writerReady, false, 'RVM writer artifact readiness stays blocked for placeholder transform');
assert.equal(plan.attAdapter.writerReady, true, 'ATT metadata readiness is true');
assert.equal(plan.glbAdapter.writerReady, true, 'GLB model readiness is true');

for (const forbidden of [
  'binary',
  'bytes',
  'buffer',
  'arrayBuffer',
  'chunkBytes',
  'cntbBytes',
  'primBody',
  'fileBlob',
  'objectUrl',
  'downloadUrl',
  'attText',
  'glbBytes',
  'gltfJson',
  'threeObject',
  'threeGeometry',
  'meshGeometry',
  'writerPayload',
  'filePath',
  'writeResult'
]) {
  const bad = structuredClone(plan);
  bad.rvmAdapter.plannedChunks[0][forbidden] = forbidden;
  const result = validateWriterAdapterPlanContract(bad);
  assert.equal(result.ok, false, `contract rejects ${forbidden}`);
  assert.ok(result.errors.some((entry) => entry.includes(forbidden)), `error list mentions ${forbidden}`);
}

console.log('writer adapter contract tests passed');

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
