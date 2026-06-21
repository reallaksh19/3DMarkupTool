# Managed-stage RVM profile export

This path converts a managed-stage JSON profile into a strict AVEVA Review-style RVM/ATT artifact set.

## Scope

The managed-stage exporter is separate from the normal InputXML/UI/GLB path.

It emits only:

- RVM cylinder primitive code `8`
- explicit opt-in RVM code-4 elbow/torus primitive code `4`

It does not emit support geometry, boxes, pyramids, spheres, meshes, cones, reducers, UI objects, or GLB fallback symbols.

## Geometry contract phase

Before RVM primitives are planned, every non-support staged record is normalized into a managed-stage geometry contract:

```text
ManagedStageRecord
→ ManagedStageGeometryContract
→ primitive planner
→ RVM export model
→ binary RVM
```

The contract layer records:

- staged `TYPE`, `RAW_TYPE`, and `DTXR`
- `FROM_NODE` and `TO_NODE`
- exact `APOS` and `LPOS` endpoint coordinates in millimetres
- center point, unit axis, length, diameter, and radius
- component class such as `PIPE`, `BEND`, `FLANGE`, `VALVE`, or `UNKNOWN_PIPELIKE`
- centerline kind: `line` for inline components, `arc` for bends
- endpoint-lock status proving the component is tied to its staged endpoints

For the BM_CII fixture the geometry contract gate expects 40 geometry contracts, 12 skipped support records, 33 line contracts, and 7 arc contracts.

## Endpoint-locked cylinder phase

Inline RVM cylinder primitives are authored through `src/rvm-cylinder-primitive-builder.js` instead of hand-assembled midpoint/axis objects.

For each non-bend cylinder primitive, the builder records:

- exact `startMm` and `endMm`
- derived center point and unit direction
- derived length in millimetres
- local cylinder bbox for audit/reporting
- `endpointLocked: true`
- source geometry contract name and source element id

The binary writer still emits the same RMSS-style code-8 cylinder payload:

```text
record version
primitive code 8
12-float transform
6-float local bbox
radius
length
```

## Component recipe phase

Inline pipe/fitting components are decomposed through `src/managed-stage-piping-component-recipes.js` before they become code-8 cylinders.

The recipe layer is responsible for visual continuity within a component span:

```text
ManagedStageGeometryContract
→ component recipe segment(s)
→ endpoint-locked code-8 cylinder primitive(s)
```

Current recipes are:

- `PIPE`: one full-span body cylinder
- `UNSPECIFIED`: one full-span unknown-pipelike cylinder
- `FLANGE`: one full-span enlarged flange cylinder
- `VALVE`: one full-span valve-body cylinder
- `FLANGE_PAIR`: two contiguous inline flange cylinders split at the midpoint
- `FLANGED_VALVE`: contiguous flange/body/flange cylinders

Every recipe must cover the full APOS→LPOS contract span with no internal gaps or overlaps. The BM_CII fixture still emits 41 code-8 cylinders, but `FLANGE_PAIR` no longer creates two end plates with a center void.

## Tangent-aware code-4 bend phase

Code-4 BEND primitives are authored through `src/rvm-code4-elbow-geometry-solver.js` and now receive adjacent tangent hints from `src/managed-stage-elbow-tangent-hints.js`.

The hint resolver uses the geometry contract graph:

```text
FROM_NODE / TO_NODE adjacency
→ incoming tangent at bend start
→ outgoing tangent at bend end
→ bend plane normal hint
→ endpoint-fit code-4 solver
```

For each BEND, the export path records:

- adjacent start/end tangent source elements
- unit start/end tangent vectors when available
- tangent-derived plane normal
- tangent hint state, such as `adjacent-start-end`
- endpoint-fit code-4 basis and bbox

The binary writer still emits the same RMSS-style code-4 payload:

```text
record version
primitive code 4
12-float transform
6-float local bbox
bendRadius
tubeRadius
sweepAngleRad
```

