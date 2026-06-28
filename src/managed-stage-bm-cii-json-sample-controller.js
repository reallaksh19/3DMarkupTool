/**
 * BM_CII managed-stage JSON sample controller.
 *
 * Wires the "Load BM_CII stagedJson" button to the bundled BM_CII
 * benchmark data module. This avoids fetching /src/*.json from GitHub Pages,
 * where the standalone JSON file may not exist in deployed builds.
 */

import {
  BM_CII_MANAGED_STAGE_SAMPLE_NAME,
  createBmCiiManagedStageSampleJson
} from './managed-stage-bm-cii-json-sample-data.js?v=bust-cache-4';

const SAMPLE_CONTROLLER_SCHEMA = 'ManagedStageBmCiiJsonSampleController.v6';
const SAMPLE_SOURCE_NAME = BM_CII_MANAGED_STAGE_SAMPLE_NAME;

installManagedStageBmCiiJsonSampleButton();

export function installManagedStageBmCiiJsonSampleButton() {
  if (window.__3D_MARKUP_MANAGED_STAGE_BM_CII_JSON_SAMPLE__?.schema === SAMPLE_CONTROLLER_SCHEMA) {
    return window.__3D_MARKUP_MANAGED_STAGE_BM_CII_JSON_SAMPLE__;
  }

  const sampleButton = ensureSampleButton();
  delete sampleButton.dataset.managedStageJsonSampleBound;
  sampleButton.dataset.managedStageJsonSampleBound = '1';
  sampleButton.addEventListener('click', (event) => {
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    loadBenchmarkJson().catch((error) => {
      log(`ERROR loading ${SAMPLE_SOURCE_NAME}: ${error.message}`);
      setStatus('BM_CII benchmark load failed');
    });
  }, true);

  const api = {
    schema: SAMPLE_CONTROLLER_SCHEMA,
    sampleSourceName: SAMPLE_SOURCE_NAME,
    loadSample: loadBenchmarkJson
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
    const label = primary.querySelector('span');
    if (label) label.textContent = 'Load BM_CII stagedJson';
    if (!primary.querySelector('i') && !primary.querySelector('svg')) {
      const icon = document.createElement('i');
      icon.setAttribute('data-lucide', 'folder-open');
      primary.prepend(icon);
    }
    primary.dataset.managedStageJsonSampleButton = 'true';
    primary.dataset.sourceOwner = primary.dataset.sourceOwner || 'index-html';
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

async function loadBenchmarkJson() {
  const managedStageApi = await ensureManagedStageJsonApi();
  if (typeof managedStageApi?.loadText !== 'function') {
    throw new Error('managed-stage JSON UI is not ready');
  }

  setStatus('Loading bundled BM_CII benchmark...');
  const sourceText = createBmCiiManagedStageSampleJson();
  log(`Loaded bundled ${SAMPLE_SOURCE_NAME} (${sourceText.length.toLocaleString()} chars) - 40 components, 7 elbows, 12 supports`);
  setStatus('Loaded BM_CII benchmark - rendering...');
  return managedStageApi.loadText(sourceText, SAMPLE_SOURCE_NAME);
}

async function ensureManagedStageJsonApi() {
  if (typeof window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__?.loadText === 'function') {
    return window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__;
  }
  const module = await import('./managed-stage-json-ui-controller.js?v=bust-cache-4');
  if (typeof module.installManagedStageJsonUi === 'function') return module.installManagedStageJsonUi();
  return window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__;
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
