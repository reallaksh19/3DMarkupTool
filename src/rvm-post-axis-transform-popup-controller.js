import {
  DEFAULT_RVM_POST_AXIS_TRANSFORM_CONFIG,
  RVM_POST_AXIS_TRANSFORM_PRESETS,
  RVM_POST_AXIS_TRANSFORM_SCHEMA,
  matrixSummary,
  resolveRvmPostAxisTransformConfig
} from './rvm-post-axis-transform.js?v=bust-cache-4';

const POPUP_SCHEMA = 'RvmPostAxisTransformPopupController.v2';
const STORAGE_KEY = 'managedStage.rvmPostAxisTransform.v1';
const DEFAULT_PRESET_ID = 'canvasEngineeringToNavis';

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', installRvmPostAxisTransformPopupController, { once: true });
} else {
  installRvmPostAxisTransformPopupController();
}

export function installRvmPostAxisTransformPopupController({ win = globalThis.window, doc = globalThis.document } = {}) {
  if (!win || !doc) return null;
  if (win.__3D_MARKUP_RVM_POST_AXIS_TRANSFORM_POPUP__?.schema === POPUP_SCHEMA) return win.__3D_MARKUP_RVM_POST_AXIS_TRANSFORM_POPUP__;
  const api = { schema: POPUP_SCHEMA, storageKey: STORAGE_KEY, getConfig: () => getActiveConfig(win), open: () => openDialog(win, doc), save: (config) => saveConfig(win, config) };
  win.__3D_MARKUP_RVM_POST_AXIS_TRANSFORM_POPUP__ = api;
  win.__3D_MARKUP_RVM_POST_AXIS_TRANSFORM_CONFIG__ = getActiveConfig(win);
  renderLauncher(win, doc);
  for (const eventName of ['markup:safe-ui-status', 'managed-stage:support-source-ui-ready', 'viewer:managed-stage-json-loaded']) {
    win.addEventListener?.(eventName, () => setTimeout(() => renderLauncher(win, doc), 0));
  }
  return api;
}

function renderLauncher(win, doc) {
  const host = doc.getElementById('supportMappingSettingsShell') || doc.querySelector('.topbar-actions') || doc.body;
  if (!host || doc.getElementById('rvmPostAxisTransformBtn')) return false;
  const button = doc.createElement('button');
  button.id = 'rvmPostAxisTransformBtn';
  button.type = 'button';
  button.className = 'ghost rvm-post-axis-transform-btn';
  button.textContent = 'RVM Navis Transform';
  button.title = 'Configure post-RVM full-geometry Navis axis transform';
  button.addEventListener('click', () => openDialog(win, doc));
  host.appendChild(button);
  injectStyles(doc);
  return true;
}

function openDialog(win, doc) {
  const dialog = ensureDialog(win, doc);
  renderDialog(win, doc, dialog);
  if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.hidden = false;
}

function ensureDialog(win, doc) {
  let dialog = doc.getElementById('rvmPostAxisTransformDialog');
  if (dialog) return dialog;
  dialog = doc.createElement('dialog');
  dialog.id = 'rvmPostAxisTransformDialog';
  dialog.className = 'rvm-post-axis-transform-dialog';
  dialog.setAttribute('aria-label', 'RVM Navis axis transform');
  doc.body.appendChild(dialog);
  injectStyles(doc);
  return dialog;
}

