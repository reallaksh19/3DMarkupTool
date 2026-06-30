import assert from 'node:assert/strict';
import { auditCatalogueBinding } from '../../src/catalogue/catalogue-binder.js';
import { loadPhase11aCatalogueItems } from '../fixtures/bend-torus-phase11a-pipeline.mjs';

const catalogueItems = await loadPhase11aCatalogueItems();
const exactGraph = graphWithItems([
  bendItem('BEND-EXACT', { diameterMm: 114.299995, wallMm: 6.0, bendAngleDeg: 45, bendRadiusMm: 152.399994 }),
  bendItem('BEND-PARTIAL', { diameterMm: 114.299995, wallMm: 6.0, bendAngleDeg: 45 }),
  { id: 'FLANGE-1', kind: 'component', family: 'flange', type: 'flange', dimensions: { diameterMm: 114.3, wallMm: 6 }, sourceRef: 'FLANGE-1' },
  { id: 'VALVE-1', kind: 'component', family: 'valve', type: 'valve', dimensions: { diameterMm: 114.3, wallMm: 6 }, sourceRef: 'VALVE-1' },
  { id: 'SUPPORT-1', kind: 'support', supportFamily: 'REST', node: 'N1', sourceRef: 'SUPPORT-1' }
]);
const audit = auditCatalogueBinding(exactGraph, catalogueItems);
const exact = audit.bindings.find((entry) => entry.itemId === 'BEND-EXACT');
const partial = audit.bindings.find((entry) => entry.itemId === 'BEND-PARTIAL');
assert.equal(exact.status, 'catalogueResolved', 'exact bend evidence resolves');
assert.equal(exact.family, 'elbow');
assert.equal(exact.reason, 'exact catalogue-backed bend evidence match');
assert.equal(partial.status, 'unresolved', 'partial bend evidence remains unresolved');
assert.equal(audit.bindings.find((entry) => entry.itemId === 'FLANGE-1').status, 'unresolved', 'flange unaffected');
assert.equal(audit.bindings.find((entry) => entry.itemId === 'VALVE-1').status, 'unresolved', 'valve unaffected');
assert.equal(audit.bindings.find((entry) => entry.itemId === 'SUPPORT-1').status, 'supportIntent', 'support remains support-intent');
assert.equal(audit.bendCatalogueResolvedCount, 1);
assert.equal(audit.bendCatalogueMissingCount, 1);

console.log('bend catalogue binding tests passed');

function graphWithItems(items) { return { schema: 'PlantModelGraph.v1', id: 'bend-binding-test', project: { units: 'mm', axisBasis: { authoring: 'canvas-current' } }, nodes: [{ id: 'N1', coord: [0,0,0] }, { id: 'N2', coord: [100,0,0] }], routes: [], items, sourceRefs: [] }; }
function bendItem(id, evidence) { return { id, kind: 'component', family: 'elbow', type: 'bend', sourceRef: id, dimensions: { diameterMm: evidence.diameterMm, wallMm: evidence.wallMm }, bendEvidence: { ...evidence, startPosition: [0,0,0], endPosition: [100,0,-50], arcCenter: [152.399994,0,0], normal: [0,1,0], startTangent: [1,0,0], endTangent: [0.707106781,0,-0.707106781] } }; }
