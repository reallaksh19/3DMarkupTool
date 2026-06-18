const GROUP_LABELS = [
  ['.primary-tools', 'Navigate'],
  ['#viewIsoBtn', 'Views'],
  ['#clipBtn', 'Review'],
  ['#previewGlbBtn', 'Output'],
  ['.panel-tools', 'Panels'],
  ['.navis-tag-tools', 'Tags']
];

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initProfessionalShell, { once: true });
} else {
  initProfessionalShell();
}

function initProfessionalShell() {
  document.body.classList.add('professional-shell');
  injectProfessionalShellStyles();
  applyToolbarLabels();
  compactBrand();
  watchLateToolbarChanges();
}

function applyToolbarLabels() {
  const toolbar = document.querySelector('.toolbar');
  if (!toolbar) return;
  toolbar.classList.add('professional-ribbon');

  for (const [selector, label] of GROUP_LABELS) {
    const anchor = document.querySelector(selector);
    const group = anchor?.classList?.contains('toolbar-group') ? anchor : anchor?.closest?.('.toolbar-group');
    if (!group) continue;
    group.dataset.groupLabel = label;
    group.classList.add('professional-toolbar-group');
  }

  const colorControl = document.querySelector('.color-control');
  if (colorControl) {
    colorControl.dataset.groupLabel = 'Appearance';
    colorControl.classList.add('professional-color-control');
  }

  const status = document.getElementById('runtimeStatus');
  if (status) {
    status.dataset.statusLabel = 'Status';
    status.classList.add('professional-status-pill');
  }
}

function compactBrand() {
  const brand = document.querySelector('.brand-block');
  if (!brand || brand.querySelector('.brand-meta-row')) return;

  const meta = document.createElement('div');
  meta.className = 'brand-meta-row';
  meta.innerHTML = '<span class="brand-chip">Static Review</span><span class="brand-chip brand-chip-muted">InputXML QA</span>';
  brand.appendChild(meta);
}

function watchLateToolbarChanges() {
  const toolbar = document.querySelector('.toolbar');
  if (!toolbar || toolbar.dataset.professionalObserver === 'true') return;
  toolbar.dataset.professionalObserver = 'true';
  const observer = new MutationObserver(() => applyToolbarLabels());
  observer.observe(toolbar, { childList: true, subtree: true });
}

