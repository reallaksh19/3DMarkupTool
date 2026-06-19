// Static input drawer conversion/sideload collapse controller.
// Input is always open. Conversion and sideload settings are collapsed by explicit section markers,
// not by DOM position, because the workflow summary card is also a <section>.

const VERSION = 'phase4a-static-input-panel-cleanup-20260619';
const STYLE_ID = 'staticInputConversionCollapseStyles';

runWhenReady(initConversionCollapse);

function runWhenReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function initConversionCollapse() {
  injectCollapseStyles();
  ensureInputAlwaysExpanded();
  initConversionSection();
  initSideloadSection();

  window.__3D_MARKUP_CONVERSION_COLLAPSE__ = {
    version: VERSION,
    open: () => setSectionExpanded('conversion', true),
    close: () => setSectionExpanded('conversion', false),
    toggle: () => toggleSection('conversion'),
    openSideload: () => setSectionExpanded('sideload', true),
    closeSideload: () => setSectionExpanded('sideload', false),
    toggleSideload: () => toggleSection('sideload'),
    ensureInputAlwaysExpanded
  };
}

function initConversionSection() {
  const section = getConversionSection();
  if (!section) return;
  bindCollapsibleSection(section, 'conversion', 'conversion-options-body');
  setSectionExpanded('conversion', false);
}

function initSideloadSection() {
  const section = getSideloadSection();
  if (!section) return;
  bindCollapsibleSection(section, 'sideload', 'sideload-options-body');
  setSectionExpanded('sideload', false);
}

function bindCollapsibleSection(section, name, controlsId) {
  const heading = section.querySelector('h3');
  if (!heading) return;

  section.dataset.collapsible = name;
  section.dataset.section = name;
  heading.setAttribute('role', 'button');
  heading.setAttribute('tabindex', '0');
  heading.setAttribute('aria-controls', controlsId);

  Array.from(section.children).forEach((child) => {
    if (child !== heading) child.classList.add(`${name}-collapsible-content`);
  });

  if (heading.dataset.boundCollapseSection === name) return;
  heading.dataset.boundCollapseSection = name;
  heading.addEventListener('click', () => toggleSection(name));
  heading.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleSection(name);
    }
  });
}

function injectCollapseStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Input section is never an accordion target. This overrides older cached nth-of-type collapse CSS. */
    #inputDrawer .panel-section[data-section="input"] > h3::after {
      content: none !important;
      display: none !important;
    }

    #inputDrawer .panel-section[data-section="input"] > h3 {
      cursor: default !important;
    }

    #inputDrawer .panel-section[data-section="input"] > .file-drop {
      display: grid !important;
    }

    #inputDrawer .panel-section[data-section="input"] > .button-row {
      display: flex !important;
    }

    #inputDrawer .panel-section[data-collapsible] > h3 {
      cursor: pointer !important;
      user-select: none !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      min-height: 26px !important;
      margin-bottom: 0 !important;
    }

    #inputDrawer .panel-section[data-collapsible] > h3::after {
      content: '▸' !important;
      margin-left: auto !important;
      color: rgba(159, 179, 204, .9) !important;
      font-size: 12px !important;
    }

    body.conversion-expanded #inputDrawer .panel-section[data-collapsible="conversion"] > h3::after,
    body.sideload-expanded #inputDrawer .panel-section[data-collapsible="sideload"] > h3::after {
      content: '▾' !important;
    }

    body:not(.conversion-expanded) #inputDrawer .panel-section[data-collapsible="conversion"] > .conversion-collapsible-content,
    body:not(.sideload-expanded) #inputDrawer .panel-section[data-collapsible="sideload"] > .sideload-collapsible-content {
      display: none !important;
    }

    #inputDrawer .panel-section[data-collapsible="sideload"] {
      padding-top: 12px !important;
      padding-bottom: 12px !important;
    }
  `;
  document.head.appendChild(style);
}

function ensureInputAlwaysExpanded() {
  const section = getInputSection();
  if (!section) return;
  section.dataset.section = 'input';
  if (section.dataset.collapsible) delete section.dataset.collapsible;

  const heading = section.querySelector('h3');
  heading?.removeAttribute('role');
  heading?.removeAttribute('tabindex');
  heading?.removeAttribute('aria-controls');
  heading?.removeAttribute('aria-expanded');
  delete heading?.dataset.boundCollapseSection;
  delete heading?.dataset.boundConversionCollapse;

  Array.from(section.children).forEach((child) => {
    if (child !== heading) {
      child.classList.remove('conversion-collapsible-content');
      child.classList.remove('sideload-collapsible-content');
    }
  });
}

function getInputSection() {
  const drawer = document.getElementById('inputDrawer');
  if (!drawer) return null;
  return Array.from(drawer.querySelectorAll(':scope > .panel-section')).find((section) => /\bInput\b/i.test(section.querySelector('h3')?.textContent || '')) || null;
}

function getConversionSection() {
  const drawer = document.getElementById('inputDrawer');
  if (!drawer) return null;
  return Array.from(drawer.querySelectorAll(':scope > .panel-section')).find((section) => /\bConversion\b/i.test(section.querySelector('h3')?.textContent || '')) || null;
}

function getSideloadSection() {
  const drawer = document.getElementById('inputDrawer');
  if (!drawer) return null;
  return Array.from(drawer.querySelectorAll(':scope > .panel-section')).find((section) => /\bSideload Data\b/i.test(section.querySelector('h3')?.textContent || '')) || null;
}

function toggleSection(name) {
  setSectionExpanded(name, !document.body.classList.contains(`${name}-expanded`));
}

function setSectionExpanded(name, open) {
  document.body.classList.toggle(`${name}-expanded`, Boolean(open));
  ensureInputAlwaysExpanded();
  const section = name === 'conversion' ? getConversionSection() : getSideloadSection();
  const heading = section?.querySelector('h3');
  heading?.setAttribute('aria-expanded', open ? 'true' : 'false');
  window.__3D_MARKUP_STATIC_SHELL_CORE__?.updateUiScore?.();
}
