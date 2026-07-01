import assert from 'node:assert/strict';
import { auditCatalogueBinding } from '../../src/catalogue/catalogue-binder.js';
import { buildBmCiiPhase11aState } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const state = await buildBmCiiPhase11aState();
assert.equal(state.bindingAudit.flangeCatalogueResolvedCount, 8);
assert.equal(state.bindingAudit.flangeCatalogueMissingCount, 0);
assert.equal(state.bindingAudit.bendCatalogueResolvedCount, 7);
assert.equal(state.bindingAudit.supportIntentCount, 12);
assert.equal(state.bindingAudit.bindings.filter((entry) => entry.family === 'valve' && entry.status === 'unresolved').length, 6);

const withoutFlangeCatalogue = state.catalogueItems.filter((item) => item.family !== 'flange');
const missingAudit = auditCatalogueBinding(state.graph, withoutFlangeCatalogue);
assert.equal(missingAudit.flangeCatalogueResolvedCount, 0);
assert.equal(missingAudit.flangeCatalogueMissingCount, 8);
assert.equal(missingAudit.bendCatalogueResolvedCount, 7);
assert.equal(missingAudit.supportIntentCount, 12);

const partialGraph = structuredClone(state.graph);
const firstFlange = partialGraph.items.find((item) => item.family === 'flange');
delete firstFlange.dimensions.outerDiameterMm;
delete firstFlange.flangeEvidence.outerDiameterMm;
const partialAudit = auditCatalogueBinding(partialGraph, state.catalogueItems);
assert.equal(partialAudit.flangeCatalogueResolvedCount, 7);
assert.equal(partialAudit.flangeCatalogueMissingCount, 1);

console.log('flange catalogue binding tests passed');
