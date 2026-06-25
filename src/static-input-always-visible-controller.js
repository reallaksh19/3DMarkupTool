// Phase 2 / Phase 4A input always-visible controller.
// Keeps the real stagedJson controls visible without duplicating fake controls.
// Layout is owned by static HTML/CSS so the first paint and post-JS state match.
// No scene traversal, no polling, no review-tool activation.

const VERSION = 'workflow-input-stable-controls-20260625';
const INPUT_CONTENT_SELECTORS = [
  '.workflow-card-hint',
  '#inputFileStatus',
  '#inputStatus',
  '.input-file-status',
  '.file-drop',
  '.input-primary-actions',
  '#loadSampleBtn',
  '#loadUnifiedModelFileBtn',
  '.unified-model-load-btn',
  '#clearBtn'
];
const INPUT_REASSERT_EVENTS = [
  'viewer:static-shell-bundle-ready',
  'viewer:static-shell-bundle-loaded',
  'viewer:svg-icons-refreshed',
  'viewer:managed-stage-json-ui-ready',
  'viewer:app-module-loaded',
  'markup:safe-ui-status'
];

runWhenReady(initInputAlwaysVisible);

function runWhenReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function initInputAlwaysVisible() {
  const section = ensureInputBlock();
  if (!section) return;

  bindFileStatus();
  bindPostBootstrapReassertions();
  ensureDrawerOpen();

  window.__3D_MARKUP_INPUT_ALWAYS_VISIBLE__ = {
    version: VERSION,
    ensure: initInputAlwaysVisible,
    getStatusText: () => getStatusNode()?.textContent || '',
    checklist
  };

  document.dispatchEvent(new CustomEvent('3dmarkup:input-always-visible-ready', {
    detail: checklist()
  }));
}

function ensureInputBlock() {
  const drawer = document.getElementById('inputDrawer');
  if (!drawer) return null;

  const section = getInputSection();
  if (!section) return null;

  section.dataset.section = 'input';
  section.dataset.phase2Input = 'always-visible';
  section.dataset.phase4aInput = 'compact-static';
  section.dataset.inputExpanded = 'true';
  section.dataset.layoutOwner = 'static-css';
  section.classList.add('phase2-input-sticky-section', 'phase4a-input-compact-section');
  forceInputControlsExpanded(section);

  const heading = section.querySelector('h3');
  const fileDrop = section.querySelector('.file-drop');
  const actions = section.querySelector('.button-row');

  if (!section.querySelector('#inputFileStatus')) {
    const status = document.createElement('div');
    status.id = 'inputFileStatus';
    status.className = 'input-file-status';
    status.setAttribute('aria-live', 'polite');
    status.innerHTML = 'Status: <span id="inputStatus">No file chosen</span>';
    if (heading && heading.nextSibling) {
      section.insertBefore(status, heading.nextSibling);
    } else {
      section.prepend(status);
    }
  }

  if (fileDrop) {
    fileDrop.classList.add('input-file-drop-visible');
    fileDrop.dataset.stableInputDrop = 'true';
    const label = fileDrop.querySelector('span');
    if (label) label.textContent = 'Choose stagedJson';
  }

  if (actions) {
    actions.classList.add('input-primary-actions');
    actions.dataset.stableInputActions = 'true';
  }

  const loadSampleBtn = document.getElementById('loadSampleBtn');
  if (loadSampleBtn) {
    loadSampleBtn.title = 'Load BM_CII stagedJson sample';
    loadSampleBtn.setAttribute('aria-label', 'Load BM_CII stagedJson sample');
    const label = loadSampleBtn.querySelector('span');
    if (label && !/BM_CII/i.test(label.textContent || '')) label.textContent = 'Load BM_CII stagedJson';
  }

  const clearBtn = document.getElementById('clearBtn');
  if (clearBtn) clearBtn.setAttribute('aria-label', 'Clear all input and sample data');

  const closeInputBtn = document.getElementById('closeInputBtn');
  if (closeInputBtn) {
    closeInputBtn.hidden = true;
    closeInputBtn.setAttribute('aria-hidden', 'true');
    closeInputBtn.tabIndex = -1;
  }

  return section;
}

function forceInputControlsExpanded(section) {
  if (!section) return;
  section.hidden = false;
  section.removeAttribute('hidden');
  section.removeAttribute('aria-hidden');
  section.removeAttribute('inert');
  section.classList.remove('collapsed', 'is-collapsed', 'workflow-card-collapsed', 'conversion-collapsed', 'sideload-collapsed');
  if (section.dataset.collapsible) delete section.dataset.collapsible;

  const heading = section.querySelector('h3');
  heading?.removeAttribute('role');
  heading?.removeAttribute('tabindex');
  heading?.removeAttribute('aria-controls');
  heading?.removeAttribute('aria-expanded');
  delete heading?.dataset.boundCollapseSection;
  delete heading?.dataset.boundConversionCollapse;

  for (const selector of INPUT_CONTENT_SELECTORS) {
    for (const element of section.querySelectorAll(selector)) {
      element.hidden = false;
      element.removeAttribute('hidden');
      element.removeAttribute('aria-hidden');
      element.removeAttribute('inert');
      element.classList.remove('conversion-collapsible-content', 'sideload-collapsible-content', 'collapsed', 'is-collapsed');
    }
  }

  Array.from(section.children).forEach((child) => {
    if (child !== heading) {
      child.classList.remove('conversion-collapsible-content');
      child.classList.remove('sideload-collapsible-content');
    }
  });
}

