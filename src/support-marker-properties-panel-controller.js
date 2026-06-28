const SUPPORT_MARKER_PANEL_SCHEMA = 'SupportMarkerPropertiesPanelController.v1';

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', installSupportMarkerPropertiesPanel, { once: true });
} else {
  installSupportMarkerPropertiesPanel();
}

export function installSupportMarkerPropertiesPanel() {
  if (window.__3D_MARKUP_SUPPORT_MARKER_PROPERTIES_PANEL__?.schema === SUPPORT_MARKER_PANEL_SCHEMA) return window.__3D_MARKUP_SUPPORT_MARKER_PROPERTIES_PANEL__;
  const api = { schema: SUPPORT_MARKER_PANEL_SCHEMA, render: renderSupportMarkerProperties };
  window.__3D_MARKUP_SUPPORT_MARKER_PROPERTIES_PANEL__ = api;
  window.addEventListener('markup:selected-object-changed', (event) => scheduleRender(event.detail?.data, event.detail?.object));
  window.addEventListener('viewer:selection-changed', (event) => scheduleRender(event.detail?.data || event.detail?.selectedData, event.detail?.object || event.detail?.selectedObject));
  return api;
}

function scheduleRender(data, object) {
  const marker = normalizeSupportMarkerData(data, object);
  if (!marker) return;
  window.setTimeout(() => renderSupportMarkerProperties(marker.raw, object), 0);
}

export function renderSupportMarkerProperties(data, object) {
  const body = document.getElementById('propertiesBody');
  const marker = normalizeSupportMarkerData(data, object);
  if (!body || !marker) return false;
  const raw = marker.raw;
  const attrs = objectValue(raw.sourceAttributes) || parseJson(raw.sourceAttributesJson || raw.SOURCE_ATTRIBUTES_JSON) || objectValue(raw.rawSupport?.sourceAttributes) || {};
  const visual = objectValue(raw.supportVisual) || objectValue(raw.visual) || objectValue(raw.rawSupport?.visual) || {};
  const axisTransform = objectValue(raw.axisTransform) || parseJson(raw.AXIS_TRANSFORM_JSON) || objectValue(raw.rawSupport?.axisTransform) || {};
  const diagnostics = arrayValue(raw.diagnostics) || parseJson(raw.diagnosticsJson || raw.DIAGNOSTICS_JSON) || [];
  const actionAxes = firstArray(raw.supportActionAxes, visual.supportActionAxes, axisTransform.supportActionAxes);
  const sourceAxis = firstText(raw.axisRaw, raw.AXIS_RAW, raw.sourceAxis, visual.sourceAxis, axisTransform.sourceAxis);
  const mappedAxis = firstText(raw.axisCanvas, raw.AXIS_CANVAS, raw.mappedCanvasAxis, visual.mappedCanvasAxis, axisTransform.canvasAxis);
  const matchedPipeAxis = firstText(raw.matchedPipeAxis, visual.matchedPipeAxis, visual.pipeAxisSigned, axisTransform.matchedPipeAxis, raw.rawSupport?.pipeAxis);
  const isonoteText = firstText(raw.isonoteRawText, raw.ISONOTE_RAW_TEXT, raw.isonoteText, raw.ISONOTE, raw.rawSupport?.isonoteRawText);
  const activeBasis = activeBasisLabel(firstText(raw.sourceMode, raw.SOURCE_MODE, raw.sourceKind, raw.SOURCE_KIND, raw.rawSupport?.sourceMode));

  document.body.classList.add('props-open');
  body.classList.remove('empty-state');
  body.innerHTML = `
    <div class="selected-card">
      <div class="selected-card-title"><span>${escapeHtml(marker.family)} support marker at node ${escapeHtml(marker.node)}</span><span class="badge">SUPPORT_MARKER</span></div>
      <div class="selected-card-subtitle">${escapeHtml(marker.markerId)}</div>
      <div class="badge-row"><span class="badge">${escapeHtml(activeBasis)}</span><span class="badge">Action ${escapeHtml(actionAxes.join(' / ') || 'N/A')}</span></div>
    </div>
    ${section('Support Marker', true, rows([
      ['Marker ID', marker.markerId], ['Active Basis', activeBasis], ['Node', marker.node], ['Family', marker.family], ['Render Status', firstText(raw.renderStatus, raw.exportedRvmGeometry === false ? 'preview/canonical marker' : 'rendered')]
    ]))}
    ${section('InputXML Source', true, rows([
      ['Source Path', firstText(raw.sourcePath, raw.SOURCE_PATH, raw.rawSupport?.sourcePath)], ['Raw Type', firstText(attrs.RAW_TYPE, attrs.TYPE, raw.rawType)], ['Support Kind', firstText(attrs.SUPPORT_KIND, attrs.SUPPORT_TYPE, marker.family)], ['Source CAESAR Axis', sourceAxis || 'N/A'], ['Source Attributes', stableJson(attrs)]
    ]))}
    ${section('ISONOTE — As Uploaded/Sideloaded by User', true, rows([
      ['ISONOTE Text', isonoteText || 'N/A'], ['Note Name', firstText(raw.isonoteNoteName, raw.ISONOTE_NOTE_NAME, 'N/A')], ['Match Method', firstText(raw.matchMethod, raw.ISONOTE_MATCH_METHOD, 'none')], ['Confidence', firstText(raw.confidence, raw.ISONOTE_MATCH_CONFIDENCE, '0')]
    ]))}
    ${section('Axis Resolution', true, rows([
      ['Source CAESAR Axis', sourceAxis || 'N/A'], ['Mapped Canvas Axis', mappedAxis || 'N/A'], ['Support Action Axis / Glyph Axis', actionAxes.join(' / ') || firstText(raw.primarySupportActionAxis, visual.primarySupportActionAxis, raw.axis, 'N/A')], ['Matched Pipe Axis', matchedPipeAxis || 'N/A'], ['Fallback Used', firstText(axisTransform.fallbackReason, visual.axisFallbackReason, raw.axisFallbackReason, 'N/A')], ['Axis Transform Applied', String(Boolean(raw.axisTransformApplied || raw.AXIS_TRANSFORM_APPLIED === 'TRUE' || axisTransform.axisTransformApplied))]
    ]))}
    ${section('Matched Pipe Context', false, rows([
      ['Matched Pipe', firstText(raw.matchedPipeRef, raw.MATCHED_PIPE_REF, visual.sourcePipePath, visual.sourcePipeRecord)], ['Pipe Axis', firstText(visual.pipeAxisSigned, visual.pipeAxis, matchedPipeAxis)], ['Pipe OD', firstText(visual.pipeDiameterMm, raw.pipeOdMm)]
    ]))}
    ${section('Diagnostics', false, rows([
      ['Popup Required', String(Boolean(raw.popupRequired || visual.popupRequired))], ['Warning Code', firstText(raw.warningCode, raw.WARNING_CODE, 'N/A')], ['Warning Message', firstText(raw.warningMessage, raw.WARNING_MESSAGE, visual.popupReason, 'N/A')], ['Diagnostics', stableJson(diagnostics)]
    ]))}
  `;
  return true;
}

