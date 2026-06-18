import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { parseIsonoteExpectedRecords } from './parser.js?v=professional-viewer-3';
import { parseMarkupSource } from './source-parser.js?v=20260618-uxml-source-1';
import {
  COLORS,
  mat,
  vectorFrom,
  cylinderBetween,
  coneArrow,
  arrowToward,
  createTextPlane,
  createNodeLabel,
  createWarningTriangle,
  createSpringCoil,
  orthogonal,
  dominantAxis,
  axisVector
} from './geometry.js?v=professional-viewer-3';

const SCALE = 0.01;
const pipeMat = mat(COLORS.pipe, { roughness: 0.66, metalness: 0.08 });
const rigidMat = mat(COLORS.rigid, { roughness: 0.58, metalness: 0.14 });
const valveMat = mat(COLORS.valve, { roughness: 0.54, metalness: 0.12, emissive: 0x12091f, emissiveIntensity: 0.08 });
const bendMat = mat(COLORS.bend, { roughness: 0.6, metalness: 0.1, emissive: 0x032533, emissiveIntensity: 0.1 });
const restMat = mat(COLORS.rest, { emissive: 0x063244, emissiveIntensity: 0.18 });
const guideMat = mat(COLORS.guide, { emissive: 0x063322, emissiveIntensity: 0.16 });
const lineMat = mat(COLORS.lineStop, { emissive: 0x3a2500, emissiveIntensity: 0.18 });
const holdMat = mat(COLORS.holddown, { emissive: 0x330026, emissiveIntensity: 0.18 });
const springMat = mat(COLORS.spring, { emissive: 0x331021, emissiveIntensity: 0.2 });

export async function convertInputXmlToGlb(sourceText, options = {}) {
  const model = parseMarkupSource(sourceText, options);
  const sourceKind = model.sourceKind || 'InputXML';
  const scene = new THREE.Scene();
  scene.name = `${sourceKind}_GLTF_SCENE`;
  scene.userData = {
    app: 'inputxml-glb-standalone',
    converterVersion: '1.1.0-uxml-source',
    sourceKind,
    sourceMode: options.supportMode || 'compare',
    generatedAt: new Date().toISOString()
  };

  const root = new THREE.Group();
  root.name = `${sourceKind}_GLB_ROOT`;
  scene.add(root);

  const nodesGroup = new THREE.Group(); nodesGroup.name = 'nodes';
  const pipesGroup = new THREE.Group(); pipesGroup.name = 'plant.geometry';
  const supportGroup = new THREE.Group(); supportGroup.name = 'supports.restraints';
  const annGroup = new THREE.Group(); annGroup.name = 'annotations';
  root.add(pipesGroup, supportGroup, annGroup, nodesGroup);

  const elementByNode = buildElementIndex(model);
  const audit = {
    sourceKind,
    sourceSchemaVersion: model.sourceSchemaVersion || '',
    componentCount: model.elements.length,
    nodeCount: model.nodes.size,
    inputXmlRestraints: model.restraints.length,
    actualRestraints: model.restraints.length,
    isonoteRecords: 0,
    supportSymbols: [],
    componentMetadataUpdated: model.elements.length,
    diagnostics: model.diagnostics || [],
    options: { ...options }
  };

  for (const element of model.elements) {
    createElementGeometry(element, pipesGroup, options, elementByNode);
  }

  if (options.nodeLabels !== false) {
    for (const node of model.nodes.values()) {
      const p = vectorFrom(node, SCALE);
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 10), mat(COLORS.node, { emissive: 0x0a3c66, emissiveIntensity: 0.18 }));
      sphere.name = `NODE_MARKER_${node.id}`;
      sphere.position.copy(p);
      sphere.userData = { TYPE: 'NODE', NODE: node.id, LABEL: `N${node.id}`, SOURCE: sourceKind, X: node.x, Y: node.y, Z: node.z };
      const label = createNodeLabel(`N${node.id}`, p.clone().add(new THREE.Vector3(0.35, 0.5, 0.32)), 0.7);
      label.lookAt(new THREE.Vector3(0, 0, 0));
      label.material.depthTest = false;
      label.renderOrder = 15;
      label.userData = { TYPE: 'NODE', NODE: node.id, LABEL: `N${node.id}`, SOURCE: sourceKind, X: node.x, Y: node.y, Z: node.z };
      nodesGroup.add(sphere, label);
    }
  }

  if (options.isonoteBoards !== false) {
    createIsonoteBoards(model, annGroup, elementByNode);
  }

  const mode = options.supportMode || 'compare';
  if (mode === 'inputxml-actual' || mode === 'compare') {
    for (const rec of normalizeInputXmlRestraints(model)) {
      const symbols = createSupportSymbols(model, rec, elementByNode, 'actual');
      symbols.forEach(s => { supportGroup.add(s); audit.supportSymbols.push(s.userData); });
    }
  }
  if (mode === 'isonote-expected' || mode === 'compare') {
    const isonoteRecords = parseIsonoteExpectedRecords(model, options);
    audit.isonoteRecords = isonoteRecords.length;
    for (const rec of isonoteRecords) {
      const symbols = createSupportSymbols(model, rec, elementByNode, 'expected');
      symbols.forEach(s => { supportGroup.add(s); audit.supportSymbols.push(s.userData); });
    }
  }

  frameScene(scene);
  const glb = await exportSceneToGlb(scene);
  return { scene, glb, audit, model };
}

