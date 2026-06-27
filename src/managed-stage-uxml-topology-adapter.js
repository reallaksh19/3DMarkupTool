import { parseManagedStageProfile } from './managed-stage-profile-parser.js?v=bust-cache-4';
import { resolveExplicitManagedStageBendDetails } from './managed-stage-explicit-bend-details.js?v=bust-cache-4';

export const MANAGED_STAGE_UXML_TOPOLOGY_SCHEMA = 'managed-stage-uxml-topology/v1';
export const MANAGED_STAGE_TOPOLOGY_AUDIT_SCHEMA = 'managed-stage-topology-audit/v1';

const REQUIRED_SECTIONS = ['sources', 'components', 'anchors', 'ports', 'segments', 'supports', 'topologyHints', 'diagnostics'];
const INLINE_TYPES = new Set(['PIPE', 'BEND', 'ELBO', 'ELBOW', 'VALVE', 'FLANGE', 'FLANGE_PAIR', 'FLANGED_VALVE', 'REDUCER', 'UNSPECIFIED']);
const BRANCH_TYPES = new Set(['TEE', 'OLET', 'WELDOLET', 'SOCKOLET']);
const EPS_MM = 0.001;

export function buildManagedStageUxmlTopologyDocument(sourceTextOrJson, options = {}) {
  const profile = typeof sourceTextOrJson === 'string'
    ? parseManagedStageProfile(sourceTextOrJson)
    : parseManagedStageProfile(JSON.stringify(sourceTextOrJson));
  const sourceName = options.sourceName || profile.source || 'managed-stage-json';
  const doc = {
    schema: MANAGED_STAGE_UXML_TOPOLOGY_SCHEMA,
    profile: 'MANAGED-STAGE-UXML-TOPOLOGY-FULL',
    sourceKind: 'stagedJson',
    sourceName,
    units: profile.units || { coordinates: 'MM', bore: 'MM', length: 'MM' },
    sources: [{ id: 'SRC-1', format: 'STAGED_JSON', path: sourceName, name: sourceName, role: 'PRIMARY' }],
    components: [],
    anchors: [],
    ports: [],
    segments: [],
    supports: [],
    topologyHints: [],
    diagnostics: [],
    sourceProfile: profile
  };

  for (const [index, record] of profile.geometryRecords.entries()) addGeometryRecord(doc, record, index);
  for (const [index, record] of profile.supportRecords.entries()) addSupportRecord(doc, record, index);
  return doc;
}

