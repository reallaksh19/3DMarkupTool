// Deterministic input visibility controller.
// Static HTML/CSS owns the compact layout; this module only binds real controls
// and keeps the input drawer open during startup.
// No scene traversal, no polling, no runtime CSS injection.

const VERSION = 'static-input-deterministic-20260620';

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
  section.dataset.inputVisibility = 'always-visible';
  section.dataset.staticInput = 'compact';
  section.classList.add('static-input-compact-section');

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
    const label = fileDrop.querySelector('span');
    if (label) label.textContent = 'Choose InputXML';
  }

  if (actions) actions.classList.add('input-primary-actions');

  const loadSampleBtn = document.getElementById('loadSampleBtn');
  if (loadSampleBtn) {
    loadSampleBtn.title = 'Load BM_CII sample without replacing the local file chooser status';
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
      // Deliberately do not write to #inputFileStatus. That status reports only
      // the browser file input, not the built-in BM_CII sample source.
    });
  }

  if (clearBtn && clearBtn.dataset.inputAlwaysVisibleBound !== '1') {
    clearBtn.dataset.inputAlwaysVisibleBound = '1';
    clearBtn.addEventListener('click', () => {
      if (loadSampleBtn) delete loadSampleBtn.dataset.sampleSelected;
      if (input) input.value = '';
      setStatus('No file chosen');
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
    compactStaticInputBlock: Boolean(section?.dataset.staticInput === 'compact'),
    runtimeStyleInjection: false,
    noPolling: true,
    noSceneTraversal: true
  };
}
