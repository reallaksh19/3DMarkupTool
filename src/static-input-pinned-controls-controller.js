// Tiny startup helper only. No scene traversal, no polling, no review-tool hooks.
const STYLE_ID = 'core-safe-input-pinned-controls-style';
const STATUS_ID = 'coreSafeFileStatus';

const start = () => {
  installStyle();
  pinInputPanel();
  ensureFileStatus();
  window.__3D_MARKUP_CORE_INPUT_PINNED__ = {
    version: 'core-safe-boot-20260619',
    noPolling: true,
    refresh: () => {
      pinInputPanel();
      ensureFileStatus();
    }
  };
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    body.input-open .input-drawer { overflow-y: auto; }
    #inputDrawer .panel-section:first-of-type {
      position: sticky;
      top: 0;
      z-index: 30;
      padding: 12px 0 14px;
      background: linear-gradient(180deg, rgba(6, 18, 34, .99), rgba(6, 18, 34, .95));
      box-shadow: 0 14px 24px rgba(0, 0, 0, .24);
    }
    #inputDrawer .core-safe-file-status {
      display: block;
      margin: 0 0 8px;
      color: #d8e9ff;
      font-size: 12px;
      font-weight: 800;
      line-height: 1.2;
    }
  `;
  document.head.appendChild(style);
}

function pinInputPanel() {
  document.body.classList.add('input-open');
  const inputDrawer = document.getElementById('inputDrawer');
  if (inputDrawer) {
    inputDrawer.hidden = false;
    inputDrawer.removeAttribute('aria-hidden');
  }
  const closeBtn = document.getElementById('closeInputBtn');
  if (closeBtn) {
    closeBtn.hidden = true;
    closeBtn.setAttribute('aria-hidden', 'true');
    closeBtn.tabIndex = -1;
  }
  const toggle = document.getElementById('toggleInputBtn');
  if (toggle) {
    toggle.classList.add('active');
    toggle.setAttribute('aria-pressed', 'true');
  }
}

function ensureFileStatus() {
  const fileInput = document.getElementById('xmlFile');
  const fileDrop = document.querySelector('#inputDrawer .file-drop');
  if (!fileInput || !fileDrop) return;

  let status = document.getElementById(STATUS_ID);
  if (!status) {
    status = document.createElement('div');
    status.id = STATUS_ID;
    status.className = 'core-safe-file-status';
    fileDrop.parentNode?.insertBefore(status, fileDrop);
  }

  const update = () => {
    const file = fileInput.files && fileInput.files[0];
    status.textContent = file?.name || 'No file chosen';
  };
  fileInput.addEventListener('change', update);
  update();
}
