const PANEL_CLASS = 'controlled-preview-panel';
const DEFAULT_TRACE_LIMIT = 80;

export function renderControlledPreviewHtml(controlledPreviewModel, options = {}) {
  const traceLimit = Number.isInteger(Number(options.traceLimit)) ? Number(options.traceLimit) : DEFAULT_TRACE_LIMIT;
  if (!controlledPreviewModel || controlledPreviewModel.schema !== 'ControlledPreviewModel.v1') return wrapPanel('<div>Controlled preview unavailable.</div>');
  const readiness = controlledPreviewModel.artifactReadiness || {};
  const stripItems = [
    ['pipe segments ready', controlledPreviewModel.straightPipeSubsetPreview?.length || 0],
    ['bends resolved as TORUS primitive', readiness.bendTorusPrimitiveResolvedCount || 0],
    ['bend TORUS test byte proof ready', readiness.bendTorusByteProvenCount || 0],
    ['flanges resolved as catalogue-backed primitives', readiness.flangePrimitiveResolvedCount || 0],
    ['flange writer/artifact deferred', readiness.flangeWriterDeferredCount || 0],
    ['valves blocked', readiness.blockedValveCount || 0],
    ['supports deferred', readiness.deferredSupportCount || 0]
  ];
  const strip = stripItems.map(([label, value]) => '<span class="controlled-preview-panel__strip-item"><strong>' + escapeHtml(value) + '</strong> ' + escapeHtml(label) + '</span>').join('');
  const cells = (Array.isArray(controlledPreviewModel.sourceTracePreview) ? controlledPreviewModel.sourceTracePreview : []).map((item) => '<span class="controlled-preview-panel__cell controlled-preview-panel__cell--' + escapeAttr(item.readiness) + '" title="' + escapeAttr(item.sourceItemId) + '">' + escapeHtml(shortLabel(item)) + '</span>').join('');
  const rows = (Array.isArray(controlledPreviewModel.sourceTracePreview) ? controlledPreviewModel.sourceTracePreview : []).slice(0, traceLimit).map(renderTraceRow).join('');
  const traceFooter = Array.isArray(controlledPreviewModel.sourceTracePreview) && controlledPreviewModel.sourceTracePreview.length > traceLimit ? '<p class="controlled-preview-panel__note">Showing ' + escapeHtml(traceLimit) + ' of ' + escapeHtml(controlledPreviewModel.sourceTracePreview.length) + ' source trace rows.</p>' : '';
  const banner = '<div class="controlled-preview-panel__banner"><strong>RVM pipe+bend subset: ' + escapeHtml(readiness.rvmPipeBendSubsetReady ? 'READY' : 'NOT READY') + '</strong><br><span>RVM straight-pipe subset: ' + escapeHtml(readiness.rvmStraightPipeSubsetReady ? 'READY' : 'NOT READY') + '</span><br><span>Bend TORUS test byte proof: ' + escapeHtml(readiness.bendTorusByteProvenCount ? 'READY' : 'NOT READY') + '</span><br><span>Flange writer/artifact: ' + escapeHtml(readiness.flangeWriterDeferredCount ? 'DEFERRED' : 'NOT READY') + '</span><br><span>RVM full model: ' + escapeHtml(readiness.rvmFullModelReady ? 'READY' : 'NOT READY') + '</span><br><span>Reason: valves/supports/flange artifact bridge remain unresolved/deferred</span><br><span>ATT: ' + escapeHtml(readiness.attReady ? 'READY' : 'BLOCKED') + '</span><br><span>GLB: ' + escapeHtml(readiness.glbReady ? 'READY' : 'BLOCKED') + '</span></div>';
  return wrapPanel('<section class="controlled-preview-panel__content" aria-label="Controlled shadow preview"><h3>Controlled shadow preview — diagnostic/artifact state only, not geometry.</h3>' + banner + '<div class="controlled-preview-panel__strip">' + strip + '</div><div class="controlled-preview-panel__schematic" role="img" aria-label="Schematic diagnostic preview, not geometry">' + cells + '</div><table class="controlled-preview-panel__trace" aria-label="Controlled preview source trace"><thead><tr><th>Item</th><th>Family</th><th>Status</th><th>Readiness</th><th>Message</th></tr></thead><tbody>' + rows + '</tbody></table>' + traceFooter + '</section>');
}

