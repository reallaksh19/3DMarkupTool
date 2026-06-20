import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const area = readFileSync(new URL('../src/static-area-select-controller.js', import.meta.url), 'utf8');
const resolver = readFileSync(new URL('../src/static-selection-resolver.js', import.meta.url), 'utf8');
const viewpad = readFileSync(new URL('../src/static-viewpad-navigation-tools-controller.js', import.meta.url), 'utf8');
const review = readFileSync(new URL('../src/static-review-ribbon-tools-controller.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(area, /area-select-workflow-phase8-20260620/, 'Area Select must carry the Phase 8 workflow version.');
assert.match(area, /selectedRoots:\s*\(\) => selectedRoots\.slice\(\)/, 'Area Select API must expose selected roots for the shared resolver.');
assert.match(area, /getSelectedRoots:\s*\(\) => selectedRoots\.slice\(\)/, 'Area Select API must expose a getSelectedRoots alias.');
assert.match(area, /window\.__3D_MARKUP_AREA_SELECTED_ROOTS__ = selectedRoots\.slice\(\)/, 'Area Select must publish selected roots for fallback resolver access.');
assert.match(area, /clearSelection:\s*clearSelectionHighlights/, 'Area Select API must expose Clear Selection.');
assert.match(area, /exportSelectedPropertiesCsv/, 'Area Select API must expose selected-properties CSV export.');
assert.match(area, /selected_index['"],\s*['"]object_id['"],\s*['"]object_name['"],\s*['"]object_type['"],\s*['"]property_key['"],\s*['"]property_value/, 'CSV export must use the required property schema.');
assert.match(area, /action:\s*'exportCsv'/, 'Area Select export must dispatch an exportCsv diagnostic event.');
assert.match(area, /action:\s*'clear'/, 'Area Select clear must dispatch a clear diagnostic event.');
assert.doesNotMatch(area, /setInterval\s*\(/, 'Area Select workflow must not poll.');
assert.doesNotMatch(area, /MutationObserver/, 'Area Select workflow must not use MutationObserver.');

assert.match(resolver, /callMaybe\(areaApi\?\.selectedRoots, areaApi\)/, 'Shared resolver must read Area Select selected roots.');
assert.match(resolver, /callMaybe\(areaApi\?\.getSelectedRoots, areaApi\)/, 'Shared resolver must support getSelectedRoots alias.');

assert.match(viewpad, /getAreaSelectedRoots/, 'Hide/Isolate must consume area-selected roots from the shared resolver.');
assert.match(viewpad, /function resolveActionTargets/, 'Visibility tools must resolve a multi-target action set.');
assert.match(viewpad, /if \(areaRoots\.length\) return areaRoots/, 'Area-selected roots must take priority when present.');
assert.match(viewpad, /for \(const target of targets\) hideObject\(target\)/, 'Hide must operate on all area-selected targets.');
assert.match(viewpad, /for \(const target of targets\)[\s\S]*showAncestryAndChildren\(target, root\)/, 'Isolate must restore every area-selected target and its ancestry.');
assert.match(viewpad, /selectedIds:\s*targets\.map\(objectId\)\.filter\(Boolean\)/, 'Visibility diagnostics must include multi-target selected IDs.');
assert.doesNotMatch(viewpad, /setInterval\s*\(/, 'Visibility workflow must not poll.');
assert.doesNotMatch(viewpad, /MutationObserver/, 'Visibility workflow must not use MutationObserver.');

assert.match(review, /key:\s*'clearAreaSelection'/, 'Review ribbon/menu must expose Clear Selection.');
assert.match(review, /key:\s*'exportAreaSelectionCsv'/, 'Review ribbon/menu must expose Export Selected CSV.');
assert.match(review, /api:\s*\['__3D_MARKUP_AREA_SELECT__', 'clearSelection'\]/, 'Clear Selection must call Area Select clearSelection API.');
assert.match(review, /api:\s*\['__3D_MARKUP_AREA_SELECT__', 'exportSelectedPropertiesCsv'\]/, 'Export Selected CSV must call Area Select CSV API.');
assert.doesNotMatch(review, /setInterval\s*\(/, 'Review ribbon integration must not poll for Area Select workflow refresh.');

assert.match(pkg.scripts.test, /area-select-workflow-phase8\.test\.mjs/, 'npm test must include the Phase 8 Area Select workflow gate.');

console.log('area-select workflow phase8 gate passed');
