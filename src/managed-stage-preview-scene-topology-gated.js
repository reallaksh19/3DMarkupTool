import { createManagedStagePreviewScene as createExplicitBendPreviewScene } from './managed-stage-preview-scene-explicit-bend-v2.js';
import { buildManagedStageTopologyAudit } from './managed-stage-uxml-topology-adapter.js';
import {
  resolveManagedStageSupportTopologyGate,
  summarizeManagedStageSupportTopologyGates
} from './managed-stage-topology-gated-support-preview.js';

export const MANAGED_STAGE_TOPOLOGY_GATED_PREVIEW_SCHEMA = 'ManagedStageTopologyGatedPreview.v1';

export function createManagedStagePreviewScene(sourceTextOrJson, options = {}) {
  const topologyAudit = options.topologyAudit || buildManagedStageTopologyAudit(sourceTextOrJson, {
    sourceName: options.sourceName,
    connectToleranceMm: options.connectToleranceMm
  });
  const scene = createExplicitBendPreviewScene(sourceTextOrJson, { ...options, topologyAudit });
  const gates = patchSupportPreviewTopologyGates(scene, topologyAudit);
  const gateSummary = summarizeManagedStageSupportTopologyGates(gates);
  const audit = scene?.userData?.managedStageCoordinateAudit;

  if (audit) {
    audit.planningPipeline = 'raw-staged-preview-with-explicit-bend-and-topology-gated-support-symbols';
    audit.topologyAuditSchema = topologyAudit.schema;
    audit.topologyAuditOk = topologyAudit.ok === true;
    audit.topologySummary = topologyAudit.summary;
    audit.supportTopologyGateSummary = gateSummary;
    audit.supportTopologyGatePass = gateSummary.pass;
    audit.supportAssociationOnlyCount = gateSummary.associationOnlyCount;
    audit.supportTopologyBlockedCount = gateSummary.blockedCount;
    audit.supportContinuityEdgeCount = gateSummary.supportContinuityEdgeCount;
    audit.supportInlineFaceCount = gateSummary.supportInlineFaceCount;
    audit.supportSymbolTopologyPolicy = 'Support symbols are valid only when the stagedJson topology audit proves SUPPORT_ASSOCIATION-only behavior and zero support continuity edges.';
  }

  scene.userData = {
    ...(scene.userData || {}),
    previewTopologyGateSchema: MANAGED_STAGE_TOPOLOGY_GATED_PREVIEW_SCHEMA,
    managedStageTopologyAudit: topologyAudit,
    managedStageSupportTopologyGateSummary: gateSummary,
    managedStageSupportTopologyGatePass: gateSummary.pass,
    coordinatePolicy: 'explicit BEND source truth plus topology-gated support symbols; supports remain association-only and excluded from pipe continuity'
  };

  return scene;
}

function patchSupportPreviewTopologyGates(scene, topologyAudit) {
  const gates = [];
  scene?.traverse?.((object) => {
    if (object?.userData?.TYPE !== 'MANAGED_STAGE_SUPPORT_RESTRAINT_PREVIEW') return;
    if (object.userData.supportTopologyGateStatus) return;
    const gate = resolveManagedStageSupportTopologyGate(object.userData, topologyAudit);
    gates.push(gate);
    object.userData = {
      ...(object.userData || {}),
      supportTopologyGate: gate,
      supportTopologyGateStatus: gate.status,
      supportTopologyAssociationOnly: gate.associationOnly === true,
      supportTopologySupportComponentId: gate.componentId,
      supportTopologySupportAnchorId: gate.supportAnchorId,
      supportTopologySupportSegmentId: gate.segmentId,
      supportContinuityEdgeBlocked: Number(gate.supportContinuityEdgeCount || 0) === 0,
      supportInlineFaceBlocked: Number(gate.supportInlineFaceCount || 0) === 0,
      supportPreviewTopologyBlocked: gate.status === 'blocked',
      coordinatePolicy: gate.status === 'ok'
        ? 'topology-gated support symbol; support is association-only and excluded from pipe continuity'
        : 'support symbol requires review because topology association gate did not pass'
    };
    object.traverse?.((part) => {
      part.userData = {
        ...(part.userData || {}),
        supportTopologyGateStatus: gate.status,
        supportTopologyAssociationOnly: gate.associationOnly === true,
        supportContinuityEdgeBlocked: Number(gate.supportContinuityEdgeCount || 0) === 0,
        supportInlineFaceBlocked: Number(gate.supportInlineFaceCount || 0) === 0,
        supportPreviewTopologyBlocked: gate.status === 'blocked'
      };
    });
  });
  return gates;
}
