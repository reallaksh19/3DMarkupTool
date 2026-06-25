// Static workflow status strip for the review shell.
// Shows a compact read-only flow: Input -> Convert -> Select -> Export.

const VERSION = 'static-workflow-status-inline-20260625';
const STATE = {
  input: false,
  converted: false,
  selected: false,
  exportReady: false,
  timer: 0
};

runWhenReady(initWorkflowStatus);

function runWhenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function initWorkflowStatus() {
  injectStyles();
  ensureStrip();
  bindEvents();
  updateWorkflowStatus('startup');
  window.__3D_MARKUP_WORKFLOW_STATUS__ = { version: VERSION, state: STATE, refresh: updateWorkflowStatus };
}

function injectStyles() {
  if (document.getElementById('staticWorkflowStatusStyles')) return;
  const style = document.createElement('style');
  style.id = 'staticWorkflowStatusStyles';
  style.textContent = `
    .workflow-status-inline {
      min-width: 0;
      flex: 1 1 min(520px, 34vw);
      display: flex;
      justify-content: flex-end;
    }
    .workflow-status-strip {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      min-width: 0;
      max-width: 100%;
      padding: 0;
      overflow: hidden;
    }
    .workflow-chip {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      min-height: 24px;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid rgba(112,147,185,.28);
      background: rgba(10,27,49,.72);
      color: #9fb5cf;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .015em;
      white-space: nowrap;
    }
    .workflow-chip::before {
      content: '';
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #68788d;
      box-shadow: 0 0 0 2px rgba(104,120,141,.10);
    }
    .workflow-chip.done {
      color: #dffcea;
      border-color: rgba(79,222,139,.38);
      background: rgba(11,47,31,.82);
    }
    .workflow-chip.done::before {
      background: #4fde8b;
      box-shadow: 0 0 0 2px rgba(79,222,139,.16), 0 0 10px rgba(79,222,139,.35);
    }
    .workflow-chip.active {
      color: #fff2d6;
      border-color: rgba(255,190,87,.42);
      background: rgba(60,42,13,.78);
    }
    .workflow-chip.active::before {
      background: #ffbe57;
      box-shadow: 0 0 0 2px rgba(255,190,87,.16), 0 0 10px rgba(255,190,87,.35);
    }
    .workflow-chip.blocked {
      color: #ffcfcf;
      border-color: rgba(255,99,99,.36);
      background: rgba(60,17,22,.78);
    }
    .workflow-chip.blocked::before {
      background: #ff6363;
    }
    .workflow-spacer { display: none; }
    .workflow-hint {
      flex: 1 1 auto;
      min-width: 120px;
      max-width: min(360px, 28vw);
      overflow: hidden;
      text-overflow: ellipsis;
      color: #90a6bd;
      font-size: 11px;
      font-weight: 800;
      white-space: nowrap;
    }
    @media (max-width: 1500px) {
      .workflow-hint { display: none; }
      .workflow-status-inline { flex-basis: auto; }
    }
    @media (max-width: 980px) {
      .workflow-status-inline { flex: 1 1 100%; justify-content: flex-start; }
      .workflow-status-strip { justify-content: flex-start; overflow-x: auto; }
    }
  `;
  document.head.appendChild(style);
}

function ensureStrip() {
  let strip = document.getElementById('workflowStatusStrip');
  const inlineHost = ensureInlineHost();
  if (strip) {
    strip.classList.add('workflow-status-inline-strip');
    if (inlineHost && strip.parentElement !== inlineHost) inlineHost.appendChild(strip);
    return strip;
  }
  if (!inlineHost) return null;
  strip = document.createElement('div');
  strip.id = 'workflowStatusStrip';
  strip.className = 'workflow-status-strip workflow-status-inline-strip';
  strip.setAttribute('aria-label', 'Review workflow status');
  strip.innerHTML = `
    ${chip('input', 'Input')}
    ${chip('convert', 'Convert')}
    ${chip('select', 'Select')}
    ${chip('export', 'Export')}
    <span class="workflow-spacer"></span>
    <span id="workflowHint" class="workflow-hint">Load stagedJson or BM_CII sample to begin.</span>
  `;
  inlineHost.appendChild(strip);
  return strip;
}

