import { convertInputXmlToGlb as defaultConvertInputXmlToGlb } from './converter.js?v=professional-viewer-3';
import { convertInputXmlToRvmAtt as defaultConvertInputXmlToRvmAtt } from './rvm-converter.js?v=professional-viewer-3';
import { createRvmPreviewScene as defaultCreateRvmPreviewScene } from './rvm-preview.js?v=professional-viewer-3';
import { convertInputXmlToGlbWithPipingShadow } from './converter-shadow-diagnostics.js';

export const APP_CONVERSION_PIPELINE_SCHEMA = 'AppConversionPipeline.v2';

export async function runAppConversionPipeline(sourceText, options = {}, deps = {}) {
  const {
    convertInputXmlToGlb,
    convertInputXmlToRvmAtt,
    createRvmPreviewScene
  } = await resolveAppConversionDeps(deps);

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
        hasRvmScene: true,
        dependencyPolicy: 'static-defaults-with-override'
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

async function resolveAppConversionDeps(deps = {}) {
  return {
    ...deps,
    convertInputXmlToGlb: typeof deps.convertInputXmlToGlb === 'function'
      ? deps.convertInputXmlToGlb
      : defaultConvertInputXmlToGlb,
    convertInputXmlToRvmAtt: typeof deps.convertInputXmlToRvmAtt === 'function'
      ? deps.convertInputXmlToRvmAtt
      : defaultConvertInputXmlToRvmAtt,
    createRvmPreviewScene: typeof deps.createRvmPreviewScene === 'function'
      ? deps.createRvmPreviewScene
      : defaultCreateRvmPreviewScene
  };
}
