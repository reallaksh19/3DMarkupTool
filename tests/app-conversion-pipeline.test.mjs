import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(repoRoot, 'src', 'app-conversion-pipeline.js');
const source = await readFile(sourcePath, 'utf8');

assert.match(source, /APP_CONVERSION_PIPELINE_SCHEMA\s*=\s*'AppConversionPipeline\.v1'/);
assert.match(source, /runAppConversionPipeline/);
assert.match(source, /resolveAppConversionDeps/);
assert.match(source, /convertInputXmlToGlbWithPipingShadow/);
assert.match(source, /convertInputXmlToRvmAtt/);
assert.match(source, /createRvmPreviewScene/);
assert.match(source, /await\s+resolveAppConversionDeps\(deps\)/);
assert.match(source, /import\('\.\/converter\.js\?v=professional-viewer-3'\)/);
assert.match(source, /import\('\.\/rvm-converter\.js\?v=professional-viewer-3'\)/);
assert.match(source, /import\('\.\/rvm-preview\.js\?v=professional-viewer-3'\)/);
assert.match(source, /appConversionPipeline/);
assert.match(source, /LEGACY_FALLBACK_ONLY/);
assert.doesNotMatch(source, /activeRenderer:\s*'CONTRACT_RENDERER'/);

const packageJson = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
assert.match(packageJson.scripts.test, /app-conversion-pipeline\.test\.mjs/);

console.log('app-conversion-pipeline static gate passed');
