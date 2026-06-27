import { assertComponentMapping, assertGeometryContract, assertPipingComponent, assertRenderInstruction, buildContractDiagnostics, validateGeometryContract } from './piping-component-contract.js?v=bust-cache-4';
import { classifyInputXmlElementRecord, classifyInputXmlRestraintRecord, getCatalogEntry, normalizeType } from './piping-component-catalog.js?v=bust-cache-4';

export const PIPING_GRAPH_SCHEMA = 'PipingGraph.v1';
export const SOURCE_RECORD_SCHEMA = 'SourceRecord.v1';
export const RENDER_INSTRUCTION_SCHEMA = 'RenderInstruction.v1';
export const DELEGATED_TO_LEGACY_RENDERER = 'DELEGATED_TO_LEGACY_RENDERER';

const INPUTXML_UNRESOLVED_FITTINGS = new Set(['BEND', 'ELBOW', 'TEE']);

export function buildPipingContractPipeline(model, options = {}) {
  const sourceRecords = adaptInputXmlModelToSourceRecords(model, options);
  const components = sourceRecords.map((record, index) => mapSourceRecordToPipingComponent(record, { ...options, index }));
  assertComponentMapping(sourceRecords, components);
  components.forEach((component) => assertPipingComponent(component, { strictGeometryKind: true }));
  const graph = buildPipingGraph(components, model, options);
  const geometryContracts = buildGeometryContracts(graph, options);
  geometryContracts.forEach((contract) => assertGeometryContract(contract, components));
  const renderInstructions = buildRenderInstructions(geometryContracts, components, options);
  renderInstructions.forEach((instruction) => assertRenderInstruction(instruction));
  return { sourceRecords, components, graph, geometryContracts, renderInstructions, diagnostics: buildPipelineDiagnostics(sourceRecords, components, graph, geometryContracts, renderInstructions) };
}

export function adaptInputXmlModelToSourceRecords(model = {}, options = {}) {
  const sourceType = normalizeSourceType(model.sourceKind || options.sourceType || 'INPUTXML');
  const records = [];
  for (const [index, element] of (model.elements || []).entries()) {
    const props = element.props || {};
    records.push({ schemaVersion: SOURCE_RECORD_SCHEMA, sourceType, sourceId: String(element.id || props.id || `INPUTXML_ELEMENT_${index + 1}`), sourceRecordKind: 'ELEMENT', rawKind: String(element.rawType || element.type || props.type || ''), rawTypeCode: String(props.rigidType || element.rawType || element.type || ''), sourceIndex: index, fromNode: asNodeId(element.fromNode), toNode: asNodeId(element.toNode), record: element, props, diagnostics: [] });
  }
  for (const [index, restraint] of (model.restraints || []).entries()) {
    records.push({ schemaVersion: SOURCE_RECORD_SCHEMA, sourceType, sourceId: String(restraint.id || `INPUTXML_RESTRAINT_${index + 1}`), sourceRecordKind: 'RESTRAINT', rawKind: String(restraint.rawType || restraint.typeCode || restraint.family || ''), rawTypeCode: String(restraint.typeCode || restraint.rawType || restraint.family || ''), sourceIndex: index, supportNode: asNodeId(restraint.node), record: restraint, props: restraint, diagnostics: [] });
  }
  return records;
}

export function mapSourceRecordToPipingComponent(record, options = {}) {
  if (record.sourceRecordKind === 'RESTRAINT') return mapRestraintRecord(record, options);
  if (record.sourceRecordKind === 'ELEMENT') return mapElementRecord(record, options);
  return mapUnknownRecord(record, 'unsupported source record kind');
}