function renderDialog(win, doc, dialog) {
  const config = getActiveConfig(win);
  const presetRows = Object.values(RVM_POST_AXIS_TRANSFORM_PRESETS).map((preset) => ({ ...preset, selected: preset.id === config.presetId }));
  const selectedPreset = RVM_POST_AXIS_TRANSFORM_PRESETS[config.presetId] || RVM_POST_AXIS_TRANSFORM_PRESETS[DEFAULT_PRESET_ID];
  dialog.innerHTML = `<form method="dialog" class="rvm-post-axis-transform-card"><div class="rvm-post-axis-transform-head"><div><h3>RVM Navis Axis Transform</h3><p>Applied after the complete RVM export model is generated and before writeRvm()/ATT/preview consume it.</p></div><button type="submit" class="icon-btn" aria-label="Close">×</button></div><label class="rvm-post-axis-transform-enable"><input id="rvmPostAxisTransformEnabled" type="checkbox" ${config.enabled ? 'checked' : ''}> Enable post-RVM full-geometry transform</label><label class="field"><span>Preset</span><select id="rvmPostAxisTransformPreset">${presetRows.map((preset) => `<option value="${escapeHtml(preset.id)}" ${preset.selected ? 'selected' : ''}>${escapeHtml(preset.label)}</option>`).join('')}</select></label><div class="rvm-post-axis-transform-proof"><h4>Observed mapping retained</h4><table><tbody><tr><th>Navis N</th><td>Canvas +Y</td></tr><tr><th>Navis Top</th><td>Canvas +Z</td></tr><tr><th>Navis W</th><td>Canvas -X</td></tr></tbody></table><h4>Applied model-stage transform</h4><p><strong>Scope:</strong> entire export model: pipe/fittings/valves/flanges/supports, primitive centers, endpoint-locked start/end, basis vectors, CNTB positions, ATT attributes, preview model.</p><p><strong>Stage:</strong> post-export-model / pre-writeRvm.</p><p><strong>Matrix:</strong> <code id="rvmPostAxisTransformMatrixSummary">${escapeHtml(matrixSummary(selectedPreset.matrix))}</code></p><p><strong>Description:</strong> <span id="rvmPostAxisTransformDescription">${escapeHtml(selectedPreset.description)}</span></p></div><div class="rvm-post-axis-transform-actions"><button id="rvmPostAxisTransformSaveBtn" type="button" class="primary">Save Transform Config</button><button id="rvmPostAxisTransformOffBtn" type="button" class="ghost">Disable</button></div></form>`;
  const presetSelect = dialog.querySelector('#rvmPostAxisTransformPreset');
  const updateSummary = () => {
    const preset = RVM_POST_AXIS_TRANSFORM_PRESETS[presetSelect.value] || RVM_POST_AXIS_TRANSFORM_PRESETS[DEFAULT_PRESET_ID];
    const matrixNode = dialog.querySelector('#rvmPostAxisTransformMatrixSummary');
    const descriptionNode = dialog.querySelector('#rvmPostAxisTransformDescription');
    if (matrixNode) matrixNode.textContent = matrixSummary(preset.matrix);
    if (descriptionNode) descriptionNode.textContent = preset.description;
  };
  presetSelect.addEventListener('change', updateSummary);
  dialog.querySelector('#rvmPostAxisTransformSaveBtn')?.addEventListener('click', () => {
    const preset = RVM_POST_AXIS_TRANSFORM_PRESETS[presetSelect.value] || RVM_POST_AXIS_TRANSFORM_PRESETS[DEFAULT_PRESET_ID];
    saveConfig(win, { schema: RVM_POST_AXIS_TRANSFORM_SCHEMA, enabled: dialog.querySelector('#rvmPostAxisTransformEnabled')?.checked !== false, presetId: preset.id, matrix: preset.matrix, applyStage: 'post-export-model-pre-writeRvm', transformScope: 'entire-export-model-with-supports' });
    dialog.close?.();
  });
  dialog.querySelector('#rvmPostAxisTransformOffBtn')?.addEventListener('click', () => { saveConfig(win, { ...DEFAULT_RVM_POST_AXIS_TRANSFORM_CONFIG, matrix: RVM_POST_AXIS_TRANSFORM_PRESETS.off.matrix, enabled: false, presetId: 'off' }); dialog.close?.(); });
}

function getActiveConfig(win) { return resolveRvmPostAxisTransformConfig(readStoredConfig(win) || DEFAULT_RVM_POST_AXIS_TRANSFORM_CONFIG, win); }
function saveConfig(win, config) { const resolved = resolveRvmPostAxisTransformConfig(config, win); try { win.localStorage?.setItem?.(STORAGE_KEY, JSON.stringify(resolved)); } catch (_) {} win.__3D_MARKUP_RVM_POST_AXIS_TRANSFORM_CONFIG__ = resolved; win.dispatchEvent?.(new CustomEvent('managed-stage:rvm-post-axis-transform-config-changed', { detail: resolved })); return resolved; }
function readStoredConfig(win) { try { const text = win.localStorage?.getItem?.(STORAGE_KEY); return text ? JSON.parse(text) : null; } catch (_) { return null; } }

function injectStyles(doc) {
  if (doc.getElementById('rvmPostAxisTransformPopupStyles')) return;
  const style = doc.createElement('style');
  style.id = 'rvmPostAxisTransformPopupStyles';
  style.textContent = `.rvm-post-axis-transform-btn{width:100%;margin-top:8px;min-height:30px;border-radius:8px;border:1px solid rgba(96,165,250,.45);background:rgba(30,64,175,.26);color:#dbeafe;font-weight:800;cursor:pointer}.rvm-post-axis-transform-dialog{max-width:min(720px,94vw);border:1px solid rgba(148,163,184,.4);border-radius:14px;background:#0f172a;color:#e5e7eb;padding:0}.rvm-post-axis-transform-card{padding:16px}.rvm-post-axis-transform-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.rvm-post-axis-transform-head h3{margin:0}.rvm-post-axis-transform-head p{margin:4px 0 0;color:#9ca3af}.rvm-post-axis-transform-enable{display:block;margin:12px 0;font-weight:800}.rvm-post-axis-transform-proof{margin-top:12px;padding:12px;border:1px solid rgba(96,165,250,.32);border-radius:10px;background:rgba(30,64,175,.16)}.rvm-post-axis-transform-proof table{width:100%;border-collapse:collapse}.rvm-post-axis-transform-proof th,.rvm-post-axis-transform-proof td{border:1px solid rgba(148,163,184,.24);padding:6px;text-align:left}.rvm-post-axis-transform-actions{display:flex;gap:10px;margin-top:14px}.rvm-post-axis-transform-actions button{min-height:34px;border-radius:8px;padding:0 12px}`;
  doc.head?.appendChild?.(style);
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
