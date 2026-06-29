import { PLANT_MODEL_GRAPH_SCHEMA } from './platform-contract-schemas.js';

export function validatePlantModelGraphContract(graph) {
  const errors = [];
  if (!graph || typeof graph !== 'object') errors.push('graph must be an object');
  if (graph?.schema !== PLANT_MODEL_GRAPH_SCHEMA) errors.push(`schema must be ${PLANT_MODEL_GRAPH_SCHEMA}`);
  if (!graph?.project || typeof graph.project !== 'object') errors.push('project object is required');
  if (!graph?.project?.units) errors.push('project.units is required');
  if (!Array.isArray(graph?.nodes)) errors.push('nodes array is required');
  if (!Array.isArray(graph?.routes)) errors.push('routes array is required');
  if (!Array.isArray(graph?.items)) errors.push('items array is required');

  const nodeIds = new Set();
  for (const [index, node] of (graph?.nodes || []).entries()) {
    if (!node?.id) errors.push(`nodes[${index}].id is required`);
    if (node?.id) nodeIds.add(String(node.id));
    if (!isPoint3(node?.coord)) errors.push(`nodes[${index}].coord must be [x,y,z]`);
  }

  const routeIds = new Set();
  for (const [index, route] of (graph?.routes || []).entries()) {
    if (!route?.id) errors.push(`routes[${index}].id is required`);
    if (route?.id) routeIds.add(String(route.id));
    if (!nodeIds.has(String(route?.from))) errors.push(`routes[${index}].from must reference a node`);
    if (!nodeIds.has(String(route?.to))) errors.push(`routes[${index}].to must reference a node`);
  }

  for (const [index, item] of (graph?.items || []).entries()) {
    if (!item?.id) errors.push(`items[${index}].id is required`);
    if (!item?.kind) errors.push(`items[${index}].kind is required`);
    if (item?.catalogueRef && !item.catalogueRef.catalogue) errors.push(`items[${index}].catalogueRef.catalogue is required when catalogueRef is present`);
    if (item?.route && !routeIds.has(String(item.route))) errors.push(`items[${index}].route must reference a route when present`);
  }

  return {
    schema: 'PlantModelGraphValidation.v1',
    ok: errors.length === 0,
    errorCount: errors.length,
    errors
  };
}

export function assertPlantModelGraphContract(graph) {
  const result = validatePlantModelGraphContract(graph);
  if (!result.ok) throw new Error(`PlantModelGraph contract invalid: ${result.errors.join('; ')}`);
  return result;
}

function isPoint3(value) {
  return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry)));
}