export function validateManagedStageUxmlTopologyDocument(doc, options = {}) {
  const report = createReport('managed-stage-topology-validation/v1');
  const add = makeDiagnosticAdder(report);
  if (!doc || typeof doc !== 'object') {
    add('FATAL', 'MST-DOCUMENT-NOT-OBJECT', 'Managed-stage topology document is not an object.');
    return finalizeReport(report);
  }
  for (const section of REQUIRED_SECTIONS) {
    if (!Array.isArray(doc[section])) add('FATAL', 'MST-MISSING-SECTION', `Missing topology section ${section}.`, { section });
  }
  if (report.stats.fatalCount) return finalizeReport(report);

  const componentIds = idSet(doc.components, 'component', add);
  const anchorIds = idSet(doc.anchors, 'anchor', add);
  const portIds = idSet(doc.ports, 'port', add);
  idSet(doc.segments, 'segment', add);
  idSet(doc.supports, 'support', add);

  const anchorsByComponent = groupBy(doc.anchors, (anchor) => anchor.componentId);
  const portsByComponent = groupBy(doc.ports, (port) => port.componentId);
  let invalidAnchorPointCount = 0;
  let requiredAnchorMissingCount = 0;
  let bendDetailMissingCount = 0;
  let supportContinuityPortCount = 0;

  for (const anchor of doc.anchors) {
    if (!componentIds.has(anchor.componentId)) add('ERROR', 'MST-ANCHOR-COMPONENT-REF-MISSING', `Anchor ${anchor.id} refers to missing component ${anchor.componentId}.`, { anchorId: anchor.id, componentId: anchor.componentId });
    if (!isFinitePoint(anchor.point)) {
      invalidAnchorPointCount += 1;
      add('ERROR', 'MST-ANCHOR-POINT-INVALID', `Anchor ${anchor.id} has invalid point.`, { anchorId: anchor.id, componentId: anchor.componentId });
    }
  }

  for (const port of doc.ports) {
    if (!componentIds.has(port.componentId)) add('ERROR', 'MST-PORT-COMPONENT-REF-MISSING', `Port ${port.id} refers to missing component ${port.componentId}.`, { portId: port.id, componentId: port.componentId });
    if (!anchorIds.has(port.anchorId)) add('ERROR', 'MST-PORT-ANCHOR-REF-MISSING', `Port ${port.id} refers to missing anchor ${port.anchorId}.`, { portId: port.id, anchorId: port.anchorId });
    const component = doc.components.find((item) => item.id === port.componentId);
    if (component?.normalizedType === 'SUPPORT' && port.connectsTo === 'ENDPOINT') {
      supportContinuityPortCount += 1;
      add('ERROR', 'MST-SUPPORT-ENDPOINT-CONTINUITY-PORT', `Support ${component.id} has endpoint continuity port ${port.id}.`, { componentId: component.id, portId: port.id });
    }
  }

  for (const segment of doc.segments) {
    if (!componentIds.has(segment.componentId)) add('ERROR', 'MST-SEGMENT-COMPONENT-REF-MISSING', `Segment ${segment.id} refers to missing component ${segment.componentId}.`, { segmentId: segment.id, componentId: segment.componentId });
    for (const key of ['startAnchorId', 'endAnchorId', 'supportAnchorId']) {
      if (segment[key] && !anchorIds.has(segment[key])) add('ERROR', 'MST-SEGMENT-ANCHOR-REF-MISSING', `Segment ${segment.id} has missing ${key} ${segment[key]}.`, { segmentId: segment.id, anchorId: segment[key] });
    }
  }

  for (const support of doc.supports) {
    if (!componentIds.has(support.componentId)) add('ERROR', 'MST-SUPPORT-COMPONENT-REF-MISSING', `Support ${support.id} refers to missing component ${support.componentId}.`, { supportId: support.id, componentId: support.componentId });
    if (support.supportAnchorId && !anchorIds.has(support.supportAnchorId)) add('ERROR', 'MST-SUPPORT-ANCHOR-REF-MISSING', `Support ${support.id} refers to missing anchor ${support.supportAnchorId}.`, { supportId: support.id, anchorId: support.supportAnchorId });
  }

  for (const component of doc.components) {
    const anchors = anchorsByComponent.get(component.id) || [];
    const roles = new Set(anchors.map((anchor) => anchor.role));
    for (const role of requiredAnchorRoles(component)) {
      if (!roles.has(role)) {
        requiredAnchorMissingCount += 1;
        add('ERROR', 'MST-COMPONENT-REQUIRED-ANCHOR-MISSING', `Component ${component.id} type ${component.normalizedType} is missing required anchor ${role}.`, { componentId: component.id, role });
      }
    }
    if (component.normalizedType === 'BEND' && !(component.derived?.bendRadiusMm > 0 && component.derived?.bendAngleDeg > 0)) {
      bendDetailMissingCount += 1;
      add('ERROR', 'MST-BEND-DETAILS-MISSING', `BEND component ${component.id} is missing BEND_RADIUS/BEND_ANGLE.`, { componentId: component.id });
    }
    if ((portsByComponent.get(component.id) || []).length === 0) add('WARNING', 'MST-COMPONENT-PORTS-MISSING', `Component ${component.id} has no ports.`, { componentId: component.id });
  }

  report.sections = {
    shape: { ok: REQUIRED_SECTIONS.every((section) => Array.isArray(doc[section])) },
    references: { ok: report.diagnostics.every((d) => !String(d.code).includes('REF-MISSING')) },
    anchors: { ok: invalidAnchorPointCount === 0, invalidAnchorPointCount },
    componentTopology: { ok: requiredAnchorMissingCount === 0, requiredAnchorMissingCount },
    bendDetails: { ok: bendDetailMissingCount === 0, bendDetailMissingCount },
    supportContinuity: { ok: supportContinuityPortCount === 0, supportContinuityPortCount }
  };
  report.stats = { ...report.stats, componentCount: doc.components.length, anchorCount: doc.anchors.length, portCount: doc.ports.length, segmentCount: doc.segments.length, supportCount: doc.supports.length, requiredAnchorMissingCount, bendDetailMissingCount, supportContinuityPortCount };
  return finalizeReport(report);
}

