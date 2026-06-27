// Static input drawer conversion/sideload collapse controller.
// Input is always open. Conversion and sideload settings are collapsed by explicit section markers,
// not by DOM position, because the workflow summary card is also a <section>.
// Layout and default collapsed state are owned by static HTML/CSS to avoid startup layout shifts.
//
// CSS contract â€” rules live in static-shell-performance.css, listed here to document the coupling:
//
//   #inputDrawer [data-section="input"] > .file-drop { display: grid !important; }
//
//   body:not(.conversion-expanded) #inputDrawer [data-collapsible="conversion"] > .conversion-collapsible-content
//     { display: none !important; }
//
//   body:not(.sideload-expanded) #inputDrawer [data-collapsible="sideload"] > .sideload-collapsible-content
//     { display: none !important; }

const VERSION = 'perf-static-shell-20260620';

runWhenReady(initConversionCollapse);

function runWhenReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function initConversionCollapse() {
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
    ensureInputAlwaysExpanded,
    layoutOwner: 'static-css'
  };
}

function initConversionSection() {
  const section = getConversionSection();
  if (!section) return;
  bindCollapsibleSection(section, 'conversion', 'conversion-options-body');
  setSectionExpanded('conversion', false);
}

function initSideloadSection() {
  document.body.classList.remove('sideload-expanded');
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
  section.dataset.layoutOwner = 'static-css';
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

function ensureInputAlwaysExpanded() {
  const section = getInputSection();
  if (!section) return;
  section.dataset.section = 'input';
  section.dataset.layoutOwner = 'static-css';
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