For the BM_CII fixture the tangent hint gate expects 7 BEND records and 7 `adjacent-start-end` tangent hints.

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
npm run artifact:managed-stage-rvm:file -- BM_CII_INPUT_managed_stage.json --expect-bm-cii --outdir=artifacts/managed-stage-rvm
```

Equivalent direct command:

```bash
node scripts/generate-managed-stage-rvm-artifact.mjs BM_CII_INPUT_managed_stage.json --expect-bm-cii --outdir=artifacts/managed-stage-rvm
```

Outputs:

- `BM_CII_INPUT_managed_stage.rvm`
- `BM_CII_INPUT_managed_stage.att`
- `BM_CII_INPUT_managed_stage.audit.json`
- `BM_CII_INPUT_managed_stage.zip`

## Generate the final RMSS-style deliverable package

Use this as the single operator command for the real BM_CII managed-stage JSON:

```bash
npm run artifact:managed-stage-rvm:final -- BM_CII_INPUT_managed_stage.json --expect-bm-cii --reference-rvm=RMSS.rvm --outdir=artifacts/managed-stage-rvm
```

If `RMSS.rvm` is not available locally, omit `--reference-rvm=RMSS.rvm`; the command still performs the decoder-layout self-check against the RMSS/RHBG code-4 and code-8 payload layout contract.

The final command runs the complete chain:

```text
generate .rvm/.att/.audit.json/.zip
verify source profile strict gate
verify persisted artifact round-trip
verify RMSS/RHBG primitive layout compatibility
inspect element/primitive tables
write final stored ZIP package
```

It writes:

- `BM_CII_INPUT_managed_stage.rvm`
- `BM_CII_INPUT_managed_stage.att`
- `BM_CII_INPUT_managed_stage.audit.json`
- `BM_CII_INPUT_managed_stage.verify.audit.json`
- `BM_CII_INPUT_managed_stage.reference-compat.json`
- `BM_CII_INPUT_managed_stage.inspection.json`
- `BM_CII_INPUT_managed_stage.elements.csv`
- `BM_CII_INPUT_managed_stage.primitives.csv`
- `BM_CII_INPUT_managed_stage.inspection.md`
- `BM_CII_INPUT_managed_stage.final-rmss-style.zip`

The final ZIP contains the binary RVM, ATT, audits, and inspection reports in one package.

## Verify generated artifact files from disk

After generation, run the round-trip artifact verifier:

```bash
npm run verify:managed-stage-rvm-artifact
```

For a custom artifact directory/base:

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

## Verify RVM reference-layout compatibility

After artifact generation, run:

```bash
npm run verify:managed-stage-rvm-reference
```

This self-checks the generated RVM against the recorded RMSS/RHBG primitive layout contract:

- Review chunk core is `HEAD`, `MODL`, balanced `CNTB`/`CNTE`, optional `COLR`, terminal `END:`
- generated primitive codes are restricted to `4` and `8`
- code `4` body length is `92` bytes with three payload words
- code `8` body length is `88` bytes with two payload words
- persisted audit primitive histogram and chunk counts match the decoded binary

To compare against an external reference binary, pass the reference file explicitly:

```bash
node scripts/verify-managed-stage-rvm-reference-compat.mjs \
  --dir=artifacts/managed-stage-rvm \
  --base=BM_CII_INPUT_managed_stage \
  --expect-bm-cii \
  --reference-rvm=RMSS.rvm \
  --audit-out=artifacts/managed-stage-rvm/BM_CII_INPUT_managed_stage.reference-compat.json
```

The repository does not commit `RMSS.rvm`; the comparator accepts it as a local operator-supplied reference artifact.

## Inspect generated artifact tables

After generation and verification, run:

```bash
npm run inspect:managed-stage-rvm
```

For a custom artifact directory/base:

```bash
node scripts/inspect-managed-stage-rvm-artifact.mjs \
  --dir=artifacts/managed-stage-rvm \
  --base=BM_CII_INPUT_managed_stage \
  --expect-bm-cii
```

The inspection command re-opens `.rvm`, `.att`, and `.audit.json`, verifies the strict gate again, then writes:

- `BM_CII_INPUT_managed_stage.inspection.json`
- `BM_CII_INPUT_managed_stage.primitives.csv`
- `BM_CII_INPUT_managed_stage.elements.csv`
- `BM_CII_INPUT_managed_stage.inspection.md`

The CSV outputs are intended for quick review of the element-by-element stitch result:

- `elements.csv` lists every staged component CNTB in order with `FROM_NODE`, `TO_NODE`, `TYPE`, `DTXR`, material, primitive count, primitive codes, and PRIM offsets.
- `primitives.csv` lists every decoded PRIM with element name, local primitive name, primitive code, body length, chunk offset, material, center, direction, and decoded payload.

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
npm run verify:managed-stage-rvm-artifact
npm run verify:managed-stage-rvm-reference
npm run inspect:managed-stage-rvm
npm run artifact:managed-stage-rvm:final -- --fixture=bm-cii --expect-bm-cii
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
