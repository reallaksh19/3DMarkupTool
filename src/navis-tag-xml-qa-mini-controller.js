import * as THREE from 'three';

const runtime = window.__3D_MARKUP_CLIP_RUNTIME__ || null;

const state = {
  scene: runtime?.scene || null,
  camera: runtime?.camera || null,
  renderer: runtime?.renderer || null,
  previewOpen: false,
  refreshQueued: false
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initMiniXmlQa, { once: true });
} else {
  initMiniXmlQa();
}

window.addEventListener('markup:render-context', (event) => {
  const { scene, camera, renderer } = event.detail || {};
  if (scene) state.scene = scene;
  if (camera) state.camera = camera;
  if (renderer) state.renderer = renderer;
  queueRefresh();
});

function initMiniXmlQa() {
  injectStyles();
  ensureQaButton();
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#navisTagViewsBtn, #navisIsonoteBtn, #navisImportTagsBtn, #navisTagBtn, #navisExportTagsBtn, #navisSaveSessionBtn, #navisRestoreSessionBtn, #navisClearSessionBtn, .navis-tag-view-row, .navis-tag-row-actions-safe button')) {
      window.setTimeout(queueRefresh, 120);
    }
  }, true);
  queueRefresh();
}

function ensureQaButton() {
  const group = document.querySelector('.navis-tag-tools');
  if (!group) {
    window.setTimeout(ensureQaButton, 250);
    return null;
  }
  if (document.getElementById('navisXmlQaBtn')) return document.getElementById('navisXmlQaBtn');

  const btn = document.createElement('button');
  btn.id = 'navisXmlQaBtn';
  btn.type = 'button';
  btn.className = 'tool-btn';
  btn.title = 'Preview, copy, and validate Navis tag XML before export';
  btn.textContent = 'XML QA';
  const exportBtn = document.getElementById('navisExportTagsBtn');
  group.insertBefore(btn, exportBtn || null);
  btn.addEventListener('click', () => {
    const panel = document.getElementById('navisTagViewPanel');
    if (!panel || panel.hidden) document.getElementById('navisTagViewsBtn')?.click();
    window.setTimeout(() => {
      renderQaPanel(true);
      document.querySelector('.navis-xml-qa-mini-panel')?.scrollIntoView({ block: 'nearest' });
    }, 120);
  });
  return btn;
}

function queueRefresh() {
  if (state.refreshQueued) return;
  state.refreshQueued = true;
  window.requestAnimationFrame(() => {
    state.refreshQueued = false;
    renderQaPanel(false);
  });
}

function renderQaPanel(forceOpen) {
  const panel = document.getElementById('navisTagViewPanel');
  if (!panel || panel.hidden) return;
  const qa = ensureQaPanel(panel);
  const tags = collectTags();
  const report = buildReport(tags);
  const xml = buildXmlPreview(tags);

  qa.querySelector('.qa-mini-counts').innerHTML = countMarkup(report);
  const status = qa.querySelector('.qa-mini-status');
  status.textContent = report.warnings.length
    ? `${report.warnings.length} warning${report.warnings.length === 1 ? '' : 's'} before export.`
    : 'XML QA passed for visible tag viewpoints.';
  status.classList.toggle('warning', Boolean(report.warnings.length));
  qa.querySelector('.qa-mini-warnings').innerHTML = report.warnings.length
    ? report.warnings.slice(0, 8).map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>No missing title, comment, coordinate, or camera fields detected.</li>';

  const preview = qa.querySelector('.qa-mini-preview');
  const area = qa.querySelector('textarea');
  if (forceOpen) state.previewOpen = true;
  preview.hidden = !state.previewOpen;
  if (!preview.hidden && area) area.value = xml;

  bindQaButtons(qa, report, xml);
  window.__NAVIS_TAG_XML_QA_MINI__ = { tags, report, xml };
}

function ensureQaPanel(panel) {
  let qa = panel.querySelector('.navis-xml-qa-mini-panel');
  if (qa) return qa;
  qa = document.createElement('section');
  qa.className = 'navis-xml-qa-mini-panel';
  qa.innerHTML = `
    <div class="qa-mini-head">
      <strong>XML QA</strong>
      <span class="qa-mini-status">Checking tag XML export...</span>
    </div>
    <div class="qa-mini-counts"></div>
    <ul class="qa-mini-warnings"></ul>
    <div class="qa-mini-actions">
      <button type="button" data-qa-mini="preview">Preview XML</button>
      <button type="button" data-qa-mini="copy">Copy XML</button>
      <button type="button" data-qa-mini="report">QA JSON</button>
    </div>
    <div class="qa-mini-preview" hidden>
      <textarea spellcheck="false" readonly></textarea>
    </div>
  `;
  const list = panel.querySelector('.navis-tag-view-list');
  if (list?.nextSibling) panel.insertBefore(qa, list.nextSibling);
  else panel.appendChild(qa);
  return qa;
}

