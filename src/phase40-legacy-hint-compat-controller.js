// Phase 40: legacy canvas hint compatibility
// The core app still hides #hint after a model scene is attached. The current
// compact UI removed the old hint node, so recreate it as a hidden compatibility
// element to prevent null.style errors during conversion display.

ensureLegacyHintNode();
window.addEventListener('markup:app-ready', ensureLegacyHintNode, { once: true });

function ensureLegacyHintNode() {
  if (document.getElementById('hint')) return;

  const viewer = document.getElementById('viewer');
  const host = viewer || document.body;
  const hint = document.createElement('div');
  hint.id = 'hint';
  hint.hidden = true;
  hint.setAttribute('aria-hidden', 'true');
  hint.style.display = 'none';
  hint.textContent = '';
  host.appendChild(hint);
}