function createElementGeometry(element, group, options, elementByNode) {
  const fullA = vectorFrom(element.from, SCALE);
  const fullB = vectorFrom(element.to, SCALE);
  const od = numberValue(element.props.bore, 100) * SCALE;
  const radius = Math.max(0.04, (od / 2));
  const { a, b } = trimmedElementEndpoints(element, elementByNode, radius, fullA, fullB);
  const isRigid = element.rawType && element.rawType !== 'PIPE' && element.rawType !== 'BEND';
  const isValve = isRigid && /VALVE/i.test(element.rawType || element.props.rigidType || '');
  const material = isValve ? valveMat : isRigid ? rigidMat : element.type === 'BEND' ? bendMat : pipeMat;
  const cyl = cylinderBetween(a, b, radius, material, options.compactMode === false ? 24 : 14, element.id);
  cyl.userData = buildComponentUserData(element);
  group.add(cyl);

  if (isRigid) {
    const dir = b.clone().sub(a).normalize();
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const collar1 = cylinderBetween(mid.clone().sub(dir.clone().multiplyScalar(0.18)), mid.clone().add(dir.clone().multiplyScalar(0.18)), radius * 1.35, rigidMat, 18, `${element.id}_RIGID_MARKER`);
    collar1.userData = { ...cyl.userData, meshRole: 'RIGID_MARKER' };
    group.add(collar1);
  }

  if (isBendElement(element)) {
    const bend = createBendGeometry(element, elementByNode, radius, cyl.userData, options);
    if (bend) group.add(bend);
  }
}

function trimmedElementEndpoints(element, elementByNode, pipeRadius, fullA, fullB) {
  const direction = fullB.clone().sub(fullA);
  const length = direction.length();
  if (length < 1e-8) return { a: fullA, b: fullB };
  const dir = direction.normalize();
  const startTrim = startBendTrim(element, elementByNode, pipeRadius);
  const endTrim = isBendElement(element) ? bendCenterlineRadius(element, pipeRadius) : 0;
  const limit = length * 0.42;
  const a = fullA.clone().add(dir.clone().multiplyScalar(Math.min(startTrim, limit)));
  const b = fullB.clone().sub(dir.clone().multiplyScalar(Math.min(endTrim, limit)));
  if (a.distanceTo(b) < Math.max(pipeRadius, 0.001)) return { a: fullA, b: fullB };
  return { a, b };
}

