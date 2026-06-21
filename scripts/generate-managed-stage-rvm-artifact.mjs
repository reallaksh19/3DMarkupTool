import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const inputPath = args.find((arg) => !arg.startsWith('--')) || '';
const fixtureName = valueAfterPrefix(args, '--fixture=');
const outDir = resolveOutDir(args);
const baseNameOverride = valueAfterPrefix(args, '--base=');
const expectBmCii = args.includes('--expect-bm-cii');

if (!inputPath && fixtureName !== 'bm-cii') {
  throw new Error('Usage: node scripts/generate-managed-stage-rvm-artifact.mjs input.json [--expect-bm-cii] [--base=name] --outdir=artifacts/managed-stage-rvm OR --fixture=bm-cii');
}

const { convertManagedStageJsonToRvmAtt } = await import('../src/managed-stage-rvm-converter.js');
const { sourceText, baseName, strictAuditExpectations } = await resolveSource(inputPath, fixtureName, { baseNameOverride, expectBmCii });
const result = convertManagedStageJsonToRvmAtt(sourceText, { strictAuditExpectations });
mkdirSync(outDir, { recursive: true });

const files = [
  [`${baseName}.rvm`, Buffer.from(result.rvm)],
  [`${baseName}.att`, Buffer.from(result.att)],
  [`${baseName}.audit.json`, Buffer.from(`${JSON.stringify(result.audit, null, 2)}\n`)]
];
for (const [name, bytes] of files) writeFileSync(join(outDir, name), bytes);
writeFileSync(join(outDir, `${baseName}.zip`), makeStoredZip(files));

console.log(`Generated managed-stage RVM artifacts in ${outDir}`);
console.log(`Base name: ${baseName}`);
console.log(`RVM bytes: ${result.audit.rvmBytes}`);
console.log(`ATT bytes: ${result.audit.attBytes}`);
console.log(`Primitive histogram: ${JSON.stringify(result.audit.primitiveHistogram)}`);
console.log(`Processing mode: ${result.audit.processingConfig?.mode || 'unknown'}`);
console.log(`InputXML bends excluded: ${result.audit.inputXmlBendExclusionAudit?.code4BendsExcluded || 0}`);
console.log(`InputXML branch fittings inferred: ${result.audit.inputXmlBranchFittingInferenceAudit?.genericBranchFittingCount || 0}`);
console.log(`Support records emitted to RVM: ${result.audit.supportRvmExportAudit?.supportRecordCount || 0}`);
console.log(`Support RVM primitives: ${result.audit.supportRvmExportAudit?.supportPrimitiveCount || 0}`);
console.log(`Support cones: ${result.audit.supportRvmExportAudit?.supportConePrimitiveCount || 0}`);
console.log(`Support bars: ${result.audit.supportRvmExportAudit?.supportBarPrimitiveCount || 0}`);
console.log(`Max centerline gap mm: ${result.audit.topology.maxCenterlineGapMm}`);
console.log(`Strict audit gate: ${result.audit.managedStageStrictGate.ok ? 'PASS' : 'FAIL'}`);

async function resolveSource(input, fixture, options = {}) {
  if (fixture === 'bm-cii') {
    const { createBmCiiManagedStageFixture } = await import('../tests/managed-stage-bm-cii-profile-fixture.mjs');
    return {
      sourceText: JSON.stringify(createBmCiiManagedStageFixture()),
      baseName: options.baseNameOverride || 'BM_CII_INPUT_managed_stage',
      strictAuditExpectations: bmCiiExpectations()
    };
  }
  return {
    sourceText: readFileSync(input, 'utf8'),
    baseName: options.baseNameOverride || basename(input).replace(/\.json$/i, '') || 'BM_CII_INPUT_managed_stage',
    strictAuditExpectations: options.expectBmCii ? bmCiiExpectations() : {}
  };
}

function bmCiiExpectations() {
  return {
    geometryComponents: 40,
    supportRecordsSkippedFromGeometry: 12,
    supportRecordsEmittedToRvm: 12,
    supportRvmPrimitiveCount: 25,
    code1: 17,
    code4: 0,
    code8: 99,
    cntbCount: 56,
    primCount: 116
  };
}

function resolveOutDir(values) {
  const arg = valueAfterPrefix(values, '--outdir=');
  return arg ? join(repoRoot, arg) : join(repoRoot, 'artifacts', 'managed-stage-rvm');
}

function valueAfterPrefix(values, prefix) {
  const entry = values.find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : '';
}

function makeStoredZip(entries) {
  let offset = 0;
  const locals = [];
  const centrals = [];
  for (const [name, data] of entries) {
    const nameBytes = Buffer.from(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30 + nameBytes.length + data.length);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26); local.writeUInt16LE(0, 28);
    nameBytes.copy(local, 30); data.copy(local, 30 + nameBytes.length); locals.push(local);
    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8); central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12); central.writeUInt16LE(0, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38); central.writeUInt32LE(offset, 42); nameBytes.copy(central, 46); centrals.push(central);
    offset += local.length;
  }
  const centralOffset = offset;
  const centralSize = centrals.reduce((sum, entry) => sum + entry.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(centralOffset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, ...centrals, end]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
