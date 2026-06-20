import { parseMarkupSource } from './source-parser.js?v=20260618-uxml-source-1';
import { buildRvmExportModel } from './export-model.js?v=professional-viewer-3';
import { applyRvmCatalogueExportParity } from './rvm-catalogue-export-wiring.js?v=rvm-catalogue-c3b-1';
import { applySupportRestraintCatalogueExportParity } from './rvm-support-restraint-export-wiring.js?v=support-restraint-c15-1';
import { normalizeNavisExportModelNames } from './navis-safe-export-model.js?v=navis-safe-names-1';
import { applyReviewStyleNodeNames } from './rvm-review-node-names.js?v=rhbg-review-names-1';
import { assertNavisExportModel } from './navis-export-contract.js?v=navis-contract-1';
import { writeRvm } from './rvm-writer.js?v=professional-viewer-3';
import { writeAtt } from './att-writer.js?v=professional-viewer-3';

/**
 * Converts supported source text into a Navisworks-oriented RVM+ATT pair.
 * Supported sources: CAESAR II InputXML and UXML topology JSON.
 * Parameters: source text and explicit converter options, including sideload text.
 * Output: binary RVM ArrayBuffer, ATT text, audit summary, parsed model, and export tree.
 */
export function convertInputXmlToRvmAtt(sourceText, options) {
  const model = parseMarkupSource(sourceText, options || {});
  const baseExportModel = buildRvmExportModel(model, options || {});
  const catalogueExportModel = applyRvmCatalogueExportParity(baseExportModel, model, options || {});
  const supportCatalogueExportModel = applySupportRestraintCatalogueExportParity(catalogueExportModel, model, options || {});
  const safeExportModel = normalizeNavisExportModelNames(supportCatalogueExportModel);
  const exportModel = applyReviewStyleNodeNames(safeExportModel, options || {});
  const navisContract = assertNavisExportModel(exportModel, {
    sourceKind: model.sourceKind || 'InputXML'
  });
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
      navisContract,
      rvmBytes: rvm.byteLength,
      attBytes: new TextEncoder().encode(att).byteLength,
      navisworks: {
        sameBaseNameRequired: true,
        recommendedBaseName: 'inputxml_converted',
        contractSchema: navisContract.schema,
        targetViewer: navisContract.targetViewer
      }
    }
  };
}