export function buildPipingGraph(components = [], model = {}) {
  const nodeMap = new Map();
  const edges = [];
  for (const node of model.nodes?.values?.() || []) addNode(nodeMap, asNodeId(node.id), toPosition(node));
  for (const [nodeId, position] of Object.entries(model.nodePositions || {})) addNode(nodeMap, asNodeId(nodeId), position);
  for (const component of components) {
    const topology = component.topology || {};
    if (topology.fromNode) ensureGraphNode(nodeMap, topology.fromNode, topology.fromPosition);
    if (topology.toNode) ensureGraphNode(nodeMap, topology.toNode, topology.toPosition);
    if (topology.supportNode) ensureGraphNode(nodeMap, topology.supportNode, topology.supportPosition);
    for (const port of topology.ports || []) ensureGraphNode(nodeMap, port.nodeId, port.position);
    if (topology.fromNode && topology.toNode) edges.push({ edgeId: `EDGE_${component.componentId}`, fromNode: topology.fromNode, toNode: topology.toNode, componentId: component.componentId });
    const linked = new Set([topology.fromNode, topology.toNode, topology.supportNode, ...(topology.ports || []).map((port) => port.nodeId)].filter(Boolean));
    for (const nodeId of linked) {
      const node = nodeMap.get(nodeId);
      if (node && !node.connectedComponentIds.includes(component.componentId)) node.connectedComponentIds.push(component.componentId);
    }
  }
  const nodes = Array.from(nodeMap.values()).sort((a, b) => naturalSort(a.nodeId, b.nodeId));
  return { schemaVersion: PIPING_GRAPH_SCHEMA, nodes, edges, components, diagnostics: { nodeCount: nodeMap.size, edgeCount: edges.length, openNodes: nodes.filter((node) => node.connectedComponentIds.length <= 1).map((node) => node.nodeId), duplicateNodes: [], source: 'component-layer' } };
}

export function buildGeometryContracts(graph, options = {}) {
  const contracts = [];
  const nodesById = new Map((graph.nodes || []).map((node) => [node.nodeId, node]));
  for (const component of graph.components || []) {
    const contract = createGeometryContractForComponent(component, nodesById, options);
    if (!contract) continue;
    const report = validateGeometryContract(contract, graph.components || []);
    if (report.ok) contracts.push(contract);
    else if (options.includeInvalidContracts === true) contracts.push({ ...contract, diagnostics: [...(contract.diagnostics || []), ...report.errors.map((issue) => `${issue.code}: ${issue.message}`)] });
  }
  return contracts;
}

export function buildRenderInstructions(geometryContracts = [], components = [], options = {}) {
  const target = options.target || 'VIEWER';
  const componentById = new Map(components.map((component) => [component.componentId, component]));
  return geometryContracts.map((contract) => {
    const component = componentById.get(contract.componentId) || {};
    const fallbackRendered = contract.geometryKind === 'FALLBACK_LEGACY' || contract.fallbackRendered === true;
    const userData = createRenderUserData(component, contract, { fallbackRendered });
    return { schemaVersion: RENDER_INSTRUCTION_SCHEMA, target, componentId: contract.componentId, geometryContractId: contract.geometryContractId, renderRecipeId: contract.renderRecipeId, materialRecipeId: component.renderIntent?.materialRecipeId || `${String(contract.componentClass).toLowerCase()}-material.v1`, userData: fallbackRendered ? { ...userData, fallbackReason: contract.diagnostics?.[0] || 'legacy fallback renderer' } : userData };
  });
}

export function createRenderUserData(component, contract, options = {}) {
  return { objectRole: 'component-render', componentId: contract.componentId, componentClass: contract.componentClass, sourceRef: { sourceType: component.sourceRef?.sourceType || 'UNKNOWN_SOURCE', sourceId: component.sourceRef?.sourceId || contract.componentId }, geometryContractId: contract.geometryContractId, renderRecipeId: contract.renderRecipeId, fallbackRendered: Boolean(options.fallbackRendered) };
}

export function createFallbackLegacyContract(component, reason = 'legacy fallback renderer') {
  const id = component.componentId || 'UNKNOWN_COMPONENT';
  return { schemaVersion: 'GeometryContract.v1', geometryContractId: `GC_FALLBACK_LEGACY_${sanitizeId(id)}`, componentId: id, componentClass: component.componentClass || 'UNKNOWN', geometryKind: 'FALLBACK_LEGACY', placement: {}, dimensions: {}, ports: [], renderRecipeId: 'fallback-legacy.v1', selection: { selectable: true, selectionProxy: 'GROUP' }, export: { includeInGlb: true, includeInRvm: true, includeInAtt: true }, fallbackRendered: true, diagnostics: [reason] };
}

