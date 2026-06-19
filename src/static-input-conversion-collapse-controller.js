// Static input drawer conversion collapse controller.
// CSS keeps Conversion collapsed before JS loads; this controller only owns toggle state.

const VERSION = 'static-input-conversion-collapse-20260619';

runWhenReady(initConversionCollapse);

function runWhenReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function initConversionCollapse() {
  const section = getConversionSection();
  if (!section) return;
  const heading = section.querySelector('h3');
  if (!heading || heading.dataset.boundConversionCollapse === '1') return;

  section.dataset.collapsible = 'conversion';
  heading.dataset.boundConversionCollapse = '1';
  heading.setAttribute('role', 'button');
  heading.setAttribute('tabindex', '0');
  heading.setAttribute('aria-controls', 'conversion-options-body');
  heading.setAttribute('aria-expanded', document.body.classList.contains('conversion-expanded') ? 'true' : 'false');

  const content = Array.from(section.children).filter((child) => child !== heading);
  content.forEach((child) => child.classList.add('conversion-collapsible-content'));

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
    toggle: toggleConversion
  };
}

function getConversionSection() {
  const drawer = document.getElementById('inputDrawer');
  if (!drawer) return null;
  const sections = Array.from(drawer.querySelectorAll(':scope > .panel-section'));
  return sections.find((section) => /\bConversion\b/i.test(section.querySelector('h3')?.textContent || '')) || sections[1] || null;
}

function toggleConversion() {
  setConversionExpanded(!document.body.classList.contains('conversion-expanded'));
}

function setConversionExpanded(open) {
  document.body.classList.toggle('conversion-expanded', Boolean(open));
  const heading = getConversionSection()?.querySelector('h3');
  heading?.setAttribute('aria-expanded', open ? 'true' : 'false');
  window.__3D_MARKUP_STATIC_SHELL_CORE__?.updateUiScore?.();
}
