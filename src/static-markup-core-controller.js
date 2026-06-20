const VERSION = 'static-markup-grouped-controls-20260620';
const STORAGE_KEY = '3dmarkup.staticMarkupCore.v1';

const state = {
  importedXml: '',
  lastReport: null,
  panelOpen: false,
  openGroupId: ''
};

const GROUPS = [
  {
    id: 'staticTagGroup',
    label: 'Tag',
    icon: '🏷',
    title: 'Tag-related review tools',
    note: 'Tag tools only. Advanced leader authoring remains deferred.',
    tools: [
      { id: 'staticTagBtn', label: 'Tag', icon: '↗', action: manualTag, title: 'Manual leader tag placeholder. Full leader authoring remains in advanced mode.' },
      { id: 'staticTagViewsBtn', label: 'Tag Views', icon: '☰', action: togglePanel, title: 'Show imported, ISONOTE, and exported static tag viewpoints.' }
    ]
  },
  {
    id: 'staticXmlGroup',
    label: 'XML',
    icon: '⌘',
    title: 'XML-related import, QA, and export tools',
    note: 'XML tools use the static tag/session buffer and do not change GLB/RVM export contracts.',
    tools: [
      { id: 'staticIsonoteXmlBtn', label: 'ISONOTE XML', icon: '⌖', action: openIsonoteSummary, title: 'Summarize ISONOTE/name-plate data available in the current scene.' },
      { id: 'staticImportXmlBtn', label: 'Import XML', icon: '⇣', action: importTagXml, title: 'Import Navis tag XML text into the static session buffer.' },
      { id: 'staticXmlQaBtn', label: 'XML QA', icon: '☑', action: runXmlQa, title: 'Run a lightweight QA summary of static tag XML data.' },
      { id: 'staticExportXmlBtn', label: 'Export XML', icon: '⇩', action: exportXml, title: 'Export a lightweight static tag XML snapshot. Not an RVM/Navis certification feature.' }
    ]
  },
  {
    id: 'staticSessionGroup',
    label: 'Session',
    icon: '▣',
    title: 'Browser session tools for static markup/XML state',
    note: 'Session tools are local to this browser.',
    tools: [
      { id: 'staticSaveSessionBtn', label: 'Save Session', icon: '▣', action: saveSession, title: 'Save the static tag XML/session buffer in this browser.' },
      { id: 'staticRestoreSessionBtn', label: 'Restore', icon: '⟲', action: restoreSession, title: 'Restore static tag XML/session buffer from this browser.' },
      { id: 'staticClearSessionBtn', label: 'Clear Session', icon: '⌫', action: clearSession, title: 'Clear static tag XML/session buffer.' }
    ]
  }
];

runWhenReady(initStaticMarkupCore);
window.addEventListener('markup:render-context', () => refreshPanel(false));
window.addEventListener('viewer:model-loaded', () => refreshPanel(false));
window.addEventListener('viewer:selection-changed', () => refreshPanel(false));

function runWhenReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function initStaticMarkupCore() {
  ensureStyles();
  const group = ensureToolGroup();
  if (!group) return;
  GROUPS.forEach((toolGroup) => ensureGroupedMenu(group, toolGroup));
  bindGroupCloseEvents();
  ensurePanel();
  restoreSession(false);
  updateButtonState();
  queueUiScore();
  window.__3D_MARKUP_STATIC_MARKUP__ = {
    version: VERSION,
    groups: GROUPS.map((entry) => entry.label),
    collectTags,
    buildXml,
    runXmlQa: () => buildReport(collectTags()),
    closeGroups
  };
}

function ensureToolGroup() {
  const ribbon = document.querySelector('.markup-ribbon');
  if (!ribbon) return null;
  ribbon.hidden = false;
  let group = ribbon.querySelector('.static-markup-tools');
  if (!group) {
    group = document.querySelector('.navis-tag-tools') || document.createElement('div');
    group.className = 'tool-group toolbar-group navis-tag-tools tag-lite-host static-markup-tools';
    group.setAttribute('aria-label', 'Grouped Tag, XML, and session tools');
    if (!group.parentElement) ribbon.appendChild(group);
  }
  group.dataset.groupedControls = 'tag-xml-session';
  group.setAttribute('aria-label', 'Grouped Tag, XML, and session tools');
  return group;
}

