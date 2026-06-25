import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const converterSource = await readFile(path.join(repoRoot, 'src', 'converter.js'), 'utf8');
const catalogSource = await readFile(path.join(repoRoot, 'src', 'valve-flange-visual-catalog.js'), 'utf8');
const packageJson = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));

const visualBranchNeedle = 'const catalogVisual = createCatalogLinearComponentVisual(element, visualSpec, a, b, radius, baseUserData, options);';
const fallbackCylinderNeedle = 'const cyl = cylinderBetween(a, b, radius, material';
const visualBranchIndex = converterSource.indexOf(visualBranchNeedle);
const fallbackCylinderIndex = converterSource.indexOf(fallbackCylinderNeedle);

assert.notEqual(visualBranchIndex, -1, 'direct catalogue branch must exist');
assert.notEqual(fallbackCylinderIndex, -1, 'legacy fallback cylinder must still exist for non-catalogue components');
assert.ok(visualBranchIndex < fallbackCylinderIndex, 'catalogue valve/flange branch must run before legacy fallback cylinder');
assert.match(converterSource.slice(visualBranchIndex, fallbackCylinderIndex), /if \(catalogVisual\) \{[\s\S]*group\.add\(catalogVisual\);[\s\S]*return;/, 'catalogue branch must add catalogue visual and return before fallback');
assert.doesNotMatch(converterSource.slice(visualBranchIndex, fallbackCylinderIndex), /group\.add\(cyl\)/, 'catalogue branch must not add a duplicate centerline fallback cylinder');

assert.match(converterSource, /function createCatalogLinearComponentVisual\(/, 'renderer must retain catalogue visual entry point');
assert.match(converterSource, /function frustumAlongAxis\(/, 'renderer must define a frustum helper for tapered primitives');
assert.match(converterSource, /function isTaperedLinearPrimitive\(/, 'renderer must classify tapered valve/flange primitives');
assert.match(converterSource, /geometryKind:\s*'FRUSTUM'/, 'tapered neck primitives must be tagged as frustums in userData');
assert.match(converterSource, /WELD_NECK_A[\s\S]*WELD_NECK_B[\s\S]*frustumAlongAxis/, 'weld-neck flange primitives must render as frustums, not straight cylinders');
assert.match(converterSource, /SPAN_FILLED_VALVE_BODY/, 'valve body rendering must preserve span-filled visual userData for auditability');

assert.match(catalogSource, /VALVE_FLANGED/, 'flanged valve catalogue entry must exist');
assert.match(catalogSource, /taperedShoulders:\s*true/, 'valve catalogue must expose tapered shoulder intent');
assert.match(catalogSource, /FLANGE_WELD_NECK/, 'weld-neck flange catalogue entry must exist');
assert.match(catalogSource, /neckDiameterFactor/, 'flange catalogue must retain neck sizing data for frustum rendering');

assert.match(packageJson.scripts.test, /valve-flange-direct-renderer\.test\.mjs/, 'npm test must include this direct renderer regression gate');

console.log('valve/flange direct renderer regression gate passed');
