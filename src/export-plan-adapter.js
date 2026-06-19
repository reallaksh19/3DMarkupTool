import {
  RENDER_PLAN_SCHEMA,
  rejectRawSourcePayload
} from './render-plan-adapter.js';
import { PipingComponentContractError } from './piping-component-contract.js';

export const EXPORT_PLAN_SCHEMA = 'ExportPlan.v1';
export const EXPORT_TARGETS = Object.freeze(['GLB', 'RVM_ATT']);

export function buildExportPlans(renderPlans = [], options = {}) {
  if (!Array.isArray(renderPlans)) throw new TypeError('renderPlans must be an array');
  const targets = normalizeTargets(options.targets || EXPORT_TARGETS);
  return targets.map((target) => buildExportPlan(renderPlans, { ...options, target }));
}

export function buildExportPlan(renderPlans = [], options = {}) {
  if (!Array.isArray(renderPlans)) throw new TypeError('renderPlans must be an array');
  const target = normalizeTarget(options.target || 'GLB');
  const includeFallback = options.includeFallback !== false;
  const sourcePlans = renderPlans
    .map((plan) => assertRenderPlanForExport(plan))
    .filter((plan) => plan.target === target)
    .filter((plan) => includeFallback || plan.primitive?.primitiveKind !== 'LEGACY_FALLBACK_REF');

  if (target === 'GLB') return buildGlbExportPlan(sourcePlans, options);
  if (target === 'RVM_ATT') return buildRvmAttExportPlan(sourcePlans, options);
  throw exportPlanError('$.target', `unsupported export target ${target}`, 'export.unsupportedTarget');
}

export function buildGlbExportPlan(renderPlans = [], options = {}) {
  const nodes = renderPlans.map((plan, index) => ({
    nodeId: `GLB_NODE_${index + 1}_${sanitizeId(plan.componentId)}`,
    componentId: plan.componentId,
    componentClass: plan.componentClass,
    geometryContractId: plan.geometryContractId,
    renderRecipeId: plan.renderRecipeId,
    primitiveKind: plan.primitive.primitiveKind,
    primitive: cloneSerializable(plan.primitive),
    extras: buildStableExportMetadata(plan),
    fallbackRendered: plan.userData?.fallbackRendered === true
  }));

  return {
    schemaVersion: EXPORT_PLAN_SCHEMA,
    target: 'GLB',
    artifactKind: 'GLB_DESCRIPTOR_PLAN',
    writerStatus: options.writerStatus || 'PLANNED_CONTRACT_BOUNDARY',
    counts: countExportPlans(renderPlans),
    nodes,
    diagnostics: buildExportDiagnostics(renderPlans, 'GLB')
  };
}

export function buildRvmAttExportPlan(renderPlans = [], options = {}) {
  const primitives = renderPlans.map((plan, index) => ({
    entityId: `RVM_ENTITY_${index + 1}_${sanitizeId(plan.componentId)}`,
    componentId: plan.componentId,
    componentClass: plan.componentClass,
    geometryContractId: plan.geometryContractId,
    renderRecipeId: plan.renderRecipeId,
    primitiveKind: plan.primitive.primitiveKind,
    primitive: cloneSerializable(plan.primitive),
    fallbackRendered: plan.userData?.fallbackRendered === true
  }));

  const attRows = renderPlans.map((plan, index) => ({
    entityId: primitives[index].entityId,
    componentId: plan.componentId,
    componentClass: plan.componentClass,
    geometryContractId: plan.geometryContractId,
    renderRecipeId: plan.renderRecipeId,
    primitiveKind: plan.primitive.primitiveKind,
    sourceRef: cloneSerializable(plan.userData?.sourceRef || {}),
    fallbackRendered: plan.userData?.fallbackRendered === true,
    metadata: buildStableExportMetadata(plan)
  }));

  return {
    schemaVersion: EXPORT_PLAN_SCHEMA,
    target: 'RVM_ATT',
    artifactKind: 'RVM_ATT_DESCRIPTOR_PLAN',
    writerStatus: options.writerStatus || 'PLANNED_CONTRACT_BOUNDARY',
    counts: countExportPlans(renderPlans),
    rvmPrimitives: primitives,
    attRows,
    diagnostics: buildExportDiagnostics(renderPlans, 'RVM_ATT')
  };
}

