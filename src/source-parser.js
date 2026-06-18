import { parseInputXml } from './parser.js?v=professional-viewer-3';
import { isUxmlDocument, parseUxmlText, unwrapUxmlDocument } from './uxml-parser.js?v=20260618-uxml-source-1';

export function detectSourceType(text, filename = '') {
  const name = String(filename || '').toLowerCase();
  const body = String(text || '').trim();
  if (!body) return { kind: 'unknown', label: 'Unknown' };

  if (name.endsWith('.uxml') || name.endsWith('.uxml.json')) {
    return { kind: 'uxml', label: 'UXML' };
  }

  if (body.startsWith('{') || body.startsWith('[')) {
    try {
      const json = JSON.parse(body);
      if (isUxmlDocument(unwrapUxmlDocument(json))) return { kind: 'uxml', label: 'UXML' };
      return { kind: 'json', label: 'JSON' };
    } catch {
      return { kind: 'json-invalid', label: 'Invalid JSON' };
    }
  }

  if (/^<\?xml|<\w+/i.test(body)) return { kind: 'inputxml', label: 'InputXML' };
  return { kind: 'unknown', label: 'Unknown' };
}

export function parseMarkupSource(text, options = {}) {
  const detected = detectSourceType(text, options.filename || '');
  if (detected.kind === 'uxml') {
    const model = parseUxmlText(text, options);
    model.detectedSource = detected;
    normalizeUxmlModelForExistingExporters(model);
    return model;
  }
  if (detected.kind === 'inputxml') {
    const model = parseInputXml(text, options);
    model.sourceKind = 'InputXML';
    model.detectedSource = detected;
    return model;
  }
  throw new Error(`Unsupported model source: ${detected.label}. Choose InputXML or UXML.`);
}

function normalizeUxmlModelForExistingExporters(model) {
  for (const element of model.elements || []) {
    const props = element.props || {};
    for (const key of ['bore', 'startBore', 'endBore', 'branchBore']) {
      const parsed = numericText(props[key]);
      if (parsed) {
        props[`${key}Raw`] = props[`${key}Raw`] || props[key];
        props[key] = parsed;
      }
    }
  }
  return model;
}

function numericText(value) {
  if (value && typeof value === 'object' && 'value' in value) value = value.value;
  const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return '';
  const n = Number(match[0]);
  return Number.isFinite(n) && n > 0 ? String(n) : '';
}
