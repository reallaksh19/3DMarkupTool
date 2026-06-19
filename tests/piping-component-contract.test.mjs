import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import {
  assertComponentMapping,
  assertGeometryContract,
  assertPipingComponent,
  assertRenderInstruction,
  buildContractDiagnostics,
  validateComponentMapping,
  validateGeometryContract,
  validatePipingComponent,
  validateRenderInstruction
} from '../src/piping-component-contract.js';

const startedAt = performance.now();
const sourceRecords = syntheticSourceRecords();
const components = syntheticComponents();
const contracts = syntheticGeometryContracts();
const renderInstructions = syntheticRenderInstructions();

phase('01 source records map to components without silent drops', () => {
  const report = assertComponentMapping(sourceRecords, components);
  assert.equal(report.ok, true);
  assert.equal(sourceRecords.length, components.length);

  const unknown = components.find((component) => component.componentClass === 'UNKNOWN');
  assert.ok(unknown, 'unknown source record must remain an UNKNOWN component');
  assert.equal(unknown.componentType, 'UNKNOWN_COMPONENT');
});

phase('02 component contract supports pipe, fittings, valves, flanges, restraints, unknowns', () => {
  for (const component of components) {
    const report = assertPipingComponent(component, { strictGeometryKind: true });
    assert.equal(report.ok, true, `${component.componentId} should pass component contract`);
  }

  const byClass = new Set(components.map((component) => component.componentClass));
  for (const expected of ['PIPE', 'ELBOW', 'TEE', 'VALVE', 'FLANGE', 'RESTRAINT', 'UNKNOWN']) {
    assert.ok(byClass.has(expected), `fixture should cover ${expected}`);
  }
});

phase('03 geometry contracts define renderable intent before any mesh', () => {
  for (const contract of contracts) {
    const report = assertGeometryContract(contract, components);
    assert.equal(report.ok, true, `${contract.geometryContractId} should pass geometry contract`);
  }

  const kinds = new Set(contracts.map((contract) => contract.geometryKind));
  for (const expected of [
    'CYLINDER_BETWEEN_NODES',
    'ELBOW_SWEEP',
    'TEE_COMPOSITE',
    'VALVE_SYMBOLIC',
    'FLANGE_PAIR',
    'RESTRAINT_SYMBOL',
    'UNKNOWN_PLACEHOLDER',
    'FALLBACK_LEGACY'
  ]) {
    assert.ok(kinds.has(expected), `fixture should cover ${expected}`);
  }
});

phase('04 render instructions carry stable component metadata and explicit fallback', () => {
  for (const instruction of renderInstructions) {
    const report = assertRenderInstruction(instruction);
    assert.equal(report.ok, true, `${instruction.geometryContractId} should pass render instruction contract`);
  }

  const fallback = renderInstructions.find((instruction) => instruction.userData.fallbackRendered === true);
  assert.ok(fallback, 'fixture must include an explicit fallback render instruction');
  assert.match(fallback.userData.fallbackReason, /legacy/i);

  const diagnostics = buildContractDiagnostics(sourceRecords, components, contracts, renderInstructions);
  assert.equal(diagnostics.sourceRecordsTotal, 7);
  assert.equal(diagnostics.componentsTotal, 7);
  assert.equal(diagnostics.geometryContractsTotal, 8);
  assert.equal(diagnostics.componentsByClass.PIPE, 1);
  assert.equal(diagnostics.componentsByClass.UNKNOWN, 1);
  assert.equal(diagnostics.unknownComponents, 1);
  assert.equal(diagnostics.restraintsByKind.GUIDE, 1);
  assert.equal(diagnostics.fallbackRendered, 1);
  assert.deepEqual(diagnostics.unrenderableComponents, []);
});

phase('05 failure gates reject dropped records, raw renderer branching, invalid geometry, and unknown-to-rest conversion', () => {
  const dropped = validateComponentMapping(sourceRecords, components.slice(0, -1));
  assert.equal(dropped.ok, false);
  assert.ok(dropped.errors.some((issue) => issue.code === 'mapping.droppedSource'));

  const rawRendererBranch = validateRenderInstruction({
    ...renderInstructions[0],
    rawTypeCode: '7'
  });
  assert.equal(rawRendererBranch.ok, false);
  assert.ok(rawRendererBranch.errors.some((issue) => issue.code === 'render.rawSourceKey'));

  const zeroLengthPipe = validateGeometryContract({
    ...contracts[0],
    placement: { ...contracts[0].placement, to: [...contracts[0].placement.from] }
  }, components);
  assert.equal(zeroLengthPipe.ok, false);
  assert.ok(zeroLengthPipe.errors.some((issue) => issue.code === 'geometry.zeroLength'));

  const negativeValveLength = validateGeometryContract({
    ...contracts[3],
    dimensions: { ...contracts[3].dimensions, faceToFaceLength: -1 }
  }, components);
  assert.equal(negativeValveLength.ok, false);
  assert.ok(negativeValveLength.errors.some((issue) => issue.code === 'contract.positiveNumber' || issue.code === 'geometry.valveLength'));

  const silentUnknownToRest = validatePipingComponent({
    ...components[5],
    componentType: 'REST',
    sourceRef: {
      sourceType: 'INPUTXML',
      sourceId: 'SRC_UNKNOWN_SUPPORT',
      rawKind: 'UNKNOWN_RESTRAINT'
    }
  });
  assert.equal(silentUnknownToRest.ok, false);
  assert.ok(silentUnknownToRest.errors.some((issue) => issue.code === 'unknown.silentConversion'));
});

