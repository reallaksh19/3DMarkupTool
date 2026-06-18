export const DEFAULT_ISONOTE = `NODE,ISONOTE
35,:/PS-123 :ISONOTE 'REST(28kN), GUIDE(6kN),LINE STOP(15kN)'
130,:ISONOTE 'REST NOT DEFINED, SINGLE AXIS Z'
255,:ISONOTE 'REST(3kN), GUIDE(1kN)'
205,:/PS-456 :ISONOTE 'REST(10kN), HOLDDOWN,LINE STOP(6kN), Holddown without Guide Can Spring'`;

export const DEFAULT_LINE_NO = `NODE,LINE_NO
10,LINE XYZ`;

function num(value, fallback = 0) {
  if (value == null || value === '') return fallback;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : fallback;
}

function attr(el, name, fallback = '') {
  return el.getAttribute(name) ?? el.getAttribute(name.toLowerCase()) ?? fallback;
}

function isSentinel(value) {
  if (value == null || value === '') return true;
  const n = Number(value);
  return Number.isFinite(n) && n < 0;
}

function resolveField(raw, key, ctx) {
  if (!isSentinel(raw)) {
    ctx[key] = raw;
    return { value: raw, source: 'explicit' };
  }
  if (ctx[key] != null) return { value: ctx[key], source: 'inherited' };
  return { value: 'N/A', source: 'unavailable' };
}