function bindPostBootstrapReassertions() {
  if (window.__3D_MARKUP_INPUT_REASSERT_BOUND__ === VERSION) return;
  window.__3D_MARKUP_INPUT_REASSERT_BOUND__ = VERSION;
  INPUT_REASSERT_EVENTS.forEach((name) => {
    window.addEventListener(name, () => scheduleInputReassert(name));
  });
}

function scheduleInputReassert(source = 'event') {
  const run = () => {
    const section = ensureInputBlock();
    if (section) forceInputControlsExpanded(section);
    window.dispatchEvent(new CustomEvent('viewer:input-controls-reasserted', {
      detail: { version: VERSION, source, checklist: checklist() }
    }));
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
  else window.setTimeout(run, 0);
}

function bindFileStatus() {
  const input = document.getElementById('xmlFile');
  const loadSampleBtn = document.getElementById('loadSampleBtn');
  const clearBtn = document.getElementById('clearBtn');

  updateStatusFromInput();

  if (input && input.dataset.inputAlwaysVisibleBound !== '1') {
    input.dataset.inputAlwaysVisibleBound = '1';
    input.addEventListener('change', updateStatusFromInput);
  }

  if (loadSampleBtn && loadSampleBtn.dataset.inputAlwaysVisibleBound !== '1') {
    loadSampleBtn.dataset.inputAlwaysVisibleBound = '1';
    loadSampleBtn.addEventListener('click', () => {
      loadSampleBtn.dataset.sampleSelected = '1';
      window.setTimeout(updateStatusFromInput, 0);
    });
  }

  if (clearBtn && clearBtn.dataset.inputAlwaysVisibleBound !== '1') {
    clearBtn.dataset.inputAlwaysVisibleBound = '1';
    clearBtn.addEventListener('click', () => {
      if (loadSampleBtn) delete loadSampleBtn.dataset.sampleSelected;
      window.setTimeout(() => setStatus('No file chosen'), 0);
    });
  }
}

function updateStatusFromInput() {
  const input = document.getElementById('xmlFile');
  const file = input && input.files && input.files[0] ? input.files[0] : null;
  setStatus(file ? `File: ${file.name}` : 'No file chosen');
}

function setStatus(text) {
  const status = getStatusNode();
  if (status) status.textContent = text || 'No file chosen';
}

function getStatusNode() {
  return document.getElementById('inputStatus') || document.getElementById('inputFileStatus');
}

function getInputSection() {
  const drawer = document.getElementById('inputDrawer');
  if (!drawer) return null;
  return Array.from(drawer.querySelectorAll(':scope > .panel-section')).find((section) => {
    const heading = section.querySelector('h3');
    return /\bInput\b/i.test(heading?.textContent || '');
  }) || null;
}

function ensureDrawerOpen() {
  document.body.classList.add('input-open');

  const toggle = document.getElementById('toggleInputBtn');
  if (toggle) {
    toggle.classList.add('active');
    toggle.setAttribute('aria-pressed', 'true');
  }

  const drawer = document.getElementById('inputDrawer');
  if (drawer) {
    drawer.removeAttribute('hidden');
    drawer.removeAttribute('aria-hidden');
  }
}

function checklist() {
  const section = getInputSection();
  const loadSampleBtn = document.getElementById('loadSampleBtn');
  const fileDrop = section?.querySelector('.file-drop');
  const inputActions = section?.querySelector('.input-primary-actions');
  return {
    version: VERSION,
    drawerOpen: document.body.classList.contains('input-open'),
    inputExpanded: section?.dataset.inputExpanded === 'true',
    statusVisible: Boolean(getStatusNode()),
    statusText: getStatusNode()?.textContent || '',
    chooseInputVisible: Boolean(fileDrop && fileDrop.hidden === false),
    loadSampleVisible: Boolean(loadSampleBtn && loadSampleBtn.hidden === false),
    clearAllVisible: Boolean(document.getElementById('clearBtn')),
    actionRowVisible: Boolean(inputActions && inputActions.hidden === false),
    postBootstrapReassertions: INPUT_REASSERT_EVENTS,
    sampleStateSeparateFromFileStatus: true,
    compactStaticInputBlock: Boolean(section?.dataset.phase4aInput === 'compact-static'),
    layoutOwner: section?.dataset.layoutOwner || 'static-css',
    noRuntimeLayoutStyleInjection: true,
    noPolling: true,
    noSceneTraversal: true
  };
}