function startBendTrim(element, elementByNode, pipeRadius) {
  const connected = elementByNode.get(String(Number(element.fromNode))) || [];
  const previousBend = connected.find((candidate) => candidate !== element && candidate.toNode === String(Number(element.fromNode)) && isBendElement(candidate));
  return previousBend ? bendCenterlineRadius(previousBend, pipeRadius) : 0;
}

function isBendElement(element) {
  return element.type.includes('BEND') || Boolean(element.props.bendRadius);
}

function createBendGeometry(element, elementByNode, pipeRadius, userData, options) {
  const corner = vectorFrom(element.to, SCALE);
  const incoming = new THREE.Vector3(element.dx, element.dy, element.dz);
  if (incoming.lengthSq() < 1e-8) return null;
  const outgoing = connectedDirectionAtNode(elementByNode, element.toNode, element);
  if (!outgoing || outgoing.lengthSq() < 1e-8) return null;

  const inDir = incoming.normalize();
  const outDir = outgoing.normalize();
  const bendRadius = bendCenterlineRadius(element, pipeRadius);
  const start = corner.clone().sub(inDir.clone().multiplyScalar(bendRadius));
  const end = corner.clone().add(outDir.clone().multiplyScalar(bendRadius));
  const curve = new THREE.QuadraticBezierCurve3(start, corner, end);
  const segments = options.compactMode === false ? 36 : 22;
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, pipeRadius * 1.02, options.compactMode === false ? 18 : 12, false), bendMat);
  tube.name = `${element.id}_BEND_ELBOW_R${Math.round(bendRadius / SCALE)}`;
  tube.userData = {
    ...userData,
    meshRole: 'BEND_ELBOW',
    bendVisualBasis: element.props.bendRadius ? 'SOURCE RADIUS' : 'ASSUMED_1_5D',
    bendCenterlineRadius: bendRadius / SCALE
  };
  return tube;
}

function connectedDirectionAtNode(elementByNode, nodeId, currentElement) {
  const elements = elementByNode.get(String(Number(nodeId))) || [];
  const next = elements.find((element) => element !== currentElement && element.fromNode === String(Number(nodeId)))
    || elements.find((element) => element !== currentElement);
  if (!next) return null;
  if (next.fromNode === String(Number(nodeId))) return new THREE.Vector3(next.dx, next.dy, next.dz);
  return new THREE.Vector3(-next.dx, -next.dy, -next.dz);
}

function bendCenterlineRadius(element, pipeRadius) {
  const explicit = numberValue(element.props.bendRadius, NaN);
  if (Number.isFinite(explicit) && explicit > 0) return explicit * SCALE;
  return pipeRadius * 2 * 1.5;
}

function buildComponentUserData(element) {
  const p = element.props;
  const resolved = (x) => typeof x === 'object' && x ? x.value : x;
  const source = (x) => typeof x === 'object' && x ? x.source : 'explicit';
  return {
    TYPE: 'COMPONENT',
    ID: p.id,
    id: p.id,
    refNo: p.refNo,
    engineeringType: p.type,
    meshRole: p.meshRole,
    lineNo: p.lineNo,
    lineNoSource: p.lineNoSource,
    fromNode: p.fromNode,
    toNode: p.toNode,
    bore: p.bore,
    branchBore: p.branchBore,
    startBore: p.startBore,
    endBore: p.endBore,
    uxmlComponentId: p.uxmlComponentId,
    uxmlSegmentId: p.uxmlSegmentId,
    uxmlNormalizedType: p.uxmlNormalizedType,
    wallThickness: resolved(p.wallThickness),
    wallThicknessSource: source(p.wallThickness),
    materialThickness: resolved(p.materialThickness),
    materialThicknessSource: source(p.materialThickness),
    material: resolved(p.material),
    materialSource: source(p.material),
    pressure: resolved(p.pressure),
    pressureSource: source(p.pressure),
    hydroPressure: resolved(p.hydroPressure),
    hydroPressureSource: source(p.hydroPressure),
    temp1: resolved(p.temp1),
    temp1Source: source(p.temp1),
    temp2: resolved(p.temp2),
    temp2Source: source(p.temp2),
    temp3: resolved(p.temp3),
    temp3Source: source(p.temp3),
    rigidType: p.rigidType,
    rigidWeight: p.rigidWeight,
    bendRadius: p.bendRadius,
    bendAngle: p.bendAngle,
    rawAttributes: p.rawAttributes,
    source: p.source
  };
}

