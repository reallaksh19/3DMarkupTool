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
  /bindCollapsibleSection\(section, 'conversion'/,
  'Conversion section must be tagged explicitly as a collapsible drawer section.'
);

assert.match(
  collapseController,
  /setSectionExpanded\('conversion', false\)/,
  'Conversion settings must initialize collapsed.'
);

assert.match(
  collapseController,
  /initSideloadSection/,
  'Sideload section must have an explicit collapse initializer.'
);

assert.match(
  collapseController,
  /bindCollapsibleSection\(section, 'sideload'/,
  'Sideload section must be tagged explicitly as a collapsible drawer section.'
);

assert.match(
  collapseController,
  /setSectionExpanded\('sideload', false\)/,
  'Sideload Data must initialize collapsed so it does not consume the input drawer.'
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
  collapseController,
  /data-collapsible="sideload"\]\s*>\s*\.sideload-collapsible-content[\s\S]*display:\s*none\s*!important/,
  'Sideload fields must be hidden through explicit sideload marker while collapsed.'
);

assert.match(
  bootstrap,
  /phase4a-static-input-panel-cleanup-20260619|phase4-global-esc-lifecycle-20260619|esc-tools-export-icons-20260619/,
  'Safe UI bootstrap version must remain cache-busted so browsers fetch fixed drawer, view-pad, ESC, export, and icon controllers.'
);

console.log('input drawer collapse contract passed');
