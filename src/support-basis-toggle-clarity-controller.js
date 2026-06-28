const SUPPORT_BASIS_TOGGLE_SCHEMA = 'SupportBasisToggleClarityController.v1';

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', installSupportBasisToggleClarity, { once: true });
} else {
  installSupportBasisToggleClarity();
}

export function installSupportBasisToggleClarity() {
  if (window.__3D_MARKUP_SUPPORT_BASIS_TOGGLE_CLARITY__?.schema === SUPPORT_BASIS_TOGGLE_SCHEMA) return window.__3D_MARKUP_SUPPORT_BASIS_TOGGLE_CLARITY__;
  const api = { schema: SUPPORT_BASIS_TOGGLE_SCHEMA, apply: applySupportBasisToggleClarity };
  window.__3D_MARKUP_SUPPORT_BASIS_TOGGLE_CLARITY__ = api;
  applySupportBasisToggleClarity('install');
  window.addEventListener('markup:app-ready', () => applySupportBasisToggleClarity('app-ready'));
  window.addEventListener('viewer:managed-stage-json-loaded', () => applySupportBasisToggleClarity('managed-stage-loaded'));
  window.addEventListener('change', (event) => {
    if (event.target?.id === 'supportMode') applySupportBasisToggleClarity('support-mode-change');
  }, true);
  return api;
}

export function applySupportBasisToggleClarity(reason = 'manual') {
  const select = document.getElementById('supportMode') || document.querySelector('[name="supportMode"]');
  if (!select) return false;

  const labelMap = new Map([
    ['off', 'Off — do not render support overlay'],
    ['none', 'Off — do not render support overlay'],
    ['disabled', 'Off — do not render support overlay'],
    ['stagedJson', 'InputXML Basis — use staged InputXML supports'],
    ['stagedjson', 'InputXML Basis — use staged InputXML supports'],
    ['inputxml', 'InputXML Basis — use staged InputXML supports'],
    ['isonote', 'ISONOTE Basis — use uploaded/sideloaded ISONOTE supports'],
    ['iso_note', 'ISONOTE Basis — use uploaded/sideloaded ISONOTE supports'],
    ['iso-note', 'ISONOTE Basis — use uploaded/sideloaded ISONOTE supports'],
    ['note', 'ISONOTE Basis — use uploaded/sideloaded ISONOTE supports']
  ]);

  for (const option of Array.from(select.options || [])) {
    const key = String(option.value || option.textContent || '').trim();
    const normalized = key.toLowerCase();
    const label = labelMap.get(key) || labelMap.get(normalized);
    if (label) option.textContent = label;
  }

  select.title = 'Choose one exclusive support basis. InputXML and ISONOTE supports are normalized internally through the same mapper, but only one basis is rendered at a time.';
  select.setAttribute('aria-label', 'Support Basis: InputXML Basis or ISONOTE Basis');

  const model = window.__3D_MARKUP_SUPPORT_SOURCE_UI__;
  if (model && typeof model === 'object') {
    model.sourceOptions = Array.isArray(model.sourceOptions) ? model.sourceOptions.map((entry) => ({
      ...entry,
      label: labelMap.get(String(entry.value || '').trim()) || labelMap.get(String(entry.value || '').trim().toLowerCase()) || entry.label
    })) : model.sourceOptions;
    model.supportBasisToggle = {
      schema: SUPPORT_BASIS_TOGGLE_SCHEMA,
      exclusiveBasis: true,
      inputXmlBasisLabel: 'InputXML Basis — use staged InputXML supports',
      isonoteBasisLabel: 'ISONOTE Basis — use uploaded/sideloaded ISONOTE supports',
      normalizedBySameModules: true,
      lastAppliedReason: reason
    };
  }

  const summary = document.getElementById('supportMapperSummary') || document.querySelector('[data-support-mapper-summary]');
  if (summary) {
    const active = activeBasisLabel(select.value);
    summary.textContent = `${active}; InputXML and ISONOTE are mutually exclusive render bases and are normalized internally by the same support mapper.`;
  }

  return true;
}

function activeBasisLabel(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('isonote') || text.includes('note')) return 'ISONOTE Basis active';
  if (text.includes('off') || text.includes('none') || text.includes('disabled')) return 'Support rendering off';
  return 'InputXML Basis active';
}
