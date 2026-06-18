const STORAGE_KEY = '3dmarkup.rvmExportProfile';
const PROFILE_EXPERIMENTAL = 'experimental';
const PROFILE_STRICT = 'strict-candidate';

const state = {
  panel: null,
  select: null,
  bypassNextDownload: false
};

initRvmStrictModeController();

function initRvmStrictModeController() {
  if (window.__RVM_STRICT_MODE_CONTROLLER__) return;
  injectStyles();
  ensureProfileUi();
  ensurePanel();
  wireDownloadGuard();
  updateProfileState(getProfile());
  window.__RVM_STRICT_MODE_CONTROLLER__ = {
    getProfile,
    setProfile: updateProfileState,
    open: openPanel
  };
}

function ensureProfileUi() {
  if (document.getElementById('rvmExportProfileSelect')) return;
  const rvmVersion = document.getElementById('rvmVersion');
  const anchorField = rvmVersion?.closest('.field');
  const field = document.createElement('label');
  field.className = 'field rvm-profile-field';
  field.innerHTML = `
    <span>RVM export profile</span>
    <select id="rvmExportProfileSelect">
      <option value="${PROFILE_EXPERIMENTAL}">Experimental current</option>
      <option value="${PROFILE_STRICT}">Navis strict candidate</option>
    </select>
    <small id="rvmProfileHint" class="rvm-profile-hint"></small>
  `;

  if (anchorField?.parentElement) {
    anchorField.insertAdjacentElement('afterend', field);
  } else {
    document.querySelector('#inputDrawer .panel-section')?.appendChild(field);
  }

  state.select = field.querySelector('#rvmExportProfileSelect');
  state.select.value = getProfile();
  state.select.addEventListener('change', () => updateProfileState(state.select.value));
}

function ensurePanel() {
  if (state.panel) return state.panel;
  const panel = document.createElement('section');
  panel.id = 'rvmStrictPanel';
  panel.className = 'rvm-strict-panel';
  panel.setAttribute('aria-label', 'RVM export compatibility profile');
  panel.innerHTML = `
    <div class="rvm-strict-head">
      <div>
        <div class="rvm-strict-kicker">RVM EXPORT PROFILE</div>
        <h2>Navisworks Strict Candidate</h2>
      </div>
      <button type="button" class="rvm-strict-close" title="Close">×</button>
    </div>
    <div class="rvm-strict-body">
      <p><b>Default output is unchanged.</b> Strict Candidate is a workflow gate, not a new binary dialect yet.</p>
      <ul>
        <li>Run RVM QA before trying the file in Navisworks.</li>
        <li>Confirm wide 32-bit token decoding and absolute next-offset framing.</li>
        <li>Confirm CNTB/CNTE nesting and PRIM primitive codes against a known-good Navis fixture.</li>
        <li>Keep the matching <code>.att</code> file with the same base name as the <code>.rvm</code>.</li>
      </ul>
      <div class="rvm-strict-actions">
        <button type="button" id="rvmStrictOpenQaBtn">Open RVM QA</button>
        <button type="button" id="rvmStrictDownloadAnywayBtn">Download current RVM anyway</button>
      </div>
      <p class="rvm-strict-note">This keeps the current exporter honest: current RVM remains experimental until fixture validation proves Navisworks compatibility.</p>
    </div>
  `;
  document.body.appendChild(panel);
  state.panel = panel;
  panel.querySelector('.rvm-strict-close')?.addEventListener('click', closePanel);
  panel.querySelector('#rvmStrictOpenQaBtn')?.addEventListener('click', openRvmQa);
  panel.querySelector('#rvmStrictDownloadAnywayBtn')?.addEventListener('click', downloadAnyway);
  return panel;
}

function wireDownloadGuard() {
  const button = document.getElementById('downloadRvmBtn');
  if (!button || button.dataset.rvmStrictGuarded === '1') return;
  button.dataset.rvmStrictGuarded = '1';
  button.addEventListener('click', (event) => {
    if (state.bypassNextDownload) return;
    if (getProfile() !== PROFILE_STRICT) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openPanel();
    setRuntimeStatus('RVM strict preflight required');
  }, true);
}

function getProfile() {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === PROFILE_STRICT ? PROFILE_STRICT : PROFILE_EXPERIMENTAL;
}

