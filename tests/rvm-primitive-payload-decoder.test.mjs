import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { writeRvm } from '../src/rvm-writer.js';
import {
  classifyRvmPrimitivePayload,
  decodeRvmPrimitivePayload,
  RVM_PRIMITIVE_PAYLOAD_LAYOUTS,
  scanRvmPrimitivePayloads,
  assertNoBlockedRhbgPrimitivePayloads,
  inferRvmPrimitivePayloadSemantics
} from '../src/rvm-primitive-payload-decoder.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const decoderSource = readFileSync(new URL('../src/rvm-primitive-payload-decoder.js', import.meta.url), 'utf8');

const exportModel = {
  root: {
    name: 'ROOT',
    primitives: [],
    children: [
      {
        name: 'PRIMS',
        primitives: [
          {
            name: 'PYRAMID',
            kind: 'pyramid',
            center: [0, 0, 0],
            direction: [0, 0, 1],
            bottom: [200, 100],
            top: [20, 10],
            offset: [0, 0],
            height: 150
          },
          {
            name: 'BOX',
            kind: 'box',
            center: [100, 0, 0],
            direction: [0, 0, 1],
            lengths: [10, 20, 30]
          },
          {
            name: 'CYLINDER',
            kind: 'cylinder',
            center: [500, 0, 0],
            direction: [1, 0, 0],
            radius: 50,
            length: 1000
          },
          {
            name: 'SPHERE',
            kind: 'sphere',
            center: [200, 0, 0],
            direction: [0, 0, 1],
            diameter: 40
          }
        ],
        children: []
      }
    ]
  }
};

const rvm = writeRvm(exportModel);
const primitivePayloads = scanRvmPrimitivePayloads(rvm);
assert.equal(primitivePayloads.length, 4, 'decoder must find all generated PRIM chunks');
assert.deepEqual(
  primitivePayloads.map((primitive) => primitive.code).sort((a, b) => a - b),
  [1, 2, 8, 9],
  'generated RVM must use only the currently emitted primitive codes'
);

const byCode = new Map(primitivePayloads.map((primitive) => [primitive.code, primitive]));
assert.equal(byCode.get(1).emittedKind, 'pyramid');
assert.equal(byCode.get(1).bodyLength, 108);
assert.equal(byCode.get(1).payloadWordCount, 7);
assert.equal(byCode.get(1).semanticType, 'rectangular-pyramid');
assert.equal(byCode.get(2).emittedKind, 'box');
assert.equal(byCode.get(2).bodyLength, 92);
assert.equal(byCode.get(2).parameters.lengthX, 10);
assert.equal(byCode.get(8).emittedKind, 'cylinder');
assert.equal(byCode.get(8).bodyLength, 88);
assert.equal(byCode.get(8).parameters.radius, 50);
assert.equal(byCode.get(8).parameters.length, 1000);
assert.equal(byCode.get(9).emittedKind, 'sphere');
assert.equal(byCode.get(9).bodyLength, 84);
assert.equal(byCode.get(9).parameters.diameter, 40);
assertNoBlockedRhbgPrimitivePayloads(primitivePayloads, 'synthetic writer output');

for (const primitive of primitivePayloads) {
  assert.equal(primitive.version, 1, 'generated primitive records must start with version marker 1');
  assert.equal(primitive.compatibilityStatus, 'emitted-layout-supported', `generated code ${primitive.code} must decode as an emitted supported layout`);
  assert.equal(primitive.supportedForEmission, true, `generated code ${primitive.code} must be supported for emission`);
  assert.equal(primitive.lengthMatchesKnownLayout, true, `generated code ${primitive.code} must match its known body length`);
}

const rhbgObservedLayouts = [
  { code: 2, bodyLength: 92, expectedStatus: 'emitted-layout-supported' },
  { code: 3, bodyLength: 96, expectedStatus: 'rhbg-observed-layout-blocked' },
  { code: 4, bodyLength: 92, expectedStatus: 'rhbg-observed-layout-blocked' },
  { code: 5, bodyLength: 88, expectedStatus: 'rhbg-observed-layout-blocked' },
  { code: 7, bodyLength: 116, expectedStatus: 'rhbg-observed-layout-blocked' },
  { code: 8, bodyLength: 88, expectedStatus: 'emitted-layout-supported' },
  { code: 11, bodyLength: 708, expectedStatus: 'rhbg-observed-layout-blocked' }
];

for (const layout of rhbgObservedLayouts) {
  const classification = classifyRvmPrimitivePayload(layout.code, layout.bodyLength);
  assert.equal(classification.compatibilityStatus, layout.expectedStatus, `RHBG-observed code ${layout.code} must have the expected compatibility status`);
  assert.equal(classification.lengthMatchesKnownLayout, true, `RHBG-observed code ${layout.code} must preserve its observed body length`);
  if ([3, 4, 5, 7, 11].includes(layout.code)) {
    assert.equal(classification.supportedForEmission, false, `RHBG-observed code ${layout.code} must remain blocked until its payload semantics are implemented`);
    assert.equal(classification.rhbgObservedButBlocked, true, `RHBG-observed code ${layout.code} must be explicitly blocked`);
  }
}

