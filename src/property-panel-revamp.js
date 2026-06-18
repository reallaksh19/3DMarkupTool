const PANEL_ID = 'propertiesBody';
const MISSING_VALUES = new Set(['', '-', 'N/A', 'NA', 'NULL', 'UNDEFINED', 'UNAVAILABLE', 'NONE']);
const PANEL_KIND_LABELS = {
  COMPONENT: 'Component',
  NODE: 'Node',
  NODE_ANNOTATION: 'Node',
  ISONOTE_ANNOTATION: 'ISONOTE',
  SUPPORT_RESTRAINT: 'Support',
  ISONOTE_NAME_PLATE: 'ISONOTE',
  ISONOTE_LEADER: 'ISONOTE Leader',
  UNKNOWN: 'Object'
};

let observer;
let rendering = false;
let showMissing = false;
let latestModel = null;

initPropertyPanelRevamp();

function initPropertyPanelRevamp() {
  const boot = () => {
    const body = document.getElementById(PANEL_ID);
    if (!body) return false;
    observer = new MutationObserver(() => scheduleRevamp(body));
    observer.observe(body, { childList: true, subtree: false });
    scheduleRevamp(body);
    return true;
  };
  if (!boot()) document.addEventListener('DOMContentLoaded', boot, { once: true });
}

function scheduleRevamp(body) {
  if (rendering || !body || body.classList.contains('empty-state')) return;
  if (body.dataset.revamped === 'true') return;
  queueMicrotask(() => revampPanel(body));
}

function revampPanel(body) {
  if (rendering || !body || body.classList.contains('empty-state')) return;
  const legacy = readLegacyPanel(body);
  if (!legacy) return;
  latestModel = buildPanelModel(legacy);
  rendering = true;
  body.dataset.revamped = 'true';
  body.classList.add('properties-body--revamped');
  body.innerHTML = renderPanel(latestModel);
  bindPanelActions(body);
  rendering = false;
}

function readLegacyPanel(body) {
  const card = body.querySelector('.selected-card');
  const title = cleanText(card?.querySelector('.selected-card-title span')?.textContent || 'Selected Object');
  const type = cleanText(card?.querySelector('.selected-card-title .badge')?.textContent || 'UNKNOWN');
  const subtitle = cleanText(card?.querySelector('.selected-card-subtitle')?.textContent || '');
  const badges = Array.from(card?.querySelectorAll('.badge-row .badge') || []).map((b) => cleanText(b.textContent)).filter(Boolean);
  const sections = Array.from(body.querySelectorAll('.prop-section')).map(readLegacySection).filter(Boolean);
  const flat = flattenSections(sections);
  return { title, type, subtitle, badges, sections, flat };
}

function readLegacySection(details) {
  const title = cleanText(details.querySelector('summary')?.textContent || 'Metadata');
  const children = Array.from(details.querySelector('.prop-grid')?.children || []);
  const rows = [];
  for (let index = 0; index < children.length; index += 2) {
    const key = cleanText(children[index]?.textContent || '');
    const valueNode = children[index + 1];
    const value = cleanText(valueNode?.childNodes?.[0]?.textContent || valueNode?.textContent || '');
    const chips = Array.from(valueNode?.querySelectorAll?.('.chip, .badge') || []).map((chip) => cleanText(chip.textContent)).filter(Boolean);
    if (key) rows.push({ key, value, chips });
  }
  return { title, rows };
}

function flattenSections(sections) {
  const flat = new Map();
  for (const section of sections) {
    for (const row of section.rows) {
      if (!flat.has(row.key)) flat.set(row.key, row.value);
      flat.set(normalizeKey(row.key), row.value);
    }
  }
  return flat;
}