export function buildManagedStageFaceModel(doc, options = {}) {
  const validation = options.skipValidation ? null : validateManagedStageUxmlTopologyDocument(doc);
  const out = { schema: 'managed-stage-face-model/v1', ok: true, blocked: false, validation, components: [], faces: [], diagnostics: [], summary: {} };
  if (validation && validation.ready !== true && options.allowPartial !== true) {
    out.ok = false;
    out.blocked = true;
    out.diagnostics.push(makeDiagnostic('ERROR', 'MST-FACE-VALIDATION-BLOCKED', 'Topology validation is not ready. Face model build blocked.'));
    out.summary = summarizeFaceModel(out);
    return out;
  }
  const anchorsByComponent = groupBy(doc.anchors, (anchor) => anchor.componentId);
  const portsByAnchor = new Map(doc.ports.map((port) => [port.anchorId, port]));
  for (const component of sortById(doc.components)) {
    const record = { componentId: component.id, type: component.normalizedType, pipelineRef: component.pipelineRef || '', lineKey: component.lineKey || '', name: component.name || '', bore: component.bore ?? null, faces: [], axisVector: null, branchVector: null, sourceComponent: component, supportAssociationOnly: component.normalizedType === 'SUPPORT' };
    for (const anchor of sortById(anchorsByComponent.get(component.id) || [])) {
      const port = portsByAnchor.get(anchor.id);
      record.faces.push({ id: `F-${component.id}-${anchor.role}`, componentId: component.id, type: component.normalizedType, role: port?.role || anchor.role, faceKind: faceKindFor(component, anchor), point: clonePoint(anchor.point), anchorId: anchor.id, portId: port?.id || '', connectsTo: port?.connectsTo || 'ENDPOINT', fixed: port?.fixed !== false, futureMovable: port?.futureMovable === true, mutableNow: port?.mutableNow === true, pipelineRef: component.pipelineRef || '', sourcePath: component.sourcePath || '' });
    }
    const ep1 = record.faces.find((face) => face.role.endsWith('END_1') || face.role === 'EP1');
    const ep2 = record.faces.find((face) => face.role.endsWith('END_2') || face.role === 'EP2');
    record.axisVector = normalizeVector(vector(ep1?.point, ep2?.point));
    const bp = record.faces.find((face) => face.role === 'TEE_BRANCH' || face.role === 'OLET_BRANCH' || face.role === 'BP');
    record.branchVector = normalizeVector(vector(midpoint(ep1?.point, ep2?.point), bp?.point));
    out.components.push(record);
    out.faces.push(...record.faces);
  }
  out.summary = summarizeFaceModel(out);
  if (out.summary.supportInlineFaceCount > 0) {
    out.ok = false;
    out.blocked = true;
    out.diagnostics.push(makeDiagnostic('ERROR', 'MST-FACE-SUPPORT-INLINE-FACE-DETECTED', 'Support inline continuity face detected.'));
  }
  return out;
}

