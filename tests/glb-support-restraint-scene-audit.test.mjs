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

assert.equal(audit.schema, 'GlbSupportRestraintSceneVisualAudit.v1');
assert.equal(audit.contract.scope, 'GLB support/restraint scene visual audit');
assert.equal(audit.contract.glbSupportCatalogueSceneParity, 'LEGACY_INLINE_SYMBOLS');
assert.equal(audit.contract.proportionalFallback, true);
assert.equal(audit.contract.vendorDimensionalDbBacked, false);
assert.equal(audit.contract.asmeDimensionalDbBacked, false);
assert.equal(audit.contract.rvmWriterUnaffected, true);
assert.equal(audit.contract.uiUnaffected, true);
assert.equal(audit.contract.externalViewerExecutedInCi, false);

assert.equal(audit.actualScenePath.converterBoundary, 'convertInputXmlToGlb()');
assert.equal(audit.actualScenePath.supportSceneGroup, 'supports.restraints');
assert.equal(audit.summary.hasSupportSceneGroup, true, 'actual GLB scene must contain supports.restraints group');
assert.ok(audit.summary.parsedInputXmlRestraints > 0, 'BM_CII sample must contain parsed InputXML restraints');
assert.ok(audit.summary.converterAuditSupportSymbols > 0, 'converter audit must expose support symbols');
assert.ok(audit.summary.supportSymbolCount > 0, 'actual GLB scene must contain support/restraint scene objects');
assert.equal(audit.summary.supportSymbolCount, audit.supportSymbols.length, 'support symbol detail count must match summary');
assert.ok(audit.summary.supportMeshCount >= audit.summary.supportSymbolCount, 'each support/restraint scene object should contain mesh geometry');
assert.equal(audit.summary.symbolsWithFiniteBounds, audit.summary.supportSymbolCount, 'all support/restraint symbols must have finite world bounds');
assert.equal(audit.summary.supportCatalogueSceneMetadataSymbolCount, 0, 'C17 documents current GLB support symbols as legacy inline scene metadata');
assert.equal(audit.summary.glbSupportCatalogueSceneParity, 'LEGACY_INLINE_SYMBOLS');
assert.equal(audit.summary.issueCount, 0, `GLB support scene audit must be issue-free: ${audit.issues.map((i) => i.message).join('; ')}`);
assert.equal(audit.ok, true, 'GLB support scene audit must pass hard checks');
assert.ok(audit.summary.warningCount >= audit.summary.supportSymbolCount, 'legacy support catalogue scene metadata gap should be visible as warnings');

assert.ok(audit.summary.families.length > 0, 'support family list must be visible');
assert.ok(audit.summary.expectedCatalogueFamilies.length > 0, 'expected catalogue family list must be visible');
assert.ok(audit.summary.sourceClasses.includes('actual'), 'actual support symbols must be present');
assert.ok(audit.summary.sourceClasses.includes('expected'), 'expected support symbols must be present from sideload compare mode');

for (const symbol of audit.supportSymbols) {
  assert.ok(symbol.symbolName, 'support symbol needs a stable scene name');
  assert.equal(symbol.sceneCatalogueMetadata.hasCatalogueMetadata, false, `${symbol.symbolName} should document current missing support catalogue scene metadata`);
  assert.ok(symbol.family, `${symbol.symbolName} must expose family`);
  assert.ok(symbol.expectedCatalogueFamily, `${symbol.symbolName} must resolve expected catalogue family`);
  assert.ok(symbol.expectedCatalogueRecipeId, `${symbol.symbolName} must resolve expected catalogue recipe id`);
  assert.equal(symbol.expectedCatalogueSchema, audit.summary.expectedCatalogueSchema, `${symbol.symbolName} must resolve expected catalogue schema`);
  assert.ok(symbol.node, `${symbol.symbolName} must expose node`);
  assert.ok(['actual', 'expected'].includes(symbol.sourceClass), `${symbol.symbolName} must expose sourceClass`);
  assert.ok(symbol.mappingContract, `${symbol.symbolName} must preserve mapping contract`);
  assert.ok(symbol.meshCount > 0, `${symbol.symbolName} must contain meshes`);
  assert.equal(symbol.worldBounds.finite, true, `${symbol.symbolName} must have finite bounds`);
  assert.ok(symbol.worldBounds.size.maxAxis > 0, `${symbol.symbolName} must have non-zero visual extent`);
  assert.deepEqual(symbol.issues, [], `${symbol.symbolName} must have no hard scene issues`);
}

assert.match(summary, /GLB Support \/ Restraint Scene Visual Audit/);
assert.match(summary, /LEGACY_INLINE_SYMBOLS/);
assert.match(summary, /supports\.restraints/);
assert.match(summary, /Symbols with finite bounds/);
assert.match(summary, /Symbols with support catalogue scene metadata/);
assert.match(summary, /Expected catalogue families/);
assert.match(summary, /C18 should wire\/stamp/);
assert.match(summary, /no vendor\/ASME dimensional database claim/i);