export function parseLineNoSideload(text = '') {
  const out = new Map();
  const rows = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  for (const row of rows) {
    if (/^node\s*,/i.test(row)) continue;
    const m = row.match(/^\s*(\d+)\s*,\s*(.+?)\s*$/);
    if (m) out.set(String(Number(m[1])), m[2].trim().replace(/^['"]|['"]$/g, ''));
  }
  return out;
}

export function parseIsonoteSideload(text = '') {
  const out = new Map();
  const rows = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  for (const row of rows) {
    if (/^node\s*,/i.test(row)) continue;
    const m = row.match(/^\s*(\d+)\s*,\s*(.+?)\s*$/);
    if (m) out.set(String(Number(m[1])), m[2].trim().replace(/^"|"$/g, ''));
  }
  return out;
}

export function parseInputXml(xmlText, sideloads = {}) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error(`Invalid XML: ${err.textContent.slice(0, 220)}`);

  const lineMap = parseLineNoSideload(sideloads.lineNoText || DEFAULT_LINE_NO);
  const isonoteMap = parseIsonoteSideload(sideloads.isonoteText || DEFAULT_ISONOTE);
  for (const tag of Array.from(doc.getElementsByTagName('ISONOTE'))) {
    const node = attr(tag, 'NODE', '');
    if (node && !isonoteMap.has(String(Number(node)))) {
      isonoteMap.set(String(Number(node)), tag.textContent.trim());
    }
  }

  const elements = [];
  const nodes = new Map();
  const compCtx = {};
  let fallbackCursor = { x: 0, y: 0, z: 0 };
  const pipingElements = Array.from(doc.getElementsByTagName('PIPINGELEMENT'));

  function ensureNode(id, pos) {
    const key = String(Number(id));
    if (!nodes.has(key)) nodes.set(key, { id: key, ...pos });
    return nodes.get(key);
  }

  for (let i = 0; i < pipingElements.length; i += 1) {
    const el = pipingElements[i];
    const fromNode = String(Number(attr(el, 'FROM_NODE', String(i * 10 + 10))));
    const toNode = String(Number(attr(el, 'TO_NODE', String(i * 10 + 20))));
    const dx = num(attr(el, 'DELTA_X', '0'));
    const dy = num(attr(el, 'DELTA_Y', '0'));
    const dz = num(attr(el, 'DELTA_Z', '0'));
    const from = nodes.get(fromNode) || ensureNode(fromNode, fallbackCursor);
    const to = ensureNode(toNode, { x: from.x + dx, y: from.y + dy, z: from.z + dz });
    fallbackCursor = { x: to.x, y: to.y, z: to.z };

    const rigid = el.getElementsByTagName('RIGID')[0];
    const bend = el.getElementsByTagName('BEND')[0];
    const rawType = rigid ? attr(rigid, 'TYPE', 'Rigid') : bend ? 'BEND' : 'PIPE';
    const cleanType = rawType.toUpperCase().replace(/\s+/g, '_');
    const id = `PE_${String(i + 1).padStart(3, '0')}_${cleanType}_${fromNode}_TO_${toNode}`;
    const explicitLine = lineMap.get(fromNode) || lineMap.get(toNode) || null;
    const lineNo = explicitLine || lineMap.values().next().value || 'N/A';

    const props = {
      id,
      refNo: id,
      type: cleanType,
      meshRole: rawType,
      fromNode,
      toNode,
      lineNo,
      lineNoSource: explicitLine ? 'node-wise sideload' : lineMap.size ? 'single-anchor sideload fallback' : 'N/A',
      bore: attr(el, 'DIAMETER', 'N/A'),
      wallThickness: resolveField(attr(el, 'WALL_THICK', ''), 'wallThickness', compCtx),
      materialThickness: resolveField(attr(el, 'WALL_THICK', ''), 'materialThickness', compCtx),
      material: resolveField(attr(el, 'MATERIAL_NAME', ''), 'material', compCtx),
      pressure: resolveField(attr(el, 'PRESSURE1', ''), 'pressure', compCtx),
      hydroPressure: resolveField(attr(el, 'HYDRO_PRESSURE', ''), 'hydroPressure', compCtx),
      temp1: resolveField(attr(el, 'TEMP_EXP_C1', ''), 'temp1', compCtx),
      temp2: resolveField(attr(el, 'TEMP_EXP_C2', ''), 'temp2', compCtx),
      temp3: resolveField(attr(el, 'TEMP_EXP_C3', ''), 'temp3', compCtx),
      source: 'InputXML',
      rigidType: rigid ? attr(rigid, 'TYPE', '') : '',
      rigidWeight: rigid ? attr(rigid, 'WEIGHT', '') : '',
      bendRadius: bend ? attr(bend, 'RADIUS', '') : '',
      bendAngle: bend ? attr(bend, 'ANGLE1', '') : ''
    };

    elements.push({ id, fromNode, toNode, from, to, dx, dy, dz, type: cleanType, rawType, props });
  }

  const restraints = Array.from(doc.getElementsByTagName('RESTRAINT')).map((r, i) => ({
    id: `INPUTXML_RESTRAINT_${i + 1}`,
    source: 'InputXML',
    node: String(Number(attr(r, 'NODE', '0'))),
    typeCode: attr(r, 'TYPE', ''),
    rawType: attr(r, 'TYPE', ''),
    gapMm: parseGapValue(attr(r, 'GAP', '')),
    xCos: num(attr(r, 'XCOSINE', '0')),
    yCos: num(attr(r, 'YCOSINE', '0')),
    zCos: num(attr(r, 'ZCOSINE', '0'))
  }));

  return { doc, elements, nodes, restraints, lineMap, isonoteMap };
}

export function parseGapValue(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function parseGapFromText(text) {
  const m = String(text || '').match(/\bGAP\s*(?:=|:)?\s*(-?\d+(?:\.\d+)?)\s*(?:MM|MILLIMETER|MILLIMETERS)?\b/i);
  return m ? parseGapValue(m[1]) : null;
}

function loadFromClause(clause) {
  const m = clause.match(/\(([^)]*?\d+(?:\.\d+)?\s*kN[^)]*?)\)/i);
  if (!m) return null;
  const lm = m[1].match(/\d+(?:\.\d+)?\s*kN/i);
  return lm ? lm[0].replace(/\s+/g, '') : null;
}

export function parseIsonoteExpectedRecords(model, options = {}) {
  const records = [];
  const decision = options.singleAxisDecision || 'warning';
  for (const [node, note] of model.isonoteMap.entries()) {
    const upper = note.toUpperCase();
    const negRest = /REST\s+NOT\s+DEFINED|NO\s+REST|WITHOUT\s+REST/.test(upper);
    const negGuide = /WITHOUT\s+GUIDE|NO\s+GUIDE|GUIDE\s+NOT\s+REQUIRED/.test(upper);
    const negLineStop = /WITHOUT\s+LINE\s*STOP|NO\s+LINE\s*STOP/.test(upper);
    const clauses = note.split(/,(?![^()]*\))/).map(s => s.trim()).filter(Boolean);
    for (const clause of clauses) {
      const c = clause.toUpperCase();
      const gapMm = parseGapFromText(clause);
      if (/REST\s*\(/.test(c) && !negRest) {
        records.push(baseRec(node, note, 'REST', '+Y', loadFromClause(clause), gapMm));
      }
      if (/\bGUIDE\b/.test(c) && !negGuide) {
        records.push(baseRec(node, note, 'GUIDE', 'LATERAL_DERIVED', loadFromClause(clause), gapMm));
      }
      if (/LINE\s*STOP/.test(c) && !negLineStop) {
        records.push(baseRec(node, note, 'LINE_STOP', 'PIPE_AXIAL_±', loadFromClause(clause), gapMm));
      }
      if (/\bLIM\b|\bLIMIT\b/.test(c)) {
        records.push(baseRec(node, note, 'LIMIT', 'PIPE_AXIAL_±', loadFromClause(clause), gapMm));
      }
      if (/HOLD\s*DOWN|HOLDDOWN/.test(c)) {
        records.push(baseRec(node, note, 'HOLDDOWN', '±Y', loadFromClause(clause), gapMm));
      }
      if (/CAN\s+SPRING|SPRING\s+CAN/.test(c)) {
        records.push({ ...baseRec(node, note, 'SPRING_WARNING', 'BELOW_PIPE', null, gapMm), sourceMode: 'WARNING_ISONOTE', warningText: 'Can Spring / Spring Can' });
      }
      const single = c.match(/SINGLE\s+AXIS\s+([XYZ])/);
      if (single) {
        if (decision === 'warning') {
          records.push({ ...baseRec(node, note, 'AXIS_RESTRAINT_UNRESOLVED', single[1], null, gapMm), popupRequired: true, warningText: `SINGLE AXIS ${single[1]} requires + or - sign` });
        } else {
          records.push({ ...baseRec(node, note, 'AXIS_RESTRAINT', `${decision}${single[1]}`, null, gapMm), popupRequired: false });
        }
      }
    }
  }
  return records;
}

function baseRec(node, note, family, axis, loadText, gapMm) {
  return {
    id: `ISONOTE_${node}_${family}_${Math.random().toString(36).slice(2, 8)}`,
    source: 'ISONOTE',
    sourceMode: 'EXPECTED_RESTRAINT',
    node: String(Number(node)),
    family,
    axis,
    sign: axis.includes('±') ? '±' : axis.startsWith('+') ? '+' : axis.startsWith('-') ? '-' : 'UNKNOWN',
    loadText: loadText || null,
    gapMm: gapMm ?? null,
    sourceNoteName: note
  };
}
