# Core Valve / Flange Catalogue Audit

## Purpose

This document records the implementation status of the valve/flange visual catalogue and the RVM export parity work.

The key distinction remains intentional:

```text
Current catalogue = proportional GLB visual fallback
Future catalogue  = shared GLB/RVM geometry contract backed by dimensional data
```

This is a core rendering/export audit only. It is not a UI task.

## Current files in scope

```text
src/valve-flange-visual-catalog.js
src/valve-flange-primitive-adapter.js
src/rvm-catalogue-primitive-translator.js
src/rvm-catalogue-export-wiring.js
src/converter.js
src/valve-flange-scene-postprocess.js
src/export-model.js
src/rvm-converter.js
tests/valve-flange-visual-catalog.test.mjs
tests/valve-flange-renderer-reference-visual.test.mjs
tests/valve-flange-scene-postprocess.test.mjs
tests/flanged-valve-upright-visual.test.mjs
tests/valve-flange-catalog-orientation.test.mjs
tests/valve-flange-catalog-scope-audit.test.mjs
tests/valve-flange-primitive-adapter.test.mjs
tests/rvm-catalogue-primitive-requirements.test.mjs
tests/rvm-catalogue-export-wiring.test.mjs
```

## Current catalogue classification

| Area | Current status | Audit result |
|---|---|---|
| GLB visual preview | Uses proportional valve/flange catalogue | Acceptable as fallback visual layer |
| Shared primitive adapter | Converts catalogue plans to renderer-neutral records | C2 bridge implemented |
| RVM primitive translator | Converts adapter hints into writer-safe RVM primitive records | C3 requirements seam implemented |
| Production RVM converter | C3B production RVM converter now applies catalogue parity before Navis-safe normalization and RVM/ATT writing | Implemented for catalogue-resolved valve/flange components |
| Neutral export model | Still builds a conservative base export tree and fallback primitives | Kept stable by design |
| ATT metadata | Catalogue-rendered valve/flange nodes now expose parity/proportional-fallback metadata | Implemented for C3B wiring path |
| ASME/rating dimensions | Not present | Gap |
| Valve/flange topology | Still proportional and partly visual-catalogue driven | Needs future dimensional DB / topology consolidation |
| Tests | Catalogue adapter, translator, and production wiring gates now exist | Needs future end-to-end sample gates |

## What the current catalogue does well

### 1. Provides a proportional visual dictionary

The catalogue currently defines proportional profiles for:

```text
VALVE_GENERIC
VALVE_FLANGED
VALVE_GATE
VALVE_GLOBE
VALVE_BALL
VALVE_CHECK
VALVE_BUTTERFLY
VALVE_CONTROL

FLANGE_GENERIC
FLANGE_WELD_NECK
FLANGE_BLIND
```

This gives the GLB preview and C3B RVM output more useful visual symbols than a single centreline cylinder.

### 2. Handles valve/flange precedence

The resolver treats tokens such as `FLANGED_VALVE` as a valve with flanged ends, not as a loose flange pair.

This is important because many source records contain mixed words such as:

```text
FLANGED_VALVE
VALVE_FLANGED
VFLG
```

### 3. Builds an ordered local-axis primitive plan

The function `buildLinearVisualPrimitivePlan()` converts a resolved spec into axial primitives such as:

```text
weld-neck / shoulder
flange plate
raised face
gasket / seam
valve body
bonnet / wheel / actuator overlays
```

The existing continuity checks are useful for preventing obvious local-axis gaps and overlaps in fallback visuals.

### 4. GLB converter uses the catalogue

`src/converter.js` imports:

```js
buildLinearVisualPrimitivePlan
getValveFlangeVisualSpec
```

and uses those specs to create grouped Three.js visual primitives for valves/flanges.

### 5. Shared primitive adapter now exists

`src/valve-flange-primitive-adapter.js` converts the same catalogue primitive plan into renderer-neutral records such as:

```text
cylinder
frustum
valve-body
radial-cylinder
torus
direction-arrow
bolt-pattern
```

The adapter is intentionally not Three.js-dependent and intentionally does not write RVM directly.

### 6. RVM translator now exists

`src/rvm-catalogue-primitive-translator.js` converts adapter hints into RVM-writer-safe primitive records.

Writer-safe output kinds remain limited to:

```text
cylinder
box
pyramid
sphere
```

Adapter-only hints such as `frustum`, `torus`, `bolt-pattern`, `valve-body`, and `radial-cylinder` must not reach `src/rvm-writer.js` directly.

### 7. Production RVM wiring now exists

`src/rvm-converter.js` now applies:

```text
buildRvmExportModel(model)
→ applyRvmCatalogueExportParity(exportModel, model)
→ normalizeNavisExportModelNames(exportModel)
→ assertNavisExportModel(exportModel)
→ writeRvm / writeAtt
```

This keeps the neutral export model stable while enabling production RVM/ATT catalogue parity for resolved valve/flange components.

## Core gaps still open

## Gap 1 — Catalogue is not dimensional / ASME-backed

The current catalogue is explicitly proportional. It is not a dimensional database.

Missing future data layers include:

```text
ASME B16.5 flange dimensions
ASME B16.10 valve face-to-face dimensions
rating/class lookup
nominal bore / OD / schedule handling
flange thickness / raised face / bolt circle lookup
valve end connection variants
manufacturer-specific valve lengths if required
```

