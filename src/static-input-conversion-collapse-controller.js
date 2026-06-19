// Static input drawer conversion collapse controller.
// Input is always open. Conversion settings are collapsed by explicit section marker,
// not by DOM position, because the workflow summary card is also a <section>.

const VERSION = 'static-input-conversion-collapse-input-always-open-20260619';
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

  const section = getConversionSection();
  if (!section) return;
  const heading = section.querySelector('h3');
  if (!heading || heading.dataset.boundConversionCollapse === '1') return;

  section.dataset.collapsible = 'conversion';
  section.dataset.section = 'conversion';
  heading.dataset.boundConversionCollapse = '1';
  heading.setAttribute('role', 'button');
  heading.setAttribute('tabindex', '0');
  heading.setAttribute('aria-controls', 'conversion-options-body');

  const content = Array.from(section.children).filter((child) => child !== heading);
  content.forEach((child) => child.classList.add('conversion-collapsible-content'));
  setConversionExpanded(false);

  heading.addEventListener('click', toggleConversion);
  heading.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleConversion();
    }
  });

  window.__3D_MARKUP_CONVERSION_COLLAPSE__ = {
    version: VERSION,
    open: () => setConversionExpanded(true),
    close: () => setConversionExpanded(false),
    toggle: toggleConversion,
    ensureInputAlwaysExpanded
  };
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

    #inputDrawer .panel-section[data-collapsible="conversion"] > h3 {
      cursor: pointer !important;
      user-select: none !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
    }

    #inputDrawer .panel-section[data-collapsible="conversion"] > h3::after {
      content: '▸' !important;
      margin-left: auto !important;
      color: rgba(159, 179, 204, .9) !important;
      font-size: 12px !important;
    }

    body.conversion-expanded #inputDrawer .panel-section[data-collapsible="conversion"] > h3::after {
      content: '▾' !important;
    }

    body:not(.conversion-expanded) #inputDrawer .panel-section[data-collapsible="conversion"] > .conversion-collapsible-content {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

function ensureInputAlwaysExpanded() {
  const section = getInputSection();
  if (!section) return;
  section.dataset.section = 'input';
  if (section.dataset.collapsible === 'conversion') delete section.dataset.collapsible;

  const heading = section.querySelector('h3');
  heading?.removeAttribute('role');
  heading?.removeAttribute('tabindex');
  heading?.removeAttribute('aria-controls');
  heading?.removeAttribute('aria-expanded');
  delete heading?.dataset.boundConversionCollapse;

  Array.from(section.children).forEach((child) => {
    if (child !== heading) child.classList.remove('conversion-collapsible-content');
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

function toggleConversion() {
  setConversionExpanded(!document.body.classList.contains('conversion-expanded'));
}

function setConversionExpanded(open) {
  document.body.classList.toggle('conversion-expanded', Boolean(open));
  ensureInputAlwaysExpanded();
  const heading = getConversionSection()?.querySelector('h3');
  heading?.setAttribute('aria-expanded', open ? 'true' : 'false');
  window.__3D_MARKUP_STATIC_SHELL_CORE__?.updateUiScore?.();
}