console.log(`[piping-contract] completed in ${((performance.now() - startedAt) / 1000).toFixed(2)} s`);

function phase(name, fn) {
  const phaseStart = performance.now();
  try {
    fn();
    console.log(`[piping-contract] PASS ${name} (${(performance.now() - phaseStart).toFixed(1)} ms)`);
  } catch (error) {
    console.error(`[piping-contract] FAIL ${name} (${(performance.now() - phaseStart).toFixed(1)} ms)`);
    throw error;
  }
}

function syntheticSourceRecords() {
  return [
    record('SRC_PIPE_001', 'PIPE'),
    record('SRC_ELBOW_001', 'ELBOW'),
    record('SRC_TEE_001', 'TEE'),
    record('SRC_VALVE_001', 'VALVE'),
    record('SRC_FLANGE_001', 'FLANGE'),
    record('SRC_GUIDE_001', 'GUIDE'),
    record('SRC_UNKNOWN_001', 'UNKNOWN_COMPONENT')
  ];
}

function syntheticComponents() {
  return [
    component('PIPE_001', 'PIPE', 'PIPE', 'SRC_PIPE_001', {
      topology: { fromNode: '10', toNode: '20' },
      geometryKind: 'CYLINDER_BETWEEN_NODES'
    }),
    component('ELBOW_001', 'ELBOW', 'ELBOW_90', 'SRC_ELBOW_001', {
      topology: { ports: [port('A', '20'), port('B', '30')] },
      geometryKind: 'ELBOW_SWEEP'
    }),
    component('TEE_001', 'TEE', 'TEE_EQUAL', 'SRC_TEE_001', {
      topology: { ports: [port('MAIN_A', '30'), port('MAIN_B', '40'), port('BRANCH', '35')] },
      geometryKind: 'TEE_COMPOSITE'
    }),
    component('VALVE_001', 'VALVE', 'VALVE_UNKNOWN', 'SRC_VALVE_001', {
      topology: { fromNode: '40', toNode: '50' },
      geometryKind: 'VALVE_SYMBOLIC'
    }),
    component('FLANGE_001', 'FLANGE', 'FLANGE_UNKNOWN', 'SRC_FLANGE_001', {
      topology: { fromNode: '50', toNode: '60' },
      geometryKind: 'FLANGE_PAIR'
    }),
    component('GUIDE_001', 'RESTRAINT', 'GUIDE', 'SRC_GUIDE_001', {
      topology: { supportNode: '30' },
      geometryKind: 'RESTRAINT_SYMBOL'
    }),
    component('UNKNOWN_001', 'UNKNOWN', 'UNKNOWN_COMPONENT', 'SRC_UNKNOWN_001', {
      topology: {},
      geometryKind: 'UNKNOWN_PLACEHOLDER',
      rawKind: 'UNKNOWN_COMPONENT',
      fallbackAllowed: true
    })
  ];
}

