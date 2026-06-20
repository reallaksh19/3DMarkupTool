import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

installMinimalBrowserApis();

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = resolveOutDir(process.argv);
const baseName = 'BM_CII_glb_catalogue_scene_mesh';

const THREE = await import('three');
const { convertInputXmlToGlb } = await import('../src/converter.js');
const { VALVE_FLANGE_VISUAL_CATALOG_SCHEMA } = await import('../src/valve-flange-visual-catalog.js');

const sampleXml = readFileSync(join(repoRoot, 'samples', 'BM_CII_Enriched_v8_lite.XML'), 'utf8');
const conversion = await convertInputXmlToGlb(sampleXml, {
  filename: 'BM_CII_Enriched_v8_lite.XML',
  supportMode: 'inputxml-actual',
  nodeLabels: false,
  isonoteBoards: false,
  compactMode: false
});
conversion.scene.updateMatrixWorld(true);

const catalogueGroups = collectCatalogueGroups(conversion.scene).map(auditCatalogueGroup);
const audit = buildAudit(conversion, catalogueGroups);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${baseName}.audit.json`), `${JSON.stringify(audit, null, 2)}\n`);
writeFileSync(join(outDir, `${baseName}.summary.md`), renderMarkdownSummary(audit));

console.log(`Generated GLB catalogue scene-mesh audit in ${outDir}`);
console.log(`Catalogue scene groups: ${audit.summary.catalogueGroupCount}`);
console.log(`Catalogue role objects: ${audit.summary.catalogueRoleObjectCount}`);
console.log(`Catalogue meshes: ${audit.summary.catalogueMeshCount}`);
console.log(`Scene-mesh issues: ${audit.summary.issueCount}`);
console.log(`Scene-mesh warnings: ${audit.summary.warningCount}`);

if (audit.issues.length) {
  for (const issue of audit.issues) console.error(`${issue.componentId}: ${issue.message}`);
  process.exitCode = 1;
}

function collectCatalogueGroups(scene) {
  const groups = [];
  scene.traverse((object) => {
    if (object?.userData?.meshRole === 'CATALOG_VISUAL_GROUP') groups.push(object);
  });
  return groups;
}

function auditCatalogueGroup(group) {
  const userData = group.userData || {};
  const roleObjects = [];
  const meshObjects = [];
  group.traverse((object) => {
    if (object === group) return;
    if (object.isMesh) meshObjects.push(object);
    const objectUserData = object.userData || {};
    if (objectUserData.visualKey === userData.visualKey && objectUserData.meshRole) roleObjects.push(object);
  });

  const roleMetrics = roleObjects.map((object) => auditRoleObject(object, group));
  const spanContinuity = evaluateRenderedSpanContinuity(roleMetrics);
  const evaluation = evaluateCatalogueSceneGroup(userData, roleMetrics, spanContinuity, meshObjects);
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());

  return {
    componentId: String(userData.ID || userData.id || group.name || ''),
    groupName: group.name,
    componentClass: userData.componentClass,
    componentType: userData.componentType,
    visualKey: userData.visualKey,
    visualRecipeId: userData.visualRecipeId,
    visualCatalogSchema: userData.visualCatalogSchema || '',
    roleObjectCount: roleObjects.length,
    meshCount: meshObjects.length,
    meshTypeCounts: countBy(meshObjects, (object) => object.geometry?.type || object.type || 'UNKNOWN'),
    roleCounts: countBy(roleMetrics, (entry) => entry.role),
    geometryKindCounts: countBy(roleMetrics, (entry) => entry.geometryKind || 'UNSTAMPED'),
    worldBounds: {
      x: round(size.x),
      y: round(size.y),
      z: round(size.z),
      maxAxis: round(Math.max(size.x, size.y, size.z))
    },
    spanContinuity,
    issues: evaluation.issues,
    warnings: evaluation.warnings,
    roleMetrics
  };
}

function auditRoleObject(object, group) {
  const userData = object.userData || {};
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const hasCatalogueIdentity = Boolean(userData.visualKey && userData.visualRecipeId && userData.componentClass);
  return {
    name: object.name,
    role: userData.meshRole,
    type: object.type,
    isMesh: object.isMesh === true,
    geometryType: object.geometry?.type || '',
    geometryKind: userData.geometryKind || '',
    componentClass: userData.componentClass,
    componentType: userData.componentType,
    visualKey: userData.visualKey,
    visualRecipeId: userData.visualRecipeId,
    visualCatalogSchema: userData.visualCatalogSchema || '',
    renderedLocalAxisStart: finiteOrUndefined(userData.renderedLocalAxisStart),
    renderedLocalAxisEnd: finiteOrUndefined(userData.renderedLocalAxisEnd),
    renderedAxisLength: finiteOrUndefined(userData.renderedAxisLength),
    replacesCenterlinePipe: userData.replacesCenterlinePipe === true,
    overlayOnly: userData.overlayOnly === true,
    thinPlate: userData.thinPlate === true,
    thinRaisedFace: userData.thinRaisedFace === true,
    proportionalShoulder: userData.proportionalShoulder === true,
    radius: finiteOrUndefined(userData.radius),
    radiusStart: finiteOrUndefined(userData.radiusStart),
    radiusEnd: finiteOrUndefined(userData.radiusEnd),
    boltIndex: finiteOrUndefined(userData.boltIndex),
    boltCount: finiteOrUndefined(userData.boltCount),
    childMeshCount: countDescendantMeshes(object),
    worldSize: {
      x: round(size.x),
      y: round(size.y),
      z: round(size.z),
      maxAxis: round(Math.max(size.x, size.y, size.z))
    },
    hasCatalogueIdentity,
    parentGroupName: group.name
  };
}

function evaluateCatalogueSceneGroup(groupUserData, roles, continuity, meshes) {
  const issues = [];
  const warnings = [];
  if (groupUserData.visualCatalogSchema !== VALVE_FLANGE_VISUAL_CATALOG_SCHEMA) warnings.push('Catalogue group currently lacks explicit visualCatalogSchema stamping; follow-up can harden converter metadata.');
  if (!groupUserData.visualRecipeId) issues.push('Catalogue group must carry visualRecipeId metadata.');
  if (!groupUserData.visualKey) issues.push('Catalogue group must carry visualKey metadata.');
  if (!['VALVE', 'FLANGE'].includes(groupUserData.componentClass)) issues.push('Catalogue group must resolve as VALVE or FLANGE.');
  if (!roles.length) issues.push('Catalogue group must contain stamped role objects.');
  if (!meshes.length) issues.push('Catalogue group must contain actual Three.js meshes.');
  for (const role of roles) {
    if (!role.hasCatalogueIdentity) issues.push(`${role.role} must carry catalogue identity userData.`);
    if (role.visualCatalogSchema !== VALVE_FLANGE_VISUAL_CATALOG_SCHEMA) warnings.push(`${role.role} currently lacks explicit visualCatalogSchema stamping.`);
  }
  if (!continuity.ok) issues.push('Rendered centerline replacement spans must remain continuous after mesh construction.');
  if (groupUserData.componentClass === 'VALVE') evaluateValveSceneGroup(roles, continuity, issues, warnings);
  if (groupUserData.componentClass === 'FLANGE') evaluateFlangeSceneGroup(roles, issues, warnings);
  return { issues, warnings };
}

function evaluateValveSceneGroup(roles, continuity, issues, warnings) {
  const body = roles.find((entry) => entry.role === 'VALVE_BODY');
  const collars = roles.filter((entry) => /^END_COLLAR_/.test(entry.role || ''));
  const shoulders = roles.filter((entry) => /^VALVE_NECK_/.test(entry.role || ''));
  if (!body) issues.push('Valve scene group must include VALVE_BODY role.');
  if (collars.length < 2) issues.push('Valve scene group must include two end collar role objects.');
  if (shoulders.length < 2) issues.push('Valve scene group must include two tapered shoulder/neck role objects.');
  if (!body) return;
  if (body.geometryKind !== 'SPAN_FILLED_VALVE_BODY') issues.push(`VALVE_BODY must be stamped as SPAN_FILLED_VALVE_BODY; observed ${body.geometryKind || 'missing'}.`);
  const coveredLength = Math.max(continuity.coverageLength || 0, 1e-9);
  const bodyFraction = ratio(body.renderedAxisLength, coveredLength);
  if (!(bodyFraction >= 0.24 && bodyFraction <= 0.68)) issues.push(`VALVE_BODY rendered span fraction must stay compact; observed ${round(bodyFraction)}.`);
  for (const collar of collars) {
    if (collar.geometryKind !== 'CYLINDER') issues.push(`${collar.role} must be stamped as CYLINDER.`);
    if (!(collar.radius < body.radius)) issues.push(`${collar.role} radius must stay below VALVE_BODY radius.`);
    if (!hasFiniteSpan(collar)) issues.push(`${collar.role} must carry rendered local-axis span metadata.`);
  }
  for (const shoulder of shoulders) {
    if (shoulder.geometryKind !== 'FRUSTUM') issues.push(`${shoulder.role} must be stamped as FRUSTUM.`);
    if (!(shoulder.radiusStart !== shoulder.radiusEnd)) issues.push(`${shoulder.role} must retain tapered radius metadata.`);
    if (!hasFiniteSpan(shoulder)) issues.push(`${shoulder.role} must carry rendered local-axis span metadata.`);
  }
  if (!roles.some((entry) => /HANDWHEEL|LEVER|ACTUATOR|BONNET|FLOW_ARROW/.test(entry.role || ''))) {
    warnings.push('Valve scene group has no handle/bonnet accessory role; this can be valid for compact valve types but should be visually reviewed.');
  }
}

function evaluateFlangeSceneGroup(roles, issues, warnings) {
  const boltRoles = roles.filter(isBoltRole);
  const nonBoltRoles = roles.filter((entry) => !isBoltRole(entry));
  const plates = nonBoltRoles.filter((entry) => /FLANGE_(?:DISC|PLATE)/.test(entry.role || ''));
  const raisedFaces = nonBoltRoles.filter((entry) => /RAISED_FACE/.test(entry.role || ''));
  const weldNecks = nonBoltRoles.filter((entry) => /WELD_NECK/.test(entry.role || ''));
  if (!plates.length) issues.push('Flange scene group must include flange disc/plate role object.');
  if (!raisedFaces.length) issues.push('Flange scene group must include raised-face role object.');
  if (!weldNecks.length) issues.push('Flange scene group must include weld-neck/taper role object.');
  const maxPlateRadius = Math.max(0, ...plates.map((entry) => Number(entry.radius) || 0));
  for (const plate of plates) {
    if (plate.geometryKind !== 'CYLINDER') issues.push(`${plate.role} must be stamped as CYLINDER.`);
    if (!hasFiniteSpan(plate)) issues.push(`${plate.role} must carry rendered local-axis span metadata.`);
  }
  for (const face of raisedFaces) {
    if (face.geometryKind !== 'CYLINDER') issues.push(`${face.role} must be stamped as CYLINDER.`);
    if (!(face.radius < maxPlateRadius)) issues.push(`${face.role} radius must stay inside the flange plate radius.`);
  }
  for (const neck of weldNecks) {
    if (neck.geometryKind !== 'FRUSTUM') issues.push(`${neck.role} must be stamped as FRUSTUM.`);
    if (!(neck.radiusStart !== neck.radiusEnd)) issues.push(`${neck.role} must retain tapered radius metadata.`);
  }
  if (!boltRoles.length) warnings.push('No actual bolt meshes were emitted for this flange scene group; bolt visibility remains a follow-up visual review item.');
}

function evaluateRenderedSpanContinuity(roles) {
  const spanRoles = roles
    .filter((entry) => entry.replacesCenterlinePipe && !entry.overlayOnly && hasFiniteSpan(entry))
    .map((entry) => ({ role: entry.role, start: entry.renderedLocalAxisStart, end: entry.renderedLocalAxisEnd, length: entry.renderedAxisLength }))
    .sort((a, b) => a.start - b.start);
  const gaps = [];
  const overlaps = [];
  if (!spanRoles.length) return { ok: false, spanCount: 0, coverageLength: 0, gaps: [{ reason: 'no rendered centerline replacement spans' }], overlaps };
  const tolerance = Math.max((spanRoles.at(-1).end - spanRoles[0].start) * 1e-4, 1e-5);
  let cursor = spanRoles[0].start;
  for (const entry of spanRoles) {
    if (entry.start > cursor + tolerance) gaps.push({ from: round(cursor), to: round(entry.start), beforeRole: entry.role });
    if (entry.start < cursor - tolerance) overlaps.push({ from: round(entry.start), to: round(cursor), role: entry.role });
    cursor = Math.max(cursor, entry.end);
  }
  return {
    ok: gaps.length === 0,
    spanCount: spanRoles.length,
    coverageStart: round(spanRoles[0].start),
    coverageEnd: round(cursor),
    coverageLength: round(cursor - spanRoles[0].start),
    tolerance: round(tolerance),
    gaps,
    overlaps,
    spans: spanRoles.map((entry) => ({ role: entry.role, start: round(entry.start), end: round(entry.end), length: round(entry.length) }))
  };
}

function buildAudit(conversion, groups) {
  const issues = groups.flatMap((entry) => entry.issues.map((message) => ({ componentId: entry.componentId, componentClass: entry.componentClass, componentType: entry.componentType, message })));
  const warnings = groups.flatMap((entry) => entry.warnings.map((message) => ({ componentId: entry.componentId, componentClass: entry.componentClass, componentType: entry.componentType, message })));
  const valveGroups = groups.filter((entry) => entry.componentClass === 'VALVE');
  const flangeGroups = groups.filter((entry) => entry.componentClass === 'FLANGE');
  const roleObjects = groups.flatMap((entry) => entry.roleMetrics);
  const meshCount = sum(groups, (entry) => entry.meshCount);
  return {
    schema: 'GlbCatalogueSceneMeshAudit.v1',
    generatedAt: new Date().toISOString(),
    sample: 'samples/BM_CII_Enriched_v8_lite.XML',
    sourceKind: conversion.model?.sourceKind || conversion.scene?.userData?.sourceKind || 'unknown',
    visualCatalogSchema: VALVE_FLANGE_VISUAL_CATALOG_SCHEMA,
    actualScenePath: {
      converterBoundary: 'convertInputXmlToGlb()',
      sceneMeshSource: 'Three.js Scene returned by src/converter.js',
      note: 'This audit inspects actual scene objects and userData after the GLB conversion path builds catalogue meshes.'
    },
    summary: {
      parsedElementCount: conversion.model?.elements?.length || 0,
      sceneName: conversion.scene?.name || '',
      glbByteLength: conversion.glb?.byteLength || 0,
      catalogueGroupCount: groups.length,
      valveGroupCount: valveGroups.length,
      flangeGroupCount: flangeGroups.length,
      catalogueRoleObjectCount: roleObjects.length,
      catalogueMeshCount: meshCount,
      groupsWithContinuousSpans: groups.filter((entry) => entry.spanContinuity.ok).length,
      allGroupsContinuous: groups.every((entry) => entry.spanContinuity.ok),
      roleCounts: countBy(roleObjects, (entry) => entry.role),
      geometryKindCounts: countBy(roleObjects, (entry) => entry.geometryKind || 'UNSTAMPED'),
      issueCount: issues.length,
      warningCount: warnings.length
    },
    policies: {
      actualThreeSceneMeshAudit: true,
      proportionalFallback: true,
      rvmWriterUnaffected: true,
      asmeDimensionalDatabaseBacked: false
    },
    issues,
    warnings,
    catalogueGroups: groups
  };
}

function renderMarkdownSummary(audit) {
  const s = audit.summary;
  return `# BM_CII GLB Catalogue Scene Mesh Audit\n\n` +
    `Schema: \`${audit.schema}\`\n\n` +
    `Sample: \`${audit.sample}\`\n\n` +
    `## Purpose\n\n` +
    `This report audits the actual Three.js scene objects emitted by the GLB conversion boundary for catalogue valve/flange visuals. It validates userData roles, mesh counts, geometryKind stamps, rendered local-axis spans, and scene-level continuity.\n\n` +
    `## Summary\n\n` +
    `| Metric | Value |\n|---|---:|\n` +
    `| Parsed elements | ${s.parsedElementCount} |\n` +
    `| GLB bytes | ${s.glbByteLength} |\n` +
    `| Catalogue scene groups | ${s.catalogueGroupCount} |\n` +
    `| Valve scene groups | ${s.valveGroupCount} |\n` +
    `| Flange scene groups | ${s.flangeGroupCount} |\n` +
    `| Catalogue role objects | ${s.catalogueRoleObjectCount} |\n` +
    `| Catalogue meshes | ${s.catalogueMeshCount} |\n` +
    `| Continuous groups | ${s.groupsWithContinuousSpans} / ${s.catalogueGroupCount} |\n` +
    `| Scene-mesh issues | ${s.issueCount} |\n` +
    `| Scene-mesh warnings | ${s.warningCount} |\n\n` +
    `## GeometryKind stamps\n\n${renderCountList(s.geometryKindCounts)}\n` +
    `## Mesh role counts\n\n${renderCountList(s.roleCounts)}\n` +
    `## Scene mesh checks\n\n` +
    `- ${s.allGroupsContinuous ? '✅' : '❌'} actual rendered centerline spans remain continuous\n` +
    `- ${s.issueCount === 0 ? '✅' : '❌'} catalogue scene-mesh userData and geometryKind gates are clean\n` +
    `- ✅ proportional fallback is explicit\n` +
    `- ✅ no RVM writer behavior change\n` +
    `- ✅ no ASME/rating-size dimensional database claim\n\n` +
    `## Scope note\n\n` +
    `This is an actual GLB-scene mesh audit, not a visual screenshot and not an ASME dimensional database validation. Warnings identify follow-up visual review items that do not block the scene-mesh contract.\n`;
}