function injectProfessionalShellStyles() {
  if (document.getElementById('professionalUiShellStyles')) return;
  const style = document.createElement('style');
  style.id = 'professionalUiShellStyles';
  style.textContent = `
    body.professional-shell {
      --bg: #232832;
      --bar: #0f1724;
      --bar-2: #152238;
      --panel: #0d1522;
      --panel-2: #101d30;
      --panel-3: #07101c;
      --text: #f7fafc;
      --muted: #91a4ba;
      --accent: #57c7ff;
      --accent-2: #f0b35a;
      --border: #243850;
      --professional-line: rgba(132, 166, 205, .22);
      background: #232832;
    }

    body.professional-shell .viewer-topbar {
      min-height: 96px;
      display: grid;
      grid-template-columns: minmax(270px, 360px) 1fr;
      align-items: stretch;
      gap: 18px;
      padding: 12px 16px;
      background:
        linear-gradient(180deg, rgba(16, 24, 38, .98), rgba(10, 18, 31, .98)),
        radial-gradient(circle at 14% 0%, rgba(87, 199, 255, .18), transparent 38%);
      border-bottom: 1px solid rgba(117, 150, 190, .24);
      box-shadow: 0 12px 34px rgba(0, 0, 0, .32);
    }

    body.professional-shell .brand-block {
      min-width: 0;
      padding: 10px 16px 10px 12px;
      border-right: 1px solid rgba(132, 166, 205, .18);
      justify-content: center;
    }

    body.professional-shell .eyebrow {
      color: #7fb8e8;
      font-size: 10px;
      letter-spacing: 4px;
      opacity: .92;
    }

    body.professional-shell h1 {
      margin: 4px 0 4px;
      font-size: clamp(20px, 1.32vw, 26px);
      line-height: 1.05;
      letter-spacing: -.045em;
      color: #ffffff;
      text-shadow: 0 1px 0 rgba(0, 0, 0, .28);
    }

    body.professional-shell .brand-subtitle {
      max-width: 340px;
      color: #9fb2c8;
      font-size: 12px;
    }

    body.professional-shell .brand-meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 9px;
    }

    body.professional-shell .brand-chip {
      display: inline-flex;
      align-items: center;
      height: 20px;
      padding: 0 8px;
      border: 1px solid rgba(87, 199, 255, .34);
      border-radius: 999px;
      background: rgba(87, 199, 255, .10);
      color: #d7f2ff;
      font-size: 10px;
      font-weight: 850;
      letter-spacing: .35px;
      text-transform: uppercase;
    }

    body.professional-shell .brand-chip-muted {
      border-color: rgba(240, 179, 90, .30);
      background: rgba(240, 179, 90, .09);
      color: #ffe2ae;
    }

    body.professional-shell .toolbar.professional-ribbon {
      align-content: center;
      justify-content: flex-end;
      gap: 8px;
    }

    body.professional-shell .toolbar-group,
    body.professional-shell .color-control,
    body.professional-shell .status-pill {
      position: relative;
      min-height: 56px;
      padding: 20px 8px 7px;
      border: 1px solid rgba(117, 150, 190, .28);
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(22, 35, 54, .78), rgba(14, 25, 40, .72));
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, .045),
        0 8px 22px rgba(0, 0, 0, .18);
    }

    body.professional-shell .toolbar-group::before,
    body.professional-shell .color-control::before,
    body.professional-shell .status-pill::before {
      content: attr(data-group-label);
      position: absolute;
      top: 6px;
      left: 10px;
      color: #7890a9;
      font-size: 9px;
      font-weight: 950;
      letter-spacing: .9px;
      line-height: 1;
      text-transform: uppercase;
      pointer-events: none;
    }

    body.professional-shell .status-pill::before {
      content: attr(data-status-label);
    }

    body.professional-shell button,
    body.professional-shell .file-picker span {
      border-color: rgba(125, 160, 201, .32);
      background: linear-gradient(180deg, #1b304a, #14243a);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.06),
        0 1px 0 rgba(0,0,0,.2);
    }

    body.professional-shell .tool-btn {
      height: 30px;
      min-height: 30px;
      min-width: 42px;
      padding: 6px 10px;
      border-radius: 9px;
      color: #eef6ff;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .15px;
      text-transform: none;
    }

    body.professional-shell .tool-btn:hover {
      border-color: rgba(87, 199, 255, .72);
      background: linear-gradient(180deg, #254465, #18304c);
      transform: translateY(-1px);
    }

    body.professional-shell button.active,
    body.professional-shell button.tool-active,
    body.professional-shell .tool-btn.accent {
      border-color: rgba(240, 179, 90, .74);
      background: linear-gradient(180deg, #6b4d25, #47321e);
      color: #fff4d8;
    }

    body.professional-shell .tool-btn.accent:hover,
    body.professional-shell button.active:hover,
    body.professional-shell button.tool-active:hover {
      background: linear-gradient(180deg, #775728, #513a21);
      border-color: #f4c36d;
    }

    body.professional-shell .toolbar-group[aria-label='View tools'] .tool-btn:not(.accent) {
      min-width: 54px;
      color: #dbeafe;
    }

    body.professional-shell .toolbar-group[aria-label='Preview mode'] .tool-btn {
      min-width: 52px;
      border-color: rgba(240, 179, 90, .38);
      background: linear-gradient(180deg, rgba(77, 55, 29, .98), rgba(44, 33, 22, .98));
      color: #ffe5af;
    }

    body.professional-shell .toolbar-group[aria-label='Preview mode'] .tool-btn:disabled {
      opacity: .92;
      cursor: not-allowed;
    }

    body.professional-shell .lucide {
      width: 15px;
      height: 15px;
      stroke-width: 2.15;
    }

    body.professional-shell .color-control {
      display: grid;
      grid-template-columns: auto minmax(150px, 1fr);
      align-items: end;
      gap: 8px;
      height: auto;
      color: #e7f0fb;
    }

    body.professional-shell .color-control span {
      align-self: center;
      color: #d7e7f8;
      font-size: 11px;
    }

    body.professional-shell .color-control select {
      height: 30px;
      min-width: 154px;
      border: 1px solid rgba(125, 160, 201, .36);
      border-radius: 9px;
      background: #eef3f8;
      color: #071422;
      font-weight: 800;
    }

    body.professional-shell .status-pill {
      display: grid;
      place-items: end center;
      min-width: 108px;
      min-height: 56px;
      padding: 22px 12px 8px;
      color: #75e6a8;
      font-weight: 900;
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(11, 23, 36, .98), rgba(7, 15, 25, .98));
    }

    body.professional-shell .viewer-shell {
      height: calc(100vh - 96px);
    }

    body.professional-shell .viewer-stage {
      background:
        radial-gradient(circle at 44% 30%, rgba(65, 72, 86, .92) 0, rgba(45, 50, 61, .98) 48%, rgba(34, 38, 48, 1) 100%);
    }

    body.professional-shell .input-drawer,
    body.professional-shell .property-drawer {
      border-color: rgba(117, 150, 190, .28);
      border-radius: 16px;
      background: rgba(9, 17, 29, .965);
      box-shadow: 0 24px 70px rgba(0,0,0,.42);
    }

    body.professional-shell .viewer-statusbar {
      min-height: 32px;
      border-top-color: rgba(117, 150, 190, .20);
      background: rgba(6, 12, 21, .90);
      color: #bed1e5;
    }

    @media (max-width: 1540px) {
      body.professional-shell .viewer-topbar {
        grid-template-columns: minmax(225px, 300px) 1fr;
        gap: 10px;
        padding: 10px 12px;
      }
      body.professional-shell .brand-subtitle,
      body.professional-shell .brand-meta-row {
        display: none;
      }
      body.professional-shell .toolbar-group,
      body.professional-shell .color-control,
      body.professional-shell .status-pill {
        min-height: 52px;
        padding-top: 18px;
      }
      body.professional-shell .tool-btn {
        padding-left: 8px;
        padding-right: 8px;
      }
    }

    @media (max-width: 1080px) {
      body.professional-shell .viewer-topbar {
        grid-template-columns: 1fr;
        min-height: auto;
      }
      body.professional-shell .brand-block {
        border-right: 0;
        border-bottom: 1px solid rgba(132, 166, 205, .18);
      }
      body.professional-shell .toolbar.professional-ribbon {
        justify-content: flex-start;
      }
      body.professional-shell .viewer-shell {
        height: calc(100vh - 178px);
      }
    }
  `;
  document.head.appendChild(style);
}
