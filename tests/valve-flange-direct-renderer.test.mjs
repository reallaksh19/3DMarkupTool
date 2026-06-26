import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const converterSource = await readFile(path.join(repoRoot, 'src', 'converter.js'), 'utf8');
const catalogSource = await readFile(path.join(repoRoot, 'src', 'valve-flange-visual-catalog.js'), 'utf8');

const visualBranchIndex = converterSource.indexOf('const catalogVisual = createCatalogLinearComponentVisual(element, visualSpec, a, b, radius, baseUserData, options);');
const legacyCylinderIndex = converterSource.indexOf('const cyl = cylinderBetween(a, b, radius, material');
assert.notEqual(visualBranchIndex, -1, 'direct catalogue branch must exist');
assert.notEqual(legacyCylinderIndex, -1, 'legacy fallback cylinder must still exist');
assert.ok(visualBranchIndex < legacyCylinderIndex, 'catalogue branch must run before legacy fallback cylinder');
assert.match(converterSource.slice(visualBranchIndex, legacyCylinderIndex), /return;/, 'catalogue branch must return before fallback');
assert.doesNotMatch(converterSource.slice(visualBranchIndex, legacyCylinderIndex), /group\.add\(cyl\)/, 'catalogue branch must not add a legacy centerline cylinder');
assert.match(converterSource, /function frustumAlongAxis\(/, 'renderer must define frustum helper');
assert.match(converterSource, /geometryKind:\s*'FRUSTUM'/, 'tapered neck primitives must be tagged as frustums');
assert.match(converterSource, /WELD_NECK_A[\s\S]*WELD_NECK_B[\s\S]*frustumAlongAxis/, 'weld-neck primitives must render as frustums');
assert.match(catalogSource, /'VALVE_NECK_A'/, 'VALVE_NECK_A catalogue primitive must exist');
assert.match(catalogSource, /'VALVE_NECK_B'/, 'VALVE_NECK_B catalogue primitive must exist');
assert.match(catalogSource, /function addValveShoulderPrimitive[\s\S]*innerRadius[\s\S]*outerRadius/, 'valve shoulder primitive helper must carry taper radii');
const packageJson = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
assert.match(packageJson.scripts.test, /valve-flange-direct-renderer\.test\.mjs/, 'npm test must include renderer gate');
console.log('Valve/flange direct renderer gate passed');