export function mountControlledPreview(container, controlledPreviewModel, options = {}) {
  if (!container || typeof container !== 'object') throw new Error('container is required');
  const html = renderControlledPreviewHtml(controlledPreviewModel, options);
  if ('innerHTML' in container) container.innerHTML = html;
  else if (typeof container.appendChild === 'function' && typeof document !== 'undefined') { const wrapper = document.createElement('section'); wrapper.innerHTML = html; container.appendChild(wrapper); }
  else throw new Error('container must support innerHTML or appendChild');
  if (typeof container.setAttribute === 'function') container.setAttribute('data-controlled-preview-mounted', 'true');
  return { schema: 'ControlledPreviewMount.v1', mounted: true, itemCount: Array.isArray(controlledPreviewModel?.sourceTracePreview) ? controlledPreviewModel.sourceTracePreview.length : 0 };
}
export function unmountControlledPreview(container) { if (!container || typeof container !== 'object') return { mounted: false, reason: 'container unavailable' }; if ('innerHTML' in container) container.innerHTML = ''; if (typeof container.removeAttribute === 'function') container.removeAttribute('data-controlled-preview-mounted'); return { mounted: false, reason: 'unmounted' }; }
function wrapPanel(content) { return '<section class="' + PANEL_CLASS + '" role="region" aria-label="Controlled preview read-only state"><style>' + scopedCss() + '</style>' + content + '</section>'; }
function renderTraceRow(row) { return '<tr><td>' + escapeHtml(row.sourceItemId) + '</td><td>' + escapeHtml(row.family) + '</td><td>' + escapeHtml(row.previewStatus) + '</td><td>' + escapeHtml(row.readiness) + '</td><td>' + escapeHtml(row.message) + '</td></tr>'; }
function shortLabel(item) { if (item.previewStatus === 'bendTorusByteProven') return 'T'; if (item.previewStatus === 'flangeWriterDeferred') return 'F'; if (item.readiness === 'ready') return 'P'; if (item.previewStatus === 'bendTorusWriterDeferred') return 'D'; if (item.readiness === 'blocked') return 'B'; if (item.readiness === 'deferred') return 'S'; return 'D'; }
function scopedCss() { return '.controlled-preview-panel{font:12px/1.4 system-ui,sans-serif;margin:8px;padding:10px;border:1px solid #6b7280;border-radius:8px;background:#0b1220;color:#e5e7eb}.controlled-preview-panel *{box-sizing:border-box}.controlled-preview-panel__banner{margin:8px 0;padding:8px;border:1px solid #475569;border-radius:6px;background:#111827}.controlled-preview-panel__strip{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.controlled-preview-panel__strip-item{border:1px solid #374151;border-radius:6px;padding:6px;background:#172033}.controlled-preview-panel__schematic{display:flex;flex-wrap:wrap;gap:3px;margin:8px 0;padding:6px;border:1px dashed #64748b;border-radius:6px}.controlled-preview-panel__cell{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;border:1px solid #4b5563;border-radius:3px;font-size:10px}.controlled-preview-panel__cell--ready{background:#123322}.controlled-preview-panel__cell--blocked{background:#3a1212}.controlled-preview-panel__cell--deferred{background:#3a2f12}.controlled-preview-panel__cell--diagnosticOnly{background:#1f2937}.controlled-preview-panel table{width:100%;border-collapse:collapse;margin:6px 0}.controlled-preview-panel th,.controlled-preview-panel td{border:1px solid #374151;padding:4px;text-align:left;vertical-align:top}.controlled-preview-panel__note{opacity:.8}'; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char])); }
function escapeAttr(value) { return escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/`/g, '&#96;'); }