Until this exists, the catalogue should remain labelled as fallback visual geometry.

## Gap 2 — Topology is still split across catalogue, converter, and postprocess

The current pipeline has multiple responsibilities:

```text
catalogue        -> proposes visual primitive plan
adapter          -> normalizes primitive plan into export-neutral records
RVM translator   -> converts export-neutral records into writer-safe RVM primitives
RVM wiring       -> replaces production RVM valve/flange nodes where applicable
converter        -> renders GLB meshes
postprocess      -> hides legacy base cylinders / adjusts some single-flange cases
export-model     -> independently emits neutral base primitives and fallback geometry
```

Future target:

```text
source record
→ normalized piping component
→ geometry contract
→ shared primitive plan
→ GLB adapter and RVM adapter
```

Postprocess should become a temporary compatibility layer, not the permanent topology owner.

## Gap 3 — End-to-end sample parity still needs representative fixtures

Existing tests are useful for structure, primitive translation, and production wiring. Future gates should verify:

```text
same catalogue spec is used by GLB and RVM paths
RVM export contains catalogue primitive roles for real BM_CII valve/flange records
GLB visual roles and RVM primitive roles are compatible
single flange topology is represented directly, not repaired only by postprocess
BM_CII sample valve/flange components render/export consistently
```

## Required future architecture

The implementation now has the first shared adapter and RVM wiring boundaries:

```text
valve-flange-visual-catalog.js
  → buildLinearVisualPrimitivePlan()

valve-flange-primitive-adapter.js
  → renderer-neutral primitive records

rvm-catalogue-primitive-translator.js
  → RVM-writer-safe primitive records

rvm-catalogue-export-wiring.js
  → production RVM node replacement + ATT metadata

future adapters
  → more complete GLB mesh adapter
  → dimensional DB-backed RVM primitive adapter
```

This avoids maintaining two unrelated visual/export concepts.

## Recommended implementation sequence

### C1 — Audit and guardrail

Status: complete.

Purpose:

```text
Document current scope.
Prove GLB uses the catalogue.
Record that the catalogue is proportional, not ASME/dimensional.
Prevent accidental claims that the catalogue is ASME/dimensional.
```

### C2 — Shared valve/flange primitive adapter

Status: complete when `src/valve-flange-primitive-adapter.js` and `tests/valve-flange-primitive-adapter.test.mjs` are merged.

Creates a common adapter that transforms catalogue plan primitives into renderer-neutral primitive records.

Expected output roles include:

```text
VALVE_BODY
END_COLLAR_A / END_COLLAR_B
VALVE_NECK_A / VALVE_NECK_B
FLANGE_DISC_A / FLANGE_DISC_B
RAISED_FACE_A / RAISED_FACE_B
GASKET_CENTER
WELD_NECK_A / WELD_NECK_B
BONNET_STEM
HANDWHEEL
ACTUATOR
FLOW_ARROW
BOLT_PATTERN
```

C2 does not write production RVM. The adapter policy must continue to report:

```text
productionRvmExportEnabled: false
asmeDimensionalDatabaseBacked: false
```

### C3 — RVM catalogue primitive requirements

Status: complete.

Purpose:

```text
Create the writer-safe RVM translator seam.
Prove flanged valves and weld-neck flanges translate into segmented RVM primitives.
Prove unsupported adapter-only primitive kinds do not reach the RVM writer.
Prove ATT catalogue metadata fields are available.
```

### C3B — Production RVM catalogue export wiring

Status: complete when `src/rvm-catalogue-export-wiring.js`, `src/rvm-converter.js`, and `tests/rvm-catalogue-export-wiring.test.mjs` are merged.

Production RVM conversion now applies catalogue parity for resolved valve/flange components:

```text
VALVE_FLANGED exports end collars + stepped necks + valve body + overlays where available
FLANGE_WELD_NECK exports weld necks + flange discs + raised faces + gasket + bolts
RVM primitive count increases only for catalogue-resolved valve/flange components
non-valve/flange components continue using existing fallback primitives
```

Catalogue-rendered RVM/ATT nodes now carry metadata such as:

```text
CATALOGUE_VISUAL
CATALOGUE_CLASS
CATALOGUE_TYPE
CATALOGUE_RECIPE_ID
CATALOGUE_SCHEMA
PROPORTIONAL_FALLBACK
ASME_DIMENSIONAL_DB_BACKED
RVM_CATALOGUE_PARITY
CATALOGUE_EXPORT_PRODUCTION_WIRING
```

### C4 — End-to-end sample gates

Add BM_CII or small fixture tests that prove GLB/RVM catalogue parity for representative records.

### C5 — Replace temporary topology postprocess

Once direct topology is reliable, reduce postprocess to compatibility cleanup only.

### C6 — Dimensional database layer

Add real dimensional data later as a separate layer. Do not mix dimensional DB work with proportional fallback cleanup.

## Guardrails

Do not claim the current catalogue is:

```text
ASME accurate
rating-size complete
Navis export dimensionally complete
```

until C6 is implemented and tested.

Do not break the existing fallback behavior:

```text
Unknown valve/flange records must still render/export using existing fallback primitives.
Non-valve/flange component export must remain stable.
```
