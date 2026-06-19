import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('../src/static-review-ribbon-tools-controller.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/safe-ui-bootstrap.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const expectedKeys = [
  'marqueeZoom',
  'areaSelect',
  'componentSearch',
  'savedViews',
  'measurePolyline',
  'explodeReview',
  'viewPrevious',
  'viewNext',
  'sectionBoxSelected',
  'isolateSelected',
  'hideSelected',
  'showAll'
];

assert.match(bootstrap, /static-review-ribbon-tools-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'bootstrap must load review ribbon icon integration');
assert.doesNotMatch(bootstrap, /static-viewpad-tool-icons-context-controller\.js/, 'bootstrap must not load the old text-shortcut viewpad integration');
assert.match(bootstrap, /static-topbar-layout-controller\.js\?v=\$\{SAFE_UI_VERSION\}[\s\S]*static-review-ribbon-tools-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'review integration must load after the topbar layout controller');
assert.match(bootstrap, /esc-tools-export-icons-20260619/, 'safe bootstrap cache key must use the current ESC/export/icon stability pass');

assert.match(controller, /REVIEW_TOOL_REGISTRY/, 'controller must define one registry for ribbon, Review menu, and context-menu coverage');
assert.match(controller, /RIBBON_GROUP_ID = 'staticReviewRibbonGroup'/, 'controller must create a Review ribbon group');
assert.match(controller, /dataset\.expandedLabel = 'Review'/, 'Review ribbon group must use the app ribbon group grammar');
assert.match(controller, /className = 'tool-btn review-ribbon-tool-btn'/, 'review tools must render as existing tool-btn icon tiles');
assert.match(controller, /iconNode\(tool\.icon, 'review-ribbon-tool-icon'\)/, 'ribbon buttons must use inline SVG icons');
assert.match(controller, /TOP_MENU_ID = 'topReviewMenu'/, 'controller must add a topbar Review menu');
assert.match(controller, /CONTEXT_MENU_ID = 'staticReviewContextMenu'/, 'controller must add a canvas right-click Review menu');
assert.match(controller, /contextmenu/, 'controller must install a canvas contextmenu handler');
assert.match(controller, /__3D_MARKUP_REVIEW_RIBBON_INTEGRATION__/, 'controller must publish a diagnostics/checklist API');
assert.match(controller, /__3D_MARKUP_VIEWPAD_INTEGRATION__ = api/, 'old diagnostic alias must point to the new ribbon integration');
assert.match(controller, /hasRibbonIcon/, 'checklist must report ribbon icon coverage');
assert.match(controller, /hasReviewMenuIcon/, 'checklist must report Review menu icon coverage');
assert.match(controller, /hasContextMenuIcon/, 'checklist must report canvas context-menu icon coverage');
assert.match(controller, /review-shortcut-hidden-hook/, 'old text shortcut viewpad buttons must be hidden implementation hooks only');
assert.doesNotMatch(controller, /viewpad-tool-short/, 'controller must not render MZ/AS/SR style shortcut labels');
assert.doesNotMatch(controller, /short:\s*'MZ'|short:\s*'AS'|short:\s*'SR'/, 'registry must not use text shortcut codes as the visible UI');

for (const key of expectedKeys) {
  assert.match(controller, new RegExp(`key: '${key}'`), `${key} must be present in the shared review tool registry`);
}

assert.match(pkg.scripts.test, /viewpad-icons-context-menu\.test\.mjs/, 'npm test must include review ribbon icon/context menu gate');

console.log('review-ribbon-icons-context gate passed');
