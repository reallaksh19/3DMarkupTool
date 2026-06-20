import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = mkdtempSync(join(tmpdir(), 'glb-support-restraint-scene-'));

execFileSync('node', [
  'scripts/generate-glb-support-restraint-scene-audit.mjs',
  `--outdir=${outDir}`
], {
  cwd: process.cwd(),
  stdio: 'pipe'
});

const audit = JSON.parse(readFileSync(join(outDir, 'BM_CII_glb_support_restraint_scene.audit.json'), 'utf8'));
const summary = readFileSync(join(outDir, 'BM_CII_glb_support_restraint_scene.summary.md'), 'utf8');

assert.equal(audit.schema, 'GlbSupportRestraintSceneVisualAudit.v2');
assert.equal(audit.contract.scope, 'GLB support/restraint scene visual audit');
assert.equal(audit.contract.glbSupportCatalogueSceneParity, 'CATALOGUE_METADATA_STAMPED');
assert.equal(audit.contract.supportCatalogueSceneMetadataRequired, true);
assert.equal(audit.contract.geometryProductionSwitch, false);
assert.equal(audit.contract.proportionalFallback, true);
assert.equal(audit.contract.vendorDimensionalDbBacked, false);
assert.equal(audit.contract.asmeDimensionalDbBacked, false);
assert.equal(audit.contract.rvmWriterUnaffected, true);
assert.equal(audit.contract.uiUnaffected, true);
assert.equal(audit.contract.externalViewerExecutedInCi, false);

assert.equal(audit.actualScenePath.converterBoundary, 'convertInputXmlToGlb()');
assert.equal(audit.actualScenePath.supportSceneGroup, 'supports.restraints');
assert.equal(audit.summary.hasSupportSceneGroup, true, 'actual GLB scene must contain supports.restraints group');
assert.ok(audit.summary.converterAuditSupportSymbols > 0, 'converter audit must expose support symbols');
assert.ok(audit.summary.supportSymbolCount > 0, 'actual GLB scene must contain support/restraint scene objects');
assert.equal(audit.summary.supportSymbolCount, audit.supportSymbols.length, 'support symbol detail count must match summary');
assert.ok(audit.summary.supportMeshCount >= audit.summary.supportSymbolCount, 'each support/restraint scene object should contain mesh geometry');
assert.equal(audit.summary.symbolsWithFiniteBounds, audit.summary.supportSymbolCount, 'all support/restraint symbols must have finite world bounds');
assert.equal(audit.summary.supportCatalogueSceneMetadataSymbolCount, audit.summary.supportSymbolCount, 'C18 requires support catalogue scene metadata on every support symbol');
assert.equal(audit.summary.glbSupportCatalogueSceneParity, 'CATALOGUE_METADATA_STAMPED');
assert.equal(audit.summary.issueCount, 0, `GLB support scene audit must be issue-free: ${audit.issues.map((i) => i.message).join('; ')}`);
assert.equal(audit.summary.warningCount, 0, `GLB support scene audit must be warning-free after C18: ${audit.warnings.map((i) => i.message).join('; ')}`);
assert.equal(audit.ok, true, 'GLB support scene audit must pass hard checks');

assert.ok(audit.summary.families.length > 0, 'support family list must be visible');
assert.ok(audit.summary.expectedCatalogueFamilies.length > 0, 'expected catalogue family list must be visible');
assert.ok(audit.summary.sourceClasses.includes('expected'), 'expected support symbols must be present from sideload compare mode');

for (const symbol of audit.supportSymbols) {
  assert.ok(symbol.symbolName, 'support symbol needs a stable scene name');
  assert.equal(symbol.sceneCatalogueMetadata.hasCatalogueMetadata, true, `${symbol.symbolName} must expose support catalogue scene metadata`);
  assert.equal(symbol.sceneCatalogueMetadata.complete, true, `${symbol.symbolName} must expose complete support catalogue scene metadata`);
  assert.equal(symbol.sceneCatalogueMetadata.visual, true, `${symbol.symbolName} must mark support catalogue visual`);
  assert.equal(symbol.sceneCatalogueMetadata.family, symbol.expectedCatalogueFamily, `${symbol.symbolName} support catalogue family must match resolved catalogue family`);
  assert.equal(symbol.sceneCatalogueMetadata.recipeId, symbol.expectedCatalogueRecipeId, `${symbol.symbolName} support catalogue recipe id must match resolved catalogue recipe`);
  assert.equal(symbol.sceneCatalogueMetadata.schema, audit.summary.expectedCatalogueSchema, `${symbol.symbolName} must stamp expected catalogue schema`);
  assert.equal(symbol.sceneCatalogueMetadata.proportionalFallback, true, `${symbol.symbolName} must keep proportional fallback explicit`);
  assert.equal(symbol.sceneCatalogueMetadata.vendorDimensionalDbBacked, false, `${symbol.symbolName} must keep vendor dimensional DB backing false`);
  assert.ok(symbol.family, `${symbol.symbolName} must expose family`);
  assert.ok(symbol.node, `${symbol.symbolName} must expose node`);
  assert.ok(['actual', 'expected'].includes(symbol.sourceClass), `${symbol.symbolName} must expose sourceClass`);
  assert.ok(symbol.mappingContract, `${symbol.symbolName} must preserve mapping contract`);
  assert.ok(symbol.meshCount > 0, `${symbol.symbolName} must contain meshes`);
  assert.equal(symbol.worldBounds.finite, true, `${symbol.symbolName} must have finite bounds`);
  assert.ok(symbol.worldBounds.size.maxAxis > 0, `${symbol.symbolName} must have non-zero visual extent`);
  assert.deepEqual(symbol.issues, [], `${symbol.symbolName} must have no hard scene issues`);
  assert.deepEqual(symbol.warnings, [], `${symbol.symbolName} must have no scene warnings after C18`);
}

assert.match(summary, /GLB Support \/ Restraint Scene Visual Audit/);
assert.match(summary, /CATALOGUE_METADATA_STAMPED/);
assert.match(summary, /Support catalogue scene metadata required/);
assert.match(summary, /Support scene group present/);
assert.match(summary, /Symbols with finite bounds/);
assert.match(summary, /Symbols with support catalogue scene metadata/);
assert.match(summary, /Expected catalogue families/);
assert.match(summary, /C18 result/);
assert.match(summary, /C19 can replace/);
assert.match(summary, /no vendor\/ASME dimensional database claim/i);
