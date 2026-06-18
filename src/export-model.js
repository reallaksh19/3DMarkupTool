import { parseIsonoteExpectedRecords } from './parser.js?v=professional-viewer-3';

const MATERIALS = {
  pipe: 12,
  rigid: 27,
  bend: 6,
  rest: 6,
  guide: 17,
  lineStop: 19,
  holddown: 22,
  spring: 31,
  warning: 11
};

/**
 * Builds a renderer-neutral export tree from parsed InputXML.
 * Parameters: parsed model from parseInputXml and explicit converter options.
 * Output: named hierarchy with RVM primitive records and ATT-ready attributes.
 * Fallback: missing dimensions use conservative visible defaults instead of silently omitting components.
 */
export function buildRvmExportModel(model, options) {
  const opts = options || {};
  const elementByNode = buildElementIndex(model);
  const components = model.elements.map((element) => createComponentNode(element, elementByNode));
  const supports = createSupportNodes(model, opts, elementByNode);
  const annotations = createAnnotationNodes(model, opts, elementByNode);
  const root = {
    name: 'INPUTXML_RVM_ROOT',
    material: MATERIALS.pipe,
    attributes: {
      TYPE: 'MODEL_ROOT',
      SOURCE: 'InputXML',
      EXPORT_FORMAT: 'RVM_ATT',
      TARGET_VIEWER: 'Navisworks',
      SUPPORT_MODE: opts.supportMode || 'compare'
    },
    primitives: [],
    children: [
      {
        name: 'PLANT_GEOMETRY',
        material: MATERIALS.pipe,
        attributes: { TYPE: 'GROUP', ROLE: 'PLANT_GEOMETRY' },
        primitives: [],
        children: components
      },
      {
        name: 'SUPPORTS_RESTRAINTS',
        material: MATERIALS.warning,
        attributes: { TYPE: 'GROUP', ROLE: 'SUPPORTS_RESTRAINTS' },
        primitives: [],
        children: supports
      },
      {
        name: 'ANNOTATIONS',
        material: MATERIALS.warning,
        attributes: { TYPE: 'GROUP', ROLE: 'ANNOTATIONS' },
        primitives: [],
        children: annotations
      }
    ]
  };

  return {
    root,
    audit: {
      componentCount: components.length,
      supportCount: supports.length,
      annotationCount: annotations.length,
      primitiveCount: countPrimitives(root),
      targetViewer: 'Navisworks',
      supportMode: opts.supportMode || 'compare'
    }
  };
}

function createAnnotationNodes(model, options, elementByNode) {
  const nodes = [];
  if (options.nodeLabels !== false) {
    for (const node of model.nodes.values()) {
      const point = pointFromNode(node);
      const od = localOd(elementByNode, node.id);
      nodes.push({
        name: safeName(`NODE_LABEL_${node.id}`),
        material: MATERIALS.warning,
        attributes: {
          TYPE: 'NODE',
          NODE: node.id,
          LABEL: `N${node.id}`,
          SOURCE: 'InputXML',
          X: node.x,
          Y: node.y,
          Z: node.z
        },
        primitives: [{
          kind: 'sphere',
          name: safeName(`NODE_MARKER_${node.id}`),
          center: point,
          diameter: Math.max(od * 0.22, 20),
          material: MATERIALS.warning
        }],
        children: []
      });
    }
  }

  if (options.isonoteBoards !== false) {
    for (const [nodeId, note] of model.isonoteMap.entries()) {
      const node = nodePosition(model, nodeId);
      if (!node) continue;
      const point = pointFromNode(node);
      const tangent = normalize(localTangent(elementByNode, nodeId));
      const lateral = orthogonal(tangent);
      const od = localOd(elementByNode, nodeId);
      const boardPos = add(add(point, scale(lateral, Math.max(od * 1.6, 170))), [0, Math.max(od * 1.1, 120), 0]);
      nodes.push({
        name: safeName(`ISONOTE_BOARD_NODE_${nodeId}`),
        material: MATERIALS.warning,
        attributes: {
          TYPE: 'ISONOTE_NAME_PLATE',
          NODE: String(Number(nodeId)),
          SOURCE: 'ISONOTE SIDELOAD',
          SOURCE_NOTE_NAME: note,
          BOARD_TEXT: note
        },
        primitives: [{
          kind: 'box',
          name: safeName(`ISONOTE_BOARD_BOX_${nodeId}`),
          center: boardPos,
          direction: [0, 0, 1],
          lengths: [Math.max(od * 2.6, 260), Math.max(od * 0.08, 8), Math.max(od * 0.9, 95)],
          material: MATERIALS.warning
        }],
        children: []
      });
    }
  }

  return nodes;
}

