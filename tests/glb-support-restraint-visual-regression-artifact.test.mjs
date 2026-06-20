import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = new URL('..', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const workflow = readFileSync(new URL('../.github/workflows/rvm-export-phase-gates.yml', import.meta.url), 'utf8');
const scriptSource = readFileSync(new URL('../scripts/generate-glb-support-restraint-visual-regression.mjs', import.meta.url), 'utf8');

assert.match(pkg.scripts['artifact:glb-support-restraint-visual-regression'], /generate-glb-support-restraint-visual-regression\.mjs/, 'package.json must expose the C20 GLB support/restraint visual-regression artifact script');
assert.match(pkg.scripts.test, /glb-support-restraint-visual-regression-artifact\.test\.mjs/, 'npm test must include the C20 GLB support/restraint visual-regression artifact gate');
assert.match(workflow, /Generate BM_CII GLB support\/restraint visual regression artifact/, 'CI must generate the C20 support/restraint visual-regression artifact');
assert.match(workflow, /Upload GLB support\/restraint visual regression artifact/, 'CI must upload the C20 support/restraint visual-regression artifact');
assert.match(scriptSource, /GlbSupportRestraintVisualRegressionArtifact\.v1/, 'support/restraint visual-regression generator must expose the C20 schema');
assert.match(scriptSource, /deterministic SVG/, 'C20 artifact must declare deterministic SVG output');
assert.match(scriptSource, /convertInputXmlToGlb\(\)/, 'C20 artifact must use the production GLB conversion boundary');
assert.doesNotMatch(scriptSource, /writeRvm|writeAtt|convertInputXmlToRvmAtt/, 'C20 visual-regression artifact must not route through RVM writer/export conversion');

const tempDir = mkdtempSync(join(tmpdir(), 'glb-support-restraint-visual-regression-'));
try {
  execFileSync('node', ['scripts/generate-glb-support-restraint-visual-regression.mjs', `--outdir=${tempDir}`], { cwd: repoRoot, stdio: 'pipe' });
  const base = 'BM_CII_glb_support_restraint_visual_regression';
  const auditPath = join(tempDir, `${base}.audit.json`);
  const summaryPath = join(tempDir, `${base}.summary.md`);
  const topPath = join(tempDir, `${base}.top.svg`);
  const sidePath = join(tempDir, `${base}.side.svg`);
  const isoPath = join(tempDir, `${base}.isometric.svg`);
  for (const path of [auditPath, summaryPath, topPath, sidePath, isoPath]) {
    assert.ok(existsSync(path), `${path} must be generated`);
    assert.ok(statSync(path).size > 1000, `${path} must be non-trivial for artifact review`);
  }
  const audit = JSON.parse(readFileSync(auditPath, 'utf8'));
  const summary = readFileSync(summaryPath, 'utf8');
  const topSvg = readFileSync(topPath, 'utf8');
  const sideSvg = readFileSync(sidePath, 'utf8');
  const isoSvg = readFileSync(isoPath, 'utf8');

  assert.equal(audit.schema, 'GlbSupportRestraintVisualRegressionArtifact.v1', 'C20 audit schema must remain stable');
  assert.equal(audit.sourceBoundary, 'convertInputXmlToGlb()', 'C20 must run through the production GLB conversion boundary');
  assert.equal(audit.supportCatalogueSceneParity, 'CATALOGUE_GEOMETRY_ADAPTER', 'C20 must inspect the C19 support geometry adapter scene path');
  assert.equal(audit.policies.screenshotStyleVisualArtifact, true, 'artifact must declare screenshot-style visual output');
  assert.equal(audit.policies.actualThreeSceneDerived, true, 'artifact must be derived from the actual Three.js scene path');
  assert.equal(audit.policies.deterministicSvgSnapshots, true, 'artifact must use deterministic SVG snapshots for CI');
  assert.equal(audit.policies.supportCatalogueGeometryAdapterRequired, true, 'support geometry adapter parts must be required');
  assert.equal(audit.policies.proportionalFallback, true, 'artifact must keep proportional fallback policy visible');
  assert.equal(audit.policies.vendorDimensionalDatabaseBacked, false, 'artifact must not claim vendor support dimensional DB backing');
  assert.equal(audit.policies.asmeDimensionalDatabaseBacked, false, 'artifact must not claim ASME dimensional DB backing');
  assert.equal(audit.policies.rvmWriterUnaffected, true, 'visual-regression artifact must not imply RVM writer changes');
  assert.equal(audit.policies.valveFlangeUnaffected, true, 'visual-regression artifact must not imply valve/flange changes');
  assert.ok(audit.summary.glbByteLength > 0, 'production GLB conversion boundary must generate a non-empty GLB buffer');
  assert.ok(audit.summary.supportSymbolCount >= 6, 'BM_CII artifact must expose multiple support/restraint symbols');
  assert.ok(audit.summary.supportPartCount > audit.summary.supportSymbolCount, 'artifact must render adapter primitive parts, not just support labels');
  assert.equal(audit.summary.allSymbolsFinite, true, 'all support visual cards require finite scene bounds');
  assert.equal(audit.summary.allSymbolsUseAdapterParts, true, 'all support visual cards must use adapter-generated parts');
  assert.equal(audit.summary.svgSnapshotCount, 3, 'C20 must generate three visual snapshot views');
  assert.equal(audit.summary.snapshotFiles.top, `${base}.top.svg`, 'top snapshot filename must remain stable');
  assert.equal(audit.summary.snapshotFiles.side, `${base}.side.svg`, 'side snapshot filename must remain stable');
  assert.equal(audit.summary.snapshotFiles.isometric, `${base}.isometric.svg`, 'isometric snapshot filename must remain stable');
  assert.equal(audit.summary.issueCount, 0, 'C20 support/restraint visual-regression artifact must be clean');
  assert.ok(audit.summary.primitiveKindCounts.cylinder > 0 || audit.summary.primitiveKindCounts.box > 0, 'visual-regression audit must include adapter primitive kind counts');
  assert.ok(Object.keys(audit.summary.roleCounts).length > 0, 'visual-regression audit must expose support part roles');

  const firstSymbol = audit.supportSymbols.find((entry) => entry.visualProfile?.partCount > 0);
  assert.ok(firstSymbol, 'visual-regression audit must include at least one support visual card');
  assert.equal(firstSymbol.issues.length, 0, 'support visual card must be clean');
  assert.ok(firstSymbol.visualProfile.roles.every((entry) => entry.finiteBounds), 'every rendered support part must have finite bounds');
  assert.ok(firstSymbol.visualProfile.roles.every((entry) => entry.schema === audit.supportCatalogueSchema), 'every rendered support part must carry the support catalogue schema');
  assert.ok(firstSymbol.visualProfile.roles.every((entry) => ['cylinder', 'box', 'pyramid', 'sphere'].includes(entry.primitiveKind)), 'support visual parts must remain writer-safe primitive kinds');

  for (const svg of [topSvg, sideSvg, isoSvg]) {
    assert.match(svg, /<svg[^>]+BM_CII GLB support restraint/i, 'SVG must keep a descriptive accessible label');
    assert.match(svg, /data-family="[^"]+"/, 'SVG must expose support family data for visual review');
    assert.match(svg, /data-primitive-kind="(?:cylinder|box|pyramid|sphere)"/, 'SVG must expose adapter primitive kind data for visual review');
    assert.match(svg, /data-role="[^"]+"/, 'SVG must expose support part role data for visual review');
    assert.match(svg, /proportional fallback/i, 'SVG must keep proportional fallback disclaimer visible');
  }
  assert.match(isoSvg, /Isometric-style support cards/, 'isometric SVG must be identifiable as the isometric-style view');
  assert.match(summary, /# BM_CII GLB Support \/ Restraint Visual Regression Artifact/, 'Markdown summary must keep the C20 title visible');
  assert.match(summary, /deterministic screenshot-style SVG snapshots/i, 'Markdown summary must state visual-regression snapshot purpose');
  assert.match(summary, /Visual-regression issues \| 0/, 'Markdown summary must expose clean visual-regression issue count');
  assert.match(summary, /not WebGL raster screenshots/i, 'Markdown summary must keep screenshot-style scope disclaimer visible');
  assert.match(summary, /not vendor\/ASME dimensional validation/i, 'Markdown summary must keep dimensional-scope disclaimer visible');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log('GLB support/restraint visual-regression artifact gate passed');