export function buildPipelineDiagnostics(sourceRecords = [], components = [], graph = {}, geometryContracts = [], renderInstructions = []) {
  return { ...buildContractDiagnostics(sourceRecords, components, geometryContracts, renderInstructions), delegatedTopologyComponents: components.filter((component) => component.topology?.topologyStatus === DELEGATED_TO_LEGACY_RENDERER).map((component) => component.componentId), graphNodesTotal: Array.isArray(graph.nodes) ? graph.nodes.length : 0, graphEdgesTotal: Array.isArray(graph.edges) ? graph.edges.length : 0, phases: { sourceRecordsTotal: sourceRecords.length, componentsTotal: components.length, graphNodesTotal: Array.isArray(graph.nodes) ? graph.nodes.length : 0, graphEdgesTotal: Array.isArray(graph.edges) ? graph.edges.length : 0, geometryContractsTotal: geometryContracts.length, renderInstructionsTotal: renderInstructions.length } };
}

function mapElementRecord(record) {
  const classification = classifyInputXmlElementRecord(record);
  const element = record.record || {};
  const props = record.props || element.props || {};
  const catalog = getCatalogEntry(classification.catalogKey, classification.componentType);
  const fromNode = asNodeId(record.fromNode || element.fromNode || props.fromNode);
  const toNode = asNodeId(record.toNode || element.toNode || props.toNode);
  const isUnknown = classification.componentClass === 'UNKNOWN';
  const delegated = normalizeSourceType(record.sourceType) === 'INPUTXML' && INPUTXML_UNRESOLVED_FITTINGS.has(classification.componentClass);
  const reason = `${classification.componentClass} InputXML record has no contract-grade fitting geometry; legacy renderer remains explicit fallback`;
  return { schemaVersion: 'PipingComponent.v1', componentId: sanitizeId(props.uxmlComponentId || props.id || record.sourceId), componentClass: classification.componentClass, componentType: classification.componentType, sourceRef: { sourceType: record.sourceType || 'INPUTXML', sourceId: record.sourceId, rawKind: record.rawKind || classification.componentType, rawTypeCode: record.rawTypeCode || '' }, topology: delegated ? { topologyStatus: DELEGATED_TO_LEGACY_RENDERER, legacyFromNode: fromNode || '', legacyToNode: toNode || '' } : buildElementTopology(classification.componentClass, fromNode, toNode, element, props), geometryIntent: delegated ? { geometryKind: 'FALLBACK_LEGACY', delegatedGeometryKind: catalog.geometryKind, catalogKey: classification.catalogKey, reason } : { geometryKind: catalog.geometryKind, catalogKey: classification.catalogKey }, renderIntent: { renderRecipeId: delegated ? 'fallback-legacy.v1' : catalog.renderRecipeId, materialRecipeId: `${classification.componentClass.toLowerCase()}-material.v1`, fallbackAllowed: Boolean(isUnknown || delegated) }, metadata: cleanMetadata({ ...props, classifierReason: classification.classifierReason, rawKind: record.rawKind, rawTypeCode: record.rawTypeCode, outerDiameter: numberValue(props.bore || props.diameter || props.outerDiameter, 100), bendRadius: delegated ? null : numberValue(props.bendRadius, null), bendAngle: delegated ? null : numberValue(props.bendAngle, null), topologyResolution: delegated ? DELEGATED_TO_LEGACY_RENDERER : null }), diagnostics: delegated ? [reason] : (isUnknown ? [classification.classifierReason] : []) };
}

