export const PIPING_COMPONENT_CONTRACT_SCHEMA = 'piping-component-contract/v1';

export const COMPONENT_CLASSES = Object.freeze([
  'PIPE',
  'ELBOW',
  'BEND',
  'TEE',
  'VALVE',
  'FLANGE',
  'REDUCER',
  'SUPPORT',
  'RESTRAINT',
  'UNKNOWN'
]);

export const RESTRAINT_TYPES = Object.freeze([
  'REST',
  'GUIDE',
  'LINESTOP',
  'LIMIT_STOP',
  'ANCHOR',
  'HANGER',
  'SPRING',
  'DIRECTIONAL_X',
  'DIRECTIONAL_Y',
  'DIRECTIONAL_Z',
  'UNKNOWN_RESTRAINT'
]);

export const GEOMETRY_KINDS = Object.freeze([
  'CYLINDER_BETWEEN_NODES',
  'ELBOW_SWEEP',
  'TEE_COMPOSITE',
  'VALVE_SYMBOLIC',
  'FLANGE_PAIR',
  'REDUCER_TRANSITION',
  'RESTRAINT_SYMBOL',
  'UNKNOWN_PLACEHOLDER',
  'FALLBACK_LEGACY'
]);

export const RENDER_TARGETS = Object.freeze(['VIEWER', 'GLB', 'RVM_ATT']);

const COMPONENT_CLASS_SET = new Set(COMPONENT_CLASSES);
const RESTRAINT_TYPE_SET = new Set(RESTRAINT_TYPES);
const GEOMETRY_KIND_SET = new Set(GEOMETRY_KINDS);
const RENDER_TARGET_SET = new Set(RENDER_TARGETS);
const UNKNOWN_SOURCE_RE = /(?:^|[^A-Z0-9])(UNKNOWN|UNRESOLVED|UNMAPPED)(?:[^A-Z0-9]|$)/i;
const DELEGATED_TO_LEGACY_RENDERER = 'DELEGATED_TO_LEGACY_RENDERER';
const DISALLOWED_RENDER_KEYS = new Set([
  'rawKind',
  'rawType',
  'rawTypeCode',
  'inputXmlKind',
  'inputXmlTypeCode',
  'sourceXmlElement'
]);

export class PipingComponentContractError extends Error {
  constructor(report, message = 'Piping component contract validation failed') {
    super(`${message}: ${formatIssues(report.errors)}`);
    this.name = 'PipingComponentContractError';
    this.report = report;
  }
}

export function validatePipingComponent(component, options = {}) {
  const report = createReport('PipingComponent.v1');

  if (!isPlainObject(component)) {
    addError(report, '$', 'component must be an object', 'component.object');
    return report;
  }

  assertEqual(report, '$.schemaVersion', component.schemaVersion, 'PipingComponent.v1');
  assertNonEmptyString(report, '$.componentId', component.componentId);
  assertEnum(report, '$.componentClass', component.componentClass, COMPONENT_CLASS_SET);
  assertNonEmptyString(report, '$.componentType', component.componentType);

  validateSourceRef(report, component.sourceRef, '$.sourceRef');

  if (!isPlainObject(component.topology)) addError(report, '$.topology', 'topology must be an object', 'component.topology');
  if (!isPlainObject(component.geometryIntent)) addError(report, '$.geometryIntent', 'geometryIntent must be an object', 'component.geometryIntent');

  if (!isPlainObject(component.renderIntent)) {
    addError(report, '$.renderIntent', 'renderIntent must be an object', 'component.renderIntent');
  } else {
    assertNonEmptyString(report, '$.renderIntent.renderRecipeId', component.renderIntent.renderRecipeId);
    if (typeof component.renderIntent.fallbackAllowed !== 'boolean') {
      addError(report, '$.renderIntent.fallbackAllowed', 'fallbackAllowed must be explicit boolean', 'component.fallbackAllowed');
    }
  }

  if (!isPlainObject(component.metadata)) addError(report, '$.metadata', 'metadata must be an object', 'component.metadata');
  if (!Array.isArray(component.diagnostics)) addError(report, '$.diagnostics', 'diagnostics must be an array', 'component.diagnostics');

  validateComponentTopology(report, component);
  validateUnknownSourcePolicy(report, component);

  if (component.componentClass === 'RESTRAINT') {
    const type = normalizeType(component.componentType);
    if (!RESTRAINT_TYPE_SET.has(type)) {
      addError(
        report,
        '$.componentType',
        `RESTRAINT componentType must be one of ${RESTRAINT_TYPES.join(', ')}`,
        'restraint.type'
      );
    }
  }

  if (component.componentClass === 'UNKNOWN' && component.renderIntent?.fallbackAllowed !== true) {
    addWarning(report, '$.renderIntent.fallbackAllowed', 'UNKNOWN components should explicitly allow fallback or provide UNKNOWN_PLACEHOLDER geometry', 'unknown.fallback');
  }

  if (options.strictGeometryKind && component.geometryIntent?.geometryKind) {
    assertEnum(report, '$.geometryIntent.geometryKind', component.geometryIntent.geometryKind, GEOMETRY_KIND_SET);
  }

  return finalize(report);
}