function buildPanelModel(legacy) {
  const kind = inferKind(legacy);
  const node = valueOf(legacy, ['Node', 'NODE', 'node']) || nodeFromText(`${legacy.title} ${legacy.subtitle}`);
  const lineNo = valueOf(legacy, ['Line No.', 'Line No', 'lineNo', 'LINE_NO']);
  const source = bestSource(legacy);
  const rawRows = legacy.sections.flatMap((section) => section.rows.map((row) => ({ ...row, section: section.title })));

  const base = {
    kind,
    node,
    lineNo,
    source,
    rawRows,
    badges: buildBadges(legacy, kind, source),
    actions: true
  };

  if (kind === 'COMPONENT') return buildComponentModel(legacy, base);
  if (kind === 'NODE' || kind === 'NODE_ANNOTATION') return buildNodeModel(legacy, base);
  if (kind === 'ISONOTE_ANNOTATION' || kind === 'ISONOTE_NAME_PLATE') return buildIsonoteModel(legacy, base);
  if (kind === 'SUPPORT_RESTRAINT') return buildSupportModel(legacy, base);
  return buildUnknownModel(legacy, base);
}

function inferKind(legacy) {
  const text = `${legacy.type} ${legacy.title} ${legacy.subtitle} ${valueOf(legacy, ['TYPE', 'type', 'Name', 'name'])}`.toUpperCase();
  if (text.includes('SUPPORT_RESTRAINT')) return 'SUPPORT_RESTRAINT';
  if (text.includes('COMPONENT')) return 'COMPONENT';
  if (text.includes('ISONOTE')) return 'ISONOTE_ANNOTATION';
  if (text.includes('NODE_ANNOTATION') || /^NODE[-_ ]?\d+/.test(text) || /NODE-\d+-LABEL/.test(text)) return 'NODE';
  if (legacy.type === 'NODE') return 'NODE';
  return legacy.type && legacy.type !== 'Object' ? legacy.type : 'UNKNOWN';
}

function buildComponentModel(legacy, base) {
  const id = valueOf(legacy, ['ID', 'id', 'Ref No.', 'Ref No']) || legacy.title;
  const type = valueOf(legacy, ['Type', 'engineeringType', 'ENGINEERING_TYPE', 'Mesh Role']) || 'Component';
  return {
    ...base,
    title: id,
    subtitle: type,
    sections: [
      sectionModel('Critical Engineering Fields', true, [
        row('Line No.', base.lineNo, sourceChip(valueOf(legacy, ['Line No Source', 'lineNoSource', 'LINE_NO_SOURCE']))),
        row('From Node', valueOf(legacy, ['From Node', 'fromNode', 'FROM_NODE'])),
        row('To Node', valueOf(legacy, ['To Node', 'toNode', 'TO_NODE'])),
        row('Type', type),
        row('Bore', valueOf(legacy, ['Bore', 'bore', 'BORE'])),
        row('Material', valueOf(legacy, ['Material', 'material', 'MATERIAL']), sourceChip(valueOf(legacy, ['materialSource', 'MATERIAL_SOURCE'])))
      ]),
      sectionModel('Analysis Data', false, [
        row('Wall Thickness', valueOf(legacy, ['Wall Thickness', 'wallThickness', 'WALL_THICKNESS']), sourceChip(valueOf(legacy, ['wallThicknessSource', 'WALL_THICKNESS_SOURCE']))),
        row('Pressure', valueOf(legacy, ['Pressure', 'pressure', 'PRESSURE']), sourceChip(valueOf(legacy, ['pressureSource', 'PRESSURE_SOURCE']))),
        row('Hydro Pressure', valueOf(legacy, ['Hydro Pressure', 'hydroPressure', 'HYDRO_PRESSURE'])),
        row('Temp 1', valueOf(legacy, ['Temp1', 'temp1', 'TEMP1'])),
        row('Temp 2', valueOf(legacy, ['Temp2', 'temp2', 'TEMP2'])),
        row('Temp 3', valueOf(legacy, ['Temp3', 'temp3', 'TEMP3']))
      ]),
      rawSection(base.rawRows)
    ]
  };
}

