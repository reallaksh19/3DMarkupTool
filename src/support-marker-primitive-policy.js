import * as THREE from 'three';
import { COLORS, mat } from './geometry.js?v=bust-cache-4';
import {
  invertSupportAxis,
  normalizeSupportAxisToken,
  supportAxisVector
} from './support-axis-transform.js?v=bust-cache-4';

export const SUPPORT_MARKER_CONTRACT_SCHEMA = 'SupportMarkerContract.v1';
export const SUPPORT_MARKER_PRIMITIVE_POLICY_SCHEMA = 'SupportMarkerPrimitivePolicy.v1';
export const SUPPORT_MARKER_TYPE = 'SUPPORT_MARKER';

export const SUPPORT_MARKER_PRIMITIVE_CAPS = Object.freeze({
  maxGlyphSpanMm: 60,
  maxClusterOffsetMm: 28,
  maxBarRadiusMm: 3,
  minGlyphSpanMm: 24,
  minBarRadiusMm: 1
});

const SUPPORT_MATERIALS = Object.freeze({
  REST: 6,
  GUIDE: 17,
  LINESTOP: 19,
  LIMIT: 19,
  ANCHOR: 19,
  HOLDDOWN: 22,
  SPRING: 31,
  U_BOLT: 22,
  TRUNNION: 6,
  SHOE: 6,
  CAN: 6,
  SPRING_CAN: 31,
  HANGER: 17,
  SPRING_HANGER: 31,
  UNKNOWN: 11
});

const SUPPORT_COLORS = Object.freeze({
  REST: COLORS.rest,
  GUIDE: COLORS.guide,
  LINESTOP: COLORS.lineStop,
  LIMIT: COLORS.lineStop,
  ANCHOR: COLORS.lineStop,
  HOLDDOWN: COLORS.holddown,
  SPRING: COLORS.spring,
  U_BOLT: COLORS.holddown,
  TRUNNION: COLORS.rest,
  SHOE: COLORS.rest,
  CAN: COLORS.rest,
  SPRING_CAN: COLORS.spring,
  HANGER: COLORS.guide,
  SPRING_HANGER: COLORS.spring,
  UNKNOWN: COLORS.warning
});

/**
 * Builds one canonical stagedJson support marker across GLB preview, RVM export,
 * RVM preview, ATT metadata, and property-panel selection.
 * Parameters: SupportMarkerContract.v1 records with source position and axis metadata.
 * Output: open-ended Three.js marker objects or writer-safe code-8 cylinder primitive nodes.
 * Fallback: unknown support families emit compact cylinder/cone warning markers, never boxes or pyramids.
 */
export function buildSupportMarkerId(support) {
  const node = safeSegment(support?.nodeNumber || support?.node || support?.NODE || 'NO_NODE');
  const family = safeSegment(normalizeSupportFamily(support?.supportFamily || support?.family || support?.FAMILY));
  const id = safeSegment(support?.supportId || support?.id || support?.ID || support?.supportName || 'SUPPORT');
  return `${SUPPORT_MARKER_TYPE}/stagedJson/${node}/${family}/${id}`;
}

/**
 * 3D RVM viewers (e.g. 3D_Viewer) hide any node whose NAME matches the embedded-InputXML
 * support-marker filter `INPUTXML-<n>-<FAMILY>` (REST/GUIDE/LINESTOP/...), expecting to redraw
 * those from sideloaded data. Our exported supports use that exact pattern, so they vanish in
 * the delivered RVM. Rewrite the `INPUTXML` token (when it is part of that pattern) to a neutral
 * prefix for the exported node/primitive NAMES only — the canonical SUPPORT_MARKER_ID attribute
 * keeps the original id for traceability and ISONOTE matching.
 */
export function neutralizeEmbeddedInputXmlMarkerName(value) {
  return String(value == null ? '' : value).replace(/INPUTXML(?=[-_ ]*\d)/gi, 'STAGED');
}