export function buildManagedStageUniversalTopoGraph(doc, options = {}) {
  const faceModel = options.faceModel || buildManagedStageFaceModel(doc, options);
  const out = { schema: 'managed-stage-universal-topo-graph/v1', ok: true, blocked: false, config: { connectToleranceMm: numberOr(options.connectToleranceMm, EPS_MM) }, faceModel, components: [], nodes: [], ports: [], edges: [], candidateEdges: [], disconnected: [], diagnostics: [], summary: {} };
  if (faceModel.ok !== true && options.allowBlockedFaceModel !== true) {
    out.ok = false;
    out.blocked = true;
    out.diagnostics.push(makeDiagnostic('ERROR', 'MST-UTG-FACE-MODEL-BLOCKED', 'Cannot build topology graph because face model is blocked.'));
    out.summary = summarizeTopo(out);
    return out;
  }
  for (const component of faceModel.components) out.components.push({ id: `MST-C-${component.componentId}`, componentId: component.componentId, type: component.type, pipelineRef: component.pipelineRef, lineKey: component.lineKey, faceIds: component.faces.map((face) => face.id), sourceComponent: component.sourceComponent });
  for (const face of sortById(faceModel.faces.filter(isEndpointFace))) {
    const node = findOrCreateNode(out, face.point, out.config.connectToleranceMm);
    const port = { id: `MST-P-${face.id}`, faceId: face.id, componentId: face.componentId, type: face.type, role: face.role, faceKind: face.faceKind, point: clonePoint(face.point), nodeId: node.id, sourcePortId: face.portId, pipelineRef: face.pipelineRef, connectsTo: face.connectsTo, required: isRequiredEndpointFace(face), connectedEdgeIds: [] };
    out.ports.push(port);
    node.portIds.push(port.id);
    node.faceIds.push(face.id);
    if (!node.componentIds.includes(face.componentId)) node.componentIds.push(face.componentId);
  }
  buildTopologyEdges(out);
  buildDisconnectedPorts(out);
  out.summary = summarizeTopo(out);
  if (out.summary.supportContinuityEdgeCount > 0) {
    out.ok = false;
    out.diagnostics.push(makeDiagnostic('ERROR', 'MST-UTG-SUPPORT-CONTINUITY-EDGE', 'Support continuity edge detected. Support must not participate in pipe continuity.'));
  }
  // Only set ok=false for internal disconnections: ports that share a topology node with at
  // least one other component's port (i.e., something should connect there but doesn't).
  // Open terminals â€” ports whose node has only a single port (genuine pipe end) â€” are
  // expected in isometric piping systems and must not poison the ok flag.
  const internalDisconnected = out.disconnected.filter((item) => {
    const port = out.ports.find((p) => p.id === item.portId);
    if (!port) return true;
    const node = out.nodes.find((n) => n.id === port.nodeId);
    return node && node.portIds.length > 1;
  });
  if (internalDisconnected.length > 0) {
    out.ok = false;
    out.diagnostics.push(makeDiagnostic('ERROR', 'MST-UTG-INTERNAL-DISCONNECTED', `${internalDisconnected.length} internal disconnected port(s) detected.`));
  }
  return out;
}

export function buildManagedStageTopologyAudit(sourceTextOrJson, options = {}) {
  const topologyDocument = buildManagedStageUxmlTopologyDocument(sourceTextOrJson, options);
  const validation = validateManagedStageUxmlTopologyDocument(topologyDocument, options);
  const faceModel = buildManagedStageFaceModel(topologyDocument, { allowPartial: options.allowPartial === true });
  const universalGraph = buildManagedStageUniversalTopoGraph(topologyDocument, { faceModel, connectToleranceMm: options.connectToleranceMm ?? EPS_MM, allowBlockedFaceModel: options.allowPartial === true });
  const explicitBends = topologyDocument.components.filter((component) => component.normalizedType === 'BEND');
  return {
    schema: MANAGED_STAGE_TOPOLOGY_AUDIT_SCHEMA,
    ok: validation.ready === true && faceModel.ok === true && universalGraph.ok === true,
    sourceKind: 'stagedJson',
    sourceName: topologyDocument.sourceName,
    topologyDocument,
    validation,
    faceModel,
    universalGraph,
    summary: {
      componentCount: topologyDocument.components.length,
      geometryComponentCount: topologyDocument.components.filter((component) => component.normalizedType !== 'SUPPORT').length,
      supportCount: topologyDocument.supports.length,
      anchorCount: topologyDocument.anchors.length,
      portCount: topologyDocument.ports.length,
      segmentCount: topologyDocument.segments.length,
      faceCount: faceModel.faces.length,
      nodeCount: universalGraph.nodes.length,
      edgeCount: universalGraph.edges.length,
      disconnectedRequiredPortCount: universalGraph.disconnected.length,
      supportContinuityEdgeCount: universalGraph.summary.supportContinuityEdgeCount,
      explicitBendRecordCount: explicitBends.length,
      explicitBendDetailCount: explicitBends.filter((component) => component.derived?.bendRadiusMm > 0 && component.derived?.bendAngleDeg > 0).length,
      missingExplicitBendDetailCount: explicitBends.filter((component) => !(component.derived?.bendRadiusMm > 0 && component.derived?.bendAngleDeg > 0)).length,
      synthetic1p5DTrimBlockedCount: explicitBends.filter((component) => component.derived?.synthetic1p5DTrimBlocked === true).length
    }
  };
}

