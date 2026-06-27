import { exportSceneToGlb } from './converter.js?v=bust-cache-4';
import { stampLegacyFallbackSceneUserData } from './fallback-render-userdata.js?v=bust-cache-4';
import { hideCatalogReplacedBaseCylinders } from './valve-flange-scene-postprocess.js?v=bust-cache-4';
import {
  attachPipingContractShadow,
  compactReport,
  runPipingContractShadow
} from './piping-contract-shadow-runner.js?v=bust-cache-4';

export const CONVERTER_SHADOW_DIAGNOSTICS_SCHEMA = 'ConverterShadowDiagnostics.v1';

export function attachShadowDiagnosticsToGlbResult(glbResult, options = {}) {
  if (!glbResult || typeof glbResult !== 'object') throw new Error('glbResult is required');
  const report = options.report || runPipingContractShadow(glbResult.model, {
    ...options,
    target: options.target || 'VIEWER'
  });
  const compact = compactReport(report);
  let valveFlangeVisualPostprocess = null;

  if (glbResult.scene) {
    attachPipingContractShadow(glbResult.scene, report);
    valveFlangeVisualPostprocess = hideCatalogReplacedBaseCylinders(glbResult.scene);
    stampLegacyFallbackSceneUserData(glbResult.scene, {
      sourceType: glbResult.model?.sourceKind || glbResult.audit?.sourceKind || 'InputXML',
      fallbackReason: 'legacy renderer output stamped as explicit fallback after contract shadow run'
    });
  }
  glbResult.audit = {
    ...(glbResult.audit || {}),
    contractPipeline: {
      schemaVersion: CONVERTER_SHADOW_DIAGNOSTICS_SCHEMA,
      mode: 'SHADOW_ONLY',
      activeRenderer: compact.activeRenderer,
      replacementPath: compact.replacementPath,
      ok: compact.ok,
      counts: { ...(compact.counts || {}) },
      errors: Array.isArray(compact.errors) ? compact.errors.map((error) => ({ ...error })) : []
    },
    valveFlangeVisualPostprocess
  };

  return glbResult;
}

export async function convertInputXmlToGlbWithPipingShadow(sourceText, options = {}, legacyConvertInputXmlToGlb) {
  if (typeof legacyConvertInputXmlToGlb !== 'function') {
    throw new Error('legacyConvertInputXmlToGlb function is required');
  }
  const glbResult = await legacyConvertInputXmlToGlb(sourceText, options);
  attachShadowDiagnosticsToGlbResult(glbResult, options);

  const postprocess = glbResult.audit?.valveFlangeVisualPostprocess;
  const shouldReexport = Boolean(
    glbResult.scene
    && postprocess
    && options.reexportGlbAfterVisualPostprocess !== false
    && (
      postprocess.hiddenBaseCylinders > 0
      || postprocess.flangeVisualCorrections > 0
      || postprocess.flangeTopologyCorrections > 0
    )
  );

  if (shouldReexport) {
    const reexport = typeof options.exportSceneToGlb === 'function' ? options.exportSceneToGlb : exportSceneToGlb;
    glbResult.glb = await reexport(glbResult.scene);
    glbResult.audit.valveFlangeVisualPostprocess = {
      ...postprocess,
      glbReexportedAfterVisualPostprocess: true
    };
  }

  return glbResult;
}