function ensureGroupedMenu(host, toolGroup) {
  let wrap = document.getElementById(toolGroup.id);
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = toolGroup.id;
    wrap.className = 'static-markup-group';
    wrap.dataset.markupGroup = toolGroup.label.toLowerCase();
    wrap.innerHTML = `
      <button id="${toolGroup.id}Toggle" type="button" class="tool-btn static-markup-group-toggle" aria-expanded="false" aria-controls="${toolGroup.id}Menu" title="${escapeHtml(toolGroup.title)}">
        <span class="static-tool-icon" aria-hidden="true">${toolGroup.icon}</span>
        <span>${escapeHtml(toolGroup.label)}</span>
        <span class="static-markup-expander" aria-hidden="true">&gt;&gt;</span>
      </button>
      <div id="${toolGroup.id}Menu" class="static-markup-menu" hidden role="menu" aria-label="${escapeHtml(toolGroup.label)} tools"></div>
    `;
    host.appendChild(wrap);
  }

  const toggle = wrap.querySelector('.static-markup-group-toggle');
  const menu = wrap.querySelector('.static-markup-menu');
  if (toggle && !toggle.dataset.boundGroupToggle) {
    toggle.dataset.boundGroupToggle = '1';
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleGroup(toolGroup.id);
    });
  }

  if (menu && !menu.dataset.boundGroupMenu) {
    menu.dataset.boundGroupMenu = '1';
    toolGroup.tools.forEach((tool) => ensureButton(menu, tool));
    const note = document.createElement('div');
    note.className = 'static-markup-menu-note';
    note.textContent = toolGroup.note;
    menu.appendChild(note);
  }
  return wrap;
}

function ensureButton(menu, tool) {
  let btn = document.getElementById(tool.id);
  if (!btn) {
    btn = document.createElement('button');
    btn.id = tool.id;
    btn.type = 'button';
    btn.className = 'tool-btn static-markup-btn static-markup-menu-item';
    btn.innerHTML = `<span class="static-tool-icon" aria-hidden="true">${tool.icon}</span><span>${escapeHtml(tool.label)}</span>`;
    menu.appendChild(btn);
  }
  btn.title = tool.title;
  btn.setAttribute('role', 'menuitem');
  btn.dataset.markupTool = tool.label;
  if (!btn.dataset.boundStaticMarkupAction) {
    btn.dataset.boundStaticMarkupAction = '1';
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      tool.action();
      closeGroups();
    });
  }
  return btn;
}

function toggleGroup(groupId) {
  const wrap = document.getElementById(groupId);
  if (!wrap) return;
  const menu = wrap.querySelector('.static-markup-menu');
  const toggle = wrap.querySelector('.static-markup-group-toggle');
  const willOpen = Boolean(menu?.hidden);
  closeGroups();
  if (!menu || !toggle || !willOpen) return;
  state.openGroupId = groupId;
  menu.hidden = false;
  toggle.setAttribute('aria-expanded', 'true');
}

function closeGroups() {
  state.openGroupId = '';
  document.querySelectorAll('.static-markup-menu').forEach((menu) => { menu.hidden = true; });
  document.querySelectorAll('.static-markup-group-toggle[aria-expanded="true"]').forEach((toggle) => toggle.setAttribute('aria-expanded', 'false'));
}

function bindGroupCloseEvents() {
  if (document.body.dataset.staticMarkupGroupCloseBound === 'true') return;
  document.body.dataset.staticMarkupGroupCloseBound = 'true';
  window.addEventListener('click', (event) => {
    if (!event.target?.closest?.('.static-markup-group')) closeGroups();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeGroups();
  });
}

function manualTag() {
  showStatus('Manual tag authoring remains deferred. Use advanced mode only after browser acceptance is complete.');
  togglePanel(true);
}

function openIsonoteSummary() {
  const report = buildReport(collectTags());
  state.lastReport = report;
  togglePanel(true);
  showStatus(`ISONOTE/name-plate candidates: ${report.counts.isonote || 0}.`);
}

function importTagXml() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xml,.txt';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    state.importedXml = await file.text();
    saveSession(false);
    const report = buildReport(collectTags());
    state.lastReport = report;
    togglePanel(true);
    showStatus(`Imported ${file.name} into static tag XML buffer.`);
  }, { once: true });
  input.click();
}

function togglePanel(force) {
  const panel = ensurePanel();
  if (!panel) return;
  state.panelOpen = typeof force === 'boolean' ? force : !state.panelOpen;
  panel.hidden = !state.panelOpen;
  refreshPanel(true);
}

function saveSession(showToast = true) {
  const payload = {
    version: VERSION,
    savedAt: new Date().toISOString(),
    importedXml: state.importedXml || '',
    report: buildReport(collectTags())
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  if (showToast !== false) showStatus('Static markup/session data saved.');
  updateButtonState();
}

function restoreSession(showToast = true) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    updateButtonState();
    if (showToast) showStatus('No saved static markup/session data found.');
    return;
  }
  try {
    const payload = JSON.parse(raw);
    state.importedXml = payload.importedXml || '';
    state.lastReport = payload.report || null;
    if (showToast) showStatus('Static markup/session data restored.');
  } catch {
    showStatus('Saved static markup/session data is invalid.');
  }
  updateButtonState();
  refreshPanel(false);
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
  state.importedXml = '';
  state.lastReport = null;
  refreshPanel(false);
  updateButtonState();
  showStatus('Static markup/session data cleared.');
}