export function assertPipingComponent(component, options = {}) {
  const report = validatePipingComponent(component, options);
  if (!report.ok) throw new PipingComponentContractError(report);
  return report;
}

export function validateComponentMapping(sourceRecords, components) {
  const report = createReport('SourceRecordâ†’PipingComponent mapping');

  if (!Array.isArray(sourceRecords)) {
    addError(report, '$.sourceRecords', 'sourceRecords must be an array', 'mapping.sourceRecords');
    return finalize(report);
  }
  if (!Array.isArray(components)) {
    addError(report, '$.components', 'components must be an array', 'mapping.components');
    return finalize(report);
  }

  const sourceIds = new Set();
  for (const [index, record] of sourceRecords.entries()) {
    if (!record || !record.sourceId) {
      addError(report, `$.sourceRecords[${index}].sourceId`, 'source record requires sourceId', 'source.sourceId');
      continue;
    }
    sourceIds.add(String(record.sourceId));
  }

  const componentIds = new Set();
  const mappedSourceIds = new Set();
  for (const [index, component] of components.entries()) {
    const componentReport = validatePipingComponent(component);
    mergeChildReport(report, componentReport, `$.components[${index}]`);

    if (component?.componentId) {
      if (componentIds.has(component.componentId)) {
        addError(report, `$.components[${index}].componentId`, `duplicate componentId ${component.componentId}`, 'component.duplicateId');
      }
      componentIds.add(component.componentId);
    }

    const sourceId = component?.sourceRef?.sourceId;
    if (sourceId) mappedSourceIds.add(String(sourceId));
  }

  for (const sourceId of sourceIds) {
    if (!mappedSourceIds.has(sourceId)) {
      addError(report, '$.components', `source record ${sourceId} was not mapped to a component`, 'mapping.droppedSource');
    }
  }

  return finalize(report);
}

export function assertComponentMapping(sourceRecords, components) {
  const report = validateComponentMapping(sourceRecords, components);
  if (!report.ok) throw new PipingComponentContractError(report, 'Source/component mapping contract failed');
  return report;
}

