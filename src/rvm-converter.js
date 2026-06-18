import { parseInputXml } from './parser.js?v=professional-viewer-3';
import { buildRvmExportModel } from './export-model.js?v=professional-viewer-3';
import { writeRvm } from './rvm-writer.js?v=professional-viewer-3';
import { writeAtt } from './att-writer.js?v=professional-viewer-3';

/**
 * Converts CAESAR II InputXML into a Navisworks-oriented RVM+ATT pair.
 * Parameters: InputXML text and explicit converter options, including sideload text.
 * Output: binary RVM ArrayBuffer, ATT text, audit summary, parsed model, and export tree.
 * Fallback: parsing and writer failures are raised to the caller with actionable messages.
 */
export function convertInputXmlToRvmAtt(xmlText, options) {
  const model = parseInputXml(xmlText, options || {});
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
      rvmBytes: rvm.byteLength,
      attBytes: new TextEncoder().encode(att).byteLength,
      navisworks: {
        sameBaseNameRequired: true,
        recommendedBaseName: 'inputxml_converted'
      }
    }
  };
}
