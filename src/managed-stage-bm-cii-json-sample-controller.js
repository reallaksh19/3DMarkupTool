import './managed-stage-viewer-api-bridge.js';
import { BM_CII_MANAGED_STAGE_SAMPLE_NAME, createBmCiiManagedStageSampleJson } from './managed-stage-bm-cii-json-sample-data.js';

const SAMPLE_CONTROLLER_SCHEMA = 'ManagedStageBmCiiJsonSampleController.v1';
const SAMPLE_SOURCE_NAME = BM_CII_MANAGED_STAGE_SAMPLE_NAME;

installManagedStageBmCiiJsonSampleButton();

export function installManagedStageBmCiiJsonSampleButton() {
  if (window.__3D_MARKUP_MANAGED_STAGE_BM_CII_JSON_SAMPLE__?.schema === SAMPLE_CONTROLLER_SCHEMA) {
    return window.__3D_MARKUP_MANAGED_STAGE_BM_CII_JSON_SAMPLE__;
  }

  const sampleButton = ensureSampleButton();
  sampleButton.addEventListener('click', () => {
    loadBundledManagedStageJsonSample().catch((error) => {
      log(`ERROR loading ${SAMPLE_SOURCE_NAME}: ${error.message}`);
      setStatus('BM_CII JSON sample load failed');
    });
  });

  const api = {
    schema: SAMPLE_CONTROLLER_SCHEMA,
    sampleSourceName: SAMPLE_SOURCE_NAME,
    loadSample: loadBundledManagedStageJsonSample
  };
  window.__3D_MARKUP_MANAGED_STAGE_BM_CII_JSON_SAMPLE__ = api;
  window.dispatchEvent(new CustomEvent('viewer:managed-stage-bm-cii-json-sample-ready', {
    detail: { schema: SAMPLE_CONTROLLER_SCHEMA, sampleSourceName: SAMPLE_SOURCE_NAME }
  }));
  return api;
}

function ensureSampleButton() {
  const existing = document.getElementById('loadManagedStageJsonSampleBtn');
  if (existing) return existing;

  const host = document.querySelector('.input-primary-actions');
  if (!host) throw new Error('BM_CII JSON sample button cannot find .input-primary-actions');

  const button = document.createElement('button');
  button.id = 'loadManagedStageJsonSampleBtn';
  button.type = 'button';
  button.className = 'ghost icon-text managed-stage-json-sample-btn';
  button.title = 'Load bundled BM_CII_INPUT_managed_stage.json sample';
  button.setAttribute('aria-label', 'Load BM_CII JSON sample');
  button.innerHTML = '<span class="managed-stage-json-icon" aria-hidden="true">{ }</span><span>Load BM_CII JSON sample</span>';

  const xmlSampleButton = document.getElementById('loadSampleBtn');
  if (xmlSampleButton?.nextSibling) host.insertBefore(button, xmlSampleButton.nextSibling);
  else host.appendChild(button);
  return button;
}

async function loadBundledManagedStageJsonSample() {
  const managedStageApi = window.__3D_MARKUP_MANAGED_STAGE_JSON_UI__;
  if (typeof managedStageApi?.loadText !== 'function') {
    throw new Error('managed-stage JSON UI is not ready');
  }

  setStatus('Loading BM_CII JSON sample');
  const sourceText = createBmCiiManagedStageSampleJson();
  log(`Loaded bundled ${SAMPLE_SOURCE_NAME} (${sourceText.length.toLocaleString()} chars)`);
  return managedStageApi.loadText(sourceText, SAMPLE_SOURCE_NAME);
}

function setStatus(message) {
  const status = document.getElementById('runtimeStatus');
  if (status) status.textContent = message;
}

function log(message) {
  const target = document.getElementById('log');
  if (!target) return;
  const ts = new Date().toLocaleTimeString();
  target.textContent += `[${ts}] ${message}\n`;
  target.scrollTop = target.scrollHeight;
}
