import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { validatePlantModelGraphContract } from '../../src/contracts/index.js';
import {
  auditManagedStageToPlantGraph,
  convertManagedStageJsonToPlantGraph
} from '../../src/importers/managed-stage-to-plant-graph.js';
import { auditPlantGraphTopology } from '../../src/audit/plant-graph-topology-audit.js';

const sourceName = 'bm-cii-managed-stage-full-topology.generated.json';
const source = buildBmCiiStyleManagedStageFixture();
const sourceText = JSON.stringify(source);
const graph = convertManagedStageJsonToPlantGraph(sourceText, {
  sourceName,
  phase: 'Phase 3A full BM_CII importer topology benchmark'
});
const validation = validatePlantModelGraphContract(graph);
assert.equal(validation.ok, true, `graph must validate: ${validation.errors.join('; ')}`);

const topologyAudit = auditPlantGraphTopology(graph);
assert.equal(topologyAudit.ok, true, 'full BM_CII topology audit must pass');
assert.deepEqual(topologyAudit.missingRouteNodeRefs, [], 'missing route node refs must be zero');
assert.deepEqual(topologyAudit.missingItemNodeRefs, [], 'missing item node refs must be zero');
assert.deepEqual(topologyAudit.missingItemRouteRefs, [], 'missing item route refs must be zero');
assert.deepEqual(topologyAudit.duplicateNodeIds, [], 'duplicate node IDs must be zero');
assert.deepEqual(topologyAudit.duplicateRouteIds, [], 'duplicate route IDs must be zero');
assert.deepEqual(topologyAudit.duplicateItemIds, [], 'duplicate item IDs must be zero');

const audit = auditManagedStageToPlantGraph(sourceText, graph, { sourceName });
assert.equal(audit.sourceComponentCount, 40, 'source component count');
assert.equal(audit.sourcePipeCount, 19, 'source pipe count');
assert.equal(audit.sourceFlangeCount, 8, 'source flange count');
assert.equal(audit.sourceValveCount, 6, 'source valve count');
assert.equal(audit.sourceBendCount, 7, 'source bend count');
assert.equal(audit.sourceSupportCount, 12, 'source support count');
assert.equal(audit.supportItemCount, 12, 'support item count');
assert.equal(audit.generatedPipeItemCount, 19, 'generated pipe item count');
assert.equal(audit.placeholderGeneratedComponentCount, 0, 'placeholder-generated component count must be zero');
assert.equal(audit.endpointTopologyRecordCount, 40, 'endpoint topology record count');
assert.equal(graph.routes.length, 40, 'all endpoint topology records become graph routes');

const items = graph.items;
assert.equal(items.filter((item) => item.kind === 'support').length, 12, 'support items');
assert.equal(items.filter((item) => item.kind === 'generated' && item.generator === 'straightPipe.v1').length, 19, 'pipe items');
assert.equal(items.filter((item) => item.kind === 'component' && item.family === 'flange').length, 8, 'flange component items');
assert.equal(items.filter((item) => item.kind === 'component' && item.family === 'valve').length, 6, 'valve component items');
assert.equal(items.filter((item) => item.kind === 'component' && item.family === 'elbow').length, 7, 'bend/elbow component items');
assert.equal(items.filter((item) => /Placeholder\.v1$/i.test(String(item.generator || ''))).length, 0, 'no placeholder generator items');

const bendItems = items.filter((item) => item.kind === 'component' && item.family === 'elbow');
assert.equal(bendItems.length, source.stats.bends, 'bend items preserve source bend count');
for (const bend of bendItems) {
  assert.equal(bend.resolutionIntent, 'unresolved', `${bend.id} stays unresolved before geometry solving`);
  assert.ok(bend.bendEvidence, `${bend.id} preserves bend evidence`);
  assert.equal(bend.bendEvidence.centerEstimateSource, 'inputxml-chord-midpoint-not-arc-center', `${bend.id} preserves chord-midpoint warning`);
  assert.ok(Number.isFinite(Number(bend.bendEvidence.arcLengthMm)), `${bend.id} preserves arc length evidence`);
  assert.ok(Number.isFinite(Number(bend.bendEvidence.chordLengthMm)), `${bend.id} preserves chord length evidence`);
}

const importerSource = await readFile('src/importers/managed-stage-to-plant-graph.js', 'utf8');
for (const forbidden of ['writeRvm', 'writeAtt', 'rvm-writer', 'att-writer', 'managed-stage-rvm-converter']) {
  assert.equal(importerSource.includes(forbidden), false, `importer must not reference ${forbidden}`);
}
assert.equal(typeof globalThis.window, 'undefined', 'test must run without browser window dependency');

await mkdir('/tmp/phase3a-audit', { recursive: true });
await writeFile('/tmp/phase3a-audit/full-importer-proof.json', JSON.stringify({
  schema: 'Phase3AFullImporterProof.v1',
  validation,
  topologyAudit,
  importerAudit: audit,
  graphSummary: {
    nodeCount: graph.nodes.length,
    routeCount: graph.routes.length,
    itemCount: graph.items.length
  }
}, null, 2));

console.log(JSON.stringify({
  ok: true,
  topologyOk: topologyAudit.ok,
  missingRouteNodeRefs: topologyAudit.missingRouteNodeRefs.length,
  missingItemNodeRefs: topologyAudit.missingItemNodeRefs.length,
  missingItemRouteRefs: topologyAudit.missingItemRouteRefs.length,
  duplicateNodeIds: topologyAudit.duplicateNodeIds.length,
  duplicateRouteIds: topologyAudit.duplicateRouteIds.length,
  duplicateItemIds: topologyAudit.duplicateItemIds.length,
  placeholderGeneratedComponentCount: audit.placeholderGeneratedComponentCount,
  sourceComponentCount: audit.sourceComponentCount,
  routeCount: graph.routes.length,
  itemCount: graph.items.length
}, null, 2));

