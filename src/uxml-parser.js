const DEFAULT_UNITS = Object.freeze({ length: 'mm' });

export function isUxmlDocument(value) {
  const doc = unwrapUxmlDocument(value);
  if (!doc || typeof doc !== 'object') return false;
  const hasTopologyArrays = Array.isArray(doc.components)
    && (Array.isArray(doc.anchors) || Array.isArray(doc.ports) || Array.isArray(doc.segments));
  if (!hasTopologyArrays) return false;
  if (doc.schemaVersion || doc.profile) return true;
  return Array.isArray(doc.components) && Array.isArray(doc.segments) && Array.isArray(doc.anchors);
}

export function unwrapUxmlDocument(value) {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value.components)) return value;
  for (const key of ['uxml', 'uxmlDocument', 'document', 'data', 'payload', 'model']) {
    if (value[key] && typeof value[key] === 'object') {
      const inner = unwrapUxmlDocument(value[key]);
      if (inner) return inner;
    }
  }
  return null;
}

export function parseUxmlText(text, options = {}) {
  let json;
  try {
    json = JSON.parse(String(text || ''));
  } catch (err) {
    throw new Error(`Invalid UXML JSON: ${err.message}`);
  }
  const doc = unwrapUxmlDocument(json);
  if (!isUxmlDocument(doc)) {
    throw new Error('JSON is not a recognized UXML topology document.');
  }
  return parseUxmlDocument(doc, options);
}

export function parseUxmlDocument(doc, options = {}) {
  const anchors = new Map((doc.anchors || []).map((anchor) => [String(anchor.id || ''), anchor]));
  const ports = new Map((doc.ports || []).map((port) => [String(port.id || ''), port]));
  const segments = new Map((doc.segments || []).map((segment) => [String(segment.id || ''), segment]));
  const components = [...(doc.components || [])].sort(compareSourceOrder);

  const nodes = new Map();
  const anchorNodeIds = new Map();
  let generatedNode = 10;

  const ensureNode = (anchorId, fallbackPoint = null) => {
    const key = String(anchorId || '');
    if (anchorNodeIds.has(key)) return nodes.get(anchorNodeIds.get(key));
    const anchor = anchors.get(key) || null;
    const point = pointFrom(anchor?.point) || pointFrom(fallbackPoint) || [0, 0, 0];
    const nodeId = numericNodeId(anchor?.nodeNumber ?? anchor?.nodeLabel);
    const id = nodeId || String(generatedNode);
    generatedNode += 10;
    const node = { id, x: point[0], y: point[1], z: point[2], sourceAnchorId: key, source: 'UXML' };
    nodes.set(String(Number(id)), node);
    anchorNodeIds.set(key, String(Number(id)));
    return node;
  };

  const pipelineByRef = new Map((doc.pipelines || []).map((pipeline) => [String(pipeline.id || pipeline.pipelineRef || ''), pipeline]));
  const lineMap = new Map();
  const isonoteMap = new Map();
  const elements = [];
  const skipped = [];

  for (const component of components) {
    if (isSupportComponent(component)) continue;
    const componentSegments = segmentRefsForComponent(component, segments);
    if (!componentSegments.length) {
      const fallback = elementFromComponentAnchors(component, anchors, ports, ensureNode, pipelineByRef);
      if (fallback) elements.push(fallback);
      else skipped.push(component.id || component.name || component.refNo || 'unnamed-component');
      continue;
    }

    for (const segment of componentSegments) {
      const element = elementFromSegment(component, segment, anchors, ports, ensureNode, pipelineByRef);
      if (element) elements.push(element);
      else skipped.push(component.id || component.name || component.refNo || segment.id || 'unnamed-segment');
    }
  }

  const restraints = [];
  for (const support of doc.supports || []) {
    const rec = supportRecordFromUxmlSupport(support, anchors, ensureNode);
    if (rec) restraints.push(rec);
  }
  for (const component of components) {
    if (!isSupportComponent(component)) continue;
    const rec = supportRecordFromUxmlComponent(component, anchors, ports, ensureNode);
    if (rec) restraints.push(rec);
  }

  return {
    doc,
    sourceKind: 'UXML',
    sourceSchemaVersion: doc.schemaVersion || '',
    units: doc.units || DEFAULT_UNITS,
    elements,
    nodes,
    restraints,
    lineMap,
    isonoteMap,
    diagnostics: [
      ...(doc.diagnostics || []),
      ...skipped.map((id) => ({ level: 'warn', code: 'UXML_COMPONENT_SKIPPED_NO_GEOMETRY', componentId: id }))
    ],
    rawUxml: doc,
  };
}

