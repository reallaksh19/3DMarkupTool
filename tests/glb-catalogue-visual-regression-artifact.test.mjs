import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = new URL('..', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const workflow = readFileSync(new URL('../.github/workflows/rvm-export-phase-gates.yml', import.meta.url), 'utf8');
const scriptSource = readFileSync(new URL('../scripts/generate-glb-catalogue-visual-regression.mjs', import.meta.url), 'utf8');

assert.match(pkg.scripts['artifact:glb-catalogue-visual-regression'], /generate-glb-catalogue-visual-regression\.mjs/, 'package.json must expose the C11 GLB visual-regression artifact script');
assert.match(pkg.scripts.test, /glb-catalogue-visual-regression-artifact\.test\.mjs/, 'npm test must include the C11 GLB visual-regression artifact gate');
assert.match(workflow, /Generate BM_CII GLB catalogue visual regression artifact/, 'CI must generate the C11 GLB visual-regression artifact');
assert.match(workflow, /Upload GLB catalogue visual regression artifact/, 'CI must upload the C11 GLB visual-regression artifact');
assert.match(scriptSource, /GlbCatalogueVisualRegressionArtifact\.v1/, 'visual-regression generator must expose the C11 schema');
assert.match(scriptSource, /deterministic SVG/, 'C11 artifact must declare deterministic SVG output');
assert.match(scriptSource, /convertInputXmlToGlb\(\)/, 'C11 artifact must use the production GLB conversion boundary');
assert.doesNotMatch(scriptSource, /writeRvm|writeAtt|convertInputXmlToRvmAtt/, 'C11 visual-regression artifact must not route through RVM writer/export conversion');

const tempDir = mkdtempSync(join(tmpdir(), 'glb-catalogue-visual-regression-'));
try {
  execFileSync('node', ['scripts/generate-glb-catalogue-visual-regression.mjs', `--outdir=${tempDir}`], { cwd: repoRoot, stdio: 'pipe' });
  const base = 'BM_CII_glb_catalogue_visual_regression';
  const auditPath = join(tempDir, `${base}.audit.json`);
  const summaryPath = join(tempDir, `${base}.summary.md`);
  const topPath = join(tempDir, `${base}.top.svg`);
  const sidePath = join(tempDir, `${base}.side.svg`);
  const isoPath = join(tempDir, `${base}.isometric.svg`);
  for (const path of [auditPath, summaryPath, topPath, sidePath, isoPath]) { assert.ok(existsSync(path), `${path} must be generated`); assert.ok(statSync(path).size > 1000, `${path} must be non-trivial for artifact review`); }
  const audit = JSON.parse(readFileSync(auditPath, 'utf8'));
  const summary = readFileSync(summaryPath, 'utf8');
  const topSvg = readFileSync(topPath, 'utf8');
  const sideSvg = readFileSync(sidePath, 'utf8');
  const isoSvg = readFileSync(isoPath, 'utf8');
  assert.equal(audit.schema, 'GlbCatalogueVisualRegressionArtifact.v1', 'C11 audit schema must remain stable');
  assert.equal(audit.sourceBoundary, 'convertInputXmlToGlb()', 'C11 must run through the production GLB conversion boundary');
  assert.equal(audit.policies.screenshotStyleVisualArtifact, true, 'artifact must declare screenshot-style visual output');
  assert.equal(audit.policies.actualThreeSceneDerived, true, 'artifact must be derived from the actual Three.js scene path');
  assert.equal(audit.policies.deterministicSvgSnapshots, true, 'artifact must use deterministic SVG snapshots for CI');
  assert.equal(audit.policies.proportionalFallback, true, 'artifact must keep proportional fallback policy visible');
  assert.equal(audit.policies.rvmWriterUnaffected, true, 'visual-regression artifact must not imply RVM writer changes');
  assert.equal(audit.policies.asmeDimensionalDatabaseBacked, false, 'artifact must not claim ASME dimensional DB backing');
  assert.ok(audit.summary.glbByteLength > 0, 'production GLB conversion boundary must generate a non-empty GLB buffer');
  assert.ok(audit.summary.catalogueGroupCount >= 10, 'BM_CII artifact must expose multiple catalogue visual groups');
  assert.ok(audit.summary.valveGroupCount >= 2, 'BM_CII artifact must expose valve visual groups');
  assert.ok(audit.summary.flangeGroupCount >= 4, 'BM_CII artifact must expose flange visual groups');
  assert.ok(audit.summary.renderedSpanRoleCount > audit.summary.catalogueGroupCount, 'artifact must render role spans, not just group labels');
  assert.equal(audit.summary.svgSnapshotCount, 3, 'C11 must generate three visual snapshot views');
  assert.equal(audit.summary.snapshotFiles.top, `${base}.top.svg`, 'top snapshot filename must remain stable');
  assert.equal(audit.summary.snapshotFiles.side, `${base}.side.svg`, 'side snapshot filename must remain stable');
  assert.equal(audit.summary.snapshotFiles.isometric, `${base}.isometric.svg`, 'isometric snapshot filename must remain stable');
  assert.equal(audit.summary.allGroupsContinuous, true, 'visual snapshots require continuous rendered centreline spans');
  assert.equal(audit.summary.issueCount, 0, 'C11 visual-regression artifact must be clean');
  assert.ok(audit.summary.geometryKindCounts.CYLINDER > 0, 'visual-regression audit must include cylinder roles');
  assert.ok(audit.summary.geometryKindCounts.FRUSTUM > 0, 'visual-regression audit must include tapered frustum roles');
  assert.ok(audit.summary.geometryKindCounts.SPAN_FILLED_VALVE_BODY > 0, 'visual-regression audit must include compact valve body roles');
  const flangedValve = audit.catalogueGroups.find((entry) => entry.componentType === 'VALVE_FLANGED');
  assert.ok(flangedValve, 'visual-regression audit must include a flanged valve card');
  assert.equal(flangedValve.issues.length, 0, 'flanged valve visual card must be clean');
  assert.ok(flangedValve.visualProfile.roles.some((entry) => entry.role === 'VALVE_BODY'), 'flanged valve card must include VALVE_BODY');
  assert.ok(flangedValve.visualProfile.roles.some((entry) => /^VALVE_NECK_/.test(entry.role)), 'flanged valve card must include tapered neck/shoulder roles');
  assert.ok(flangedValve.visualProfile.roles.some((entry) => /^END_COLLAR_/.test(entry.role)), 'flanged valve card must include end collar roles');
  const flange = audit.catalogueGroups.find((entry) => entry.componentClass === 'FLANGE');
  assert.ok(flange, 'visual-regression audit must include flange cards');
  assert.equal(flange.issues.length, 0, 'flange visual card must be clean');
  assert.ok(flange.visualProfile.roles.some((entry) => /FLANGE_(?:DISC|PLATE)/.test(entry.role)), 'flange card must include flange disc/plate roles');
  assert.ok(flange.visualProfile.roles.some((entry) => /RAISED_FACE|GASKET/.test(entry.role)), 'flange card must include raised-face/gasket roles');
  assert.ok(flange.visualProfile.roles.some((entry) => /WELD_NECK/.test(entry.role)), 'flange card must include weld-neck role');
  for (const svg of [topSvg, sideSvg, isoSvg]) { assert.match(svg, /<svg[^>]+BM_CII GLB catalogue/i, 'SVG must keep a descriptive accessible label'); assert.match(svg, /data-component-class="VALVE"/, 'SVG must include valve component cards'); assert.match(svg, /data-component-class="FLANGE"/, 'SVG must include flange component cards'); assert.match(svg, /data-role="VALVE_BODY"/, 'SVG must expose valve body role data for visual review'); assert.match(svg, /data-role="FLANGE_DISC|data-role="FLANGE_PLATE/, 'SVG must expose flange plate/disc role data for visual review'); assert.match(svg, /proportional fallback/i, 'SVG must keep proportional fallback disclaimer visible'); }
  assert.match(isoSvg, /Isometric-style component cards/, 'isometric SVG must be identifiable as the isometric-style view');
  assert.match(summary, /# BM_CII GLB Catalogue Visual Regression Artifact/, 'Markdown summary must keep the C11 title visible');
  assert.match(summary, /deterministic screenshot-style SVG snapshots/i, 'Markdown summary must state visual-regression snapshot purpose');
  assert.match(summary, /Visual-regression issues \| 0/, 'Markdown summary must expose clean visual-regression issue count');
  assert.match(summary, /not WebGL raster screenshots/i, 'Markdown summary must keep screenshot-style scope disclaimer visible');
  assert.match(summary, /not ASME dimensional validation/i, 'Markdown summary must keep ASME scope disclaimer visible');
} finally { rmSync(tempDir, { recursive: true, force: true }); }
console.log('GLB catalogue visual-regression artifact gate passed');