function createComponentNode(element, elementByNode) {
  const fullStart = pointFromNode(element.from);
  const fullEnd = pointFromNode(element.to);
  const bore = positiveNumber(element.props.bore, 100);
  const radius = Math.max(bore / 2, 1);
  const { start, end } = trimmedElementEndpoints(element, elementByNode, radius, fullStart, fullEnd);
  const delta = sub(end, start);
  const length = vecLength(delta);
  const material = componentMaterial(element);
  const primitives = [];

  if (length > 1e-6) {
    primitives.push({
      kind: 'cylinder',
      name: `${safeName(element.id)}_BODY`,
      center: scale(add(start, end), 0.5),
      direction: normalize(delta),
      radius,
      length,
      material
    });
  } else {
    primitives.push({
      kind: 'sphere',
      name: `${safeName(element.id)}_POINT_BODY`,
      center: start,
      diameter: radius * 2,
      material
    });
  }

  if (isRigidElement(element) && length > 1e-6) {
    primitives.push({
      kind: 'cylinder',
      name: `${safeName(element.id)}_RIGID_MARKER`,
      center: scale(add(start, end), 0.5),
      direction: normalize(delta),
      radius: radius * 1.35,
      length: Math.max(Math.min(length * 0.18, radius * 4), radius),
      material
    });
  }

  if (isBendElement(element)) {
    const bendPrimitives = bendSegmentPrimitives(element, elementByNode, radius);
    primitives.push(...bendPrimitives);
  }

  return {
    name: safeName(element.id),
    material,
    attributes: componentAttributes(element),
    primitives,
    children: []
  };
}

function trimmedElementEndpoints(element, elementByNode, pipeRadius, fullStart, fullEnd) {
  const direction = sub(fullEnd, fullStart);
  const length = vecLength(direction);
  if (length < 1e-8) return { start: fullStart, end: fullEnd };
  const dir = normalize(direction);
  const startTrim = startBendTrim(element, elementByNode, pipeRadius);
  const endTrim = isBendElement(element) ? bendCenterlineRadius(element, pipeRadius) : 0;
  const limit = length * 0.42;
  const start = add(fullStart, scale(dir, Math.min(startTrim, limit)));
  const end = sub(fullEnd, scale(dir, Math.min(endTrim, limit)));
  if (vecLength(sub(end, start)) < Math.max(pipeRadius, 0.001)) return { start: fullStart, end: fullEnd };
  return { start, end };
}

function startBendTrim(element, elementByNode, pipeRadius) {
  const connected = elementByNode.get(String(Number(element.fromNode))) || [];
  const previousBend = connected.find((candidate) => candidate !== element && candidate.toNode === String(Number(element.fromNode)) && isBendElement(candidate));
  return previousBend ? bendCenterlineRadius(previousBend, pipeRadius) : 0;
}

function isBendElement(element) {
  return element.type.includes('BEND') || Boolean(element.props.bendRadius);
}

