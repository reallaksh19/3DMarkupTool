// Critical INPUT controls restoration.
//
// Keeps the real stagedJson chooser, load sample, and clear controls in the
// source INPUT workflow card. It is included in the static shell bundle before
// later UI decorators, so a later controller cannot leave the INPUT card in a
// heading-only state.

const VERSION = 'input-panel-critical-controls-20260626';
const REASSERT_EVENTS = [
  'DOMContentLoaded',
  'viewer:static-shell-bundle-ready',
  'viewer:static-shell-bundle-loaded',
  'viewer:static-shell-core-ready',
  'viewer:app-module-loaded',
  'viewer:managed-stage-json-ui-ready',
  'viewer:managed-stage-bm-cii-json-sample-ready',
  'viewer:svg-icons-refreshed',
  'viewer:workflow-status-changed'
];

runWhenReady(() => reassertInputControls('initial'));
bindReassertionEvents();

function runWhenReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function bindReassertionEvents() {
  for (const eventName of REASSERT_EVENTS) {
    const target = eventName === 'DOMContentLoaded' ? document : window;
    target.addEventListener(eventName, () => reassertInputControls(eventName));
  }
}

function reassertInputControls(source = 'manual') {
  const drawer = document.getElementById('inputDrawer');
  if (!drawer) return null;
  const section = ensureInputSection(drawer);
  ensureSectionContract(section);
  ensureHeading(section);
  const hint = ensureHint(section);
  const status = ensureStatus(section);
  const fileDrop = ensureFileDrop(section);
  const actions = ensureActions(section);
  order(section, [ensureHeading(section), hint, status, fileDrop, actions]);
  reveal(section);
  reveal(hint);
  reveal(status);
  reveal(fileDrop);
  reveal(actions);
  for (const button of actions.querySelectorAll('button')) reveal(button);
  document.body.classList.add('input-open');
  document.getElementById('toggleInputBtn')?.classList.add('active');
  window.__3D_MARKUP_INPUT_PANEL_CRITICAL_CONTROLS__ = checklist(source);
  window.dispatchEvent(new CustomEvent('viewer:input-panel-critical-controls-ready', {
    detail: window.__3D_MARKUP_INPUT_PANEL_CRITICAL_CONTROLS__
  }));
  return section;
}

function ensureInputSection(drawer) {
  const existing = drawer.querySelector(':scope > .panel-section[data-section="input"]')
    || Array.from(drawer.querySelectorAll(':scope > .panel-section')).find((candidate) => /\bInput\b/i.test(candidate.querySelector('h3')?.textContent || ''));
  if (existing) return existing;
  const section = document.createElement('section');
  const before = drawer.querySelector(':scope > .panel-section[data-section="support-mapping"]')
    || Array.from(drawer.querySelectorAll(':scope > .panel-section')).find((candidate) => /\bSupport Mapping\b/i.test(candidate.querySelector('h3')?.textContent || ''))
    || document.getElementById('drawerSummaryCard')?.nextElementSibling;
  if (before) drawer.insertBefore(section, before);
  else drawer.appendChild(section);
  return section;
}

function ensureSectionContract(section) {
  section.classList.add('panel-section', 'workflow-card', 'phase2-input-sticky-section', 'phase4a-input-compact-section');
  section.classList.remove('collapsed', 'is-collapsed', 'workflow-card-collapsed', 'conversion-collapsed', 'sideload-collapsed');
  section.dataset.section = 'input';
  section.dataset.phase2Input = 'always-visible';
  section.dataset.phase4aInput = 'compact-static';
  section.dataset.inputExpanded = 'true';
  section.dataset.inputCriticalControls = VERSION;
  delete section.dataset.collapsible;
  reveal(section);
}

function ensureHeading(section) {
  let heading = section.querySelector(':scope > h3');
  if (!heading) {
    heading = document.createElement('h3');
    section.prepend(heading);
  }
  heading.innerHTML = '<span class="section-no">1</span> Input';
  heading.removeAttribute('role');
  heading.removeAttribute('tabindex');
  heading.removeAttribute('aria-controls');
  heading.removeAttribute('aria-expanded');
  delete heading.dataset.boundCollapseSection;
  delete heading.dataset.boundConversionCollapse;
  return heading;
}

function ensureHint(section) {
  let hint = section.querySelector(':scope > .workflow-card-hint');
  if (!hint) {
    hint = document.createElement('p');
    hint.className = 'workflow-card-hint';
  }
  hint.textContent = 'Choose a stagedJson file or load the bundled BM_CII stagedJson sample.';
  return hint;
}

