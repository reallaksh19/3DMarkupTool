// Persistent INPUT root-card controller.
//
// INPUT is not a collapsible workflow card. Source HTML owns the visible controls;
// this module only normalizes stale DOM, binds local interactions, and reports
// diagnostics. It does not inject style tags, poll, observe mutations, or touch
// Three.js/model content.

const VERSION = 'input-persistent-root-card-20260626';
const INPUT_CONTENT_SELECTORS = [
  '.workflow-card-hint',
  '#inputFileStatus',
  '#inputStatus',
  '.input-file-status',
  '.file-drop',
  '.input-primary-actions',
  '#loadUnifiedModelFileBtn',
  '#loadSampleBtn',
  '#clearBtn'
];
const POST_BOOTSTRAP_REASSERT_EVENTS = [
  'viewer:static-shell-bundle-ready',
  'viewer:static-shell-bundle-loaded',
  'viewer:svg-icons-refreshed',
  'viewer:managed-stage-json-ui-ready',
  'viewer:managed-stage-json-loaded',
  'viewer:app-module-loaded',
  'viewer:workflow-status-changed'
];

let postBootstrapBound = false;
let reassertTimer = 0;

runWhenReady(initInputAlwaysVisible);

function runWhenReady(callback) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}

function initInputAlwaysVisible() {
  const section = ensureInputBlock();
  if (!section) return;
  bindFileStatus();
  ensureDrawerOpen();
  normalizeWorkflowCopy();
  bindPostBootstrapReassertions();
  window.__3D_MARKUP_INPUT_ALWAYS_VISIBLE__ = {
    version: VERSION,
    ensure: initInputAlwaysVisible,
    reassert: () => reassertInputControls('manual'),
    getStatusText: () => getStatusNode()?.textContent || '',
    checklist
  };
  document.dispatchEvent(new CustomEvent('3dmarkup:input-always-visible-ready', { detail: checklist() }));
}

function bindPostBootstrapReassertions() {
  if (postBootstrapBound) return;
  postBootstrapBound = true;
  for (const eventName of POST_BOOTSTRAP_REASSERT_EVENTS) {
    window.addEventListener(eventName, () => scheduleReassert(eventName));
    document.addEventListener(eventName, () => scheduleReassert(eventName));
  }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(() => reassertInputControls('after-first-paint')));
  else setTimeout(() => reassertInputControls('after-first-paint'), 0);
}

function scheduleReassert(source) {
  clearTimeout(reassertTimer);
  reassertTimer = setTimeout(() => reassertInputControls(source), 0);
}

function reassertInputControls(source = 'scheduled') {
  const section = ensureInputBlock();
  if (!section) return null;
  bindFileStatus();
  ensureDrawerOpen();
  normalizeWorkflowCopy();
  document.dispatchEvent(new CustomEvent('3dmarkup:input-controls-reasserted', { detail: { source, ...checklist() } }));
  return section;
}

function ensureInputBlock() {
  const drawer = document.getElementById('inputDrawer');
  if (!drawer) return null;
  const section = ensureInputSection(drawer);
  if (!section) return null;

  section.dataset.section = 'input';
  section.dataset.inputRoot = 'persistent';
  section.dataset.phase2Input = 'always-visible';
  section.dataset.phase4aInput = 'compact-static';
  section.dataset.inputExpanded = 'true';
  section.dataset.layoutOwner = 'source-html-static-css-persistent-root';
  section.classList.remove('workflow-card', 'collapsed', 'is-collapsed', 'workflow-card-collapsed', 'conversion-collapsed', 'sideload-collapsed');
  section.classList.add('panel-section', 'input-root-card', 'phase2-input-sticky-section', 'phase4a-input-compact-section');
  delete section.dataset.collapsible;

  ensureInputHeading(section);
  ensureInputHint(section);
  ensureInputStatus(section);
  ensureFileDrop(section);
  ensurePrimaryActions(section);
  forceInputControlsExpanded(section);
  normalizeInputControlLabels(section);
  return section;
}

