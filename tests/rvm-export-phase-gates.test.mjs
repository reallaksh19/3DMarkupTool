import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import { buildRvmExportModel } from '../src/export-model.js';
import { writeRvm } from '../src/rvm-writer.js';
import { writeAtt } from '../src/att-writer.js';

const startedAt = performance.now();
const phaseResults = [];

function timedPhase(name, fn) {
  const phaseStart = performance.now();
  try {
    fn();
    const elapsedMs = performance.now() - phaseStart;
    phaseResults.push({ name, status: 'PASS', elapsedMs });
    console.log(`[phase-gate] PASS ${name} (${elapsedMs.toFixed(1)} ms)`);
  } catch (error) {
    const elapsedMs = performance.now() - phaseStart;
    phaseResults.push({ name, status: 'FAIL', elapsedMs });
    console.error(`[phase-gate] FAIL ${name} (${elapsedMs.toFixed(1)} ms)`);
    throw error;
  }
}

const model = syntheticInputXmlModel();
let exportModel;
let allNodes;
let allPrimitives;
let rvm;
let att;

timedPhase('01 source fixture / topology contract', () => {
  assert.equal(model.sourceKind, 'InputXML');
  assert.equal(model.nodes.size, 5, 'fixture should expose five stable nodes');
  assert.equal(model.elements.length, 4, 'fixture should expose pipe, bend, pipe, rigid/valve components');
  assert.equal(model.restraints.length, 3, 'fixture should expose guide, line stop, and hanger restraints');

  for (const element of model.elements) {
    assert.ok(model.nodes.has(element.fromNode), `${element.id} FROM_NODE must exist`);
    assert.ok(model.nodes.has(element.toNode), `${element.id} TO_NODE must exist`);
    assert.ok(Number.isFinite(element.dx));
    assert.ok(Number.isFinite(element.dy));
    assert.ok(Number.isFinite(element.dz));
  }
});

timedPhase('02 export model hierarchy / counts', () => {
  exportModel = buildRvmExportModel(model, {
    supportMode: 'inputxml-actual',
    nodeLabels: true,
    isonoteBoards: true
  });

  assert.equal(exportModel.root.name, 'INPUTXML_RVM_ROOT');
  assert.equal(exportModel.audit.componentCount, 4);
  assert.equal(exportModel.audit.supportCount, 3);
  assert.ok(exportModel.audit.annotationCount >= model.nodes.size, 'node labels should be exported as annotations');
  assert.ok(exportModel.audit.primitiveCount > exportModel.audit.componentCount, 'bends/supports/annotations should add primitives');

  assert.ok(findChild(exportModel.root, 'PLANT_GEOMETRY'), 'PLANT_GEOMETRY group missing');
  assert.ok(findChild(exportModel.root, 'SUPPORTS_RESTRAINTS'), 'SUPPORTS_RESTRAINTS group missing');
  assert.ok(findChild(exportModel.root, 'ANNOTATIONS'), 'ANNOTATIONS group missing');
});

timedPhase('03 geometry primitive quality gate', () => {
  allNodes = collectNodes(exportModel.root);
  allPrimitives = allNodes.flatMap((node) => node.primitives || []);

  assert.equal(allPrimitives.length, exportModel.audit.primitiveCount);

  const primitiveKinds = new Set(allPrimitives.map((primitive) => primitive.kind));
  for (const expected of ['cylinder', 'sphere', 'pyramid', 'box']) {
    assert.ok(primitiveKinds.has(expected), `expected ${expected} primitive coverage`);
  }

  const bendSegments = allPrimitives.filter((primitive) => /_BEND_SEG_/.test(primitive.name));
  assert.ok(bendSegments.length >= 3, 'bend placeholder should create visible segmented elbow primitives');

  for (const primitive of allPrimitives) {
    assertSafeName(primitive.name, 'primitive name');
    assertVector3(primitive.center, `${primitive.name}.center`);
    if (primitive.direction) assertVector3(primitive.direction, `${primitive.name}.direction`);
    if (primitive.kind === 'cylinder') {
      assertPositive(primitive.radius, `${primitive.name}.radius`);
      assertPositive(primitive.length, `${primitive.name}.length`);
    } else if (primitive.kind === 'sphere') {
      assertPositive(primitive.diameter, `${primitive.name}.diameter`);
    } else if (primitive.kind === 'box') {
      assertLengthArray(primitive.lengths, 3, `${primitive.name}.lengths`);
    } else if (primitive.kind === 'pyramid') {
      assertLengthArray(primitive.bottom, 2, `${primitive.name}.bottom`);
      assertLengthArray(primitive.top, 2, `${primitive.name}.top`);
      assertLengthArray(primitive.offset, 2, `${primitive.name}.offset`, { positive: false });
      assertPositive(primitive.height, `${primitive.name}.height`);
    } else {
      assert.fail(`unsupported primitive kind reached export model: ${primitive.kind}`);
    }
  }
});

