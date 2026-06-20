import { parseMarkupSource } from './source-parser.js?v=20260618-uxml-source-1';
import { buildRvmExportModel } from './export-model.js?v=professional-viewer-3';
import { applyRvmCatalogueExportParity } from './rvm-catalogue-export-wiring.js?v=rvm-catalogue-c3b-1';
import { applySupportRestraintCatalogueExportParity } from './rvm-support-restraint-export-wiring.js?v=support-restraint-c15-1';
import { normalizeNavisExportModelNames } from './navis-safe-export-model.js?v=navis-safe-names-1';
import { applyReviewStyleNodeNames } from './rvm-review-node-names.js?v=rhbg-review-names-1';
import { assertNavisExportModel } from './navis-export-contract.js?v=navis-contract-1';
import { assertRvmMaterialLayerContract } from './rvm-material-layer-contract.js?v=rvm-material-layer-1';
import { assertRvmMaterialTableContract } from './rvm-material-table-contract.js?v=rvm-material-table-1';
import { writeRvm } from './rvm-writer.js?v=professional-viewer-3';
import { writeAtt } from './att-writer.js?v=professional-viewer-3';
import { scanRvmPrimitivePayloads } from './rvm-primitive-payload-decoder.js?v=rvm-payload-contract-1';

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
  const rvmMaterialLayerContract = assertRvmMaterialLayerContract(exportModel);
  const rvm = writeRvm(exportModel);
  const rvmMaterialTableContract = assertRvmMaterialTableContract(rvm, rvmMaterialLayerContract);
  const rvmPrimitivePayloadContract = assertGeneratedRvmPayloadCompatibility(scanRvmPrimitivePayloads(rvm));
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
      rvmMaterialLayerContract,
      rvmMaterialTableContract,
      rvmPrimitivePayloadContract,
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

function assertGeneratedRvmPayloadCompatibility(primitives) {
  const statusCounts = {};
  const codeCounts = {};
  const unsafe = [];

  for (const primitive of primitives || []) {
    const status = primitive.compatibilityStatus || 'unknown';
    const code = String(primitive.code ?? 'unknown');
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    codeCounts[code] = (codeCounts[code] || 0) + 1;
    if (primitive.rhbgObservedButBlocked || !primitive.supportedForEmission) unsafe.push(primitive);
  }

  if (unsafe.length > 0) {
    const summary = unsafe.map((primitive) => `code ${primitive.code} at offset ${primitive.offset ?? 'unknown'}`).join(', ');
    throw new Error(`Generated RVM contains unsupported primitive payloads: ${summary}`);
  }

  return {
    schema: 'GeneratedRvmPrimitivePayloadContract.v1',
    primitiveCount: primitives?.length || 0,
    failClosed: true,
    unsupportedPrimitivePayloadsPresent: false,
    statusCounts,
    codeCounts
  };
}
