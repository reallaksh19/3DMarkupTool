import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import {
  CONTRACT_RENDER_BOUNDARY,
  assertRenderBoundaryManifest,
  legacyFallbackRendererPaths
} from '../src/render-boundary-manifest.js';

const startedAt = performance.now();
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(repoRoot, 'src');

const SOURCE_CLASSIFIER_PATTERNS = Object.freeze([
  /parseMarkupSource\s*\(/,
  /normalizeInputXmlRestraints\s*\(/,
  /classifyByTypeCode\s*\(/,
  /sourceKind\s*=\s*model\.sourceKind/,
  /ACTUAL_INPUTXML/
]);

const DIRECT_RENDER_PATTERNS = Object.freeze([
  /new\s+THREE\.Mesh\s*\(/,
  /new\s+THREE\.(TubeGeometry|CylinderGeometry|SphereGeometry|BoxGeometry|ConeGeometry)\s*\(/,
  /\bcylinderBetween\s*\(/,
  /\bconeArrow\s*\(/,
  /\barrowToward\s*\(/,
  /\bcreateTextPlane\s*\(/,
  /\bcreateNodeLabel\s*\(/,
  /\bcreateWarningTriangle\s*\(/,
  /\bcreateSpringCoil\s*\(/
]);

const files = await listJavaScriptFiles(srcRoot);

await phase('01 render boundary manifest is explicit and contract-directed', () => {
  assert.equal(assertRenderBoundaryManifest(CONTRACT_RENDER_BOUNDARY), true);
  assert.ok(CONTRACT_RENDER_BOUNDARY.legacyFallbackRenderers.length >= 1);
  assert.ok(CONTRACT_RENDER_BOUNDARY.contractEntryPoints.includes('src/piping-component-contract.js'));
});

await phase('02 every manifest fallback path exists and is fallback-only', async () => {
  for (const entry of CONTRACT_RENDER_BOUNDARY.legacyFallbackRenderers) {
    const absolutePath = path.join(repoRoot, entry.path);
    const text = await readFile(absolutePath, 'utf8');
    assert.match(entry.reason, /fallback/i);
    assert.match(entry.replacement, /GeometryContract|PipingComponent|RenderInstruction/);
    assert.ok(text.length > 0, `${entry.path} should exist`);
  }
});

await phase('03 no new source-classifier direct renderer exists outside fallback manifest', async () => {
  const allowed = legacyFallbackRendererPaths(CONTRACT_RENDER_BOUNDARY);
  const findings = [];

  for (const file of files) {
    const repoPath = toRepoPath(file);
    const text = await readFile(file, 'utf8');
    if (!hasSourceClassifierDecision(text) || !hasDirectRenderEmission(text)) continue;
    findings.push(repoPath);
  }

  const unauthorized = findings.filter((repoPath) => !allowed.has(repoPath));
  assert.deepEqual(
    unauthorized,
    [],
    `source-classifier direct renderers must be contract adapters or explicitly listed fallback renderers: ${unauthorized.join(', ')}`
  );
  assert.ok(findings.includes('src/converter.js'), 'existing direct InputXML GLB renderer should be recognized as legacy fallback');
});

await phase('04 export-model preview renderer is not mistaken for raw-source renderer', async () => {
  const text = await readFile(path.join(repoRoot, 'src/rvm-preview.js'), 'utf8');
  assert.equal(hasSourceClassifierDecision(text), false, 'RVM preview consumes generated export-model primitives, not raw InputXML classifiers');
  assert.equal(hasDirectRenderEmission(text), true, 'RVM preview is still a renderer and should remain visible to this audit');
});

await phase('05 contract modules stay mesh-free', async () => {
  for (const repoPath of CONTRACT_RENDER_BOUNDARY.contractEntryPoints) {
    const text = await readFile(path.join(repoRoot, repoPath), 'utf8');
    assert.equal(hasDirectRenderEmission(text), false, `${repoPath} must remain a contract/validator module, not a mesh renderer`);
  }
});

console.log(`[render-boundary] completed in ${((performance.now() - startedAt) / 1000).toFixed(2)} s`);

async function phase(name, fn) {
  const phaseStart = performance.now();
  try {
    await fn();
    console.log(`[render-boundary] PASS ${name} (${(performance.now() - phaseStart).toFixed(1)} ms)`);
  } catch (error) {
    console.error(`[render-boundary] FAIL ${name} (${(performance.now() - phaseStart).toFixed(1)} ms)`);
    throw error;
  }
}

async function listJavaScriptFiles(root) {
  const out = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...await listJavaScriptFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(fullPath);
    }
  }
  return out.sort();
}

function hasSourceClassifierDecision(text) {
  return SOURCE_CLASSIFIER_PATTERNS.some((pattern) => pattern.test(text));
}

function hasDirectRenderEmission(text) {
  return DIRECT_RENDER_PATTERNS.some((pattern) => pattern.test(text));
}

function toRepoPath(file) {
  return path.relative(repoRoot, file).split(path.sep).join('/');
}