export function buildSupportMarkerUserData(support, inputExtra) {
  const extra = inputExtra && typeof inputExtra === 'object' ? inputExtra : {};
  const family = normalizeSupportFamily(support?.supportFamily || support?.family || support?.FAMILY);
  const markerId = support?.supportMarkerId || buildSupportMarkerId(support);
  const axisTransform = support?.axisTransform || null;
  const sourceAttributes = support?.sourceAttributes || {};
  const diagnostics = Array.isArray(support?.diagnostics) ? support.diagnostics : [];
  return {
    TYPE: SUPPORT_MARKER_TYPE,
    SUPPORT_MARKER_SCHEMA: SUPPORT_MARKER_CONTRACT_SCHEMA,
    SUPPORT_MARKER_POLICY: SUPPORT_MARKER_PRIMITIVE_POLICY_SCHEMA,
    SUPPORT_MARKER_ID: markerId,
    ID: markerId,
    sourceKind: support?.sourceKind || 'stagedJson',
    sourceMode: support?.sourceMode || 'stagedJson',
    supportMarkerId: markerId,
    supportId: support?.supportId || '',
    node: support?.nodeNumber || support?.node || '',
    family,
    axis: support?.axisCanvas || support?.axisRaw || axisTransform?.canvasAxis || '',
    axisRaw: support?.axisRaw || axisTransform?.sourceAxis || '',
    axisCanvas: support?.axisCanvas || axisTransform?.canvasAxis || '',
    sign: support?.sign || axisTransform?.sign || '',
    axisTransformApplied: Boolean(support?.axisTransformApplied || axisTransform?.axisTransformApplied),
    axisTransform,
    matchedPipeRef: support?.matchedPipeRef || '',
    isonoteRawText: support?.isonote?.rawText || support?.isonoteRawText || '',
    isonoteNoteName: support?.isonote?.noteName || support?.isonoteNoteName || '',
    matchMethod: support?.matchMethod || support?.isonote?.matchMethod || support?.isonoteMatch?.matchMethod || 'none',
    confidence: support?.confidence ?? support?.isonote?.confidence ?? support?.isonoteMatch?.confidence ?? 0,
    warningCode: support?.warningCode || '',
    warningMessage: support?.warningMessage || '',
    sourcePath: support?.sourcePath || '',
    sourceAttributes,
    sourceAttributesJson: stableJson(sourceAttributes),
    diagnostics,
    diagnosticsJson: stableJson(diagnostics),
    rawSupport: support,
    supportMarkerRaycastable: true,
    supportMarkerPrimitivePolicy: SUPPORT_MARKER_PRIMITIVE_POLICY_SCHEMA,
    ...extra
  };
}

export function buildSupportMarkerGlbObject(support, inputOptions) {
  const options = inputOptions && typeof inputOptions === 'object' ? inputOptions : {};
  const sceneScale = finiteNumber(options.sceneScale, 0.01);
  const center = pointToVector(support?.positionMm).multiplyScalar(sceneScale);
  const family = normalizeSupportFamily(support?.supportFamily);
  const colorKey = /^[+-]?[XYZ]$/.test(family) ? 'LINESTOP' : family;
  const material = mat(SUPPORT_COLORS[colorKey] || SUPPORT_COLORS.UNKNOWN, { emissive: 0x06121a, emissiveIntensity: 0.16 });
  const group = new THREE.Group();
  const userData = buildSupportMarkerUserData(support, { previewGeometry: 'canonical-open-ended-support-marker' });
  group.name = support?.supportMarkerId || buildSupportMarkerId(support);
  group.userData = userData;

  const odMm = Math.max(finiteNumber(support?.pipeOdMm, 0), 60);
  const lengthMm = clamp(odMm * 0.34, SUPPORT_MARKER_PRIMITIVE_CAPS.minGlyphSpanMm, SUPPORT_MARKER_PRIMITIVE_CAPS.maxGlyphSpanMm);
  const radiusMm = clamp(odMm * 0.025, SUPPORT_MARKER_PRIMITIVE_CAPS.minBarRadiusMm, SUPPORT_MARKER_PRIMITIVE_CAPS.maxBarRadiusMm);
  const baseRadius = radiusMm * 2.4;
  const tipRadius = Math.max(radiusMm * 0.7, 0.8);
  const sides = markerSidesForSupport(support);

  if (family === 'SPRING') {
    addSpringMarker(group, center, lengthMm * sceneScale, radiusMm * sceneScale, material, userData);
    return group;
  }

  sides.forEach((side, index) => {
    const axis = normalizeSupportAxisToken(side.axis) || '+Y';
    const dir = vectorForThree(axis);
    const sideCenter = center.clone().add(dir.clone().multiplyScalar((lengthMm * 0.42) * sceneScale));
    const cone = openFrustumMesh(lengthMm * sceneScale, baseRadius * sceneScale, tipRadius * sceneScale, dir, sideCenter, material, `${group.name}_OPEN_CONE_${index + 1}`);
    cone.userData = buildSupportMarkerUserData(support, { markerPrimitiveRole: side.role, supportMarkerChild: true, supportAxis: axis });
    group.add(cone);

    const tickAxis = perpendicularVector(dir);
    const tickCenter = center.clone().add(dir.clone().multiplyScalar((lengthMm * 0.12) * sceneScale));
    const tick = openCylinderMesh(lengthMm * 0.34 * sceneScale, radiusMm * 0.8 * sceneScale, tickAxis, tickCenter, material, `${group.name}_BASE_TICK_${index + 1}`);
    tick.userData = buildSupportMarkerUserData(support, { markerPrimitiveRole: `${side.role}-base-tick`, supportMarkerChild: true, supportAxis: axis });
    group.add(tick);
  });

  return group;
}

