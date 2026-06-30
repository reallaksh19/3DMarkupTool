export function buildBmCiiStyleManagedStageFixture() {
  const componentTypes = [
    'FLAN', 'PIPE', 'PIPE', 'PIPE', 'PIPE', 'PIPE',
    'FLAN', 'VALV', 'FLAN', 'PIPE', 'PIPE',
    'FLAN', 'VALV', 'FLAN', 'BEND', 'PIPE', 'PIPE', 'BEND', 'BEND',
    'PIPE', 'FLAN', 'BEND', 'PIPE', 'BEND', 'BEND', 'PIPE',
    'FLAN', 'VALV', 'FLAN', 'BEND', 'PIPE', 'PIPE', 'VALV',
    'PIPE', 'PIPE', 'PIPE', 'PIPE', 'PIPE', 'VALV', 'VALV'
  ];
  const children = componentTypes.map((type, index) => componentRecord(type, index + 1));
  for (let index = 0; index < 12; index++) children.push(supportRecord(index + 1));
  return {
    schema: 'inputxml-managed-stage/v1',
    profile: 'AVEVA_JSON_FOR_3D_RVM_VIEWER',
    source: 'BM_CII_INPUT.XML',
    converterSchema: 'inputxml-direct-managed-stage/v2-rich-topology',
    units: { length: 'mm' },
    stats: {
      components: 40,
      componentRows: 40,
      validRestraints: 12,
      emittedSupports: 12,
      bends: 7,
      rigids: 15,
      routeLengthRows: 40,
      richGeometryComponents: 40,
      uxmlReadyComponents: 52,
      branches: 1,
      children: 52
    },
    hierarchy: [{
      name: '/INPUTXML/BM_CII_INPUT/BRANCH-001',
      type: 'BRANCH',
      attributes: { TYPE: 'BRAN', NAME: '/INPUTXML/BM_CII_INPUT/BRANCH-001' },
      children
    }]
  };
}

function componentRecord(type, ordinal) {
  const from = String(ordinal * 10);
  const to = String((ordinal + 1) * 10);
  const family = type === 'FLAN' ? 'FLANGE' : type === 'VALV' ? 'VALVE' : type === 'BEND' ? 'ELBOW' : 'PIPE';
  const rawType = type === 'FLAN' ? 'Flange' : type === 'VALV' ? 'Valve' : type === 'BEND' ? 'BEND' : 'PIPE';
  const diameter = ordinal > 28 ? 60.299999 : ordinal > 20 ? 88.900002 : 114.299995;
  const wall = ordinal > 28 ? 3.9 : ordinal > 20 ? 5.5 : 6.0;
  const start = [ordinal * 100, ordinal % 3 * 250, -ordinal * 75];
  const end = [start[0] + 100, start[1], start[2] - 50];
  const attrs = {
    TYPE: type,
    RAW_TYPE: rawType,
    CANONICAL_TYPE: family,
    NAME: `PE_${String(ordinal).padStart(3, '0')}_${family}_${from}_TO_${to}`,
    SOURCE_ELEMENT_ID: `PE_${String(ordinal).padStart(3, '0')}_${family}_${from}_TO_${to}`,
    SOURCE_XML_INDEX: ordinal,
    SOURCE_NODE_NUMBERS: [from, to],
    FROM_NODE: from,
    TO_NODE: to,
    START_NODE: from,
    END_NODE: to,
    APOS: start,
    LPOS: end,
    POS: midpoint(start, end),
    COMPONENT_CLASS: family,
    DTXR: type === 'VALV' ? 'VALVE' : type === 'FLAN' ? 'FLANGE' : type,
    DIAMETER: String(diameter),
    WALL_THICK: String(wall),
    OUTSIDE_DIAMETER_MM: diameter,
    DIAMETER_MM: diameter,
    WALL_THICKNESS_MM: wall,
    MATERIAL: 'A106 B'
  };
  if (type === 'BEND') {
    attrs.BEND_RADIUS_MM = diameter === 60.299999 ? 76.199997 : diameter === 88.900002 ? 114.299995 : 152.399994;
    attrs.BEND_RADIUS = String(attrs.BEND_RADIUS_MM);
    attrs.BEND_ANGLE_DEG = 45;
    attrs.BEND_ANGLE = '45.000000';
    attrs.ELBOW_ARC_LENGTH_MM = attrs.BEND_RADIUS_MM * Math.PI / 4;
    attrs.BEND_ELEMENT_LENGTH_MM = attrs.ELBOW_ARC_LENGTH_MM;
    attrs.BEND_CHORD_LENGTH_MM = distance(start, end);
    attrs.BEND_CENTER_ESTIMATE = midpoint(start, end);
    attrs.BEND_CENTER_ESTIMATE_SOURCE = 'inputxml-chord-midpoint-not-arc-center';
    attrs.BEND_ARC_CENTER = [start[0] + attrs.BEND_RADIUS_MM, start[1], start[2]];
    attrs.BEND_PLANE_NORMAL = [0, 1, 0];
    attrs.BEND_START_TANGENT = [1, 0, 0];
    attrs.BEND_END_TANGENT = [Math.SQRT1_2, 0, -Math.SQRT1_2];
    attrs.BEND_ARC_EVIDENCE_SOURCE = 'fixture-explicit-arc-center-normal-tangents';
  }
  return { name: `${type} ${attrs.NAME}`, type, attributes: attrs };
}

function supportRecord(ordinal) {
  const node = String(ordinal * 30);
  return {
    name: `ATTA SUPPORT_${ordinal}`,
    type: 'ATTA',
    attributes: {
      TYPE: 'ATTA',
      NAME: `SUPPORT_${ordinal}`,
      SOURCE_ELEMENT_ID: `SUPPORT_${ordinal}`,
      NODE: node,
      SUPPORT_KIND: ordinal % 3 === 0 ? 'LINESTOP' : ordinal % 2 === 0 ? 'GUIDE' : 'REST',
      SUPPORT_AXIS: '+Y',
      POS: [ordinal * 300, 0, -ordinal * 100],
      SOURCE: 'InputXML'
    }
  };
}

function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
