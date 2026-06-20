import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const controller = fs.readFileSync('src/static-spring-warning-geometry-controller.js', 'utf8');
const bootstrap = fs.readFileSync('src/safe-ui-bootstrap.js', 'utf8');

test('spring warning geometry controller is narrowly loaded', () => {
  assert.match(bootstrap, /static-spring-warning-geometry-controller\.js\?v=spring-warning-vertical-geometry-20260620/);
  assert.match(bootstrap, /spring-warning-vertical-geometry-20260620/);
});

test('spring warning geometry controller targets only spring warning families', () => {
  assert.match(controller, /TARGET_FAMILIES = new Set\(\['SPRING_WARNING', 'SPRING'\]\)/);
  assert.match(controller, /EXCLUDED_FAMILIES = new Set\(\['LINE_STOP', 'LIMIT', 'REST', 'HOLDDOWN', 'GUIDE', 'AXIS_RESTRAINT', 'AXIS_RESTRAINT_UNRESOLVED'\]\)/);
  assert.match(controller, /type !== 'SUPPORT_RESTRAINT'/);
  assert.match(controller, /!name\.includes\('SPRING_COIL'\)/);
});

test('spring warning geometry controller replaces horizontal coil with vertical symbol', () => {
  assert.match(controller, /createVerticalCoil/);
  assert.match(controller, /SPRING_WARNING_VERTICAL_GEOMETRY/);
  assert.match(controller, /object\.visible = false/);
  assert.match(controller, /axis: 'BELOW_PIPE, FACING_UPWARD'/);
  assert.match(controller, /sign: '\+Y \/ UPWARD'/);
});
