import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

installMinimalDomParser();

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = resolveOutDir(process.argv);
const baseName = 'BM_CII_glb_catalogue_visual';

const { parseMarkupSource } = await import('../src/source-parser.js');
const { buildValveFlangePrimitiveAdapterPlan } = await import('../src/valve-flange-primitive-adapter.js');
const { VALVE_FLANGE_VISUAL_CATALOG_SCHEMA } = await import('../src/valve-flange-visual-catalog.js');

const sampleXml = readFileSync(join(repoRoot, 'samples', 'BM_CII_Enriched_v8_lite.XML'), 'utf8');
const model = parseMarkupSource(sampleXml, { filename: 'BM_CII_Enriched_v8_lite.XML', supportMode: 'inputxml-actual' });
const catalogueComponents = (model.elements || []).map(auditElement).filter(Boolean);
const audit = buildAudit(model, catalogueComponents);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${baseName}.audit.json`), `${JSON.stringify(audit, null, 2)}\n`);
writeFileSync(join(outDir, `${baseName}.summary.md`), renderMarkdownSummary(audit));

console.log(`Generated GLB catalogue visual audit in ${outDir}`);
console.log(`Catalogue candidates: ${audit.summary.catalogueCandidateCount}`);
console.log(`Valve candidates: ${audit.summary.valveCandidateCount}`);
console.log(`Flange candidates: ${audit.summary.flangeCandidateCount}`);
console.log(`Visual-quality issues: ${audit.summary.issueCount}`);

if (audit.issues.length) {
  for (const issue of audit.issues) console.error(`${issue.componentId}: ${issue.message}`);
  process.exitCode = 1;
}

function auditElement(element) {
  const plan = buildValveFlangePrimitiveAdapterPlan(element, metricsForElement(element));
  if (!plan) return null;
  const roleMetrics = plan.visiblePrimitives.map((primitive) => ({
    role: primitive.role,
    exportKind: primitive.exportKind,
    sourceKind: primitive.sourceKind,
    materialRole: primitive.materialRole,
    spanLength: round(primitive.length),
    spanFraction: round(ratio(primitive.length, plan.metrics.length)),
    radius: round(primitive.radius),
    radiusStart: round(primitive.radiusStart),
    radiusEnd: round(primitive.radiusEnd),
    radiusRatioToPipe: round(ratio(primitive.radius, plan.metrics.pipeRadius)),
    boltCircleRadius: round(primitive.boltCircleRadius),
    boltCircleRatioToPipe: round(ratio(primitive.boltCircleRadius, plan.metrics.pipeRadius)),
    boltRadius: round(primitive.boltRadius),
    replacesCenterlinePipe: primitive.replacesCenterlinePipe,
    overlayOnly: primitive.overlayOnly,
    thinPlate: primitive.thinPlate,
    thinRaisedFace: primitive.thinRaisedFace,
    proportionalShoulder: primitive.proportionalShoulder
  }));
  const visualQuality = evaluateVisualQuality(plan, roleMetrics);
  return {
    componentId: plan.componentId,
    componentClass: plan.componentClass,
    componentType: plan.componentType,
    visualKey: plan.visualKey,
    visualRecipeId: plan.visualRecipeId,
    metrics: {
      length: round(plan.metrics.length),
      pipeRadius: round(plan.metrics.pipeRadius),
      lengthToPipeRadius: round(ratio(plan.metrics.length, plan.metrics.pipeRadius))
    },
    primitiveCount: plan.primitiveCount,
    visiblePrimitiveCount: plan.visiblePrimitiveCount,
    continuity: {
      ok: plan.continuity.ok,
      gapCount: plan.continuity.gaps.length,
      overlapCount: plan.continuity.overlaps.length,
      spanCount: plan.continuity.spans.length
    },
    visualQuality,
    roleMetrics
  };
}

function buildAudit(model, components) {
  const issues = components.flatMap((entry) => entry.visualQuality.issues.map((message) => ({
    componentId: entry.componentId,
    componentClass: entry.componentClass,
    componentType: entry.componentType,
    message
  })));
  const valveComponents = components.filter((entry) => entry.componentClass === 'VALVE');
  const flangeComponents = components.filter((entry) => entry.componentClass === 'FLANGE');
  const continuityOkCount = components.filter((entry) => entry.continuity.ok).length;
  return {
    schema: 'GlbCatalogueVisualAudit.v1',
    generatedAt: new Date().toISOString(),
    sample: 'samples/BM_CII_Enriched_v8_lite.XML',
    sourceKind: model.sourceKind || model.detectedSource?.label || 'unknown',
    visualCatalogSchema: VALVE_FLANGE_VISUAL_CATALOG_SCHEMA,
    glbPreviewPath: {
      catalogueResolver: 'getValveFlangeVisualSpec()',
      primitivePlanBuilder: 'buildLinearVisualPrimitivePlan()',
      auditBridge: 'buildValveFlangePrimitiveAdapterPlan()',
      note: 'This audit validates the catalogue primitive plan used by the GLB preview path; it does not render a binary GLB.'
    },
    summary: {
      elementCount: (model.elements || []).length,
      catalogueCandidateCount: components.length,
      valveCandidateCount: valveComponents.length,
      flangeCandidateCount: flangeComponents.length,
      continuityOkCount,
      allContinuityOk: continuityOkCount === components.length,
      issueCount: issues.length,
      componentTypes: countBy(components, (entry) => entry.componentType),
      visualRecipeIds: countBy(components, (entry) => entry.visualRecipeId)
    },
    policies: {
      proportionalFallback: true,
      rendererNeutralAudit: true,
      rvmWriterUnaffected: true,
      asmeDimensionalDatabaseBacked: false
    },
    issues,
    catalogueComponents: components
  };
}

function evaluateVisualQuality(plan, roles) {
  const issues = [];
  if (!plan.continuity.ok) issues.push('Catalogue centerline replacement spans must remain continuous.');
  if (plan.policies.proportionalFallback !== true) issues.push('Catalogue plan must keep proportional fallback policy.');
  if (plan.policies.asmeDimensionalDatabaseBacked !== false) issues.push('Catalogue plan must not claim ASME dimensional DB backing.');
  if (plan.componentClass === 'VALVE') evaluateValve(plan, roles, issues);
  if (plan.componentClass === 'FLANGE') evaluateFlange(plan, roles, issues);
  return { ok: issues.length === 0, issues };
}

function evaluateValve(plan, roles, issues) {
  const body = roles.find((entry) => entry.role === 'VALVE_BODY');
  const collars = roles.filter((entry) => /^END_COLLAR_/.test(entry.role));
  const shoulders = roles.filter((entry) => /^VALVE_NECK_/.test(entry.role));
  if (!body) issues.push('Valve catalogue visual must include VALVE_BODY.');
  if (collars.length < 2) issues.push('Valve visual must include two end collars.');
  if (shoulders.length < 2) issues.push('Valve visual must include two tapered shoulders/necks.');
  if (!body) return;
  if (!(body.spanFraction >= 0.24 && body.spanFraction <= 0.68)) issues.push(`Valve body span fraction must stay compact; observed ${body.spanFraction}.`);
  const maxCollarLength = Math.max(0, ...collars.map((entry) => entry.spanLength || 0));
  for (const collar of collars) {
    if (!(collar.radius < body.radius)) issues.push(`${collar.role} radius must stay below valve body radius.`);
    if (!(collar.spanFraction <= 0.08)) issues.push(`${collar.role} must remain a thin flange/collar plate.`);
  }
  for (const shoulder of shoulders) {
    if (!(shoulder.radiusStart !== shoulder.radiusEnd)) issues.push(`${shoulder.role} must remain tapered.`);
    if (!(shoulder.spanLength > maxCollarLength)) issues.push(`${shoulder.role} should be longer than the thin end collar.`);
  }
}

function evaluateFlange(plan, roles, issues) {
  const plates = roles.filter((entry) => /FLANGE_(?:DISC|PLATE)/.test(entry.role));
  const raisedFaces = roles.filter((entry) => /RAISED_FACE/.test(entry.role));
  const gasket = roles.find((entry) => entry.role === 'GASKET_CENTER');
  const boltPattern = roles.find((entry) => entry.role === 'BOLT_PATTERN');
  const weldNecks = roles.filter((entry) => /WELD_NECK/.test(entry.role));
  if (plates.length < 1) issues.push('Flange visual must include flange plate/disc primitives.');
  if (weldNecks.length < 1) issues.push('Flange visual must include weld-neck/taper primitive.');
  if (raisedFaces.length < 1) issues.push('Flange visual must include raised-face primitive.');
  const maxPlateRadius = Math.max(0, ...plates.map((entry) => entry.radius || 0));
  for (const plate of plates) {
    if (!(plate.spanFraction <= 0.10)) issues.push(`${plate.role} must remain visually thin.`);
    if (!(ratio(plate.radius, plan.metrics.pipeRadius) <= 1.72)) issues.push(`${plate.role} radius must stay in compact fallback range.`);
  }
  for (const face of raisedFaces) {
    if (!(face.radius < maxPlateRadius)) issues.push(`${face.role} radius must stay inside flange plate radius.`);
    if (!(face.spanFraction <= 0.03)) issues.push(`${face.role} must remain a thin raised face.`);
  }
  if (gasket && !(gasket.radius < maxPlateRadius)) issues.push('Gasket radius must stay inside flange plate radius.');
  if (boltPattern) {
    if (!(boltPattern.boltCircleRadius < maxPlateRadius)) issues.push('Bolt circle radius must stay inside flange plate radius.');
    if (!(boltPattern.boltRadius < maxPlateRadius * 0.08)) issues.push('Bolt radius must remain visually subordinate to flange plate.');
  }
}

function metricsForElement(element = {}) {
  const props = element.props || {};
  const vectorLength = Math.hypot(Number(element.dx) || 0, Number(element.dy) || 0, Number(element.dz) || 0);
  const bore = positiveNumber(props.bore, positiveNumber(props.startBore, positiveNumber(props.endBore, 100)));
  const fallbackLength = positiveNumber(props.faceToFaceLength, positiveNumber(props.length, Math.max(bore, 100)));
  return { length: positiveNumber(vectorLength, fallbackLength), pipeRadius: Math.max(bore / 2, 1) };
}

function renderMarkdownSummary(audit) {
  const s = audit.summary;
  return `# BM_CII GLB Catalogue Visual Audit\n\n` +
    `Schema: \`${audit.schema}\`\n\n` +
    `Sample: \`${audit.sample}\`\n\n` +
    `## Purpose\n\n` +
    `This report audits the proportional valve/flange catalogue primitive plan used by the GLB preview path. It validates roles, spans, radii, and continuity before Three.js mesh creation.\n\n` +
    `## Summary\n\n` +
    `| Metric | Value |\n|---|---:|\n` +
    `| Parsed elements | ${s.elementCount} |\n` +
    `| Catalogue candidates | ${s.catalogueCandidateCount} |\n` +
    `| Valve candidates | ${s.valveCandidateCount} |\n` +
    `| Flange candidates | ${s.flangeCandidateCount} |\n` +
    `| Continuity OK | ${s.continuityOkCount} / ${s.catalogueCandidateCount} |\n` +
    `| Visual-quality issues | ${s.issueCount} |\n\n` +
    `## Component types\n\n${renderCountList(s.componentTypes)}\n` +
    `## Visual recipe IDs\n\n${renderCountList(s.visualRecipeIds)}\n` +
    `## Catalogue visual-quality checks\n\n` +
    `- ${s.allContinuityOk ? '✅' : '❌'} continuous centerline replacement spans\n` +
    `- ${s.issueCount === 0 ? '✅' : '❌'} compact valve body / collar / flange-radius constraints\n` +
    `- ✅ proportional fallback is explicit\n` +
    `- ✅ no ASME/rating-size dimensional database claim\n\n` +
    `## Scope note\n\n` +
    `This is a GLB-preview catalogue-plan audit, not a binary GLB export and not an ASME dimensional database validation. RVM writer behavior is intentionally unaffected.\n`;
}

