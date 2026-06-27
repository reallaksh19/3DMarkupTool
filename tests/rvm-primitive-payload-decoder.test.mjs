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
  'generated RVM must use only the currently emitted default primitive codes'
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

const referenceObservedLayouts = [
  { code: 1, bodyLength: 108, expectedStatus: 'emitted-layout-supported', rmss: true, rhbg: false, supported: true, blocked: false },
  { code: 2, bodyLength: 92, expectedStatus: 'emitted-layout-supported', rmss: true, rhbg: true, supported: true, blocked: false },
  { code: 3, bodyLength: 96, expectedStatus: 'reference-observed-layout-blocked', rmss: false, rhbg: true, supported: false, blocked: true },
  { code: 4, bodyLength: 92, expectedStatus: 'emitted-layout-supported', rmss: true, rhbg: true, supported: true, blocked: false },
  { code: 5, bodyLength: 88, expectedStatus: 'reference-observed-layout-blocked', rmss: true, rhbg: true, supported: false, blocked: true },
  { code: 6, bodyLength: 88, expectedStatus: 'reference-observed-layout-blocked', rmss: true, rhbg: false, supported: false, blocked: true },
  { code: 7, bodyLength: 116, expectedStatus: 'reference-observed-layout-blocked', rmss: true, rhbg: true, supported: false, blocked: true },
  { code: 8, bodyLength: 88, expectedStatus: 'emitted-layout-supported', rmss: true, rhbg: true, supported: true, blocked: false },
  { code: 11, bodyLength: 708, expectedStatus: 'reference-observed-layout-blocked', rmss: true, rhbg: true, supported: false, blocked: true },
  { code: 11, bodyLength: 18340, expectedStatus: 'reference-observed-layout-blocked', rmss: true, rhbg: true, supported: false, blocked: true }
];

for (const layout of referenceObservedLayouts) {
  const classification = classifyRvmPrimitivePayload(layout.code, layout.bodyLength);
  assert.equal(classification.compatibilityStatus, layout.expectedStatus, `reference-observed code ${layout.code} must have the expected compatibility status`);
  assert.equal(classification.lengthMatchesKnownLayout, true, `reference-observed code ${layout.code}:${layout.bodyLength} must preserve its observed body length`);
  assert.equal(classification.rmssObserved, layout.rmss, `code ${layout.code} RMSS observation flag must match`);
  assert.equal(classification.rhbgObserved, layout.rhbg, `code ${layout.code} RHBG observation flag must match`);
  assert.equal(classification.referenceObserved, true, `code ${layout.code} must be in the combined reference-observed set`);
  assert.equal(classification.supportedForEmission, layout.supported, `code ${layout.code} supported-for-emission flag must match contract state`);
  assert.equal(classification.referenceObservedButBlocked, layout.blocked, `code ${layout.code} reference-blocked flag must match contract state`);
}

const unexpectedCode11Length = classifyRvmPrimitivePayload(11, 900);
assert.equal(unexpectedCode11Length.compatibilityStatus, 'reference-observed-code-unexpected-length');
assert.equal(unexpectedCode11Length.lengthMatchesKnownLayout, false);

assert.equal(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[4].emittedKind, 'elbow', 'code 4 must now map to the contract-supported elbow kind');
assert.equal(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[4].semanticType, 'rmss-rhbg-elbow-bend-like', 'RMSS/RHBG code 4 must be identified as elbow/bend-like');
assert.deepEqual(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[4].payloadFields, ['bendRadius', 'tubeRadius', 'sweepAngleRad']);
assert.equal(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[5].semanticType, 'rmss-rhbg-cone-like-blocked', 'RMSS/RHBG code 5 must be identified as cone-like but blocked');
assert.deepEqual(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[5].payloadFields, ['radius', 'height']);
assert.equal(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[6].semanticType, 'rmss-cap-dish-like-blocked', 'RMSS code 6 must be identified as cap/dish-like but blocked');
assert.deepEqual(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[6].payloadFields, ['radius', 'heightOrDepth']);
assert.equal(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[7].payloadWordCount, 9, 'RMSS/RHBG code 7 layout length must remain recorded');
assert.equal(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[7].semanticType, 'rmss-rhbg-frustum-like-blocked', 'RMSS/RHBG code 7 must be identified as frustum-like but blocked');
assert.deepEqual(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[7].payloadFields.slice(0, 3), ['baseRadius', 'topRadius', 'height']);
assert.equal(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[11].variableBodyLength, true, 'RMSS/RHBG code 11 must be treated as a variable-length mesh/facet candidate');
assert.deepEqual(RVM_PRIMITIVE_PAYLOAD_LAYOUTS[11].knownBodyLengths, [708, 1316, 1468, 3748, 4508, 16820, 17124, 18340]);

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
assert.equal(decoded.schema, 'RvmPrimitivePayloadDecode.v3');
assert.equal(decoded.code, 8);
assert.equal(decoded.parameters.radius, 123);
assert.equal(decoded.parameters.length, 456);

