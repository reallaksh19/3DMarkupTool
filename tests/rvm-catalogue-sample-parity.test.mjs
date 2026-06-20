import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildValveFlangePrimitiveAdapterPlan } from '../src/valve-flange-primitive-adapter.js';
import { RVM_CATALOGUE_SUPPORTED_PRIMITIVE_KINDS } from '../src/rvm-catalogue-primitive-translator.js';

installMinimalDomParserForInputXmlGate();

const { convertInputXmlToRvmAtt } = await import('../src/rvm-converter.js');

const sampleXml = readFileSync(new URL('../samples/BM_CII_Enriched_v8_lite.XML', import.meta.url), 'utf8');
const sampleIsonote = readOptionalSample('../samples/BM_CII_ISONOTE_sideload.csv', '');
const sampleLineNo = readOptionalSample('../samples/BM_CII_LINE_NO_sideload.csv', 'NODE,LINE_NO\n10,BM_CII_SAMPLE');
const converterSource = readFileSync(new URL('../src/converter.js', import.meta.url), 'utf8');
const rvmConverterSource = readFileSync(new URL('../src/rvm-converter.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const result = convertInputXmlToRvmAtt(sampleXml, {
  filename: 'BM_CII_Enriched_v8_lite.XML',
  supportMode: 'inputxml-actual',
  nodeLabels: false,
  isonoteBoards: false,
  isonoteText: sampleIsonote,
  lineNoText: sampleLineNo
});

assert.equal(result.audit.sourceKind, 'InputXML', 'BM_CII sample must run through the InputXML source path');
assert.ok(result.rvm instanceof ArrayBuffer, 'sample conversion must return an RVM ArrayBuffer');
assert.ok(result.rvm.byteLength > 2048, 'sample RVM output must be non-empty after catalogue wiring');
assert.ok(typeof result.att === 'string' && result.att.length > 1024, 'sample ATT output must be non-empty after catalogue wiring');
assert.equal(result.audit.rvmCatalogueParity, true, 'sample export must enable RVM catalogue parity');
assert.equal(result.audit.rvmCatalogueExportWiringSchema, 'RvmCatalogueExportWiring.v1', 'sample audit must expose the production catalogue wiring schema');
assert.ok(result.audit.rvmCatalogueComponentCount >= 6, 'BM_CII sample must produce multiple catalogue-rendered valve/flange components');
assert.ok(result.audit.rvmCataloguePrimitiveCount > result.audit.rvmCatalogueComponentCount * 4, 'catalogue sample output must be segmented, not one primitive per component');
assert.equal(result.audit.rvmPrimitivePayloadContract?.schema, 'GeneratedRvmPrimitivePayloadContract.v1', 'generated RVM audit must expose primitive payload contract schema');
assert.equal(result.audit.rvmPrimitivePayloadContract.failClosed, true, 'generated RVM payload contract must be fail-closed');
assert.equal(result.audit.rvmPrimitivePayloadContract.unsupportedPrimitivePayloadsPresent, false, 'generated RVM must not contain unsupported primitive payloads');
assert.ok(result.audit.rvmPrimitivePayloadContract.primitiveCount > 0, 'generated RVM payload contract must decode emitted PRIM chunks');
assert.ok(result.audit.rvmPrimitivePayloadContract.statusCounts['emitted-layout-supported'] > 0, 'generated RVM payloads must decode as writer-supported layouts');
assert.ok(!result.audit.rvmPrimitivePayloadContract.codeCounts['5'], 'generated RVM must not emit blocked RHBG cone code 5');
assert.ok(!result.audit.rvmPrimitivePayloadContract.codeCounts['7'], 'generated RVM must not emit blocked RHBG frustum code 7');

const plant = findChild(result.exportModel.root, 'PLANT_GEOMETRY');
assert.ok(plant, 'sample export model must retain PLANT_GEOMETRY');

const allNodes = collectNodes(result.exportModel.root);
const allPrimitives = allNodes.flatMap((node) => node.primitives || []);
for (const primitive of allPrimitives) {
  assert.ok(
    RVM_CATALOGUE_SUPPORTED_PRIMITIVE_KINDS.includes(primitive.kind),
    `sample RVM writer received unsupported primitive kind: ${primitive.kind}`
  );
}
assert.ok(
  !allPrimitives.some((primitive) => ['frustum', 'torus', 'bolt-pattern', 'valve-body', 'radial-cylinder', 'direction-arrow'].includes(primitive.kind)),
  'sample export must not leak adapter-only primitive kinds into the RVM writer model'
);

const catalogueNodes = allNodes.filter((node) => node.attributes?.CATALOGUE_VISUAL === 'TRUE');
const valveNodes = catalogueNodes.filter((node) => node.attributes?.CATALOGUE_CLASS === 'VALVE');
const flangeNodes = catalogueNodes.filter((node) => node.attributes?.CATALOGUE_CLASS === 'FLANGE');
assert.ok(valveNodes.length >= 2, 'BM_CII sample must catalogue-render flanged valve nodes');
assert.ok(flangeNodes.length >= 4, 'BM_CII sample must catalogue-render flange nodes');