export function assertExportPlan(plan) {
  const errors = [];
  if (!isPlainObject(plan)) {
    throw exportPlanError('$', 'export plan must be an object', 'export.object');
  }
  rejectRawSourcePayload(plan, 'ExportPlan');
  if (plan.schemaVersion !== EXPORT_PLAN_SCHEMA) errors.push(issue('$.schemaVersion', `expected ${EXPORT_PLAN_SCHEMA}`, 'export.schema'));
  if (!EXPORT_TARGETS.includes(plan.target)) errors.push(issue('$.target', `unsupported export target ${plan.target}`, 'export.target'));
  if (!plan.artifactKind || typeof plan.artifactKind !== 'string') errors.push(issue('$.artifactKind', 'artifactKind must be a non-empty string', 'export.artifactKind'));
  if (!isPlainObject(plan.counts)) errors.push(issue('$.counts', 'counts must be an object', 'export.counts'));
  if (!Array.isArray(plan.diagnostics)) errors.push(issue('$.diagnostics', 'diagnostics must be an array', 'export.diagnostics'));

  if (plan.target === 'GLB') {
    if (!Array.isArray(plan.nodes)) errors.push(issue('$.nodes', 'GLB export plan requires nodes array', 'export.glbNodes'));
    else plan.nodes.forEach((node, index) => validateExportEntity(node, `$.nodes[${index}]`, errors));
  }

  if (plan.target === 'RVM_ATT') {
    if (!Array.isArray(plan.rvmPrimitives)) errors.push(issue('$.rvmPrimitives', 'RVM export plan requires rvmPrimitives array', 'export.rvmPrimitives'));
    else plan.rvmPrimitives.forEach((primitive, index) => validateExportEntity(primitive, `$.rvmPrimitives[${index}]`, errors));
    if (!Array.isArray(plan.attRows)) errors.push(issue('$.attRows', 'RVM_ATT export plan requires attRows array', 'export.attRows'));
    else plan.attRows.forEach((row, index) => validateAttRow(row, `$.attRows[${index}]`, errors));
  }

  if (errors.length) {
    throw new PipingComponentContractError(
      { ok: false, schema: EXPORT_PLAN_SCHEMA, errors, warnings: [] },
      'Export plan contract failed'
    );
  }
  return true;
}

export function assertRenderPlanForExport(plan) {
  if (!isPlainObject(plan)) throw exportPlanError('$', 'render plan must be an object', 'export.renderPlanObject');
  rejectRawSourcePayload(plan, 'RenderPlan export input');
  const errors = [];
  if (plan.schemaVersion !== RENDER_PLAN_SCHEMA) errors.push(issue('$.schemaVersion', `expected ${RENDER_PLAN_SCHEMA}`, 'export.renderPlanSchema'));
  if (!EXPORT_TARGETS.includes(plan.target)) errors.push(issue('$.target', `render plan target must be exportable (${EXPORT_TARGETS.join(', ')})`, 'export.renderPlanTarget'));
  for (const key of ['planId', 'componentId', 'componentClass', 'geometryContractId', 'renderRecipeId']) {
    if (typeof plan[key] !== 'string' || !plan[key]) errors.push(issue(`$.${key}`, `${key} must be a non-empty string`, 'export.renderPlanKey'));
  }
  if (!isPlainObject(plan.primitive) || typeof plan.primitive.primitiveKind !== 'string') {
    errors.push(issue('$.primitive.primitiveKind', 'render plan requires primitiveKind', 'export.primitiveKind'));
  }
  validateStableUserData(plan.userData, '$.userData', plan, errors);

  if (errors.length) {
    throw new PipingComponentContractError(
      { ok: false, schema: EXPORT_PLAN_SCHEMA, errors, warnings: [] },
      'Render plan export boundary failed'
    );
  }
  return plan;
}

export function buildStableExportMetadata(plan) {
  assertRenderPlanForExport(plan);
  return Object.freeze({
    objectRole: 'component-render',
    componentId: plan.componentId,
    componentClass: plan.componentClass,
    sourceRef: cloneSerializable(plan.userData.sourceRef),
    geometryContractId: plan.geometryContractId,
    renderRecipeId: plan.renderRecipeId,
    fallbackRendered: plan.userData.fallbackRendered === true,
    fallbackReason: plan.userData.fallbackReason || null
  });
}

function buildExportDiagnostics(renderPlans, target) {
  const fallbackCount = renderPlans.filter((plan) => plan.primitive?.primitiveKind === 'LEGACY_FALLBACK_REF' || plan.userData?.fallbackRendered === true).length;
  const diagnostics = [`${target} export plan consumed ${renderPlans.length} RenderPlan.v1 records`];
  if (fallbackCount) diagnostics.push(`${fallbackCount} fallback render plans carried as explicit references`);
  return diagnostics;
}