function mapRestraintRecord(record) {
  const classification = classifyInputXmlRestraintRecord(record);
  const restraint = record.record || {};
  const supportNode = asNodeId(record.supportNode || restraint.node);
  return { schemaVersion: 'PipingComponent.v1', componentId: sanitizeId(record.sourceId || `RESTRAINT_${supportNode}_${record.sourceIndex + 1}`), componentClass: classification.componentClass, componentType: classification.componentType, sourceRef: { sourceType: record.sourceType || 'INPUTXML', sourceId: record.sourceId, rawKind: record.rawKind || classification.componentType, rawTypeCode: record.rawTypeCode || '' }, topology: { supportNode, axis: restraint.axis || axisFromCosines(restraint), supportPosition: restraint.position || null }, geometryIntent: { geometryKind: classification.geometryKind, catalogKey: classification.catalogKey }, renderIntent: { renderRecipeId: classification.renderRecipeId, materialRecipeId: 'restraint-material.v1', fallbackAllowed: classification.componentType === 'UNKNOWN_RESTRAINT' }, metadata: cleanMetadata({ classifierReason: classification.classifierReason, rawKind: record.rawKind, rawTypeCode: record.rawTypeCode, gapMm: numberValue(restraint.gapMm, null), xCos: numberValue(restraint.xCos, 0), yCos: numberValue(restraint.yCos, 0), zCos: numberValue(restraint.zCos, 0) }), diagnostics: classification.componentType === 'UNKNOWN_RESTRAINT' ? [classification.classifierReason] : [] };
}

function mapUnknownRecord(record, reason) {
  return { schemaVersion: 'PipingComponent.v1', componentId: sanitizeId(record.sourceId || 'UNKNOWN_COMPONENT'), componentClass: 'UNKNOWN', componentType: 'UNKNOWN_COMPONENT', sourceRef: { sourceType: record.sourceType || 'UNKNOWN_SOURCE', sourceId: record.sourceId || 'UNKNOWN_SOURCE_RECORD', rawKind: record.rawKind || 'UNKNOWN_COMPONENT', rawTypeCode: record.rawTypeCode || '' }, topology: {}, geometryIntent: { geometryKind: 'UNKNOWN_PLACEHOLDER', catalogKey: 'unknown' }, renderIntent: { renderRecipeId: 'unknown-placeholder.v1', materialRecipeId: 'unknown-material.v1', fallbackAllowed: true }, metadata: { reason }, diagnostics: [reason] };
}

function buildElementTopology(componentClass, fromNode, toNode, element, props) {
  if (componentClass === 'UNKNOWN') return {};
  if (componentClass === 'TEE') return { ports: (Array.isArray(props.ports) ? props.ports : [{ portId: 'MAIN_A', nodeId: fromNode }, { portId: 'MAIN_B', nodeId: toNode }, { portId: 'BRANCH', nodeId: asNodeId(props.branchNode || props.branchNodeId || element.branchNode) }]).filter((port) => port.nodeId) };
  if (componentClass === 'ELBOW' || componentClass === 'BEND') return { ports: [{ portId: 'IN', nodeId: fromNode }, { portId: 'OUT', nodeId: toNode }].filter((port) => port.nodeId), fromNode, toNode };
  return { fromNode, toNode };
}

function createGeometryContractForComponent(component, nodesById, options) {
  if (component.geometryIntent?.geometryKind === 'FALLBACK_LEGACY') return createFallbackLegacyContract(component, component.geometryIntent.reason || 'legacy fallback renderer');
  if (component.componentClass === 'PIPE') return pipeContract(component, nodesById);
  if (component.componentClass === 'ELBOW' || component.componentClass === 'BEND') return elbowContract(component, nodesById);
  if (component.componentClass === 'TEE') return teeContract(component, nodesById);
  if (component.componentClass === 'VALVE') return valveContract(component, nodesById);
  if (component.componentClass === 'FLANGE') return flangeContract(component, nodesById);
  if (component.componentClass === 'REDUCER') return reducerContract(component, nodesById);
  if (component.componentClass === 'SUPPORT' || component.componentClass === 'RESTRAINT') return restraintContract(component, nodesById);
  if (component.componentClass === 'UNKNOWN') return unknownContract(component, nodesById);
  return options.fallbackForUnhandled ? createFallbackLegacyContract(component, 'unhandled component class') : null;
}