export function buildSupportMarkerRvmNode(support, inputOptions) {
  const options = inputOptions && typeof inputOptions === 'object' ? inputOptions : {};
  const markerId = support?.supportMarkerId || buildSupportMarkerId(support);
  // Exported CNTB/ATT/primitive NAMES use a neutralized form so 3D RVM viewers do not hide the
  // supports via their INPUTXML-<n>-<FAMILY> filter; the SUPPORT_MARKER_ID attribute keeps markerId.
  const displayName = neutralizeEmbeddedInputXmlMarkerName(markerId);

  // Use green color (Spring material 31 is green-ish in RVM, or default to 31)
  const familyObj = normalizeSupportFamily(support?.supportFamily);
  const matKey = /^[+-]?[XYZ]$/.test(familyObj) ? 'LINESTOP' : familyObj;
  const material = options.material || SUPPORT_MATERIALS[matKey] || 31;
  const center = pointToArray(support?.positionMm);
  const odMm = Math.max(finiteNumber(support?.pipeOdMm, 0), 60);

  const pipeAxis = normalizeSupportAxisToken(support?.pipeAxis || '');
  const isVertical = pipeAxis.includes('Z');
  const pinDirection = isVertical ? [1, 0, 0] : [0, 0, 1];
  
  const tipOffset = odMm * 0.5 * 2;
  const sphereOffset = odMm * 0.75 * 2;
  
  const sphereCenter = [
    center[0] + pinDirection[0] * sphereOffset,
    center[1] + pinDirection[1] * sphereOffset,
    center[2] + pinDirection[2] * sphereOffset
  ];
  
  const tipCenter = [
    center[0] + pinDirection[0] * tipOffset,
    center[1] + pinDirection[1] * tipOffset,
    center[2] + pinDirection[2] * tipOffset
  ];
  
  const sphereDiameter = Math.max(odMm * 0.1, 4) * 2 * 2;
  const rodRadius = Math.max(odMm * 0.04, 2) * 2;

  const primitives = [
    {
      kind: 'sphere',
      diameter: sphereDiameter,
      center: sphereCenter,
      material: material,
      name: `${displayName}/RVM_MAP_PIN_SPHERE`,
      endpointLocked: true,
      exportedRvmGeometry: true
    },
    endpointCylinder({
      name: `${displayName}/RVM_MAP_PIN_ROD`,
      start: tipCenter,
      end: sphereCenter,
      radius: rodRadius,
      material,
      extra: { supportMarkerBody: true }
    })
  ];

  primitives.push(...supportSymbolRvmPrimitives({
    family: normalizeSupportFamily(support?.supportFamily),
    displayName,
    markerId,
    center,
    odMm,
    material,
    support
  }));

  return {
    name: displayName,
    reviewName: displayName,
    material,
    position: center,
    attributes: buildSupportMarkerRvmAttributes(support, markerId),
    primitives,
    children: []
  };
}

