import {
  ALLOWED_RVM_PRIMITIVE_KINDS,
  isRvmPrimitiveKindSupported,
  rvmPrimitiveKindCompatibilityReport
} from './rvm-primitive-kind-contract.js?v=bust-cache-4';

/**
 * Validates the renderer-neutral export tree before Navisworks RVM/ATT serialization.
 * Parameters: export model produced by buildRvmExportModel and optional validation settings.
 * Output: deterministic contract report with counts, warnings, and fatal errors.
 * Fallback: assertNavisExportModel raises a compact error before invalid geometry reaches the writers.
 */

const SAFE_NAVIS_NAME = /^[A-Za-z0-9_]+$/;
const REQUIRED_TOP_LEVEL_GROUPS = ['PLANT_GEOMETRY', 'SUPPORTS_RESTRAINTS', 'ANNOTATIONS'];

export class NavisExportContractError extends Error {
  constructor(report) {
    const preview = report.errors.slice(0, 8).map((issue) => `${issue.path}: ${issue.message}`).join('; ');
    super(`Navis export contract failed with ${report.errors.length} error(s)${preview ? `: ${preview}` : ''}`);
    this.name = 'NavisExportContractError';
    this.report = report;
    this.errors = report.errors;
    this.warnings = report.warnings;
  }
}

export function assertNavisExportModel(exportModel, options = {}) {
  const report = validateNavisExportModel(exportModel, options);
  if (report.errors.length) {
    throw new NavisExportContractError(report);
  }
  return report;
}

export function validateNavisExportModel(exportModel, options = {}) {
  const primitiveCompatibility = rvmPrimitiveKindCompatibilityReport();
  const report = {
    ok: true,
    targetViewer: 'Navisworks Simulate',
    schema: 'navis-rvm-att-contract/v1',
    sourceKind: options.sourceKind || exportModel?.root?.attributes?.SOURCE || 'UNKNOWN',
    counts: {
      nodes: 0,
      primitives: 0,
      attributes: 0,
      byPrimitiveKind: {},
      byTopLevelGroup: {}
    },
    att: {
      sameBaseNameRequired: true,
      nodeBlockCount: 0,
      safeNodeNames: true
    },
    rvm: {
      allowedPrimitiveKinds: [...ALLOWED_RVM_PRIMITIVE_KINDS].sort(),
      primitiveKindPolicy: primitiveCompatibility.policy,
      rhbgObservedPrimitiveCodes: primitiveCompatibility.rhbgObservedPrimitiveCodes,
      rhbgObservedCodesNotEmitted: primitiveCompatibility.rhbgObservedCodesNotEmitted,
      allTransformsFinite: true,
      allDimensionsPositive: true
    },
    warnings: [],
    errors: []
  };

  const nodeNames = new Set();
  const primitiveNames = new Set();

  if (!exportModel || typeof exportModel !== 'object') {
    addError(report, '$', 'export model must be an object');
    return finish(report);
  }

  if (!exportModel.root || typeof exportModel.root !== 'object') {
    addError(report, '$.root', 'root node is required');
    return finish(report);
  }

  validateNode(exportModel.root, '$.root', 0, report, nodeNames, primitiveNames);
  validateTopLevelGroups(exportModel.root, report);
  validateAudit(exportModel, report);

  report.att.nodeBlockCount = report.counts.nodes;
  return finish(report);
}

function validateNode(node, path, depth, report, nodeNames, primitiveNames) {
  report.counts.nodes += 1;

  if (!isSafeName(node.name)) {
    addError(report, `${path}.name`, `node name must be Navis/ATT safe: ${String(node.name || '')}`);
    report.att.safeNodeNames = false;
  }

  if (nodeNames.has(node.name)) {
    addError(report, `${path}.name`, `duplicate node name: ${node.name}`);
  }
  nodeNames.add(node.name);

  if (!Number.isFinite(Number(node.material))) {
    addWarning(report, `${path}.material`, 'material is not a finite numeric palette id');
  }

  validateAttributes(node.attributes || {}, `${path}.attributes`, report);

  const primitives = Array.isArray(node.primitives) ? node.primitives : [];
  if (!Array.isArray(node.primitives)) {
    addError(report, `${path}.primitives`, 'primitives must be an array');
  }

  for (let index = 0; index < primitives.length; index += 1) {
    validatePrimitive(primitives[index], `${path}.primitives[${index}]`, report, primitiveNames);
  }

  const children = Array.isArray(node.children) ? node.children : [];
  if (!Array.isArray(node.children)) {
    addError(report, `${path}.children`, 'children must be an array');
  }

  for (let index = 0; index < children.length; index += 1) {
    validateNode(children[index], `${path}.children[${index}]`, depth + 1, report, nodeNames, primitiveNames);
  }
}

function validateAttributes(attributes, path, report) {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
    addError(report, path, 'attributes must be an object');
    return;
  }

  for (const [key, value] of Object.entries(attributes)) {
    report.counts.attributes += 1;
    if (!isSafeAttributeKey(key)) {
      addError(report, `${path}.${key}`, `attribute key must be ATT safe: ${key}`);
    }
    if (value && typeof value === 'object') {
      addError(report, `${path}.${key}`, 'attribute value must be scalar before ATT export');
    }
  }
}

