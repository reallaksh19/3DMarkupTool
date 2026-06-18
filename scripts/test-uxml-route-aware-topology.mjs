import fs from 'node:fs';

const converter = fs.readFileSync('src/converter.js', 'utf8');

const requiredTokens = [
  'sameRouteElementsAtNode',
  'routeKey',
  'topologyOrder',
  'directionForNode',
  'skip the decorative bend instead of guessing',
  'UXML contains explicit branches/ports',
];

const missing = requiredTokens.filter((token) => !converter.includes(token));
if (missing.length) {
  console.error(`Missing route-aware topology builder tokens: ${missing.join(', ')}`);
  process.exit(1);
}

const unsafePattern = /const next = elements\.find\(\(element\) => element !== currentElement && element\.fromNode === String\(Number\(nodeId\)\)\)\s*\|\|\s*elements\.find\(\(element\) => element !== currentElement\)/;
if (unsafePattern.test(converter)) {
  console.error('Unsafe first-connected topology fallback is still present.');
  process.exit(1);
}

console.log('✅ UXML route-aware topology smoke passed.');
