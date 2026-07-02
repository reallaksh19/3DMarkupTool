import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertCatalogueBindingAudit } from '../../src/audit/catalogue-binding-audit.js';
import { auditCatalogueBinding, bindPlantGraphToCatalogue } from '../../src/catalogue/catalogue-binder.js';

const catalogueItems = [
  JSON.parse(await readFile('catalogues/base-piping/items/elbow-90lr-4in-std.json', 'utf8'))
];

const graph = {
  schema: 'PlantModelGraph.v1',
  id: 'catalogue-binder-unit-fixture',
  project: { name: 'catalogue binder unit fixture', units: 'mm', axisBasis: { authoring: 'canvas-current', rvmExport: 'navis-review' } },
  nodes: [
    { id: 'N1', coord: [0, 0, 0] },
    { id: 'N2', coord: [1000, 0, 0] },
    { id: 'N3', coord: [1000, 1000, 0] }
  ],
  routes: [
    { id: 'R1', from: 'N1', to: 'N2', bore: '4in', schedule: 'STD' }
  ],
  items: [
    { id: 'PIPE-1', kind: 'generated', generator: 'straightPipe.v1', route: 'R1', sourceRef: 'PIPE-1' },
    {
      id: 'ELBOW-1',
      kind: 'component',
      catalogueRef: { catalogue: 'base-piping', family: 'elbow', type: '90LR', nps: '4in', schedule: 'STD' },
      dimensions: { diameterMm: 114.3, wallMm: 6.02 },
      bendEvidence: { bendAngleDeg: 90, bendRadiusMm: 152.4, diameterMm: 114.3, wallMm: 6.02 },
      placement: { node: 'N2', inRoute: 'R1' },
      sourceRef: 'ELBOW-1'
    },
    {
      id: 'VALVE-1',
      kind: 'component',
      family: 'valve',
      type: 'VALVE',
      dimensions: { diameterMm: 114.3, wallMm: 6.02 },
      placement: { node: 'N3' },
      sourceRef: 'VALVE-1'
    },
    { id: 'SUPPORT-1', kind: 'support', node: 'N2', supportFamily: 'REST', sourceRef: 'SUPPORT-1' }
  ],
  sourceRefs: []
};

const bindings = bindPlantGraphToCatalogue(graph, catalogueItems);
assert.equal(bindings.length, graph.items.length, 'bind helper returns one binding row per graph item');

const audit = auditCatalogueBinding(graph, catalogueItems);
assert.equal(assertCatalogueBindingAudit(audit, {
  itemCount: 4,
  catalogueResolvedCount: 1,
  proceduralResolvedCount: 1,
  fallbackBlockedCount: 0,
  unresolvedCount: 1,
  supportIntentCount: 1,
  nearestMatchCount: 0,
  exportDecisionCount: 0
}).ok, true);

assert.equal(audit.bindings.find((binding) => binding.itemId === 'ELBOW-1').status, 'catalogueResolved');
assert.equal(audit.bindings.find((binding) => binding.itemId === 'PIPE-1').status, 'proceduralResolved');
assert.equal(audit.bindings.find((binding) => binding.itemId === 'VALVE-1').status, 'unresolved');
assert.equal(audit.bindings.find((binding) => binding.itemId === 'VALVE-1').reason, 'no exact catalogue item');
assert.equal(audit.bindings.find((binding) => binding.itemId === 'SUPPORT-1').status, 'supportIntent');

const binderSource = await readFile('src/catalogue/catalogue-binder.js', 'utf8');
for (const forbidden of ['writeRvm', 'writeAtt', 'rvm-writer', 'att-writer', 'managed-stage-rvm-converter', 'geometry-solver']) {
  assert.equal(binderSource.includes(forbidden), false, `binder must not reference ${forbidden}`);
}
assert.equal(binderSource.includes('nearestMatchCount: 0'), true, 'binder must expose zero nearest-match count');
assert.equal(typeof globalThis.window, 'undefined', 'test must run without browser window dependency');
assert.equal(typeof globalThis.document, 'undefined', 'test must run without browser document dependency');

console.log('catalogue binder unit tests passed');
