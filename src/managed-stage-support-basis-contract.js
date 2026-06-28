import { MANAGED_STAGE_SUPPORT_SOURCE_MODES } from './managed-stage-support-mapper-config.js?v=bust-cache-4';

export const MANAGED_STAGE_SUPPORT_BASIS_CONTRACT_SCHEMA = 'ManagedStageSupportBasisContract.v2';

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
  let unmatchedIsonoteRecords = [];

  if (supportSourceMode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF) {
    supports = [];
    suppressionReason = 'support-basis-off';
  } else if (supportSourceMode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE) {
    const matchedPairs = originalSupports
      .map((support) => ({ support, matched: findIsonoteBasisMatch(support, isonoteRecords) }))
      .filter((pair) => pair.matched);
    supports = matchedPairs.map((pair) => rewriteSupportAsIsonoteBasis(pair.support, pair.matched));
    const matchedRecordSet = new Set(matchedPairs.map((pair) => pair.matched));
    unmatchedIsonoteRecords = isonoteRecords.filter((record) => !matchedRecordSet.has(record));
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
    unmatchedIsonoteRecordCount: unmatchedIsonoteRecords.length,
    unmatchedIsonoteRecords: unmatchedIsonoteRecords.map((record) => ({ node: record.nodeId || record.attrs?.NODE || '', family: record.mapperRecord?.family || record.attrs?.SUPPORT_KIND_MAPPED || record.attrs?.SUPPORT_KIND || '', rawText: record.rawText || '' })),
    suppressionReason,
    normalizedBySameSupportMapper: true,
    isonoteBasisRequiresNodeFamilyMatch: supportSourceMode === MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE,
    tagMismatchDoesNotSuppressNodeFamilyMatch: true,
    singleAxisMayMatchByNodeAxis: true,
    springFamilyAliases: ['SPRING', 'HANGER', 'SPRING_CAN', 'SPRING_HANGER', 'CAN']
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
        message: `support basis ${supportSourceMode}: emitted ${basisAudit.emittedSupportCount}/${basisAudit.inputXmlSupportSourceCount} support markers; isonote source rows=${basisAudit.isonoteSupportSourceCount}; unmatched isonote rows=${basisAudit.unmatchedIsonoteRecordCount}`,
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

function rewriteSupportAsIsonoteBasis(support, matchedRecord = null) {
  const matched = matchedRecord || support.matchedIsonoteRecord || {};
  const matchedAttrs = matched.attrs || matched.mapperRecord?.attrs || {};
  const matchedFamily = normalizeFamily(matched.mapperRecord?.family || matchedAttrs.SUPPORT_KIND_MAPPED || matchedAttrs.SUPPORT_KIND || '');
  return {
    ...support,
    matchedIsonoteRecord: matched,
    sourceKind: 'isonote',
    sourceMode: MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE,
    activeBasis: MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE,
    activeBasisLabel: 'ISONOTE Basis',
    supportKindRaw: matchedAttrs.SUPPORT_KIND || support.supportKindRaw,
    supportKindNormalized: matched.mapperRecord?.family || support.supportKindNormalized,
    supportFamily: matchedFamily && matchedFamily !== 'UNKNOWN' ? matchedFamily : support.supportFamily,
    axisRaw: matched.mapperRecord?.axis?.sourceAxis || matchedAttrs.SUPPORT_AXIS || support.axisRaw,
    axisCanvas: matched.mapperRecord?.axis?.canvasAxis || matchedAttrs.AXIS || support.axisCanvas,
    isonoteRawText: matched.rawText || support.isonoteRawText || '',
    isonoteNoteName: matched.supportTag || matched.nodeId || support.isonoteNoteName || '',
    isonoteMatch: {
      ...(support.isonoteMatch || {}),
      matched: Boolean(matched),
      matchMethod: matched?.matchMethod || 'node-family-or-node-axis',
      confidence: matched ? 0.9 : 0,
      rawText: matched.rawText || support.isonoteRawText || '',
      noteName: matched.supportTag || matched.nodeId || support.isonoteNoteName || '',
      matchedFields: matched?.matchMethod === 'node-axis' ? ['nodeNumber', 'axis'] : ['nodeNumber', 'supportFamily']
    },
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
        message: matched?.matchMethod === 'node-axis'
          ? 'ISONOTE basis support row matched to staged node/axis for position and pipe context.'
          : 'ISONOTE basis support row matched to staged node/family for position and pipe context.'
      }
    ]
  };
}

function findIsonoteBasisMatch(support, isonoteRecords = []) {
  const node = normalizedNode(support.nodeNumber);
  const supportFamily = normalizeFamily(support.supportFamily || support.supportKindNormalized || support.supportKindRaw || '');
  const supportAxis = normalizeAxis(support.axisCanvas || support.axisRaw || support.axisTransform?.canvasAxis || support.axisTransform?.sourceAxis || '');
  const candidates = (isonoteRecords || []).filter((record) => normalizedNode(record.nodeId || record.attrs?.NODE) === node);
  if (!candidates.length) return null;
  const exactFamily = candidates.find((record) => familiesEquivalent(supportFamily, normalizeFamily(record.mapperRecord?.family || record.attrs?.SUPPORT_KIND_MAPPED || record.attrs?.SUPPORT_KIND || '')));
  if (exactFamily) return { ...exactFamily, matchMethod: 'node-family' };
  const axisMatch = candidates.find((record) => {
    const recordAxis = normalizeAxis(record.mapperRecord?.axis?.canvasAxis || record.mapperRecord?.axis?.sourceAxis || record.attrs?.SUPPORT_AXIS || record.attrs?.AXIS || '');
    return recordAxis && supportAxis && recordAxis.replace('+', '') === supportAxis.replace('+', '');
  });
  if (axisMatch) return { ...axisMatch, matchMethod: 'node-axis' };
  return null;
}

function familiesEquivalent(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const spring = new Set(['SPRING', 'HANGER', 'SPRING_CAN', 'SPRING_HANGER', 'CAN']);
  if (spring.has(a) && spring.has(b)) return true;
  if ((a === 'LINE_STOP' && b === 'LINESTOP') || (a === 'LINESTOP' && b === 'LINE_STOP')) return true;
  return false;
}

function normalizeFamily(value) {
  const text = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!text) return '';
  if (/SPRING.*HANGER|HANGER.*SPRING/.test(text)) return 'SPRING_HANGER';
  if (/CAN.*SPRING|SPRING.*CAN|SPRING_CAN/.test(text)) return 'SPRING_CAN';
  if (text.includes('SPRING')) return 'SPRING';
  if (text.includes('HANGER')) return 'HANGER';
  if (text === 'LINE_STOP') return 'LINESTOP';
  return text;
}

function normalizedNode(value) {
  return String(Number(value || 0));
}

function normalizeAxis(axis) {
  const match = String(axis || '').toUpperCase().match(/([+-]?)(X|Y|Z)/);
  if (!match) return '';
  return `${match[1] || '+'}${match[2]}`;
}

function normalizeSupportSourceMode(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'off' || text === 'none' || text === 'disabled') return MANAGED_STAGE_SUPPORT_SOURCE_MODES.OFF;
  if (text === 'isonote' || text === 'iso_note' || text === 'iso-note' || text === 'note') return MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE;
  return MANAGED_STAGE_SUPPORT_SOURCE_MODES.STAGED_JSON;
}
