export const SUPPORT_DEFAULT_ISONOTE_SAMPLE_SCHEMA = 'SupportDefaultIsonoteSampleController.v1';

export const DEFAULT_SUPPORT_ISONOTE_SAMPLE_TEXT = `NODE,ISONOTE
35,:/PS-123 :ISONOTE 'REST(28kN), GUIDE(6kN),LINE STOP(15kN)'
130,:ISONOTE 'REST NOT DEFINED, SINGLE AXIS Z'
255,:ISONOTE 'REST(3kN), GUIDE(1kN)'
205,:/PS-456 :ISONOTE 'REST(10kN), HOLDDOWN,LINE STOP(6kN), Holddown without Guide Can Spring'`;

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', installSupportDefaultIsonoteSampleController, { once: true });
} else {
  installSupportDefaultIsonoteSampleController();
}

export function installSupportDefaultIsonoteSampleController() {
  if (window.__3D_MARKUP_SUPPORT_DEFAULT_ISONOTE_SAMPLE__?.schema === SUPPORT_DEFAULT_ISONOTE_SAMPLE_SCHEMA) return window.__3D_MARKUP_SUPPORT_DEFAULT_ISONOTE_SAMPLE__;
  const api = { schema: SUPPORT_DEFAULT_ISONOTE_SAMPLE_SCHEMA, sampleText: DEFAULT_SUPPORT_ISONOTE_SAMPLE_TEXT, apply: applyDefaultIsonoteSampleIfEmpty };
  window.__3D_MARKUP_SUPPORT_DEFAULT_ISONOTE_SAMPLE__ = api;
  applyDefaultIsonoteSampleIfEmpty('install');
  observeWorkbench();
  window.addEventListener('viewer:managed-stage-json-loaded', () => setTimeout(() => applyDefaultIsonoteSampleIfEmpty('managed-stage-loaded'), 0));
  window.addEventListener('managed-stage:support-source-ui-ready', () => setTimeout(() => applyDefaultIsonoteSampleIfEmpty('support-source-ui-ready'), 0));
  return api;
}

function observeWorkbench() {
  const timer = setInterval(() => {
    const textarea = document.getElementById('smwIsonoteText');
    if (textarea) applyDefaultIsonoteSampleIfEmpty('workbench-textarea');
  }, 500);
  setTimeout(() => clearInterval(timer), 15000);
}

function applyDefaultIsonoteSampleIfEmpty(source = 'apply') {
  const hidden = document.getElementById('isonoteText');
  const popup = document.getElementById('smwIsonoteText');
  const current = String(popup?.value || hidden?.value || '').trim();
  if (current) return false;
  if (hidden) {
    hidden.value = DEFAULT_SUPPORT_ISONOTE_SAMPLE_TEXT;
    hidden.dispatchEvent(new Event('input', { bubbles: true }));
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (popup) {
    popup.value = DEFAULT_SUPPORT_ISONOTE_SAMPLE_TEXT;
    popup.dispatchEvent(new Event('input', { bubbles: true }));
  }
  window.__3D_MARKUP_SUPPORT_DEFAULT_ISONOTE_SAMPLE_LAST__ = { schema: SUPPORT_DEFAULT_ISONOTE_SAMPLE_SCHEMA, source, at: new Date().toISOString() };
  return true;
}
