const STORAGE_KEYS = Object.freeze({
  overlay: 'supportOverlay.nonPrimitive.enabled',
  labels: 'supportOverlay.nonPrimitive.labels',
  scale: 'supportOverlay.nonPrimitive.scale',
  autoBend: 'supportOverlay.nonPrimitive.autoBend',
});

function readBool(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    if (value === 'on' || value === 'true') return true;
    if (value === 'off' || value === 'false') return false;
  } catch {}
  return fallback;
}

function readScale() {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEYS.scale));
    if (Number.isFinite(value)) return Math.max(Math.min(value, 1.5), 0.25);
  } catch {}
  return 0.75;
}

function ensureHiddenInput(id, value) {
  let input = document.getElementById(id);
  if (!input) {
    input = document.createElement('input');
    input.type = 'hidden';
    input.id = id;
    input.setAttribute('data-nonprimitive-support-overlay-control', 'true');
    document.body.appendChild(input);
  }
  input.value = String(value);
  return input;
}

function ensureToggleButton(id, pressed) {
  let button = document.getElementById(id);
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.id = id;
    button.hidden = true;
    button.setAttribute('data-nonprimitive-support-overlay-control', 'true');
    document.body.appendChild(button);
  }
  button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  return button;
}

function ensureCheckbox(id, checked) {
  let input = document.getElementById(id);
  if (!input) {
    input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.hidden = true;
    input.setAttribute('data-nonprimitive-support-overlay-control', 'true');
    document.body.appendChild(input);
  }
  input.checked = Boolean(checked);
  return input;
}

export function installInputXmlSupportGraphicsUiBridge() {
  const overlay = readBool(STORAGE_KEYS.overlay, false);
  const labels = readBool(STORAGE_KEYS.labels, false);
  const autoBend = readBool(STORAGE_KEYS.autoBend, true);
  const scale = readScale();

  ensureHiddenInput('rvm-support-scale', scale);
  ensureToggleButton('rvm-support-labels', labels);
  ensureCheckbox('rvm-inputxml-auto-bend', autoBend);

  window.__inputXmlSupportGraphicsUiBridge = {
    schema: 'InputXmlSupportGraphicsUiBridge.v1',
    overlayDefaultEnabled: overlay,
    labelsDefaultEnabled: labels,
    autoBendDefaultEnabled: autoBend,
    scale,
    policy: 'controls are hidden compatibility shims only; visible support overlay UI belongs to non-primitive managed-stage source preview, not native RVM/GLB viewer',
  };
  return window.__inputXmlSupportGraphicsUiBridge;
}

installInputXmlSupportGraphicsUiBridge();
