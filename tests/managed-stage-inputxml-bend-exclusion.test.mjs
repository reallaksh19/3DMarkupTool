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
  genericCode8BendsPlanned: 7
});
assert.equal(excluded.audit.trimApplicationCount, 14);
assert.equal(excluded.contracts.filter((contract) => contract.excludeCode4Bend).length, 7);
assert.equal(excluded.contracts.filter((contract) => contract.inputXmlBendTrimmed).length > 0, true);

const firstBend = excluded.contracts.find((contract) => contract.name === 'PE_014_BEND_120_TO_130');
assert.equal(firstBend.genericInputXmlBend.mode, 'code8-generic-1p5d-chord-cylinder');
assert.equal(firstBend.genericInputXmlBend.genericBendRadiusMm, 171.45);

const model = buildManagedStageRvmExportModel(profile);
const primitives = model.root.children[0].children[0].children.flatMap((node) => node.primitives);
assert.equal(model.audit.inputXmlBendExclusionAudit.code4BendsExcluded, 7);
assert.equal(primitives.filter((primitive) => primitive.kind === 'elbow').length, 0);
assert.equal(primitives.filter((primitive) => primitive.kind === 'cylinder').length, 48);
assert.equal(primitives.filter((primitive) => primitive.genericInputXmlBend).length, 7);
assert.ok(primitives.filter((primitive) => primitive.recipeTrimStartOffsetMm || primitive.recipeTrimEndOffsetMm).length > 0);

const nativeModel = buildManagedStageRvmExportModel(profile, { excludeBendsWhileProcessingInputXmlBasedJson: false });
const nativePrimitives = nativeModel.root.children[0].children[0].children.flatMap((node) => node.primitives);
assert.equal(nativeModel.audit.inputXmlBendExclusionAudit.enabled, false);
assert.equal(nativePrimitives.filter((primitive) => primitive.kind === 'elbow').length, 7);
assert.equal(nativePrimitives.filter((primitive) => primitive.kind === 'cylinder').length, 41);

console.log('Managed-stage InputXML bend exclusion config and generic 1.5D bend planning passed');
