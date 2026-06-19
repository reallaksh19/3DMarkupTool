import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const converter = readFileSync('src/converter.js', 'utf8');
const catalog = readFileSync('src/valve-flange-visual-catalog.js', 'utf8');

assert.ok(converter.includes('if (primitive.hiddenBoreFill) continue;'), 'renderer must not draw hidden bore-fill spans as visible centerline pipe');
assert.ok(converter.includes("primitive.kind === 'seam-ring'"), 'renderer seam-ring branch is still present for future torus support');
assert.ok(converter.includes('cylinderAlongAxis('), 'baseline renderer still uses cylinder primitives for plates/cylinders');
assert.ok(!catalog.includes("kind: 'seam-ring'"), 'catalogue must not emit visible seam-ring markers while renderer maps them to filled cylinders');
assert.ok(!catalog.includes('FLANGE_GASKET_SEAM_A'), 'flange gasket seams must not be emitted as solid black washer discs');
assert.ok(!catalog.includes('END_COLLAR_SEAM_A'), 'valve collar seams must not be emitted as solid black washer discs');
assert.ok(catalog.includes('boreFillRadius = pipeRadius * 0.44'), 'valve bore fill must remain visually hidden and not barrel-like');

console.log('Valve/flange renderer reference visual gates passed');