function ensureInlineHost() {
  let host = document.getElementById('workflowStatusInline');
  if (host) return host;
  const actions = document.querySelector('.topbar-actions');
  if (!actions) return null;
  host = document.createElement('div');
  host.id = 'workflowStatusInline';
  host.className = 'workflow-status-inline';
  host.setAttribute('aria-label', 'Review workflow status');
  const runtime = document.getElementById('runtimeStatus');
  if (runtime?.parentElement === actions) actions.insertBefore(host, runtime);
  else actions.appendChild(host);
  return host;
}

function chip(key, label) {
  return `<span id="workflowChip_${key}" class="workflow-chip" data-workflow-chip="${key}">${label}</span>`;
}

function bindEvents() {
  ['change', 'input', 'click'].forEach((eventName) => {
    document.addEventListener(eventName, scheduleUpdate, true);
  });
  ['viewer:selection-changed', 'viewer:ui-score-changed', 'markup:render-context', 'viewer:runtime-context', 'viewer:managed-stage-json-loaded'].forEach((eventName) => {
    window.addEventListener(eventName, scheduleUpdate);
  });
  const log = document.getElementById('log');
  if (log && window.MutationObserver) {
    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(log, { childList: true, characterData: true, subtree: true });
  }
}

function scheduleUpdate() {
  window.clearTimeout(STATE.timer);
  STATE.timer = window.setTimeout(() => updateWorkflowStatus('scheduled'), 80);
}

function updateWorkflowStatus(source = 'manual') {
  ensureStrip();
  STATE.input = hasInput();
  STATE.converted = hasConvertedModel();
  STATE.selected = hasSelection();
  STATE.exportReady = hasExportReady();

  setChip('input', STATE.input, !STATE.input);
  setChip('convert', STATE.converted, STATE.input && !STATE.converted);
  setChip('select', STATE.selected, STATE.converted && !STATE.selected);
  setChip('export', STATE.exportReady, STATE.converted && !STATE.exportReady, STATE.converted && !STATE.exportReady);

  const hint = document.getElementById('workflowHint');
  if (hint) hint.textContent = workflowHint();

  window.dispatchEvent(new CustomEvent('viewer:workflow-status-changed', {
    detail: { source, input: STATE.input, converted: STATE.converted, selected: STATE.selected, exportReady: STATE.exportReady }
  }));
}

function setChip(key, done, active, blocked = false) {
  const chipEl = document.getElementById(`workflowChip_${key}`);
  if (!chipEl) return;
  chipEl.classList.toggle('done', Boolean(done));
  chipEl.classList.toggle('active', !done && Boolean(active));
  chipEl.classList.toggle('blocked', !done && Boolean(blocked));
  chipEl.title = done ? `${chipEl.textContent}: ready` : `${chipEl.textContent}: pending`;
}

function hasInput() {
  const file = document.getElementById('xmlFile');
  if (file?.files?.length) return true;
  const managed = window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__?.getActiveArtifact?.();
  if (managed?.sourceName) return true;
  const logText = String(document.getElementById('log')?.textContent || '');
  return /sample|stagedJson|managed-stage|inputxml|loaded/i.test(logText) || Boolean(window.__3D_MARKUP_LAST_INPUT__);
}

function hasConvertedModel() {
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
  if (runtime.modelRoot || runtime.scene) {
    const exportReady = hasExportReady();
    const statusText = String(document.getElementById('componentStatus')?.textContent || '');
    if (exportReady || /objects?:\s*\d+|components?\s*:/i.test(statusText)) return true;
  }
  if (!document.getElementById('downloadGlbBtn')?.disabled) return true;
  const logText = String(document.getElementById('log')?.textContent || '');
  return /conversion complete|model appears|glb ready|rvm ready|components|managed-stage rvm/i.test(logText);
}

function hasSelection() {
  const selected = String(document.getElementById('selectedStatus')?.textContent || '').trim();
  if (/^selected:\s*(?!none)/i.test(selected)) return true;
  const runtime = window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
  return Boolean(runtime.selectedObject || window.__3D_MARKUP_TREE__?.state?.selectedObject);
}

function hasExportReady() {
  return ['downloadGlbBtn', 'downloadRvmBtn', 'downloadAttBtn']
    .some((id) => !document.getElementById(id)?.disabled);
}

function workflowHint() {
  if (!STATE.input) return 'Load stagedJson or BM_CII stagedJson sample to begin.';
  if (!STATE.converted) return 'Run Conversion to generate the review model.';
  if (!STATE.selected) return 'Select a component in the viewer or Model Tree to review properties.';
  if (!STATE.exportReady) return 'Model is ready; exports are still disabled.';
  return 'Review model, inspect properties, Color By, then export GLB / RVM / ATT.';
}
