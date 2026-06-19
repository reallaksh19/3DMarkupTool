import assert from 'node:assert/strict';
import {
  attachShadowDiagnosticsToGlbResult,
  convertInputXmlToGlbWithPipingShadow,
  CONVERTER_SHADOW_DIAGNOSTICS_SCHEMA
} from '../src/converter-shadow-diagnostics.js';
import { isContractStampedFallback } from '../src/fallback-render-userdata.js';

function sampleModel() {
  return {
    sourceKind: 'InputXML',
    nodes: new Map([
      ['10', { id: '10', x: 0, y: 0, z: 0 }],
      ['20', { id: '20', x: 1000, y: 0, z: 0 }]
    ]),
    elements: [{
      id: 'PIPE_10_20',
      type: 'PIPE',
      rawType: 'PIPE',
      fromNode: '10',
      toNode: '20',
      from: { id: '10', x: 0, y: 0, z: 0 },
      to: { id: '20', x: 1000, y: 0, z: 0 },
      props: { id: 'PIPE_10_20', type: 'PIPE', rawType: 'PIPE', bore: 100, source: 'InputXML' }
    }],
    restraints: [],
    diagnostics: []
  };
}

function sampleScene() {
  return {
    type: 'Scene',
    userData: { existing: true },
    children: [{
      type: 'Mesh',
      isMesh: true,
      name: 'PIPE_10_20_MESH',
      userData: { TYPE: 'COMPONENT', ID: 'PIPE_10_20', engineeringType: 'PIPE', meshRole: 'PIPE' },
      children: []
    }]
  };
}

function sampleValveScene() {
  return {
    type: 'Scene',
    userData: {},
    children: [{
      name: 'plant.geometry',
      userData: {},
      children: [
        {
          type: 'Mesh',
          isMesh: true,
          name: 'V-100',
          visible: true,
          userData: { TYPE: 'COMPONENT', ID: 'V-100', id: 'V-100' },
          children: []
        },
        {
          type: 'Group',
          name: 'V-100_gate-valve',
          visible: true,
          userData: {
            TYPE: 'COMPONENT',
            ID: 'V-100',
            id: 'V-100',
            meshRole: 'CATALOG_VISUAL_GROUP',
            componentClass: 'VALVE',
            visualCatalogSchema: 'valve-flange-visual-catalog/v1',
            visualRecipeId: 'valve-gate-symbol.v1'
          },
          children: []
        },
        {
          type: 'Mesh',
          isMesh: true,
          name: 'P-101',
          visible: true,
          userData: { TYPE: 'COMPONENT', ID: 'P-101', id: 'P-101', meshRole: 'PIPE' },
          children: []
        }
      ]
    }]
  };
}

function assertShadowAudit(result) {
  assert.equal(result.audit.contractPipeline.schemaVersion, CONVERTER_SHADOW_DIAGNOSTICS_SCHEMA);
  assert.equal(result.audit.contractPipeline.mode, 'SHADOW_ONLY');
  assert.equal(result.audit.contractPipeline.activeRenderer, 'LEGACY_FALLBACK_ONLY');
  assert.equal(result.audit.contractPipeline.ok, true);
  assert.equal(result.audit.contractPipeline.counts.componentsTotal, 1);
  assert.equal(result.audit.contractPipeline.counts.geometryContractsTotal, 1);
  assert.ok(result.audit.valveFlangeVisualPostprocess);
}

{
  const scene = sampleScene();
  const result = attachShadowDiagnosticsToGlbResult({
    scene,
    glb: new ArrayBuffer(0),
    audit: { componentCount: 1 },
    model: sampleModel()
  });

  assert.equal(scene.userData.existing, true);
  assert.equal(scene.userData.pipingContractShadow.mode, 'SHADOW_ONLY');
  assert.equal(scene.userData.pipingContractShadow.activeRenderer, 'LEGACY_FALLBACK_ONLY');
  assert.equal(scene.userData.fallbackRendered, undefined, 'scene root is not fallback stamped by default');
  assert.equal(isContractStampedFallback(scene.children[0]), true);
  assert.equal(scene.children[0].userData.componentId, 'PIPE_10_20');
  assert.equal(scene.children[0].userData.componentClass, 'PIPE');
  assert.equal(scene.children[0].userData.fallbackRendered, true);
  assert.equal(result.audit.valveFlangeVisualPostprocess.hiddenBaseCylinders, 0);
  assertShadowAudit(result);
}

{
  const scene = sampleValveScene();
  const result = attachShadowDiagnosticsToGlbResult({
    scene,
    glb: new ArrayBuffer(0),
    audit: { componentCount: 1 },
    model: sampleModel()
  });
  const [valveBase, valveVisual, adjacentPipe] = scene.children[0].children;
  assert.equal(result.audit.valveFlangeVisualPostprocess.hiddenBaseCylinders, 1);
  assert.equal(valveBase.visible, false, 'visual catalogue must hide same-component pipe-through cylinder');
  assert.equal(valveBase.userData.hiddenByVisualCatalog, true);
  assert.equal(valveVisual.visible, true);
  assert.equal(adjacentPipe.visible, true, 'adjacent pipe remains visible');
}

{
  const legacyConvert = async () => ({
    scene: sampleScene(),
    glb: new ArrayBuffer(0),
    audit: { componentCount: 1 },
    model: sampleModel()
  });
  const result = await convertInputXmlToGlbWithPipingShadow('<INPUTXML/>', { supportMode: 'compare' }, legacyConvert);
  assertShadowAudit(result);
  assert.equal(isContractStampedFallback(result.scene.children[0]), true);
  assert.equal(result.audit.valveFlangeVisualPostprocess.glbReexportedAfterVisualPostprocess, undefined);
}

{
  let exporterCalled = false;
  const reexported = new TextEncoder().encode('reexported-after-visual-postprocess').buffer;
  const legacyConvert = async () => ({
    scene: sampleValveScene(),
    glb: new TextEncoder().encode('old-glb-before-postprocess').buffer,
    audit: { componentCount: 1 },
    model: sampleModel()
  });
  const result = await convertInputXmlToGlbWithPipingShadow('<INPUTXML/>', {
    supportMode: 'compare',
    exportSceneToGlb: async (scene) => {
      exporterCalled = true;
      assert.equal(scene.children[0].children[0].visible, false, 'scene must be postprocessed before re-export');
      return reexported;
    }
  }, legacyConvert);

  assert.equal(exporterCalled, true, 'GLB must be re-exported after hiding pipe-through-valve cylinder');
  assert.equal(result.glb, reexported);
  assert.equal(result.audit.valveFlangeVisualPostprocess.hiddenBaseCylinders, 1);
  assert.equal(result.audit.valveFlangeVisualPostprocess.glbReexportedAfterVisualPostprocess, true);
}

{
  await assert.rejects(
    () => convertInputXmlToGlbWithPipingShadow('<INPUTXML/>', {}, null),
    /legacyConvertInputXmlToGlb function is required/
  );
}

console.log('converter shadow diagnostics seam: ok');
