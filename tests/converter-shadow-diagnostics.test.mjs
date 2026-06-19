import assert from 'node:assert/strict';
import {
  attachShadowDiagnosticsToGlbResult,
  convertInputXmlToGlbWithPipingShadow,
  CONVERTER_SHADOW_DIAGNOSTICS_SCHEMA
} from '../src/converter-shadow-diagnostics.js';

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

function assertShadowAudit(result) {
  assert.equal(result.audit.contractPipeline.schemaVersion, CONVERTER_SHADOW_DIAGNOSTICS_SCHEMA);
  assert.equal(result.audit.contractPipeline.mode, 'SHADOW_ONLY');
  assert.equal(result.audit.contractPipeline.activeRenderer, 'LEGACY_FALLBACK_ONLY');
  assert.equal(result.audit.contractPipeline.ok, true);
  assert.equal(result.audit.contractPipeline.counts.componentsTotal, 1);
  assert.equal(result.audit.contractPipeline.counts.geometryContractsTotal, 1);
}

{
  const scene = { userData: { existing: true } };
  const result = attachShadowDiagnosticsToGlbResult({
    scene,
    glb: new ArrayBuffer(0),
    audit: { componentCount: 1 },
    model: sampleModel()
  });

  assert.equal(scene.userData.existing, true);
  assert.equal(scene.userData.pipingContractShadow.mode, 'SHADOW_ONLY');
  assert.equal(scene.userData.pipingContractShadow.activeRenderer, 'LEGACY_FALLBACK_ONLY');
  assertShadowAudit(result);
}

{
  const legacyConvert = async () => ({
    scene: { userData: {} },
    glb: new ArrayBuffer(0),
    audit: { componentCount: 1 },
    model: sampleModel()
  });
  const result = await convertInputXmlToGlbWithPipingShadow('<INPUTXML/>', { supportMode: 'compare' }, legacyConvert);
  assertShadowAudit(result);
}

{
  await assert.rejects(
    () => convertInputXmlToGlbWithPipingShadow('<INPUTXML/>', {}, null),
    /legacyConvertInputXmlToGlb function is required/
  );
}

console.log('converter shadow diagnostics seam: ok');