function bindQaButtons(qa, report, xml) {
  const previewButton = qa.querySelector('[data-qa-mini="preview"]');
  if (previewButton) previewButton.onclick = () => {
    state.previewOpen = !state.previewOpen;
    renderQaPanel(false);
  };

  const copyButton = qa.querySelector('[data-qa-mini="copy"]');
  if (copyButton) copyButton.onclick = async () => {
    try {
      await navigator.clipboard.writeText(buildXmlPreview(collectTags()));
      toast('Copied Navis tag XML preview to clipboard.');
    } catch {
      state.previewOpen = true;
      renderQaPanel(false);
      toast('Clipboard unavailable. XML preview opened for manual copy.');
    }
  };

  const reportButton = qa.querySelector('[data-qa-mini="report"]');
  if (reportButton) reportButton.onclick = () => {
    const payload = JSON.stringify({ ...report, generatedAt: new Date().toISOString() }, null, 2);
    downloadText(payload, `3dmarkup_navis_tag_qa_${timestampForFile()}.json`, 'application/json');
  };
}

function collectTags() {
  const scene = getContext()?.scene;
  if (!scene) return [];
  const tags = [];
  scene.traverse((object) => {
    if (object.name?.startsWith('NAVIS_IMPORTED_TAG_')) tags.push(readLeaderTag(object, 'imported'));
    else if (object.name?.startsWith('NAVIS_MANUAL_TAG_SESSION_')) tags.push(readLeaderTag(object, 'session'));
    else if (object.name?.startsWith('NAVIS_MANUAL_TAG_')) tags.push(readLeaderTag(object, 'manual'));
    else if (object.userData?.TYPE === 'ISONOTE_NAME_PLATE') tags.push(readIsonoteTag(object));
  });
  return tags.filter(Boolean);
}

function readLeaderTag(group, source) {
  const line = group.children?.find((child) => child.name?.includes('LEADER'));
  const label = group.children?.find((child) => child.name?.includes('TEXT'));
  const pos = line?.geometry?.attributes?.position;
  if (!pos || pos.count < 2) return null;
  const anchor = vecFromAttr(pos, 0).applyMatrix4(line.matrixWorld);
  const labelPoint = vecFromAttr(pos, 1).applyMatrix4(line.matrixWorld);
  return {
    source,
    name: group.userData?.viewName || group.userData?.name || group.name.replace(/^NAVIS_/, ''),
    body: group.userData?.body || label?.userData?.body || label?.userData?.text || '',
    anchor,
    labelPoint,
    bounds: boundsAround(anchor, labelPoint)
  };
}

function readIsonoteTag(object) {
  const anchor = new THREE.Vector3();
  object.getWorldPosition(anchor);
  const labelPoint = anchor.clone().add(new THREE.Vector3(1, 1, 1));
  return {
    source: 'isonote',
    name: object.userData?.SOURCE_NOTE_NAME || `ISONOTE ${object.userData?.NODE || ''}`.trim(),
    body: object.userData?.BOARD_TEXT || object.userData?.TEXT || object.name,
    anchor,
    labelPoint,
    bounds: boundsAround(anchor, labelPoint)
  };
}

function buildReport(tags) {
  const counts = { imported: 0, isonote: 0, manual: 0, session: 0 };
  const warnings = [];
  tags.forEach((tag, index) => {
    counts[tag.source] = (counts[tag.source] || 0) + 1;
    const label = tag.name || tag.body || `Tag ${index + 1}`;
    if (!String(tag.name || '').trim()) warnings.push(`${label}: missing viewpoint title.`);
    if (!String(tag.body || '').trim()) warnings.push(`${label}: missing annotation/comment body.`);
    if (!isVector(tag.anchor)) warnings.push(`${label}: missing valid leader/arrow 3D point.`);
    if (!isVector(tag.labelPoint)) warnings.push(`${label}: missing valid annotation rectangle 3D point.`);
    if (!tag.bounds || !isVector(tag.bounds.min) || !isVector(tag.bounds.max)) warnings.push(`${label}: missing valid tag bounds.`);
  });
  if (!hasCamera()) warnings.push('Current camera is not available; preview XML uses fallback camera values.');
  return { total: tags.length, counts, warningCount: warnings.length, warnings, ready: tags.length > 0 && warnings.length === 0 };
}

function countMarkup(report) {
  return [
    ['Total', report.total],
    ['Imported', report.counts.imported || 0],
    ['ISONOTE', report.counts.isonote || 0],
    ['Manual', report.counts.manual || 0],
    ['Session', report.counts.session || 0]
  ].map(([name, value]) => `<span><b>${escapeHtml(name)}</b>${Number(value)}</span>`).join('');
}

