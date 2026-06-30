import assert from 'node:assert/strict';
import {
  getShadowPreviewFlagSource,
  isShadowPreviewEnabled
} from '../../src/diagnostics/shadow-preview-feature-flag.js';

assert.equal(isShadowPreviewEnabled(null, null), false, 'disabled without browser-like globals');
assert.equal(getShadowPreviewFlagSource(null, null), 'disabled');
assert.equal(isShadowPreviewEnabled({ search: '' }, storage('false')), false, 'disabled by default');
assert.equal(isShadowPreviewEnabled({ search: '?shadowPreview=1' }, storage('false')), true, 'enabled by URL query');
assert.equal(getShadowPreviewFlagSource({ search: '?shadowPreview=1' }, storage('false')), 'url');
assert.equal(isShadowPreviewEnabled({ search: '?shadowPreview=0' }, storage('true')), true, 'enabled by localStorage');
assert.equal(getShadowPreviewFlagSource({ search: '?shadowPreview=0' }, storage('true')), 'localStorage');
assert.equal(isShadowPreviewEnabled({ search: '?shadowPreview=true' }, storage('false')), false, 'only query value 1 enables');
let writes = 0;
assert.equal(isShadowPreviewEnabled({ search: '' }, { getItem: () => 'true', setItem: () => { writes += 1; } }), true);
assert.equal(writes, 0, 'preview flag helper does not write localStorage');
assert.equal(isShadowPreviewEnabled({ get search() { throw new Error('boom'); } }, { getItem() { throw new Error('boom'); } }), false, 'fails closed on throwing browser APIs');

console.log('controlled preview feature flag tests passed');

function storage(value) {
  return { getItem: () => value, setItem: () => { throw new Error('setItem must not be called'); } };
}