function ensureInputSection(drawer) {
  const existing = getInputSection();
  if (existing) return existing;
  const section = document.createElement('section');
  section.className = 'panel-section input-root-card phase2-input-sticky-section phase4a-input-compact-section';
  section.dataset.section = 'input';
  section.dataset.inputRoot = 'persistent';
  const summary = document.getElementById('drawerSummaryCard');
  const before = Array.from(drawer.children).find((child) => child !== summary && child.classList?.contains('panel-section'));
  if (before) drawer.insertBefore(section, before);
  else if (summary?.nextSibling) drawer.insertBefore(section, summary.nextSibling);
  else drawer.appendChild(section);
  return section;
}

function ensureInputHeading(section) {
  let heading = section.querySelector(':scope > h3');
  if (!heading) { heading = document.createElement('h3'); section.prepend(heading); }
  if (!/\bInput\b/i.test(heading.textContent || '')) heading.innerHTML = '<span class="section-no">1</span> Input';
  return heading;
}

function ensureInputHint(section) {
  let hint = section.querySelector(':scope > .workflow-card-hint');
  if (!hint) { hint = document.createElement('p'); hint.className = 'workflow-card-hint'; insertAfter(section, ensureInputHeading(section), hint); }
  if (!hint.textContent.trim() || /InputXML/i.test(hint.textContent)) hint.textContent = 'Choose a stagedJson file or load the bundled BM_CII stagedJson sample.';
  return hint;
}

function ensureInputStatus(section) {
  let status = document.getElementById('inputFileStatus') || section.querySelector(':scope > .input-file-status');
  if (!status) {
    status = document.createElement('div');
    status.innerHTML = 'Status: <span id="inputStatus">No file chosen</span>';
  }
  status.id = 'inputFileStatus';
  status.classList.add('input-file-status');
  status.setAttribute('aria-live', 'polite');
  if (!status.querySelector('#inputStatus')) status.innerHTML = 'Status: <span id="inputStatus">No file chosen</span>';
  if (status.parentElement !== section) section.insertBefore(status, ensureFileDrop(section));
  revealElement(status);
  return status;
}

function ensureFileDrop(section) {
  let fileDrop = section.querySelector(':scope > .file-drop');
  if (!fileDrop) { fileDrop = document.createElement('label'); fileDrop.className = 'file-drop input-file-drop-visible'; }
  let input = document.getElementById('xmlFile') || fileDrop.querySelector('input[type="file"]');
  if (!input) { input = document.createElement('input'); input.type = 'file'; }
  input.id = 'xmlFile';
  input.type = 'file';
  input.accept = '.json,.jscon,application/json';
  if (input.parentElement !== fileDrop) fileDrop.prepend(input);
  if (!fileDrop.querySelector('i') && !fileDrop.querySelector('svg')) { const icon = document.createElement('i'); icon.setAttribute('data-lucide', 'upload'); fileDrop.appendChild(icon); }
  let label = fileDrop.querySelector('span');
  if (!label) { label = document.createElement('span'); fileDrop.appendChild(label); }
  label.textContent = 'Choose stagedJson';
  fileDrop.classList.add('input-file-drop-visible');
  const actions = section.querySelector(':scope > .input-primary-actions, :scope > .button-row');
  if (fileDrop.parentElement !== section) actions ? section.insertBefore(fileDrop, actions) : section.appendChild(fileDrop);
  revealElement(fileDrop);
  return fileDrop;
}

function ensurePrimaryActions(section) {
  let actions = section.querySelector(':scope > .input-primary-actions') || section.querySelector(':scope > .button-row');
  if (!actions) { actions = document.createElement('div'); actions.dataset.owner = 'source-html-fallback'; section.appendChild(actions); }
  actions.className = 'button-row input-primary-actions';
  ensureButton(actions, 'loadUnifiedModelFileBtn', 'ghost icon-text managed-stage-json-load-btn unified-model-load-btn', 'upload', 'Import stagedJson').title = 'Import stagedJson file';
  const loadSampleBtn = ensureButton(actions, 'loadSampleBtn', 'primary icon-text managed-stage-json-sample-btn', 'folder-open', 'Load BM_CII stagedJson');
  loadSampleBtn.title = 'Load bundled BM_CII_INPUT_managed_stage.json stagedJson sample';
  loadSampleBtn.setAttribute('aria-label', 'Load BM_CII stagedJson sample');
  const clearBtn = ensureButton(actions, 'clearBtn', 'ghost icon-text', 'folder-x', 'Clear All');
  clearBtn.setAttribute('aria-label', 'Clear all input and sample data');
  revealElement(actions);
  return actions;
}

