import { buildManagedStageSupportRvmExportNodes } from './managed-stage-support-rvm-export.js';
import { resolveManagedStageSupportTopologyGate, summarizeManagedStageSupportTopologyGates } from './managed-stage-topology-gated-support-preview.js';

export const MANAGED_STAGE_TOPOLOGY_GATED_SUPPORT_RVM_SCHEMA = 'ManagedStageTopologyGatedSupportRvmExport.v1';

export function buildTopologyGatedManagedStageSupportRvmExportNodes(profile, options = {}) {
  const base = buildManagedStageSupportRvmExportNodes(profile, options);
  const topologyAudit = options.topologyAudit || null;
  const gates = [];
  const supportRecords = profile?.supportRecords || [];
  const nodes = [];
  const supportWarnings = [...(base.supportWarnings || [])];

  base.nodes.forEach((node, index) => {
    const record = supportRecords[index] || null;
    const gate = resolveManagedStageSupportTopologyGate(record, topologyAudit);
    gates.push(gate);
    const blocked = gate.status !== 'ok' || gate.associationOnly !== true;
    const patchedNode = {
      ...node,
      attributes: {
        ...(node.attributes || {}),
        SUPPORT_TOPOLOGY_GATE: gate.status,
        SUPPORT_TOPOLOGY_ASSOCIATION_ONLY: gate.associationOnly ? 'TRUE' : 'FALSE',
        SUPPORT_TOPOLOGY_COMPONENT_ID: gate.componentId || '',
        SUPPORT_TOPOLOGY_ANCHOR_ID: gate.supportAnchorId || '',
        SUPPORT_TOPOLOGY_SEGMENT_ID: gate.segmentId || '',
        SUPPORT_CONTINUITY_EDGE_BLOCKED: Number(gate.supportContinuityEdgeCount || 0) === 0 ? 'TRUE' : 'FALSE',
        SUPPORT_INLINE_FACE_BLOCKED: Number(gate.supportInlineFaceCount || 0) === 0 ? 'TRUE' : 'FALSE'
      },
      supportTopologyGate: gate,
      primitives: blocked ? [] : (node.primitives || []).map((primitive) => ({
        ...primitive,
        supportTopologyGate: gate.status,
        supportTopologyAssociationOnly: gate.associationOnly === true,
        supportTopologyComponentId: gate.componentId,
        supportTopologyAnchorId: gate.supportAnchorId,
        supportTopologySegmentId: gate.segmentId,
        supportContinuityEdgeBlocked: Number(gate.supportContinuityEdgeCount || 0) === 0,
        supportInlineFaceBlocked: Number(gate.supportInlineFaceCount || 0) === 0
      }))
    };
    if (blocked) {
      supportWarnings.push({
        code: 'SUPPORT_RVM_EXPORT_TOPOLOGY_GATE_BLOCKED',
        support: node.name,
        reason: gate.reason,
        gate
      });
    }
    nodes.push(patchedNode);
  });

  const gateSummary = summarizeManagedStageSupportTopologyGates(gates);
  const supportPrimitiveCount = nodes.reduce((sum, node) => sum + (node.primitives?.length || 0), 0);
  const supportDirectionalGlyphPrimitiveCount = nodes.reduce((sum, node) => sum + (node.primitives || []).filter((primitive) => primitive.supportDirectionalGlyphBar === true).length, 0);
  const supportBarPrimitiveCount = nodes.reduce((sum, node) => sum + (node.primitives || []).filter((primitive) => primitive.supportBar === true).length, 0);
  const connectorPrimitiveCount = nodes.reduce((sum, node) => sum + (node.primitives || []).filter((primitive) => primitive.supportClusterConnector === true).length, 0);
  const fallbackPrimitiveCount = nodes.reduce((sum, node) => sum + (node.primitives || []).filter((primitive) => primitive.supportFallbackCrossRod === true).length, 0);
  const warningPrimitiveCount = nodes.reduce((sum, node) => sum + (node.primitives || []).filter((primitive) => primitive.supportWarningMarker === true).length, 0);

  return {
    ...base,
    schema: MANAGED_STAGE_TOPOLOGY_GATED_SUPPORT_RVM_SCHEMA,
    supportPrimitiveCount,
    supportDirectionalGlyphPrimitiveCount,
    supportBarPrimitiveCount,
    connectorPrimitiveCount,
    fallbackPrimitiveCount,
    warningPrimitiveCount,
    topologyAuditSchema: topologyAudit?.schema || '',
    supportTopologyGateSummary: gateSummary,
    supportTopologyGatePass: gateSummary.pass,
    supportTopologyBlockedCount: gateSummary.blockedCount,
    supportAssociationOnlyCount: gateSummary.associationOnlyCount,
    supportContinuityEdgeCount: gateSummary.supportContinuityEdgeCount,
    supportInlineFaceCount: gateSummary.supportInlineFaceCount,
    supportWarnings,
    nodes,
    policy: 'managed-stage support RVM export is topology-gated: support records must resolve to SUPPORT_ASSOCIATION-only topology with zero support continuity edges before code-8 cylinder bar glyphs only are emitted as compact support glyphs'
  };
}
