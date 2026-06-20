import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = new URL('..', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const workflow = readFileSync(new URL('../.github/workflows/rvm-export-phase-gates.yml', import.meta.url), 'utf8');
const scriptSource = readFileSync(new URL('../scripts/generate-glb-catalogue-visual-audit.mjs', import.meta.url), 'utf8');

assert.match(pkg.scripts['artifact:glb-catalogue-visual-audit'], /generate-glb-catalogue-visual-audit\.mjs/, 'package.json must expose the GLB visual audit artifact script');
assert.match(pkg.scripts.test, /glb-catalogue-visual-audit-artifact\.test\.mjs/, 'npm test must include the C9 GLB visual audit gate');
assert.match(workflow, /Generate BM_CII GLB catalogue visual audit/, 'CI must generate the GLB catalogue visual audit artifact');
assert.match(workflow, /Upload GLB catalogue visual audit artifact/, 'CI must upload the GLB catalogue visual audit artifact');
assert.match(scriptSource, /GlbCatalogueVisualAudit\.v1/, 'audit generator must expose the C9 schema');
assert.match(scriptSource, /buildValveFlangePrimitiveAdapterPlan/, 'audit generator must use the shared primitive adapter seam');
assert.match(scriptSource, /getValveFlangeVisualSpec\(\)/, 'audit output must identify the GLB catalogue resolver');
assert.doesNotMatch(scriptSource, /writeRvm|writeAtt|convertInputXmlToRvmAtt/, 'GLB visual audit must not route through RVM writer/export conversion');

const tempDir = mkdtempSync(join(tmpdir(), 'glb-catalogue-visual-audit-'));
try {
  execFileSync('node', ['scripts/generate-glb-catalogue-visual-audit.mjs', `--outdir=${tempDir}`], { cwd: repoRoot, stdio: 'pipe' });

  const auditPath = join(tempDir, 'BM_CII_glb_catalogue_visual.audit.json');
  const summaryPath = join(tempDir, 'BM_CII_glb_catalogue_visual.summary.md');
  assert.ok(existsSync(auditPath), 'GLB visual audit JSON must be generated');
  assert.ok(existsSync(summaryPath), 'GLB visual audit Markdown summary must be generated');

  const audit = JSON.parse(readFileSync(auditPath, 'utf8'));
  const summary = readFileSync(summaryPath, 'utf8');

  assert.equal(audit.schema, 'GlbCatalogueVisualAudit.v1', 'audit schema must remain stable');
  assert.equal(audit.policies.proportionalFallback, true, 'audit must declare proportional fallback');
  assert.equal(audit.policies.asmeDimensionalDatabaseBacked, false, 'audit must not claim ASME dimensional DB backing');
  assert.equal(audit.policies.rvmWriterUnaffected, true, 'GLB visual audit must not imply RVM writer changes');
  assert.equal(audit.summary.allContinuityOk, true, 'all sample valve/flange catalogue plans must remain continuous');
  assert.equal(audit.summary.issueCount, 0, 'sample GLB catalogue visual-quality audit must be clean');
  assert.ok(audit.summary.catalogueCandidateCount >= 10, 'BM_CII must expose multiple GLB catalogue visual candidates');
  assert.ok(audit.summary.valveCandidateCount >= 2, 'BM_CII must expose valve visual candidates');
  assert.ok(audit.summary.flangeCandidateCount >= 4, 'BM_CII must expose flange visual candidates');

  const flangedValve = audit.catalogueComponents.find((entry) => entry.componentType === 'VALVE_FLANGED');
  assert.ok(flangedValve, 'audit must contain a VALVE_FLANGED component detail');
  assert.equal(flangedValve.visualQuality.ok, true, 'flanged valve visual-quality detail must be clean');
  const valveBody = flangedValve.roleMetrics.find((entry) => entry.role === 'VALVE_BODY');
  const valveCollars = flangedValve.roleMetrics.filter((entry) => /^END_COLLAR_/.test(entry.role));
  const valveShoulders = flangedValve.roleMetrics.filter((entry) => /^VALVE_NECK_/.test(entry.role));
  assert.ok(valveBody, 'flanged valve audit must include VALVE_BODY role');
  assert.equal(valveCollars.length, 2, 'flanged valve audit must include two end collars');
  assert.equal(valveShoulders.length, 2, 'flanged valve audit must include two tapered shoulders');
  assert.ok(valveCollars.every((entry) => entry.radius < valveBody.radius), 'end collars must be visually smaller than the valve body');
  assert.ok(valveShoulders.every((entry) => entry.radiusStart !== entry.radiusEnd), 'valve shoulders must remain tapered');
  assert.ok(valveBody.spanFraction >= 0.24 && valveBody.spanFraction <= 0.68, 'valve body must remain compact along the axis');

  const flange = audit.catalogueComponents.find((entry) => entry.componentClass === 'FLANGE');
  assert.ok(flange, 'audit must contain a flange component detail');
  assert.equal(flange.visualQuality.ok, true, 'flange visual-quality detail must be clean');
  const flangePlateRadius = Math.max(...flange.roleMetrics.filter((entry) => /FLANGE_(?:DISC|PLATE)/.test(entry.role)).map((entry) => entry.radius));
  const raisedFace = flange.roleMetrics.find((entry) => /RAISED_FACE/.test(entry.role));
  const boltPattern = flange.roleMetrics.find((entry) => entry.role === 'BOLT_PATTERN');
  assert.ok(raisedFace && raisedFace.radius < flangePlateRadius, 'raised face must stay inside flange plate radius');
  assert.ok(boltPattern && boltPattern.boltCircleRadius < flangePlateRadius, 'bolt circle must stay inside flange plate radius');

  assert.match(summary, /# BM_CII GLB Catalogue Visual Audit/, 'Markdown summary must keep the C9 title visible');
  assert.match(summary, /Catalogue candidates/, 'Markdown summary must expose catalogue candidate count');
  assert.match(summary, /Visual-quality issues \| 0/, 'Markdown summary must expose clean visual-quality issue count');
  assert.match(summary, /not an ASME dimensional database validation/i, 'Markdown summary must keep the scope disclaimer visible');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log('GLB catalogue visual audit artifact gate passed');