/**
 * Family-distinct support SYMBOL geometry, modelled on the AVEVA E3D reference (RMSS.rvm) which
 * builds guides/line-stops/rests from flat steel PLATES (code-2 boxes), not cones. Each plate is
 * a thin box oriented by an explicit right-handed basis so it renders identically in any RVM viewer.
 *   GUIDE     -> two vertical plates straddling the pipe laterally (pipe slides between them)
 *   LINESTOP  -> stop plates across the pipe axis (restrain axial travel)
 *   HOLDDOWN  -> base plate below + clamp plate above
 *   REST      -> a single horizontal base plate beneath the pipe (shoe)
 *   SPRING    -> five stacked coil cylinders (unchanged)
 *   fallback  -> a small upright warning plate
 */
export function supportSymbolRvmPrimitives({ family, displayName, markerId, center, odMm, material, support }) {
  const out = [];
  const R = odMm * 0.5;
  const gap = Math.max(finiteNumber(support?.gapMm, 0), 0);
  const pipeAxisToken = normalizeSupportAxisToken(support?.pipeAxis || '') || '+X';
  const tHat = normalize(arrayVector(pipeAxisToken));
  const up = [0, 1, 0];
  
  let idx = 0;
  
  const arrowLen = clamp(odMm * 0.8, 60, 240);
  const arrowR = clamp(odMm * 0.05, 3, 12);
  
  const arrow = (dir, tipPos, role) => {
    const d = normalize(dir);
    const headLen = arrowR * 4;
    const actualShaftLen = Math.max(arrowLen - headLen, arrowR);
    const shaftStart = sub(tipPos, scale(d, arrowLen));
    const shaftEnd = sub(tipPos, scale(d, headLen));
    
    idx += 1;
    out.push(endpointCylinder({
      name: `${displayName}/RVM_ARROW_SHAFT_${idx}`,
      start: shaftStart,
      end: shaftEnd,
      radius: arrowR,
      material,
      extra: {
        primitiveRole: `${role}-shaft`,
        supportMarkerPrimitive: true,
        supportMarkerId: markerId,
        supportMarkerFamily: family,
        supportMarkerAxis: pipeAxisToken,
        supportGapMm: gap,
        exportedRvmGeometry: true
      }
    }));
    
    const segLen = headLen / 3;
    const radii = [arrowR * 3, arrowR * 2, arrowR * 1];
    let segStart = shaftEnd;
    for (let i = 0; i < 3; i++) {
      const segEnd = add(segStart, scale(d, segLen));
      out.push(endpointCylinder({
        name: `${displayName}/RVM_ARROW_HEAD_${idx}_${i+1}`,
        start: segStart,
        end: segEnd,
        radius: radii[i],
        material,
        extra: {
          primitiveRole: `${role}-head-${i+1}`,
          supportMarkerPrimitive: true,
          supportMarkerId: markerId,
          supportMarkerFamily: family,
          supportMarkerAxis: pipeAxisToken,
          supportGapMm: gap,
          exportedRvmGeometry: true
        }
      }));
      segStart = segEnd;
    }
  };

  const pipeDim = pipeAxisToken.replace(/[+-]/g, '');
  
  switch (family) {
    case 'REST': {
      arrow(up, add(center, scale(up, -(R + gap))), 'rest-arrow');
      break;
    }
    case 'HOLDDOWN':
    case 'U_BOLT': {
      arrow(up, add(center, scale(up, -(R + gap))), 'holddown-arrow-up');
      arrow([0, -1, 0], add(center, scale(up, R + gap)), 'holddown-arrow-down');
      break;
    }
    case 'GUIDE': {
      if (pipeDim === 'Y') {
        arrow([1, 0, 0], add(center, scale([1, 0, 0], -(R + gap))), 'guide-x-plus');
        arrow([-1, 0, 0], add(center, scale([-1, 0, 0], -(R + gap))), 'guide-x-minus');
        arrow([0, 0, 1], add(center, scale([0, 0, 1], -(R + gap))), 'guide-z-plus');
        arrow([0, 0, -1], add(center, scale([0, 0, -1], -(R + gap))), 'guide-z-minus');
      } else {
        const latAxisStr = pipeDim === 'X' ? '+Z' : '+X';
        const lat1 = normalize(arrayVector(latAxisStr));
        const lat2 = scale(lat1, -1);
        arrow(lat1, add(center, scale(lat1, -(R + gap))), 'guide-plus');
        arrow(lat2, add(center, scale(lat2, -(R + gap))), 'guide-minus');
      }
      break;
    }
    case 'LINESTOP':
    case 'LIMIT': {
      const offsetDir = pipeDim === 'Y' ? [1, 0, 0] : up;
      const offsetPos = add(center, scale(offsetDir, odMm * 2/3));
      arrow(tHat, add(offsetPos, scale(tHat, -gap * 10)), 'linestop-plus');
      arrow(scale(tHat, -1), add(offsetPos, scale(tHat, gap * 10)), 'linestop-minus');
      break;
    }
    case 'CAN':
    case 'SPRING_CAN':
    case 'SPRING':
    case 'SPRING_HANGER': {
      const springLen = clamp(odMm * 1.5, 60, 240);
      const coilsCenter = add(center, scale(up, -(R + gap + springLen / 2)));
      out.push(...springRvmPrimitives(displayName, coilsCenter, springLen, arrowR * 2, material, support));
      if (family === 'SPRING_HANGER') {
        arrow(up, add(center, scale(up, -(R + gap))), 'hanger-arrow-up');
      }
      break;
    }
    case 'SHOE':
    case 'TRUNNION':
    case 'HANGER': {
      arrow(up, add(center, scale(up, -(R + gap))), 'support-arrow-up');
      break;
    }
    case 'ANCHOR': {
      const offsetDir = pipeDim === 'Y' ? [1, 0, 0] : up;
      const offsetPos = add(center, scale(offsetDir, odMm * 2/3));
      arrow(tHat, add(offsetPos, scale(tHat, -gap * 10)), 'anchor-axial-plus');
      arrow(scale(tHat, -1), add(offsetPos, scale(tHat, gap * 10)), 'anchor-axial-minus');
      arrow(up, add(center, scale(up, -(R + gap))), 'anchor-up');
      arrow([0, -1, 0], add(center, scale(up, R + gap)), 'anchor-down');
      break;
    }
    default: {
      if (/^[+-]?[XYZ]$/.test(family)) {
        const isSigned = /^[+-]/.test(family);
        const axisStr = isSigned ? family : `+${family}`;
        const dir = normalize(arrayVector(axisStr));
        
        const isAxial = axisStr.replace(/[+-]/g, '') === pipeDim;
        const offsetDir = pipeDim === 'Y' ? [1, 0, 0] : up;
        
        const pos = isAxial ? add(center, scale(offsetDir, odMm * 2/3)) : center;
        const tipPos = isAxial ? add(pos, scale(dir, -gap * 10)) : add(pos, scale(dir, -(R + gap)));
        
        arrow(dir, tipPos, `directional-${family}`);
        
        if (!isSigned) {
          if (support) support.popupRequired = true;
          const t = clamp(odMm * 0.08, 6, 16);
          const face = clamp(odMm * 0.95, 60, 240);
          idx += 1;
          out.push({
            kind: 'box',
            name: `${displayName}/RVM_WARNING_PLATE_${idx}`,
            localName: `RVM_WARNING_PLATE_${idx}`,
            center: add(center, scale(up, -(R + gap + t/2))),
            basis: { x: [1,0,0], y: [0,0,-1], z: up },
            lengths: [face * 0.7, face * 0.7, t],
            material: 11,
            primitiveRole: 'warning-plate',
            supportMarkerPrimitive: true,
            supportMarkerPlate: true,
            supportBar: true,
            supportMarkerId: markerId,
            supportMarkerFamily: family,
            supportMarkerAxis: pipeAxisToken,
            supportGapMm: gap,
            sourceIntent: 'plate-support-symbol',
            exportedRvmGeometry: true,
            blockedPrimitiveKinds: ['cone-code5', 'pyramid', 'ring', 'arrow']
          });
        }
        break;
      }

      const t = clamp(odMm * 0.08, 6, 16);
      const face = clamp(odMm * 0.95, 60, 240);
      idx += 1;
      out.push({
        kind: 'box',
        name: `${displayName}/RVM_WARNING_PLATE_${idx}`,
        localName: `RVM_WARNING_PLATE_${idx}`,
        center: add(center, scale(up, -(R + gap + t/2))),
        basis: { x: [1,0,0], y: [0,0,-1], z: up },
        lengths: [face * 0.7, face * 0.7, t],
        material: 11,
        primitiveRole: 'warning-plate',
        supportMarkerPrimitive: true,
        supportMarkerPlate: true,
        supportBar: true,
        supportMarkerId: markerId,
        supportMarkerFamily: family,
        supportMarkerAxis: pipeAxisToken,
        supportGapMm: gap,
        sourceIntent: 'plate-support-symbol',
        exportedRvmGeometry: true,
        blockedPrimitiveKinds: ['cone-code5', 'pyramid', 'ring', 'arrow']
      });
    }
  }
  return out;
}