timedPhase('04 support / attribute phase gate', () => {
  const supportGroup = findChild(exportModel.root, 'SUPPORTS_RESTRAINTS');
  assert.ok(supportGroup);
  assert.equal(supportGroup.children.length, 3);

  const families = new Set(supportGroup.children.map((node) => node.attributes?.FAMILY));
  assert.ok(families.has('GUIDE'), 'GUIDE restraint should remain GUIDE');
  assert.ok(families.has('LINE_STOP'), 'line stop restraint should remain LINE_STOP');
  assert.ok(families.has('SPRING'), 'hanger/spring restraint should remain SPRING');
  assert.ok(!families.has('REST'), 'unknown/directional supports must not silently become REST in this gate');

  for (const node of supportGroup.children) {
    assertSafeName(node.name, 'support node name');
    assert.equal(node.attributes?.TYPE, 'SUPPORT_RESTRAINT');
    assert.equal(node.attributes?.TARGET_VIEWER, 'Navisworks');
    assert.ok(node.primitives.length > 0, `${node.name} should have visible support primitives`);
  }
});

timedPhase('05 Navis RVM/ATT writer phase gate', () => {
  rvm = writeRvm(exportModel);
  att = writeAtt(exportModel);

  assert.ok(rvm instanceof ArrayBuffer, 'RVM writer must return an ArrayBuffer');
  assert.ok(rvm.byteLength > 512, 'RVM buffer is unexpectedly small');
  assert.ok(att.startsWith('CADC_Attributes_File'), 'ATT header missing');

  const chunkIds = extractChunkIds(rvm);
  for (const requiredChunk of ['HEAD', 'MODL', 'CNTB', 'PRIM', 'CNTE', 'END:']) {
    assert.ok(chunkIds.includes(requiredChunk), `RVM chunk ${requiredChunk} missing`);
  }
  assert.equal(chunkIds.filter((id) => id === 'PRIM').length, exportModel.audit.primitiveCount);

  for (const node of allNodes) {
    assert.ok(att.includes(`NEW ${node.name}`), `ATT block missing for ${node.name}`);
  }

  assert.ok(att.includes("TARGET_VIEWER := 'Navisworks'"), 'ATT should identify Navisworks target metadata');
  assert.ok(att.includes("FAMILY := 'GUIDE'"), 'ATT should preserve GUIDE support metadata');
  assert.ok(att.includes("FAMILY := 'LINE_STOP'"), 'ATT should preserve LINE_STOP support metadata');
  assert.ok(att.includes("FAMILY := 'SPRING'"), 'ATT should preserve SPRING support metadata');
});

const totalMs = performance.now() - startedAt;
console.log(`[phase-gate] completed ${phaseResults.length} phases in ${(totalMs / 1000).toFixed(2)} s`);

function syntheticInputXmlModel() {
  const nodes = new Map([
    ['10', node('10', 0, 0, 0)],
    ['20', node('20', 1000, 0, 0)],
    ['30', node('30', 1000, 1000, 0)],
    ['40', node('40', 1000, 1000, 900)],
    ['50', node('50', 1500, 1000, 900)]
  ]);

  const elements = [
    element(nodes, 'PE_001_PIPE_10_TO_20', 'PIPE', 'PIPE', '10', '20'),
    element(nodes, 'PE_002_BEND_20_TO_30', 'BEND', 'BEND', '20', '30', { bendRadius: 180, bendAngle: 90 }),
    element(nodes, 'PE_003_PIPE_30_TO_40', 'PIPE', 'PIPE', '30', '40'),
    element(nodes, 'PE_004_VALVE_40_TO_50', 'VALVE', 'VALVE', '40', '50', { rigidType: 'VALVE', rigidWeight: 128 })
  ];

  return {
    sourceKind: 'InputXML',
    sourceSchemaVersion: 'phase-gate-fixture',
    diagnostics: [],
    nodes,
    elements,
    restraints: [
      { node: '20', typeCode: '7', xCos: 0, yCos: 0, zCos: 1, gapMm: 6 },
      { node: '30', typeCode: '3', xCos: 1, yCos: 0, zCos: 0, gapMm: 12 },
      { node: '40', typeCode: 'HANGER', xCos: 0, yCos: 1, zCos: 0, gapMm: 0 }
    ],
    isonoteMap: new Map([
      ['20', ":ISONOTE 'GUIDE(6kN)'"],
      ['30', ":ISONOTE 'LINE STOP(12kN)'"]
    ])
  };
}