function bendSegmentPrimitives(element, elementByNode, pipeRadius) {
  const corner = pointFromNode(element.to);
  const incoming = [element.dx, element.dy, element.dz];
  if (vecLength(incoming) < 1e-8) return [];
  const outgoing = connectedDirectionAtNode(elementByNode, element.toNode, element);
  if (!outgoing || vecLength(outgoing) < 1e-8) {
    return [{
      kind: 'sphere',
      name: `${safeName(element.id)}_BEND_MARKER`,
      center: corner,
      diameter: pipeRadius * 2.36,
      material: MATERIALS.bend
    }];
  }

  const inDir = normalize(incoming);
  const outDir = normalize(outgoing);
  const bendRadius = bendCenterlineRadius(element, pipeRadius);
  const start = sub(corner, scale(inDir, bendRadius));
  const end = add(corner, scale(outDir, bendRadius));
  const segments = 10;
  const primitives = [];
  let previous = start;
  for (let index = 1; index <= segments; index += 1) {
    const current = quadraticPoint(start, corner, end, index / segments);
    const delta = sub(current, previous);
    const length = vecLength(delta);
    if (length > 1e-6) {
      primitives.push({
        kind: 'cylinder',
        name: `${safeName(element.id)}_BEND_SEG_${String(index).padStart(2, '0')}`,
        center: scale(add(previous, current), 0.5),
        direction: normalize(delta),
        radius: pipeRadius * 1.02,
        length,
        material: MATERIALS.bend
      });
    }
    previous = current;
  }
  return primitives;
}

function connectedDirectionAtNode(elementByNode, nodeId, currentElement) {
  const elements = elementByNode.get(String(Number(nodeId))) || [];
  const next = elements.find((element) => element !== currentElement && element.fromNode === String(Number(nodeId)))
    || elements.find((element) => element !== currentElement);
  if (!next) return null;
  if (next.fromNode === String(Number(nodeId))) return [next.dx, next.dy, next.dz];
  return [-next.dx, -next.dy, -next.dz];
}

function bendCenterlineRadius(element, pipeRadius) {
  const explicit = Number(element.props.bendRadius);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return pipeRadius * 2 * 1.5;
}

function quadraticPoint(start, control, end, t) {
  const inv = 1 - t;
  return add(add(scale(start, inv * inv), scale(control, 2 * inv * t)), scale(end, t * t));
}

function componentAttributes(element) {
  const p = element.props;
  return {
    TYPE: 'COMPONENT',
    ID: p.id,
    REF_NO: p.refNo,
    ENGINEERING_TYPE: p.type,
    MESH_ROLE: p.meshRole,
    LINE_NO: p.lineNo,
    LINE_NO_SOURCE: p.lineNoSource,
    FROM_NODE: p.fromNode,
    TO_NODE: p.toNode,
    BORE: p.bore,
    WALL_THICKNESS: resolvedValue(p.wallThickness),
    WALL_THICKNESS_SOURCE: resolvedSource(p.wallThickness),
    MATERIAL_THICKNESS: resolvedValue(p.materialThickness),
    MATERIAL_THICKNESS_SOURCE: resolvedSource(p.materialThickness),
    MATERIAL: resolvedValue(p.material),
    MATERIAL_SOURCE: resolvedSource(p.material),
    PRESSURE: resolvedValue(p.pressure),
    PRESSURE_SOURCE: resolvedSource(p.pressure),
    HYDRO_PRESSURE: resolvedValue(p.hydroPressure),
    HYDRO_PRESSURE_SOURCE: resolvedSource(p.hydroPressure),
    TEMP1: resolvedValue(p.temp1),
    TEMP1_SOURCE: resolvedSource(p.temp1),
    TEMP2: resolvedValue(p.temp2),
    TEMP2_SOURCE: resolvedSource(p.temp2),
    TEMP3: resolvedValue(p.temp3),
    TEMP3_SOURCE: resolvedSource(p.temp3),
    RIGID_TYPE: p.rigidType,
    RIGID_WEIGHT: p.rigidWeight,
    BEND_RADIUS: p.bendRadius,
    BEND_ANGLE: p.bendAngle,
    SOURCE: p.source
  };
}

function createSupportNodes(model, options, elementByNode) {
  const records = collectSupportRecords(model, options);
  return records.flatMap((record, index) => {
    const pos = nodePosition(model, record.node);
    if (!pos) return [];
    const primitives = supportPrimitives(model, record, elementByNode);
    if (!primitives.length) return [];
    const name = safeName(`${record.sourceClass}_${record.node}_${record.family}_${index + 1}`);
    return [{
      name,
      material: supportMaterial(record.family),
      attributes: supportAttributes(record, name),
      primitives,
      children: []
    }];
  });
}