function buildNodeModel(legacy, base) {
  const node = base.node || nodeFromText(`${legacy.title} ${legacy.subtitle}`) || valueOf(legacy, ['Label']);
  return {
    ...base,
    title: node ? `Node ${node}` : 'Node',
    subtitle: base.lineNo ? `Line ${base.lineNo}` : sourceLabel(base.source),
    sections: [
      sectionModel('Line / Node', true, [
        row('Node', node),
        row('Line No.', base.lineNo, sourceChip(valueOf(legacy, ['Line No Source', 'lineNoSource', 'LINE_NO_SOURCE']))),
        row('Coordinates', coordinateValue(legacy)),
        row('Source', base.source)
      ]),
      sectionModel('Related Annotations', true, [
        row('ISONOTE', valueOf(legacy, ['ISONOTE', 'Source Note', 'Note', 'sourceNoteName', 'SOURCE_NOTE_NAME'])),
        row('Support Family', valueOf(legacy, ['Family', 'family', 'FAMILY'])),
        row('Connected Object', legacy.subtitle && !/selected object/i.test(legacy.subtitle) ? legacy.subtitle : '')
      ]),
      rawSection(base.rawRows)
    ]
  };
}

function buildIsonoteModel(legacy, base) {
  const note = valueOf(legacy, ['Source Note', 'Note', 'sourceNoteName', 'SOURCE_NOTE_NAME', 'BOARD_TEXT', 'Full Text', 'fullText']) || legacy.subtitle || legacy.title;
  const parsed = parseIsonote(note);
  return {
    ...base,
    title: base.node ? `ISONOTE — Node ${base.node}` : 'ISONOTE Annotation',
    subtitle: 'Side-loaded annotation',
    sections: [
      sectionModel('ISONOTE Summary', true, [
        row('PS No.', parsed.psNo),
        row('Node', base.node),
        row('Source', base.source || 'Sideload CSV'),
        row('REST', parsed.rest),
        row('GUIDE', parsed.guide),
        row('LINE STOP', parsed.lineStop),
        row('HOLDDOWN', parsed.hold),
        row('Warning', parsed.warning)
      ]),
      sectionModel('Raw ISONOTE', true, [row('Text', note)]),
      rawSection(base.rawRows)
    ]
  };
}

function buildSupportModel(legacy, base) {
  const family = valueOf(legacy, ['Family', 'family', 'FAMILY']) || 'Support';
  return {
    ...base,
    title: `${family} — Node ${base.node || 'N/A'}`,
    subtitle: sourceLabel(base.source),
    sections: [
      sectionModel('Support / Restraint', true, [
        row('Family', family),
        row('Node', base.node),
        row('Axis', valueOf(legacy, ['Axis', 'axis', 'AXIS'])),
        row('Sign', valueOf(legacy, ['Sign', 'sign', 'SIGN'])),
        row('Load', valueOf(legacy, ['Load', 'loadText', 'LOAD_TEXT'])),
        row('Gap mm', valueOf(legacy, ['Gap mm', 'gapMm', 'GAP_MM']))
      ]),
      sectionModel('Mapping / Source', true, [
        row('Source', base.source),
        row('Source Class', valueOf(legacy, ['Source Class', 'sourceClass', 'SOURCE_CLASS'])),
        row('Source Mode', valueOf(legacy, ['Source Mode', 'sourceMode', 'SOURCE_MODE'])),
        row('Visual Resolver', valueOf(legacy, ['Visual Resolver', 'visualResolver', 'visualResolverApplied']))
      ]),
      sectionModel('ISONOTE / Warnings', false, [
        row('Source Note', valueOf(legacy, ['Source Note', 'sourceNoteName', 'SOURCE_NOTE_NAME'])),
        row('Warning', valueOf(legacy, ['Warning', 'warningText', 'WARNING_TEXT'])),
        row('Popup Required', valueOf(legacy, ['Popup Required', 'popupRequired', 'POPUP_REQUIRED']))
      ]),
      rawSection(base.rawRows)
    ]
  };
}