function elementFromSegment(component, segment, anchors, ports, ensureNode, pipelineByRef) {
  const startAnchor = anchorForSegmentEnd(segment.startAnchorId, component, 'START', anchors, ports);
  const endAnchor = anchorForSegmentEnd(segment.endAnchorId, component, 'END', anchors, ports);
  if (!startAnchor || !endAnchor) return null;
  const from = ensureNode(startAnchor.id, startAnchor.point);
  const to = ensureNode(endAnchor.id, endAnchor.point);
  return buildElement(component, segment, from, to, pipelineByRef);
}

function elementFromComponentAnchors(component, anchors, ports, ensureNode, pipelineByRef) {
  const anchorIds = [...new Set([
    ...(component.anchorIds || []),
    ...(component.portIds || []).map((portId) => ports.get(String(portId))?.anchorId).filter(Boolean),
  ].map(String))];
  if (!anchorIds.length) return null;
  const fromAnchor = anchors.get(anchorIds[0]);
  const toAnchor = anchors.get(anchorIds[1]) || fromAnchor;
  if (!fromAnchor || !toAnchor) return null;
  const from = ensureNode(fromAnchor.id, fromAnchor.point);
  const to = ensureNode(toAnchor.id, toAnchor.point);
  return buildElement(component, null, from, to, pipelineByRef);
}

function buildElement(component, segment, from, to, pipelineByRef) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const id = safeId(component.id || component.refNo || component.name || segment?.id || `UXML_${from.id}_${to.id}`);
  const rawType = rawComponentType(component);
  const cleanType = normalizeComponentType(rawType, component.normalizedType);
  const lineNo = component.lineKey || component.lineNo || pipelineByRef.get(String(component.pipelineRef || ''))?.lineNo || component.pipelineRef || 'UXML';
  const bore = chooseElementBore(component, segment);
  const rawAttributes = { ...(component.rawAttributes || {}) };

  const props = {
    id,
    refNo: component.refNo || component.name || id,
    type: cleanType,
    meshRole: rawType,
    fromNode: from.id,
    toNode: to.id,
    lineNo,
    lineNoSource: component.lineKey ? 'UXML lineKey' : component.pipelineRef ? 'UXML pipelineRef' : 'UXML fallback',
    bore: bore.raw || bore.value || 'N/A',
    branchBore: bore.branchRaw || '',
    startBore: bore.startRaw || '',
    endBore: bore.endRaw || '',
    wallThickness: rawValue(rawAttributes.WALL_THICK || rawAttributes.WALL_THICKNESS || component.normalized?.wallThickness),
    materialThickness: rawValue(rawAttributes.WALL_THICK || rawAttributes.WALL_THICKNESS || component.normalized?.wallThickness),
    material: rawValue(rawAttributes.MTXX || rawAttributes.MATERIAL || rawAttributes.MATERIAL_NAME || component.normalized?.material),
    pressure: rawValue(rawAttributes.PRESSURE1 || rawAttributes.PRESSURE || component.normalized?.pressure),
    hydroPressure: rawValue(rawAttributes.HYDRO_PRESSURE || rawAttributes.HYDROTEST_PRESSURE || component.normalized?.hydroPressure),
    temp1: rawValue(rawAttributes.TEMP_EXP_C1 || rawAttributes.TEMP1 || component.normalized?.temp1),
    temp2: rawValue(rawAttributes.TEMP_EXP_C2 || rawAttributes.TEMP2 || component.normalized?.temp2),
    temp3: rawValue(rawAttributes.TEMP_EXP_C3 || rawAttributes.TEMP3 || component.normalized?.temp3),
    source: 'UXML',
    rigidType: rawType,
    rigidWeight: rawAttributes.WEIGHT || rawAttributes.CMPWEIGHTDRY || '',
    bendRadius: rawAttributes.RADI || rawAttributes.BEND_RADIUS || component.normalized?.bendRadius || '',
    bendAngle: rawAttributes.ANGL || rawAttributes.BEND_ANGLE || component.normalized?.bendAngle || '',
    rawAttributes,
    uxmlComponentId: component.id || '',
    uxmlSegmentId: segment?.id || '',
    uxmlNormalizedType: component.normalizedType || '',
  };

  return {
    id,
    fromNode: String(Number(from.id)),
    toNode: String(Number(to.id)),
    from,
    to,
    dx,
    dy,
    dz,
    type: cleanType,
    rawType,
    props,
    sourceComponent: component,
    sourceSegment: segment,
  };
}

