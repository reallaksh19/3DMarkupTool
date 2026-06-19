import {
  attachPipingContractShadow,
  compactReport,
  runPipingContractShadow
} from './piping-contract-shadow-runner.js';

export const CONVERTER_SHADOW_DIAGNOSTICS_SCHEMA = 'ConverterShadowDiagnostics.v1';

export function attachShadowDiagnosticsToGlbResult(glbResult, options = {}) {
  if (!glbResult || typeof glbResult !== 'object') throw new Error('glbResult is required');
  const report = options.report || runPipingContractShadow(glbResult.model, {
    ...options,
    target: options.target || 'VIEWER'
  });
  const compact = compactReport(report);

  if (glbResult.scene) attachPipingContractShadow(glbResult.scene, report);
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
    }
  };

  return glbResult;
}

export async function convertInputXmlToGlbWithPipingShadow(sourceText, options = {}, legacyConvertInputXmlToGlb) {
  if (typeof legacyConvertInputXmlToGlb !== 'function') {
    throw new Error('legacyConvertInputXmlToGlb function is required');
  }
  const glbResult = await legacyConvertInputXmlToGlb(sourceText, options);
  return attachShadowDiagnosticsToGlbResult(glbResult, options);
}
