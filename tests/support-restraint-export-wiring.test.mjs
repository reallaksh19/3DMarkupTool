import assert from 'node:assert/strict';
import { applySupportRestraintCatalogueExportParity } from '../src/rvm-support-restraint-export-wiring.js';

const writerSafeKinds = new Set(['cylinder', 'box', 'pyramid', 'sphere']);

const mockModel = {
  nodes: new Map([
    ['10', { id: '10', x: 0, y: 0, z: 0 }],
    ['20', { id: '20', x: 1000, y: 0, z: 0 }]
  ]),
  elements: [{
    fromNode: '10',
    toNode: '20',
    dx: 1000,
    dy: 0,
    dz: 0,
    props: { bore: 120 }
  }]
};

const exportModel = {
  root: {
    name: 'INPUTXML_RVM_ROOT',
    attributes: { TYPE: 'MODEL_ROOT' },
    primitives: [],
    children: [{
      name: 'SUPPORTS_RESTRAINTS',
      attributes: { TYPE: 'GROUP', ROLE: 'SUPPORTS_RESTRAINTS' },
      primitives: [],
      children: [supportNode('ACTUAL_10_GUIDE_1', 'GUIDE'), supportNode('EXPECTED_10_UNKNOWN_2', 'NOT_A_REAL_SUPPORT')]
    }]
  },
  audit: { supportCount: 2, supportMode: 'compare' }
};

const wired = applySupportRestraintCatalogueExportParity(exportModel, mockModel, { supportMode: 'compare' });
const supportGroup = wired.root.children.find((node) => node.attributes.ROLE === 'SUPPORTS_RESTRAINTS');
const supportNodes = supportGroup.children;

assert.equal(wired.audit.supportCatalogueExportParity, true);
assert.equal(wired.audit.supportCatalogueRewrittenNodeCount, 2);
assert.ok(wired.audit.supportCataloguePrimitiveCount >= 3, 'catalogue wiring should emit real support symbol primitives');
assert.deepEqual(wired.audit.supportCatalogueFamilies.sort(), ['GUIDE', 'UNKNOWN_RESTRAINT']);
assert.equal(wired.audit.supportCatalogueProductionWiring, true);
assert.equal(wired.audit.supportCatalogueProportionalFallback, true);
assert.equal(wired.audit.supportCatalogueVendorDimensionalDbBacked, false);

for (const node of supportNodes) {
  assert.equal(node.attributes.SUPPORT_CATALOGUE_VISUAL, 'TRUE', `${node.name} must expose catalogue visual flag`);
  assert.equal(node.attributes.SUPPORT_CATALOGUE_EXPORT_PRODUCTION_WIRING, 'TRUE', `${node.name} must expose production wiring flag`);
  assert.match(node.attributes.SUPPORT_CATALOGUE_SCHEMA, /^SupportRestraintVisualCatalog\.v1\.proportional-fallback$/);
  assert.equal(node.attributes.SUPPORT_CATALOGUE_PROPORTIONAL_FALLBACK, 'TRUE');
  assert.equal(node.attributes.SUPPORT_CATALOGUE_VENDOR_DIMENSIONAL_DB_BACKED, 'FALSE');
  assert.ok(node.attributes.SUPPORT_CATALOGUE_RECIPE_ID, `${node.name} must expose recipe id`);
  assert.ok(node.primitives.length > 0, `${node.name} must emit primitives`);
  for (const primitive of node.primitives) {
    assert.equal(primitive.supportCatalogue, true, `${node.name}/${primitive.name} must be catalogue stamped`);
    assert.equal(primitive.supportVisualSchema, node.attributes.SUPPORT_CATALOGUE_SCHEMA);
    assert.ok(writerSafeKinds.has(primitive.kind), `${primitive.name} leaked unsupported kind ${primitive.kind}`);
  }
}

const guideNode = supportNodes.find((node) => node.attributes.SUPPORT_CATALOGUE_FAMILY === 'GUIDE');
const unknownNode = supportNodes.find((node) => node.attributes.SUPPORT_CATALOGUE_FAMILY === 'UNKNOWN_RESTRAINT');
assert.ok(guideNode, 'GUIDE support must resolve through catalogue');
assert.ok(unknownNode, 'unknown support family must be preserved as UNKNOWN_RESTRAINT');
assert.ok(guideNode.primitives.some((primitive) => primitive.kind === 'pyramid'), 'GUIDE symbol should include arrow heads');
assert.ok(unknownNode.primitives.some((primitive) => primitive.kind === 'box'), 'UNKNOWN_RESTRAINT should render as warning box');

function supportNode(name, family) {
  return {
    name,
    material: 17,
    attributes: {
      TYPE: 'SUPPORT_RESTRAINT',
      ID: name,
      NODE: '10',
      FAMILY: family,
      AXIS: '+X',
      SIGN: 'UNKNOWN',
      SOURCE_CLASS: name.startsWith('ACTUAL') ? 'ACTUAL' : 'EXPECTED',
      SOURCE: name.startsWith('ACTUAL') ? 'InputXML' : 'ISONOTE SIDELOAD',
      SOURCE_MODE: name.startsWith('ACTUAL') ? 'ACTUAL_INPUTXML' : 'EXPECTED_ISONOTE',
      GAP_MM: '0',
      TARGET_VIEWER: 'Navisworks'
    },
    primitives: [{ kind: 'box', name: `${name}_LEGACY_BOX`, center: [0, 0, 0], direction: [0, 0, 1], lengths: [1, 1, 1], material: 17 }],
    children: []
  };
}