function runXmlQa() {
  const report = buildReport(collectTags());
  state.lastReport = report;
  togglePanel(true);
  showStatus(report.warningCount ? `XML QA: ${report.warningCount} warning(s).` : 'XML QA: no static warnings.');
}

function exportXml() {
  const tags = collectTags();
  const xml = buildXml(tags);
  downloadText(xml, `3dmarkup_static_tags_${timestampForFile()}.xml`, 'application/xml');
  showStatus(`Exported ${tags.length} static tag viewpoint(s).`);
}

function ensurePanel() {
  const viewer = document.getElementById('viewer');
  if (!viewer) return null;
  let panel = document.getElementById('staticMarkupPanel');
  if (!panel) {
    panel = document.createElement('aside');
    panel.id = 'staticMarkupPanel';
    panel.className = 'static-markup-panel';
    panel.hidden = true;
    viewer.appendChild(panel);
  }
  return panel;
}

function refreshPanel(forceRender) {
  const panel = ensurePanel();
  if (!panel || panel.hidden && !forceRender) return;
  const tags = collectTags();
  const report = state.lastReport || buildReport(tags);
  panel.innerHTML = `
    <div class="static-markup-head">
      <strong>Markup / XML</strong>
      <button type="button" data-static-markup-close aria-label="Close Markup XML panel">×</button>
    </div>
    <div class="static-markup-kpis">
      <span>Total <b>${tags.length}</b></span>
      <span>ISONOTE <b>${report.counts.isonote || 0}</b></span>
      <span>Imported <b>${report.counts.imported || 0}</b></span>
      <span>Warnings <b>${report.warningCount || 0}</b></span>
    </div>
    <ul class="static-markup-list">
      ${tags.slice(0, 24).map((tag) => `<li><b>${escapeHtml(tag.name || tag.id || 'Tag')}</b><small>${escapeHtml(tag.source || 'static')}</small></li>`).join('') || '<li>No tag viewpoints found yet.</li>'}
    </ul>
    <div class="static-markup-note">Static core tools only. Advanced leader authoring remains deferred.</div>
  `;
  panel.querySelector('[data-static-markup-close]')?.addEventListener('click', () => togglePanel(false));
}

function collectTags() {
  const tags = [];
  const scene = getScene();
  if (scene?.traverse) {
    scene.traverse((object) => {
      const data = object.userData || {};
      const name = object.name || data.id || data.ID || '';
      if (data.TYPE === 'ISONOTE_NAME_PLATE' || data.SOURCE_NOTE_NAME || data.BOARD_TEXT) {
        tags.push({
          id: name || `isonote-${tags.length + 1}`,
          name: data.SOURCE_NOTE_NAME || data.sourceNoteName || name || `ISONOTE ${tags.length + 1}`,
          source: 'isonote',
          body: data.BOARD_TEXT || data.TEXT || data.NOTE || name || '',
          valid: true
        });
      } else if (/NAVIS_(IMPORTED|MANUAL)_TAG/i.test(name)) {
        tags.push({
          id: name,
          name: data.title || data.name || name,
          source: /IMPORTED/i.test(name) ? 'imported' : 'manual',
          body: data.body || data.comment || '',
          valid: Boolean(name)
        });
      }
    });
  }
  if (state.importedXml) {
    const importedNames = Array.from(state.importedXml.matchAll(/<(?:View|Viewpoint|Tag)[^>]*(?:name|title)="([^"]+)"/gi)).map((match, index) => ({
      id: `imported-${index + 1}`,
      name: match[1],
      source: 'imported',
      body: 'Imported XML viewpoint',
      valid: true
    }));
    tags.push(...(importedNames.length ? importedNames : [{
      id: 'imported-xml-buffer',
      name: 'Imported XML buffer',
      source: 'imported',
      body: 'Imported XML text is stored but no viewpoint names were parsed.',
      valid: Boolean(state.importedXml.trim())
    }]));
  }
  return uniqueById(tags);
}

function buildReport(tags) {
  const counts = tags.reduce((acc, tag) => {
    acc[tag.source || 'static'] = (acc[tag.source || 'static'] || 0) + 1;
    return acc;
  }, { isonote: 0, imported: 0, manual: 0, static: 0 });
  const warnings = [];
  tags.forEach((tag, index) => {
    if (!String(tag.name || '').trim()) warnings.push(`Tag ${index + 1}: missing name.`);
    if (!tag.valid) warnings.push(`${tag.name || `Tag ${index + 1}`}: incomplete static tag data.`);
  });
  if (!tags.length) warnings.push('No static tag viewpoints found.');
  return { total: tags.length, counts, warningCount: warnings.length, warnings, ready: tags.length > 0 && warnings.length === 0 };
}