function ensureButton(parent, id, className, iconName, text) {
  let button = document.getElementById(id);
  if (!button) { button = document.createElement('button'); button.id = id; }
  button.type = 'button';
  button.className = className;
  if (button.parentElement !== parent) parent.appendChild(button);
  if (!button.querySelector('i') && !button.querySelector('svg')) { const icon = document.createElement('i'); icon.setAttribute('data-lucide', iconName); button.prepend(icon); }
  let label = button.querySelector('span');
  if (!label) { label = document.createElement('span'); button.appendChild(label); }
  label.textContent = text;
  revealElement(button);
  return button;
}

function normalizeInputControlLabels(section) {
  const fileDrop = section.querySelector('.file-drop');
  if (fileDrop) fileDrop.querySelector('span') && (fileDrop.querySelector('span').textContent = 'Choose stagedJson');
  const importBtn = document.getElementById('loadUnifiedModelFileBtn');
  if (importBtn) { importBtn.setAttribute('aria-label', 'Import stagedJson file'); importBtn.querySelector('span') && (importBtn.querySelector('span').textContent = 'Import stagedJson'); }
  const loadSampleBtn = document.getElementById('loadSampleBtn');
  if (loadSampleBtn) { loadSampleBtn.setAttribute('aria-label', 'Load BM_CII stagedJson sample'); loadSampleBtn.querySelector('span') && (loadSampleBtn.querySelector('span').textContent = 'Load BM_CII stagedJson'); }
  const clearBtn = document.getElementById('clearBtn');
  if (clearBtn) clearBtn.setAttribute('aria-label', 'Clear all input and sample data');
  const closeInputBtn = document.getElementById('closeInputBtn');
  if (closeInputBtn) { closeInputBtn.hidden = true; closeInputBtn.setAttribute('aria-hidden', 'true'); closeInputBtn.tabIndex = -1; }
}

function normalizeWorkflowCopy() {
  const drawerHeadText = document.querySelector('#inputDrawer .drawer-head p');
  if (drawerHeadText && /InputXML/i.test(drawerHeadText.textContent || '')) drawerHeadText.textContent = 'Load stagedJson, map supports, convert, then export GLB / RVM / ATT.';
  const hint = document.getElementById('workflowHint');
  if (hint && /InputXML/i.test(hint.textContent || '')) hint.textContent = 'Load stagedJson or BM_CII stagedJson sample to begin.';
  const canvasHint = document.getElementById('hint');
  if (canvasHint && /InputXML/i.test(canvasHint.textContent || '')) canvasHint.textContent = 'Load stagedJson or BM_CII stagedJson sample to begin.';
}

function forceInputControlsExpanded(section) {
  if (!section) return;
  revealElement(section);
  section.classList.remove('workflow-card', 'collapsed', 'is-collapsed', 'workflow-card-collapsed', 'conversion-collapsed', 'sideload-collapsed');
  delete section.dataset.collapsible;
  const heading = section.querySelector('h3');
  heading?.removeAttribute('role'); heading?.removeAttribute('tabindex'); heading?.removeAttribute('aria-controls'); heading?.removeAttribute('aria-expanded');
  delete heading?.dataset.boundCollapseSection; delete heading?.dataset.boundConversionCollapse;
  for (const selector of INPUT_CONTENT_SELECTORS) for (const element of section.querySelectorAll(selector)) { revealElement(element); element.classList.remove('conversion-collapsible-content', 'sideload-collapsible-content', 'collapsed', 'is-collapsed'); }
  Array.from(section.children).forEach((child) => { if (child !== heading) { child.classList.remove('conversion-collapsible-content'); child.classList.remove('sideload-collapsible-content'); } });
}