export function markerSidesForSupport(support) {
  const family = normalizeSupportFamily(support?.supportFamily || support?.family || support?.FAMILY);
  const axis = normalizeSupportAxisToken(support?.axisCanvas || support?.axisRaw || support?.axisTransform?.canvasAxis || '');
  const pipeAxis = normalizeSupportAxisToken(support?.pipeAxis || '');
  if (family === 'REST' || family === 'SHOE' || family === 'CAN' || family === 'SPRING_CAN') return [markerSide('+Y', 'rest-up')];
  if (family === 'HOLDDOWN') return [markerSide('+Y', 'holddown-up'), markerSide('-Y', 'holddown-down')];
  if (family === 'HANGER' || family === 'SPRING_HANGER' || family === 'U_BOLT') return [markerSide('-Y', 'hanger-down')];
  if (family === 'GUIDE') return pairedSides(lateralAxis(axis, pipeAxis), 'guide');
  if (family === 'LINESTOP' || family === 'LIMIT' || family === 'ANCHOR') return pairedSides(axis || pipeAxis || '+X', family.toLowerCase());
  if (family === 'TRUNNION') return [markerSide(axis || '+Z', 'trunnion-out')];
  if (family === 'SPRING') return [markerSide('-Y', 'spring-can')];
  if (/^[+-]?[XYZ]$/.test(family)) {
    if (/^[+-]/.test(family)) return [markerSide(family, 'directional-restraint')];
    return pairedSides(`+${family}`, 'directional-restraint');
  }
  return [markerSide(axis || '+Y', 'warning-marker')];
}

