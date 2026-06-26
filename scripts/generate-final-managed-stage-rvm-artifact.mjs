import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const inputPath = args.find((arg) => !arg.startsWith('--')) || '';
const fixtureName = valueAfterPrefix(args, '--fixture=');
const outDir = valueAfterPrefix(args, '--outdir=') || 'artifacts/managed-stage-rvm';
const base = valueAfterPrefix(args, '--base=') || deriveBase(inputPath, fixtureName);
const expectBmCii = args.includes('--expect-bm-cii') || fixtureName === 'bm-cii';
const referenceRvm = valueAfterPrefix(args, '--reference-rvm=');

if (!inputPath && fixtureName !== 'bm-cii') {
  throw new Error('Usage: node scripts/generate-final-managed-stage-rvm-artifact.mjs input.json --expect-bm-cii [--reference-rvm=RMSS.rvm] [--outdir=artifacts/managed-stage-rvm] OR --fixture=bm-cii');
}

const sourceArgs = fixtureName ? [`--fixture=${fixtureName}`] : [inputPath];
const expectationArgs = expectBmCii ? ['--expect-bm-cii'] : [];

runStep('generate RVM/ATT/audit/zip', [
  'scripts/generate-managed-stage-rvm-artifact.mjs',
  ...sourceArgs,
  `--outdir=${outDir}`,
  `--base=${base}`,
  ...expectationArgs
]);

runStep('verify source profile strict gate', [
  'scripts/verify-managed-stage-rvm-profile.mjs',
  ...sourceArgs,
  ...expectationArgs,
  `--audit-out=${outDir}/${base}.verify.audit.json`
]);

runStep('verify persisted artifact round-trip', [
  'scripts/verify-managed-stage-rvm-artifact.mjs',
  `--dir=${outDir}`,
  `--base=${base}`,
  ...expectationArgs
]);

runStep('verify RMSS/RHBG primitive layout compatibility', [
  'scripts/verify-managed-stage-rvm-reference-compat.mjs',
  `--dir=${outDir}`,
  `--base=${base}`,
  ...expectationArgs,
  `--audit-out=${outDir}/${base}.reference-compat.json`,
  ...(referenceRvm ? [`--reference-rvm=${referenceRvm}`] : [])
]);

runStep('inspect final artifact tables', [
  'scripts/inspect-managed-stage-rvm-artifact.mjs',
  `--dir=${outDir}`,
  `--base=${base}`,
  ...expectationArgs
]);

const artifactAudit = JSON.parse(readFileSync(join(repoRoot, outDir, `${base}.audit.json`), 'utf8'));
const topologyProofGate = artifactAudit.managedStageTopologyProofGate || null;
if (topologyProofGate?.ok !== true) throw new Error('Final managed-stage artifact topology proof gate failed');

const finalZipName = `${base}.final-rmss-style.zip`;
const finalZipPath = join(repoRoot, outDir, finalZipName);
writeFileSync(finalZipPath, makeStoredZip(readFinalEntries(join(repoRoot, outDir), base)));

console.log(JSON.stringify({
  schema: 'ManagedStageFinalRvmArtifact.v2',
  ok: true,
  base,
  outDir,
  finalZip: finalZipName,
  topologyProofGateOk: topologyProofGate.ok,
  explicitBendRecordCount: topologyProofGate.explicitBendRecordCount,
  explicitBendDetailCount: topologyProofGate.explicitBendDetailCount,
  missingExplicitBendDetailCount: topologyProofGate.missingExplicitBendDetailCount,
  synthetic1p5DTrimBlockedCount: topologyProofGate.synthetic1p5DTrimBlockedCount,
  supportAssociationOnlyCount: topologyProofGate.supportAssociationOnlyCount,
  supportTopologyBlockedCount: topologyProofGate.supportTopologyBlockedCount,
  supportContinuityEdgeCount: topologyProofGate.supportContinuityEdgeCount,
  supportInlineFaceCount: topologyProofGate.supportInlineFaceCount,
  referenceMode: referenceRvm ? 'external-rmss-reference' : 'layout-self-check',
  generatedFiles: readFinalEntries(join(repoRoot, outDir), base).map(([name]) => name)
}, null, 2));

function runStep(label, scriptArgs) {
  console.log(`\n[managed-stage-final] ${label}`);
  const result = spawnSync(process.execPath, scriptArgs, { cwd: repoRoot, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}`);
}

function deriveBase(input, fixture) {
  if (fixture === 'bm-cii') return 'BM_CII_INPUT_managed_stage';
  return basename(input).replace(/\.json$/i, '') || 'BM_CII_INPUT_managed_stage';
}

function readFinalEntries(dir, baseName) {
  const names = [
    `${baseName}.rvm`,
    `${baseName}.att`,
    `${baseName}.audit.json`,
    `${baseName}.verify.audit.json`,
    `${baseName}.reference-compat.json`,
    `${baseName}.inspection.json`,
    `${baseName}.elements.csv`,
    `${baseName}.primitives.csv`,
    `${baseName}.inspection.md`
  ];
  const missing = names.filter((name) => !existsSync(join(dir, name)));
  if (missing.length) throw new Error(`Cannot build final package; missing files: ${missing.join(', ')}`);
  return names.map((name) => [name, readFileSync(join(dir, name))]);
}

function valueAfterPrefix(values, prefix) {
  const entry = values.find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : '';
}

function makeStoredZip(entries) {
  mkdirSync(dirname(finalZipPath), { recursive: true });
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
