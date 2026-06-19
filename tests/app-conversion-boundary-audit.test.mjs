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

function usesAppConversionOrchestration(source) {
  const hasGlb = /convertInputXmlToGlb(?:WithShadowDiagnostics)?\b/.test(source);
  const hasRvm = /convertInputXmlToRvmAtt\b/.test(source);
  const hasPreview = /createRvmPreviewScene\b/.test(source);
  const hasRunController = /runAppConversionController\b/.test(source);
  const hasStateBridge = /runAppConversionIntoState\b/.test(source);
  return (hasGlb && hasRvm) || (hasPreview && (hasGlb || hasRvm)) || hasRunController || hasStateBridge;
}

function assertNoUnmanifestedAppConversionOrchestration() {
  const approved = approvedAppConversionPathSet();
  const offenders = [];
  for (const file of listJsFiles(srcRoot)) {
    const path = normalizePath(file);
    const source = readFileSync(file, 'utf8');
    if (usesAppConversionOrchestration(source) && !approved.has(path)) offenders.push(path);
  }
  assert.deepEqual(offenders, [], `Unmanifested app conversion orchestration found: ${offenders.join(', ')}`);
}

function assertTemporaryLegacyCallerIsExplicit() {
  const appEntry = APPROVED_APP_CONVERSION_ENTRYPOINTS.find((entry) => entry.path === 'src/app.js');
  assert.ok(appEntry, 'src/app.js temporary legacy caller must be explicit until final wiring lands');
  assert.equal(appEntry.role, 'TEMPORARY_LEGACY_UI_CALLER');
  assert.match(appEntry.reason, /Temporary UI caller/);
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
assertTemporaryLegacyCallerIsExplicit();
assertNoUnmanifestedAppConversionOrchestration();

console.log('app-conversion-boundary-audit: ok');
