/**
 * BM_CII managed-stage sample data module.
 *
 * This is bundled with the app so the "Load BM_CII stagedJson" action does
 * not depend on fetching a separate /src/*.json file from GitHub Pages.
 */

export const BM_CII_MANAGED_STAGE_SAMPLE_NAME = 'BM_CII_INPUT_managed_stage.json';
export const BM_CII_MANAGED_STAGE_SAMPLE_URL = '/src/BM_CII_INPUT_managed_stage.json';

export function createBmCiiManagedStageSampleJson() {
  return JSON.stringify(createBmCiiManagedStageSample(), null, 2);
}

export function createBmCiiManagedStageSample() {
  const nodes = {
    10: [0, 0, 0], 20: [0, 0, -108], 30: [0, 0, -1100], 35: [0, 0, -2642],
    70: [0, 0, -3142], 80: [0, 0, -3247], 83: [0, 0, -3333], 86: [0, 0, -3644],
    90: [0, 0, -3730], 100: [0, 0, -3857], 110: [0, 0, -3984], 113: [0, 0, -4070],
    116: [0, 0, -4381], 120: [0, 0, -4467], 130: [0, 0, -4619], 140: [0, 574, -4619],
    150: [0, 1100, -4619], 160: [0, 1883, -4619], 170: [1050, 1883, -4619],
    180: [1050, 1731, -4619], 190: [1050, 1623, -4619], 200: [0, 342, -1100],
    205: [-1214, 342, -1100], 210: [-2428, 342, -1100], 220: [-2428, -607, -1100],
    230: [-2428, -607, -1308], 233: [-2428, -607, -1388], 236: [-2428, -607, -1676],
    240: [-2428, -607, -1756], 250: [0, 1100, -3142], 255: [0, 1100, -3802],
    260: [0, 1100, -4073], 270: [0, 1100, -4530], 280: [0, -80, -3857],
    290: [0, -130, -3857], 300: [0, -171, -3857], 310: [0, -216, -3857],
    320: [0, 574, -4544], 330: [0, 574, -4494], 340: [0, 574, -4470]
  };
  const specs = [
    ['FLAN','FLANGE_PAIR','PE_001_FLANGE_PAIR_10_TO_20','10','20','114.3mm'],
    ['PIPE','PIPE','PE_002_PIPE_20_TO_30','20','30','114.3mm'],
    ['PIPE','PIPE','PE_003_PIPE_30_TO_35','30','35','114.3mm'],
    ['PIPE','PIPE','PE_004_PIPE_35_TO_70','35','70','114.3mm'],
    ['PIPE','PIPE','PE_005_PIPE_70_TO_80','70','80','114.3mm'],
    ['FLAN','FLANGE','PE_006_FLANGE_80_TO_83','80','83','114.3mm'],
    ['VALV','FLANGED_VALVE','PE_007_FLANGED_VALVE_83_TO_86','83','86','114.3mm'],
    ['FLAN','FLANGE','PE_008_FLANGE_86_TO_90','86','90','114.3mm'],
    ['PIPE','PIPE','PE_009_PIPE_90_TO_100','90','100','114.3mm'],
    ['PIPE','PIPE','PE_010_PIPE_100_TO_110','100','110','114.3mm'],
    ['FLAN','FLANGE','PE_011_FLANGE_110_TO_113','110','113','114.3mm'],
    ['VALV','FLANGED_VALVE','PE_012_FLANGED_VALVE_113_TO_116','113','116','114.3mm'],
    ['FLAN','FLANGE','PE_013_FLANGE_116_TO_120','116','120','114.3mm'],
    ['BEND','BEND','PE_014_BEND_120_TO_130','120','130','114.3mm','152.4','45'],
    ['PIPE','PIPE','PE_015_PIPE_130_TO_140','130','140','114.3mm'],
    ['PIPE','PIPE','PE_016_PIPE_140_TO_150','140','150','114.3mm'],
    ['BEND','BEND','PE_017_BEND_150_TO_160','150','160','114.3mm','152.4','45'],
    ['BEND','BEND','PE_018_BEND_160_TO_170','160','170','114.3mm','152.4','45'],
    ['PIPE','PIPE','PE_019_PIPE_170_TO_180','170','180','114.3mm'],
    ['FLAN','FLANGE_PAIR','PE_020_FLANGE_PAIR_180_TO_190','180','190','114.3mm'],
    ['BEND','BEND','PE_021_BEND_30_TO_200','30','200','88.9mm','114.3','45'],
    ['PIPE','PIPE','PE_022_PIPE_200_TO_205','200','205','88.9mm'],
    ['BEND','BEND','PE_023_BEND_205_TO_210','205','210','88.9mm','114.3','45'],
    ['BEND','BEND','PE_024_BEND_210_TO_220','210','220','88.9mm','114.3','45'],
    ['PIPE','PIPE','PE_025_PIPE_220_TO_230','220','230','88.9mm'],
    ['FLAN','FLANGE','PE_026_FLANGE_230_TO_233','230','233','88.9mm'],
    ['VALV','FLANGED_VALVE','PE_027_FLANGED_VALVE_233_TO_236','233','236','88.9mm'],
    ['FLAN','FLANGE','PE_028_FLANGE_236_TO_240','236','240','88.9mm'],
    ['BEND','BEND','PE_029_BEND_70_TO_250','70','250','60.3mm','76.2','45'],
    ['PIPE','PIPE','PE_030_PIPE_250_TO_255','250','255','60.3mm'],
    ['PIPE','PIPE','PE_031_PIPE_255_TO_260','255','260','60.3mm'],
    ['VALV','VALVE','PE_032_VALVE_260_TO_270','260','270','60.3mm'],
    ['PIPE','PIPE','PE_033_PIPE_270_TO_150','270','150','60.3mm'],
    ['PIPE','PIPE','PE_034_PIPE_100_TO_280','100','280','26.7mm'],
    ['PIPE','PIPE','PE_035_PIPE_280_TO_290','280','290','26.7mm'],
    ['VALV','VALVE','PE_036_VALVE_290_TO_300','290','300','26.7mm'],
    ['PIPE','UNSPECIFIED','PE_037_UNSPECIFIED_300_TO_310','300','310','26.7mm'],
    ['PIPE','PIPE','PE_038_PIPE_140_TO_320','140','320','21.3mm'],
    ['PIPE','PIPE','PE_039_PIPE_320_TO_330','320','330','21.3mm'],
    ['VALV','VALVE','PE_040_VALVE_330_TO_340','330','340','21.3mm']
  ];
  const children = specs.map((spec) => component(spec, nodes)).concat(supports(nodes));
  return {
    schema: 'inputxml-managed-stage/v1',
    profile: 'AVEVA_JSON_FOR_3D_RVM_VIEWER',
    source: 'BM_CII_INPUT.XML',
    converter: 'INPUTXML->GLB',
    generatedAt: '2026-06-19T02:06:53.322Z',
    units: { length: 'mm' },
    stats: { components: 40, restraints: 48, branches: 1, children: 52 },
    hierarchy: [{ name: '/INPUTXML/BM_CII_INPUT/BRANCH-001', type: 'BRANCH', children }]
  };
}

