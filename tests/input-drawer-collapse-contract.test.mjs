import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const collapseController = readFileSync('src/static-input-conversion-collapse-controller.js', 'utf8');
const bootstrap = readFileSync('src/safe-ui-bootstrap.js', 'utf8');

assert.match(
  collapseController,
  /ensureInputAlwaysExpanded\(\)/,
  'Input drawer collapse controller must explicitly keep the Input section expanded.'
);

assert.match(
  collapseController,
  /section\.dataset\.section\s*=\s*['"]input['"]/, 
  'Input section must be tagged as data-section="input" for non-positional CSS overrides.'
);

assert.match(
  collapseController,
  /section\.dataset\.collapsible\s*=\s*['"]conversion['"]/, 
  'Conversion section must be tagged explicitly as the only collapsible drawer section.'
);

assert.match(
  collapseController,
  /setConversionExpanded\(false\)/,
  'Conversion settings must initialize collapsed.'
);

assert.doesNotMatch(
  collapseController,
  /sections\s*\[\s*1\s*\]/,
  'Collapse logic must not use positional section fallback; summary cards can change section indexes.'
);

assert.match(
  collapseController,
  /data-section="input"\]\s*>\s*\.file-drop[\s\S]*display:\s*grid\s*!important/,
  'Input file drop must override older cached positional collapse CSS.'
);

assert.match(
  collapseController,
  /data-collapsible="conversion"\]\s*>\s*\.conversion-collapsible-content[\s\S]*display:\s*none\s*!important/,
  'Conversion settings must be hidden through explicit conversion marker while collapsed.'
);

assert.match(
  bootstrap,
  /viewpad-icons-context-saved-state-20260619/,
  'Safe UI bootstrap version must remain cache-busted so browsers fetch fixed drawer and view-pad controllers.'
);

console.log('input drawer collapse contract passed');
