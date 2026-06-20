import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const converter = readFileSync('src/converter.js', 'utf8');
const catalog = readFileSync('src/valve-flange-visual-catalog.js', 'utf8');
const postprocess = readFileSync('src/valve-flange-scene-postprocess.js', 'utf8');

assert.ok(converter.includes('if (primitive.hiddenBoreFill) continue;'), 'renderer must not draw hidden bore-fill spans as visible centerline pipe');
assert.ok(converter.includes("primitive.kind === 'seam-ring'"), 'renderer seam-ring branch is still present for future torus support');
assert.ok(converter.includes('cylinderAlongAxis('), 'baseline renderer still uses cylinder primitives for plates/cylinders');
assert.ok(converter.includes('pointForPrimitive(primitive)'), 'renderer must place catalogue meshes from explicit primitive local-axis spans');
assert.ok(converter.includes('primitiveLocalLength(primitive)'), 'renderer must render each primitive using its actual local-axis span length');
assert.ok(converter.includes("geometryKind: 'SPAN_FILLED_VALVE_BODY'"), 'round valve bodies must be marked as span-filled, not free spheres');
assert.ok(converter.includes('mesh.scale.set(1, axialScale, 1)'), 'round/ball valve bodies must be scaled along the pipe axis to meet neck spans');
assert.ok(converter.includes('renderedLocalAxisStart'), 'mesh userData must expose rendered local-axis start for debugging');
assert.ok(converter.includes('renderedLocalAxisEnd'), 'mesh userData must expose rendered local-axis end for debugging');
assert.ok(converter.includes('const explicitStart = Number(primitive.radiusStart)'), 'frustum renderer must honor explicit start/end radii from the catalogue');
assert.ok(!catalog.includes("kind: 'seam-ring'"), 'catalogue must not emit visible seam-ring markers while renderer maps them to filled cylinders');
assert.ok(!catalog.includes('FLANGE_GASKET_SEAM_A'), 'flange gasket seams must not be emitted as solid washer discs');
assert.ok(!catalog.includes('END_COLLAR_SEAM_A'), 'valve collar seams must not be emitted as solid washer discs');
assert.ok(catalog.includes('hiddenBoreFill') || !catalog.includes('VALVE_BORE_FILL'), 'valve bore fill must be hidden when present or omitted');
assert.ok(postprocess.includes('geometryDecorationDisabled: true'), 'postprocess must not add fallback decoration geometry over catalogue visuals');
assert.ok(!postprocess.includes('new THREE.MeshBasicMaterial({ color: 0x1e2632 })'), 'postprocess must not create gasket washer discs');
assert.ok(!postprocess.includes('SphereGeometry(Math.max(bodyRadius'), 'postprocess must not replace catalogue valve bodies with unspanned spheres');

console.log('Valve/flange renderer reference visual gates passed');