function pipeContract(component, nodesById) {
  const from = positionForNode(nodesById, component.topology.fromNode);
  const to = positionForNode(nodesById, component.topology.toNode);
  if (!from || !to) return null;
  return baseContract(component, 'CYLINDER_BETWEEN_NODES', { placement: { from, to }, dimensions: { outerDiameter: positiveNumber(component.metadata.outerDiameter, 100) }, ports: [{ portId: 'A', position: from }, { portId: 'B', position: to }], renderRecipeId: 'pipe-cylinder-between-nodes.v1' });
}

function elbowContract(component, nodesById) {
  const ports = positionsForPorts(nodesById, component.topology.ports || []);
  if (ports.length < 2) return null;
  return baseContract(component, 'ELBOW_SWEEP', { placement: { origin: ports[0].position }, dimensions: { radius: positiveNumber(component.metadata.bendRadius, positiveNumber(component.metadata.outerDiameter, 100) * 1.5), angleDeg: positiveNumber(component.metadata.bendAngle, 90) }, ports, renderRecipeId: component.componentClass === 'BEND' ? 'bend-sweep.v1' : 'elbow-sweep.v1' });
}

function teeContract(component, nodesById) {
  const ports = positionsForPorts(nodesById, component.topology.ports || []);
  if (ports.length < 3) return null;
  return baseContract(component, 'TEE_COMPOSITE', { placement: { origin: ports[0].position }, dimensions: { mainDiameter: positiveNumber(component.metadata.outerDiameter, 100), branchDiameter: positiveNumber(component.metadata.branchDiameter || component.metadata.branchBore, positiveNumber(component.metadata.outerDiameter, 100)) }, ports, renderRecipeId: 'tee-composite.v1' });
}

function valveContract(component, nodesById) {
  const from = positionForNode(nodesById, component.topology.fromNode);
  const to = positionForNode(nodesById, component.topology.toNode);
  if (!from || !to) return null;
  return baseContract(component, 'VALVE_SYMBOLIC', { placement: { origin: midpoint(from, to), axis: unitVector(from, to) }, dimensions: { faceToFaceLength: distance(from, to), outerDiameter: positiveNumber(component.metadata.outerDiameter, 100) }, ports: [{ portId: 'IN', position: from }, { portId: 'OUT', position: to }], renderRecipeId: 'valve-symbolic.v1' });
}

function flangeContract(component, nodesById) {
  const from = positionForNode(nodesById, component.topology.fromNode);
  const to = positionForNode(nodesById, component.topology.toNode);
  if (!from || !to) return null;
  const od = positiveNumber(component.metadata.outerDiameter, 100);
  return baseContract(component, 'FLANGE_PAIR', { placement: { origin: midpoint(from, to), axis: unitVector(from, to) }, dimensions: { outerDiameter: od * 1.5, thickness: Math.max(10, od * 0.12) }, ports: [{ portId: 'FACE_A', position: from }, { portId: 'FACE_B', position: to }], renderRecipeId: 'flange-pair.v1' });
}

function reducerContract(component, nodesById) {
  const from = positionForNode(nodesById, component.topology.fromNode);
  const to = positionForNode(nodesById, component.topology.toNode);
  if (!from || !to) return null;
  const od = positiveNumber(component.metadata.outerDiameter, 100);
  return baseContract(component, 'REDUCER_TRANSITION', { placement: { from, to }, dimensions: { largeDiameter: positiveNumber(component.metadata.largeDiameter || component.metadata.startBore, od), smallDiameter: positiveNumber(component.metadata.smallDiameter || component.metadata.endBore, od * 0.75) }, ports: [{ portId: 'LARGE', position: from }, { portId: 'SMALL', position: to }], renderRecipeId: 'reducer-transition.v1' });
}

function restraintContract(component, nodesById) {
  const p = positionForNode(nodesById, component.topology.supportNode);
  if (!p) return null;
  return baseContract(component, 'RESTRAINT_SYMBOL', { placement: { anchorPoint: p, axis: component.topology.axis || 'UNKNOWN' }, dimensions: { symbolScale: 1 }, ports: [{ portId: 'SUPPORT_CONTACT', position: p }], renderRecipeId: component.componentClass === 'SUPPORT' ? 'support-symbol.v1' : 'restraint-symbol.v1' });
}