function countExportPlans(renderPlans) {
  const byPrimitiveKind = {};
  const byComponentClass = {};
  for (const plan of renderPlans) {
    const primitiveKind = plan.primitive?.primitiveKind || 'UNKNOWN_PRIMITIVE';
    byPrimitiveKind[primitiveKind] = (byPrimitiveKind[primitiveKind] || 0) + 1;
    byComponentClass[plan.componentClass] = (byComponentClass[plan.componentClass] || 0) + 1;
  }
  return {
    renderPlansTotal: renderPlans.length,
    fallbackRendered: renderPlans.filter((plan) => plan.userData?.fallbackRendered === true).length,
    byPrimitiveKind,
    byComponentClass
  };
}

function validateStableUserData(userData, path, plan, errors) {
  if (!isPlainObject(userData)) {
    errors.push(issue(path, 'userData must be an object', 'export.userData'));
    return;
  }
  if (userData.objectRole !== 'component-render') errors.push(issue(`${path}.objectRole`, 'objectRole must be component-render', 'export.objectRole'));
  if (userData.componentId !== plan.componentId) errors.push(issue(`${path}.componentId`, 'componentId must match render plan', 'export.componentId'));
  if (userData.componentClass !== plan.componentClass) errors.push(issue(`${path}.componentClass`, 'componentClass must match render plan', 'export.componentClass'));
  if (userData.geometryContractId !== plan.geometryContractId) errors.push(issue(`${path}.geometryContractId`, 'geometryContractId must match render plan', 'export.geometryContractId'));
  if (userData.renderRecipeId !== plan.renderRecipeId) errors.push(issue(`${path}.renderRecipeId`, 'renderRecipeId must match render plan', 'export.renderRecipeId'));
  if (typeof userData.fallbackRendered !== 'boolean') errors.push(issue(`${path}.fallbackRendered`, 'fallbackRendered must be explicit boolean', 'export.fallbackRendered'));
  if (userData.fallbackRendered && !userData.fallbackReason) errors.push(issue(`${path}.fallbackReason`, 'fallback exports require fallbackReason', 'export.fallbackReason'));
  if (!isPlainObject(userData.sourceRef)) errors.push(issue(`${path}.sourceRef`, 'sourceRef must be an object', 'export.sourceRef'));
}

function validateExportEntity(entity, path, errors) {
  if (!isPlainObject(entity)) {
    errors.push(issue(path, 'export entity must be an object', 'export.entity'));
    return;
  }
  for (const key of ['componentId', 'componentClass', 'geometryContractId', 'renderRecipeId', 'primitiveKind']) {
    if (typeof entity[key] !== 'string' || !entity[key]) errors.push(issue(`${path}.${key}`, `${key} must be a non-empty string`, 'export.entityKey'));
  }
  if (typeof entity.fallbackRendered !== 'boolean') errors.push(issue(`${path}.fallbackRendered`, 'fallbackRendered must be boolean', 'export.entityFallback'));
}

function validateAttRow(row, path, errors) {
  validateExportEntity(row, path, errors);
  if (!isPlainObject(row.sourceRef)) errors.push(issue(`${path}.sourceRef`, 'ATT row sourceRef must be an object', 'export.attSourceRef'));
  if (!isPlainObject(row.metadata)) errors.push(issue(`${path}.metadata`, 'ATT row metadata must be an object', 'export.attMetadata'));
}

function normalizeTargets(targets) {
  const list = Array.isArray(targets) ? targets : [targets];
  return list.map(normalizeTarget);
}

function normalizeTarget(target) {
  if (!EXPORT_TARGETS.includes(target)) throw exportPlanError('$.target', `unsupported export target ${target}`, 'export.unsupportedTarget');
  return target;
}

function exportPlanError(path, message, code) {
  return new PipingComponentContractError(
    { ok: false, schema: EXPORT_PLAN_SCHEMA, errors: [issue(path, message, code)], warnings: [] },
    'Export plan contract failed'
  );
}

function issue(path, message, code) {
  return { path, message, code };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneSerializable(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function sanitizeId(value) {
  return String(value || 'UNKNOWN').trim().replace(/[^A-Za-z0-9_:-]+/g, '_').replace(/:+/g, '_');
}
