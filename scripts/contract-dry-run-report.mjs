#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { buildContractDryRunReport } from '../src/contract-dry-run-report.js';

const args = parseArgs(process.argv.slice(2));

if (args.help || !args.input) {
  printUsage(args.help ? 0 : 1);
}

try {
  const inputPath = path.resolve(args.input);
  const model = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const report = buildContractDryRunReport(model, {
    sourceLabel: args.sourceLabel || path.relative(process.cwd(), inputPath),
    generatedAt: args.generatedAt || null,
    renderTargets: args.renderTargets,
    exportTargets: args.exportTargets
  });

  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (args.output) {
    const outputPath = path.resolve(args.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, json, 'utf8');
  } else {
    process.stdout.write(json);
  }

  if (report.status !== 'PASS') process.exitCode = 2;
} catch (error) {
  console.error(`[contract-dry-run-report] ${error.message}`);
  process.exitCode = 1;
}

function parseArgs(argv) {
  const result = {
    input: null,
    output: null,
    sourceLabel: null,
    generatedAt: null,
    renderTargets: undefined,
    exportTargets: undefined,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') result.help = true;
    else if (arg === '--input') result.input = argv[++index];
    else if (arg === '--output') result.output = argv[++index];
    else if (arg === '--source-label') result.sourceLabel = argv[++index];
    else if (arg === '--generated-at') result.generatedAt = argv[++index];
    else if (arg === '--render-targets') result.renderTargets = splitCsv(argv[++index]);
    else if (arg === '--export-targets') result.exportTargets = splitCsv(argv[++index]);
    else if (!result.input) result.input = arg;
    else throw new Error(`unknown argument: ${arg}`);
  }

  return result;
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function printUsage(exitCode) {
  const message = [
    'Usage: node scripts/contract-dry-run-report.mjs --input <model.json> [--output <report.json>]',
    '',
    'Options:',
    '  --input <path>          InputXML-like JSON model fixture.',
    '  --output <path>         Optional JSON report output path. Defaults to stdout.',
    '  --source-label <label>  Optional label stored in the report.',
    '  --generated-at <value>  Optional deterministic timestamp/string stored in the report.',
    '  --render-targets <csv>  Optional render targets, default VIEWER,GLB,RVM_ATT.',
    '  --export-targets <csv>  Optional export targets, default GLB,RVM_ATT.'
  ].join('\n');
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write(`${message}\n`);
  process.exit(exitCode);
}
