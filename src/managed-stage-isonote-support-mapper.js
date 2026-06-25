import {
  MANAGED_STAGE_SUPPORT_SOURCE_MODES,
  normalizeManagedStageSupportMapperRecord
} from './managed-stage-support-mapper-config.js';

export const MANAGED_STAGE_ISONOTE_SUPPORT_MAPPER_SCHEMA = 'ManagedStageIsonoteSupportMapper.v1';

export function parseManagedStageIsonoteSupportRecords(text = '', config = {}) {
  const rows = parseIsonoteRows(text);
  const records = [];
  for (const row of rows) {
    const supportTag = row.supportTag || extractSupportTag(row.noteText) || '';
    const noteBody = extractIsonoteBody(row.noteText);
    const segments = splitIsonoteSegments(noteBody);
    for (const segment of segments) {
      const attrs = segmentToSupportAttrs(segment, { nodeId: row.nodeId, supportTag });
      if (!attrs) continue;
      const mapperRecord = normalizeManagedStageSupportMapperRecord({ attrs }, {
        ...config,
        sourceMode: MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE,
        fieldMapper: {
          ...(config.fieldMapper || {}),
          supportKindFields: config.fieldMapper?.supportKindFields || ['SUPPORT_KIND', 'SUPPORT_TAG', 'ISONOTE_SEGMENT'],
          graphicsRuleFields: config.fieldMapper?.graphicsRuleFields || ['SUPPORT_KIND', 'SUPPORT_TAG', 'ISONOTE_SEGMENT'],
          axisFields: config.fieldMapper?.axisFields || ['SUPPORT_AXIS', 'AXIS'],
          signFields: config.fieldMapper?.signFields || ['SUPPORT_SIGN', 'SIGN'],
          gapFields: config.fieldMapper?.gapFields || ['SUPPORT_GAP_MM', 'GAP_MM', 'GAP']
        }
      });
      records.push({
        schema: MANAGED_STAGE_ISONOTE_SUPPORT_MAPPER_SCHEMA,
        sourceMode: MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE,
        nodeId: row.nodeId,
        supportTag,
        rawText: segment,
        attrs: mapperRecord.attrs,
        mapperRecord
      });
    }
  }
  return records;
}

export function parseIsonoteRows(text = '') {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const first = parseCsvLine(lines[0]).map((cell) => normalizeKey(cell));
  const hasHeader = first.includes('ISONOTE') || first.includes('NODE') || first.includes('NODE_ID');
  const header = hasHeader ? first : [];
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const nodeIdx = header.findIndex((key) => key === 'NODE' || key === 'NODE_ID');
  const noteIdx = header.findIndex((key) => key === 'ISONOTE' || key === 'ISO_NOTE' || key === 'NOTE');
  return dataLines.map((line, index) => {
    const cells = parseCsvLine(line);
    const nodeId = nodeIdx >= 0 ? String(cells[nodeIdx] || '').trim() : String(cells[0] || '').trim();
    const noteText = noteIdx >= 0 ? String(cells[noteIdx] || '').trim() : cells.slice(nodeIdx >= 0 ? 1 : 0).join(',').trim() || line;
    return {
      lineNumber: hasHeader ? index + 2 : index + 1,
      nodeId,
      noteText,
      supportTag: extractSupportTag(noteText)
    };
  }).filter((row) => row.noteText);
}