function node(id, x, y, z) {
  return { id, x, y, z };
}

function element(nodes, id, rawType, type, fromNode, toNode, overrides = {}) {
  const from = nodes.get(fromNode);
  const to = nodes.get(toNode);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  return {
    id,
    rawType,
    type,
    fromNode,
    toNode,
    from,
    to,
    dx,
    dy,
    dz,
    props: {
      id,
      refNo: id,
      type,
      meshRole: rawType,
      lineNo: 'TEST-LINE-100',
      lineNoSource: 'phase-gate',
      fromNode,
      toNode,
      bore: 120,
      wallThickness: { value: 6, source: 'explicit' },
      materialThickness: { value: 6, source: 'explicit' },
      material: { value: 'CS', source: 'explicit' },
      pressure: { value: 1000, source: 'explicit' },
      hydroPressure: { value: 1500, source: 'explicit' },
      temp1: { value: 80, source: 'explicit' },
      temp2: { value: 120, source: 'explicit' },
      temp3: { value: 160, source: 'explicit' },
      rigidType: overrides.rigidType || '',
      rigidWeight: overrides.rigidWeight || '',
      bendRadius: overrides.bendRadius || '',
      bendAngle: overrides.bendAngle || '',
      source: 'InputXML phase gate fixture'
    }
  };
}

function findChild(node, name) {
  return (node.children || []).find((child) => child.name === name) || null;
}

function collectNodes(node) {
  return [node].concat((node.children || []).flatMap((child) => collectNodes(child)));
}

function assertVector3(value, label) {
  assert.ok(Array.isArray(value), `${label} must be an array`);
  assert.equal(value.length, 3, `${label} must contain three values`);
  for (const entry of value) assert.ok(Number.isFinite(Number(entry)), `${label} contains non-finite value`);
}

function assertLengthArray(value, length, label, options = {}) {
  assert.ok(Array.isArray(value), `${label} must be an array`);
  assert.equal(value.length, length, `${label} length mismatch`);
  for (const entry of value) {
    assert.ok(Number.isFinite(Number(entry)), `${label} contains non-finite value`);
    if (options.positive !== false) assert.ok(Number(entry) > 0, `${label} must contain positive lengths`);
  }
}

function assertPositive(value, label) {
  assert.ok(Number.isFinite(Number(value)) && Number(value) > 0, `${label} must be positive`);
}

function assertSafeName(value, label) {
  assert.match(String(value || ''), /^[A-Za-z0-9_]+$/, `${label} must be Navis-safe`);
}

function extractChunkIds(buffer) {
  const view = new DataView(buffer);
  const chunkIds = [];
  let offset = 0;
  let guard = 0;
  while (offset + 24 <= buffer.byteLength) {
    const id = [0, 1, 2, 3]
      .map((index) => String.fromCharCode(view.getUint32(offset + index * 4, false)))
      .join('')
      .trim();
    const nextOffset = view.getUint32(offset + 16, false);
    assert.ok(id, `empty chunk id at offset ${offset}`);
    assert.ok(nextOffset > offset, `non-forward chunk pointer at ${offset}`);
    assert.ok(nextOffset <= buffer.byteLength, `chunk pointer outside buffer at ${offset}`);
    chunkIds.push(id);
    offset = nextOffset;
    guard += 1;
    assert.ok(guard < 10000, 'RVM chunk scan guard tripped');
  }
  assert.equal(offset, buffer.byteLength, 'RVM chunk scan should finish exactly at buffer end');
  return chunkIds;
}
