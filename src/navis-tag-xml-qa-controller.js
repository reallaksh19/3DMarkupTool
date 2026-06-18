import * as THREE from 'three';

const runtime = window.__3D_MARKUP_CLIP_RUNTIME__ || null;

const state = {
  renderer: runtime?.renderer || null,
  scene: runtime?.scene || null,
  camera: runtime?.camera || null,
  styleInjected: false,
  previewOpen: false,
  lastSignature: ''
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initNavisXmlQa, { once: true });
} else {
  initNavisXmlQa();
}

window.addEventListener('markup:render-context', (event) => {
  const { renderer, scene, camera } = event.detail || {};
  if (renderer) state.renderer = renderer;
  if (scene) state.scene = scene;
  if (camera) state.camera = camera;
  scheduleRefresh();
});

function initNavisXmlQa() {
  injectStyles();
  setInterval(refreshQaPanel, 1200);
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#navisTagViewsBtn, #navisIsonoteBtn, #navisImportTagsBtn, #navisTagBtn, .navis-tag-view-row, .navis-tag-row-actions button')) {
      scheduleRefresh();
    }
  }, true);
  scheduleRefresh();
}

function scheduleRefresh() {
  requestAnimationFrame(() => setTimeout(refreshQaPanel, 60));
}

function refreshQaPanel() {
  const panel = document.getElementById('navisTagViewPanel');
  if (!panel) return;

  const tags = collectTags();
  const report = buildReport(tags);
  const signature = JSON.stringify({
    total: report.total,
    counts: report.counts,
    warnings: report.warnings.map((warning) => warning.message),
    previewOpen: state.previewOpen
  });
  if (signature === state.lastSignature && panel.querySelector('.navis-xml-qa-panel')) return;
  state.lastSignature = signature;

  const qa = ensureQaPanel(panel);
  qa.querySelector('.navis-xml-qa-counts').innerHTML = countPills(report);
  qa.querySelector('.navis-xml-qa-status').textContent = report.warnings.length
    ? `${report.warnings.length} validation warning${report.warnings.length === 1 ? '' : 's'} before XML export.`
    : 'XML export check passed.';
  qa.querySelector('.navis-xml-qa-status').classList.toggle('warning', Boolean(report.warnings.length));
  qa.querySelector('.navis-xml-qa-warnings').innerHTML = report.warnings.length
    ? report.warnings.slice(0, 8).map((warning) => `<li>${escapeHtml(warning.message)}</li>`).join('')
    : '<li>No missing tag title, comment, coordinate, or camera fields detected.</li>';

  const preview = qa.querySelector('.navis-xml-preview');
  if (state.previewOpen) {
    preview.hidden = false;
    preview.querySelector('textarea').value = buildPreviewXml(tags);
  } else {
    preview.hidden = true;
  }

  bindQaButtons(qa, tags, report);
  window.__NAVIS_TAG_XML_QA__ = { tags, report, xml: () => buildPreviewXml(collectTags()) };
}

function ensureQaPanel(panel) {
  let qa = panel.querySelector('.navis-xml-qa-panel');
  if (qa) return qa;

  qa = document.createElement('section');
  qa.className = 'navis-xml-qa-panel';
  qa.innerHTML = `
    <div class="navis-xml-qa-head">
      <strong>XML QA</strong>
      <span class="navis-xml-qa-status">Checking tag XML export...</span>
    </div>
    <div class="navis-xml-qa-counts"></div>
    <ul class="navis-xml-qa-warnings"></ul>
    <div class="navis-xml-qa-actions">
      <button type="button" data-qa-action="preview">Preview XML</button>
      <button type="button" data-qa-action="copy">Copy XML</button>
      <button type="button" data-qa-action="report">QA JSON</button>
    </div>
    <div class="navis-xml-preview" hidden>
      <textarea spellcheck="false" readonly></textarea>
    </div>
  `;

  const detail = panel.querySelector('.navis-tag-detail-actions');
  if (detail) panel.insertBefore(qa, detail);
  else panel.appendChild(qa);
  return qa;
}