function addGeometryRecord(doc, record, index) {
  const attrs = record.attributes || {};
  const type = normalizeType(attrs.DTXR || attrs.RAW_TYPE || record.type || 'PIPE');
  const componentId = safeId('MSC', attrs.SOURCE_ELEMENT_ID || attrs.REF || attrs.NAME || record.name || index + 1);
  const bend = resolveExplicitManagedStageBendDetails({ ...record, attrs, attributes: attrs });
  const component = { id: componentId, sourceRefs: ['SRC-1'], type: attrs.DTXR || record.type || '', normalizedType: type, pipelineRef: attrs.LINE_NO || attrs.BRANCH || '', lineKey: attrs.LINE_KEY || '', name: attrs.NAME || record.name || componentId, bore: parseNumber(attrs.DIAMETER || attrs.BORE || attrs.ABORE || attrs.LBORE), branchBore: parseNumber(attrs.BBR || attrs.BBORE || attrs.BRANCH_BORE), rawAttributes: attrs, sourcePath: record.path || '', derived: { centerlineKind: bend.explicitBendRecord ? 'arc' : 'line', bendRadiusMm: bend.bendRadiusMm, bendAngleDeg: bend.bendAngleDeg, bendSource: bend.bendSource, synthetic1p5DTrimBlocked: bend.synthetic1p5DTrimBlocked } };
  doc.components.push(component);
  const ep1 = addAnchorPort(doc, component, 'EP1', roleFor(type, 1), pointOrNull(attrs.APOS), attrs.FROM_NODE, 'ENDPOINT', type === 'PIPE');
  const ep2 = addAnchorPort(doc, component, 'EP2', roleFor(type, 2), pointOrNull(attrs.LPOS), attrs.TO_NODE, 'ENDPOINT', type === 'PIPE');
  if (BRANCH_TYPES.has(type)) {
    addAnchorPort(doc, component, 'BP', type === 'TEE' ? 'TEE_BRANCH' : 'OLET_BRANCH', pointOrNull(attrs.BPOS || attrs.BP || attrs.BRANCH_POS), attrs.BRANCH_NODE || '', 'ENDPOINT', false);
    if (type !== 'TEE') addAnchorPort(doc, component, 'CP', 'OLET_HEADER_TAP', pointOrNull(attrs.CPOS || attrs.CP || attrs.POS), attrs.HEADER_NODE || '', 'SEGMENT', false);
  }
  doc.segments.push({ id: `SEG-${componentId}`, componentId, type: segmentTypeFor(type), startAnchorId: ep1?.id || '', endAnchorId: ep2?.id || '', supportAnchorId: '', bore: component.bore, length: distance(ep1?.point, ep2?.point), centerlineKind: component.derived.centerlineKind, bendRadiusMm: component.derived.bendRadiusMm, bendAngleDeg: component.derived.bendAngleDeg, sourcePath: record.path || '' });
}

