const TAG_BUTTON_IDS = [
  'navisTagBtn',
  'navisTagViewsBtn',
  'navisImportTagsBtn',
  'navisIsonoteBtn',
  'navisSaveTagSessionBtn',
  'navisRestoreTagSessionBtn',
  'navisClearTagSessionBtn',
  'navisExportTagsBtn',
  'navisClearTagsBtn'
];

const state = {
  observer: null,
  cleanupTimer: null,
  closeBound: false
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initToolbarCleanup, { once: true });
} else {
  initToolbarCleanup();
}

function initToolbarCleanup() {
  injectStyles();
  applyToolbarCleanup();
  startObserver();
  startShortTimer();
  bindGlobalClose();
}

function startObserver() {
  if (state.observer) return;
  const toolbar = document.querySelector('.toolbar') || document.body;
  state.observer = new MutationObserver(() => applyToolbarCleanup());
  state.observer.observe(toolbar, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'id'] });
}

function startShortTimer() {
  let ticks = 0;
  state.cleanupTimer = setInterval(() => {
    applyToolbarCleanup();
    ticks += 1;
    if (ticks > 20) clearInterval(state.cleanupTimer);
  }, 500);
}

function applyToolbarCleanup() {
  const group = document.querySelector('.navis-tag-tools');
  if (!group) return;

  group.classList.add('navis-tag-tools-compact');
  const toggle = ensureToggle(group);
  const menu = ensureMenu(group);
  moveTagButtonsIntoMenu(group, menu, toggle);
  updateToggleState(group, toggle, menu);
}

function ensureToggle(group) {
  let toggle = document.getElementById('navisTagsMenuBtn');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.id = 'navisTagsMenuBtn';
    toggle.type = 'button';
    toggle.className = 'tool-btn navis-tags-menu-toggle';
    toggle.title = 'Open Navis tag/XML tools';
    toggle.setAttribute('aria-haspopup', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<span class="navis-tags-menu-icon">ðŸ·</span><span>Tags</span><span class="navis-tags-menu-caret">â–¾</span>';
    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      group.classList.toggle('navis-tags-menu-open');
      toggle.setAttribute('aria-expanded', group.classList.contains('navis-tags-menu-open') ? 'true' : 'false');
    });
    group.prepend(toggle);
  }
  return toggle;
}

function ensureMenu(group) {
  let menu = document.getElementById('navisTagsMenu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'navisTagsMenu';
    menu.className = 'navis-tags-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
      <div class="navis-tags-menu-head">
        <strong>Tag / XML tools</strong>
        <span>Navis viewpoints</span>
      </div>
      <div class="navis-tags-menu-actions"></div>
    `;
    group.appendChild(menu);
  }
  return menu;
}

function moveTagButtonsIntoMenu(group, menu, toggle) {
  const actions = menu.querySelector('.navis-tags-menu-actions') || menu;

  for (const id of TAG_BUTTON_IDS) {
    const button = document.getElementById(id);
    if (button && button !== toggle && button.parentElement !== actions) {
      button.classList.add('navis-tags-menu-item');
      actions.appendChild(button);
    }
  }

  const importFile = document.getElementById('navisImportTagsFile');
  if (importFile && importFile.parentElement !== actions) actions.appendChild(importFile);

  const looseButtons = Array.from(group.children).filter((child) =>
    child instanceof HTMLButtonElement && child.id !== 'navisTagsMenuBtn' && child.id !== 'navisTagsMenu'
  );
  for (const button of looseButtons) {
    button.classList.add('navis-tags-menu-item');
    actions.appendChild(button);
  }
}

function updateToggleState(group, toggle, menu) {
  const active = Boolean(menu.querySelector('button.tool-active, button.active'));
  toggle.classList.toggle('tool-active', active);
  toggle.setAttribute('aria-expanded', group.classList.contains('navis-tags-menu-open') ? 'true' : 'false');
}

function bindGlobalClose() {
  if (state.closeBound) return;
  state.closeBound = true;

  document.addEventListener('click', (event) => {
    const group = document.querySelector('.navis-tag-tools-compact');
    if (!group || group.contains(event.target)) return;
    closeMenu(group);
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const group = document.querySelector('.navis-tag-tools-compact.navis-tags-menu-open');
    if (group) closeMenu(group);
  });
}

function closeMenu(group) {
  group.classList.remove('navis-tags-menu-open');
  document.getElementById('navisTagsMenuBtn')?.setAttribute('aria-expanded', 'false');
}

function injectStyles() {
  if (document.getElementById('toolbarCleanupStyles')) return;
  const style = document.createElement('style');
  style.id = 'toolbarCleanupStyles';
  style.textContent = `
    .navis-tag-tools-compact {
      position: relative;
      flex-wrap: nowrap;
      isolation: isolate;
    }

    .navis-tag-tools-compact > .tool-btn:not(#navisTagsMenuBtn),
    .navis-tag-tools-compact > input[type="file"] {
      display: none !important;
    }

    .navis-tags-menu-toggle {
      min-width: 82px;
      background: #2e4c6c;
    }

    .navis-tags-menu-icon {
      line-height: 1;
      filter: saturate(1.15);
    }

    .navis-tags-menu-caret {
      opacity: .78;
      font-size: 10px;
      margin-left: 1px;
    }

    .navis-tags-menu {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      z-index: 1500;
      width: 268px;
      max-height: min(70vh, 560px);
      overflow: auto;
      display: none;
      flex-direction: column;
      gap: 8px;
      padding: 10px;
      border: 1px solid rgba(101, 213, 255, .45);
      border-radius: 14px;
      background: rgba(9, 18, 31, .98);
      box-shadow: 0 22px 54px rgba(0, 0, 0, .48);
    }

    .navis-tags-menu-open .navis-tags-menu {
      display: flex;
    }

    .navis-tags-menu-head {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 3px 5px 7px;
      border-bottom: 1px solid rgba(255, 255, 255, .12);
    }

    .navis-tags-menu-head strong {
      font-size: 12px;
      letter-spacing: .2px;
    }

    .navis-tags-menu-head span {
      color: var(--muted, #9fb0c5);
      font-size: 11px;
    }

    .navis-tags-menu-actions {
      display: grid;
      grid-template-columns: 1fr;
      gap: 6px;
    }

    .navis-tags-menu .tool-btn,
    .navis-tags-menu button {
      width: 100%;
      justify-content: flex-start;
      text-align: left;
      min-height: 34px;
    }

    .navis-tags-menu .tool-btn.accent {
      justify-content: center;
      margin-top: 4px;
    }

    .navis-tags-menu input[hidden] {
      display: none !important;
    }

    @media (max-width: 900px) {
      .navis-tags-menu {
        right: auto;
        left: 0;
        width: min(82vw, 300px);
      }
    }
  `;
  document.head.appendChild(style);
}