const flangedValve = valveNodes.find((node) => node.attributes.CATALOGUE_TYPE === 'VALVE_FLANGED');
assert.ok(flangedValve, 'BM_CII sample must contain a VALVE_FLANGED catalogue export node');
const flangedValvePrimitiveNames = flangedValve.primitives.map((primitive) => primitive.name).join('\n');
assert.match(flangedValvePrimitiveNames, /END_COLLAR_A/, 'sample flanged valve must include first end collar');
assert.match(flangedValvePrimitiveNames, /VALVE_NECK_A_STEP_01/, 'sample flanged valve must include stepped first neck');
assert.match(flangedValvePrimitiveNames, /VALVE_BODY/, 'sample flanged valve must include compact valve body');
assert.match(flangedValvePrimitiveNames, /VALVE_NECK_B_STEP_0[1-9]/, 'sample flanged valve must include stepped second neck');
assert.match(flangedValvePrimitiveNames, /END_COLLAR_B/, 'sample flanged valve must include second end collar');
assert.ok(flangedValve.primitives.length >= 7, 'sample flanged valve must be segmented beyond the old body/rigid-marker fallback');

const flangePair = flangeNodes.find((node) => node.attributes.CATALOGUE_TYPE === 'FLANGE_GENERIC');
assert.ok(flangePair, 'BM_CII sample must contain a generic flange/flange-pair catalogue export node');
const flangePrimitiveNames = flangePair.primitives.map((primitive) => primitive.name).join('\n');
assert.match(flangePrimitiveNames, /WELD_NECK_A_STEP_01/, 'sample flange export must include first weld-neck step');
assert.match(flangePrimitiveNames, /FLANGE_DISC_A/, 'sample flange export must include first flange disc');
assert.match(flangePrimitiveNames, /RAISED_FACE_A/, 'sample flange export must include first raised face');
assert.match(flangePrimitiveNames, /GASKET_CENTER/, 'sample flange export must include gasket center');
assert.match(flangePrimitiveNames, /FLANGE_DISC_B/, 'sample flange export must include second flange disc');
assert.match(flangePrimitiveNames, /BOLT_PATTERN_01/, 'sample flange export must expand bolt pattern to writer-safe primitives');
assert.ok(flangePair.primitives.length >= 12, 'sample flange export must be segmented beyond the old body/rigid-marker fallback');

const fallbackPipe = allNodes.find((node) => node.attributes?.TYPE === 'COMPONENT' && node.attributes?.ENGINEERING_TYPE === 'PIPE' && !node.attributes?.CATALOGUE_VISUAL);
assert.ok(fallbackPipe, 'sample must retain at least one non-catalogue pipe fallback component');
assert.ok(fallbackPipe.primitives.length >= 1, 'fallback pipe must retain its existing primitive path');
assert.ok(fallbackPipe.primitives.some((primitive) => /BODY/.test(primitive.name)), 'fallback pipe must retain body primitive naming');

assert.match(result.att, /CATALOGUE_EXPORT_PRODUCTION_WIRING := 'TRUE'/, 'sample ATT must expose production catalogue wiring');
assert.match(result.att, /CATALOGUE_CLASS := 'VALVE'/, 'sample ATT must expose valve catalogue class');
assert.match(result.att, /CATALOGUE_CLASS := 'FLANGE'/, 'sample ATT must expose flange catalogue class');
assert.match(result.att, /CATALOGUE_TYPE := 'VALVE_FLANGED'/, 'sample ATT must expose flanged valve catalogue type');
assert.match(result.att, /CATALOGUE_TYPE := 'FLANGE_GENERIC'/, 'sample ATT must expose generic flange catalogue type');
assert.match(result.att, /PROPORTIONAL_FALLBACK := 'TRUE'/, 'sample ATT must declare proportional fallback');
assert.match(result.att, /ASME_DIMENSIONAL_DB_BACKED := 'FALSE'/, 'sample ATT must not claim ASME dimensional DB backing');
assert.match(result.att, /RVM_CATALOGUE_PARITY := 'TRUE'/, 'sample ATT must expose RVM catalogue parity');

const catalogueCandidateElements = result.model.elements
  .map((element) => ({ element, plan: buildAdapterPlanForElement(element) }))
  .filter((entry) => entry.plan);
assert.ok(catalogueCandidateElements.length >= result.audit.rvmCatalogueComponentCount, 'sample catalogue elements must resolve through the shared visual catalogue/adapter seam');
assert.ok(catalogueCandidateElements.some((entry) => entry.plan.componentType === 'VALVE_FLANGED'), 'sample shared adapter must resolve flanged valves for GLB/RVM parity');
assert.ok(catalogueCandidateElements.some((entry) => entry.plan.componentClass === 'FLANGE'), 'sample shared adapter must resolve flanges for GLB/RVM parity');
for (const { plan } of catalogueCandidateElements.slice(0, 12)) {
  assert.equal(plan.continuity.ok, true, `sample catalogue primitive continuity must hold for ${plan.componentId}`);
  assert.equal(plan.policies.rendererNeutral, true, 'sample adapter plan must remain renderer-neutral');
  assert.equal(plan.policies.proportionalFallback, true, 'sample adapter plan must keep proportional-fallback policy');
  assert.equal(plan.policies.asmeDimensionalDatabaseBacked, false, 'sample adapter plan must not claim ASME dimensional DB backing');
}