function chooseElementBore(component, segment) {
  const derived = component.derived?.endpointBores || {};
  const raw = component.rawAttributes || {};
  const start = firstBore(
    segment?.startBore,
    segment?.bore,
    derived.ABORE,
    derived.HBOR,
    raw.ABORE,
    raw.HBOR,
    component.bore
  );
  const end = firstBore(
    segment?.endBore,
    segment?.bore,
    derived.LBORE,
    derived.TBOR,
    raw.LBORE,
    raw.TBOR,
    component.bore
  );
  const branch = firstBore(
    segment?.branchBore,
    component.branchBore,
    derived.BBORE,
    raw.BBORE,
    raw.BRBORE,
    raw.OUTLET_BORE
  );
  const primary = firstBore(start, end, branch, component.bore, raw.BORE, raw.DIAMETER, raw.DBOR);
  return {
    value: primary.value,
    raw: primary.raw,
    startRaw: start.raw,
    endRaw: end.raw,
    branchRaw: branch.raw,
  };
}

function supportRecordFromUxmlSupport(support, anchors, ensureNode) {
  const anchor = anchors.get(String(support.supportAnchorId || '')) || null;
  if (!anchor) return null;
  const node = ensureNode(anchor.id, anchor.point);
  const restraint = Array.isArray(support.restraints) ? support.restraints[0] : null;
  const family = classifySupportFamily(restraint?.family || restraint?.type || support.type || support.skey);
  return {
    id: support.id || `UXML_SUPPORT_${node.id}`,
    source: 'UXML',
    sourceMode: 'ACTUAL_UXML',
    node: node.id,
    typeCode: family,
    rawType: support.type || support.skey || family,
    family,
    axis: restraint?.axis || support.axis || 'PIPE_AXIAL_Â±',
    sign: restraint?.sign || 'UNKNOWN',
    loadText: restraint?.loadText || null,
    gapMm: numericValue(restraint?.gapMm ?? support.gapMm),
    xCos: 0,
    yCos: family === 'REST' || family === 'HOLDDOWN' ? 1 : 0,
    zCos: 0,
    sourceNoteName: support.name || support.id || '',
  };
}

function supportRecordFromUxmlComponent(component, anchors, ports, ensureNode) {
  const raw = component.rawAttributes || {};
  const anchorId = component.supportAnchorId
    || component.anchorIds?.[0]
    || ports.get(String(component.portIds?.[0] || ''))?.anchorId;
  const anchor = anchors.get(String(anchorId || '')) || null;
  if (!anchor) return null;
  const node = ensureNode(anchor.id, anchor.point);
  const family = classifySupportFamily(component.type || component.skey || raw.CMPSUPTYPE || raw.SUPPORT_KIND || raw.SUPPORT_TYPE || raw.TYPE);
  return {
    id: component.id || `UXML_SUPPORT_COMPONENT_${node.id}`,
    source: 'UXML',
    sourceMode: 'ACTUAL_UXML_COMPONENT',
    node: node.id,
    typeCode: family,
    rawType: component.type || raw.TYPE || family,
    family,
    axis: raw.AXIS || 'PIPE_AXIAL_Â±',
    sign: 'UNKNOWN',
    loadText: raw.LOAD || null,
    gapMm: numericValue(raw.CMPSUPGAP || raw.GAP_MM || raw.GAP),
    xCos: 0,
    yCos: family === 'REST' || family === 'HOLDDOWN' ? 1 : 0,
    zCos: 0,
    sourceNoteName: component.name || component.refNo || component.id || '',
  };
}

function segmentRefsForComponent(component, segments) {
  const refs = (component.segmentIds || []).map((id) => segments.get(String(id))).filter(Boolean);
  if (refs.length) return refs;
  return [...segments.values()].filter((segment) => String(segment.componentId || '') === String(component.id || ''));
}

