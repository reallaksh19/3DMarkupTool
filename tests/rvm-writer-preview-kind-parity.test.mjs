import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ALLOWED_RVM_PRIMITIVE_KINDS,
  RVM_PRIMITIVE_KIND_CODES,
  RVM_PRIMITIVE_KIND_CONTRACT
} from '../src/rvm-primitive-kind-contract.js';
import {
  RVM_WRITER_PRIMITIVE_BODY_BUILDERS,
  RVM_WRITER_PRIMITIVE_LOCAL_BBOX_BUILDERS
} from '../src/rvm-writer.js';
import { RVM_PREVIEW_PRIMITIVE_MESH_BUILDERS } from '../src/rvm-preview.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const contractKinds = sorted(ALLOWED_RVM_PRIMITIVE_KINDS);
const writerKinds = sorted(RVM_WRITER_PRIMITIVE_BODY_BUILDERS.keys());
const writerBboxKinds = sorted(RVM_WRITER_PRIMITIVE_LOCAL_BBOX_BUILDERS.keys());
const previewKinds = sorted(RVM_PREVIEW_PRIMITIVE_MESH_BUILDERS.keys());

assert.deepEqual(writerKinds, contractKinds, 'writeRvm() primitive body dispatch must exactly match the central kind contract');
assert.deepEqual(writerBboxKinds, contractKinds, 'writeRvm() local bbox dispatch must exactly match the central kind contract');
assert.deepEqual(previewKinds, contractKinds, 'createRvmPreviewScene() primitive dispatch must exactly match the central kind contract');

for (const kind of contractKinds) {
  const contract = RVM_PRIMITIVE_KIND_CONTRACT[kind];
  assert.equal(RVM_PRIMITIVE_KIND_CODES[kind], contract.code, `${kind} code map must derive from the contract`);
  assert.equal(typeof contract.paramCount, 'number', `${kind} contract must declare a paramCount`);
  assert.ok(contract.paramCount >= 1, `${kind} contract must declare a positive paramCount`);
  assert.ok(Array.isArray(contract.params), `${kind} contract must document parameter names`);
  assert.equal(contract.params.length, contract.paramCount, `${kind} contract params must match paramCount`);
}

assert.equal(RVM_PRIMITIVE_KIND_CODES.elbow, 4, 'elbow must be promoted into the primitive kind contract');
assert.equal(RVM_PRIMITIVE_KIND_CONTRACT.elbow.paramCount, 3, 'code 4 elbow must keep its verified 3-float payload');
assert.deepEqual(RVM_PRIMITIVE_KIND_CONTRACT.elbow.params, ['bendRadius', 'tubeRadius', 'sweepAngleRad']);

assert.equal(RVM_PRIMITIVE_KIND_CODES.cylinder, 8, 'cylinder must remain code 8');
assert.equal(RVM_PRIMITIVE_KIND_CODES.sphere, 9, 'sphere must remain code 9');
assert.match(pkg.scripts.test, /rvm-writer-preview-kind-parity\.test\.mjs/, 'npm test must include the writer/preview primitive kind parity guard');

console.log('RVM writer/preview primitive kind parity contract passed');

function sorted(values) {
  return Array.from(values).sort((a, b) => String(a).localeCompare(String(b)));
}