function addSupportRecord(doc, record, index) {
  const attrs = record.attributes || {};
  const componentId = safeId('MSS', attrs.SOURCE_RESTRAINT_ID || attrs.REF || attrs.NAME || record.name || index + 1);
  const component = { id: componentId, sourceRefs: ['SRC-1'], type: 'SUPPORT', normalizedType: 'SUPPORT', pipelineRef: attrs.LINE_NO || '', lineKey: attrs.LINE_KEY || '', name: attrs.NAME || record.name || componentId, bore: null, branchBore: null, rawAttributes: attrs, sourcePath: record.path || '', derived: { supportFamily: attrs.SUPPORT_KIND_MAPPED || attrs.SUPPORT_KIND || attrs.TYPE || record.type || '', axisRaw: attrs.AXIS || attrs.SUPPORT_AXIS || '', gapMm: parseNumber(attrs.GAP || attrs.GAP_MM) } };
  doc.components.push(component);
  const anchor = addAnchorPort(doc, component, 'SUPPORT_POINT', 'SUPPORT_POINT', pointOrNull(attrs.SUPPORTCOORD || attrs.SUPPORT_COORD || attrs.POS || attrs.BPOS || attrs.APOS), attrs.NODE || attrs.FROM_NODE || attrs.TO_NODE || '', 'SEGMENT', false);
  doc.segments.push({ id: `SEG-${componentId}`, componentId, type: 'SUPPORT_ASSOCIATION', startAnchorId: '', endAnchorId: '', supportAnchorId: anchor?.id || '', bore: null, length: null, sourcePath: record.path || '' });
  doc.supports.push({ id: `SUP-${componentId}`, componentId, type: component.derived.supportFamily, skey: attrs.SKEY || '', supportAnchorId: anchor?.id || '', hostCandidates: [], restraints: [], sourcePath: record.path || '' });
}

function addAnchorPort(doc, component, anchorRole, portRole, point, nodeNumber, connectsTo, futureMovable) {
  if (!point) return null;
  const anchor = { id: `A-${component.id}-${anchorRole}`, componentId: component.id, role: anchorRole, point, nodeNumber: String(nodeNumber || ''), sourceRef: 'SRC-1', sourceField: anchorRole, confidence: 'EXACT_SOURCE', diagnostics: [] };
  const port = { id: `P-${component.id}-${portRole}`, componentId: component.id, anchorId: anchor.id, role: portRole, point: clonePoint(point), bore: component.bore ?? null, branchBore: component.branchBore ?? null, fixed: !futureMovable, futureMovable: futureMovable === true, mutableNow: false, connectsTo, maxDegree: connectsTo === 'SEGMENT' ? 0 : 1, diagnostics: [] };
  doc.anchors.push(anchor);
  doc.ports.push(port);
  return anchor;
}

function buildTopologyEdges(out) {
  const seen = new Set();
  for (const node of out.nodes) {
    const ports = node.portIds.map((id) => out.ports.find((port) => port.id === id)).filter(Boolean);
    if (ports.length > 12) {
      out.diagnostics.push(makeDiagnostic('ERROR', 'MST-UTG-COLLAPSED-ENDPOINT-NODE', 'Implausible high-degree endpoint node; source geometry likely collapsed.', { nodeId: node.id, portCount: ports.length }));
      continue;
    }
    for (let i = 0; i < ports.length; i += 1) for (let j = i + 1; j < ports.length; j += 1) {
      const a = ports[i], b = ports[j];
      if (!compatibleForContinuity(a, b)) continue;
      const key = [a.id, b.id].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const d = distance(a.point, b.point);
      const edge = { id: `MST-E-${String(out.edges.length + 1).padStart(5, '0')}`, nodeId: node.id, sourcePortId: a.id, targetPortId: b.id, sourceComponentId: a.componentId, targetComponentId: b.componentId, edgeClass: d <= EPS_MM ? 'EXACT_CONNECTION' : 'WITHIN_CONNECT_TOLERANCE', distanceMm: round(d), point: clonePoint(node.point), pipelineRef: a.pipelineRef || b.pipelineRef || '' };
      out.edges.push(edge);
      out.candidateEdges.push({ ...edge, accepted: true, reason: 'Endpoint faces share coordinate node within tolerance.' });
      a.connectedEdgeIds.push(edge.id);
      b.connectedEdgeIds.push(edge.id);
    }
  }
}

