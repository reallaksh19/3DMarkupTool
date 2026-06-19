import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('../src/static-viewpad-tool-icons-context-controller.js', import.meta.url), 'utf8');
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

assert.match(bootstrap, /static-viewpad-tool-icons-context-controller\.js\?v=\$\{SAFE_UI_VERSION\}/, 'bootstrap must load viewpad icon/context integration');
assert.match(bootstrap, /viewpad-icons-context-saved-state-20260619/, 'safe bootstrap cache key must bump for the integrated icon/context tool pack');
assert.match(controller, /VIEWPAD_TOOL_REGISTRY/, 'controller must define one registry for icon and context-menu coverage');
assert.match(controller, /contextmenu/, 'controller must install a canvas contextmenu handler');
assert.match(controller, /viewpad-tool-icon/, 'controller must inject compact tool icons into viewpad buttons');
assert.match(controller, /viewpad-context-menu/, 'controller must create a custom canvas context menu');
assert.match(controller, /__3D_MARKUP_VIEWPAD_INTEGRATION__/, 'controller must publish a diagnostics/checklist API');
assert.match(controller, /checklist:\s*\(\)\s*=>\s*buildChecklist\(\)/, 'diagnostic API must expose feature/icon/menu checklist');
assert.match(controller, /viewer:viewpad-context-menu/, 'controller must dispatch context-menu diagnostics');

for (const key of expectedKeys) {
  assert.match(controller, new RegExp(`key: '${key}'`), `${key} must be present in the shared viewpad registry`);
  assert.match(controller, new RegExp(`data-view=\\"\\$\\{cssEscape\\(key\\)\\}\\"`), 'button lookup must use stable data-view markers');
}

assert.match(pkg.scripts.test, /viewpad-icons-context-menu\.test\.mjs/, 'npm test must include viewpad icon/context menu gate');

console.log('viewpad-icons-context-menu gate passed');
