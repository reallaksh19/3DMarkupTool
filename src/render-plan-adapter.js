import {
  assertGeometryContract,
  assertRenderInstruction,
  PipingComponentContractError
} from './piping-component-contract.js';

export const RENDER_PLAN_SCHEMA = 'RenderPlan.v1';

export const RENDER_PRIMITIVE_KINDS = Object.freeze([
  'CYLINDER',
  'ELBOW_SWEEP_PRIMITIVE',
  'TEE_COMPOSITE_PRIMITIVE',
  'VALVE_SYMBOL',
  'FLANGE_PAIR_SYMBOL',
  'REDUCER_TRANSITION_PRIMITIVE',
  'RESTRAINT_SYMBOL_PRIMITIVE',
  'UNKNOWN_PLACEHOLDER_PRIMITIVE',
  'LEGACY_FALLBACK_REF'
]);

const RAW_SOURCE_BOUNDARY_KEYS = new Set([
  'sourceRecordKind',
  'record',
  'props',
  'rawKind',
  'rawType',
  'rawTypeCode',
  'inputXmlKind',
  'inputXmlTypeCode',
  'sourceXmlElement'
]);

export function buildRenderPlans(geometryContracts = [], renderInstructions = [], options = {}) {
  if (!Array.isArray(geometryContracts)) throw new TypeError('geometryContracts must be an array');
  if (!Array.isArray(renderInstructions)) throw new TypeError('renderInstructions must be an array');

  const contractsById = new Map();
  for (const contract of geometryContracts) {
    rejectRawSourcePayload(contract, 'GeometryContract');
    assertGeometryContract(contract, options.knownComponents || []);
    contractsById.set(contract.geometryContractId, contract);
  }

  return renderInstructions.map((instruction) => {
    rejectRawSourcePayload(instruction, 'RenderInstruction');
    assertRenderInstruction(instruction);

    const contract = contractsById.get(instruction.geometryContractId);
    if (!contract) {
      throw new PipingComponentContractError(
        {
          ok: false,
          schema: RENDER_PLAN_SCHEMA,
          errors: [{ path: '$.geometryContractId', message: `missing GeometryContract ${instruction.geometryContractId}`, code: 'plan.missingGeometryContract' }],
          warnings: []
        },
        'Render plan adapter contract failed'
      );
    }

    if (contract.componentId !== instruction.componentId) {
      throw new PipingComponentContractError(
        {
          ok: false,
          schema: RENDER_PLAN_SCHEMA,
          errors: [{ path: '$.componentId', message: `instruction componentId ${instruction.componentId} does not match contract componentId ${contract.componentId}`, code: 'plan.componentMismatch' }],
          warnings: []
        },
        'Render plan adapter contract failed'
      );
    }

    return buildRenderPlan(contract, instruction, options);
  });
}

export function buildRenderPlan(contract, instruction, options = {}) {
  rejectRawSourcePayload(contract, 'GeometryContract');
  rejectRawSourcePayload(instruction, 'RenderInstruction');
  assertGeometryContract(contract, options.knownComponents || []);
  assertRenderInstruction(instruction);

  if (contract.geometryContractId !== instruction.geometryContractId) {
    throw new PipingComponentContractError(
      {
        ok: false,
        schema: RENDER_PLAN_SCHEMA,
        errors: [{ path: '$.geometryContractId', message: 'GeometryContract and RenderInstruction IDs must match', code: 'plan.geometryContractMismatch' }],
        warnings: []
      },
      'Render plan adapter contract failed'
    );
  }

  const primitive = primitiveFromContract(contract, instruction);
  const fallbackRendered = primitive.primitiveKind === 'LEGACY_FALLBACK_REF';

  if (fallbackRendered && instruction.userData?.fallbackRendered !== true) {
    throw new PipingComponentContractError(
      {
        ok: false,
        schema: RENDER_PLAN_SCHEMA,
        errors: [{ path: '$.userData.fallbackRendered', message: 'FALLBACK_LEGACY contracts must be carried by explicit fallback render instructions', code: 'plan.fallbackFlag' }],
        warnings: []
      },
      'Render plan adapter contract failed'
    );
  }

  return {
    schemaVersion: RENDER_PLAN_SCHEMA,
    planId: `RP_${sanitizeId(instruction.target)}_${sanitizeId(contract.geometryContractId)}`,
    target: instruction.target,
    componentId: instruction.componentId,
    componentClass: contract.componentClass,
    geometryContractId: contract.geometryContractId,
    geometryKind: contract.geometryKind,
    renderRecipeId: instruction.renderRecipeId,
    materialRecipeId: instruction.materialRecipeId,
    primitive,
    userData: { ...instruction.userData },
    export: { ...(contract.export || {}) },
    diagnostics: [
      ...(Array.isArray(contract.diagnostics) ? contract.diagnostics : []),
      ...(fallbackRendered ? ['legacy fallback reference; no contract geometry generated'] : [])
    ]
  };
}

