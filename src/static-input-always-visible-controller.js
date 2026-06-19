// Phase 2 / Phase 4A input always-visible controller.
// Keeps the real InputXML controls visible without duplicating fake controls.
// Layout is owned by static HTML/CSS so the first paint and post-JS state match.
// No scene traversal, no polling, no review-tool activation.

const VERSION = 'perf-static-shell-20260620';

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
  section.dataset.layoutOwner = 'static-css';
  section.classList.add('phase2-input-sticky-section', 'phase4a-input-compact-section');

  const heading = section.querySelector('h3');
  const fileDrop = section.querySelector('.file-drop');
  const actions = section.querySelector('.button-row');

  if (!section.querySelector('#inputFileStatus')) {
    const status = document.createElement('div');
    status.id = 'inputFileStatus';
    status.className = 'input-file-status';
    status.setAttribute('aria-live', 'polite');
    status.textContent = 'No file chosen';
    if (heading && heading.nextSibling) {
      section.insertBefore(status, heading.nextSibling);
    } else {
      section.prepend(status);
    }
  }

  if (fileDrop) {
    fileDrop.classList.add('input-file-drop-visible');
    const label = fileDrop.querySelector('span');
    if (label) label.textContent = 'Choose InputXML';
  }

  if (actions) actions.classList.add('input-primary-actions');

  const loadSampleBtn = document.getElementById('loadSampleBtn');
  if (loadSampleBtn) {
    loadSampleBtn.title = 'Load BM_CII sample without replacing the file chooser status';
    loadSampleBtn.setAttribute('aria-label', 'Load BM_CII sample');
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
      // Keep this status strictly about the local file chooser.
      // The sample button state is carried on the button to avoid replacing
      // the always-visible "No file chosen" file status.
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
  return document.getElementById('inputFileStatus');
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
  return {
    version: VERSION,
    drawerOpen: document.body.classList.contains('input-open'),
    statusVisible: Boolean(getStatusNode()),
    statusText: getStatusNode()?.textContent || '',
    chooseInputVisible: Boolean(section?.querySelector('.file-drop')),
    loadSampleVisible: Boolean(loadSampleBtn),
    sampleStateSeparateFromFileStatus: true,
    clearAllVisible: Boolean(document.getElementById('clearBtn')),
    compactStaticInputBlock: Boolean(section?.dataset.phase4aInput === 'compact-static'),
    layoutOwner: section?.dataset.layoutOwner || 'static-css',
    noRuntimeLayoutStyleInjection: true,
    noPolling: true,
    noSceneTraversal: true
  };
}
