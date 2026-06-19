import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  APP_DELEGATE_CODEMOD_SCHEMA,
  assertDelegatedAppJs,
  transformAppJsDelegate
} from '../scripts/wire-app-run-conversion-controller.mjs';

const appSource = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

test('current app.js is delegated or can be delegated by codemod', () => {
  const result = transformAppJsDelegate(appSource);
  assert.equal(result.schemaVersion, APP_DELEGATE_CODEMOD_SCHEMA);
  if (result.changed) {
    assert.deepEqual(result.changes, ['replace-direct-conversion-imports', 'delegate-runConversion']);
  } else {
    assert.deepEqual(result.changes, []);
  }
  assertDelegatedAppJs(result.output);
});

test('delegated output preserves runtime and UI handoff hooks', () => {
  const { output } = transformAppJsDelegate(appSource);
  assert.match(output, /setConvertDisabled: \(disabled\) => \{ el\('convertBtn'\)\.disabled = disabled; \}/);
  assert.match(output, /clearMeasurement,/);
  assert.match(output, /clearSelection,/);
  assert.match(output, /publishViewerRuntime,/);
  assert.match(output, /setModelScene/);
  assert.match(output, /setInputDrawer/);
  assert.match(output, /setPropsDrawer/);
  assert.match(output, /setDownloadButtons/);
});

test('codemod is idempotent after first transform', () => {
  const once = transformAppJsDelegate(appSource).output;
  const twice = transformAppJsDelegate(once);
  assert.equal(twice.changed, false);
  assert.deepEqual(twice.changes, []);
  assert.equal(twice.output, once);
  assertDelegatedAppJs(twice.output);
});

test('codemod rejects unrelated app text instead of guessing', () => {
  assert.throws(
    () => transformAppJsDelegate('import * as THREE from \'three\';\nfunction runConversion() {}\n'),
    /Could not find legacy conversion import block or delegate import/
  );
});

console.log('app-js delegate codemod phase gate passed');