assert.match(converterSource, /getValveFlangeVisualSpec/, 'GLB preview converter must keep using the valve/flange visual catalogue resolver');
assert.match(converterSource, /buildLinearVisualPrimitivePlan/, 'GLB preview converter must keep using the length-partitioned catalogue primitive plan');
assert.match(rvmConverterSource, /applyRvmCatalogueExportParity/, 'RVM production converter must apply catalogue parity to sample exports');
assert.match(rvmConverterSource, /scanRvmPrimitivePayloads/, 'RVM production converter must decode generated primitive payloads');
assert.match(rvmConverterSource, /assertGeneratedRvmPayloadCompatibility/, 'RVM production converter must assert generated primitive payload compatibility');
assert.match(pkg.scripts.test, /rvm-catalogue-sample-parity\.test\.mjs/, 'npm test must include the C4 BM_CII sample parity gate');

console.log('BM_CII RVM/ATT catalogue sample parity gate passed');

function readOptionalSample(relativePath, fallback) {
  try {
    return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  } catch {
    return fallback;
  }
}

function buildAdapterPlanForElement(element) {
  const length = Math.hypot(Number(element.dx) || 0, Number(element.dy) || 0, Number(element.dz) || 0);
  const pipeRadius = Math.max(Number(element.props?.bore) / 2 || 50, 1);
  return buildValveFlangePrimitiveAdapterPlan(element, { length, pipeRadius });
}

function findChild(node, name) {
  return (node?.children || []).find((child) => child.name === name) || null;
}

function collectNodes(node) {
  return [node].concat((node.children || []).flatMap((child) => collectNodes(child)));
}

function installMinimalDomParserForInputXmlGate() {
  if (globalThis.DOMParser) return;

  class MinimalXmlNode {
    constructor(tagName = '', attributes = {}) {
      this.tagName = tagName;
      this.attributes = attributes;
      this.children = [];
      this.parentNode = null;
      this._text = '';
    }

    getAttribute(name) {
      return this.attributes[name] ?? this.attributes[String(name).toLowerCase()] ?? null;
    }

    get textContent() {
      const body = this._text + this.children.map((child) => child.textContent).join('');
      return decodeXmlEntities(body);
    }

    getElementsByTagName(name) {
      const wanted = String(name).toUpperCase();
      const hits = [];
      const visit = (node) => {
        if (String(node.tagName || '').toUpperCase() === wanted) hits.push(node);
        for (const child of node.children) visit(child);
      };
      for (const child of this.children) visit(child);
      return hits;
    }
  }

  class MinimalXmlDocument extends MinimalXmlNode {
    constructor() {
      super('#document', {});
    }

    querySelector(selector) {
      if (selector === 'parsererror') return null;
      return null;
    }
  }

  globalThis.DOMParser = class MinimalDomParser {
    parseFromString(text) {
      const document = new MinimalXmlDocument();
      const stack = [document];
      const pattern = /<([^>]+)>|([^<]+)/g;
      let match;
      while ((match = pattern.exec(String(text || '')))) {
        const tag = match[1];
        const rawText = match[2];
        if (rawText) {
          stack[stack.length - 1]._text += rawText;
          continue;
        }
        const trimmed = String(tag || '').trim();
        if (!trimmed || trimmed.startsWith('?') || trimmed.startsWith('!')) continue;
        if (trimmed.startsWith('/')) {
          const closingName = normalizeTagName(trimmed.slice(1).trim().split(/\s+/)[0]);
          while (stack.length > 1 && stack[stack.length - 1].tagName !== closingName) stack.pop();
          if (stack.length > 1) stack.pop();
          continue;
        }

        const selfClosing = /\/\s*$/.test(trimmed);
        const cleaned = trimmed.replace(/\/\s*$/, '').trim();
        const spaceIndex = cleaned.search(/\s/);
        const rawName = spaceIndex === -1 ? cleaned : cleaned.slice(0, spaceIndex);
        const attrText = spaceIndex === -1 ? '' : cleaned.slice(spaceIndex + 1);
        const node = new MinimalXmlNode(normalizeTagName(rawName), parseAttributes(attrText));
        node.parentNode = stack[stack.length - 1];
        stack[stack.length - 1].children.push(node);
        if (!selfClosing) stack.push(node);
      }
      return document;
    }
  };
}

function normalizeTagName(name) {
  return String(name || '').split(':').pop().toUpperCase();
}

function parseAttributes(text) {
  const attributes = {};
  const pattern = /([A-Za-z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = pattern.exec(String(text || '')))) {
    const key = match[1];
    const value = match[3] ?? match[4] ?? '';
    attributes[key] = decodeXmlEntities(value);
    attributes[key.toLowerCase()] = decodeXmlEntities(value);
  }
  return attributes;
}

function decodeXmlEntities(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
