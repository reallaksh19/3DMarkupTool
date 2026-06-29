import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertCatalogueRegistryContract,
  assertComponentCatalogueItemContract
} from '../../src/contracts/index.js';
import {
  catalogueItemKey,
  loadCatalogueItemsFromMap,
  loadCatalogueRegistryFromText
} from '../../src/catalogue/catalogue-registry-loader.js';

const registryPath = 'catalogues/base-piping/catalogue-registry.json';
const indexPath = 'catalogues/base-piping/base-piping.index.json';
const itemPaths = [
  'catalogues/base-piping/items/pipe-straight-4in-std.json',
  'catalogues/base-piping/items/elbow-90lr-4in-std.json',
  'catalogues/base-piping/items/support-rest-generic.json'
];

const registryText = await readFile(registryPath, 'utf8');
const registryResult = loadCatalogueRegistryFromText(registryText, { sourceName: registryPath });
assert.equal(registryResult.validation.ok, true, `registry must validate: ${registryResult.validation.errors.join('; ')}`);
assert.equal(assertCatalogueRegistryContract(registryResult.registry).ok, true);

const fileMap = new Map();
fileMap.set(indexPath, await readFile(indexPath, 'utf8'));
for (const itemPath of itemPaths) fileMap.set(itemPath, await readFile(itemPath, 'utf8'));

const itemResult = loadCatalogueItemsFromMap(registryResult.registry, fileMap, { sourceName: indexPath });
assert.equal(itemResult.items.length, 3, 'base-piping item count');
assert.deepEqual(itemResult.audit.warnings, [], 'catalogue item loader warnings');
assert.deepEqual(itemResult.audit.unsupportedSources, [], 'unsupported catalogue sources');

for (const item of itemResult.items) {
  assert.equal(assertComponentCatalogueItemContract(item).ok, true, `${catalogueItemKey(item)} validates`);
}

const summary = {
  schema: 'CatalogueLoadSummary.v1',
  registryAudit: registryResult.audit,
  itemAudit: itemResult.audit
};
const expectedSummary = JSON.parse(await readFile('samples/catalogue/base-piping.catalogue-summary.expected.json', 'utf8'));
assert.deepEqual(summary, expectedSummary, 'catalogue load summary must match golden fixture');

const loaderSource = await readFile('src/catalogue/catalogue-registry-loader.js', 'utf8');
for (const forbidden of ['writeRvm', 'writeAtt', 'rvm-writer', 'att-writer', 'managed-stage-rvm-converter']) {
  assert.equal(loaderSource.includes(forbidden), false, `catalogue loader must not reference ${forbidden}`);
}
assert.equal(typeof globalThis.window, 'undefined', 'catalogue tests must run without browser window dependency');

console.log('catalogue registry loader tests passed');
