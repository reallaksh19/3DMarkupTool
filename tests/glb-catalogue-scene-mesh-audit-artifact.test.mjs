import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = new URL('..', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const workflow = readFileSync(new URL('../.github/workflows/rvm-export-phase-gates.yml', import.meta.url), 'utf8');
const scriptSource = readFileSync(new URL('../scripts/generate-glb-catalogue-scene-mesh-audit.mjs', import.meta.url), 'utf8');

assert.match(pkg.scripts['artifact:glb-catalogue-scene-mesh-audit'], /generate-glb-catalogue-scene-mesh-audit\.mjs/, 'package.json must expose the C10 GLB scene-mesh audit script');
assert.match(pkg.scripts.test, /glb-catalogue-scene-mesh-audit-artifact\.test\.mjs/, 'npm test must include the C10 GLB scene-mesh gate');
assert.match(workflow, /Generate BM_CII GLB catalogue scene mesh audit/, 'CI must generate the C10 GLB scene-mesh audit artifact');
assert.match(workflow, /Upload GLB catalogue scene mesh audit artifact/, 'CI must upload the C10 GLB scene-mesh audit artifact');
assert.match(scriptSource, /GlbCatalogueSceneMeshAudit\.v1/, 'audit generator must expose the C10 schema');
assert.match(scriptSource, /convertInputXmlToGlb\(\)/, 'C10 must identify the production GLB conversion boundary');
assert.match(scriptSource, /Three\.js Scene returned by src\/converter\.js/, 'C10 must identify actual Three.js scene inspection');
assert.doesNotMatch(scriptSource, /writeRvm|writeAtt|convertInputXmlToRvmAtt/, 'GLB scene-mesh audit must not route through RVM writer/export conversion');

const tempDir = mkdtempSync(join(tmpdir(), 'glb-catalogue-scene-mesh-audit-'));
try {
  execFileSync('node', ['scripts/generate-glb-catalogue-scene-mesh-audit.mjs', `--outdir=${tempDir}`], { cwd: repoRoot, stdio: 'pipe' });

  const auditPath = join(tempDir, 'BM_CII_glb_catalogue_scene_mesh.audit.json');
  const summaryPath = join(tempDir, 'BM_CII_glb_catalogue_scene_mesh.summary.md');
  assert.ok(existsSync(auditPath), 'GLB scene-mesh audit JSON must be generated');
  assert.ok(existsSync(summaryPath), 'GLB scene-mesh audit Markdown summary must be generated');

  const audit = JSON.parse(readFileSync(auditPath, 'utf8'));
  const summary = readFileSync(summaryPath, 'utf8');

  assert.equal(audit.schema, 'GlbCatalogueSceneMeshAudit.v1', 'C10 audit schema must remain stable');
  assert.equal(audit.policies.actualThreeSceneMeshAudit, true, 'audit must declare actual Three.js scene inspection');
  assert.equal(audit.policies.proportionalFallback, true, 'audit must keep proportional fallback policy visible');
  assert.equal(audit.policies.rvmWriterUnaffected, true, 'GLB scene-mesh audit must not imply RVM writer changes');
  assert.equal(audit.policies.asmeDimensionalDatabaseBacked, false, 'audit must not claim ASME dimensional DB backing');
  assert.ok(audit.summary.glbByteLength > 0, 'production GLB conversion boundary must generate a non-empty GLB buffer');
  assert.ok(audit.summary.catalogueGroupCount >= 10, 'BM_CII scene must expose multiple catalogue visual groups');
  assert.ok(audit.summary.valveGroupCount >= 2, 'BM_CII scene must expose valve catalogue visual groups');
  assert.ok(audit.summary.flangeGroupCount >= 4, 'BM_CII scene must expose flange catalogue visual groups');
  assert.ok(audit.summary.catalogueRoleObjectCount > audit.summary.catalogueGroupCount, 'scene audit must inspect child role objects, not only groups');
  assert.ok(audit.summary.catalogueMeshCount >= audit.summary.catalogueRoleObjectCount, 'scene audit must inspect emitted meshes under catalogue groups');
  assert.equal(audit.summary.allGroupsContinuous, true, 'actual rendered catalogue centerline spans must remain continuous');
  assert.equal(audit.summary.issueCount, 0, 'C10 scene-mesh audit must be clean');
  assert.ok(audit.summary.geometryKindCounts.CYLINDER > 0, 'scene audit must see CYLINDER geometryKind stamps');
  assert.ok(audit.summary.geometryKindCounts.FRUSTUM > 0, 'scene audit must see FRUSTUM geometryKind stamps');
  assert.ok(audit.summary.geometryKindCounts.SPAN_FILLED_VALVE_BODY > 0, 'scene audit must see valve body geometryKind stamps');

  const flangedValve = audit.catalogueGroups.find((entry) => entry.componentType === 'VALVE_FLANGED');
  assert.ok(flangedValve, 'scene audit must contain a VALVE_FLANGED group');
  assert.equal(flangedValve.issues.length, 0, 'flanged valve scene group must be clean');
  assert.ok(flangedValve.meshCount >= 5, 'flanged valve must emit multiple actual mesh objects');
  const valveBody = flangedValve.roleMetrics.find((entry) => entry.role === 'VALVE_BODY');
  const valveCollars = flangedValve.roleMetrics.filter((entry) => /^END_COLLAR_/.test(entry.role));
  const valveShoulders = flangedValve.roleMetrics.filter((entry) => /^VALVE_NECK_/.test(entry.role));
  assert.ok(valveBody, 'flanged valve scene audit must include VALVE_BODY role');
  assert.equal(valveBody.geometryKind, 'SPAN_FILLED_VALVE_BODY', 'VALVE_BODY must be stamped as span-filled valve body');
  assert.equal(valveCollars.length, 2, 'flanged valve scene audit must include two end collars');
  assert.equal(valveShoulders.length, 2, 'flanged valve scene audit must include two tapered shoulders');
  assert.ok(valveCollars.every((entry) => entry.geometryKind === 'CYLINDER'), 'end collars must be emitted as cylinders');
  assert.ok(valveCollars.every((entry) => entry.radius < valveBody.radius), 'end collars must be smaller than valve body in actual scene userData');
  assert.ok(valveShoulders.every((entry) => entry.geometryKind === 'FRUSTUM'), 'valve shoulders must be emitted as frustums');
  assert.ok(valveShoulders.every((entry) => entry.radiusStart !== entry.radiusEnd), 'valve shoulders must retain taper metadata');

  const flange = audit.catalogueGroups.find((entry) => entry.componentClass === 'FLANGE');
  assert.ok(flange, 'scene audit must contain a flange group');
  assert.equal(flange.issues.length, 0, 'flange scene group must be clean');
  const plates = flange.roleMetrics.filter((entry) => /FLANGE_(?:DISC|PLATE)/.test(entry.role));
  const raisedFace = flange.roleMetrics.find((entry) => /RAISED_FACE/.test(entry.role));
  const weldNeck = flange.roleMetrics.find((entry) => /WELD_NECK/.test(entry.role));
  assert.ok(plates.length >= 1, 'flange scene audit must include flange plate/disc mesh role');
  assert.ok(raisedFace, 'flange scene audit must include raised-face mesh role');
  assert.ok(weldNeck, 'flange scene audit must include weld-neck mesh role');
  assert.ok(plates.every((entry) => entry.geometryKind === 'CYLINDER'), 'flange plates/discs must be emitted as cylinders');
  assert.equal(weldNeck.geometryKind, 'FRUSTUM', 'weld neck must be emitted as frustum');

  assert.match(summary, /# BM_CII GLB Catalogue Scene Mesh Audit/, 'Markdown summary must keep the C10 title visible');
  assert.match(summary, /actual Three\.js scene objects/i, 'Markdown summary must state actual scene inspection scope');
  assert.match(summary, /Scene-mesh issues \| 0/, 'Markdown summary must expose clean scene-mesh issue count');
  assert.match(summary, /not an ASME dimensional database validation/i, 'Markdown summary must keep the scope disclaimer visible');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log('GLB catalogue scene-mesh audit artifact gate passed');
