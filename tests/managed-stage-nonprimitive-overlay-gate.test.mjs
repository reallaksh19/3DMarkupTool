import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  canUseManagedStageAutoBend,
  canUseManagedStageSupportOverlay,
  detectManagedStageSourceKind,
  resolveManagedStageSourceKindPolicy,
} from '../src/managed-stage-source-kind-policy.js';

const nonPrimitiveCases = [
  ['model.json', 'json'],
  ['model.jscon', 'jscon'],
  ['model.inputxml', 'inputxml'],
  ['model.xml', 'xml'],
  ['model.txt', 'txt'],
];

for (const [sourceName, expectedKind] of nonPrimitiveCases) {
  assert.equal(detectManagedStageSourceKind(sourceName), expectedKind);
  assert.equal(canUseManagedStageSupportOverlay(sourceName), true, `${sourceName} should allow source-anchored support overlay`);
  assert.equal(canUseManagedStageAutoBend(sourceName), true, `${sourceName} should allow source auto-bend preview`);
  const policy = resolveManagedStageSourceKindPolicy(sourceName);
  assert.equal(policy.supportOverlayEnabled, true);
  assert.equal(policy.autoBendEnabled, true);
}

const primitiveCases = [
  ['model.rvm', 'rvm'],
  ['model.glb', 'glb'],
  ['model.gltf', 'gltf'],
];

for (const [sourceName, expectedKind] of primitiveCases) {
  assert.equal(detectManagedStageSourceKind(sourceName), expectedKind);
  assert.equal(canUseManagedStageSupportOverlay(sourceName), false, `${sourceName} must block generated support overlay`);
  assert.equal(canUseManagedStageAutoBend(sourceName), false, `${sourceName} must block auto-bend reinterpretation`);
  const policy = resolveManagedStageSourceKindPolicy(sourceName);
  assert.equal(policy.supportOverlayEnabled, false);
  assert.equal(policy.autoBendEnabled, false);
  assert.match(policy.supportOverlayReason, /blocked/);
  assert.match(policy.autoBendReason, /blocked/);
}

assert.equal(resolveManagedStageSourceKindPolicy('ignored.json', { sourceKind: 'rvm' }).supportOverlayEnabled, false);
assert.equal(resolveManagedStageSourceKindPolicy('ignored.json', { sourceKind: 'glb' }).autoBendEnabled, false);

const setModelBridge = fs.readFileSync('viewer/rvm-viewer/RvmInputXmlSupportGraphicsSetModelBridge.js', 'utf8');
const supportGraphics = fs.readFileSync('viewer/rvm-viewer/RvmInputXmlSupportGraphics.js', 'utf8');
const uiBridge = fs.readFileSync('viewer/rvm-viewer/RvmInputXmlSupportGraphicsUiBridge.js', 'utf8');
const startup = fs.readFileSync('viewer/main-rhbg-fitguard.js', 'utf8');

assert.match(setModelBridge, /resolveManagedStageSourceKindPolicy/);
assert.match(setModelBridge, /hasNativeRvmPrimitiveIndex/);
assert.match(setModelBridge, /sourcePolicy\.supportOverlayEnabled/);
assert.match(setModelBridge, /sourcePolicy\.autoBendEnabled/);
assert.match(setModelBridge, /supportOverlayEnabled: sourcePolicy\.supportOverlayEnabled/);
assert.match(setModelBridge, /autoBendEnabled: autoBend !== false && sourcePolicy\.autoBendEnabled/);
assert.match(setModelBridge, /removeLegacySupportOverlay\(viewer\)/);
assert.match(setModelBridge, /__inputXmlGraphicsSetModelBridgeV11/);

assert.match(supportGraphics, /InputXmlSupportGraphicsOverlay\.v1/);
assert.match(supportGraphics, /support overlay is disabled for primitive\/native model sources/);
assert.match(supportGraphics, /generatedPartCount: 0/);
assert.match(supportGraphics, /managed-stage source preview\/export owns support symbols/);

assert.match(uiBridge, /supportOverlay\.nonPrimitive\.enabled/);
assert.match(uiBridge, /supportOverlay\.nonPrimitive\.autoBend/);
assert.match(uiBridge, /overlayDefaultEnabled: overlay/);
assert.match(uiBridge, /controls are hidden compatibility shims only/);

assert.match(startup, /RvmInputXmlSupportGraphicsSetModelBridge\.js\?v=20260622-nonprimitive-overlay-gate-1/);
assert.match(startup, /RvmInputXmlSupportGraphicsUiBridge\.js\?v=20260622-nonprimitive-overlay-gate-1/);

console.log(JSON.stringify({
  schema: 'ManagedStageNonPrimitiveOverlayGateTest.v1',
  nonPrimitiveAllowed: nonPrimitiveCases.map(([source]) => source),
  primitiveBlocked: primitiveCases.map(([source]) => source),
}, null, 2));