export function validateGeometryContract(contract, knownComponents = []) {
  const report = createReport('GeometryContract.v1');

  if (!isPlainObject(contract)) {
    addError(report, '$', 'geometry contract must be an object', 'geometry.object');
    return report;
  }

  assertEqual(report, '$.schemaVersion', contract.schemaVersion, 'GeometryContract.v1');
  assertNonEmptyString(report, '$.geometryContractId', contract.geometryContractId);
  assertNonEmptyString(report, '$.componentId', contract.componentId);
  assertEnum(report, '$.componentClass', contract.componentClass, COMPONENT_CLASS_SET);
  assertEnum(report, '$.geometryKind', contract.geometryKind, GEOMETRY_KIND_SET);
  assertNonEmptyString(report, '$.renderRecipeId', contract.renderRecipeId);

  if (!isPlainObject(contract.placement)) addError(report, '$.placement', 'placement must be an object', 'geometry.placement');
  if (!isPlainObject(contract.dimensions)) addError(report, '$.dimensions', 'dimensions must be an object', 'geometry.dimensions');
  if (!Array.isArray(contract.ports)) addError(report, '$.ports', 'ports must be an array', 'geometry.ports');
  if (!Array.isArray(contract.diagnostics)) addError(report, '$.diagnostics', 'diagnostics must be an array', 'geometry.diagnostics');

  const knownIds = new Set(knownComponents.map((component) => component.componentId));
  if (knownIds.size && contract.componentId && !knownIds.has(contract.componentId)) {
    addError(report, '$.componentId', `componentId ${contract.componentId} is not present in known components`, 'geometry.unknownComponent');
  }

  validateDimensions(report, contract.dimensions || {}, '$.dimensions');
  validateGeometryKindSpecifics(report, contract);
  validateSelection(report, contract.selection, '$.selection');
  validateExportFlags(report, contract.export, '$.export');

  return finalize(report);
}

export function assertGeometryContract(contract, knownComponents = []) {
  const report = validateGeometryContract(contract, knownComponents);
  if (!report.ok) throw new PipingComponentContractError(report, 'Geometry contract validation failed');
  return report;
}

export function validateRenderInstruction(instruction) {
  const report = createReport('RenderInstruction.v1');

  if (!isPlainObject(instruction)) {
    addError(report, '$', 'render instruction must be an object', 'render.object');
    return report;
  }

  assertEqual(report, '$.schemaVersion', instruction.schemaVersion, 'RenderInstruction.v1');
  assertEnum(report, '$.target', instruction.target, RENDER_TARGET_SET);
  assertNonEmptyString(report, '$.componentId', instruction.componentId);
  assertNonEmptyString(report, '$.geometryContractId', instruction.geometryContractId);
  assertNonEmptyString(report, '$.renderRecipeId', instruction.renderRecipeId);
  assertNonEmptyString(report, '$.materialRecipeId', instruction.materialRecipeId);
  scanDisallowedRendererKeys(report, instruction, '$');

  const userData = instruction.userData;
  if (!isPlainObject(userData)) {
    addError(report, '$.userData', 'userData must be an object', 'render.userData');
  } else {
    assertEqual(report, '$.userData.objectRole', userData.objectRole, 'component-render');
    assertEqual(report, '$.userData.componentId', userData.componentId, instruction.componentId);
    assertEnum(report, '$.userData.componentClass', userData.componentClass, COMPONENT_CLASS_SET);
    validateSourceRef(report, userData.sourceRef, '$.userData.sourceRef', { renderUserData: true });
    assertEqual(report, '$.userData.geometryContractId', userData.geometryContractId, instruction.geometryContractId);
    assertEqual(report, '$.userData.renderRecipeId', userData.renderRecipeId, instruction.renderRecipeId);
    if (typeof userData.fallbackRendered !== 'boolean') {
      addError(report, '$.userData.fallbackRendered', 'fallbackRendered must be explicit boolean', 'render.fallbackRendered');
    }
    if (userData.fallbackRendered && !userData.fallbackReason) {
      addError(report, '$.userData.fallbackReason', 'fallback render requires a non-empty fallbackReason', 'render.fallbackReason');
    }
  }

  return finalize(report);
}

export function assertRenderInstruction(instruction) {
  const report = validateRenderInstruction(instruction);
  if (!report.ok) throw new PipingComponentContractError(report, 'Render instruction validation failed');
  return report;
}