function normalizeSupportMarkerData(data, object) {
  const raw = data && typeof data === 'object' ? data : object?.userData || {};
  const markerId = firstText(raw.SUPPORT_MARKER_ID, raw.supportMarkerId, raw.ID, raw.id, object?.name);
  const type = firstText(raw.TYPE, raw.type, raw.markerType, raw.rawSupport?.type);
  if (type !== 'SUPPORT_MARKER' && !markerId.includes('SUPPORT_MARKER/')) return null;
  return { raw, markerId: markerId || 'SUPPORT_MARKER', node: firstText(raw.node, raw.NODE, raw.rawSupport?.nodeNumber, 'N/A'), family: firstText(raw.family, raw.FAMILY, raw.supportFamily, raw.rawSupport?.supportFamily, 'UNKNOWN') };
}

function section(title, open, html) { return `<details class="prop-section" ${open ? 'open' : ''}><summary>${escapeHtml(title)}</summary><div class="prop-grid">${html}</div></details>`; }
function rows(items) { return items.map(([key, value]) => `<div class="prop-key">${escapeHtml(key)}</div><div class="prop-value">${escapeHtml(formatValue(value))}</div>`).join(''); }
function firstArray(...values) { for (const value of values) { if (Array.isArray(value) && value.length) return value.map((entry) => String(entry || '').trim()).filter(Boolean); if (typeof value === 'string' && value.trim()) return value.split(/[|,\s]+/).map((entry) => entry.trim()).filter(Boolean); } return []; }
function firstText(...values) { for (const value of values) { if (value === undefined || value === null) continue; const text = typeof value === 'string' ? value.trim() : String(value).trim(); if (text) return text; } return ''; }
function objectValue(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : null; }
function arrayValue(value) { return Array.isArray(value) ? value : null; }
function parseJson(value) { if (!value || typeof value !== 'string') return null; try { return JSON.parse(value); } catch (_) { return null; } }
function activeBasisLabel(value) { const text = String(value || '').toLowerCase(); return text.includes('isonote') ? 'ISONOTE Basis' : 'InputXML Basis'; }
function stableJson(value) { if (!value || value === '') return 'N/A'; if (typeof value === 'string') return value; try { return JSON.stringify(value, null, 2); } catch (_) { return String(value); } }
function formatValue(value) { if (value === undefined || value === null || value === '') return 'N/A'; return typeof value === 'object' ? stableJson(value) : value; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
