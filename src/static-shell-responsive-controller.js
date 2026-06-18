const STYLE_ID = 'staticShellResponsiveGuardStyles';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installStaticShellGuard, { once: true });
} else {
  installStaticShellGuard();
}

function installStaticShellGuard() {
  injectStyles();
  hideUnsafeStartupPopovers();
  window.addEventListener('markup:safe-ui-status', hideUnsafeStartupPopovers);
}

function hideUnsafeStartupPopovers() {
  document.querySelectorAll('.two-row-menu-popover, .viewer-clipbox-popover').forEach((node) => {
    if (!node.closest('.open, .is-open, [data-open="true"]')) {
      node.hidden = true;
      node.setAttribute('aria-hidden', 'true');
    }
  });
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    :root {
      --topbar-h: 196px;
    }

    body.pro-shell {
      overflow: hidden;
    }

    .viewer-topbar {
      max-height: var(--topbar-h);
      overflow: hidden;
    }

    .main-ribbon,
    .markup-ribbon {
      align-items: center !important;
      flex-wrap: nowrap !important;
      overflow-x: auto !important;
      overflow-y: visible !important;
      scrollbar-width: thin;
    }

    .tool-group,
    .toolbar-group,
    .navis-tag-tools {
      flex: 0 0 auto !important;
      align-items: center !important;
      height: auto !important;
      min-height: 0 !important;
    }

    .main-ribbon .tool-btn {
      flex: 0 0 auto !important;
      width: 72px !important;
      min-width: 72px !important;
      max-width: 72px !important;
      height: 64px !important;
      min-height: 64px !important;
      max-height: 64px !important;
      align-self: center !important;
    }

    .markup-ribbon .tool-btn,
    .markup-ribbon button {
      flex: 0 0 auto !important;
      height: 42px !important;
      min-height: 42px !important;
      max-height: 42px !important;
      align-self: center !important;
    }

    .two-row-menu,
    .viewer-clipbox-menu {
      position: relative !important;
      flex: 0 0 auto !important;
      align-self: center !important;
      width: auto !important;
      height: auto !important;
    }

    .two-row-menu-trigger,
    .viewer-clipbox-trigger {
      height: 64px !important;
      min-height: 64px !important;
      max-height: 64px !important;
      min-width: 72px !important;
      max-width: 82px !important;
      display: inline-flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 6px !important;
    }

    .two-row-menu-popover,
    .viewer-clipbox-popover {
      display: none !important;
      position: absolute !important;
      top: calc(100% + 8px) !important;
      left: 0 !important;
      z-index: 90 !important;
      max-height: 360px !important;
      overflow: auto !important;
    }

    .two-row-menu.open > .two-row-menu-popover,
    .two-row-menu.is-open > .two-row-menu-popover,
    .viewer-clipbox-menu.open > .viewer-clipbox-popover,
    .viewer-clipbox-menu.is-open > .viewer-clipbox-popover,
    .two-row-menu[data-open="true"] > .two-row-menu-popover,
    .viewer-clipbox-menu[data-open="true"] > .viewer-clipbox-popover {
      display: grid !important;
    }

    body:not(.clip-adjust-open) .clip-adjust-panel {
      display: none !important;
    }

    .app-workspace {
      height: calc(100vh - var(--topbar-h)) !important;
    }

    @media (max-width: 1500px) {
      :root { --topbar-h: 188px; }
      .main-ribbon .tool-btn,
      .two-row-menu-trigger,
      .viewer-clipbox-trigger {
        width: 64px !important;
        min-width: 64px !important;
        max-width: 68px !important;
        height: 58px !important;
        min-height: 58px !important;
        max-height: 58px !important;
      }
    }
  `;
  document.head.appendChild(style);
}