function buildXml(tags) {
  const generatedAt = new Date().toISOString();
  const body = tags.map((tag, index) => `  <Viewpoint id="${escapeXml(tag.id || `tag-${index + 1}`)}" name="${escapeXml(tag.name || `Tag ${index + 1}`)}" source="${escapeXml(tag.source || 'static')}">\n    <Comment>${escapeXml(tag.body || '')}</Comment>\n  </Viewpoint>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<MarkupExport source="3DMarkupTool static core" generatedAt="${generatedAt}">\n${body}\n</MarkupExport>\n`;
}

function updateButtonState() {
  document.getElementById('staticRestoreSessionBtn')?.toggleAttribute('disabled', !localStorage.getItem(STORAGE_KEY));
  queueUiScore();
}

function getScene() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__?.scene
    || window.__3D_MARKUP_CLIP_RUNTIME__?.scene
    || window.__3D_MARKUP_APP__?.scene
    || null;
}

function showStatus(message) {
  const status = document.getElementById('runtimeStatus');
  if (status) status.textContent = message;
  window.dispatchEvent(new CustomEvent('viewer:status-message', { detail: { message, source: 'static-markup-core' } }));
}

function queueUiScore() {
  window.setTimeout(() => window.__3D_MARKUP_UI_SCORE__?.refresh?.(), 0);
  window.dispatchEvent(new Event('viewer:ui-controls-changed'));
}

function downloadText(text, filename, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.id || `${item.source}:${item.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function escapeXml(value) {
  return escapeHtml(value).replace(/'/g, '&apos;');
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureStyles() {
  if (document.getElementById('staticMarkupCoreStyles')) return;
  const style = document.createElement('style');
  style.id = 'staticMarkupCoreStyles';
  style.textContent = `
    .static-markup-tools {
      min-width: max-content;
      display: flex;
      align-items: stretch;
      gap: 8px;
      contain: layout style;
    }
    .static-markup-group { position: relative; display: inline-flex; }
    .static-markup-group-toggle {
      min-width: 76px;
      display: inline-grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 5px;
    }
    .static-markup-group-toggle .static-markup-expander {
      font-size: 11px;
      font-weight: 1000;
      opacity: .82;
      letter-spacing: -.08em;
    }
    .static-markup-group-toggle[aria-expanded="true"] .static-markup-expander { transform: rotate(90deg); }
    .static-markup-btn .static-tool-icon,
    .static-markup-group-toggle .static-tool-icon {
      font-weight: 900;
      font-size: 14px;
      line-height: 1;
    }
    .static-markup-menu {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      z-index: 92;
      min-width: 190px;
      display: grid;
      gap: 5px;
      padding: 8px;
      border: 1px solid rgba(83,125,176,.45);
      border-radius: 12px;
      background: rgba(4, 14, 28, .98);
      box-shadow: 0 18px 44px rgba(0,0,0,.42);
    }
    .static-markup-menu[hidden] { display: none; }
    .static-markup-menu-item {
      width: 100%;
      min-height: 34px;
      justify-content: flex-start;
      display: flex;
      align-items: center;
      gap: 8px;
      border-radius: 8px;
      padding: 6px 9px;
      font-size: 11px;
      text-align: left;
    }
    .static-markup-menu-note {
      padding: 5px 7px 2px;
      color: #94abc6;
      font-size: 10px;
      line-height: 1.3;
    }
    .static-markup-panel {
      position: absolute;
      left: 16px;
      top: 58px;
      width: min(360px, calc(100% - 32px));
      max-height: min(520px, calc(100% - 90px));
      overflow: auto;
      padding: 12px;
      border-radius: 14px;
      border: 1px solid rgba(76, 146, 222, .38);
      background: rgba(5, 17, 32, .94);
      color: #eaf4ff;
      box-shadow: 0 18px 50px rgba(0, 0, 0, .38);
      z-index: 28;
    }
    .static-markup-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
    .static-markup-head button { width: 30px; min-width: 30px; min-height: 30px; padding: 0; }
    .static-markup-kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-bottom: 10px; }
    .static-markup-kpis span { padding: 7px 8px; border-radius: 9px; background: rgba(30, 70, 115, .42); color: #bcd3ea; font-size: 12px; }
    .static-markup-kpis b { float: right; color: #fff; }
    .static-markup-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
    .static-markup-list li { padding: 8px; border: 1px solid rgba(83, 125, 176, .22); border-radius: 9px; background: rgba(8, 24, 43, .74); }
    .static-markup-list small { display: block; color: #8fb3d8; margin-top: 3px; text-transform: uppercase; letter-spacing: .05em; }
    .static-markup-note { margin-top: 10px; color: #9eb3c9; font-size: 12px; line-height: 1.4; }
  `;
  document.head.appendChild(style);
}
