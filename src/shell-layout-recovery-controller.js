const STYLE_ID = 'shellLayoutRecoveryStyles';

installShellLayoutRecovery();

function installShellLayoutRecovery() {
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    html,
    body {
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
    }

    body {
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
    }

    .app-shell,
    .viewer-topbar {
      flex: 0 0 auto !important;
      min-height: 92px !important;
      max-height: 38vh !important;
      display: grid !important;
      grid-template-columns: minmax(320px, 0.27fr) minmax(0, 1fr) !important;
      align-items: start !important;
      gap: 12px !important;
      padding: 10px 12px 12px 16px !important;
      background: linear-gradient(180deg, #203a58, #1a314c) !important;
      border-bottom: 1px solid #375575 !important;
      box-shadow: 0 2px 16px rgba(0, 0, 0, .28) !important;
      position: relative !important;
      z-index: 100 !important;
      overflow: visible !important;
    }

    .brand-block {
      min-width: 0 !important;
      max-width: 430px !important;
      padding-top: 4px !important;
      align-self: start !important;
      pointer-events: auto !important;
    }

    .brand-block h1 {
      margin: 4px 0 3px !important;
      font-size: clamp(19px, 1.35vw, 24px) !important;
      line-height: 1.08 !important;
      white-space: normal !important;
    }

    .brand-block p {
      max-width: 420px !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }

    .toolbar {
      min-width: 0 !important;
      width: 100% !important;
      display: flex !important;
      flex-wrap: wrap !important;
      align-items: flex-start !important;
      align-content: flex-start !important;
      justify-content: flex-end !important;
      gap: 8px !important;
      overflow: visible !important;
      pointer-events: auto !important;
    }

    .tool-group,
    .toolbar-group,
    .navis-tag-tools,
    .panel-toggles,
    .button-row {
      display: inline-flex !important;
      align-items: center !important;
      flex-wrap: wrap !important;
      gap: 7px !important;
    }

    .tool-group,
    .toolbar-group,
    .navis-tag-tools {
      padding: 5px !important;
      border: 1px solid rgba(92, 127, 163, .65) !important;
      border-radius: 12px !important;
      background: rgba(255, 255, 255, .045) !important;
    }

    .toolbar .tool-btn,
    .toolbar button {
      flex: 0 0 auto !important;
      white-space: nowrap !important;
      pointer-events: auto !important;
    }

    .color-control {
      flex: 0 0 auto !important;
      min-width: 250px !important;
    }

    .color-control select {
      min-width: 150px !important;
    }

    .layout {
      position: relative !important;
      flex: 1 1 auto !important;
      min-height: 0 !important;
      width: 100% !important;
      overflow: hidden !important;
    }

    .viewer-shell {
      position: relative !important;
      width: 100% !important;
      height: 100% !important;
      min-height: 0 !important;
      overflow: hidden !important;
      background: var(--bg) !important;
    }

    #viewer,
    .viewer-canvas {
      position: absolute !important;
      inset: 0 !important;
    }

    #inputDrawer,
    #propertiesPanel {
      position: absolute !important;
      top: 16px !important;
      bottom: 48px !important;
      z-index: 30 !important;
      overflow: auto !important;
      border: 1px solid rgba(88, 124, 160, .7) !important;
      border-radius: 12px !important;
      background: rgba(15, 27, 42, .96) !important;
      box-shadow: var(--shadow) !important;
      backdrop-filter: blur(12px) !important;
      transition: transform .2s ease, opacity .2s ease !important;
      pointer-events: auto !important;
    }

    #inputDrawer {
      left: 16px !important;
      width: 378px !important;
      min-width: 320px !important;
      padding: 14px !important;
    }

    #propertiesPanel {
      right: 16px !important;
      width: 324px !important;
      min-width: 288px !important;
      max-width: min(480px, 42vw) !important;
      padding: 14px 14px 18px !important;
      resize: both !important;
    }

    body:not(.input-open) #inputDrawer {
      transform: translateX(calc(-100% - 22px)) !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }

    body.input-open #inputDrawer {
      transform: translateX(0) !important;
      opacity: 1 !important;
      pointer-events: auto !important;
    }

    body:not(.props-open) #propertiesPanel {
      transform: translateX(calc(100% + 22px)) !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }

    body.props-open #propertiesPanel {
      transform: translateX(0) !important;
      opacity: 1 !important;
      pointer-events: auto !important;
    }

    .statusbar,
    .viewer-statusbar {
      position: absolute !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      z-index: 11 !important;
    }

    @media (max-width: 1400px) {
      .app-shell,
      .viewer-topbar {
        grid-template-columns: minmax(260px, 0.24fr) minmax(0, 1fr) !important;
      }
      .brand-block h1 { font-size: 19px !important; }
      .brand-block p { display: none !important; }
      .toolbar { gap: 6px !important; }
      .tool-btn { padding: 7px 9px !important; }
      .color-control { min-width: 220px !important; }
    }

    @media (max-width: 980px) {
      body { overflow: auto !important; }
      .app-shell,
      .viewer-topbar {
        display: flex !important;
        flex-direction: column !important;
        max-height: none !important;
      }
      .toolbar { justify-content: flex-start !important; }
      .layout { min-height: 72vh !important; }
    }
  `;

  document.head.appendChild(style);
}