function buildDisconnectedPorts(out) {
  for (const port of out.ports) if (port.required && !port.connectedEdgeIds.length) out.disconnected.push({ id: `MST-X-${String(out.disconnected.length + 1).padStart(5, '0')}`, code: `MST-TOPO-${port.role}-DISCONNECTED`, componentId: port.componentId, portId: port.id, role: port.role, faceKind: port.faceKind, point: clonePoint(port.point), pipelineRef: port.pipelineRef });
}

function isEndpointFace(face) { return face && isFinitePoint(face.point) && face.connectsTo === 'ENDPOINT' && face.faceKind !== 'SUPPORT_ASSOCIATION' && face.type !== 'SUPPORT'; }
function isRequiredEndpointFace(face) { return isEndpointFace(face) && (String(face.role).includes('END_') || face.role === 'TEE_BRANCH' || face.role === 'OLET_BRANCH'); }
function compatibleForContinuity(a, b) { return a && b && a.id !== b.id && a.componentId !== b.componentId && a.required && b.required && (!a.pipelineRef || !b.pipelineRef || a.pipelineRef === b.pipelineRef); }

function findOrCreateNode(out, point, toleranceMm) {
  for (const node of out.nodes) if (distance(node.point, point) <= toleranceMm) return node;
  const node = { id: `MST-N-${String(out.nodes.length + 1).padStart(5, '0')}`, point: clonePoint(point), portIds: [], faceIds: [], componentIds: [] };
  out.nodes.push(node);
  return node;
}