function unknownContract(component, nodesById) {
  return baseContract(component, 'UNKNOWN_PLACEHOLDER', { placement: { origin: positionForNode(nodesById, component.topology.fromNode || component.topology.toNode || component.topology.supportNode) || [0, 0, 0] }, dimensions: { size: 100 }, ports: [], renderRecipeId: 'unknown-placeholder.v1' });
}

function baseContract(component, geometryKind, options) {
  return { schemaVersion: 'GeometryContract.v1', geometryContractId: `GC_${sanitizeId(component.componentId)}_${geometryKind}`, componentId: component.componentId, componentClass: component.componentClass, geometryKind, placement: options.placement || {}, dimensions: options.dimensions || {}, ports: options.ports || [], renderRecipeId: options.renderRecipeId || component.renderIntent?.renderRecipeId || 'unknown-placeholder.v1', selection: { selectable: true, selectionProxy: 'GROUP' }, export: { includeInGlb: true, includeInRvm: true, includeInAtt: true }, fallbackRendered: false, diagnostics: [] };
}

function addNode(nodeMap, nodeId, position) {
  if (!nodeId) return null;
  if (nodeMap.has(nodeId)) return nodeMap.get(nodeId);
  const node = { nodeId, position: isVector3(position) ? position.map(Number) : [0, 0, 0], connectedComponentIds: [] };
  nodeMap.set(nodeId, node);
  return node;
}

function ensureGraphNode(nodeMap, nodeId, position) {
  return nodeId ? (nodeMap.get(nodeId) || addNode(nodeMap, nodeId, position)) : null;
}

function positionForNode(nodesById, nodeId) {
  const node = nodesById.get(asNodeId(nodeId));
  return node && isVector3(node.position) ? node.position : null;
}

function positionsForPorts(nodesById, ports) {
  return ports.map((port) => {
    const position = positionForNode(nodesById, port.nodeId);
    return position ? { portId: port.portId, position } : null;
  }).filter(Boolean);
}

function toPosition(node = {}) {
  return [Number(node.x), Number(node.y), Number(node.z)].map((value) => (Number.isFinite(value) ? value : 0));
}

function axisFromCosines(record = {}) {
  const axes = [['X', Number(record.xCos || 0)], ['Y', Number(record.yCos || 0)], ['Z', Number(record.zCos || 0)]].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  return Math.abs(axes[0][1]) < 0.2 ? 'UNKNOWN' : `${axes[0][1] >= 0 ? '+' : '-'}${axes[0][0]}`;
}

function normalizeSourceType(value) {
  const normalized = normalizeType(value);
  if (['INPUTXML', 'RVM_ATT', 'UXML', 'PCF'].includes(normalized)) return normalized;
  return normalized || 'INPUTXML';
}

function asNodeId(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : String(value);
}

function sanitizeId(value) {
  return String(value || 'UNKNOWN').trim().replace(/[^A-Za-z0-9_:-]+/g, '_').replace(/:+/g, '_');
}

function numberValue(value, fallback = null) {
  if (value && typeof value === 'object' && 'value' in value) value = value.value;
  const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return fallback;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : fallback;
}

function positiveNumber(value, fallback) {
  const n = numberValue(value, fallback);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isVector3(value) {
  return Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(Number(entry)));
}

function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

function distance(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

function unitVector(a, b) {
  const length = distance(a, b);
  return length <= 0 ? [1, 0, 0] : [(b[0] - a[0]) / length, (b[1] - a[1]) / length, (b[2] - a[2]) / length];
}

function naturalSort(a, b) {
  const an = Number(a);
  const bn = Number(b);
  return Number.isFinite(an) && Number.isFinite(bn) ? an - bn : String(a).localeCompare(String(b));
}

function cleanMetadata(value) {
  const out = {};
  for (const [key, entry] of Object.entries(value || {})) {
    if (entry == null || typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') out[key] = entry ?? null;
  }
  return out;
}
