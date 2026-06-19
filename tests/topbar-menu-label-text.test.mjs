import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync('src/static-menu-label-text-controller.js', 'utf8');
const bootstrap = readFileSync('src/safe-ui-bootstrap.js', 'utf8');

[
  'staticTagBtn',
  'staticIsonoteXmlBtn',
  'staticImportXmlBtn',
  'staticSaveSessionBtn',
  'staticRestoreSessionBtn',
  'staticClearSessionBtn'
].forEach((id) => {
  assert.match(controller, new RegExp(`${id}:`), `${id} should have an explicit dropdown label`);
});

[
  'Tag',
  'ISONOTE XML',
  'Import XML',
  'Save Session',
  'Restore Session',
  'Clear Session'
].forEach((label) => {
  assert.match(controller, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${label} should be visible text in the menu-label registry`);
});

assert.match(controller, /top-menu-item-label/, 'menu label spans should be classed for stable styling');
assert.match(controller, /aria-label/, 'menu items should receive accessible labels');
assert.match(controller, /title = label/, 'menu items should receive hover titles');
assert.match(controller, /MutationObserver/, 'controller should handle menus rebuilt by the topbar layout');
assert.doesNotMatch(controller, /setInterval/, 'menu-label patch must not add polling');
assert.match(bootstrap, /static-menu-label-text-controller\.js/, 'bootstrap should load the menu label controller');
assert.match(bootstrap, /topbar-menu-label-text-20260619/, 'bootstrap should document the menu label cache marker');

console.log('topbar menu label text gate passed');