function segmentToSupportAttrs(segment, context = {}) {
  const raw = String(segment || '').trim();
  if (!raw) return null;
  const normalized = normalizeText(raw);
  const singleAxis = extractSingleAxis(raw);
  const gap = extractGap(raw);
  let supportKind = '';

  if (singleAxis) {
    supportKind = 'SINGLE AXIS';
  } else if (/(CAN\s*SPRING|SPRING\s*CAN|SPRING_CAN)/i.test(raw)) {
    supportKind = 'SPRING CAN';
  } else if (/HOLDDOWN|HOLD\s*DOWN/i.test(raw)) {
    supportKind = 'HOLDDOWN';
  } else if (/LINE\s*STOP|LINESTOP|LIMIT|\bLIM\b/i.test(raw)) {
    supportKind = 'LINE STOP';
  } else if (/GUIDE/i.test(raw) && !/WITHOUT\s+GUIDE|NO\s+GUIDE/i.test(raw)) {
    supportKind = 'GUIDE';
  } else if (/REST/i.test(raw) && !/REST\s+NOT\s+DEFINED|NO\s+REST/i.test(raw)) {
    supportKind = 'REST';
  }

  if (!supportKind) return null;
  const axis = singleAxis || extractAxis(raw);
  const sign = extractSign(raw);
  const attrs = {
    SOURCE_FORMAT: 'STAGED_JSON_ISONOTE_SIDELOAD',
    SUPPORT_SOURCE_MODE: MANAGED_STAGE_SUPPORT_SOURCE_MODES.ISONOTE,
    NODE: context.nodeId || '',
    SUPPORT_TAG: context.supportTag || '',
    SUPPORT_KIND: supportKind,
    ISONOTE_SEGMENT: raw,
    ISONOTE_NORMALIZED_TEXT: normalized,
    SUPPORT_GAP_RECORD_SCOPED: 'TRUE',
    SUPPORT_GAP_CARRY_FORWARD: 'FALSE'
  };
  if (axis) attrs.SUPPORT_AXIS = axis;
  if (sign) attrs.SUPPORT_SIGN = sign;
  if (gap) {
    attrs.SUPPORT_GAP_MM = gap;
    attrs.SUPPORT_GAP_SOURCE_FIELD = 'ISONOTE_SEGMENT';
  }
  return attrs;
}

function splitIsonoteSegments(body) {
  return String(body || '')
    .replace(/\bAND\b/gi, ',')
    .split(/[;,]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function extractIsonoteBody(value) {
  const text = String(value || '').trim();
  const quoted = text.match(/['"]([^'"]+)['"]/);
  if (quoted) return quoted[1];
  return text.replace(/^:?\/?[A-Z0-9_\-/]+\s*:ISONOTE\s*/i, '').replace(/^:ISONOTE\s*/i, '').trim();
}

function extractSupportTag(value) {
  const match = String(value || '').match(/\/?(PS[-_A-Z0-9/]+)/i);
  return match ? match[1].replace(/^\//, '') : '';
}

function extractSingleAxis(value) {
  const match = String(value || '').match(/SINGLE\s+AXIS\s*([+-]?\s*[XYZ])/i);
  if (!match) return '';
  return match[1].replace(/\s+/g, '').toUpperCase();
}

function extractAxis(value) {
  const match = String(value || '').match(/(?:AXIS|DIR(?:ECTION)?|SUPPORT_AXIS)\s*[:=]?\s*([+-]?\s*[XYZ])/i);
  if (!match) return '';
  return match[1].replace(/\s+/g, '').toUpperCase();
}

function extractSign(value) {
  const text = String(value || '').toUpperCase();
  if (/\+\s*(?:X|Y|Z)|\bPLUS\b|\bPOS(?:ITIVE)?\b/.test(text)) return '+';
  if (/-\s*(?:X|Y|Z)|\bMINUS\b|\bNEG(?:ATIVE)?\b/.test(text)) return '-';
  return '';
}

function extractGap(value) {
  const match = String(value || '').match(/(?:SUPPORT[_\s-]*)?GAP(?:[_\s-]*MM)?\s*[:=]?\s*([-+]?\d*\.?\d+)\s*(?:MM)?/i);
  return match ? `${Number(match[1])}mm` : '';
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let quote = '';
  for (const char of String(line || '')) {
    if ((char === '"' || char === "'") && !quote) {
      quote = char;
      current += char;
      continue;
    }
    if (char === quote) {
      quote = '';
      current += char;
      continue;
    }
    if (char === ',' && !quote) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function normalizeKey(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s\-]+/g, '_');
}

function normalizeText(value) {
  return normalizeKey(value).replace(/_/g, ' ');
}