export function buildSupportMarkerRvmAttributes(support, markerId) {
  const userData = buildSupportMarkerUserData(support);
  return {
    TYPE: SUPPORT_MARKER_TYPE,
    SUPPORT_MARKER_SCHEMA: SUPPORT_MARKER_CONTRACT_SCHEMA,
    SUPPORT_MARKER_POLICY: SUPPORT_MARKER_PRIMITIVE_POLICY_SCHEMA,
    SUPPORT_MARKER_ID: markerId,
    ID: markerId,
    NODE: userData.node,
    FAMILY: userData.family,
    AXIS: userData.axis,
    AXIS_RAW: userData.axisRaw,
    AXIS_CANVAS: userData.axisCanvas,
    AXIS_TRANSFORM_APPLIED: String(Boolean(userData.axisTransformApplied)).toUpperCase(),
    AXIS_TRANSFORM_JSON: stableJson(userData.axisTransform || {}),
    SOURCE: 'stagedJson',
    SOURCE_KIND: 'stagedJson',
    SOURCE_MODE: userData.sourceMode,
    SOURCE_PATH: userData.sourcePath,
    SOURCE_ATTRIBUTES_JSON: userData.sourceAttributesJson,
    MATCHED_PIPE_REF: userData.matchedPipeRef,
    GAP_MM: String(support?.gapMm ?? '0'),
    ISONOTE: support?.isonoteText || userData.isonoteRawText || '',
    ISONOTE_RAW_TEXT: userData.isonoteRawText,
    ISONOTE_NOTE_NAME: userData.isonoteNoteName,
    ISONOTE_MATCH_METHOD: userData.matchMethod,
    ISONOTE_MATCH_CONFIDENCE: String(userData.confidence),
    WARNING_CODE: userData.warningCode,
    WARNING_MESSAGE: userData.warningMessage,
    DIAGNOSTICS_JSON: userData.diagnosticsJson,
    TARGET_VIEWER: 'Navisworks',
    RVM_SUPPORT_MARKER_ALLOWED_CODES: '2,8,9',
    RVM_SUPPORT_MARKER_SOURCE_INTENT: 'plate-and-bar-support-symbol',
    RVM_SUPPORT_MARKER_FORBIDDEN_GEOMETRY: 'code5-cone,pyramid,ring,arrow'
  };
}