function buildXmlPreview(tags) {
  const camera = getContext()?.camera;
  const position = camera?.position || new THREE.Vector3(0, 0, 10);
  const target = new THREE.Vector3(0, 0, 0);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<exchange>\n  <viewpoints>\n${tags.map((tag, index) => viewXml(tag, index, position, target)).join('\n')}\n  </viewpoints>\n</exchange>\n`;
}

function viewXml(tag, index, cameraPosition, target) {
  const name = xmlAttr(tag.name || `Tag View ${index + 1}`);
  const body = escapeXml(tag.body || tag.name || `Tag ${index + 1}`);
  const a = tag.anchor || new THREE.Vector3();
  const b = tag.labelPoint || a.clone().add(new THREE.Vector3(1, 1, 1));
  const min = tag.bounds?.min || boundsAround(a, b).min;
  const max = tag.bounds?.max || boundsAround(a, b).max;
  return `    <view name="${name}">\n      <viewpoint>\n        <camera projection="persp">\n          <pos3f x="${num(cameraPosition.x)}" y="${num(cameraPosition.y)}" z="${num(cameraPosition.z)}"/>\n          <target><pos3f x="${num(target.x)}" y="${num(target.y)}" z="${num(target.z)}"/></target>\n        </camera>\n      </viewpoint>\n      <comments><comment><body>${body}</body></comment></comments>\n      <redlines>\n        <rltag>\n          <pos3d><pos3f x="${num(a.x)}" y="${num(a.y)}" z="${num(a.z)}"/></pos3d>\n          <bounds><box3f><min x="${num(min.x)}" y="${num(min.y)}" z="${num(min.z)}"/><max x="${num(max.x)}" y="${num(max.y)}" z="${num(max.z)}"/></box3f></bounds>\n        </rltag>\n      </redlines>\n    </view>`;
}

function getContext() {
  const live = window.__3D_MARKUP_CLIP_RUNTIME__ || {};
  return {
    scene: live.scene || state.scene,
    camera: live.camera || state.camera,
    renderer: live.renderer || state.renderer
  };
}

function vecFromAttr(attr, index) {
  return new THREE.Vector3(attr.getX(index), attr.getY(index), attr.getZ(index));
}

function boundsAround(a, b) {
  return new THREE.Box3().setFromPoints([a, b]).expandByScalar(Math.max(a.distanceTo(b) * 0.15, 1));
}

function isVector(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}

function hasCamera() {
  const camera = getContext()?.camera;
  return camera && isVector(camera.position);
}

function downloadText(text, filename, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toast(message) {
  const status = document.getElementById('runtimeStatus');
  if (status) status.textContent = message;
  window.setTimeout(() => {
    if (status && status.textContent === message) status.textContent = 'Core Ready';
  }, 2400);
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
}

function num(value) {
  return Number.isFinite(value) ? Number(value).toFixed(6) : '0.000000';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function escapeXml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function xmlAttr(value) {
  return escapeXml(value).replace(/'/g, '&apos;');
}

function injectStyles() {
  if (document.getElementById('navisXmlQaMiniStyles')) return;
  const style = document.createElement('style');
  style.id = 'navisXmlQaMiniStyles';
  style.textContent = `
    .navis-xml-qa-mini-panel {
      margin: 10px 0;
      padding: 10px;
      border: 1px solid rgba(91, 155, 213, .42);
      border-radius: 12px;
      background: rgba(4, 16, 31, .82);
      color: #dcecff;
    }
    .qa-mini-head { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
    .qa-mini-status { color: #7fffd4; font-size: 12px; }
    .qa-mini-status.warning { color: #ffd166; }
    .qa-mini-counts { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
    .qa-mini-counts span { border: 1px solid rgba(120, 170, 220, .35); border-radius: 999px; padding: 3px 8px; font-size: 11px; }
    .qa-mini-counts b { margin-right: 5px; color: #88d8ff; }
    .qa-mini-warnings { margin: 8px 0; padding-left: 17px; color: #c9d7e6; font-size: 12px; }
    .qa-mini-actions { display: flex; gap: 7px; flex-wrap: wrap; }
    .qa-mini-actions button { border: 1px solid rgba(120, 170, 220, .45); border-radius: 9px; background: rgba(28, 60, 96, .8); color: #e8f3ff; padding: 6px 9px; font-weight: 800; cursor: pointer; }
    .qa-mini-preview textarea { width: 100%; height: 160px; margin-top: 8px; resize: vertical; border-radius: 8px; background: #06111f; color: #dcecff; border: 1px solid rgba(120, 170, 220, .4); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 11px; }
    #navisXmlQaBtn::before { content: '✓ '; }
  `;
  document.head.appendChild(style);
}