const elbowBody = makePrimitiveBody({
  code: 4,
  bodyLength: 92,
  bbox: [-414.55, -414.55, -109.55, 414.55, 414.55, 109.55],
  payload: [305, 109.55, Math.PI / 2]
});
const elbow = decodeRvmPrimitivePayload(elbowBody);
assert.equal(elbow.code, 4);
assert.equal(elbow.supportedForEmission, true, 'code 4 is contract-supported, while writeRvm emission remains experimentally gated');
assert.equal(elbow.compatibilityStatus, 'emitted-layout-supported');
assert.equal(elbow.semanticType, 'rmss-rhbg-elbow-bend-like');
assert.equal(elbow.candidateEmissionKind, 'elbow');
assert.equal(elbow.semanticConfidence, 'writer-owned');
assertAlmostEqual(elbow.payloadSemantics.bendRadius, 305);
assertAlmostEqual(elbow.payloadSemantics.tubeRadius, 109.55);
assertAlmostEqual(elbow.payloadSemantics.sweepAngleRad, Math.PI / 2);

const coneBody = makePrimitiveBody({
  code: 5,
  bodyLength: 88,
  bbox: [-110.25, -110.25, 0, 110.25, 110.25, 102.375],
  payload: [110.25, 102.375]
});
const cone = decodeRvmPrimitivePayload(coneBody);
assert.equal(cone.code, 5);
assert.equal(cone.supportedForEmission, false, 'RMSS/RHBG code 5 remains blocked for emission');
assert.equal(cone.semanticType, 'rmss-rhbg-cone-like');
assert.equal(cone.candidateEmissionKind, 'cone');
assert.equal(cone.bboxConsistentWithPayload, true);
assertAlmostEqual(cone.payloadSemantics.radius, 110.25);
assertAlmostEqual(cone.payloadSemantics.height, 102.375);

const capBody = makePrimitiveBody({
  code: 6,
  bodyLength: 88,
  bbox: [-84, -84, -25, 84, 84, 25],
  payload: [84, 50]
});
const cap = decodeRvmPrimitivePayload(capBody);
assert.equal(cap.code, 6);
assert.equal(cap.supportedForEmission, false, 'RMSS code 6 remains blocked for emission');
assert.equal(cap.semanticType, 'rmss-cap-dish-like');
assert.equal(cap.candidateEmissionKind, 'cap');
assert.equal(cap.bboxConsistentWithPayload, true);
assertAlmostEqual(cap.payloadSemantics.radius, 84);
assertAlmostEqual(cap.payloadSemantics.heightOrDepth, 50);

const frustumBody = makePrimitiveBody({
  code: 7,
  bodyLength: 116,
  bbox: [-111.85, -111.85, -55.55, 111.85, 111.85, 55.55],
  payload: [111.85, 84.2, 111.1, 0, 0, 0, 0, 0, 0]
});
const frustum = decodeRvmPrimitivePayload(frustumBody);
assert.equal(frustum.code, 7);
assert.equal(frustum.supportedForEmission, false, 'RMSS/RHBG code 7 remains blocked for emission');
assert.equal(frustum.semanticType, 'rmss-rhbg-frustum-like');
assert.equal(frustum.candidateEmissionKind, 'frustum');
assert.equal(frustum.bboxConsistentWithPayload, true);
assertAlmostEqual(frustum.payloadSemantics.baseRadius, 111.85);
assertAlmostEqual(frustum.payloadSemantics.topRadius, 84.2);
assertAlmostEqual(frustum.payloadSemantics.height, 111.1);

const meshBody = makePrimitiveBody({
  code: 11,
  bodyLength: 708,
  bbox: [-100, -100, -100, 100, 100, 100],
  payload: Array.from({ length: 157 }, (_, index) => index + 0.25)
});
const mesh = decodeRvmPrimitivePayload(meshBody);
assert.equal(mesh.code, 11);
assert.equal(mesh.supportedForEmission, false, 'RMSS/RHBG code 11 remains blocked for emission');
assert.equal(mesh.semanticType, 'rmss-rhbg-mesh-facet-like');
assert.equal(mesh.candidateEmissionKind, 'mesh');
assert.equal(mesh.payloadWordCount, 157);
assert.equal(mesh.parameters.meshPayload0, 0.25);
assert.equal(mesh.payloadSemantics.payloadWordCount, 157);
assert.equal(mesh.payloadSemantics.knownBodyLength, true);
assert.deepEqual(mesh.payloadSemantics.sampleWords.slice(0, 3), [0.25, 1.25, 2.25]);

const standaloneSemantics = inferRvmPrimitivePayloadSemantics(7, frustum.bbox, frustum.payload, classifyRvmPrimitivePayload(7, 116));
assert.equal(standaloneSemantics.semanticType, 'rmss-rhbg-frustum-like');
assert.equal(standaloneSemantics.bboxConsistentWithPayload, true);

assert.match(decoderSource, /RMSS_OBSERVED_PRIMITIVE_CODES/, 'decoder must be tied to the central RMSS-observed primitive code contract');
assert.match(decoderSource, /RHBG_OBSERVED_PRIMITIVE_CODES/, 'decoder must remain tied to the central RHBG-observed primitive code contract');
assert.match(decoderSource, /reference-observed-layout-blocked/, 'decoder must keep reference-observed but unimplemented layouts blocked');
assert.match(decoderSource, /rmss-rhbg-frustum-like/, 'decoder must preserve RMSS/RHBG code 7 frustum-like semantics');
assert.match(decoderSource, /rmss-rhbg-cone-like/, 'decoder must preserve RMSS/RHBG code 5 cone-like semantics');
assert.match(decoderSource, /rmss-cap-dish-like/, 'decoder must record RMSS code 6 cap/dish-like semantics');
assert.match(decoderSource, /rmss-rhbg-mesh-facet-like/, 'decoder must record RMSS/RHBG code 11 mesh/facet-like semantics');
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

function assertAlmostEqual(actual, expected, tolerance = 1e-4) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}
