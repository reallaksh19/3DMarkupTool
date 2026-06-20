import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const workflow = readFileSync(new URL('../.github/workflows/rvm-export-phase-gates.yml', import.meta.url), 'utf8');
const generator = readFileSync(new URL('../scripts/generate-rvm-catalogue-sample-artifact.mjs', import.meta.url), 'utf8');
const sampleParityTest = readFileSync(new URL('./rvm-catalogue-sample-parity.test.mjs', import.meta.url), 'utf8');

assert.match(pkg.scripts['artifact:rvm-catalogue-sample'], /generate-rvm-catalogue-sample-artifact\.mjs/, 'package script must expose the RVM catalogue sample artifact generator.');
assert.match(pkg.scripts.test, /rvm-catalogue-ci-artifact\.test\.mjs/, 'npm test must include the C5 CI artifact gate.');

assert.match(workflow, /npm run artifact:rvm-catalogue-sample/, 'CI workflow must generate the BM_CII RVM catalogue sample artifact after gates pass.');
assert.match(workflow, /name:\s*rvm-catalogue-sample/, 'CI workflow must upload the generated RVM catalogue sample artifact.');
assert.match(workflow, /path:\s*artifacts\/rvm-catalogue-sample/, 'CI workflow must upload the artifact directory.');
assert.match(workflow, /if-no-files-found:\s*error/, 'CI must fail if the RVM catalogue sample artifact is missing.');

assert.match(generator, /convertInputXmlToRvmAtt/, 'artifact generator must use the production RVM/ATT conversion boundary.');
assert.match(generator, /BM_CII_Enriched_v8_lite\.XML/, 'artifact generator must use the BM_CII sample.');
assert.match(generator, /baseName\s*=\s*'BM_CII_catalogue_sample'/, 'artifact generator must use the BM_CII catalogue sample base name.');
assert.match(generator, /\$\{baseName\}\.rvm/, 'artifact generator must write the sample RVM file.');
assert.match(generator, /\$\{baseName\}\.att/, 'artifact generator must write the matching ATT file.');
assert.match(generator, /\$\{baseName\}\.audit\.json/, 'artifact generator must write a machine-readable audit JSON.');
assert.match(generator, /\$\{baseName\}\.summary\.md/, 'artifact generator must write a human-readable summary.');
assert.match(generator, /RvmCatalogueSampleArtifact\.v2/, 'artifact generator must declare the C6 artifact schema with binary audit data.');
assert.match(generator, /rvmBinaryAudit/, 'artifact audit must include the C6 binary compatibility audit summary.');
assert.match(generator, /CATALOGUE_EXPORT_PRODUCTION_WIRING/, 'artifact audit must include production catalogue wiring metadata.');
assert.match(generator, /ASME_DIMENSIONAL_DB_BACKED/, 'artifact audit must preserve the non-ASME dimensional DB flag.');
assert.match(generator, /PROPORTIONAL_FALLBACK/, 'artifact audit must preserve the proportional fallback flag.');
assert.match(generator, /unsupportedKinds/, 'artifact audit must summarize unsupported writer primitive kinds.');
assert.match(generator, /\['cylinder', 'box', 'pyramid', 'sphere'\]/, 'artifact generator must keep writer-supported primitive kinds explicit.');

assert.match(sampleParityTest, /rvm-catalogue-sample-parity/, 'C4 sample parity gate must remain in place before artifact generation.');
assert.match(sampleParityTest, /unsupported primitive kind/, 'C4 sample parity gate must continue protecting the writer from unsupported primitive kinds.');

console.log('RVM catalogue CI artifact gate passed');