function buildElementIndex(model) {
  const index = new Map();
  for (const el of model.elements) {
    for (const n of [el.fromNode, el.toNode]) {
      if (!index.has(n)) index.set(n, []);
      index.get(n).push(el);
    }
  }
  return index;
}

function createIsonoteBoards(model, group, elementByNode) {
  for (const [node, note] of model.isonoteMap.entries()) {
    const pos = nodePosition(model, node);
    if (!pos) continue;
    const p = vectorFrom(pos, SCALE);
    const tangent = localTangent(elementByNode, node);
    const lateral = orthogonal(tangent);
    const vertical = new THREE.Vector3(0, 1, 0);
    const boardPos = p.clone().add(lateral.clone().multiplyScalar(2.35)).add(vertical.clone().multiplyScalar(1.55));
    const board = createTextPlane(note, { width: 900, height: 270, fontSize: 31, scale: 1.08, name: `ISONOTE_BOARD_NODE_${node}`, bg: 'rgba(33,27,46,0.94)', border: '#f8c34a' });
    board.position.copy(boardPos);
    board.lookAt(p.clone().add(new THREE.Vector3(0, 0.2, 0)));
    board.material.depthTest = false;
    board.renderOrder = 14;
    board.userData = { TYPE: 'ISONOTE_NAME_PLATE', NODE: node, node, sourceNoteName: note, SOURCE_NOTE_NAME: note, BOARD_TEXT: note, source: 'ISONOTE SIDELOAD', SOURCE: 'ISONOTE SIDELOAD' };
    const leader = cylinderBetween(p, boardPos, 0.025, mat(0xf8c34a, { emissive: 0x3b2a00, emissiveIntensity: 0.16 }), 10, `ISONOTE_LEADER_NODE_${node}`);
    leader.userData = { TYPE: 'ISONOTE_LEADER', NODE: node, node, sourceNoteName: note, SOURCE_NOTE_NAME: note };
    group.add(leader, board);
  }
}

function normalizeInputXmlRestraints(model) {
  return model.restraints.map((r) => {
    const family = r.family || classifyByTypeCode(r.typeCode);
    return {
      ...r,
      family,
      sourceMode: r.sourceMode || (model.sourceKind === 'UXML' ? 'ACTUAL_UXML' : 'ACTUAL_INPUTXML'),
      source: r.source || model.sourceKind || 'InputXML',
      axis: r.axis || axisFromCosines(r) || 'PIPE_AXIAL_±',
      sourceNoteName: r.sourceNoteName || ''
    };
  });
}

function classifyByTypeCode(typeCode) {
  const t = String(typeCode || '').trim().toUpperCase();
  if (t === '7' || t.includes('GUIDE')) return 'GUIDE';
  if (t === '1' || t.includes('ANCHOR')) return 'ANCHOR';
  if (t.includes('HANGER') || t.includes('SPRING')) return 'SPRING';
  if (t.includes('LIM') || t.includes('LIMIT')) return 'LIMIT';
  if (t.includes('STOP') || t === '3') return 'LINE_STOP';
  if (t.includes('REST')) return 'REST';
  if (t.includes('HOLD')) return 'HOLDDOWN';
  return 'AXIS_RESTRAINT';
}

function axisFromCosines(r) {
  const axes = [ ['X', Math.abs(r.xCos || 0)], ['Y', Math.abs(r.yCos || 0)], ['Z', Math.abs(r.zCos || 0)] ];
  axes.sort((a, b) => b[1] - a[1]);
  if (axes[0][1] > 0.2) return `${(r[`${axes[0][0].toLowerCase()}Cos`] || 1) >= 0 ? '+' : '-'}${axes[0][0]}`;
  return null;
}

