import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

import { writeRvm } from '../src/rvm-writer.js';
import { RVM_PRIMITIVE_KIND_CODES, RVM_PRIMITIVE_KIND_CONTRACT } from '../src/rvm-primitive-kind-contract.js';
import { scanRvmPrimitivePayloads } from '../src/rvm-primitive-payload-decoder.js';
import { createRvmPreviewScene } from '../src/rvm-preview.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const snoutPrimitive = {
  kind: 'snout',
  name: 'SYNTHETIC_CODE7_SNOUT',
  center: [10, 20, 30],
  basis: {
    x: [1, 0, 0],
    y: [0, 1, 0],
    z: [0, 0, 1]
  },
  radiusBottom: 40,
  radiusTop: 90,
  height: 400,
  offsetX: 30,
  offsetY: -25,
  material: 7
};

assert.equal(RVM_PRIMITIVE_KIND_CODES.snout, 7);
assert.equal(RVM_PRIMITIVE_KIND_CONTRACT.snout.paramCount, 9);
assert.deepEqual(RVM_PRIMITIVE_KIND_CONTRACT.snout.params, [
  'radiusBottom',
  'radiusTop',
  'height',
  'offsetX',
  'offsetY',
  'botShearX',
  'botShearY',
  'topShearX',
  'topShearY'
]);

const rvm = writeRvm(exportModelWithPrimitive(snoutPrimitive));
const [decoded] = scanRvmPrimitivePayloads(rvm);
assert.equal(decoded.code, 7);
assert.equal(decoded.emittedKind, 'snout');
assert.equal(decoded.supportedForEmission, true);
assert.equal(decoded.compatibilityStatus, 'emitted-layout-supported');
assert.equal(decoded.bodyLength, 116);
assert.equal(decoded.payloadWordCount, 9);
assert.deepEqual(decoded.parameters, {
  radiusBottom: 40,
  radiusTop: 90,
  height: 400,
  offsetX: 30,
  offsetY: -25,
  botShearX: 0,
  botShearY: 0,
  topShearX: 0,
  topShearY: 0
});
assertArrayAlmostEqual(decoded.bbox, [-60, -115, -200, 120, 65, 200]);
assert.equal(decoded.bboxConsistentWithPayload, true);
assert.equal(decoded.semanticConfidence, 'writer-owned');
assert.equal(decoded.candidateEmissionKind, 'snout');
assert.equal(decoded.semanticType, 'rmss-rhbg-frustum-like');
assertAlmostEqual(decoded.payloadSemantics.radiusBottom, 40);
assertAlmostEqual(decoded.payloadSemantics.radiusTop, 90);
assertAlmostEqual(decoded.payloadSemantics.height, 400);
assertAlmostEqual(decoded.payloadSemantics.offsetX, 30);
assertAlmostEqual(decoded.payloadSemantics.offsetY, -25);

const scene = createRvmPreviewScene(exportModelWithPrimitive(snoutPrimitive), { recenter: false });
const snoutMesh = findPrimitiveMesh(scene, 'snout');
assert.ok(snoutMesh, 'preview scene must contain the snout mesh');
assert.equal(snoutMesh.name, 'SYNTHETIC_CODE7_SNOUT');
assert.equal(snoutMesh.userData.primitiveCode, 7);
assert.equal(snoutMesh.userData.previewGeometry, 'snout-frustum');
assert.equal(snoutMesh.userData.heightAxis, 'basis.z');

snoutMesh.geometry.computeBoundingBox();
const previewBox = snoutMesh.geometry.boundingBox;
assertAlmostEqual(previewBox.min.x, -60);
assertAlmostEqual(previewBox.max.x, 120);
assertAlmostEqual(previewBox.min.y, -115);
assertAlmostEqual(previewBox.max.y, 65);
assertAlmostEqual(previewBox.min.z, -200);
assertAlmostEqual(previewBox.max.z, 200);

const previewSize = previewBox.getSize(new THREE.Vector3());
assertAlmostEqual(previewSize.x, 180);
assertAlmostEqual(previewSize.y, 180);
assertAlmostEqual(previewSize.z, 400, 1e-3);

const coneRvm = writeRvm(exportModelWithPrimitive({
  ...snoutPrimitive,
  name: 'SYNTHETIC_CODE7_CONE_BY_SNOUT',
  radiusBottom: 60,
  radiusTop: 0,
  height: 120,
  offsetX: 0,
  offsetY: 0
}));
const [cone] = scanRvmPrimitivePayloads(coneRvm);
assert.equal(cone.code, 7, 'cone-style tapered head must still be emitted as snout code 7');
assertArrayAlmostEqual(cone.payload, [60, 0, 120, 0, 0, 0, 0, 0, 0]);
assertArrayAlmostEqual(cone.bbox, [-60, -60, -60, 60, 60, 60]);

assert.match(pkg.scripts.test, /rvm-snout-code7-writer-preview\.test\.mjs/, 'npm test must include the snout writer/preview test');

console.log('RVM code 7 snout writer/preview test passed');

function exportModelWithPrimitive(primitive) {
  return {
    root: {
      name: 'ROOT',
      reviewName: '/INPUTXML',
      material: 1,
      children: [],
      primitives: [primitive]
    },
    rvmMaterialColors: {
      1: '0x82828200',
      7: '0xff21d4c4'
    }
  };
}

function findPrimitiveMesh(root, primitiveKind) {
  let found = null;
  root.traverse((object) => {
    if (!found && object.userData?.primitiveKind === primitiveKind) found = object;
  });
  return found;
}

function assertAlmostEqual(actual, expected, tolerance = 1e-4) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

function assertArrayAlmostEqual(actual, expected, tolerance = 1e-4) {
  assert.equal(actual.length, expected.length, 'array lengths must match');
  actual.forEach((value, index) => assertAlmostEqual(value, expected[index], tolerance));
}