function ensureStatus(section) {
  let status = document.getElementById('inputFileStatus') || section.querySelector(':scope > .input-file-status');
  if (!status) {
    status = document.createElement('div');
    status.innerHTML = 'Status: <span id="inputStatus">No file chosen</span>';
  }
  status.id = 'inputFileStatus';
  status.className = 'input-file-status';
  status.setAttribute('aria-live', 'polite');
  if (!status.querySelector('#inputStatus')) status.innerHTML = 'Status: <span id="inputStatus">No file chosen</span>';
  return status;
}

function ensureFileDrop(section) {
  let fileDrop = section.querySelector(':scope > label.file-drop') || section.querySelector(':scope > .file-drop');
  if (!fileDrop) fileDrop = document.createElement('label');
  fileDrop.classList.add('file-drop', 'input-file-drop-visible');
  let input = document.getElementById('xmlFile') || fileDrop.querySelector('input[type="file"]');
  if (!input) input = document.createElement('input');
  input.id = 'xmlFile';
  input.type = 'file';
  input.accept = '.json,.jscon,application/json';
  if (input.parentElement !== fileDrop) fileDrop.prepend(input);
  let icon = fileDrop.querySelector('i[data-lucide="upload"]');
  if (!icon && !fileDrop.querySelector('svg')) {
    icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'upload');
    fileDrop.appendChild(icon);
  }
  let label = fileDrop.querySelector('span');
  if (!label) {
    label = document.createElement('span');
    fileDrop.appendChild(label);
  }
  label.textContent = 'Choose stagedJson';
  return fileDrop;
}

function ensureActions(section) {
  let actions = section.querySelector(':scope > .button-row.input-primary-actions')
    || section.querySelector(':scope > .input-primary-actions')
    || document.createElement('div');
  actions.classList.add('button-row', 'input-primary-actions');
  ensureButton(actions, 'loadSampleBtn', 'primary icon-text', 'folder-open', 'Load BM_CII stagedJson', 'Load bundled BM_CII_INPUT_managed_stage.json stagedJson sample');
  ensureButton(actions, 'clearBtn', 'ghost icon-text', 'folder-x', 'Clear All', 'Clear all input and sample data');
  return actions;
}

function ensureButton(actions, id, className, iconName, labelText, title) {
  let button = document.getElementById(id);
  if (!button) button = document.createElement('button');
  button.id = id;
  button.type = 'button';
  button.className = className;
  button.title = title;
  button.setAttribute('aria-label', title);
  if (button.parentElement !== actions) actions.appendChild(button);
  let icon = button.querySelector(`i[data-lucide="${iconName}"]`);
  if (!icon && !button.querySelector('svg')) {
    icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    button.prepend(icon);
  }
  let label = button.querySelector('span');
  if (!label) {
    label = document.createElement('span');
    button.appendChild(label);
  }
  label.textContent = labelText;
  return button;
}

function order(section, children) {
  let cursor = null;
  for (const child of children.filter(Boolean)) {
    if (cursor) cursor.after(child);
    else section.prepend(child);
    cursor = child;
  }
}

function reveal(element) {
  if (!element) return;
  element.hidden = false;
  element.removeAttribute('hidden');
  element.removeAttribute('aria-hidden');
  element.removeAttribute('inert');
  element.classList.remove('conversion-collapsible-content', 'sideload-collapsible-content', 'collapsed', 'is-collapsed');
  element.style.removeProperty('display');
  element.style.removeProperty('visibility');
  element.style.removeProperty('opacity');
  element.style.removeProperty('max-height');
  element.style.removeProperty('transform');
  element.style.removeProperty('pointer-events');
}

function checklist(source) {
  const section = document.querySelector('#inputDrawer > .panel-section[data-section="input"]');
  return {
    version: VERSION,
    source,
    inputSectionPresent: Boolean(section),
    hintVisible: Boolean(section?.querySelector(':scope > .workflow-card-hint')),
    statusVisible: Boolean(document.getElementById('inputFileStatus')),
    chooseVisible: Boolean(document.getElementById('xmlFile')?.closest('.file-drop')),
    loadVisible: Boolean(document.getElementById('loadSampleBtn')),
    clearVisible: Boolean(document.getElementById('clearBtn')),
    noFakeControls: true,
    noMutationObserver: true,
    noPolling: true
  };
}
