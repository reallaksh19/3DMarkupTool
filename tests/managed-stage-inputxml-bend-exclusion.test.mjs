import assert from 'node:assert/strict';

import { buildManagedStageGeometryContractSet } from '../src/managed-stage-geometry-contract.js';
import { applyManagedStageElbowTangentHints } from '../src/managed-stage-elbow-tangent-hints.js';
import {
  applyManagedStageInputXmlBendExclusion,
  assertManagedStageInputXmlBendExclusionAudit
} from '../src/managed-stage-inputxml-bend-exclusion.js';
import {
  isInputXmlBasedManagedStageProfile,
  resolveManagedStageJsonProcessingConfig
} from '../src/managed-stage-json-processing-config.js';
import { buildManagedStageRvmExportModel } from '../src/managed-stage-rvm-export-model.js';
import { parseManagedStageProfile } from '../src/managed-stage-profile-parser.js';
import { createBmCiiManagedStageFixture } from './managed-stage-bm-cii-profile-fixture.mjs';

const profile = parseManagedStageProfile(JSON.stringify(createBmCiiManagedStageFixture()));
assert.equal(isInputXmlBasedManagedStageProfile(profile), true);

const defaultConfig = resolveManagedStageJsonProcessingConfig(profile);
assert.equal(defaultConfig.excludeBendsWhileProcessingInputXmlBasedJson, true);
assert.equal(defaultConfig.genericInputXmlBendRadiusMultiplier, 1.5);

const nativeConfig = resolveManagedStageJsonProcessingConfig(profile, { excludeBendsWhileProcessingInputXmlBasedJson: false });
assert.equal(nativeConfig.excludeBendsWhileProcessingInputXmlBasedJson, false);

const contractSet = buildManagedStageGeometryContractSet(profile);
const hintedContracts = applyManagedStageElbowTangentHints(contractSet.contracts);
const excluded = applyManagedStageInputXmlBendExclusion(hintedContracts, defaultConfig);
assertManagedStageInputXmlBendExclusionAudit(excluded.audit, {
  enabled: true,
  code4BendsExcluded: 7,
  genericCode8BendsPlanned: 7,
  genericCode8BendPrimitiveCount: 35
});
assert.equal(excluded.audit.genericBends.every((bend) => bend.emittedAs === 'code8-generic-1p5d-reconstructed-arc-cylinders'), true);
assert.equal(excluded.audit.genericBends.every((bend) => bend.segmentCount === 5), true);
assert.equal(excluded.audit.trimApplicationCount < 14, true);
assert.equal(excluded.audit.skippedTrimSources.some((entry) => /not a 2-pipe-only intersection/.test(entry.reason)), true);
assert.equal(excluded.contracts.filter((contract) => contract.excludeCode4Bend).length, 7);

const firstBend = excluded.contracts.find((contract) => contract.name === 'PE_014_BEND_120_TO_130');
assert.equal(firstBend.genericInputXmlBend.mode, 'code8-generic-1p5d-reconstructed-arc-cylinders');
assert.equal(firstBend.genericInputXmlBend.genericBendRadiusMm, 171.45);
assert.equal(firstBend.genericInputXmlBend.segments.length, 5);
assert.ok(firstBend.genericInputXmlBend.segments.every((segment) => segment.lengthMm > 0));
assert.match(firstBend.genericInputXmlBend.segments[0].role, /^arc-/);

const model = buildManagedStageRvmExportModel(profile);
const primitives = model.root.children[0].children[0].children.flatMap((node) => node.primitives);
assert.equal(model.audit.inputXmlBendExclusionAudit.code4BendsExcluded, 7);
assert.equal(model.audit.inputXmlBendExclusionAudit.genericCode8BendPrimitiveCount, 35);
assert.equal(primitives.filter((primitive) => primitive.kind === 'elbow').length, 0);
assert.equal(primitives.filter((primitive) => primitive.kind === 'cylinder').length, 91);
assert.equal(primitives.filter((primitive) => primitive.genericInputXmlBend).length, 35);
assert.equal(primitives.filter((primitive) => primitive.genericInputXmlBranchFitting).length, 15);
assert.ok(primitives.filter((primitive) => primitive.recipeTrimStartOffsetMm || primitive.recipeTrimEndOffsetMm).length < 14);

const nativeModel = buildManagedStageRvmExportModel(profile, { excludeBendsWhileProcessingInputXmlBasedJson: false });
const nativePrimitives = nativeModel.root.children[0].children[0].children.flatMap((node) => node.primitives);
assert.equal(nativeModel.audit.inputXmlBendExclusionAudit.enabled, false);
assert.equal(nativePrimitives.filter((primitive) => primitive.kind === 'elbow').length, 7);
assert.equal(nativePrimitives.filter((primitive) => primitive.kind === 'cylinder').length, 56);
assert.equal(nativePrimitives.filter((primitive) => primitive.genericInputXmlBranchFitting).length, 15);

console.log('Managed-stage InputXML bend exclusion config, reconstructed generic bends, guarded trim, and branch fittings passed');