function buildUnknownModel(legacy, base) {
  return {
    ...base,
    title: legacy.title || 'Selected Object',
    subtitle: legacy.subtitle || 'Unclassified metadata',
    sections: [
      sectionModel('Resolved Metadata', true, visibleRows(base.rawRows.slice(0, 12))),
      rawSection(base.rawRows)
    ]
  };
}

function sectionModel(title, open, rows) {
  return { title, open, rows: rows.filter(Boolean) };
}

function rawSection(rawRows) {
  return sectionModel('Raw Metadata', false, rawRows.map((r) => row(r.key, r.value, r.chips?.map(chip).join('') || '')));
}

function visibleRows(rows) {
  return rows.map((r) => row(r.key, r.value, r.chips?.map(chip).join('') || '')).filter(Boolean);
}

function row(key, value, extra = '') {
  if (!showMissing && isMissing(value)) return null;
  return { key, value: cleanText(value || ''), extra };
}

function buildBadges(legacy, kind, source) {
  const badges = new Set();
  badges.add(PANEL_KIND_LABELS[kind] || kind);
  if (source) badges.add(sourceLabel(source));
  for (const badge of legacy.badges) {
    if (!/unavailable/i.test(badge)) badges.add(badge);
  }
  if (/sideload/i.test(`${source} ${legacy.subtitle} ${legacy.title}`)) badges.add('Sideloaded');
  return Array.from(badges).filter(Boolean);
}

function bestSource(legacy) {
  return valueOf(legacy, ['Source', 'SOURCE', 'source', 'Source Class', 'sourceClass', 'Line No Source', 'lineNoSource']) || legacy.badges.find((b) => !/unavailable/i.test(b)) || '';
}

function coordinateValue(legacy) {
  const x = valueOf(legacy, ['X', 'x']);
  const y = valueOf(legacy, ['Y', 'y']);
  const z = valueOf(legacy, ['Z', 'z']);
  return [x, y, z].some((v) => !isMissing(v)) ? `${cleanText(x)}, ${cleanText(y)}, ${cleanText(z)}` : '';
}

function parseIsonote(text) {
  const t = String(text || '');
  return {
    psNo: t.match(/PS[-_ ]?\d+/i)?.[0]?.replace(/_/g, '-') || '',
    rest: t.match(/REST\s*\(?\s*\d+(?:\.\d+)?\s*kN\)?/i)?.[0] || (/NO\s+REST|REST\s+NOT\s+DEFINED/i.test(t) ? 'Not defined' : ''),
    guide: t.match(/GUIDE\s*\(?\s*\d+(?:\.\d+)?\s*kN\)?/i)?.[0] || (/NO\s+GUIDE|WITHOUT\s+GUIDE/i.test(t) ? 'No guide' : ''),
    lineStop: t.match(/(?:LINE\s*STOP|LS)\s*\(?\s*\d+(?:\.\d+)?\s*kN\)?/i)?.[0] || '',
    hold: /HOLD\s*DOWN|HOLDDOWN|\bHOLD\b/i.test(t) ? 'Hold down' : '',
    warning: /SPRING|SINGLE\s+AXIS|WARNING|WARN/i.test(t) ? (t.match(/SINGLE\s+AXIS\s+[XYZ]/i)?.[0] || 'Spring / warning') : ''
  };
}

function renderPanel(model) {
  return `<div class="revamp-panel">
    ${renderSummary(model)}
    ${renderActions()}
    ${model.sections.map(renderSection).join('')}
  </div>`;
}

function renderSummary(model) {
  return `<section class="revamp-summary revamp-kind-${escapeAttr(model.kind.toLowerCase())}">
    <div class="revamp-title-row">
      <div>
        <div class="revamp-eyebrow">Selected Object</div>
        <h3>${escapeHtml(model.title)}</h3>
      </div>
      <span class="revamp-kind">${escapeHtml(PANEL_KIND_LABELS[model.kind] || model.kind)}</span>
    </div>
    <div class="revamp-subtitle">${escapeHtml(model.subtitle || 'Metadata resolved')}</div>
    <div class="revamp-badges">${model.badges.map((b) => `<span>${escapeHtml(b)}</span>`).join('')}</div>
  </section>`;
}

