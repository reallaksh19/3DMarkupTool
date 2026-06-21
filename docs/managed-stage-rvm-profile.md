# Managed-stage RVM profile export

This path converts a managed-stage JSON profile into a strict AVEVA Review-style RVM/ATT artifact set.

## Scope

The managed-stage exporter is separate from the normal InputXML/UI/GLB path.

It emits only:

- RVM cylinder primitive code `8`
- explicit opt-in RVM code-4 elbow/torus primitive code `4`

It does not emit support geometry, boxes, pyramids, spheres, meshes, cones, reducers, UI objects, or GLB fallback symbols.

## Verify a real profile

Use this before generating files:

```bash
npm run verify:managed-stage-rvm:file -- BM_CII_INPUT_managed_stage.json --expect-bm-cii
```

To save the complete audit JSON:

```bash
npm run verify:managed-stage-rvm:file -- BM_CII_INPUT_managed_stage.json --expect-bm-cii --audit-out=artifacts/managed-stage-rvm/BM_CII_INPUT_managed_stage.verify.audit.json
```

The command prints a compact JSON summary and fails if the strict gate fails.

## Generate RVM/ATT artifacts from a real profile

```bash
node scripts/generate-managed-stage-rvm-artifact.mjs BM_CII_INPUT_managed_stage.json --outdir=artifacts/managed-stage-rvm
```

Outputs:

- `BM_CII_INPUT_managed_stage.rvm`
- `BM_CII_INPUT_managed_stage.att`
- `BM_CII_INPUT_managed_stage.audit.json`
- `BM_CII_INPUT_managed_stage.zip`

## Verify generated artifact files from disk

After generation, run the round-trip artifact verifier:

```bash
node scripts/verify-managed-stage-rvm-artifact.mjs --dir=artifacts/managed-stage-rvm --base=BM_CII_INPUT_managed_stage --expect-bm-cii
```

This re-opens the persisted files and verifies:

- RVM and ATT byte counts match the audit
- decoded RVM chunk counts match the audit
- ATT `NEW` hierarchy names match decoded CNTB names in order
- decoded PRIM histogram matches `audit.primitiveHistogram`
- `stitchManifest.elements[]` matches element CNTB order
- stored ZIP contains `.rvm`, `.att`, and `.audit.json`
- the strict managed-stage gate still passes on the persisted audit

## Stitch manifest

The generated audit includes `stitchManifest`, which is the element-by-element proof that the staged JSON was assembled into one RVM stream by stitching ordered CNTB element nodes, not by concatenating independent RVM binaries.

For each geometry component, the manifest records:

- input component name
- emitted CNTB review name
- `FROM_NODE` / `TO_NODE`
- staged `TYPE` and `DTXR`
- material id
- planned primitive count
- expected/emitted primitive codes
- primitive chunk offset and body length
- primitive center, direction, and dimensions

The strict gate verifies:

- all input geometry elements are mapped
- element order is stable
- planned primitive count equals decoded PRIM count
- stitch-manifest primitive histogram equals the binary primitive histogram
- each planned primitive code equals the decoded emitted PRIM code

## Fixture commands

CI uses a synthetic fixture with the same BM_CII profile shape:

```bash
npm run test:managed-stage-rvm
npm run verify:managed-stage-rvm
npm run artifact:managed-stage-rvm
node scripts/verify-managed-stage-rvm-artifact.mjs --dir=artifacts/managed-stage-rvm --base=BM_CII_INPUT_managed_stage --expect-bm-cii
```

## BM_CII expected strict counts

For the current BM_CII managed-stage profile, strict mode expects:

| Metric | Expected |
|---|---:|
| Geometry components | 40 |
| ATTA/support records skipped from geometry | 12 |
| Root/group/element CNTB count | 43 |
| PRIM count | 48 |
| Code-4 elbow/torus PRIM count | 7 |
| Code-8 cylinder PRIM count | 41 |
| Forbidden primitive codes `2,5,6,7,11` | 0 |
| Max centerline gap | `<= 0.001 mm` |

The uploaded real JSON reports `stats.restraints = 48`, but only 12 `ATTA` records are present in the staged hierarchy. The exporter treats that as an audit warning and emits only records actually present in `hierarchy[].children[]`.

## Code-4 safety note

Code 4 remains default-disabled outside this managed-stage converter. The normal RVM writer still requires the explicit experimental code-4 gate, and the production primitive-kind contract does not expose `elbow` as a globally supported primitive kind.