function createSupportSymbols(model, rec, elementByNode, sourceClass) {
  const pos = nodePosition(model, rec.node);
  if (!pos) return [];
  const p = vectorFrom(pos, SCALE);
  const tangent = localTangent(elementByNode, rec.node).normalize();
  const od = localOd(elementByNode, rec.node) * SCALE;
  const contactRadius = od / 2;
  const visualLane = od * 2 / 3;
  const gap = Number.isFinite(rec.gapMm) ? rec.gapMm * SCALE * 10 : 0;
  const symbolLength = Math.max(1.15, od * 1.35);
  const arrowRadius = Math.max(0.18, od * 0.15);
  const family = rec.family;
  const prefix = `${sourceClass.toUpperCase()}_${rec.node}_${family}`;
  const out = [];
  const addMeta = (obj, extra = {}) => {
    obj.userData = {
      TYPE: 'SUPPORT_RESTRAINT',
      sourceClass,
      source: rec.source,
      sourceMode: rec.sourceMode,
      node: rec.node,
      family,
      axis: rec.axis,
      sign: rec.sign,
      loadText: rec.loadText,
      gapMm: rec.gapMm,
      sourceNoteName: rec.sourceNoteName,
      mappingContract: 'common-support-mapper-standalone',
      ...extra
    };
    return obj;
  };

  if (family === 'REST') {
    const start = p.clone().add(new THREE.Vector3(0, -contactRadius - gap - symbolLength, 0));
    out.push(addMeta(coneArrow(start, new THREE.Vector3(0, 1, 0), symbolLength, arrowRadius, restMat, `${prefix}_REST_PLUS_Y`), { engineeringContact: 'OD/2', visualResolverApplied: false }));
  } else if (family === 'HOLDDOWN') {
    const upTip = p.clone().add(new THREE.Vector3(0, contactRadius + gap, 0));
    const downTip = p.clone().add(new THREE.Vector3(0, -contactRadius - gap, 0));
    const g = new THREE.Group(); g.name = `${prefix}_HOLDDOWN_PM_Y`;
    g.add(arrowToward(upTip, new THREE.Vector3(0, -1, 0), symbolLength * 0.82, arrowRadius * 0.9, holdMat, 'holddown_down'));
    g.add(arrowToward(downTip, new THREE.Vector3(0, 1, 0), symbolLength * 0.82, arrowRadius * 0.9, holdMat, 'holddown_up'));
    out.push(addMeta(g, { engineeringContact: 'OD/2', visualResolverApplied: false }));
  } else if (family === 'GUIDE') {
    const guideAxes = guideAxesForTangent(tangent);
    const g = new THREE.Group(); g.name = `${prefix}_GUIDE`;
    for (const ax of guideAxes) {
      const d = axisVector(`+${ax}`);
      const tipPlus = p.clone().add(d.clone().multiplyScalar(contactRadius + gap));
      const tipMinus = p.clone().add(d.clone().multiplyScalar(-contactRadius - gap));
      g.add(arrowToward(tipPlus, d.clone().multiplyScalar(-1), symbolLength * 0.86, arrowRadius * 0.82, guideMat, `guide_plus_${ax}`));
      g.add(arrowToward(tipMinus, d, symbolLength * 0.86, arrowRadius * 0.82, guideMat, `guide_minus_${ax}`));
    }
    out.push(addMeta(g, { engineeringContact: 'OD/2', guideAxes, visualResolverApplied: false }));
  } else if (family === 'LINE_STOP' || family === 'LIMIT') {
    const lane = orthogonal(tangent).multiplyScalar(visualLane);
    const center = p.clone().add(lane);
    const separation = gap > 0 ? gap : 0.0;
    const tipA = center.clone().add(tangent.clone().multiplyScalar(separation / 2));
    const tipB = center.clone().add(tangent.clone().multiplyScalar(-separation / 2));
    const g = new THREE.Group(); g.name = `${prefix}_${family}_AXIAL_PM`;
    g.add(arrowToward(tipA, tangent.clone().multiplyScalar(-1), symbolLength, arrowRadius * 0.82, lineMat, `${family}_a`));
    g.add(arrowToward(tipB, tangent, symbolLength, arrowRadius * 0.82, lineMat, `${family}_b`));
    out.push(addMeta(g, { engineeringContact: 'axial-corner-touch', visualResolverApplied: true, visualResolver: 'OD*2/3', axialGapVisual: gap }));
  } else if (family === 'AXIS_RESTRAINT_UNRESOLVED') {
    const marker = createWarningTriangle('!', Math.max(0.5, od * 0.45));
    marker.name = `${prefix}_UNRESOLVED_WARNING`;
    marker.position.copy(p.clone().add(new THREE.Vector3(0.0, Math.max(0.85, od), 0.65)));
    out.push(addMeta(marker, { popupRequired: true, warningText: rec.warningText || 'Axis sign required' }));
  } else if (family === 'AXIS_RESTRAINT') {
    const d = axisVector(rec.axis || '+X');
    const lane = Math.abs(d.dot(tangent)) > 0.85 ? orthogonal(tangent).multiplyScalar(visualLane) : new THREE.Vector3();
    const start = p.clone().add(lane).sub(d.clone().multiplyScalar(0.1));
    out.push(addMeta(coneArrow(start, d, symbolLength, arrowRadius * 0.82, lineMat, `${prefix}_AXIS_${rec.axis}`), { visualResolverApplied: lane.length() > 0 }));
  } else if (family === 'SPRING_WARNING' || family === 'SPRING') {
    const below = p.clone().add(new THREE.Vector3(0, -contactRadius - symbolLength - gap, 0));
    out.push(addMeta(createSpringCoil(below, tangent, arrowRadius * 0.75, symbolLength * 1.15, springMat, `${prefix}_SPRING_COIL_BELOW_PIPE`), { warningText: rec.warningText || 'Spring / hanger', engineeringContact: 'below-pipe-clearance' }));
  }

  if (sourceClass === 'expected' && out.length) {
    out.forEach(o => o.traverse?.(child => { if (child.material?.color) child.material.opacity = 0.96; }));
  }
  return out;
}

