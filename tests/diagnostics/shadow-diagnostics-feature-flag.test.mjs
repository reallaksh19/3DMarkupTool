import assert from 'node:assert/strict';
import {
  getShadowDiagnosticsFlagSource,
  isShadowDiagnosticsEnabled
} from '../../src/diagnostics/shadow-diagnostics-feature-flag.js';

assert.equal(isShadowDiagnosticsEnabled(null, null), false, 'disabled without browser-like globals');
assert.equal(getShadowDiagnosticsFlagSource(null, null), 'disabled');
assert.equal(isShadowDiagnosticsEnabled({ search: '' }, storage('false')), false, 'disabled by default');
assert.equal(isShadowDiagnosticsEnabled({ search: '?shadowDiagnostics=1' }, storage('false')), true, 'enabled by URL query');
assert.equal(getShadowDiagnosticsFlagSource({ search: '?shadowDiagnostics=1' }, storage('false')), 'url', 'URL has priority');
assert.equal(isShadowDiagnosticsEnabled({ search: '?shadowDiagnostics=0' }, storage('true')), true, 'enabled by localStorage key');
assert.equal(getShadowDiagnosticsFlagSource({ search: '?shadowDiagnostics=0' }, storage('true')), 'localStorage');
assert.equal(isShadowDiagnosticsEnabled({ search: '?shadowDiagnostics=true' }, storage('false')), false, 'only query value 1 enables');

let setItemCallCount = 0;
const readOnlyStorage = {
  getItem(key) {
    assert.equal(key, '3dmt.shadowDiagnostics.enabled');
    return 'true';
  },
  setItem() { setItemCallCount += 1; }
};
assert.equal(isShadowDiagnosticsEnabled({ search: '' }, readOnlyStorage), true, 'storage read enables');
assert.equal(setItemCallCount, 0, 'feature flag helper does not write localStorage');
assert.equal(isShadowDiagnosticsEnabled({ get search() { throw new Error('boom'); } }, { getItem() { throw new Error('boom'); } }), false, 'fails closed on throwing browser APIs');

console.log('shadow diagnostics feature flag tests passed');

function storage(value) {
  return { getItem: () => value, setItem: () => { throw new Error('setItem must not be called'); } };
}
