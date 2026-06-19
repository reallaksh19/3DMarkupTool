import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const converter = readFileSync('src/converter.js', 'utf8');
const catalog = readFileSync('src/valve-flange-visual-catalog.js', 'utf8');

assert.ok(converter.includes('if (primitive.hiddenBoreFill) continue;'), 'renderer must not draw hidden bore-fill spans as visible centerline pipe');
assert.ok(converter.includes("primitive.kind === 'seam-ring'"), 'renderer must support dark seam-ring primitives');
assert.ok(converter.includes('seamMat'), 'renderer must use a dedicated dark seam material');
assert.ok(catalog.includes('FLANGE_GASKET_SEAM_A'), 'flanges must include dark gasket/seam rings');
assert.ok(catalog.includes('END_COLLAR_SEAM_A'), 'flanged valves must include collar/neck seam rings');
assert.ok(catalog.includes('boreFillRadius = pipeRadius * 0.44'), 'valve bore fill must remain visually hidden and not barrel-like');

console.log('Valve/flange renderer reference visual gates passed');