function collectSupportRecords(model, options) {
  const mode = options.supportMode || 'compare';
  const actual = mode === 'inputxml-actual' || mode === 'compare'
    ? normalizeInputXmlRestraints(model).map((record) => ({ ...record, sourceClass: 'ACTUAL' }))
    : [];
  const expected = mode === 'isonote-expected' || mode === 'compare'
    ? parseIsonoteExpectedRecords(model, options).map((record) => ({ ...record, sourceClass: 'EXPECTED' }))
    : [];
  return actual.concat(expected);
}

function normalizeInputXmlRestraints(model) {
  return model.restraints.map((restraint) => {
    const family = classifyByTypeCode(restraint.typeCode);
    return {
      ...restraint,
      family,
      sourceMode: 'ACTUAL_INPUTXML',
      source: 'InputXML',
      axis: axisFromCosines(restraint) || 'PIPE_AXIAL',
      sign: 'UNKNOWN',
      loadText: null,
      sourceNoteName: ''
    };
  });
}

function classifyByTypeCode(typeCode) {
  const value = String(typeCode || '').trim().toUpperCase();
  if (value === '7' || value.includes('GUIDE')) return 'GUIDE';
  if (value === '1' || value.includes('ANCHOR')) return 'ANCHOR';
  if (value.includes('HANGER') || value.includes('SPRING')) return 'SPRING';
  if (value.includes('LIM') || value.includes('LIMIT')) return 'LIMIT';
  if (value.includes('STOP') || value === '3') return 'LINE_STOP';
  return 'AXIS_RESTRAINT';
}

function axisFromCosines(restraint) {
  const axes = [
    ['X', Math.abs(restraint.xCos || 0), restraint.xCos || 0],
    ['Y', Math.abs(restraint.yCos || 0), restraint.yCos || 0],
    ['Z', Math.abs(restraint.zCos || 0), restraint.zCos || 0]
  ];
  axes.sort((a, b) => b[1] - a[1]);
  if (axes[0][1] <= 0.2) return null;
  return `${axes[0][2] >= 0 ? '+' : '-'}${axes[0][0]}`;
}

