# Managed-stage RVM profile export

This path converts a managed-stage JSON profile into a strict AVEVA Review-style RVM/ATT artifact set.

## Scope

The managed-stage exporter is separate from the normal InputXML/UI/GLB path. It emits only:

- RVM cylinder primitive code `8`
- explicit opt-in RVM code-4 elbow/torus primitive code `4`

It does not emit support geometry, boxes, pyramids, spheres, meshes, cones, reducers, UI objects, or GLB fallback symbols.

## InputXML-based JSON bend exclusion

Default managed-stage JSON processing now includes this config:

```js
{
  excludeBendsWhileProcessingInputXmlBasedJson: true
}
```

The option is ON by default only when the managed-stage JSON is detected as InputXML-derived. Detection looks for `InputXML` markers in the parsed profile, including source/converter/branch names and staged record metadata such as `SOURCE_FORMAT`.

When ON:

- staged `BEND` records do **not** emit RMSS code-4 elbow/torus PRIMs
- each staged `BEND` emits one endpoint-locked generic `1.5D` bend represented as a code-8 chord cylinder
- adjacent tangent-source components at the bend start/end nodes are trimmed by the generic `1.5D` length, capped per component span
- the audit records `processingConfig`, `inputXmlBendExclusionAudit`, and `genericInputXmlBendAssumptions`

To force the native code-4 path for comparison/debug, call the converter/export model with:

```js
{
  excludeBendsWhileProcessingInputXmlBasedJson: false
}
```

## Geometry contract phase

Before RVM primitives are planned, every non-support staged record is normalized into a managed-stage geometry contract:

```text
ManagedStageRecord
→ ManagedStageGeometryContract
→ processing config / bend exclusion
→ primitive planner
→ RVM export model
→ binary RVM
```

The contract layer records staged `TYPE`, `RAW_TYPE`, `DTXR`, `FROM_NODE`, `TO_NODE`, exact `APOS`/`LPOS`, center point, axis, length, diameter, radius, component class, centerline kind, and endpoint-lock status.

For the BM_CII fixture the geometry contract gate expects 40 geometry contracts, 12 skipped support records, 33 line contracts, and 7 arc contracts.

## Endpoint-locked cylinder phase

Inline RVM cylinder primitives are authored through `src/rvm-cylinder-primitive-builder.js`. The binary writer emits the same RMSS-style code-8 cylinder payload:

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

Current recipes are:

- `PIPE`: one body cylinder over the effective span
- `UNSPECIFIED`: one unknown-pipelike cylinder over the effective span
- `FLANGE`: one enlarged flange cylinder over the effective span
- `VALVE`: one valve-body cylinder over the effective span
- `FLANGE_PAIR`: two contiguous inline flange cylinders split at midpoint
- `FLANGED_VALVE`: contiguous flange/body/flange cylinders

For InputXML-derived JSON, the effective span can be shorter than APOS→LPOS when bend-exclusion trimming is applied at one or both ends.

## Tangent-aware code-4 bend phase

The native code-4 BEND path still exists for explicit opt-in comparison/debug. It uses `src/rvm-code4-elbow-geometry-solver.js` with adjacent tangent hints from `src/managed-stage-elbow-tangent-hints.js` and emits:

```text
record version
primitive code 4
12-float transform
6-float local bbox
bendRadius
tubeRadius
sweepAngleRad
```

For default InputXML-derived JSON processing, this native code-4 path is bypassed by the bend-exclusion config.

## Verify a real profile

```bash
npm run verify:managed-stage-rvm:file -- BM_CII_INPUT_managed_stage.json --expect-bm-cii
```

To save the complete audit JSON:

```bash
npm run verify:managed-stage-rvm:file -- BM_CII_INPUT_managed_stage.json --expect-bm-cii --audit-out=artifacts/managed-stage-rvm/BM_CII_INPUT_managed_stage.verify.audit.json
```

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

```bash
npm run artifact:managed-stage-rvm:final -- BM_CII_INPUT_managed_stage.json --expect-bm-cii --reference-rvm=RMSS.rvm --outdir=artifacts/managed-stage-rvm
```

If `RMSS.rvm` is not available locally, omit `--reference-rvm=RMSS.rvm`; the command still performs the decoder-layout self-check against the RMSS/RHBG primitive layout contract.

The final command runs:

```text
generate .rvm/.att/.audit.json/.zip
verify source profile strict gate
verify persisted artifact round-trip
verify RMSS/RHBG primitive layout compatibility
inspect element/primitive tables
write final stored ZIP package
```

## Verify generated artifact files from disk

```bash
npm run verify:managed-stage-rvm-artifact
```

For a custom artifact directory/base:

```bash
node scripts/verify-managed-stage-rvm-artifact.mjs --dir=artifacts/managed-stage-rvm --base=BM_CII_INPUT_managed_stage --expect-bm-cii
```

This re-opens the persisted `.rvm`, `.att`, `.audit.json`, and `.zip` files and verifies byte counts, chunk counts, ATT/CNTB names, primitive histogram, stitch manifest, ZIP entries, and the strict audit gate.

## Verify RVM reference-layout compatibility

```bash
npm run verify:managed-stage-rvm-reference
```

The self-check verifies:

- Review chunk core is `HEAD`, `MODL`, balanced `CNTB`/`CNTE`, optional `COLR`, terminal `END:`
- generated primitive codes are restricted to `4` and `8`
- code `4` decoder layout is 92 bytes / three payload words when code-4 is emitted
- code `8` body length is 88 bytes / two payload words
- persisted audit primitive histogram and chunk counts match the decoded binary

To compare against an external reference binary:

```bash
node scripts/verify-managed-stage-rvm-reference-compat.mjs \
  --dir=artifacts/managed-stage-rvm \
  --base=BM_CII_INPUT_managed_stage \
  --expect-bm-cii \
  --reference-rvm=RMSS.rvm \
  --audit-out=artifacts/managed-stage-rvm/BM_CII_INPUT_managed_stage.reference-compat.json
```

## Inspect generated artifact tables

```bash
npm run inspect:managed-stage-rvm
```

The inspection command writes:

- `BM_CII_INPUT_managed_stage.inspection.json`
- `BM_CII_INPUT_managed_stage.primitives.csv`
- `BM_CII_INPUT_managed_stage.elements.csv`
- `BM_CII_INPUT_managed_stage.inspection.md`

The CSV outputs are intended for quick review of the element-by-element stitch result.

## Stitch manifest

The generated audit includes `stitchManifest`, proving that the staged JSON was assembled into one RVM stream by stitching ordered CNTB element nodes, not by concatenating independent RVM binaries.

For each geometry component, the manifest records input component name, emitted CNTB review name, `FROM_NODE` / `TO_NODE`, staged `TYPE` / `DTXR`, material id, primitive count, expected/emitted primitive codes, PRIM offset/body length, primitive center/direction/dimensions.

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

For the current BM_CII managed-stage profile, default strict mode expects:

| Metric | Expected |
|---|---:|
| Geometry components | 40 |
| ATTA/support records skipped from geometry | 12 |
| Root/group/element CNTB count | 43 |
| PRIM count | 48 |
| Code-4 elbow/torus PRIM count | 0 |
| Code-8 cylinder PRIM count | 48 |
| InputXML BEND records excluded from code-4 | 7 |
| Generic 1.5D code-8 bend cylinders | 7 |
| Forbidden primitive codes `2,5,6,7,11` | 0 |
