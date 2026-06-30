const PANEL_CLASS = 'shadow-diagnostic-panel';
const DEFAULT_TRACE_LIMIT = 80;

export function mountShadowDiagnosticPanel(container, viewModel, options = {}) {
  if (!container || typeof container !== 'object') throw new Error('container is required');
  const html = renderShadowDiagnosticPanelHtml(viewModel, options);
  if ('innerHTML' in container) {
    container.innerHTML = html;
  } else if (typeof container.appendChild === 'function' && typeof document !== 'undefined') {
    const wrapper = document.createElement('section');
    wrapper.innerHTML = html;
    container.appendChild(wrapper);
  } else {
    throw new Error('container must support innerHTML or appendChild');
  }
  if (typeof container.setAttribute === 'function') container.setAttribute('data-shadow-diagnostics-mounted', 'true');
  return { mounted: true, schema: 'ShadowDiagnosticPanelMount.v1', itemCount: Array.isArray(viewModel?.sourceTraceRows) ? viewModel.sourceTraceRows.length : 0 };
}

export function unmountShadowDiagnosticPanel(container) {
  if (!container || typeof container !== 'object') return { mounted: false, reason: 'container unavailable' };
  if ('innerHTML' in container) container.innerHTML = '';
  if (typeof container.removeAttribute === 'function') container.removeAttribute('data-shadow-diagnostics-mounted');
  return { mounted: false, reason: 'unmounted' };
}

export function renderShadowDiagnosticPanelHtml(viewModel, options = {}) {
  const traceLimit = Number.isInteger(Number(options.traceLimit)) ? Number(options.traceLimit) : DEFAULT_TRACE_LIMIT;
  if (!viewModel || viewModel.schema !== 'DiagnosticPanelViewModel.v1') {
    return wrapPanel('<div class="shadow-diagnostic-panel__empty">No diagnostic model available yet.</div>');
  }
  const cards = (Array.isArray(viewModel.artifactCards) ? viewModel.artifactCards : []).map(renderArtifactCard).join('');
  const summaries = (Array.isArray(viewModel.summaryCards) ? viewModel.summaryCards : []).map(renderSummaryCard).join('');
  const blocked = (Array.isArray(viewModel.blockedGroups) ? viewModel.blockedGroups : []).map(renderGroup).join('');
  const deferred = (Array.isArray(viewModel.deferredGroups) ? viewModel.deferredGroups : []).map(renderGroup).join('');
  const traceRows = (Array.isArray(viewModel.sourceTraceRows) ? viewModel.sourceTraceRows : []).slice(0, traceLimit).map(renderTraceRow).join('');
  const traceFooter = Array.isArray(viewModel.sourceTraceRows) && viewModel.sourceTraceRows.length > traceLimit
    ? `<p class="shadow-diagnostic-panel__note">Showing ${escapeHtml(traceLimit)} of ${escapeHtml(viewModel.sourceTraceRows.length)} source trace rows.</p>`
    : '';
  const straight = viewModel.straightPipeSubsetCard || {};
  return wrapPanel(`
    <details class="shadow-diagnostic-panel__details" open>
      <summary class="shadow-diagnostic-panel__summary">Shadow diagnostic status: ${escapeHtml(viewModel.overallStatus || 'diagnostics-only')}</summary>
      <div class="shadow-diagnostic-panel__banner">
        <strong>RVM straight-pipe subset byte proof: ${escapeHtml(straight.status || 'NOT READY')}</strong><br>
        <span>RVM full model: ${escapeHtml(straight.fullModelReady ? 'READY' : 'NOT READY')}</span><br>
        <span>Reason: ${escapeHtml(straight.fullModelReady ? 'full model ready' : 'blocked/deferred content remains')}</span><br>
        <span>ATT: BLOCKED</span><br>
        <span>GLB: BLOCKED</span>
      </div>
      <div class="shadow-diagnostic-panel__cards">${cards}</div>
      <div class="shadow-diagnostic-panel__counts">${summaries}</div>
      <div class="shadow-diagnostic-panel__groups">${blocked}${deferred}</div>
      <table class="shadow-diagnostic-panel__trace" aria-label="Shadow diagnostic source trace">
        <thead><tr><th>Item</th><th>Family</th><th>Binding</th><th>Geometry</th><th>Primitive</th><th>Export</th><th>Writer</th><th>Artifact</th></tr></thead>
        <tbody>${traceRows}</tbody>
      </table>
      ${traceFooter}
    </details>`);
}

function wrapPanel(content) {
  return `<section class="${PANEL_CLASS}" role="region" aria-label="Read-only shadow diagnostics">
    <style>${scopedCss()}</style>
    ${content}
  </section>`;
}

function renderArtifactCard(card) {
  return `<article class="shadow-diagnostic-panel__card" data-card="${escapeAttr(card.key)}">
    <h4>${escapeHtml(card.title)}</h4>
    <p><strong>${escapeHtml(card.status)}</strong></p>
    <p>${escapeHtml(card.reason || '')}</p>
  </article>`;
}

function renderSummaryCard(card) {
  return `<span class="shadow-diagnostic-panel__count" data-count="${escapeAttr(card.key)}"><strong>${escapeHtml(card.label)}:</strong> ${escapeHtml(card.value)}</span>`;
}

function renderGroup(group) {
  const rows = (Array.isArray(group.rows) ? group.rows : []).map((row) => `<tr><td>${escapeHtml(row.sourceItemId)}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.reason)}</td></tr>`).join('');
  return `<section class="shadow-diagnostic-panel__group" data-group="${escapeAttr(group.key)}">
    <h4>${escapeHtml(group.label)}: ${escapeHtml(group.count)}</h4>
    <table><thead><tr><th>Item</th><th>Type</th><th>Reason</th></tr></thead><tbody>${rows}</tbody></table>
  </section>`;
}

function renderTraceRow(row) {
  return `<tr><td>${escapeHtml(row.sourceItemId)}</td><td>${escapeHtml(row.family)}</td><td>${escapeHtml(row.bindingStatus)}</td><td>${escapeHtml(row.geometryStatus)}</td><td>${escapeHtml(row.primitiveStatus)}</td><td>${escapeHtml(row.exportStatus)}</td><td>${escapeHtml(row.writerStatus)}</td><td>${escapeHtml(row.artifactStatus)}</td></tr>`;
}

function scopedCss() {
  return `.shadow-diagnostic-panel{font:12px/1.4 system-ui,sans-serif;margin:8px;padding:10px;border:1px solid #53606f;border-radius:8px;background:#111827;color:#e5e7eb;max-height:48vh;overflow:auto}.shadow-diagnostic-panel *{box-sizing:border-box}.shadow-diagnostic-panel__summary{cursor:pointer;font-weight:700}.shadow-diagnostic-panel__banner{margin:8px 0;padding:8px;border:1px solid #64748b;border-radius:6px;background:#1f2937}.shadow-diagnostic-panel__cards,.shadow-diagnostic-panel__counts{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.shadow-diagnostic-panel__card,.shadow-diagnostic-panel__count{border:1px solid #374151;border-radius:6px;padding:6px;background:#0f172a}.shadow-diagnostic-panel table{width:100%;border-collapse:collapse;margin:6px 0}.shadow-diagnostic-panel th,.shadow-diagnostic-panel td{border:1px solid #374151;padding:4px;text-align:left;vertical-align:top}.shadow-diagnostic-panel__note{opacity:.8}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