function summarizeFaceModel(out) { return { componentCount: out.components.length, faceCount: out.faces.length, supportAssociationFaceCount: out.faces.filter((face) => face.faceKind === 'SUPPORT_ASSOCIATION').length, supportInlineFaceCount: out.faces.filter((face) => face.type === 'SUPPORT' && face.connectsTo === 'ENDPOINT').length, diagnosticCount: out.diagnostics.length }; }
function summarizeTopo(out) { const supportContinuityEdgeCount = out.edges.filter((edge) => edge.sourceComponentId.includes('MSS') || edge.targetComponentId.includes('MSS')).length; return { componentCount: out.components.length, nodeCount: out.nodes.length, portCount: out.ports.length, edgeCount: out.edges.length, candidateEdgeCount: out.candidateEdges.length, disconnectedCount: out.disconnected.length, connectedRequiredPortCount: out.ports.filter((port) => port.required && port.connectedEdgeIds.length).length, disconnectedRequiredPortCount: out.disconnected.length, supportContinuityEdgeCount, diagnosticCount: out.diagnostics.length }; }
function createReport(schema) { return { schema, ready: false, exportAllowed: false, sections: {}, diagnostics: [], blockers: [], warnings: [], stats: { fatalCount: 0, errorCount: 0, warningCount: 0 } }; }
function makeDiagnosticAdder(report) { return (severity, code, message, details = {}) => { const d = makeDiagnostic(severity, code, message, details); report.diagnostics.push(d); if (severity === 'ERROR' || severity === 'FATAL') report.blockers.push(d); if (severity === 'WARNING') report.warnings.push(d); return d; }; }
function makeDiagnostic(severity, code, message, details = {}) { return { severity, code, message, details }; }
function finalizeReport(report) { report.stats.fatalCount = report.diagnostics.filter((d) => d.severity === 'FATAL').length; report.stats.errorCount = report.diagnostics.filter((d) => d.severity === 'ERROR').length; report.stats.warningCount = report.diagnostics.filter((d) => d.severity === 'WARNING').length; report.ready = report.stats.fatalCount === 0 && report.stats.errorCount === 0; report.exportAllowed = report.ready; return report; }
function idSet(items, label, add) { const set = new Set(); const counts = new Map(); for (const item of items || []) { const id = String(item.id || ''); if (!id) add('ERROR', `MST-${label.toUpperCase()}-ID-MISSING`, `${label} has no id.`); else { counts.set(id, (counts.get(id) || 0) + 1); set.add(id); } } for (const [id, count] of counts) if (count > 1) add('ERROR', `MST-DUPLICATE-${label.toUpperCase()}-ID`, `Duplicate ${label} id: ${id}`, { id, count }); return set; }
function requiredAnchorRoles(component) { if (component.normalizedType === 'SUPPORT') return ['SUPPORT_POINT']; if (component.normalizedType === 'TEE') return ['EP1', 'EP2', 'BP']; if (['OLET', 'WELDOLET', 'SOCKOLET'].includes(component.normalizedType)) return ['CP', 'BP']; if (INLINE_TYPES.has(component.normalizedType)) return ['EP1', 'EP2']; return []; }
function roleFor(type, end) { if (type === 'PIPE') return `PIPE_END_${end}`; if (type === 'BEND') return `BEND_END_${end}`; if (type === 'VALVE' || type === 'FLANGED_VALVE') return `VALVE_END_${end}`; if (type.startsWith('FLANGE')) return `FLANGE_END_${end}`; if (type === 'REDUCER') return `REDUCER_END_${end}`; return `${type}_END_${end}`; }
function segmentTypeFor(type) { if (type === 'BEND' || type === 'ELBO' || type === 'ELBOW') return 'BEND_CHORD'; if (type === 'TEE') return 'TEE_MAIN_RUN'; if (['OLET', 'WELDOLET', 'SOCKOLET'].includes(type)) return 'OLET_BRANCH_LEG'; if (type === 'VALVE' || type === 'FLANGED_VALVE') return 'VALVE_AXIS'; if (type.startsWith('FLANGE')) return 'FLANGE_AXIS'; if (type === 'REDUCER') return 'REDUCER_AXIS'; return 'PIPE_RUN'; }
function faceKindFor(component, anchor) { if (component.normalizedType === 'SUPPORT') return 'SUPPORT_ASSOCIATION'; if (anchor.role === 'BP' && component.normalizedType === 'TEE') return 'TEE_BRANCH'; if (anchor.role === 'BP') return 'OLET_BRANCH'; if (anchor.role === 'CP') return 'OLET_HEADER_TAP'; return 'ENDPOINT'; }
function normalizeType(value) { const t = String(value || 'PIPE').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_'); if (t === 'ELBO' || t === 'ELBOW') return 'BEND'; if (t === 'FLANGED_VALVE') return 'VALVE'; if (t === 'FLANGE_PAIR') return 'FLANGE'; return t || 'PIPE'; }
function pointOrNull(value) { if (!value && value !== 0) return null; if (typeof value === 'object' && !Array.isArray(value)) return isFinitePoint(value) ? clonePoint(value) : null; const nums = Array.isArray(value) ? value.map(Number) : String(value).match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || []; return nums.length >= 3 && nums.slice(0, 3).every(Number.isFinite) ? { x: nums[0], y: nums[1], z: nums[2] } : null; }
function isFinitePoint(p) { return p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)) && Number.isFinite(Number(p.z)); }
function clonePoint(p) { return isFinitePoint(p) ? { x: Number(p.x), y: Number(p.y), z: Number(p.z) } : null; }
function vector(a, b) { return isFinitePoint(a) && isFinitePoint(b) ? { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z } : null; }
function normalizeVector(v) { const len = v ? Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) : 0; return len > EPS_MM ? { x: v.x / len, y: v.y / len, z: v.z / len } : null; }
function midpoint(a, b) { return isFinitePoint(a) && isFinitePoint(b) ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 } : null; }
function distance(a, b) { if (!isFinitePoint(a) || !isFinitePoint(b)) return Number.POSITIVE_INFINITY; const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z; return Math.sqrt(dx * dx + dy * dy + dz * dz); }
function parseNumber(value) { const n = Number.parseFloat(String(value ?? '').replace(/mm\b/gi, '').trim()); return Number.isFinite(n) ? n : null; }
function numberOr(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function round(value) { return Number(Number(value || 0).toFixed(6)); }
function safeId(prefix, value) { return `${prefix}-${String(value || '').trim().replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'ITEM'}`; }
function groupBy(items, keyFn) { const map = new Map(); for (const item of items || []) { const key = keyFn(item); if (!map.has(key)) map.set(key, []); map.get(key).push(item); } return map; }
function sortById(items) { return [...(items || [])].sort((a, b) => String(a.id || '').localeCompare(String(b.id || ''))); }
