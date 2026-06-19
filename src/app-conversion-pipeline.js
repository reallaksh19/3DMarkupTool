import { convertInputXmlToGlbWithPipingShadow } from './converter-shadow-diagnostics.js';

export const APP_CONVERSION_PIPELINE_SCHEMA = 'AppConversionPipeline.v1';

export async function runAppConversionPipeline(sourceText, options = {}, deps = {}) {
  const {
    convertInputXmlToGlb,
    convertInputXmlToRvmAtt,
    createRvmPreviewScene
  } = deps;

  if (typeof convertInputXmlToGlb !== 'function') {
    throw new Error('convertInputXmlToGlb dependency is required');
  }
  if (typeof convertInputXmlToRvmAtt !== 'function') {
    throw new Error('convertInputXmlToRvmAtt dependency is required');
  }
  if (typeof createRvmPreviewScene !== 'function') {
    throw new Error('createRvmPreviewScene dependency is required');
  }

  const glbResult = await convertInputXmlToGlbWithPipingShadow(
    sourceText,
    options,
    convertInputXmlToGlb
  );
  const rvmResult = convertInputXmlToRvmAtt(sourceText, options);

  return {
    schemaVersion: APP_CONVERSION_PIPELINE_SCHEMA,
    glbResult,
    rvmResult,
    glbScene: glbResult.scene,
    rvmScene: createRvmPreviewScene(rvmResult.exportModel),
    glb: glbResult.glb,
    rvm: rvmResult.rvm,
    att: rvmResult.att,
    audit: {
      glb: glbResult.audit,
      rvmAtt: rvmResult.audit,
      appConversionPipeline: {
        schemaVersion: APP_CONVERSION_PIPELINE_SCHEMA,
        activeRenderer: glbResult.audit?.contractPipeline?.activeRenderer || 'LEGACY_FALLBACK_ONLY',
        contractShadowOk: Boolean(glbResult.audit?.contractPipeline?.ok),
        hasGlbScene: Boolean(glbResult.scene),
        hasRvmScene: true
      }
    }
  };
}

export function assertAppConversionPipelineResult(result) {
  if (!result || typeof result !== 'object') throw new Error('App conversion result is required');
  if (result.schemaVersion !== APP_CONVERSION_PIPELINE_SCHEMA) {
    throw new Error(`Invalid app conversion schemaVersion: ${result.schemaVersion || '(missing)'}`);
  }
  if (!result.glbResult || !result.rvmResult) {
    throw new Error('App conversion result must include glbResult and rvmResult');
  }
  if (!result.audit?.appConversionPipeline) {
    throw new Error('App conversion result must include appConversionPipeline audit');
  }
  if (result.audit.appConversionPipeline.activeRenderer !== 'LEGACY_FALLBACK_ONLY') {
    throw new Error('App conversion pipeline must keep legacy renderer active until contract renderer is explicitly enabled');
  }
  return true;
}