function renderCountList(counts) {
  const entries = Object.entries(counts || {}).sort(([a], [b]) => a.localeCompare(b));
  return entries.length ? entries.map(([key, value]) => `- \`${key}\`: ${value}`).join('\n') + '\n' : '- none\n';
}

function countBy(values, keyFn) {
  const counts = {};
  for (const value of values) {
    const key = keyFn(value) || 'UNKNOWN';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function resolveOutDir(args) {
  const outArg = args.find((arg) => arg.startsWith('--outdir='));
  if (!outArg) return join(repoRoot, 'artifacts', 'glb-catalogue-visual-audit');
  const value = outArg.slice('--outdir='.length);
  return isAbsolute(value) ? value : join(repoRoot, value);
}

function ratio(value, divisor) {
  const n = Number(value);
  const d = Number(divisor);
  return Number.isFinite(n) && Number.isFinite(d) && Math.abs(d) > 1e-9 ? n / d : undefined;
}

function positiveNumber(value, fallback) {
  if (value && typeof value === 'object' && 'value' in value) value = value.value;
  const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
  const n = match ? Number(match[0]) : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function round(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 1000000) / 1000000 : undefined;
}

function installMinimalDomParser() {
  if (globalThis.DOMParser) return;
  class MinimalXmlNode {
    constructor(tagName = '', attributes = {}) { this.tagName = tagName; this.attributes = attributes; this.children = []; this._text = ''; }
    getAttribute(name) { return this.attributes[name] ?? this.attributes[String(name).toLowerCase()] ?? null; }
    get textContent() { return decodeXmlEntities(this._text + this.children.map((child) => child.textContent).join('')); }
    getElementsByTagName(name) {
      const wanted = String(name || '').toUpperCase();
      const hits = [];
      const visit = (node) => { if (String(node.tagName || '').toUpperCase() === wanted) hits.push(node); for (const child of node.children) visit(child); };
      for (const child of this.children) visit(child);
      return hits;
    }
    querySelector(selector) { return selector === 'parsererror' ? null : null; }
  }
  globalThis.DOMParser = class MinimalDomParser {
    parseFromString(text) {
      const document = new MinimalXmlNode('#document', {});
      const stack = [document];
      const pattern = /<([^>]+)>|([^<]+)/g;
      let match;
      while ((match = pattern.exec(String(text || '')))) {
        const tag = match[1];
        const rawText = match[2];
        if (rawText) { stack[stack.length - 1]._text += rawText; continue; }
        const trimmed = String(tag || '').trim();
        if (!trimmed || trimmed.startsWith('?') || trimmed.startsWith('!')) continue;
        if (trimmed.startsWith('/')) { const closing = normalizeTagName(trimmed.slice(1).trim().split(/\s+/)[0]); while (stack.length > 1 && stack[stack.length - 1].tagName !== closing) stack.pop(); if (stack.length > 1) stack.pop(); continue; }
        const selfClosing = /\/\s*$/.test(trimmed);
        const cleaned = trimmed.replace(/\/\s*$/, '').trim();
        const spaceIndex = cleaned.search(/\s/);
        const rawName = spaceIndex === -1 ? cleaned : cleaned.slice(0, spaceIndex);
        const attrText = spaceIndex === -1 ? '' : cleaned.slice(spaceIndex + 1);
        const node = new MinimalXmlNode(normalizeTagName(rawName), parseAttributes(attrText));
        stack[stack.length - 1].children.push(node);
        if (!selfClosing) stack.push(node);
      }
      return document;
    }
  };
}

function normalizeTagName(name) { return String(name || '').split(':').pop().toUpperCase(); }
function parseAttributes(text) {
  const attrs = {};
  const pattern = /([A-Za-z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = pattern.exec(String(text || '')))) {
    const key = match[1];
    const value = decodeXmlEntities(match[3] ?? match[4] ?? '');
    attrs[key] = value; attrs[key.toLowerCase()] = value;
  }
  return attrs;
}
function decodeXmlEntities(value) { return String(value || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); }
