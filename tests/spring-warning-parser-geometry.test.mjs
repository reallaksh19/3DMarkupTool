import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const parser = fs.readFileSync('src/parser.js', 'utf8');
const geometry = fs.readFileSync('src/geometry.js', 'utf8');
const bootstrap = fs.readFileSync('src/safe-ui-bootstrap.js', 'utf8');

test('can spring is detected in restraint parser, not by runtime overlay', () => {
  assert.match(parser, /CAN\s\+SPRING\|SPRING\s\+CAN/);
  assert.match(parser, /'SPRING_WARNING',\s*'BELOW_PIPE, FACING_UPWARD'/);
  assert.match(parser, /sign:\s*'\+Y \/ UPWARD'/);
  assert.doesNotMatch(bootstrap, /static-spring-warning-geometry-controller/);
});

test('spring warning geometry uses parsed family name to resolve upward coil axis', () => {
  assert.match(geometry, /function resolveSpringCoilAxis/);
  assert.match(geometry, /n\.includes\('SPRING_WARNING'\)/);
  assert.match(geometry, /n\.includes\('BELOW_PIPE'\)/);
  assert.match(geometry, /new THREE\.Vector3\(0, 1, 0\)/);
});