function validatePrimitive(primitive, path, report, primitiveNames) {
  report.counts.primitives += 1;

  if (!primitive || typeof primitive !== 'object') {
    addError(report, path, 'primitive must be an object');
    return;
  }

  if (!isSafeName(primitive.name)) {
    addError(report, `${path}.name`, `primitive name must be Navis safe: ${String(primitive.name || '')}`);
  }

  if (primitiveNames.has(primitive.name)) {
    addWarning(report, `${path}.name`, `duplicate primitive name: ${primitive.name}`);
  }
  primitiveNames.add(primitive.name);

  if (!isRvmPrimitiveKindSupported(primitive.kind)) {
    addError(report, `${path}.kind`, `unsupported primitive kind: ${String(primitive.kind)}`);
    return;
  }

  report.counts.byPrimitiveKind[primitive.kind] = (report.counts.byPrimitiveKind[primitive.kind] || 0) + 1;

  validateVector3(primitive.center, `${path}.center`, report);
  if (primitive.direction) validateDirection(primitive.direction, `${path}.direction`, report);

  if (!Number.isFinite(Number(primitive.material))) {
    addWarning(report, `${path}.material`, 'primitive material is not a finite numeric palette id');
  }

  if (primitive.kind === 'cylinder') {
    validatePositive(primitive.radius, `${path}.radius`, report);
    validatePositive(primitive.length, `${path}.length`, report);
  } else if (primitive.kind === 'sphere') {
    validatePositive(primitive.diameter, `${path}.diameter`, report);
  } else if (primitive.kind === 'box') {
    validatePositiveArray(primitive.lengths, 3, `${path}.lengths`, report);
  } else if (primitive.kind === 'pyramid') {
    validatePositiveArray(primitive.bottom, 2, `${path}.bottom`, report);
    validatePositiveArray(primitive.top, 2, `${path}.top`, report);
    validateFiniteArray(primitive.offset, 2, `${path}.offset`, report);
    validatePositive(primitive.height, `${path}.height`, report);
  }
}

function validateTopLevelGroups(root, report) {
  const children = Array.isArray(root.children) ? root.children : [];
  for (const child of children) {
    if (child?.name) report.counts.byTopLevelGroup[child.name] = countNodeTree(child);
  }
  for (const name of REQUIRED_TOP_LEVEL_GROUPS) {
    if (!children.some((child) => child?.name === name)) {
      addError(report, `$.root.children.${name}`, `required top-level group missing: ${name}`);
    }
  }
}

function validateAudit(exportModel, report) {
  const audit = exportModel.audit || {};
  if (Number.isFinite(Number(audit.primitiveCount)) && Number(audit.primitiveCount) !== report.counts.primitives) {
    addError(report, '$.audit.primitiveCount', `audit primitiveCount ${audit.primitiveCount} does not match tree count ${report.counts.primitives}`);
  }
  if (audit.targetViewer && !String(audit.targetViewer).toLowerCase().includes('navis')) {
    addError(report, '$.audit.targetViewer', `target viewer must be Navisworks-oriented: ${audit.targetViewer}`);
  }
}

function countNodeTree(node) {
  return 1 + (Array.isArray(node.children) ? node.children.reduce((sum, child) => sum + countNodeTree(child), 0) : 0);
}

function validateVector3(value, path, report) {
  if (!Array.isArray(value) || value.length !== 3) {
    addError(report, path, 'expected [x, y, z]');
    report.rvm.allTransformsFinite = false;
    return;
  }
  if (value.some((entry) => !Number.isFinite(Number(entry)))) {
    addError(report, path, 'contains non-finite coordinate');
    report.rvm.allTransformsFinite = false;
  }
}

function validateDirection(value, path, report) {
  validateVector3(value, path, report);
  if (!Array.isArray(value) || value.length !== 3) return;
  const length = Math.hypot(Number(value[0]), Number(value[1]), Number(value[2]));
  if (!Number.isFinite(length) || length <= 1e-12) {
    addError(report, path, 'direction must be non-zero');
    report.rvm.allTransformsFinite = false;
  }
}

function validatePositive(value, path, report) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    addError(report, path, 'expected positive finite number');
    report.rvm.allDimensionsPositive = false;
  }
}

function validatePositiveArray(value, length, path, report) {
  validateFiniteArray(value, length, path, report);
  if (!Array.isArray(value) || value.length !== length) return;
  for (const entry of value) validatePositive(entry, path, report);
}

function validateFiniteArray(value, length, path, report) {
  if (!Array.isArray(value) || value.length !== length) {
    addError(report, path, `expected array length ${length}`);
    report.rvm.allTransformsFinite = false;
    return;
  }
  if (value.some((entry) => !Number.isFinite(Number(entry)))) {
    addError(report, path, 'contains non-finite value');
    report.rvm.allTransformsFinite = false;
  }
}

function isSafeName(value) {
  return SAFE_NAVIS_NAME.test(String(value || ''));
}

function isSafeAttributeKey(value) {
  return /^[A-Za-z0-9_]+$/.test(String(value || ''));
}

function addError(report, path, message) {
  report.errors.push({ path, message });
}

function addWarning(report, path, message) {
  report.warnings.push({ path, message });
}

function finish(report) {
  report.ok = report.errors.length === 0;
  return report;
}