export function primitiveFromContract(contract, instruction = {}) {
  switch (contract.geometryKind) {
    case 'CYLINDER_BETWEEN_NODES':
      return {
        primitiveKind: 'CYLINDER',
        from: contract.placement.from,
        to: contract.placement.to,
        outerDiameter: contract.dimensions.outerDiameter,
        radius: contract.dimensions.radius || contract.dimensions.outerDiameter / 2
      };

    case 'ELBOW_SWEEP':
      return {
        primitiveKind: 'ELBOW_SWEEP_PRIMITIVE',
        origin: contract.placement.origin,
        radius: contract.dimensions.radius,
        angleDeg: contract.dimensions.angleDeg,
        ports: contract.ports
      };

    case 'TEE_COMPOSITE':
      return {
        primitiveKind: 'TEE_COMPOSITE_PRIMITIVE',
        origin: contract.placement.origin,
        mainDiameter: contract.dimensions.mainDiameter,
        branchDiameter: contract.dimensions.branchDiameter,
        ports: contract.ports
      };

    case 'VALVE_SYMBOLIC':
      return {
        primitiveKind: 'VALVE_SYMBOL',
        origin: contract.placement.origin,
        axis: contract.placement.axis,
        faceToFaceLength: contract.dimensions.faceToFaceLength,
        ports: contract.ports
      };

    case 'FLANGE_PAIR':
      return {
        primitiveKind: 'FLANGE_PAIR_SYMBOL',
        origin: contract.placement.origin,
        axis: contract.placement.axis,
        outerDiameter: contract.dimensions.outerDiameter,
        thickness: contract.dimensions.thickness,
        ports: contract.ports
      };

    case 'REDUCER_TRANSITION':
      return {
        primitiveKind: 'REDUCER_TRANSITION_PRIMITIVE',
        from: contract.placement.from,
        to: contract.placement.to,
        largeDiameter: contract.dimensions.largeDiameter,
        smallDiameter: contract.dimensions.smallDiameter,
        ports: contract.ports
      };

    case 'RESTRAINT_SYMBOL':
      return {
        primitiveKind: 'RESTRAINT_SYMBOL_PRIMITIVE',
        anchorPoint: contract.placement.anchorPoint,
        axis: contract.placement.axis,
        symbolScale: contract.dimensions.symbolScale,
        ports: contract.ports
      };

    case 'UNKNOWN_PLACEHOLDER':
      return {
        primitiveKind: 'UNKNOWN_PLACEHOLDER_PRIMITIVE',
        origin: contract.placement.origin,
        size: contract.dimensions.size,
        ports: contract.ports
      };

    case 'FALLBACK_LEGACY':
      return {
        primitiveKind: 'LEGACY_FALLBACK_REF',
        fallbackRendered: true,
        componentId: contract.componentId,
        geometryContractId: contract.geometryContractId,
        renderRecipeId: instruction.renderRecipeId || contract.renderRecipeId
      };

    default:
      throw new PipingComponentContractError(
        {
          ok: false,
          schema: RENDER_PLAN_SCHEMA,
          errors: [{ path: '$.geometryKind', message: `unsupported geometryKind ${contract.geometryKind}`, code: 'plan.unsupportedGeometryKind' }],
          warnings: []
        },
        'Render plan adapter contract failed'
      );
  }
}

export function rejectRawSourcePayload(value, label = 'render plan input') {
  const found = [];
  scanRawSourcePayload(value, '$', found);
  if (found.length) {
    throw new PipingComponentContractError(
      {
        ok: false,
        schema: RENDER_PLAN_SCHEMA,
        errors: found.map(({ path, key }) => ({ path, message: `${label} must not carry raw source field ${key}`, code: 'plan.rawSourceBoundary' })),
        warnings: []
      },
      'Render plan adapter contract failed'
    );
  }
  return true;
}

function scanRawSourcePayload(value, path, found) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanRawSourcePayload(entry, `${path}[${index}]`, found));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (RAW_SOURCE_BOUNDARY_KEYS.has(key)) found.push({ path: `${path}.${key}`, key });
    scanRawSourcePayload(entry, `${path}.${key}`, found);
  }
}

function sanitizeId(value) {
  return String(value || 'UNKNOWN').trim().replace(/[^A-Za-z0-9_:-]+/g, '_').replace(/:+/g, '_');
}