function bindFileStatus() {
  const input = document.getElementById('xmlFile');
  const importBtn = document.getElementById('loadUnifiedModelFileBtn');
  const loadSampleBtn = document.getElementById('loadSampleBtn');
  const clearBtn = document.getElementById('clearBtn');
  updateStatusFromInput();
  if (input && input.dataset.inputAlwaysVisibleBound !== '1') { input.dataset.inputAlwaysVisibleBound = '1'; input.addEventListener('change', updateStatusFromInput); }
  if (importBtn && importBtn.dataset.inputAlwaysVisibleBound !== '1') { importBtn.dataset.inputAlwaysVisibleBound = '1'; importBtn.addEventListener('click', () => input?.click()); }
  if (loadSampleBtn && loadSampleBtn.dataset.inputAlwaysVisibleBound !== '1') { loadSampleBtn.dataset.inputAlwaysVisibleBound = '1'; loadSampleBtn.addEventListener('click', () => setTimeout(updateStatusFromInput, 0)); }
  if (clearBtn && clearBtn.dataset.inputAlwaysVisibleBound !== '1') { clearBtn.dataset.inputAlwaysVisibleBound = '1'; clearBtn.addEventListener('click', () => setTimeout(() => setStatus('No file chosen'), 0)); }
}

function updateStatusFromInput() {
  const input = document.getElementById('xmlFile');
  const file = input?.files?.[0] || null;
  setStatus(file ? `File: ${file.name}` : 'No file chosen');
}
function setStatus(text) { const status = getStatusNode(); if (status) status.textContent = text || 'No file chosen'; }
function getStatusNode() { return document.getElementById('inputStatus') || document.getElementById('inputFileStatus'); }
function getInputSection() { const drawer = document.getElementById('inputDrawer'); if (!drawer) return null; return drawer.querySelector(':scope > [data-input-root="persistent"]') || drawer.querySelector(':scope > .panel-section[data-section="input"]') || Array.from(drawer.querySelectorAll(':scope > .panel-section')).find((section) => /\bInput\b/i.test(section.querySelector('h3')?.textContent || '')) || null; }
function ensureDrawerOpen() { document.body.classList.add('input-open'); const toggle = document.getElementById('toggleInputBtn'); if (toggle) { toggle.classList.add('active'); toggle.setAttribute('aria-pressed', 'true'); } const drawer = document.getElementById('inputDrawer'); if (drawer) { drawer.removeAttribute('hidden'); drawer.removeAttribute('aria-hidden'); } }
function insertAfter(parent, reference, child) { if (!reference || !reference.nextSibling) parent.appendChild(child); else parent.insertBefore(child, reference.nextSibling); }
function revealElement(element) { if (!element) return; element.hidden = false; element.removeAttribute('hidden'); element.removeAttribute('aria-hidden'); element.removeAttribute('inert'); element.style.removeProperty('display'); element.style.removeProperty('visibility'); element.style.removeProperty('opacity'); element.style.removeProperty('max-height'); element.style.removeProperty('transform'); element.style.removeProperty('pointer-events'); }

function checklist() {
  const section = getInputSection();
  const importBtn = document.getElementById('loadUnifiedModelFileBtn');
  const loadSampleBtn = document.getElementById('loadSampleBtn');
  const fileDrop = section?.querySelector('.file-drop');
  const inputActions = section?.querySelector('.input-primary-actions');
  return {
    version: VERSION,
    drawerOpen: document.body.classList.contains('input-open'),
    inputRootPersistent: section?.dataset.inputRoot === 'persistent',
    inputIsNotWorkflowCard: section ? !section.classList.contains('workflow-card') : false,
    inputExpanded: section?.dataset.inputExpanded === 'true',
    statusVisible: Boolean(getStatusNode()),
    statusText: getStatusNode()?.textContent || '',
    chooseInputVisible: Boolean(fileDrop && fileDrop.hidden === false),
    importVisible: Boolean(importBtn && importBtn.hidden === false),
    loadSampleVisible: Boolean(loadSampleBtn && loadSampleBtn.hidden === false),
    clearAllVisible: Boolean(document.getElementById('clearBtn')),
    actionRowVisible: Boolean(inputActions && inputActions.hidden === false),
    postBootstrapReassertions: true,
    postBootstrapEvents: POST_BOOTSTRAP_REASSERT_EVENTS.slice(),
    sampleStateSeparateFromFileStatus: true,
    compactStaticInputBlock: Boolean(section?.dataset.phase4aInput === 'compact-static'),
    layoutOwner: section?.dataset.layoutOwner || 'source-html-static-css-persistent-root',
    noRuntimeLayoutStyleInjection: true,
    noPolling: true,
    noMutationObserver: true,
    noSceneTraversal: true
  };
}