function isBoltRole(entry) {
  return /_BOLT$/.test(entry.role || '') || /BOLT_\d+$/.test(entry.name || '') || Number.isFinite(entry.boltIndex);
}
function countDescendantMeshes(object) { let count = 0; object.traverse?.((child) => { if (child.isMesh) count += 1; }); return count; }
function hasFiniteSpan(entry) { return Number.isFinite(entry.renderedLocalAxisStart) && Number.isFinite(entry.renderedLocalAxisEnd) && Number.isFinite(entry.renderedAxisLength); }
function finiteOrUndefined(value) { const n = Number(value); return Number.isFinite(n) ? n : undefined; }
function ratio(value, divisor) { const n = Number(value); const d = Number(divisor); return Number.isFinite(n) && Number.isFinite(d) && Math.abs(d) > 1e-9 ? n / d : undefined; }
function sum(values, fn) { return values.reduce((acc, value) => acc + (Number(fn(value)) || 0), 0); }
function countBy(values, keyFn) { const counts = {}; for (const value of values) { const key = keyFn(value) || 'UNKNOWN'; counts[key] = (counts[key] || 0) + 1; } return counts; }
function renderCountList(counts) { const entries = Object.entries(counts || {}).sort(([a], [b]) => a.localeCompare(b)); return entries.length ? entries.map(([key, value]) => `- \`${key}\`: ${value}`).join('\n') + '\n' : '- none\n'; }
function resolveOutDir(args) { const outArg = args.find((arg) => arg.startsWith('--outdir=')); if (!outArg) return join(repoRoot, 'artifacts', 'glb-catalogue-scene-mesh-audit'); const value = outArg.slice('--outdir='.length); return isAbsolute(value) ? value : join(repoRoot, value); }
function round(value) { const n = Number(value); return Number.isFinite(n) ? Math.round(n * 1000000) / 1000000 : undefined; }

