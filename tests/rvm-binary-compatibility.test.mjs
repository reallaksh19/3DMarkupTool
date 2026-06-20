import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { writeRvm } from '../src/rvm-writer.js';
import { auditRvmBinary, assertRvmBinaryCompatibility } from '../src/rvm-binary-audit.js';

const writerSource = readFileSync(new URL('../src/rvm-writer.js', import.meta.url), 'utf8');
const auditSource = readFileSync(new URL('../src/rvm-binary-audit.js', import.meta.url), 'utf8');
const artifactScript = readFileSync(new URL('../scripts/generate-rvm-catalogue-sample-artifact.mjs', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const exportModel = {
  root: {
    name: 'INPUTXML_RVM_ROOT',
    material: 0,
    attributes: { TYPE: 'ROOT' },
    primitives: [],
    children: [
      {
        name: 'PLANT_GEOMETRY',
        material: 0,
        attributes: { TYPE: 'GROUP' },
        primitives: [],
        children: [
          {
            name: 'PE_001_PIPE_10_TO_20',
            material: 1,
            attributes: { TYPE: 'COMPONENT', ENGINEERING_TYPE: 'PIPE' },
            primitives: [
              {
                name: 'PE_001_PIPE_10_TO_20_BODY',
                kind: 'cylinder',
                center: [500, 0, 0],
                direction: [1, 0, 0],
                radius: 50,
                length: 1000
              }
            ],
            children: []
          }
        ]
      }
    ]
  },
  audit: { primitiveCount: 1 }
};

const rvm = writeRvm(exportModel);
assert.ok(rvm instanceof ArrayBuffer, 'RVM writer must return ArrayBuffer');

const audit = assertRvmBinaryCompatibility(rvm, { primitiveCount: 1 });
assert.equal(audit.schema, 'RvmBinaryAudit.v1');
assert.equal(audit.firstChunk, 'HEAD', 'HEAD must be the first RVM chunk');
assert.equal(audit.secondChunk, 'MODL', 'MODL must be the second RVM chunk');
assert.equal(audit.terminalChunk, 'END:', 'END: must terminate the RVM chunk stream');
assert.equal(audit.endBodyLength, 4, 'END: must include a small marker body matching RHBG-style Review output');
assert.equal(audit.allChunkMarkersOne, true, 'all chunk headers must use Review-style marker value 1');
assert.equal(audit.balancedCntbCnte, true, 'CNTB/CNTE chunks must be balanced');
assert.equal(audit.contiguousUntilEnd, true, 'generated RVM must not include trailing bytes after END:');
assert.equal(audit.primitiveChunkCount, 1, 'PRIM chunk count must equal exported primitive count');
assert.deepEqual(
  audit.chunks.map((chunk) => chunk.id),
  ['HEAD', 'MODL', 'CNTB', 'CNTB', 'CNTB', 'PRIM', 'CNTE', 'CNTE', 'CNTE', 'END:'],
  'synthetic hierarchy must scan as the expected Review chunk sequence'
);

const rawAudit = auditRvmBinary(rvm);
assert.equal(rawAudit.ok, true, 'raw audit must pass with no issues');
assert.deepEqual(rawAudit.issues, [], 'binary audit must not report issues for generated writer output');

assert.match(writerSource, /const REVIEW_CHUNK_HEADER_MARKER = 1/, 'writer must use explicit Review chunk header marker value 1');
assert.match(writerSource, /const REVIEW_CONTAINER_CLOSE_BODY_MARKER = 2/, 'writer must use RHBG-style CNTE body marker value 2');
assert.match(writerSource, /const REVIEW_END_BODY_MARKER = 1/, 'writer must use RHBG-style END: body marker value 1');
assert.match(writerSource, /writer\.writeChunk\('CNTE', uint32Body\(REVIEW_CONTAINER_CLOSE_BODY_MARKER\)/, 'writer must emit CNTE body marker 2');
assert.match(writerSource, /writer\.writeChunk\('END:', uint32Body\(REVIEW_END_BODY_MARKER\)/, 'writer must emit END: body marker 1');
assert.match(writerSource, /view\.setUint32\(20, REVIEW_CHUNK_HEADER_MARKER, false\)/, 'writer chunk headers must carry marker value 1');
assert.match(auditSource, /REQUIRED_REVIEW_CHUNKS/, 'binary audit helper must maintain the required chunk contract');
assert.match(auditSource, /allChunkMarkersOne/, 'binary audit must check Review-style marker values');
assert.match(auditSource, /balancedCntbCnte/, 'binary audit must check CNTB/CNTE balance');
assert.match(auditSource, /endBodyLength !== 4/, 'binary compatibility assertion must require END: marker body length');
assert.match(artifactScript, /assertRvmBinaryCompatibility/, 'CI artifact generator must run binary compatibility audit');
assert.match(artifactScript, /rvmBinaryAudit/, 'CI artifact audit JSON must include binary audit summary');
assert.match(pkg.scripts.test, /rvm-binary-compatibility\.test\.mjs/, 'npm test must include the C6 RVM binary compatibility gate');

console.log('RVM binary compatibility gate passed');
