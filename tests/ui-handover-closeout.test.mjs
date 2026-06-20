import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const doc = readFileSync('docs/UI_HANDOVER_CLOSEOUT.md', 'utf8');

const requiredPhrases = [
  'UI Handover Closeout',
  'GLB/RVM geometry generation',
  'InputXML parser logic',
  'RVM/ATT exporter logic',
  'Input final state',
  'Rules Checklist CI',
  'Phase 5',
  'Phase 6',
  'Phase 7',
  'Phase 8',
  'Phase 9',
  'Phase 10',
  'Phase 11',
  'No file chosen',
  'BM_CII sample state does not overwrite',
  'Conversion and Sideload are collapsed by explicit markers',
  'Core GLB/RVM work can now continue independently',
  'merge only after GitHub Actions completes successfully'
];

for (const phrase of requiredPhrases) {
  assert.ok(doc.includes(phrase), `UI closeout document must include: ${phrase}`);
}

assert.doesNotMatch(doc, /parser\s+fixed|exporter\s+fixed|geometry\s+fixed/i, 'UI closeout must not claim core parser/exporter/geometry work was fixed');

console.log('ui handover closeout gate passed');