function renderActions() {
  return `<div class="revamp-actions">
    <button type="button" data-property-action="fit">Fit</button>
    <button type="button" data-property-action="copy">Copy JSON</button>
    <button type="button" data-property-action="missing">${showMissing ? 'Hide missing' : 'Show missing'}</button>
  </div>`;
}

function renderSection(section) {
  if (!section.rows.length && !showMissing) return '';
  return `<details class="revamp-section" ${section.open ? 'open' : ''}>
    <summary>${escapeHtml(section.title)}</summary>
    <div class="revamp-grid">${section.rows.map(renderRow).join('')}</div>
  </details>`;
}

function renderRow(rowData) {
  const missing = isMissing(rowData.value);
  if (missing && !showMissing) return '';
  return `<div class="revamp-key">${escapeHtml(rowData.key)}</div><div class="revamp-value ${missing ? 'is-missing' : ''}">${escapeHtml(missing ? 'Missing' : rowData.value)}${rowData.extra || ''}</div>`;
}

function bindPanelActions(body) {
  body.querySelector('[data-property-action="fit"]')?.addEventListener('click', () => document.getElementById('fitSelectionBtn')?.click());
  body.querySelector('[data-property-action="missing"]')?.addEventListener('click', () => {
    showMissing = !showMissing;
    body.dataset.revamped = 'false';
    if (latestModel) body.innerHTML = renderPanel(buildPanelModel({ ...latestModelToLegacy(latestModel) }));
    body.dataset.revamped = 'true';
    bindPanelActions(body);
  });
  body.querySelector('[data-property-action="copy"]')?.addEventListener('click', async () => {
    const payload = latestModel ? JSON.stringify(latestModel.rawRows.reduce((acc, r) => ({ ...acc, [r.key]: r.value }), {}), null, 2) : '{}';
    try { await navigator.clipboard.writeText(payload); flashAction(body, 'Copied'); } catch { flashAction(body, 'Copy failed'); }
  });
}

function latestModelToLegacy(model) {
  return {
    title: model.title,
    type: model.kind,
    subtitle: model.subtitle,
    badges: model.badges,
    sections: [{ title: 'Raw Metadata', rows: model.rawRows }],
    flat: flattenSections([{ title: 'Raw Metadata', rows: model.rawRows }])
  };
}

function flashAction(body, text) {
  const target = body.querySelector('[data-property-action="copy"]');
  if (!target) return;
  const old = target.textContent;
  target.textContent = text;
  setTimeout(() => { target.textContent = old; }, 1100);
}

function valueOf(legacy, keys) {
  for (const key of keys) {
    const direct = legacy.flat.get(key);
    const normalized = legacy.flat.get(normalizeKey(key));
    if (!isMissing(direct)) return direct;
    if (!isMissing(normalized)) return normalized;
  }
  return '';
}

function nodeFromText(text) {
  return String(text || '').match(/(?:NODE|node|N)[-_ ]?(\d+)/)?.[1] || '';
}

function sourceChip(text) {
  return isMissing(text) ? '' : chip(sourceLabel(text));
}

function chip(text) {
  return `<span class="revamp-chip">${escapeHtml(text)}</span>`;
}

function sourceLabel(text) {
  const value = String(text || '').trim();
  if (/sideload/i.test(value)) return 'Sideloaded';
  if (/expected|isonote/i.test(value)) return 'ISONOTE';
  if (/actual|inputxml/i.test(value)) return 'InputXML';
  if (/fallback/i.test(value)) return 'Fallback';
  return value;
}

function isMissing(value) {
  const text = cleanText(value).toUpperCase();
  return MISSING_VALUES.has(text);
}

function normalizeKey(key) {
  return String(key || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/\s+/g, '-');
}