function supportPrimitives(model, record, elementByNode) {
  const node = nodePosition(model, record.node);
  if (!node) return [];
  const point = pointFromNode(node);
  const tangent = normalize(localTangent(elementByNode, record.node));
  const od = localOd(elementByNode, record.node);
  const contactRadius = od / 2;
  const visualLane = od * 2 / 3;
  const gap = Number.isFinite(record.gapMm) ? record.gapMm * 10 : 0;
  const symbolLength = Math.max(od * 1.2, 80);
  const arrowRadius = Math.max(od * 0.08, 8);
  const material = supportMaterial(record.family);
  const prefix = safeName(`${record.sourceClass}_${record.node}_${record.family}`);

  if (record.family === 'REST') {
    const tip = add(point, [0, -contactRadius - gap, 0]);
    return arrowTowardTip(`${prefix}_PLUS_Y`, tip, [0, 1, 0], symbolLength, arrowRadius, material);
  }

  if (record.family === 'HOLDDOWN') {
    const topTip = add(point, [0, contactRadius + gap, 0]);
    const bottomTip = add(point, [0, -contactRadius - gap, 0]);
    return arrowTowardTip(`${prefix}_DOWN`, topTip, [0, -1, 0], symbolLength, arrowRadius, material)
      .concat(arrowTowardTip(`${prefix}_UP`, bottomTip, [0, 1, 0], symbolLength, arrowRadius, material));
  }

  if (record.family === 'GUIDE') {
    return guideAxesForTangent(tangent).flatMap((axis) => {
      const dir = axisVector(`+${axis}`);
      const plusTip = add(point, scale(dir, contactRadius + gap));
      const minusTip = add(point, scale(dir, -contactRadius - gap));
      return arrowTowardTip(`${prefix}_PLUS_${axis}`, plusTip, scale(dir, -1), symbolLength, arrowRadius, material)
        .concat(arrowTowardTip(`${prefix}_MINUS_${axis}`, minusTip, dir, symbolLength, arrowRadius, material));
    });
  }

  if (record.family === 'LINE_STOP' || record.family === 'LIMIT' || record.family === 'ANCHOR') {
    const lane = scale(orthogonal(tangent), visualLane);
    const center = add(point, lane);
    const separation = gap > 0 ? gap : 0;
    const tipA = add(center, scale(tangent, separation / 2));
    const tipB = add(center, scale(tangent, -separation / 2));
    return arrowTowardTip(`${prefix}_AXIAL_A`, tipA, scale(tangent, -1), symbolLength, arrowRadius, material)
      .concat(arrowTowardTip(`${prefix}_AXIAL_B`, tipB, tangent, symbolLength, arrowRadius, material));
  }

  if (record.family === 'AXIS_RESTRAINT') {
    const dir = axisVector(record.axis || '+X');
    const parallel = Math.abs(dot(dir, tangent)) > 0.85;
    const lane = parallel ? scale(orthogonal(tangent), visualLane) : [0, 0, 0];
    const tip = add(add(point, lane), scale(dir, contactRadius + gap));
    return arrowTowardTip(`${prefix}_${record.axis || 'AXIS'}`, tip, scale(dir, -1), symbolLength, arrowRadius, material);
  }

  if (record.family === 'AXIS_RESTRAINT_UNRESOLVED') {
    return [boxPrimitive(`${prefix}_WARNING_BOX`, add(point, [0, Math.max(od, 100), od * 0.65]), [od * 0.5, od * 0.5, od * 0.5], MATERIALS.warning)];
  }

  if (record.family === 'SPRING_WARNING' || record.family === 'SPRING') {
    return springWarningPrimitives(prefix, add(point, [0, -contactRadius - gap - symbolLength * 0.65, 0]), tangent, od, material);
  }

  return [boxPrimitive(`${prefix}_UNMAPPED_BOX`, add(point, [0, od, 0]), [od * 0.45, od * 0.45, od * 0.45], MATERIALS.warning)];
}

function supportAttributes(record, exportName) {
  return {
    TYPE: 'SUPPORT_RESTRAINT',
    ID: exportName,
    NODE: record.node,
    FAMILY: record.family,
    AXIS: record.axis,
    SIGN: record.sign,
    SOURCE_CLASS: record.sourceClass,
    SOURCE: record.source,
    SOURCE_MODE: record.sourceMode,
    LOAD_TEXT: record.loadText || 'N/A',
    GAP_MM: record.gapMm ?? 'N/A',
    SOURCE_NOTE_NAME: record.sourceNoteName || 'N/A',
    WARNING_TEXT: record.warningText || 'N/A',
    POPUP_REQUIRED: String(Boolean(record.popupRequired)),
    TARGET_VIEWER: 'Navisworks'
  };
}

function arrowTowardTip(name, tip, directionTowardTip, length, radius, material) {
  const dir = normalize(directionTowardTip);
  const headLength = length * 0.32;
  const stemLength = length - headLength;
  const stemCenter = sub(tip, scale(dir, headLength + stemLength / 2));
  const headCenter = sub(tip, scale(dir, headLength / 2));
  return [
    {
      kind: 'cylinder',
      name: `${name}_STEM`,
      center: stemCenter,
      direction: dir,
      radius: radius * 0.35,
      length: stemLength,
      material
    },
    {
      kind: 'pyramid',
      name: `${name}_HEAD`,
      center: headCenter,
      direction: dir,
      bottom: [radius * 2, radius * 2],
      top: [Math.max(radius * 0.05, 0.01), Math.max(radius * 0.05, 0.01)],
      offset: [0, 0],
      height: headLength,
      material
    }
  ];
}

function boxPrimitive(name, center, lengths, material) {
  return {
    kind: 'box',
    name,
    center,
    direction: [0, 0, 1],
    lengths,
    material
  };
}

