import { validatePlantModelGraphContract } from '../../contracts/index.js';
import {
  auditManagedStageToPlantGraph,
  convertManagedStageJsonToPlantGraph
} from '../../importers/managed-stage-to-plant-graph.js';

export function importManagedStageAsPlantGraph(sourceText, options = {}) {
  const graph = convertManagedStageJsonToPlantGraph(sourceText, options);
  const validation = validatePlantModelGraphContract(graph);
  const audit = auditManagedStageToPlantGraph(sourceText, graph, options);
  return { graph, validation, audit };
}
