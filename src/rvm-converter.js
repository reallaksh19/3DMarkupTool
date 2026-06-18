import { parseMarkupSource } from './source-parser.js?v=20260618-uxml-source-1';
import { buildRvmExportModel } from './export-model.js?v=professional-viewer-3';
import { writeRvm } from './rvm-writer.js?v=professional-viewer-3';
import { writeAtt } from './att-writer.js?v=professional-viewer-3';

/**
 * Converts supported source text into a Navisworks-oriented RVM+ATT pair.
 * Supported sources: CAESAR II InputXML and UXML topology JSON.
 * Parameters: source text and explicit converter options, including sideload text.
 * Output: binary RVM ArrayBuffer, ATT text, audit summary, parsed model, and export tree.
 * Fallback: parsing and writer failures are raised to the caller with actionable messages.
 */
export function convertInputXmlToRvmAtt(sourceText, options) {
  const model = parseMarkupSource(sourceText, options || {});
  const exportModel = buildRvmExportModel(model, options || {});
  const rvm = writeRvm(exportModel);
  const att = writeAtt(exportModel);
  return {
    model,
    exportModel,
    rvm,
    att,
    audit: {
      ...exportModel.audit,
      sourceKind: model.sourceKind || 'InputXML',
      sourceSchemaVersion: model.sourceSchemaVersion || '',
      diagnostics: model.diagnostics || [],
      rvmBytes: rvm.byteLength,
      attBytes: new TextEncoder().encode(att).byteLength,
      navisworks: {
        sameBaseNameRequired: true,
        recommendedBaseName: 'inputxml_converted'
      }
    }
  };
}
