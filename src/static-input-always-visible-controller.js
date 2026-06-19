// Phase 4A input visibility correction.
// Keeps the real InputXML controls visible before any generated drawer summary.
// No scene traversal, no polling, no review-tool activation.

const VERSION = 'phase4a-input-visible-20260619';
const STYLE_ID = 'inputAlwaysVisiblePhase2Styles';

runWhenReady(initInputAlwaysVisible);

function runWhenReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function initInputAlwaysVisible() {
  injectStyles();
  const section = ensureInputBlock();
  if (!section) return;

  bindFileStatus();
  ensureDrawerOpen();
  bindInputOrderingRefresh();
  positionInputSectionFirst();

  window.__3D_MARKUP_INPUT_ALWAYS_VISIBLE__ = {
    version: VERSION,
    ensure: initInputAlwaysVisible,
    positionFirst: positionInputSectionFirst,
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
  section.dataset.phase4aInput = 'first-visible';
  section.classList.add('phase2-input-sticky-section', 'phase4a-input-first-section');

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

  const closeInputBtn = document.getElementById('closeInputBtn');
  if (closeInputBtn) {
    closeInputBtn.hidden = true;
    closeInputBtn.setAttribute('aria-hidden', 'true');
    closeInputBtn.tabIndex = -1;
  }

  positionInputSectionFirst();
  return section;
}

function bindInputOrderingRefresh() {
  const drawer = document.getElementById('inputDrawer');
  if (!drawer) return;

  if (drawer.dataset.phase4aInputOrderingBound !== '1') {
    drawer.dataset.phase4aInputOrderingBound = '1';
    const observer = new MutationObserver(() => positionInputSectionFirst());
    observer.observe(drawer, { childList: true });
    drawer.__phase4aInputOrderingObserver = observer;
  }

  if (window.__phase4aInputDrawerSummaryBound !== '1') {
    window.__phase4aInputDrawerSummaryBound = '1';
    window.addEventListener('viewer:drawer-summary-ready', () => positionInputSectionFirst());
  }
}

function positionInputSectionFirst() {
  const drawer = document.getElementById('inputDrawer');
  if (!drawer) return false;

  const section = getInputSection();
  const head = drawer.querySelector('.drawer-head');
  if (!section || !head) return false;

  const firstAfterHead = head.nextElementSibling;
  if (firstAfterHead !== section) {
    drawer.insertBefore(section, head.nextSibling);
  }

  const summary = document.getElementById('drawerSummaryCard');
  if (summary && summary.parentElement === drawer && section.nextElementSibling !== summary) {
    drawer.insertBefore(summary, section.nextSibling);
  }

  section.dataset.phase4aInput = 'first-visible';
  drawer.dataset.phase4aInputFirst = '1';
  return true;
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
      setStatus('BM_CII sample selected');
    });
  }

  if (clearBtn && clearBtn.dataset.inputAlwaysVisibleBound !== '1') {
    clearBtn.dataset.inputAlwaysVisibleBound = '1';
    clearBtn.addEventListener('click', () => {
      window.setTimeout(() => setStatus('No file chosen'), 0);
    });
  }
}

function updateStatusFromInput() {
  const input = document.getElementById('xmlFile');
  const file = input && input.files && input.files[0] ? input.files[0] : null;
  setStatus(file ? file.name : 'No file chosen');
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

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #inputDrawer {
      scroll-padding-top: 148px !important;
    }

    #inputDrawer .phase2-input-sticky-section,
    #inputDrawer .panel-section[data-phase2-input="always-visible"] {
      position: sticky !important;
      top: 0 !important;
      z-index: 42 !important;
      padding: 12px !important;
      margin: -1px -4px 12px !important;
      border: 1px solid rgba(72, 153, 255, .44) !important;
      border-radius: 12px !important;
      background:
        linear-gradient(180deg, rgba(12, 31, 56, .99), rgba(7, 20, 37, .985)) !important;
      box-shadow: 0 14px 28px rgba(0, 0, 0, .34) !important;
    }

    #inputDrawer .phase4a-input-first-section {
      order: -10 !important;
    }

    #inputDrawer .phase2-input-sticky-section h3 {
      margin-bottom: 8px !important;
    }

    #inputFileStatus.input-file-status {
      display: flex !important;
      align-items: center !important;
      min-height: 30px !important;
      margin: 0 0 8px !important;
      padding: 6px 9px !important;
      border: 1px solid rgba(83, 125, 176, .36) !important;
      border-radius: 9px !important;
      color: #f8fbff !important;
      background: rgba(4, 14, 28, .68) !important;
      font-size: 12px !important;
      font-weight: 850 !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }

    #inputDrawer .phase2-input-sticky-section > .file-drop,
    #inputDrawer .panel-section[data-phase2-input="always-visible"] > .file-drop {
      display: flex !important;
      min-height: 42px !important;
      margin-bottom: 8px !important;
    }

    #inputDrawer .phase2-input-sticky-section > .input-primary-actions,
    #inputDrawer .panel-section[data-phase2-input="always-visible"] > .input-primary-actions {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      flex-wrap: wrap !important;
    }

    #inputDrawer .phase2-input-sticky-section #loadSampleBtn,
    #inputDrawer .phase2-input-sticky-section #clearBtn {
      flex: 1 1 130px !important;
      min-width: 0 !important;
    }

    #drawerSummaryCard {
      position: relative !important;
      z-index: 1 !important;
    }

    #closeInputBtn[hidden] {
      display: none !important;
    }

    body:not(.input-open) .input-drawer {
      opacity: 1 !important;
      pointer-events: auto !important;
      overflow: auto !important;
      padding: 14px !important;
      border-width: 1px !important;
    }
  `;
  document.head.appendChild(style);
}

function checklist() {
  const section = getInputSection();
  const drawer = document.getElementById('inputDrawer');
  const head = drawer?.querySelector('.drawer-head') || null;
  const summary = document.getElementById('drawerSummaryCard');
  return {
    version: VERSION,
    drawerOpen: document.body.classList.contains('input-open'),
    statusVisible: Boolean(getStatusNode()),
    statusText: getStatusNode()?.textContent || '',
    chooseInputVisible: Boolean(section?.querySelector('.file-drop')),
    loadSampleVisible: Boolean(document.getElementById('loadSampleBtn')),
    clearAllVisible: Boolean(document.getElementById('clearBtn')),
    inputBeforeSummary: Boolean(section && summary && section.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING),
    inputFirstAfterDrawerHead: Boolean(head && head.nextElementSibling === section),
    noPolling: true,
    noSceneTraversal: true
  };
}