function coneLikeRvmPrimitives(markerId, center, side, index, lengthMm, radiusMm, material, support) {
  const axis = normalizeSupportAxisToken(side.axis) || '+Y';
  const dir = arrayVector(axis);
  const base = add(center, scale(dir, lengthMm * 0.08));
  const tip = add(center, scale(dir, lengthMm));
  const tickAxis = perpendicularArray(dir);
  const tickCenter = add(center, scale(dir, lengthMm * 0.18));
  const common = {
    material,
    sourceIntent: 'cone-like-support-marker',
    supportMarkerPrimitive: true,
    supportMarkerId: markerId,
    supportMarkerRole: side.role,
    supportMarkerAxis: axis,
    supportMarkerFamily: normalizeSupportFamily(support?.supportFamily),
    supportGapMm: finiteNumber(support?.gapMm, 0),
    blockedPrimitiveKinds: ['cone-code5', 'pyramid', 'box', 'plate', 'ring', 'arrow'],
    exportedRvmGeometry: true
  };
  return [
    endpointCylinder({
      name: `${markerId}/RVM_BODY_${index + 1}`,
      start: base,
      end: tip,
      radius: radiusMm,
      material,
      extra: { ...common, role: `${side.role}-body`, supportMarkerBody: true }
    }),
    endpointCylinder({
      name: `${markerId}/RVM_BASE_TICK_${index + 1}`,
      start: add(tickCenter, scale(tickAxis, -lengthMm * 0.17)),
      end: add(tickCenter, scale(tickAxis, lengthMm * 0.17)),
      radius: clamp(radiusMm * 0.78, SUPPORT_MARKER_PRIMITIVE_CAPS.minBarRadiusMm, SUPPORT_MARKER_PRIMITIVE_CAPS.maxBarRadiusMm),
      material,
      extra: { ...common, role: `${side.role}-base-tick`, supportMarkerBaseTick: true }
    })
  ];
}

function springRvmPrimitives(markerId, center, lengthMm, radiusMm, material, support) {
  const count = 5;
  const spacing = lengthMm / count;
  const primitives = [];
  for (let index = 0; index < count; index += 1) {
    const y = (index - (count - 1) / 2) * spacing;
    primitives.push(endpointCylinder({
      name: `${markerId}/RVM_SPRING_CAN_${index + 1}`,
      start: add(center, [-lengthMm * 0.18, y, 0]),
      end: add(center, [lengthMm * 0.18, y, 0]),
      radius: clamp(radiusMm * 0.5, SUPPORT_MARKER_PRIMITIVE_CAPS.minBarRadiusMm, SUPPORT_MARKER_PRIMITIVE_CAPS.maxBarRadiusMm),
      material,
      extra: {
        sourceIntent: 'spring-like-support-marker',
        supportMarkerPrimitive: true,
        supportMarkerId: markerId,
        supportMarkerRole: 'spring',
        supportMarkerFamily: normalizeSupportFamily(support?.supportFamily),
        supportMarkerSpringCan: true,
        blockedPrimitiveKinds: ['cone-code5', 'pyramid', 'box', 'plate', 'ring', 'arrow'],
        exportedRvmGeometry: true
      }
    }));
  }
  return primitives;
}

function addSpringMarker(group, center, length, radius, material, userData) {
  const count = 5;
  const spacing = length / count;
  for (let index = 0; index < count; index += 1) {
    const y = (index - (count - 1) / 2) * spacing;
    const mesh = openCylinderMesh(length * 0.36, radius, new THREE.Vector3(1, 0, 0), center.clone().add(new THREE.Vector3(0, y, 0)), material, `${group.name}_SPRING_CAN_${index + 1}`);
    mesh.userData = { ...userData, supportMarkerChild: true, markerPrimitiveRole: 'spring-can-coil' };
    group.add(mesh);
  }
}

