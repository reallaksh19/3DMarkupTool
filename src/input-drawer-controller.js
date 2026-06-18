// Single owner for the left Input / Export drawer runtime state.
// Opens the drawer once on startup, then respects user close/reopen actions.

const drawer = document.getElementById('inputDrawer');
const toggleButton = document.getElementById('toggleInputBtn');
const closeButton = document.getElementById('closeInputBtn');

let userTouchedDrawer = false;

initInputDrawer();

function initInputDrawer() {
  if (!drawer) return;

  drawer.classList.add('input-drawer');
  drawer.classList.remove('force-visible', 'always-open');
  drawer.style.removeProperty('display');
  drawer.style.removeProperty('visibility');
  drawer.style.removeProperty('transform');
  drawer.style.removeProperty('opacity');
  drawer.style.removeProperty('pointer-events');

  if (!userTouchedDrawer && !document.body.classList.contains('input-open')) {
    setOpen(true, { initial: true });
  } else {
    syncButton();
  }

  toggleButton?.addEventListener('click', () => {
    userTouchedDrawer = true;
    setOpen(!document.body.classList.contains('input-open'));
  });

  closeButton?.addEventListener('click', () => {
    userTouchedDrawer = true;
    setOpen(false);
  });

  window.__3D_MARKUP_INPUT_DRAWER__ = {
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!document.body.classList.contains('input-open')),
    isOpen: () => document.body.classList.contains('input-open')
  };
}

function setOpen(open, options = {}) {
  document.body.classList.toggle('input-open', Boolean(open));
  drawer?.classList.toggle('open', Boolean(open));
  if (open) drawer?.scrollTo?.({ top: 0, behavior: options.initial ? 'auto' : 'smooth' });
  syncButton();
  window.dispatchEvent(new CustomEvent('markup:input-drawer-changed', { detail: { open: Boolean(open) } }));
}

function syncButton() {
  toggleButton?.classList.toggle('active', document.body.classList.contains('input-open'));
}
