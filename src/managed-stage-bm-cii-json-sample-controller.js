import './managed-stage-viewer-api-bridge.js';
import { BM_CII_MANAGED_STAGE_SAMPLE_NAME, createBmCiiManagedStageSampleJson } from './managed-stage-bm-cii-json-sample-data.js';

const SAMPLE_CONTROLLER_SCHEMA = 'ManagedStageBmCiiJsonSampleController.v2';
const SAMPLE_SOURCE_NAME = BM_CII_MANAGED_STAGE_SAMPLE_NAME;

installManagedStageBmCiiJsonSampleButton();

export function installManagedStageBmCiiJsonSampleButton() {
  if (window.__3D_MARKUP_MANAGED_STAGE_BM_CII_JSON_SAMPLE__?.schema === SAMPLE_CONTROLLER_SCHEMA) {
    return window.__3D_MARKUP_MANAGED_STAGE_BM_CII_JSON_SAMPLE__;
  }

  const sampleButton = ensureSampleButton();
  sampleButton.addEventListener('click', (event) => {
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    loadBundledManagedStageJsonSample().catch((error) => {
      log(`ERROR loading ${SAMPLE_SOURCE_NAME}: ${error.message}`);
      setStatus('BM_CII stagedJson sample load failed');
    });
  }, true);

  const api = {
    schema: SAMPLE_CONTROLLER_SCHEMA,
    sampleSourceName: SAMPLE_SOURCE_NAME,
    loadSample: loadBundledManagedStageJsonSample
  };
  window.__3D_MARKUP_MANAGED_STAGE_BM_CII_JSON_SAMPLE__ = api;
  window.dispatchEvent(new CustomEvent('viewer:managed-stage-bm-cii-json-sample-ready', {
    detail: { schema: SAMPLE_CONTROLLER_SCHEMA, sampleSourceName: SAMPLE_SOURCE_NAME }
  }));
  hydrateIcons();
  return api;
}

function ensureSampleButton() {
  const primary = document.getElementById('loadSampleBtn');
  if (primary) {
    primary.title = 'Load bundled BM_CII_INPUT_managed_stage.json stagedJson sample';
    primary.setAttribute('aria-label', 'Load BM_CII stagedJson sample');
    primary.innerHTML = '<i data-lucide="folder-open"></i><span>Load BM_CII stagedJson</span>';
    primary.dataset.managedStageJsonSampleButton = 'true';
    return primary;
  }

  const existing = document.getElementById('loadManagedStageJsonSampleBtn');
  if (existing) return existing;

  const host = document.querySelector('.input-primary-actions');
  if (!host) throw new Error('BM_CII JSON sample button cannot find .input-primary-actions');

  const button = document.createElement('button');
  button.id = 'loadManagedStageJsonSampleBtn';
  button.type = 'button';
  button.className = 'primary icon-text managed-stage-json-sample-btn';
  button.title = 'Load bundled BM_CII_INPUT_managed_stage.json stagedJson sample';
  button.setAttribute('aria-label', 'Load BM_CII stagedJson sample');
  button.innerHTML = '<i data-lucide="folder-open"></i><span>Load BM_CII stagedJson</span>';
  host.prepend(button);
  return button;
}

async function loadBundledManagedStageJsonSample() {
  const managedStageApi = window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__;
  if (typeof managedStageApi?.loadText !== 'function') {
    throw new Error('managed-stage JSON UI is not ready');
  }

  setStatus('Loading BM_CII stagedJson sample');
  const sourceText = createBmCiiManagedStageSampleJson();
  log(`Loaded bundled ${SAMPLE_SOURCE_NAME} (${sourceText.length.toLocaleString()} chars)`);
  return managedStageApi.loadText(sourceText, SAMPLE_SOURCE_NAME);
}

function setStatus(message) {
  const status = document.getElementById('runtimeStatus') || document.getElementById('conversionStatus');
  if (status) status.textContent = message;
}

function log(message) {
  const target = document.getElementById('log');
  if (!target) return;
  const ts = new Date().toLocaleTimeString();
  target.textContent += `[${ts}] ${message}\n`;
  target.scrollTop = target.scrollHeight;
}

function hydrateIcons() {
  try {
    if (window.lucide?.createIcons) window.lucide.createIcons();
  } catch (_) {
    /* icons are optional in the static shell */
  }
}