function guideAxesForTangent(tangent) {
  const dom = dominantAxis(tangent);
  if (dom === 'X') return ['Z'];
  if (dom === 'Z') return ['X'];
  return ['X', 'Z'];
}

function nodePosition(model, nodeId) {
  return model.nodes.get(String(Number(nodeId))) || null;
}

function localTangent(elementByNode, nodeId) {
  const els = elementByNode.get(String(Number(nodeId))) || [];
  if (!els.length) return new THREE.Vector3(1, 0, 0);
  const e = els[0];
  const v = new THREE.Vector3(e.dx, e.dy, e.dz);
  if (v.lengthSq() < 1e-8) return new THREE.Vector3(1, 0, 0);
  return v.normalize();
}

function localOd(elementByNode, nodeId) {
  const els = elementByNode.get(String(Number(nodeId))) || [];
  if (!els.length) return 100;
  return numberValue(els[0].props.bore, 100);
}

function frameScene(scene) {
  const box = new THREE.Box3().setFromObject(scene);
  const center = box.getCenter(new THREE.Vector3());
  scene.position.sub(center);
}

function numberValue(value, fallback = 0) {
  if (value && typeof value === 'object' && 'value' in value) value = value.value;
  const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return fallback;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : fallback;
}

export function exportSceneToGlb(scene) {
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(result);
        else resolve(new TextEncoder().encode(JSON.stringify(result)).buffer);
      },
      (err) => reject(err),
      { binary: true, includeCustomExtensions: false, trs: false, onlyVisible: true }
    );
  });
}