export function buildContractDiagnostics(sourceRecords = [], components = [], geometryContracts = [], renderInstructions = []) {
  const componentIdsWithContracts = new Set(geometryContracts.map((contract) => contract.componentId));
  const componentsByClass = countBy(components, (component) => component.componentClass || 'UNRESOLVED');
  const contractsByGeometryKind = countBy(geometryContracts, (contract) => contract.geometryKind || 'UNRESOLVED');
  const restraintsByKind = countBy(
    components.filter((component) => component.componentClass === 'RESTRAINT' || component.componentClass === 'SUPPORT'),
    (component) => normalizeType(component.componentType || 'UNRESOLVED')
  );

  return {
    schema: `${PIPING_COMPONENT_CONTRACT_SCHEMA}/diagnostics`,
    sourceRecordsTotal: sourceRecords.length,
    componentsTotal: components.length,
    componentsByClass,
    unknownComponents: components.filter((component) => component.componentClass === 'UNKNOWN' || /^UNKNOWN/.test(normalizeType(component.componentType))).length,
    restraintsByKind,
    geometryContractsTotal: geometryContracts.length,
    contractsByGeometryKind,
    fallbackRendered: renderInstructions.filter((instruction) => instruction.userData?.fallbackRendered === true).length,
    unrenderableComponents: components.filter((component) => !componentIdsWithContracts.has(component.componentId)).map((component) => component.componentId)
  };
}

function validateComponentTopology(report, component) {
  const topology = component.topology || {};
  const componentClass = component.componentClass;

  if (componentClass === 'PIPE') {
    if (!topology.fromNode || !topology.toNode) {
      addError(report, '$.topology', 'PIPE requires fromNode and toNode', 'topology.pipePorts');
    }
  }

  if (componentClass === 'ELBOW' || componentClass === 'BEND') {
    if (isDelegatedLegacyTopology(component)) return;
    const hasPorts = Array.isArray(topology.ports) && topology.ports.length >= 2;
    if (!hasPorts && !(topology.inNode && topology.outNode)) {
      addError(report, '$.topology', 'ELBOW/BEND requires explicit contract ports or delegated legacy fallback topology', 'topology.elbowPorts');
    }
  }

  if (componentClass === 'TEE') {
    if (isDelegatedLegacyTopology(component)) return;
    const hasThreePorts = Array.isArray(topology.ports) && topology.ports.length >= 3;
    if (!hasThreePorts) {
      addError(report, '$.topology.ports', 'TEE requires explicit contract ports or delegated legacy fallback topology', 'topology.teePorts');
    }
  }
}

function isDelegatedLegacyTopology(component) {
  return component.topology?.topologyStatus === DELEGATED_TO_LEGACY_RENDERER
    && component.geometryIntent?.geometryKind === 'FALLBACK_LEGACY'
    && component.renderIntent?.fallbackAllowed === true;
}

function validateUnknownSourcePolicy(report, component) {
  const rawText = [
    component.sourceRef?.rawKind,
    component.sourceRef?.rawType,
    component.sourceRef?.rawTypeCode,
    component.metadata?.rawKind,
    component.metadata?.rawTypeCode
  ].filter(Boolean).join(' ');

  if (!UNKNOWN_SOURCE_RE.test(rawText)) return;

  const componentType = normalizeType(component.componentType);
  const allowedUnknown = component.componentClass === 'UNKNOWN' || componentType === 'UNKNOWN_RESTRAINT';
  if (!allowedUnknown) {
    addError(report, '$.componentClass', 'unknown/unresolved source records must remain UNKNOWN or UNKNOWN_RESTRAINT', 'unknown.silentConversion');
  }
}

