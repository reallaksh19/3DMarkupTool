import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { VALVE_FLANGE_VISUAL_CATALOG_SCHEMA } from '../src/valve-flange-visual-catalog.js';

const repoRoot = new URL('..', import.meta.url);
const tempDir = mkdtempSync(join(tmpdir(), 'glb-catalogue-schema-stamping-'));

try {
  execFileSync('node', ['scripts/generate-glb-catalogue-scene-mesh-audit.mjs', `--outdir=${tempDir}`], { cwd: repoRoot, stdio: 'pipe' });

  const auditPath = join(tempDir, 'BM_CII_glb_catalogue_scene_mesh.audit.json');
  assert.ok(existsSync(auditPath), 'C10B schema-stamping gate requires the generated scene-mesh audit JSON');

  const audit = JSON.parse(readFileSync(auditPath, 'utf8'));
  assert.equal(audit.visualCatalogSchema, VALVE_FLANGE_VISUAL_CATALOG_SCHEMA, 'audit must report the active valve/flange visual catalogue schema');
  assert.ok(audit.catalogueGroups.length >= 10, 'BM_CII must expose catalogue scene groups for schema stamping validation');

  for (const group of audit.catalogueGroups) {
    assert.equal(
      group.visualCatalogSchema,
      VALVE_FLANGE_VISUAL_CATALOG_SCHEMA,
      `${group.groupName} must stamp visualCatalogSchema on the catalogue group userData`
    );
    for (const role of group.roleMetrics) {
      assert.equal(
        role.visualCatalogSchema,
        VALVE_FLANGE_VISUAL_CATALOG_SCHEMA,
        `${group.groupName}/${role.role} must stamp visualCatalogSchema on role userData`
      );
    }
  }

  const schemaWarnings = audit.warnings.filter((entry) => /visualCatalogSchema/i.test(entry.message || ''));
  assert.deepEqual(schemaWarnings, [], 'missing visualCatalogSchema must be a blocking C10B failure, not a warning');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log('GLB catalogue schema stamping gate passed');