function springWarningPrimitives(prefix, center, tangent, od, material) {
  const count = 5;
  const spacing = Math.max(od * 0.18, 18);
  const radius = Math.max(od * 0.06, 6);
  const length = Math.max(od * 0.55, 45);
  const lateral = orthogonal(tangent);
  const primitives = [];
  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * spacing;
    primitives.push({
      kind: 'cylinder',
      name: `${prefix}_SPRING_${index + 1}`,
      center: add(center, scale(tangent, offset)),
      direction: lateral,
      radius,
      length,
      material
    });
  }
  return primitives;
}

function buildElementIndex(model) {
  const index = new Map();
  for (const element of model.elements) {
    for (const node of [element.fromNode, element.toNode]) {
      if (!index.has(node)) index.set(node, []);
      index.get(node).push(element);
    }
  }
  return index;
}

function nodePosition(model, nodeId) {
  return model.nodes.get(String(Number(nodeId))) || null;
}

function localTangent(elementByNode, nodeId) {
  const elements = elementByNode.get(String(Number(nodeId))) || [];
  if (!elements.length) return [1, 0, 0];
  const element = elements[0];
  const tangent = [element.dx, element.dy, element.dz];
  return vecLength(tangent) > 1e-8 ? tangent : [1, 0, 0];
}

function localOd(elementByNode, nodeId) {
  const elements = elementByNode.get(String(Number(nodeId))) || [];
  if (!elements.length) return 100;
  return positiveNumber(elements[0].props.bore, 100);
}

function guideAxesForTangent(tangent) {
  const axis = dominantAxis(tangent);
  if (axis === 'X') return ['Z'];
  if (axis === 'Z') return ['X'];
  return ['X', 'Z'];
}

function dominantAxis(vector) {
  const values = [Math.abs(vector[0]), Math.abs(vector[1]), Math.abs(vector[2])];
  if (values[0] >= values[1] && values[0] >= values[2]) return 'X';
  if (values[1] >= values[0] && values[1] >= values[2]) return 'Y';
  return 'Z';
}

function axisVector(axis) {
  const value = String(axis || '+X');
  const sign = value.startsWith('-') ? -1 : 1;
  const name = value.replace(/[+\-]/g, '').toUpperCase();
  if (name === 'Y') return [0, sign, 0];
  if (name === 'Z') return [0, 0, sign];
  return [sign, 0, 0];
}

function componentMaterial(element) {
  if (isRigidElement(element)) return MATERIALS.rigid;
  if (element.type.includes('BEND')) return MATERIALS.bend;
  return MATERIALS.pipe;
}

function supportMaterial(family) {
  if (family === 'REST') return MATERIALS.rest;
  if (family === 'GUIDE') return MATERIALS.guide;
  if (family === 'LINE_STOP' || family === 'LIMIT' || family === 'ANCHOR' || family === 'AXIS_RESTRAINT') return MATERIALS.lineStop;
  if (family === 'HOLDDOWN') return MATERIALS.holddown;
  if (family === 'SPRING_WARNING' || family === 'SPRING') return MATERIALS.spring;
  return MATERIALS.warning;
}

function isRigidElement(element) {
  return element.rawType && element.rawType !== 'PIPE' && element.rawType !== 'BEND';
}

function resolvedValue(value) {
  return typeof value === 'object' && value ? value.value : value;
}

function resolvedSource(value) {
  return typeof value === 'object' && value ? value.source : 'explicit';
}

function pointFromNode(node) {
  return [Number(node.x) || 0, Number(node.y) || 0, Number(node.z) || 0];
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function safeName(value) {
  const clean = String(value || 'UNNAMED').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return clean || 'UNNAMED';
}

function countPrimitives(node) {
  const own = Array.isArray(node.primitives) ? node.primitives.length : 0;
  return own + (node.children || []).reduce((sum, child) => sum + countPrimitives(child), 0);
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(vector, factor) {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function vecLength(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalize(vector) {
  const length = vecLength(vector);
  return length > 1e-12 ? scale(vector, 1 / length) : [1, 0, 0];
}

function orthogonal(direction) {
  const dir = normalize(direction);
  const reference = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return normalize(cross(dir, reference));
}