assert.equal(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[5].semanticType, 'rhbg-cone-like-blocked', 'RHBG code 5 must be identified as cone-like but blocked');
assert.deepEqual(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[5].payloadFields, ['radius', 'height']);
assert.equal(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[7].payloadWordCount, 9, 'RHBG code 7 layout length must remain recorded');
assert.equal(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[7].semanticType, 'rhbg-frustum-like-blocked', 'RHBG code 7 must be identified as frustum-like but blocked');
assert.deepEqual(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[7].payloadFields.slice(0, 3), ['baseRadius', 'topRadius', 'height']);
assert.equal(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[11].payloadWordCount, 157, 'RHBG code 11 complex payload length must remain recorded');

const unknown = classifyRvmPrimitivePayload(99, 124);
assert.equal(unknown.compatibilityStatus, 'unknown-primitive-payload');
assert.equal(unknown.supportedForEmission, false);

const syntheticBody = new ArrayBuffer(88);
const view = new DataView(syntheticBody);
view.setUint32(0, 1, false);
view.setUint32(4, 8, false);
view.setFloat32(80, 123, false);
view.setFloat32(84, 456, false);
const decoded = decodeRvmPrimitivePayload(syntheticBody);
assert.equal(decoded.schema, 'RvmPrimitivePayloadDecode.v2');
assert.equal(decoded.code, 8);
assert.equal(decoded.parameters.radius, 123);
assert.equal(decoded.parameters.length, 456);

const coneBody = makePrimitiveBody({
  code: 5,
  bodyLength: 88,
  bbox: [-110.25, -110.25, 0, 110.25, 110.25, 102.375],
  payload: [110.25, 102.375]
});
const cone = decodeRvmPrimitivePayload(coneBody);
assert.equal(cone.code, 5);
assert.equal(cone.supportedForEmission, false, 'RHBG code 5 remains blocked for emission');
assert.equal(cone.semanticType, 'rhbg-cone-like');
assert.equal(cone.candidateEmissionKind, 'cone');
assert.equal(cone.bboxConsistentWithPayload, true);
assert.equal(cone.payloadSemantics.radius, 110.25);
assert.equal(cone.payloadSemantics.height, 102.375);

const frustumBody = makePrimitiveBody({
  code: 7,
  bodyLength: 116,
  bbox: [-111.85, -111.85, -55.55, 111.85, 111.85, 55.55],
  payload: [111.85, 84.2, 111.1, 0, 0, 0, 0, 0, 0]
});
const frustum = decodeRvmPrimitivePayload(frustumBody);
assert.equal(frustum.code, 7);
assert.equal(frustum.supportedForEmission, false, 'RHBG code 7 remains blocked for emission');
assert.equal(frustum.semanticType, 'rhbg-frustum-like');
assert.equal(frustum.candidateEmissionKind, 'frustum');
assert.equal(frustum.bboxConsistentWithPayload, true);
assert.equal(frustum.payloadSemantics.baseRadius, 111.85);
assert.equal(frustum.payloadSemantics.topRadius, 84.2);
assert.equal(frustum.payloadSemantics.height, 111.1);

const standaloneSemantics = inferRvmPrimitivePayloadSemantics(7, frustum.bbox, frustum.payload, classifyRvmPrimitivePayload(7, 116));
assert.equal(standaloneSemantics.semanticType, 'rhbg-frustum-like');
assert.equal(standaloneSemantics.bboxConsistentWithPayload, true);

assert.match(decoderSource, /RHBG_OBSERVED_PRIMITIVE_CODES/, 'decoder must be tied to the central RHBG-observed primitive code contract');
assert.match(decoderSource, /rhbg-observed-layout-blocked/, 'decoder must keep RHBG-observed but unimplemented layouts blocked');
assert.match(decoderSource, /rhbg-frustum-like/, 'decoder must preserve RHBG code 7 frustum-like semantics');
assert.match(decoderSource, /rhbg-cone-like/, 'decoder must preserve RHBG code 5 cone-like semantics');
assert.match(pkg.scripts.test, /rvm-primitive-payload-decoder\.test\.mjs/, 'npm test must include the RVM primitive payload decoder test');

console.log('RVM primitive payload decoder technical test passed');

function makePrimitiveBody({ code, bodyLength, bbox, payload }) {
  const body = new ArrayBuffer(bodyLength);
  const dataView = new DataView(body);
  dataView.setUint32(0, 1, false);
  dataView.setUint32(4, code, false);
  for (let index = 0; index < 12; index += 1) {
    dataView.setFloat32(8 + index * 4, 0, false);
  }
  for (let index = 0; index < 6; index += 1) {
    dataView.setFloat32(56 + index * 4, bbox[index] ?? 0, false);
  }
  for (let index = 0; index < payload.length; index += 1) {
    dataView.setFloat32(80 + index * 4, payload[index], false);
  }
  return body;
}