function anchorForSegmentEnd(anchorId, component, role, anchors, ports) {
  if (anchorId && anchors.has(String(anchorId))) return anchors.get(String(anchorId));
  const wanted = String(role || '').toUpperCase();
  for (const portId of component.portIds || []) {
    const port = ports.get(String(portId));
    if (!port) continue;
    if (upper(port.role).includes(wanted) && anchors.has(String(port.anchorId))) return anchors.get(String(port.anchorId));
  }
  const anchorIds = component.anchorIds || [];
  if (wanted === 'START' && anchorIds[0] && anchors.has(String(anchorIds[0]))) return anchors.get(String(anchorIds[0]));
  if (wanted === 'END' && anchorIds[1] && anchors.has(String(anchorIds[1]))) return anchors.get(String(anchorIds[1]));
  return null;
}

function compareSourceOrder(a, b) {
  return sourceOrder(a) - sourceOrder(b);
}

function sourceOrder(component) {
  for (const value of [component.seqNo, component.SEQ, component.sourceIndex, component.rawAttributes?.SOURCE_INDEX]) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  const id = String(component.id || component.refNo || component.name || '');
  const m = id.match(/[:/_-](\d{1,8})$/);
  if (m) return Number(m[1]);
  return Number.MAX_SAFE_INTEGER;
}

function isSupportComponent(component) {
  const text = upper([component.type, component.normalizedType, component.skey, component.rawAttributes?.TYPE, component.rawAttributes?.CMPSUPTYPE].filter(Boolean).join(' '));
  return /\b(SUPPORT|RESTRAINT|HANGER|SPRING|ATTA|REST|GUIDE|LINE\s*STOP|LINESTOP|HOLDDOWN)\b/.test(text);
}

function classifySupportFamily(value) {
  const t = upper(value);
  if (t.includes('GUIDE') || /\bPG\b/.test(t)) return 'GUIDE';
  if (t.includes('HOLD')) return 'HOLDDOWN';
  if (t.includes('LINE') || t.includes('STOP') || t.includes('LIMIT') || /\bLS\b/.test(t)) return 'LINE_STOP';
  if (t.includes('SPRING') || t.includes('HANGER')) return 'SPRING';
  if (t.includes('REST') || /\bBP\b/.test(t)) return 'REST';
  return t || 'AXIS_RESTRAINT';
}

function normalizeComponentType(type, normalizedType) {
  const raw = upper(type);
  const normalized = upper(normalizedType);
  if (raw.includes('ELBO') || normalized.includes('ELBOW')) return 'BEND';
  if (raw.includes('BEND')) return 'BEND';
  if (raw.includes('PIPE')) return 'PIPE';
  return raw || normalized || 'COMPONENT';
}

function rawComponentType(component) {
  return component.rawAttributes?.TYPE || component.type || component.normalizedType || component.name || 'COMPONENT';
}

function pointFrom(value) {
  if (!value) return null;
  if (Array.isArray(value) && value.length >= 3) return value.slice(0, 3).map(Number);
  if (typeof value === 'object') {
    const x = numberOrNull(value.x ?? value.X ?? value.e ?? value.E ?? value.east ?? value.EAST);
    const y = numberOrNull(value.y ?? value.Y ?? value.n ?? value.N ?? value.north ?? value.NORTH);
    const z = numberOrNull(value.z ?? value.Z ?? value.u ?? value.U ?? value.up ?? value.UP);
    if ([x, y, z].every((n) => Number.isFinite(n))) return [x, y, z];
  }
  return null;
}

function firstBore(...values) {
  for (const value of values) {
    const parsed = parseBore(value);
    if (parsed.value != null) return parsed;
  }
  return { value: null, raw: '' };
}

function parseBore(value) {
  if (value && typeof value === 'object') {
    if ('value' in value) return parseBore(value.value);
    if ('bore' in value) return parseBore(value.bore);
  }
  const raw = String(value ?? '').trim();
  if (!raw) return { value: null, raw: '' };
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return { value: null, raw };
  const n = Number(match[0]);
  if (!Number.isFinite(n) || n <= 0) return { value: null, raw };
  return { value: n, raw };
}

function rawValue(value) {
  if (value && typeof value === 'object' && 'value' in value) value = value.value;
  if (value == null || value === '') return { value: 'N/A', source: 'unavailable' };
  return { value, source: 'UXML' };
}

function numericValue(value) {
  const parsed = parseBore(value);
  return parsed.value;
}

function numericNodeId(value) {
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) && n > 0 ? String(n) : '';
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function upper(value) {
  return String(value ?? '').trim().toUpperCase();
}

function safeId(value) {
  return String(value || 'UXML_COMPONENT').replace(/[^\w:.-]+/g, '_');
}
