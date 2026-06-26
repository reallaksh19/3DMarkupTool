export const MANAGED_STAGE_TOPOLOGY_QUALITY_GATE_SCHEMA = 'ManagedStageTopologyQualityGate.v1';

const DEFAULT_MAX_NODE_DEGREE = 12;
const DEFAULT_MAX_BRANCH_NODE_DEGREE = 4;

export function assertManagedStageTopologyQualityGate(topologyAudit = {}, options = {}) {
  const gate = buildManagedStageTopologyQualityGate(topologyAudit, options);
  if (!gate.ok) {
    const error = new Error(`Managed-stage topology quality gate failed: ${gate.issues.join('; ')}`);
    error.gate = gate;
    throw error;
  }
  return gate;
}

export function buildManagedStageTopologyQualityGate(topologyAudit = {}, options = {}) {
  const graph = topologyAudit.universalGraph || {};
  const faceSummary = topologyAudit.faceModel?.summary || {};
  const graphSummary = graph.summary || {};
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const ports = Array.isArray(graph.ports) ? graph.ports : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const disconnected = Array.isArray(graph.disconnected) ? graph.disconnected : [];
  const maxNodeDegree = numberOr(options.maxNodeDegree, DEFAULT_MAX_NODE_DEGREE);
  const maxBranchNodeDegree = numberOr(options.maxBranchNodeDegree, DEFAULT_MAX_BRANCH_NODE_DEGREE);
  const toleranceMm = numberOr(graph.config?.connectToleranceMm, 0.001);
  const portById = new Map(ports.map((port) => [port.id, port]));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const terminalPorts = [];
  const internalDisconnectedPorts = [];
  for (const item of disconnected) {
    const port = portById.get(item.portId) || null;
    const node = port ? nodeById.get(port.nodeId) : null;
    const row = {
      ...item,
      nodeId: node?.id || port?.nodeId || '',
      nodePortCount: node?.portIds?.length || 0,
      terminalClassification: node?.portIds?.length === 1 ? 'OPEN_TERMINAL' : 'INTERNAL_DISCONNECT'
    };
    if (row.terminalClassification === 'OPEN_TERMINAL') terminalPorts.push(row);
    else internalDisconnectedPorts.push(row);
  }

  const highDegreeNodes = nodes
    .map((node) => ({ nodeId: node.id, portCount: node.portIds?.length || 0, componentCount: node.componentIds?.length || 0 }))
    .filter((node) => node.portCount > maxNodeDegree);

  const branchNodes = nodes
    .map((node) => ({ node, nodePorts: (node.portIds || []).map((id) => portById.get(id)).filter(Boolean) }))
    .filter(({ nodePorts }) => nodePorts.length >= 3);
  const invalidBranchNodes = branchNodes
    .map(({ node, nodePorts }) => ({ nodeId: node.id, portCount: nodePorts.length, roles: nodePorts.map((port) => port.role), componentIds: nodePorts.map((port) => port.componentId) }))
    .filter((node) => node.portCount > maxBranchNodeDegree);

  const duplicateComponentNodes = nodes
    .map((node) => {
      const componentIds = (node.portIds || []).map((id) => portById.get(id)?.componentId).filter(Boolean);
      const duplicateComponentIds = [...new Set(componentIds.filter((id, index) => componentIds.indexOf(id) !== index))];
      return { nodeId: node.id, duplicateComponentIds };
    })
    .filter((item) => item.duplicateComponentIds.length > 0);

  const coordinateDriftNodes = nodes
    .map((node) => {
      const driftPortIds = (node.portIds || []).filter((id) => {
        const port = portById.get(id);
        return port && distance(node.point, port.point) > toleranceMm;
      });
      return { nodeId: node.id, driftPortIds };
    })
    .filter((item) => item.driftPortIds.length > 0);

  const supportContinuityEdges = edges.filter((edge) => String(edge.sourceComponentId || '').includes('MSS') || String(edge.targetComponentId || '').includes('MSS'));
  const supportInlineFaceCount = Number(faceSummary.supportInlineFaceCount || 0);
  const supportContinuityEdgeCount = Number(graphSummary.supportContinuityEdgeCount || supportContinuityEdges.length || 0);
  const nodeCoordinateConflictCount = duplicateComponentNodes.length + coordinateDriftNodes.length;
  const issues = [];

  if (!topologyAudit.schema) issues.push('topology audit schema missing');
  if (!graph.schema) issues.push('universal topology graph schema missing');
  if (internalDisconnectedPorts.length) issues.push(`internal disconnected required ports: expected 0, got ${internalDisconnectedPorts.length}`);
  if (supportContinuityEdgeCount) issues.push(`support continuity edges: expected 0, got ${supportContinuityEdgeCount}`);
  if (supportInlineFaceCount) issues.push(`support inline faces: expected 0, got ${supportInlineFaceCount}`);
  if (highDegreeNodes.length) issues.push(`high-degree topology nodes: expected 0, got ${highDegreeNodes.length}`);
  if (nodeCoordinateConflictCount) issues.push(`node coordinate conflicts: expected 0, got ${nodeCoordinateConflictCount}`);
  if (invalidBranchNodes.length) issues.push(`invalid branch node degrees: expected 0, got ${invalidBranchNodes.length}`);

  return {
    schema: MANAGED_STAGE_TOPOLOGY_QUALITY_GATE_SCHEMA,
    ok: issues.length === 0,
    topologyAuditSchema: topologyAudit.schema || '',
    universalGraphSchema: graph.schema || '',
    universalGraphOk: graph.ok === true,
    classifiedOpenTerminalPortCount: terminalPorts.length,
    internalDisconnectedRequiredPortCount: internalDisconnectedPorts.length,
    disconnectedRequiredPortCount: disconnected.length,
    supportContinuityEdgeCount,
    supportInlineFaceCount,
    highDegreeTopologyNodeCount: highDegreeNodes.length,
    nodeCoordinateConflictCount,
    duplicateComponentNodeCount: duplicateComponentNodes.length,
    coordinateDriftNodeCount: coordinateDriftNodes.length,
    branchNodeCount: branchNodes.length,
    invalidBranchNodeDegreeCount: invalidBranchNodes.length,
    maxNodeDegree,
    maxBranchNodeDegree,
    terminalPorts,
    internalDisconnectedPorts,
    highDegreeNodes,
    invalidBranchNodes,
    duplicateComponentNodes,
    coordinateDriftNodes,
    issues
  };
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function distance(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.hypot(Number(a[0]) - Number(b[0]), Number(a[1]) - Number(b[1]), Number(a[2]) - Number(b[2]));
}
