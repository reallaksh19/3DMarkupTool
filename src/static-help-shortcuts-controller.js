// Static Help / Shortcuts panel for the review shell.
// UI-only: does not touch conversion, parsing, renderer, export, or clip logic.

const VERSION = 'static-help-shortcuts-20260619';
const STYLE_ID = 'staticHelpShortcutsStyles';

runWhenReady(initHelpShortcuts);

function runWhenReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function initHelpShortcuts() {
  ensureStyles();
  ensureHelpButton();
  ensurePanel();
  bindKeys();
  window.__3D_MARKUP_STATIC_HELP__ = {
    version: VERSION,
    open: openPanel,
    close: closePanel,
    toggle: togglePanel
  };
  window.__3D_MARKUP_STATIC_SHELL_CORE__?.updateUiScore?.();
  window.dispatchEvent(new CustomEvent('viewer:static-help-ready', { detail: { version: VERSION } }));
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .static-help-btn {
      min-height: 34px;
      border-radius: 10px;
      padding: 0 10px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid rgba(132, 174, 222, .42);
      background: linear-gradient(180deg, rgba(17, 42, 73, .96), rgba(8, 24, 46, .98));
      color: #dbefff;
      font-size: 12px;
      font-weight: 900;
      cursor: pointer;
    }
    .static-help-btn:hover,
    .static-help-btn.active {
      border-color: rgba(116, 230, 255, .72);
      color: #fff;
      background: linear-gradient(180deg, rgba(23, 74, 124, .98), rgba(10, 43, 83, .98));
    }
    .static-help-overlay {
      position: absolute;
      z-index: 25;
      right: 18px;
      top: 18px;
      width: min(520px, calc(100% - 36px));
      max-height: min(720px, calc(100% - 36px));
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      border: 1px solid rgba(116, 230, 255, .35);
      border-radius: 16px;
      background: rgba(5, 15, 29, .96);
      color: #e8f4ff;
      box-shadow: 0 22px 54px rgba(0,0,0,.45);
      overflow: hidden;
      backdrop-filter: blur(12px);
    }
    .static-help-overlay[hidden] { display: none; }
    .static-help-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 14px;
      border-bottom: 1px solid rgba(255,255,255,.1);
      background: linear-gradient(180deg, rgba(13, 44, 78, .94), rgba(7, 25, 45, .94));
    }
    .static-help-title {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .static-help-title strong {
      font-size: 14px;
      font-weight: 950;
      letter-spacing: .02em;
    }
    .static-help-title span {
      color: #9fb7cf;
      font-size: 11px;
      line-height: 1.35;
    }
    .static-help-close {
      width: 30px;
      min-width: 30px;
      height: 30px;
      border-radius: 9px;
      padding: 0;
      font-size: 18px;
      font-weight: 900;
    }
    .static-help-body {
      padding: 14px;
      overflow: auto;
      display: grid;
      gap: 12px;
    }
    .static-help-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .static-help-section {
      border: 1px solid rgba(132, 174, 222, .18);
      border-radius: 12px;
      background: rgba(10, 27, 48, .72);
      padding: 10px;
      display: grid;
      gap: 8px;
    }
    .static-help-section h3 {
      margin: 0;
      color: #74e6ff;
      font-size: 11px;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .static-help-list {
      display: grid;
      gap: 5px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .static-help-list li {
      display: grid;
      grid-template-columns: minmax(92px, auto) minmax(0, 1fr);
      gap: 8px;
      align-items: start;
      color: #c9d9ea;
      font-size: 11.5px;
      line-height: 1.35;
    }
    .static-help-key {
      display: inline-flex;
      width: fit-content;
      max-width: 100%;
      padding: 2px 7px;
      border-radius: 7px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.08);
      color: #fff;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 10.5px;
      white-space: nowrap;
    }
    .static-help-note {
      border: 1px solid rgba(255, 209, 102, .22);
      border-radius: 12px;
      background: rgba(66, 46, 9, .34);
      color: #ffe8ad;
      padding: 10px 12px;
      font-size: 11.5px;
      line-height: 1.45;
    }
    @media (max-width: 920px) {
      .static-help-grid { grid-template-columns: 1fr; }
      .static-help-overlay { left: 12px; right: 12px; width: auto; }
    }
  `;
  document.head.appendChild(style);
}

function ensureHelpButton() {
  let button = document.getElementById('helpShortcutsBtn');
  if (button) return button;
  const host = document.querySelector('.topbar-actions') || document.querySelector('.viewer-topbar');
  if (!host) return null;
  button = document.createElement('button');
  button.id = 'helpShortcutsBtn';
  button.type = 'button';
  button.className = 'static-help-btn';
  button.title = 'Show help and keyboard shortcuts';
  button.setAttribute('aria-label', 'Show help and keyboard shortcuts');
  button.innerHTML = '<span aria-hidden="true">?</span><span>Help</span>';
  const status = document.getElementById('runtimeStatus') || document.getElementById('uiHealthBadge');
  if (status?.parentElement === host) host.insertBefore(button, status);
  else host.appendChild(button);
  button.addEventListener('click', togglePanel);
  return button;
}

function ensurePanel() {
  const viewer = document.getElementById('viewer') || document.body;
  let panel = document.getElementById('staticHelpShortcutsPanel');
  if (panel) return panel;
  panel = document.createElement('aside');
  panel.id = 'staticHelpShortcutsPanel';
  panel.className = 'static-help-overlay';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Help and keyboard shortcuts');
  panel.innerHTML = `
    <div class="static-help-head">
      <div class="static-help-title">
        <strong>Help / Shortcuts</strong>
        <span>Quick reference for review, selection, display, export, and session tools.</span>
      </div>
      <button id="staticHelpCloseBtn" type="button" class="static-help-close" title="Close help">×</button>
    </div>
    <div class="static-help-body">
      <div class="static-help-grid">
        ${section('Mouse / Navigation', [
          ['LMB', 'Select component in Select mode.'],
          ['Wheel', 'Zoom in/out.'],
          ['RMB / Pan', 'Pan the camera where supported.'],
          ['Orbit', 'Use Orbit tool for camera rotation.']
        ])}
        ${section('Keyboard', [
          ['S', 'Select mode.'],
          ['O', 'Orbit mode.'],
          ['P', 'Pan mode.'],
          ['M', 'Measure mode.'],
          ['G', 'Toggle grid.'],
          ['Esc', 'Close overlays / clear transient panels.'],
          ['? / H', 'Open this help panel.']
        ])}
        ${section('Review Workflow', [
          ['Input', 'Load InputXML or BM_CII sample.'],
          ['Convert', 'Run conversion and review generated model.'],
          ['Tree', 'Open Model Tree and select components.'],
          ['Props', 'Inspect metadata, copy ID/JSON, fit or clear selection.']
        ])}
        ${section('Display / Export', [
          ['Color By', 'Change color mode; Legend opens automatically.'],
          ['Legend', 'Drag legend within the viewer canvas.'],
          ['Fit All / Sel', 'Frame full model or selected component.'],
          ['GLB/RVM/ATT', 'Quick export buttons enable after conversion.']
        ])}
      </div>
      <div class="static-help-note">Normal review mode hides experimental Clip tools. Use <span class="static-help-key">?clipTools=1</span> only when clip work is intentionally being tested.</div>
    </div>
  `;
  viewer.appendChild(panel);
  panel.querySelector('#staticHelpCloseBtn')?.addEventListener('click', closePanel);
  return panel;
}

function section(title, rows) {
  return `<section class="static-help-section"><h3>${escapeHtml(title)}</h3><ul class="static-help-list">${rows.map(([key, text]) => `<li><span class="static-help-key">${escapeHtml(key)}</span><span>${escapeHtml(text)}</span></li>`).join('')}</ul></section>`;
}

function bindKeys() {
  window.addEventListener('keydown', (event) => {
    const target = event.target;
    if (isTextInput(target)) return;
    if (event.key === '?' || event.key.toLowerCase() === 'h' || event.key === 'F1') {
      event.preventDefault();
      togglePanel();
      return;
    }
    if (event.key === 'Escape') closePanel();
  });
}

function togglePanel() {
  const panel = ensurePanel();
  if (!panel) return;
  panel.hidden ? openPanel() : closePanel();
}

function openPanel() {
  const panel = ensurePanel();
  if (!panel) return;
  panel.hidden = false;
  document.getElementById('helpShortcutsBtn')?.classList.add('active');
  window.__3D_MARKUP_STATIC_SHELL_CORE__?.updateUiScore?.();
}

function closePanel() {
  const panel = document.getElementById('staticHelpShortcutsPanel');
  if (panel) panel.hidden = true;
  document.getElementById('helpShortcutsBtn')?.classList.remove('active');
  window.__3D_MARKUP_STATIC_SHELL_CORE__?.updateUiScore?.();
}

function isTextInput(target) {
  if (!target) return false;
  const tag = String(target.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