function validateGeometryKindSpecifics(report, contract) {
  const placement = contract.placement || {};
  const dimensions = contract.dimensions || {};
  const ports = Array.isArray(contract.ports) ? contract.ports : [];

  switch (contract.geometryKind) {
    case 'CYLINDER_BETWEEN_NODES':
      assertVector3(report, '$.placement.from', placement.from);
      assertVector3(report, '$.placement.to', placement.to);
      if (isVector3(placement.from) && isVector3(placement.to) && samePoint(placement.from, placement.to)) {
        addError(report, '$.placement.to', 'CYLINDER_BETWEEN_NODES cannot have zero length', 'geometry.zeroLength');
      }
      if (!isPositiveNumber(dimensions.outerDiameter) && !isPositiveNumber(dimensions.radius)) {
        addError(report, '$.dimensions.outerDiameter', 'pipe cylinder requires positive outerDiameter or radius', 'geometry.pipeDiameter');
      }
      break;

    case 'ELBOW_SWEEP':
      assertPositiveNumber(report, '$.dimensions.radius', dimensions.radius);
      assertPositiveNumber(report, '$.dimensions.angleDeg', dimensions.angleDeg);
      if (Number.isFinite(dimensions.angleDeg) && dimensions.angleDeg > 180) {
        addError(report, '$.dimensions.angleDeg', 'ELBOW_SWEEP angleDeg must be <= 180', 'geometry.elbowAngle');
      }
      if (ports.length < 2) addError(report, '$.ports', 'ELBOW_SWEEP requires at least two ports', 'geometry.elbowPorts');
      break;

    case 'TEE_COMPOSITE':
      if (ports.length < 3) addError(report, '$.ports', 'TEE_COMPOSITE requires at least three ports', 'geometry.teePorts');
      break;

    case 'VALVE_SYMBOLIC':
      assertVector3(report, '$.placement.origin', placement.origin);
      if (!isPositiveNumber(dimensions.length) && !isPositiveNumber(dimensions.faceToFaceLength)) {
        addError(report, '$.dimensions.length', 'VALVE_SYMBOLIC requires positive length or faceToFaceLength', 'geometry.valveLength');
      }
      break;

    case 'FLANGE_PAIR':
      assertVector3(report, '$.placement.origin', placement.origin);
      assertPositiveNumber(report, '$.dimensions.outerDiameter', dimensions.outerDiameter);
      break;

    case 'REDUCER_TRANSITION':
      assertVector3(report, '$.placement.from', placement.from);
      assertVector3(report, '$.placement.to', placement.to);
      assertPositiveNumber(report, '$.dimensions.largeDiameter', dimensions.largeDiameter);
      assertPositiveNumber(report, '$.dimensions.smallDiameter', dimensions.smallDiameter);
      break;

    case 'RESTRAINT_SYMBOL':
      if (!isVector3(placement.origin) && !isVector3(placement.anchorPoint)) {
        addError(report, '$.placement', 'RESTRAINT_SYMBOL requires origin or anchorPoint', 'geometry.restraintAnchor');
      }
      assertPositiveNumber(report, '$.dimensions.symbolScale', dimensions.symbolScale);
      break;

    case 'UNKNOWN_PLACEHOLDER':
      assertPositiveNumber(report, '$.dimensions.size', dimensions.size);
      break;

    case 'FALLBACK_LEGACY':
      if (contract.fallbackRendered !== true) addError(report, '$.fallbackRendered', 'FALLBACK_LEGACY requires fallbackRendered=true', 'geometry.fallbackFlag');
      if (!Array.isArray(contract.diagnostics) || contract.diagnostics.length === 0) {
        addError(report, '$.diagnostics', 'FALLBACK_LEGACY requires diagnostic reason', 'geometry.fallbackReason');
      }
      break;
  }
}

function validateSelection(report, selection, path) {
  if (!isPlainObject(selection)) {
    addError(report, path, 'selection must be an object', 'geometry.selection');
    return;
  }
  if (typeof selection.selectable !== 'boolean') addError(report, `${path}.selectable`, 'selectable must be boolean', 'geometry.selectable');
  assertEnum(report, `${path}.selectionProxy`, selection.selectionProxy, new Set(['GROUP', 'MESH', 'BOUNDS']));
}