function openFrustumMesh(length, baseRadius, tipRadius, dir, center, material, name) {
  const geometry = new THREE.CylinderGeometry(tipRadius, baseRadius, Math.max(length, 0.0001), 18, 1, true);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(center);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return mesh;
}

function openCylinderMesh(length, radius, dir, center, material, name) {
  const geometry = new THREE.CylinderGeometry(Math.max(radius, 0.0001), Math.max(radius, 0.0001), Math.max(length, 0.0001), 12, 1, true);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(center);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return mesh;
}

function endpointCylinder(input) {
  const start = input.start;
  const end = input.end;
  const delta = sub(end, start);
  const length = Math.max(lengthOf(delta), 0.001);
  return {
    kind: 'cylinder',
    name: input.name,
    localName: input.name.split('/').at(-1) || input.name,
    center: midpoint(start, end),
    direction: scale(delta, 1 / length),
    radius: input.radius,
    length,
    material: input.material,
    endpointLocked: true,
    startMm: start,
    endMm: end,
    primitiveRole: input.extra?.role || 'support-marker-cylinder',
    ...(input.extra || {})
  };
}

function markerSide(axis, role) {
  return { axis: normalizeSupportAxisToken(axis) || '+Y', role };
}

function pairedSides(axis, rolePrefix) {
  const normalized = normalizeSupportAxisToken(axis) || '+X';
  return [markerSide(normalized, `${rolePrefix}-plus`), markerSide(invertSupportAxis(normalized), `${rolePrefix}-minus`)];
}

function lateralAxis(axis, pipeAxis) {
  const candidate = normalizeSupportAxisToken(axis);
  if (candidate) return candidate;
  const pipeDim = (normalizeSupportAxisToken(pipeAxis) || '+X').replace(/[+-]/g, '');
  if (pipeDim === 'X') return '+Z';
  if (pipeDim === 'Z') return '+X';
  return '+X';
}

function normalizeSupportFamily(value) {
  const key = String(value || 'UNKNOWN').trim().toUpperCase().replace(/[\s\-]+/g, '_');
  if (key === 'LINE_STOP') return 'LINESTOP';
  if (key === 'LIMIT_STOP') return 'LIMIT';
  if (key === 'HOLD_DOWN') return 'HOLDDOWN';
  
  const allowed = [
    'REST', 'GUIDE', 'LINESTOP', 'LIMIT', 'HOLDDOWN', 'ANCHOR', 'SPRING',
    'U_BOLT', 'TRUNNION', 'SHOE', 'CAN', 'SPRING_CAN', 'HANGER', 'SPRING_HANGER'
  ];
  if (allowed.includes(key)) return key;
  
  if (/^[+-]?[XYZ]$/.test(key)) return key;

  return 'UNKNOWN';
}

function pointToVector(point) {
  const array = pointToArray(point);
  return new THREE.Vector3(array[0], array[1], array[2]);
}

function pointToArray(point) {
  if (Array.isArray(point) && point.length >= 3) return [finiteNumber(point[0], 0), finiteNumber(point[1], 0), finiteNumber(point[2], 0)];
  if (point && typeof point === 'object') return [finiteNumber(point.x ?? point.X, 0), finiteNumber(point.y ?? point.Y, 0), finiteNumber(point.z ?? point.Z, 0)];
  return [0, 0, 0];
}

function vectorForThree(axis) {
  const vector = supportAxisVector(axis);
  return new THREE.Vector3(vector.x, vector.y, vector.z).normalize();
}

function arrayVector(axis) {
  const vector = supportAxisVector(axis);
  return [vector.x, vector.y, vector.z];
}

function perpendicularVector(dir) {
  const reference = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  return new THREE.Vector3().crossVectors(dir, reference).normalize();
}

function perpendicularArray(dir) {
  const reference = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return normalize(cross(dir, reference));
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

function safeSegment(value) {
  const segment = String(value || '').trim().replace(/[\\/]+/g, '_').replace(/[^A-Za-z0-9_.:-]+/g, '_').replace(/^_+|_+$/g, '');
  return segment || 'UNNAMED';
}

function stableJson(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return 'null';
  }
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

function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function normalize(vector) {
  const length = lengthOf(vector);
  return length > 1e-12 ? scale(vector, 1 / length) : [1, 0, 0];
}

function lengthOf(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}