function buildBmCiiStyleManagedStageFixture() {
  const componentTypes = [
    'FLAN', 'PIPE', 'PIPE', 'PIPE', 'PIPE', 'PIPE',
    'FLAN', 'VALV', 'FLAN', 'PIPE', 'PIPE',
    'FLAN', 'VALV', 'FLAN', 'BEND', 'PIPE', 'PIPE', 'BEND', 'BEND',
    'PIPE', 'FLAN', 'BEND', 'PIPE', 'BEND', 'BEND', 'PIPE',
    'FLAN', 'VALV', 'FLAN', 'BEND', 'PIPE', 'PIPE', 'VALV',
    'PIPE', 'PIPE', 'PIPE', 'PIPE', 'PIPE', 'VALV', 'VALV'
  ];
  assert.equal(componentTypes.length, 40, 'fixture component count');
  const children = componentTypes.map((type, index) => componentRecord(type, index + 1));
  for (let index = 0; index < 12; index++) children.push(supportRecord(index + 1));
  return {
    schema: 'inputxml-managed-stage/v1',
    profile: 'AVEVA_JSON_FOR_3D_RVM_VIEWER',
    source: 'BM_CII_INPUT.XML',
    converterSchema: 'inputxml-direct-managed-stage/v2-rich-topology',
    units: { length: 'mm' },
    stats: {
      components: 40,
      componentRows: 40,
      validRestraints: 12,
      emittedSupports: 12,
      bends: 7,
      rigids: 15,
      routeLengthRows: 40,
      richGeometryComponents: 40,
      uxmlReadyComponents: 52,
      branches: 1,
      children: 52
    },
    hierarchy: [{
      name: '/INPUTXML/BM_CII_INPUT/BRANCH-001',
      type: 'BRANCH',
      attributes: { TYPE: 'BRAN', NAME: '/INPUTXML/BM_CII_INPUT/BRANCH-001' },
      children
    }]
  };
}

function componentRecord(type, ordinal) {
  const from = String(ordinal * 10);
  const to = String((ordinal + 1) * 10);
  const family = type === 'FLAN' ? 'FLANGE' : type === 'VALV' ? 'VALVE' : type === 'BEND' ? 'ELBOW' : 'PIPE';
  const rawType = type === 'FLAN' ? 'Flange' : type === 'VALV' ? 'Valve' : type === 'BEND' ? 'BEND' : 'PIPE';
  const diameter = ordinal > 28 ? 60.299999 : ordinal > 20 ? 88.900002 : 114.299995;
  const wall = ordinal > 28 ? 3.9 : ordinal > 20 ? 5.5 : 6.0;
  const start = [ordinal * 100, ordinal % 3 * 250, -ordinal * 75];
  const end = [start[0] + 100, start[1], start[2] - 50];
  const attrs = {
    TYPE: type,
    RAW_TYPE: rawType,
    CANONICAL_TYPE: family,
    NAME: `PE_${String(ordinal).padStart(3, '0')}_${family}_${from}_TO_${to}`,
    SOURCE_ELEMENT_ID: `PE_${String(ordinal).padStart(3, '0')}_${family}_${from}_TO_${to}`,
    SOURCE_XML_INDEX: ordinal,
    SOURCE_NODE_NUMBERS: [from, to],
    FROM_NODE: from,
    TO_NODE: to,
    START_NODE: from,
    END_NODE: to,
    APOS: start,
    LPOS: end,
    POS: midpoint(start, end),
    COMPONENT_CLASS: family,
    DTXR: type === 'VALV' ? 'VALVE' : type === 'FLAN' ? 'FLANGE' : type,
    DIAMETER: String(diameter),
    WALL_THICK: String(wall),
    OUTSIDE_DIAMETER_MM: diameter,
    DIAMETER_MM: diameter,
    WALL_THICKNESS_MM: wall,
    MATERIAL: 'A106 B'
  };
  if (type === 'BEND') {
    attrs.BEND_RADIUS_MM = diameter === 60.299999 ? 76.199997 : diameter === 88.900002 ? 114.299995 : 152.399994;
    attrs.BEND_RADIUS = String(attrs.BEND_RADIUS_MM);
    attrs.BEND_ANGLE_DEG = 45;
    attrs.BEND_ANGLE = '45.000000';
    attrs.ELBOW_ARC_LENGTH_MM = attrs.BEND_RADIUS_MM * Math.PI / 4;
    attrs.BEND_ELEMENT_LENGTH_MM = attrs.ELBOW_ARC_LENGTH_MM;
    attrs.BEND_CHORD_LENGTH_MM = distance(start, end);
    attrs.BEND_CENTER_ESTIMATE = midpoint(start, end);
    attrs.BEND_CENTER_ESTIMATE_SOURCE = 'inputxml-chord-midpoint-not-arc-center';
  }
  return { name: `${type} ${attrs.NAME}`, type, attributes: attrs };
}

function supportRecord(ordinal) {
  const node = String(ordinal * 30);
  return {
    name: `ATTA SUPPORT_${ordinal}`,
    type: 'ATTA',
    attributes: {
      TYPE: 'ATTA',
      NAME: `SUPPORT_${ordinal}`,
      SOURCE_ELEMENT_ID: `SUPPORT_${ordinal}`,
      NODE: node,
      SUPPORT_KIND: ordinal % 3 === 0 ? 'LINESTOP' : ordinal % 2 === 0 ? 'GUIDE' : 'REST',
      SUPPORT_AXIS: '+Y',
      POS: [ordinal * 300, 0, -ordinal * 100],
      SOURCE: 'InputXML'
    }
  };
}

function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