function component([type, dtxr, name, from, to, diameter, bendRadius = '', bendAngle = ''], nodes) {
  return { name: `${type} ${name}`, type, attributes: {
    TYPE: type, RAW_TYPE: dtxr, NAME: name, REF: name, FROM_NODE: from, TO_NODE: to,
    APOS: xyz(nodes[from]), LPOS: xyz(nodes[to]), DIAMETER: diameter, BORE: diameter,
    DTXR: dtxr, MATERIAL: 'A106 B', WALL_THICK: '6.000000', BEND_RADIUS: bendRadius, BEND_ANGLE: bendAngle,
    SOURCE_FORMAT: 'INPUTXML_BASIC_GLB_STAGED', SOURCE_ELEMENT_ID: name
  }};
}

function supports(nodes) {
  const specs = [
    ['10', 'REST'], ['35', 'REST'], ['35', 'GUIDE'], ['35', 'LINESTOP'], ['130', 'LINESTOP'], ['190', 'REST'],
    ['205', 'LINESTOP'], ['205', 'REST'], ['205', 'REST'], ['240', 'REST'], ['255', 'REST'], ['255', 'GUIDE']
  ];
  return specs.map(([node, kind], index) => ({ name: `SUPPORT INPUTXML-${node}-${kind}`, type: 'ATTA', attributes: {
    TYPE: 'ATTA', RAW_TYPE: 'ATTA', NAME: `INPUTXML-${node}-${kind}-${index}`, REF: `INPUTXML_RESTRAINT_${index + 1}`,
    NODE: node, POS: xyz(nodes[node]), SUPPORTCOORD: xyz(nodes[node]), SUPPORT_COORD: xyz(nodes[node]),
    SUPPORT_KIND: kind, SUPPORT_TYPE: kind, SUPPORT_MAPPER_KIND: kind, CMPSUPTYPE: kind, MDSSUPPTYPE: kind,
    SOURCE_FORMAT: 'INPUTXML_BASIC_GLB_STAGED', SOURCE_RESTRAINT_ID: `INPUTXML_RESTRAINT_${index + 1}`
  }}));
}

function xyz([x, y, z]) { return { x, y, z }; }
