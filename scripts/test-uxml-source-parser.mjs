import { parseMarkupSource, detectSourceType } from '../src/source-parser.js?v=20260618-uxml-source-1';

const uxml = {
  schemaVersion: 'uxml-test/v1',
  profile: 'TOPOLOGY_FULL',
  pipelines: [{ id: 'P1', lineNo: 'LINE-100', lineKey: 'LINE-100' }],
  anchors: [
    { id: 'A1', point: { x: 0, y: 0, z: 0 } },
    { id: 'A2', point: { x: 1000, y: 0, z: 0 } },
    { id: 'A3', point: { x: 1000, y: 500, z: 0 } }
  ],
  ports: [
    { id: 'P_START', componentId: 'C_PIPE:00001', anchorId: 'A1', role: 'START', bore: '250mm' },
    { id: 'P_END', componentId: 'C_PIPE:00001', anchorId: 'A2', role: 'END', bore: '250mm' },
    { id: 'O_RUN', componentId: 'C_OLET:00002', anchorId: 'A2', role: 'RUN', bore: '250mm' },
    { id: 'O_BRANCH', componentId: 'C_OLET:00002', anchorId: 'A3', role: 'BRANCH', bore: '50mm' }
  ],
  segments: [
    { id: 'S_PIPE', componentId: 'C_PIPE:00001', startAnchorId: 'A1', endAnchorId: 'A2', startBore: '250mm', endBore: '250mm' },
    { id: 'S_OLET', componentId: 'C_OLET:00002', startAnchorId: 'A2', endAnchorId: 'A3', startBore: '250mm', endBore: '50mm', branchBore: '50mm' }
  ],
  components: [
    { id: 'C_PIPE:00001', type: 'PIPE', normalizedType: 'PIPE', pipelineRef: 'P1', lineKey: 'LINE-100', bore: '250mm', portIds: ['P_START', 'P_END'], segmentIds: ['S_PIPE'], rawAttributes: { TYPE: 'PIPE', ABORE: '250mm', LBORE: '250mm' } },
    { id: 'C_OLET:00002', type: 'OLET', normalizedType: 'OLET', pipelineRef: 'P1', lineKey: 'LINE-100', bore: '250mm', branchBore: '50mm', portIds: ['O_RUN', 'O_BRANCH'], segmentIds: ['S_OLET'], rawAttributes: { TYPE: 'OLET', ABORE: '250mm', LBORE: '250mm', BBORE: '50mm', SPRE: '/SPEC/BR3B-250x50' } }
  ],
  supports: [{ id: 'SUP-1', type: 'REST', supportAnchorId: 'A2', restraints: [{ family: 'REST', axis: '+Y' }] }]
};

const text = JSON.stringify(uxml);
const detected = detectSourceType(text, 'renamed.json');
if (detected.kind !== 'uxml') throw new Error(`Expected UXML content detection, got ${detected.kind}`);

const model = parseMarkupSource(text, { filename: 'renamed.json' });
if (model.sourceKind !== 'UXML') throw new Error(`Expected sourceKind UXML, got ${model.sourceKind}`);
if (model.elements.length !== 2) throw new Error(`Expected 2 elements, got ${model.elements.length}`);
if (model.nodes.size !== 3) throw new Error(`Expected 3 nodes, got ${model.nodes.size}`);
if (model.restraints.length !== 1) throw new Error(`Expected 1 restraint, got ${model.restraints.length}`);

const pipe = model.elements.find((element) => element.rawType === 'PIPE');
const olet = model.elements.find((element) => element.rawType === 'OLET');
if (!pipe || !olet) throw new Error('Expected PIPE and OLET elements.');
if (pipe.props.bore !== '250') throw new Error(`Expected numeric pipe bore 250, got ${pipe.props.bore}`);
if (olet.props.bore !== '250') throw new Error(`Expected OLET run bore 250, got ${olet.props.bore}`);
if (olet.props.branchBore !== '50') throw new Error(`Expected OLET branch bore 50, got ${olet.props.branchBore}`);

console.log('✅ UXML source parser smoke passed.');
