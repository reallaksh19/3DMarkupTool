import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertBmCiiManagedStageRvmHistogram,
  BM_CII_MANAGED_STAGE_RVM_PRIMITIVE_HISTOGRAM
} from './managed-stage-bm-cii-rvm-expectations.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = parseArgs(process.argv.slice(2));
const dir = join(repoRoot, args.dir || 'artifacts/managed-stage-rvm');
const base = args.base || 'BM_CII_INPUT_managed_stage';

const { scanRvmPrimitivePayloads } = await import('../src/rvm-primitive-payload-decoder.js');

const rvmPath = join(dir, `${base}.rvm`);
const auditPath = join(dir, `${base}.audit.json`);
if (!existsSync(rvmPath)) throw new Error(`Missing BM_CII RVM file: ${rvmPath}`);
if (!existsSync(auditPath)) throw new Error(`Missing BM_CII audit file: ${auditPath}`);

const rvm = readFileSync(rvmPath);
const audit = JSON.parse(readFileSync(auditPath, 'utf8'));
const primitives = scanRvmPrimitivePayloads(rvm);
const primitiveHistogram = histogram(primitives.map((primitive) => primitive.code));
const geometryCount = Number(audit.stitchManifest?.geometryPrimitiveCount || 0);
const supportHistogram = histogram(primitives.slice(geometryCount).map((primitive) => primitive.code));
const issues = [];

compareHistogram(primitiveHistogram, BM_CII_MANAGED_STAGE_RVM_PRIMITIVE_HISTOGRAM, 'decoded RVM primitive histogram', issues);
compareHistogram(audit.primitiveHistogram || {}, BM_CII_MANAGED_STAGE_RVM_PRIMITIVE_HISTOGRAM, 'audit primitive histogram', issues);
compareHistogram(supportHistogram, { 8: 42 }, 'decoded support primitive histogram', issues);
compareHistogram(audit.supportRvmExportAudit?.supportPrimitiveCodeHistogram || {}, { 8: 42 }, 'audit support primitive histogram', issues);
if (primitives.length !== 129) issues.push(`decoded PRIM count: expected 129, got ${primitives.length}`);
if (audit.chunkHierarchy?.primCount !== 129) issues.push(`audit PRIM count: expected 129, got ${audit.chunkHierarchy?.primCount}`);
if (audit.stitchManifest?.geometryPrimitiveCount !== 87) issues.push(`geometry primitive count: expected 87, got ${audit.stitchManifest?.geometryPrimitiveCount}`);
if (audit.stitchManifest?.supportOverlayPrimitiveCount !== 42) issues.push(`support overlay primitive count: expected 42, got ${audit.stitchManifest?.supportOverlayPrimitiveCount}`);
if ((audit.torusOrientationAssumptions || []).length !== 7) issues.push(`torus orientation assumption count: expected 7, got ${(audit.torusOrientationAssumptions || []).length}`);
if ((audit.genericInputXmlBendAssumptions || []).length !== 0) issues.push(`generic InputXML bend assumption count: expected 0, got ${(audit.genericInputXmlBendAssumptions || []).length}`);

if (issues.length) throw new Error(`BM_CII managed-stage RVM histogram verification failed: ${issues.join('; ')}`);
assertBmCiiManagedStageRvmHistogram(primitiveHistogram);

console.log(JSON.stringify({
  schema: 'BmCiiManagedStageRvmHistogramVerification.v1',
  ok: true,
  base,
  rvmBytes: rvm.byteLength,
  primitiveCount: primitives.length,
  primitiveHistogram,
  supportPrimitiveHistogram: supportHistogram,
  geometryPrimitiveCount: audit.stitchManifest?.geometryPrimitiveCount || 0,
  supportOverlayPrimitiveCount: audit.stitchManifest?.supportOverlayPrimitiveCount || 0,
  torusOrientationAssumptions: (audit.torusOrientationAssumptions || []).length,
  genericInputXmlBendAssumptions: (audit.genericInputXmlBendAssumptions || []).length
}, null, 2));

function parseArgs(values) {
  const out = {};
  for (const value of values) {
    if (!value.startsWith('--')) continue;
    const [key, raw = 'true'] = value.slice(2).split('=');
    out[key] = raw;
  }
  return out;
}

function histogram(values) {
  return values.reduce((out, value) => {
    const key = String(Number(value));
    out[key] = (out[key] || 0) + 1;
    return out;
  }, {});
}

function compareHistogram(actual, expected, label, issues) {
  const keys = new Set([...Object.keys(actual), ...Object.keys(expected)].map(String));
  for (const key of keys) {
    const actualValue = Number(actual[key] || 0);
    const expectedValue = Number(expected[key] || 0);
    if (actualValue !== expectedValue) issues.push(`${label} code ${key}: expected ${expectedValue}, got ${actualValue}`);
  }
}