function validateExportFlags(report, exportFlags, path) {
  if (!isPlainObject(exportFlags)) {
    addError(report, path, 'export must be an object', 'geometry.export');
    return;
  }
  for (const key of ['includeInGlb', 'includeInRvm', 'includeInAtt']) {
    if (typeof exportFlags[key] !== 'boolean') addError(report, `${path}.${key}`, `${key} must be boolean`, 'geometry.exportFlag');
  }
}

function validateDimensions(report, dimensions, path) {
  for (const [key, value] of Object.entries(dimensions)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      addError(report, `${path}.${key}`, 'dimension values must be finite numbers', 'geometry.dimensionFinite');
    }
  }
}

function validateSourceRef(report, sourceRef, path, options = {}) {
  if (!isPlainObject(sourceRef)) {
    addError(report, path, 'sourceRef must be an object', 'sourceRef.object');
    return;
  }
  assertNonEmptyString(report, `${path}.sourceType`, sourceRef.sourceType);
  assertNonEmptyString(report, `${path}.sourceId`, sourceRef.sourceId);

  if (options.renderUserData) {
    for (const key of Object.keys(sourceRef)) {
      if (DISALLOWED_RENDER_KEYS.has(key)) {
        addError(report, `${path}.${key}`, `render userData sourceRef must not carry raw renderer decision key ${key}`, 'render.rawSourceKey');
      }
    }
  }
}

function scanDisallowedRendererKeys(report, value, path) {
  if (!isPlainObject(value) && !Array.isArray(value)) return;
  if (path.endsWith('.sourceRef')) return;

  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanDisallowedRendererKeys(report, entry, `${path}[${index}]`));
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (DISALLOWED_RENDER_KEYS.has(key)) {
      addError(report, childPath, `renderer instructions must not branch on raw source key ${key}`, 'render.rawSourceKey');
    }
    scanDisallowedRendererKeys(report, entry, childPath);
  }
}

function createReport(scope) {
  return { schema: PIPING_COMPONENT_CONTRACT_SCHEMA, scope, ok: true, errors: [], warnings: [] };
}

function addError(report, path, message, code) {
  report.ok = false;
  report.errors.push({ path, message, code });
}

function addWarning(report, path, message, code) {
  report.warnings.push({ path, message, code });
}

function finalize(report) {
  report.ok = report.errors.length === 0;
  return report;
}

function mergeChildReport(report, childReport, prefix) {
  for (const issue of childReport.errors) addError(report, `${prefix}${issue.path.slice(1)}`, issue.message, issue.code);
  for (const issue of childReport.warnings) addWarning(report, `${prefix}${issue.path.slice(1)}`, issue.message, issue.code);
}

function assertEqual(report, path, actual, expected) {
  if (actual !== expected) addError(report, path, `expected ${expected}, got ${actual}`, 'contract.expectedValue');
}

function assertNonEmptyString(report, path, value) {
  if (typeof value !== 'string' || value.trim() === '') addError(report, path, 'expected non-empty string', 'contract.nonEmptyString');
}

function assertEnum(report, path, value, allowed) {
  if (!allowed.has(value)) addError(report, path, `unsupported value ${value}`, 'contract.enum');
}

function assertVector3(report, path, value) {
  if (!isVector3(value)) addError(report, path, 'expected finite [x,y,z] vector', 'contract.vector3');
}

function assertPositiveNumber(report, path, value) {
  if (!isPositiveNumber(value)) addError(report, path, 'expected positive finite number', 'contract.positiveNumber');
}

function isVector3(value) {
  return Array.isArray(value) && value.length === 3 && value.every((entry) => typeof entry === 'number' && Number.isFinite(entry));
}

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function samePoint(a, b) {
  return a.length === b.length && a.every((entry, index) => entry === b[index]);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeType(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function countBy(items, getKey) {
  const counts = {};
  for (const item of items) {
    const key = getKey(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function formatIssues(issues) {
  if (!issues?.length) return 'no issues';
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ');
}
