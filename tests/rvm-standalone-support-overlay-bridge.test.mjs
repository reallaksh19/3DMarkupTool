import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bridge = readFileSync(new URL('../viewer/rvm-viewer/RvmInputXmlSupportGraphicsSetModelBridge.js', import.meta.url), 'utf8');
const viewerEntry = readFileSync(new URL('../viewer/main-rhbg-fitguard.js', import.meta.url), 'utf8');
const viewerIndex = readFileSync(new URL('../viewer/index.html', import.meta.url), 'utf8');

for (const required of [
  'STANDALONE_RVM_SUPPORT_OWNER_RE',
  'INPUTXML-',
  'LINESTOP',
  'RVM_PRIMITIVE_CODE',
  'RVM_NATIVE_CYLINDER',
  'RVM_BINARY_BROWSER_FALLBACK',
  'BROWSER_PARSE_METHOD',
  'RVM_BROWSER_RENDER_PRIMITIVE',
  'viewer?.scene?.traverse?.',
  'hasStandaloneFallbackNativeRvmSupportOverlay(viewer)',
  'removeLegacySupportOverlay(viewer)',
  '__inputXmlGraphicsSetModelBridgeV11'
]) {
  assert.ok(bridge.includes(required), `bridge must contain ${required}`);
}

assert.ok(
  viewerEntry.includes('RvmInputXmlSupportGraphicsSetModelBridge.js?v=20260622-rvm-standalone-support-overlay-1'),
  'viewer startup must load the standalone RVM support overlay bridge with a fresh cache key'
);
assert.ok(
  viewerIndex.includes('main-rhbg-fitguard.js?v=20260622-rvm-standalone-support-overlay-1'),
  'viewer root index must use the fresh standalone support overlay cache key'
);

console.log('standalone RVM support overlay bridge regression passed');