function syntheticGeometryContracts() {
  return [
    geometry('GC_PIPE_001', 'PIPE_001', 'PIPE', 'CYLINDER_BETWEEN_NODES', {
      placement: { from: [0, 0, 0], to: [1000, 0, 0] },
      dimensions: { outerDiameter: 168.3 },
      ports: [contractPort('A', [0, 0, 0]), contractPort('B', [1000, 0, 0])]
    }),
    geometry('GC_ELBOW_001', 'ELBOW_001', 'ELBOW', 'ELBOW_SWEEP', {
      placement: { origin: [1000, 0, 0] },
      dimensions: { radius: 252.45, angleDeg: 90 },
      ports: [contractPort('IN', [1000, 0, 0]), contractPort('OUT', [1000, 1000, 0])]
    }),
    geometry('GC_TEE_001', 'TEE_001', 'TEE', 'TEE_COMPOSITE', {
      placement: { origin: [1000, 1000, 0] },
      dimensions: { mainDiameter: 168.3, branchDiameter: 114.3 },
      ports: [contractPort('MAIN_A', [1000, 0, 0]), contractPort('MAIN_B', [1000, 2000, 0]), contractPort('BRANCH', [1500, 1000, 0])]
    }),
    geometry('GC_VALVE_001', 'VALVE_001', 'VALVE', 'VALVE_SYMBOLIC', {
      placement: { origin: [1500, 1000, 0], axis: [1, 0, 0] },
      dimensions: { faceToFaceLength: 300, outerDiameter: 220 },
      ports: [contractPort('IN', [1350, 1000, 0]), contractPort('OUT', [1650, 1000, 0])]
    }),
    geometry('GC_FLANGE_001', 'FLANGE_001', 'FLANGE', 'FLANGE_PAIR', {
      placement: { origin: [1800, 1000, 0], axis: [1, 0, 0] },
      dimensions: { outerDiameter: 260, thickness: 24 },
      ports: [contractPort('FACE_A', [1788, 1000, 0]), contractPort('FACE_B', [1812, 1000, 0])]
    }),
    geometry('GC_GUIDE_001', 'GUIDE_001', 'RESTRAINT', 'RESTRAINT_SYMBOL', {
      placement: { anchorPoint: [1000, 1000, 0] },
      dimensions: { symbolScale: 1 },
      ports: [contractPort('SUPPORT_CONTACT', [1000, 1000, 0])]
    }),
    geometry('GC_UNKNOWN_001', 'UNKNOWN_001', 'UNKNOWN', 'UNKNOWN_PLACEHOLDER', {
      placement: { origin: [2000, 1000, 0] },
      dimensions: { size: 100 },
      ports: []
    }),
    geometry('GC_LEGACY_FALLBACK_001', 'PIPE_001', 'PIPE', 'FALLBACK_LEGACY', {
      placement: { origin: [0, 0, 0] },
      dimensions: {},
      ports: [],
      fallbackRendered: true,
      diagnostics: ['legacy InputXML renderer used only as fallback']
    })
  ];
}

function syntheticRenderInstructions() {
  return syntheticGeometryContracts().map((contract) => ({
    schemaVersion: 'RenderInstruction.v1',
    target: 'VIEWER',
    componentId: contract.componentId,
    geometryContractId: contract.geometryContractId,
    renderRecipeId: contract.renderRecipeId,
    materialRecipeId: `${contract.componentClass.toLowerCase()}-material`,
    userData: {
      objectRole: 'component-render',
      componentId: contract.componentId,
      componentClass: contract.componentClass,
      sourceRef: {
        sourceType: 'INPUTXML',
        sourceId: `${contract.componentId}_SOURCE`
      },
      geometryContractId: contract.geometryContractId,
      renderRecipeId: contract.renderRecipeId,
      fallbackRendered: contract.geometryKind === 'FALLBACK_LEGACY',
      ...(contract.geometryKind === 'FALLBACK_LEGACY' ? { fallbackReason: 'legacy InputXML fallback renderer' } : {})
    }
  }));
}

function record(sourceId, rawKind) {
  return { sourceType: 'INPUTXML', sourceId, rawKind };
}

function component(componentId, componentClass, componentType, sourceId, options = {}) {
  return {
    schemaVersion: 'PipingComponent.v1',
    componentId,
    componentClass,
    componentType,
    sourceRef: {
      sourceType: 'INPUTXML',
      sourceId,
      rawKind: options.rawKind || componentType
    },
    topology: options.topology || {},
    geometryIntent: {
      geometryKind: options.geometryKind
    },
    renderIntent: {
      renderRecipeId: `${componentClass.toLowerCase()}-${componentType.toLowerCase()}-recipe`,
      materialRecipeId: `${componentClass.toLowerCase()}-material`,
      fallbackAllowed: Boolean(options.fallbackAllowed)
    },
    metadata: {
      sourceId
    },
    diagnostics: []
  };
}

function port(portId, nodeId) {
  return { portId, nodeId };
}

function contractPort(portId, position) {
  return { portId, position };
}

function geometry(geometryContractId, componentId, componentClass, geometryKind, options = {}) {
  return {
    schemaVersion: 'GeometryContract.v1',
    geometryContractId,
    componentId,
    componentClass,
    geometryKind,
    placement: options.placement || {},
    dimensions: options.dimensions || {},
    ports: options.ports || [],
    renderRecipeId: `${geometryKind.toLowerCase()}-recipe`,
    selection: {
      selectable: true,
      selectionProxy: 'GROUP'
    },
    export: {
      includeInGlb: true,
      includeInRvm: true,
      includeInAtt: true
    },
    fallbackRendered: options.fallbackRendered,
    diagnostics: options.diagnostics || []
  };
}