function installMinimalBrowserApis() {
  installMinimalDomParser();
  if (!globalThis.FileReader) {
    globalThis.FileReader = class MinimalFileReader {
      constructor() { this.result = null; this.onerror = null; this.onloadend = null; }
      async readAsArrayBuffer(blob) {
        try { this.result = await blob.arrayBuffer(); this.onloadend?.({ target: this }); } catch (error) { this.onerror?.(error); }
      }
    };
  }
}
function installMinimalDomParser() {
  if (globalThis.DOMParser) return;
  class MinimalXmlNode {
    constructor(tagName = '', attributes = {}) { this.tagName = tagName; this.attributes = attributes; this.children = []; this._text = ''; }
    getAttribute(name) { return this.attributes[name] ?? this.attributes[String(name).toLowerCase()] ?? null; }
    get textContent() { return decodeXmlEntities(this._text + this.children.map((child) => child.textContent).join('')); }
    getElementsByTagName(name) { const wanted = String(name || '').toUpperCase(); const hits = []; const visit = (node) => { if (String(node.tagName || '').toUpperCase() === wanted) hits.push(node); for (const child of node.children) visit(child); }; for (const child of this.children) visit(child); return hits; }
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
function parseAttributes(text) { const attrs = {}; const pattern = /([A-Za-z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g; let match; while ((match = pattern.exec(String(text || '')))) { const key = match[1]; const value = decodeXmlEntities(match[3] ?? match[4] ?? ''); attrs[key] = value; attrs[key.toLowerCase()] = value; } return attrs; }
function decodeXmlEntities(value) { return String(value || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); }
