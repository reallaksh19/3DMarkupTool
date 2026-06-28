import { MANAGED_STAGE_SUPPORT_SOURCE_MODES } from './managed-stage-support-mapper-config.js?v=bust-cache-4';

export const MANAGED_STAGE_SUPPORT_BASIS_CONTRACT_SCHEMA = 'ManagedStageSupportBasisContract.v1';

export function resolveManagedStageSupportBasisOptions(options = {}) {
  const ui = globalThis.__3D_MARKUP_SUPPORT_SOURCE_UI__ || {};
  const doc = globalThis.document || null;
  const supportSourceMode = normalizeSupportSourceMode(
    options.supportSourceMode
    || options.sourceMode
    || ui.sourceMode
    || doc?.getElementById?.('supportMode')?.value
    || MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON
  );
  return {
    schema: MANAGED_STAGE_SUPPORT_BASIS_CONTRACT_SCHEMA,
    supportSourceMode,
    supportMapperConfig: options.supportMapperConfig || ui.mapperConfig || {},
    isonoteText: options.isonoteText ?? doc?.getElementById?.('isonoteText')?.value ?? '',
    source: options.supportSourceMode || ui.sourceMode ? 'explicit-or-ui' : 'default-stagedJson'
  };
}

export function applyManagedStageSupportBasisToContract(contract, basisOptions = {}) {
  const supportSourceMode = normalizeSupportSourceMode(basisOptions.supportSourceMode);
  const originalSupports = Array.isArray(contract?.supports) ? contract.supports : [];
  const isonoteRecords = Array.isArray(contract?.isonoteRecords) ? contract.isonoteRecords : [];
  let supports = originalSupports;
  let suppressionReason = '';

  if (supportSourceMode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF) {
    supports = [];
    suppressionReason = 'support-basis-off';
  } else if (supportSourceMode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE) {
    supports = originalSupports
      .filter((support) => support.matchedIsonoteRecord || support.isonoteRawText)
      .map((support) => rewriteSupportAsIsonoteBasis(support));
    suppressionReason = 'isonote-basis-unmatched-staged-support-suppressed';
  } else {
    supports = originalSupports.map((support) => rewriteSupportAsInputXmlBasis(support));
  }

  const basisAudit = {
    schema: MANAGED_STAGE_SUPPORT_BASIS_CONTRACT_SCHEMA,
    activeBasis: supportSourceMode,
    activeSourceExclusive: true,
    inputXmlSupportSourceCount: originalSupports.length,
    isonoteSupportSourceCount: isonoteRecords.length,
    emittedSupportCount: supports.length,
    suppressedSupportCount: Math.max(0, originalSupports.length - supports.length),
    suppressionReason,
    normalizedBySameSupportMapper: true,
    isonoteBasisRequiresNodeFamilyMatch: supportSourceMode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE
  };

  return {
    ...contract,
    supports,
    supportSourceBasis: basisAudit,
    diagnostics: [
      ...(contract?.diagnostics || []),
      {
        code: 'SUPPORT_SOURCE_BASIS_APPLIED',
        severity: basisAudit.emittedSupportCount || supportSourceMode !== MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE ? 'info' : 'warning',
        message: `support basis ${supportSourceMode}: emitted ${basisAudit.emittedSupportCount}/${basisAudit.inputXmlSupportSourceCount} support markers; isonote source rows=${basisAudit.isonoteSupportSourceCount}`,
        supportSourceBasis: basisAudit
      }
    ]
  };
}

function rewriteSupportAsInputXmlBasis(support) {
  return {
    ...support,
    sourceKind: 'stagedJson',
    sourceMode: MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON,
    activeBasis: MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON,
    activeBasisLabel: 'InputXML Basis',
    sourceAttributes: {
      ...(support.sourceAttributes || {}),
      SUPPORT_SOURCE_MODE: MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON,
      SUPPORT_ACTIVE_BASIS: 'InputXML Basis'
    }
  };
}

function rewriteSupportAsIsonoteBasis(support) {
  const matched = support.matchedIsonoteRecord || {};
  const matchedAttrs = matched.attrs || matched.mapperRecord?.attrs || {};
  return {
    ...support,
    sourceKind: 'isonote',
    sourceMode: MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE,
    activeBasis: MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE,
    activeBasisLabel: 'ISONOTE Basis',
    supportKindRaw: matchedAttrs.SUPPORT_KIND || support.supportKindRaw,
    supportKindNormalized: matched.mapperRecord?.family || support.supportKindNormalized,
    axisRaw: matched.mapperRecord?.axis?.sourceAxis || matchedAttrs.SUPPORT_AXIS || support.axisRaw,
    axisCanvas: matched.mapperRecord?.axis?.canvasAxis || matchedAttrs.AXIS || support.axisCanvas,
    isonoteRawText: matched.rawText || support.isonoteRawText || '',
    isonoteNoteName: matched.supportTag || matched.nodeId || support.isonoteNoteName || '',
    sourceAttributes: {
      ...(support.sourceAttributes || {}),
      ...matchedAttrs,
      SUPPORT_SOURCE_MODE: MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE,
      SUPPORT_ACTIVE_BASIS: 'ISONOTE Basis',
      ISONOTE_RAW_TEXT: matched.rawText || support.isonoteRawText || ''
    },
    diagnostics: [
      ...(support.diagnostics || []),
      {
        code: 'ISONOTE_BASIS_MATCHED_TO_STAGED_NODE',
        severity: 'info',
        message: 'ISONOTE basis support row matched to staged node/family for position and pipe context.'
      }
    ]
  };
}

function normalizeSupportSourceMode(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'off' || text === 'none' || text === 'disabled') return MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF;
  if (text === 'isonote' || text === 'iso_note' || text === 'iso-note' || text === 'note') return MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE;
  return MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON;
}
