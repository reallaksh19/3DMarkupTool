import assert from 'node:assert/strict';
import { createBmCiiManagedStageSampleJson } from '../src/managed-stage-bm-cii-json-sample-data.js';
import { assertManagedStageTopologyQualityGate } from '../src/managed-stage-topology-quality-gate.js';
import {
  MANAGED_STAGE_TOPOLOGY_AUDIT_SCHEMA,
  MANAGED_STAGE_UXML_TOPOLOGY_SCHEMA,
  buildManagedStageFaceModel,
  buildManagedStageTopologyAudit,
  buildManagedStageUniversalTopoGraph,
  buildManagedStageUxmlTopologyDocument,
  validateManagedStageUxmlTopologyDocument
} from '../src/managed-stage-uxml-topology-adapter.js';

const sourceText = createBmCiiManagedStageSampleJson();
const doc = buildManagedStageUxmlTopologyDocument(sourceText, { sourceName: 'BM_CII_INPUT_managed_stage.json' });

assert.equal(doc.schema, MANAGED_STAGE_UXML_TOPOLOGY_SCHEMA);
assert.equal(doc.sourceKind, 'stagedJson');
assert.equal(doc.components.length, 52);
assert.equal(doc.components.filter((component) => component.normalizedType !== 'SUPPORT').length, 40);
assert.equal(doc.components.filter((component) => component.normalizedType === 'SUPPORT').length, 12);
assert.equal(doc.supports.length, 12);
assert.equal(doc.segments.length, 52);

const bendComponents = doc.components.filter((component) => component.normalizedType === 'BEND');
assert.equal(bendComponents.length, 7);
for (const bend of bendComponents) {
  assert.equal(bend.derived.centerlineKind, 'arc');
  assert.equal(bend.derived.synthetic1p5DTrimBlocked, true);
  assert.ok(bend.derived.bendRadiusMm > 0, `${bend.id} should carry bend radius`);
  assert.ok(bend.derived.bendAngleDeg > 0, `${bend.id} should carry bend angle`);
}

const supportComponents = doc.components.filter((component) => component.normalizedType === 'SUPPORT');
for (const support of supportComponents) {
  const supportPorts = doc.ports.filter((port) => port.componentId === support.id);
  assert.equal(supportPorts.length, 1);
  assert.equal(supportPorts[0].connectsTo, 'SEGMENT');
}

const validation = validateManagedStageUxmlTopologyDocument(doc);
assert.equal(validation.ready, true, JSON.stringify(validation.diagnostics, null, 2));
assert.equal(validation.sections.bendDetails.ok, true);
assert.equal(validation.sections.supportContinuity.supportContinuityPortCount, 0);

const faceModel = buildManagedStageFaceModel(doc);
assert.equal(faceModel.ok, true, JSON.stringify(faceModel.diagnostics, null, 2));
assert.equal(faceModel.summary.supportInlineFaceCount, 0);
assert.equal(faceModel.summary.supportAssociationFaceCount, 12);

const graph = buildManagedStageUniversalTopoGraph(doc, { faceModel });
assert.equal(graph.summary.supportContinuityEdgeCount, 0);
assert.ok(graph.summary.nodeCount > 0);
assert.ok(graph.summary.edgeCount > 0);
assert.equal(graph.edges.some((edge) => edge.sourceComponentId.includes('MSS') || edge.targetComponentId.includes('MSS')), false);

const audit = buildManagedStageTopologyAudit(sourceText, { sourceName: 'BM_CII_INPUT_managed_stage.json' });
assert.equal(audit.schema, MANAGED_STAGE_TOPOLOGY_AUDIT_SCHEMA);
assert.equal(audit.summary.componentCount, 52);
assert.equal(audit.summary.geometryComponentCount, 40);
assert.equal(audit.summary.supportCount, 12);
assert.equal(audit.summary.explicitBendRecordCount, 7);
assert.equal(audit.summary.explicitBendDetailCount, 7);
assert.equal(audit.summary.missingExplicitBendDetailCount, 0);
assert.equal(audit.summary.synthetic1p5DTrimBlockedCount, 7);
assert.equal(audit.summary.supportContinuityEdgeCount, 0);

const qualityGate = assertManagedStageTopologyQualityGate(audit);
assert.equal(qualityGate.ok, true);
assert.equal(qualityGate.internalDisconnectedRequiredPortCount, 0);
assert.equal(qualityGate.supportContinuityEdgeCount, 0);
assert.equal(qualityGate.supportInlineFaceCount, 0);
assert.equal(qualityGate.highDegreeTopologyNodeCount, 0);
assert.equal(qualityGate.nodeCoordinateConflictCount, 0);
assert.equal(qualityGate.invalidBranchNodeDegreeCount, 0);
assert.ok(qualityGate.classifiedOpenTerminalPortCount > 0);
assert.equal(qualityGate.classifiedOpenTerminalPortCount + qualityGate.internalDisconnectedRequiredPortCount, qualityGate.disconnectedRequiredPortCount);

console.log(JSON.stringify({
  schema: audit.schema,
  qualityGateSchema: qualityGate.schema,
  ok: audit.ok,
  qualityGateOk: qualityGate.ok,
  components: audit.summary.componentCount,
  geometryComponents: audit.summary.geometryComponentCount,
  supports: audit.summary.supportCount,
  explicitBendRecordCount: audit.summary.explicitBendRecordCount,
  explicitBendDetailCount: audit.summary.explicitBendDetailCount,
  nodeCount: audit.summary.nodeCount,
  edgeCount: audit.summary.edgeCount,
  disconnectedRequiredPortCount: audit.summary.disconnectedRequiredPortCount,
  classifiedOpenTerminalPortCount: qualityGate.classifiedOpenTerminalPortCount,
  internalDisconnectedRequiredPortCount: qualityGate.internalDisconnectedRequiredPortCount,
  highDegreeTopologyNodeCount: qualityGate.highDegreeTopologyNodeCount,
  nodeCoordinateConflictCount: qualityGate.nodeCoordinateConflictCount,
  invalidBranchNodeDegreeCount: qualityGate.invalidBranchNodeDegreeCount,
  supportContinuityEdgeCount: audit.summary.supportContinuityEdgeCount
}, null, 2));
