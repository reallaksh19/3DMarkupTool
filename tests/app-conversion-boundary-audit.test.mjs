import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  APPROVED_APP_CONVERSION_ENTRYPOINTS,
  approvedAppConversionPathSet,
  assertAppConversionBoundaryManifest
} from '../src/app-conversion-boundary-manifest.js';

const repoRoot = new URL('..', import.meta.url).pathname;
const srcRoot = join(repoRoot, 'src');

function listJsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...listJsFiles(full));
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

function normalizePath(file) {
  return relative(repoRoot, file).replaceAll('\\\\', '/').replaceAll('\\', '/');
}

function usesDirectConverterOrchestration(source) {
  const importsGlbConverter = /import\s*\{[^}]*convertInputXmlToGlb(?:WithShadowDiagnostics)?[^}]*\}\s*from\s*['"][^'"]*(?:converter|converter-shadow-diagnostics)\.js/.test(source);
  const importsRvmConverter = /import\s*\{[^}]*convertInputXmlToRvmAtt[^}]*\}\s*from\s*['"][^'"]*rvm-converter\.js/.test(source);
  const importsRvmPreview = /import\s*\{[^}]*createRvmPreviewScene[^}]*\}\s*from\s*['"][^'"]*rvm-preview\.js/.test(source);
  return (importsGlbConverter && importsRvmConverter) || (importsRvmPreview && (importsGlbConverter || importsRvmConverter));
}

function assertNoUnmanifestedAppConversionOrchestration() {
  const approved = approvedAppConversionPathSet();
  const offenders = [];
  for (const file of listJsFiles(srcRoot)) {
    const path = normalizePath(file);
    const source = readFileSync(file, 'utf8');
    if (usesDirectConverterOrchestration(source) && !approved.has(path)) offenders.push(path);
  }
  assert.deepEqual(offenders, [], `Unmanifested app conversion orchestration found: ${offenders.join(', ')}`);
}

function assertNoTemporaryLegacyCallerException() {
  const appEntry = APPROVED_APP_CONVERSION_ENTRYPOINTS.find((entry) => entry.path === 'src/app.js');
  assert.equal(appEntry, undefined, 'src/app.js must not remain an approved direct converter caller after delegate wiring');
}

function assertAppJsDelegatesConversion() {
  const source = readFileSync(join(srcRoot, 'app.js'), 'utf8');
  assert.match(source, /import\s*\{\s*runAppConversionController\s*\}\s*from\s*['"]\.\/app-run-conversion-controller\.js\?v=professional-viewer-3['"];/);
  assert.match(source, /async\s+function\s+runConversion\s*\(\)\s*\{\s*await\s+runAppConversionController\s*\(/s);
  assert.doesNotMatch(source, /import\s*\{[^}]*convertInputXmlToGlb[^}]*\}\s*from\s*['"]\.\/converter\.js/);
  assert.doesNotMatch(source, /import\s*\{[^}]*convertInputXmlToRvmAtt[^}]*\}\s*from\s*['"]\.\/rvm-converter\.js/);
  assert.doesNotMatch(source, /import\s*\{[^}]*createRvmPreviewScene[^}]*\}\s*from\s*['"]\.\/rvm-preview\.js/);
}

function assertPipelineSeamIsExplicit() {
  const seam = APPROVED_APP_CONVERSION_ENTRYPOINTS.find((entry) => entry.path === 'src/app-conversion-pipeline.js');
  assert.ok(seam, 'app conversion pipeline seam must be approved');
  assert.equal(seam.role, 'APP_CONVERSION_PIPELINE_SEAM');
  assert.ok(seam.allowedDirectConverters.includes('convertInputXmlToGlbWithShadowDiagnostics'));
  assert.ok(seam.allowedDirectConverters.includes('convertInputXmlToRvmAtt'));
}

assertAppConversionBoundaryManifest();
assertPipelineSeamIsExplicit();
assertNoTemporaryLegacyCallerException();
assertAppJsDelegatesConversion();
assertNoUnmanifestedAppConversionOrchestration();

console.log('app-conversion-boundary-audit: ok');