function updateProfileState(profile) {
  const normalized = profile === PROFILE_STRICT ? PROFILE_STRICT : PROFILE_EXPERIMENTAL;
  window.localStorage.setItem(STORAGE_KEY, normalized);
  if (state.select && state.select.value !== normalized) state.select.value = normalized;
  const hint = document.getElementById('rvmProfileHint');
  if (hint) {
    hint.textContent = normalized === PROFILE_STRICT
      ? 'Preflight gate enabled. Download requires confirmation and RVM QA is recommended.'
      : 'Current exporter dialect; no Navisworks compatibility claim.';
  }
  document.body.classList.toggle('rvm-strict-candidate', normalized === PROFILE_STRICT);
  window.__3D_MARKUP_RVM_EXPORT_PROFILE__ = normalized;
  window.dispatchEvent(new CustomEvent('markup:rvm-profile-change', { detail: { profile: normalized } }));
}

function openPanel() {
  ensurePanel();
  state.panel.classList.add('open');
}

function closePanel() {
  state.panel?.classList.remove('open');
}

function openRvmQa() {
  closePanel();
  const qa = window.__RVM_COMPAT_VALIDATOR__;
  if (qa?.open) {
    qa.open();
    return;
  }
  document.getElementById('rvmCompatBtn')?.click();
}

function downloadAnyway() {
  const button = document.getElementById('downloadRvmBtn');
  if (!button || button.disabled) {
    setRuntimeStatus('Convert before RVM download');
    return;
  }
  state.bypassNextDownload = true;
  closePanel();
  button.click();
  window.setTimeout(() => { state.bypassNextDownload = false; }, 0);
}

function setRuntimeStatus(text) {
  const status = document.getElementById('runtimeStatus');
  if (status) status.textContent = text;
}

function injectStyles() {
  if (document.getElementById('rvmStrictModeStyles')) return;
  const style = document.createElement('style');
  style.id = 'rvmStrictModeStyles';
  style.textContent = `
    .rvm-profile-field select {
      width: 100%;
      min-height: 34px;
      border-radius: 10px;
      border: 1px solid rgba(106,162,220,.45);
      background: rgba(18,42,70,.9);
      color: #edf7ff;
      padding: 7px 10px;
      font-weight: 800;
    }
    .rvm-profile-hint {
      display: block;
      color: #a9bed4;
      font-size: 11px;
      line-height: 1.35;
      margin-top: 6px;
    }
    body.rvm-strict-candidate #downloadRvmBtn,
    body.rvm-strict-candidate #previewRvmBtn {
      border-color: rgba(255,209,102,.7) !important;
      box-shadow: inset 0 0 0 1px rgba(255,209,102,.18);
    }
    .rvm-strict-panel {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 15000;
      width: min(420px, calc(100vw - 44px));
      max-height: min(70vh, 520px);
      overflow: auto;
      border: 1px solid rgba(106,162,220,.55);
      border-radius: 18px;
      background: rgba(7,20,34,.97);
      color: #eaf6ff;
      box-shadow: 0 22px 70px rgba(0,0,0,.45);
      display: none;
    }
    .rvm-strict-panel.open { display: block; }
    .rvm-strict-head {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: start;
      padding: 16px 18px 10px;
      border-bottom: 1px solid rgba(106,162,220,.22);
    }
    .rvm-strict-kicker {
      font-size: 11px;
      color: #5ee0ff;
      letter-spacing: .14em;
      font-weight: 900;
    }
    .rvm-strict-head h2 {
      margin: 4px 0 0;
      font-size: 17px;
    }
    .rvm-strict-close {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      border: 1px solid rgba(106,162,220,.45);
      background: rgba(24,54,86,.8);
      color: #fff;
      font-size: 20px;
      cursor: pointer;
    }
    .rvm-strict-body { padding: 14px 18px 18px; }
    .rvm-strict-body p { color: #c9d7e8; line-height: 1.45; }
    .rvm-strict-body ul { padding-left: 20px; color: #d8e8f8; }
    .rvm-strict-body li { margin: 7px 0; }
    .rvm-strict-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 14px;
    }
    .rvm-strict-actions button {
      border-radius: 10px;
      border: 1px solid rgba(255,209,102,.45);
      background: rgba(122,78,18,.9);
      color: #fff7df;
      padding: 9px 12px;
      font-weight: 900;
      cursor: pointer;
    }
    .rvm-strict-actions button:first-child {
      border-color: rgba(94,224,255,.45);
      background: rgba(18,68,92,.9);
      color: #dff8ff;
    }
    .rvm-strict-note {
      border-top: 1px solid rgba(106,162,220,.22);
      margin-top: 14px;
      padding-top: 12px;
      font-size: 12px;
    }
  `;
  document.head.appendChild(style);
}