function bindQaButtons(qa, tags, report) {
  qa.querySelector('[data-qa-action="preview"]')?.onclick = () => {
    state.previewOpen = !state.previewOpen;
    refreshQaPanel();
  };
  qa.querySelector('[data-qa-action="copy"]')?.onclick = async () => {
    const xml = buildPreviewXml(collectTags());
    try {
      await navigator.clipboard.writeText(xml);
      toast('Copied Navis tag XML preview to clipboard.');
    } catch {
      qa.querySelector('.navis-xml-preview').hidden = false;
      qa.querySelector('.navis-xml-preview textarea').value = xml;
      state.previewOpen = true;
      toast('Clipboard unavailable. XML preview opened for manual copy.');
    }
  };
  qa.querySelector('[data-qa-action="report"]')?.onclick = () => {
    const payload = JSON.stringify({ ...report, generatedAt: new Date().toISOString() }, null, 2);
    downloadText(payload, `3dmarkup_navis_tag_qa_${timestampForFile()}.json`, 'application/json');
  };
}

function buildReport(tags) {
  const warnings = [];
  const counts = tags.reduce((acc, tag) => {
    const key = sourceKey(tag.source);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { imported: 0, isonote: 0, manual: 0 });

  tags.forEach((tag, index) => {
    const label = tag.name || tag.body || `Tag ${index + 1}`;
    if (!String(tag.name || '').trim()) warnings.push({ index, message: `${label}: missing viewpoint title.` });
    if (!String(tag.body || '').trim()) warnings.push({ index, message: `${label}: missing annotation/comment body.` });
    if (!isVector(tag.anchor)) warnings.push({ index, message: `${label}: missing valid leader/arrow 3D point.` });
    if (!isVector(tag.labelPoint)) warnings.push({ index, message: `${label}: missing valid annotation rectangle 3D point.` });
    if (!tag.bounds || !isVector(tag.bounds.min) || !isVector(tag.bounds.max)) warnings.push({ index, message: `${label}: missing valid tag bounds.` });
    if (!hasCamera()) warnings.push({ index, message: `${label}: current camera is not available; XML will use fallback camera values.` });
  });

  return {
    total: tags.length,
    counts,
    warningCount: warnings.length,
    warnings,
    ready: tags.length > 0 && warnings.length === 0
  };
}

function countPills(report) {
  return [
    ['Total', report.total],
    ['Imported', report.counts.imported || 0],
    ['ISONOTE', report.counts.isonote || 0],
    ['Manual', report.counts.manual || 0]
  ].map(([name, value]) => `<span><b>${escapeHtml(name)}</b>${Number(value)}</span>`).join('');
}

function collectTags() {
  const ctx = getContext();
  const scene = ctx?.scene;
  if (!scene) return [];
  return [...collectImported(scene), ...collectIsonote(scene), ...collectManual(scene)].filter((tag) => !isExcluded(tag));
}

function collectImported(scene) {
  const tags = [];
  scene.traverse((object) => {
    if (!object.name?.startsWith('NAVIS_IMPORTED_TAG_')) return;
    const line = object.children.find((child) => child.name?.startsWith('NAVIS_IMPORTED_TAG_LEADER_'));
    const label = object.children.find((child) => child.name?.startsWith('NAVIS_IMPORTED_TAG_TEXT_'));
    const points = line?.geometry?.attributes?.position;
    if (!points || points.count < 2) return;
    const anchor = vectorFromPosition(points, 0).applyMatrix4(line.matrixWorld);
    const labelPoint = vectorFromPosition(points, 1).applyMatrix4(line.matrixWorld);
    tags.push({
      source: 'IMPORTED XML',
      name: object.userData?.viewName || object.name.replace('NAVIS_IMPORTED_TAG_', 'Imported '),
      body: object.userData?.body || label?.userData?.body || 'Imported tag',
      anchor,
      labelPoint,
      bounds: boundsAround(anchor, labelPoint)
    });
  });
  return tags;
}

function collectIsonote(scene) {
  const tags = [];
  const nodePositions = collectNodePositions(scene);
  scene.traverse((object) => {
    const data = object.userData || {};
    if (data.TYPE !== 'ISONOTE_NAME_PLATE') return;
    const body = String(data.BOARD_TEXT || data.SOURCE_NOTE_NAME || data.sourceNoteName || '').trim();
    if (!body) return;
    const labelPoint = worldPosition(object);
    const node = data.NODE || data.node || '';
    const anchor = nodePositions.get(String(node)) || labelPoint.clone();
    tags.push({
      source: 'ISONOTE SIDELOAD',
      name: data.SOURCE_NOTE_NAME || data.sourceNoteName || `ISONOTE ${tags.length + 1}`,
      body,
      anchor,
      labelPoint,
      bounds: boundsAround(anchor, labelPoint)
    });
  });
  return tags;
}

function collectManual(scene) {
  const tags = [];
  scene.traverse((object) => {
    if (!object.name?.startsWith('NAVIS_MANUAL_TAG_')) return;
    const line = object.children.find((child) => child.name?.startsWith('NAVIS_TAG_LEADER_'));
    const label = object.children.find((child) => child.name?.startsWith('NAVIS_TAG_TEXT_'));
    const points = line?.geometry?.attributes?.position;
    const anchor = points?.count >= 2 ? vectorFromPosition(points, 0).applyMatrix4(line.matrixWorld) : worldPosition(object);
    const labelPoint = points?.count >= 2 ? vectorFromPosition(points, 1).applyMatrix4(line.matrixWorld) : label?.getWorldPosition(new THREE.Vector3()) || anchor.clone();
    tags.push({
      source: 'MANUAL',
      name: object.userData?.viewName || object.name,
      body: object.userData?.body || label?.userData?.body || 'Manual tag',
      anchor,
      labelPoint,
      bounds: boundsAround(anchor, labelPoint)
    });
  });
  return tags;
}

function buildPreviewXml(tags) {
  const ctx = getContext();
  const now = new Date();
  const views = tags.map((tag, index) => viewXml(tag, index + 1, ctx?.camera, ctx?.renderer, now)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8" ?>\n\n<exchange xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://download.autodesk.com/us/navisworks/schemas/nw-exchange-12.0.xsd" units="m" filename="3DMarkupTool.nwd" filepath="">\n  <viewpoints>\n${views}\n  </viewpoints>\n</exchange>\n`;
}

function viewXml(tag, index, camera, renderer, date) {
  const cam = cameraSnapshot(tag, camera, renderer);
  const anchor2d = projectTo2f(tag.anchor, camera);
  const label2d = projectTo2f(tag.labelPoint || tag.anchor, camera);
  const bounds = tag.bounds || boundsAround(tag.anchor, tag.labelPoint || tag.anchor);
  return `    <view name="${escapeXml(tag.name || `Tag View ${index}`)}" guid="${fallbackGuid(index)}">\n      <viewpoint tool="none" render="shaded" lighting="headlight" focal="${fmt(cam.focal)}" linear="18.9306050001" angular="0.7853981634">\n        <camera projection="persp" near="${fmt(cam.near)}" far="${fmt(cam.far)}" aspect="${fmt(cam.aspect)}" height="0.7853980000">\n          <position>${pos3f(cam.position)}</position>\n          <rotation>${quat(cam.quaternion)}</rotation>\n        </camera>\n      </viewpoint>\n      <comments>\n        <comment id="${index}" status="new"><user>3DMarkupTool</user><body>${escapeXml(tag.body || '')}</body><createddate><date year="${date.getFullYear()}" month="${date.getMonth() + 1}" day="${date.getDate()}" hour="${date.getHours()}" minute="${date.getMinutes()}" second="${date.getSeconds()}"/></createddate></comment>\n      </comments>\n      <redlines>\n        <rltag thickness="3" pattern="65535" id="${index}" commentid="${index}">\n          <colour red="1.0000000000" green="0.0000000000" blue="0.0000000000"/>\n          <pos1><pos2f x="${fmt(anchor2d.x)}" y="${fmt(anchor2d.y)}"/></pos1>\n          <pos2><pos2f x="${fmt(label2d.x)}" y="${fmt(label2d.y)}"/></pos2>\n          <pos3d>${pos3f(tag.anchor)}</pos3d>\n          <bounds><box3f><min>${pos3f(bounds.min)}</min><max>${pos3f(bounds.max)}</max></box3f></bounds>\n        </rltag>\n      </redlines>\n    </view>`;
}

function cameraSnapshot(tag, camera, renderer) {
  return {
    position: camera?.position?.clone?.() || new THREE.Vector3(8, 6, 8),
    quaternion: camera?.quaternion?.clone?.() || new THREE.Quaternion(),
    near: camera?.near || 0.01,
    far: camera?.far || 10000,
    aspect: renderer?.domElement ? renderer.domElement.clientWidth / Math.max(renderer.domElement.clientHeight, 1) : camera?.aspect || 1.7777777778,
    focal: tag?.bounds ? Math.max(tag.bounds.getSize(new THREE.Vector3()).length(), 1) : 1
  };
}

function sourceKey(source) {
  if (/import/i.test(source || '')) return 'imported';
  if (/isonote/i.test(source || '')) return 'isonote';
  if (/manual/i.test(source || '')) return 'manual';
  return 'manual';
}

function collectNodePositions(scene) {
  const out = new Map();
  scene?.traverse?.((object) => {
    const data = object.userData || {};
    if (data.TYPE === 'NODE' && data.NODE !== undefined) out.set(String(data.NODE), worldPosition(object));
  });
  return out;
}

function isExcluded(tag) {
  const rows = Array.from(document.querySelectorAll('.navis-tag-view-row.excluded'));
  const tagSig = `${tag.source || ''}|${tag.name || ''}|${tag.body || ''}`.toLowerCase();
  return rows.some((row) => {
    const text = row.textContent.toLowerCase();
    return text.includes((tag.name || '').toLowerCase()) && text.includes('[excluded from export]') || text.includes(tagSig);
  });
}

function vectorFromPosition(points, index) {
  return new THREE.Vector3(points.getX(index), points.getY(index), points.getZ(index));
}

function boundsAround(a, b) {
  const box = new THREE.Box3().setFromPoints([a, b]);
  const pad = Math.max(a.distanceTo(b) * 0.08, 0.1);
  box.expandByScalar(pad);
  return box;
}

function worldPosition(object) {
  return object.getWorldPosition(new THREE.Vector3());
}

function isVector(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}

function hasCamera() {
  const camera = state.camera || runtime?.camera || window.__3D_MARKUP_CLIP_RUNTIME__?.camera;
  return Boolean(camera?.position && camera?.quaternion);
}

function getContext() {
  const live = window.__3D_MARKUP_CLIP_RUNTIME__ || runtime || {};
  const renderer = state.renderer || live.renderer;
  const scene = state.scene || live.scene;
  const camera = state.camera || live.camera;
  if (!scene) return null;
  return { renderer, scene, camera };
}

function projectTo2f(point, camera) {
  if (!point || !camera) return { x: 0, y: 0 };
  const projected = point.clone().project(camera);
  return { x: clamp(projected.x, -1, 1), y: clamp(projected.y, -1, 1) };
}

function pos3f(v) {
  return `<pos3f x="${fmt(v?.x || 0)}" y="${fmt(v?.y || 0)}" z="${fmt(v?.z || 0)}"/>`;
}

function quat(q) {
  return `<quaternion a="${fmt(q?.w ?? 1)}" b="${fmt(q?.x || 0)}" c="${fmt(q?.y || 0)}" d="${fmt(q?.z || 0)}"/>`;
}

function fmt(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(10) : '0.0000000000';
}

function fallbackGuid(index) {
  return `3dmarkup-qa-${Date.now()}-${index}`;
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function downloadText(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toast(message) {
  const status = document.getElementById('runtimeStatus');
  if (status) status.textContent = message;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function escapeXml(value) {
  return escapeHtml(value);
}

function injectStyles() {
  if (state.styleInjected) return;
  state.styleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .navis-xml-qa-panel {
      margin: 10px 0;
      padding: 10px;
      border: 1px solid rgba(101, 213, 255, .28);
      border-radius: 10px;
      background: rgba(8, 17, 30, .74);
    }
    .navis-xml-qa-head {
      display: grid;
      gap: 3px;
      margin-bottom: 8px;
    }
    .navis-xml-qa-head strong {
      color: #eaf6ff;
      font-size: 12px;
      letter-spacing: .4px;
    }
    .navis-xml-qa-status {
      color: #8ee6b3;
      font-size: 11px;
      font-weight: 800;
    }
    .navis-xml-qa-status.warning {
      color: #ffd166;
    }
    .navis-xml-qa-counts {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
      margin-bottom: 8px;
    }
    .navis-xml-qa-counts span {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 5px 7px;
      border: 1px solid rgba(132, 178, 220, .22);
      border-radius: 8px;
      color: #e3edf8;
      background: rgba(255, 255, 255, .04);
      font-size: 11px;
    }
    .navis-xml-qa-warnings {
      margin: 0 0 8px 16px;
      padding: 0;
      color: #d4e4f4;
      font-size: 11px;
      line-height: 1.35;
      max-height: 92px;
      overflow: auto;
    }
    .navis-xml-qa-actions {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .navis-xml-qa-actions button {
      min-height: 28px;
      padding: 5px 8px;
      font-size: 11px;
      border-radius: 8px;
    }
    .navis-xml-preview textarea {
      width: 100%;
      height: 170px;
      margin-top: 8px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 10px;
      color: #d8e8f7;
      background: #050b14;
      border: 1px solid rgba(132, 178, 220, .24);
      border-radius: 8px;
      resize: vertical;
    }
  `;
  document.head.appendChild(style);
}
