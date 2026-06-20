import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';

installMinimalBrowserApis();

const { convertInputXmlToGlb } = await import('../src/converter.js');

const sampleXml = readFileSync(join(process.cwd(), 'samples', 'BM_CII_Enriched_v8_lite.XML'), 'utf8');
const conversion = await convertInputXmlToGlb(sampleXml, {
  filename: 'BM_CII_Enriched_v8_lite.XML',
  supportMode: 'compare',
  nodeLabels: false,
  isonoteBoards: false,
  compactMode: false,
  isonoteText: readOptional(join(process.cwd(), 'samples', 'BM_CII_ISONOTE_sideload.csv'), ''),
  lineNoText: readOptional(join(process.cwd(), 'samples', 'BM_CII_LINE_NO_sideload.csv'), 'NODE,LINE_NO\n10,BM_CII_SAMPLE')
});
conversion.scene.updateMatrixWorld(true);

const supportSymbols = [];
conversion.scene.traverse((object) => {
  if (object?.userData?.TYPE === 'SUPPORT_RESTRAINT') supportSymbols.push(object);
});

assert.ok(supportSymbols.length > 0, 'BM_CII scene must include support/restraint symbols');
assert.ok(supportSymbols.some((symbol) => symbol.userData.sourceClass === 'expected'), 'expected/sideload support symbols must remain present');

const writerSafeKinds = new Set(['cylinder', 'pyramid', 'box', 'sphere']);
for (const symbol of supportSymbols) {
  assert.equal(symbol.userData.supportCatalogueSceneParity, 'CATALOGUE_GEOMETRY_ADAPTER', `${symbol.name} must report catalogue geometry adapter parity`);
  assert.equal(symbol.userData.supportCatalogueSceneGeometryAdapter, true, `${symbol.name} must be geometry-adapter wired`);
  assert.equal(symbol.userData.supportCatalogueSceneMetadataOnly, false, `${symbol.name} must no longer be metadata-only`);
  assert.equal(symbol.userData.SUPPORT_CATALOGUE_VISUAL, true, `${symbol.name} must keep SUPPORT_CATALOGUE_VISUAL`);
  assert.ok(symbol.userData.SUPPORT_CATALOGUE_FAMILY, `${symbol.name} must keep support catalogue family`);
  assert.ok(symbol.userData.SUPPORT_CATALOGUE_RECIPE_ID, `${symbol.name} must keep support catalogue recipe`);
  assert.ok(symbol.userData.SUPPORT_CATALOGUE_SCHEMA, `${symbol.name} must keep support catalogue schema`);
  assert.equal(symbol.userData.SUPPORT_CATALOGUE_PROPORTIONAL_FALLBACK, true, `${symbol.name} must keep proportional fallback explicit`);
  assert.equal(symbol.userData.SUPPORT_CATALOGUE_VENDOR_DIMENSIONAL_DB_BACKED, false, `${symbol.name} must keep vendor dimensional backing false`);

  const adapterMeshes = [];
  symbol.traverse((child) => {
    if (child?.isMesh && child.userData?.supportCataloguePrimitiveAdapter === true) adapterMeshes.push(child);
  });
  assert.ok(adapterMeshes.length > 0, `${symbol.name} must contain support catalogue adapter primitive meshes`);
  assert.ok(adapterMeshes.length >= symbol.children.length, `${symbol.name} children must be adapter-generated primitive objects`);

  const box = new THREE.Box3().setFromObject(symbol);
  const size = box.getSize(new THREE.Vector3());
  assert.ok([size.x, size.y, size.z].every(Number.isFinite), `${symbol.name} must have finite adapter bounds`);
  assert.ok(Math.max(size.x, size.y, size.z) > 0, `${symbol.name} must have non-zero adapter visual extent`);

  for (const mesh of adapterMeshes) {
    assert.ok(writerSafeKinds.has(mesh.userData.primitiveKind), `${mesh.name} primitive kind must stay writer-safe`);
    assert.equal(mesh.userData.supportCatalogueSceneParity, 'CATALOGUE_GEOMETRY_ADAPTER', `${mesh.name} must stamp adapter parity`);
    assert.equal(mesh.userData.supportCatalogueFamily, symbol.userData.SUPPORT_CATALOGUE_FAMILY, `${mesh.name} family must match parent support symbol`);
    assert.equal(mesh.userData.supportCatalogueSchema, symbol.userData.SUPPORT_CATALOGUE_SCHEMA, `${mesh.name} schema must match parent support symbol`);
  }
}

function readOptional(path, fallback = '') {
  try { return readFileSync(path, 'utf8'); } catch { return fallback; }
}

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
        if (trimmed.startsWith('/')) {
          const closing = normalizeTagName(trimmed.slice(1).trim().split(/\s+/)[0]);
          while (stack.length > 1 && stack[stack.length - 1].tagName !== closing) stack.pop();
          if (stack.length > 1) stack.pop();
          continue;
        }
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
    attrs[key] = value;
    attrs[key.toLowerCase()] = value;
  }
  return attrs;
}
function decodeXmlEntities(value) { return String(value || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); }
