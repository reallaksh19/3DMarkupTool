import { buildEndpointLockedCylinderPrimitive } from './rvm-cylinder-primitive-builder.js?v=bust-cache-4';
import { buildManagedStageSupportRvmExportNodes } from './managed-stage-support-rvm-export.js?v=bust-cache-4';
import { resolveManagedStageSupportTopologyGate, summarizeManagedStageSupportTopologyGates } from './managed-stage-topology-gated-support-preview.js?v=bust-cache-4';

export const MANAGED_STAGE_TOPOLOGY_GATED_SUPPORT_RVM_SCHEMA = 'ManagedStageTopologyGatedSupportRvmExport.v2';
export const MANAGED_STAGE_SUPPORT_COMPLETENESS_AUDIT_SCHEMA = 'ManagedStageSupportCompletenessAudit.v1';

const NODE_205 = '205';
const EXACT_AXIS_FAMILY_RE = /^[+-]?[XYZ]$/;
const SUPPORT_CODE8_CYLINDER = 8;

export function buildTopologyGatedManagedStageSupportRvmExportNodes(profile, options = {}) {
  const base = buildManagedStageSupportRvmExportNodes(profile, options);
  const topologyAudit = options.topologyAudit || null;
  const gates = [];
  const supportRecords = profile?.supportRecords || [];
  const nodes = [];
  const supportWarnings = [...(base.supportWarnings || [])];
  const completenessRows = [];

  base.nodes.forEach((node, index) => {
    const record = supportRecords[index] || null;
    const gate = resolveManagedStageSupportTopologyGate(record, topologyAudit);
    gates.push(gate);
    const blocked = gate.status !== 'ok' || gate.associationOnly !== true;
    const repairedPrimitives = blocked ? [] : ensureExactAxisSupportPrimitives(node, record, index, options);
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
        SUPPORT_INLINE_FACE_BLOCKED: Number(gate.supportInlineFaceCount || 0) === 0 ? 'TRUE' : 'FALSE',
        SUPPORT_COMPLETENESS_AUDITED: 'TRUE'
      },
      supportTopologyGate: gate,
      primitives: repairedPrimitives.map((primitive) => ({
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
    if (!blocked && (node.primitives || []).length === 0 && patchedNode.primitives.length > 0) {
      supportWarnings.push({
        code: 'SUPPORT_EXACT_AXIS_ZERO_PRIMITIVE_REPAIRED',
        support: node.name,
        family: supportFamily(node, record),
        node: supportNode(record, node),
        primitiveCount: patchedNode.primitives.length
      });
    }
    nodes.push(patchedNode);
    completenessRows.push(buildSupportCompletenessRow(record, patchedNode, gate, index, blocked));
  });

  const gateSummary = summarizeManagedStageSupportTopologyGates(gates);
  const supportPrimitiveCount = nodes.reduce((sum, node) => sum + (node.primitives?.length || 0), 0);
  const supportDirectionalGlyphPrimitiveCount = nodes.reduce((sum, node) => sum + (node.primitives || []).filter((primitive) => primitive.supportDirectionalGlyphBar === true).length, 0);
  const supportBarPrimitiveCount = nodes.reduce((sum, node) => sum + (node.primitives || []).filter((primitive) => primitive.supportBar === true).length, 0);
  const connectorPrimitiveCount = nodes.reduce((sum, node) => sum + (node.primitives || []).filter((primitive) => primitive.supportClusterConnector === true).length, 0);
  const fallbackPrimitiveCount = nodes.reduce((sum, node) => sum + (node.primitives || []).filter((primitive) => primitive.supportFallbackCrossRod === true).length, 0);
  const warningPrimitiveCount = nodes.reduce((sum, node) => sum + (node.primitives || []).filter((primitive) => primitive.supportWarningMarker === true).length, 0);
  const supportCompletenessAudit = buildSupportCompletenessAudit(completenessRows);

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
    supportCompletenessAudit,
    supportCompletenessRows: completenessRows,
    supportCompletenessPass: supportCompletenessAudit.pass,
    node205SupportSourceCount: supportCompletenessAudit.node205SupportSourceCount,
    node205RenderedSupportCount: supportCompletenessAudit.node205RenderedSupportCount,
    node205MissingRows: supportCompletenessAudit.node205MissingRows,
    node205YSupportRendered: supportCompletenessAudit.node205YSupportRendered,
    node205SpringRendered: supportCompletenessAudit.node205SpringRendered,
    supportWarnings,
    nodes,
    policy: 'managed-stage support RVM export is topology-gated: support records must resolve to SUPPORT_ASSOCIATION-only topology with zero support continuity edges before compact support glyphs are emitted; completeness audit proves each source support row is rendered or has a suppression reason'
  };
}

function ensureExactAxisSupportPrimitives(node, record, index, options = {}) {
  const primitives = node.primitives || [];
  if (primitives.length > 0) return primitives;
  const family = supportFamily(node, record);
  if (!EXACT_AXIS_FAMILY_RE.test(family)) return primitives;
  const axis = normalizeAxis(family);
  const center = vector3(node.position || node.sourceAnchor || supportPosition(record));
  const direction = axisVector(axis);
  const odMm = Number(options.pointRadius || 30) * 2 || 60;
  const lengthMm = Math.max(24, Math.min(60, odMm * 0.34));
  const radiusMm = Math.max(1, Math.min(3, odMm * 0.012));
  const start = add(center, scale(direction, -lengthMm * 0.5));
  const end = add(center, scale(direction, lengthMm * 0.5));
  const name = `${node.name || record?.name || `SUPPORT_${index + 1}`}_EXACT_AXIS_${axisToken(axis)}`;
  const primitive = buildEndpointLockedCylinderPrimitive({
    name,
    localName: 'exact-axis-support-directional-glyph',
    startMm: start,
    endMm: end,
    radiusMm,
    material: node.material || 9,
    sourceContractName: record?.attributes?.NAME || record?.name || '',
    sourceElementId: record?.attributes?.SOURCE_RESTRAINT_ID || record?.attributes?.REF || record?.name || '',
    primitiveRole: 'managed-stage-rvm-support-exact-axis-glyph',
    parentStartMm: start,
    parentEndMm: end,
    startOffsetMm: 0,
    endOffsetMm: 0
  });
  return [{
    ...primitive,
    recipeName: 'managed-stage-rvm-support-exact-axis-repair-bar',
    managedStageSupportRvmPrimitive: true,
    supportPrimitiveCode: SUPPORT_CODE8_CYLINDER,
    supportBar: true,
    supportDirectionalGlyphBar: true,
    supportPointCone: false,
    supportFamily: family,
    supportRawKind: record?.attributes?.RAW_TYPE || record?.type || '',
    supportNode: supportNode(record, node),
    supportAxis: axis,
    supportActionAxes: [axis],
    supportExactAxisZeroPrimitiveRepair: true,
    supportSourceAnchorMm: center,
    supportVisualCenterMm: center,
    supportGlyphLengthMm: lengthMm,
    orientationAssumption: 'Exact-axis support family exported as one compact Review-safe code-8 cylinder glyph because the visual resolver produced no directional sides.'
  }];
}

function buildSupportCompletenessRow(record, node, gate, index, blocked) {
  const attrs = record?.attributes || {};
  const family = supportFamily(node, record);
  const primitives = node.primitives || [];
  const supportActionAxes = uniqueAxes([
    ...primitives.map((primitive) => primitive.supportAxis),
    ...(Array.isArray(node.supportActionAxes) ? node.supportActionAxes : []),
    node.attributes?.AXIS_CANVAS,
    node.attributes?.AXIS
  ]);
  const rendered = primitives.length > 0;
  return {
    schema: 'ManagedStageSupportCompletenessRow.v1',
    index,
    node: supportNode(record, node),
    family,
    activeBasis: attrs.SUPPORT_SOURCE_MODE || node.attributes?.SOURCE_MODE || node.sourceMode || 'stagedJson',
    sourcePath: attrs.SOURCE_PATH || attrs.REF || attrs.NAME || node.name || '',
    supportTag: attrs.SUPPORT_TAG || attrs.NAME || node.name || '',
    sourceAxis: attrs.SUPPORT_AXIS_SOURCE_ORIGINAL || attrs.SUPPORT_AXIS_SOURCE || attrs.SUPPORT_AXIS || attrs.RESTRAINT_AXIS || attrs.AXIS || '',
    mappedCanvasAxis: attrs.SUPPORT_AXIS_CANVAS || node.attributes?.AXIS_CANVAS || node.attributes?.AXIS || '',
    supportActionAxes,
    matchedPipeAxis: attrs.MATCHED_PIPE_AXIS || attrs.PIPE_AXIS || node.attributes?.MATCHED_PIPE_AXIS || '',
    primitiveCount: primitives.length,
    rendered,
    suppressedReason: rendered ? '' : blocked ? `topology-gate:${gate.reason || gate.status}` : 'zero-primitives-after-support-planning',
    topologyGate: gate.status,
    topologyAssociationOnly: gate.associationOnly === true,
    exactAxisRepair: primitives.some((primitive) => primitive.supportExactAxisZeroPrimitiveRepair === true),
    isNode205: supportNode(record, node) === NODE_205,
    isYSupport: isYSupport(family, supportActionAxes, attrs),
    isSpringSupport: isSpringSupport(family, attrs)
  };
}

function buildSupportCompletenessAudit(rows) {
  const nodeCounts = {};
  const missingRows = [];
  for (const row of rows) {
    const bucket = nodeCounts[row.node] || { sourceCount: 0, renderedCount: 0, missingCount: 0, families: {} };
    bucket.sourceCount += 1;
    if (row.rendered) bucket.renderedCount += 1;
    else bucket.missingCount += 1;
    bucket.families[row.family] = (bucket.families[row.family] || 0) + 1;
    nodeCounts[row.node] = bucket;
    if (!row.rendered) missingRows.push(row);
  }
  const node205Rows = rows.filter((row) => row.node === NODE_205);
  const node205MissingRows = node205Rows.filter((row) => !row.rendered);
  const node205YRows = node205Rows.filter((row) => row.isYSupport);
  const node205SpringRows = node205Rows.filter((row) => row.isSpringSupport);
  return {
    schema: MANAGED_STAGE_SUPPORT_COMPLETENESS_AUDIT_SCHEMA,
    sourceRowCount: rows.length,
    renderedRowCount: rows.filter((row) => row.rendered).length,
    missingRowCount: missingRows.length,
    missingRows,
    nodeCounts,
    node205SupportSourceCount: node205Rows.length,
    node205RenderedSupportCount: node205Rows.filter((row) => row.rendered).length,
    node205MissingRows,
    node205YSupportSourceCount: node205YRows.length,
    node205YSupportRendered: node205YRows.length > 0 && node205YRows.every((row) => row.rendered),
    node205SpringSourceCount: node205SpringRows.length,
    node205SpringRendered: node205SpringRows.length > 0 && node205SpringRows.every((row) => row.rendered),
    pass: missingRows.length === 0 && node205MissingRows.length === 0
  };
}

function supportFamily(node, record) {
  return String(node.attributes?.SUPPORT_FAMILY || record?.attributes?.SUPPORT_FAMILY || record?.attributes?.SUPPORT_KIND || record?.attributes?.SUPPORT_TYPE || record?.type || '').toUpperCase().replace(/[\s-]+/g, '_');
}

function supportNode(record, node) {
  return String(record?.attributes?.NODE || node.attributes?.NODE || '').trim();
}

function supportPosition(record) {
  const attrs = record?.attributes || {};
  return pointOrArray(attrs.SUPPORTCOORD || attrs.SUPPORT_COORD || attrs.POS || attrs.BPOS || attrs.APOS || attrs.LPOS);
}

function pointOrArray(value) {
  if (Array.isArray(value)) return value.map(Number);
  if (value && typeof value === 'object') return [Number(value.x) || 0, Number(value.y) || 0, Number(value.z) || 0];
  return [0, 0, 0];
}

function normalizeAxis(axis) {
  const text = String(axis || '+X').toUpperCase().trim();
  const dim = text.replace(/[+-]/g, '') || 'X';
  return `${text.startsWith('-') ? '-' : '+'}${dim}`;
}

function axisVector(axis) {
  const text = normalizeAxis(axis);
  const sign = text.startsWith('-') ? -1 : 1;
  const dim = text.replace(/[+-]/g, '');
  if (dim === 'Y') return [0, sign, 0];
  if (dim === 'Z') return [0, 0, sign];
  return [sign, 0, 0];
}

function axisToken(axis) {
  return String(axis || '+X').replace('+', 'POS_').replace('-', 'NEG_').replace(/[^A-Za-z0-9_]/g, '_');
}

function vector3(value) {
  if (Array.isArray(value) && value.length === 3) return value.map((entry) => Number(entry) || 0);
  return [0, 0, 0];
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(a, n) {
  return [a[0] * n, a[1] * n, a[2] * n];
}

function uniqueAxes(values) {
  return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))];
}

function isYSupport(family, axes, attrs) {
  const text = [family, attrs.SUPPORT_KIND, attrs.SUPPORT_TYPE, attrs.RESTRAINT, attrs.AXIS, attrs.SUPPORT_AXIS, attrs.RESTRAINT_AXIS, ...(axes || [])].filter(Boolean).join(' ').toUpperCase();
  return /(^|[^A-Z0-9])[+-]?Y([^A-Z0-9]|$)/.test(text);
}

function isSpringSupport(family, attrs) {
  const text = [family, attrs.SUPPORT_KIND, attrs.SUPPORT_TYPE, attrs.RESTRAINT, attrs.NAME, attrs.REF].filter(Boolean).join(' ').toUpperCase();
  return /SPRING/.test(text);
}
