# Core Valve / Flange Catalogue Audit

## Purpose

This document records the current implementation status of the valve/flange visual catalogue after the recent catalogue work.

The key distinction is intentional:

```text
Current catalogue = proportional GLB visual fallback
Future catalogue  = shared GLB/RVM geometry contract backed by dimensional data
```

This is a core rendering/export audit only. It is not a UI task.

## Current files in scope

```text
src/valve-flange-visual-catalog.js
src/converter.js
src/valve-flange-scene-postprocess.js
src/export-model.js
src/rvm-converter.js
tests/valve-flange-visual-catalog.test.mjs
tests/valve-flange-renderer-reference-visual.test.mjs
tests/valve-flange-scene-postprocess.test.mjs
tests/flanged-valve-upright-visual.test.mjs
tests/valve-flange-catalog-orientation.test.mjs
```

## Current catalogue classification

| Area | Current status | Audit result |
|---|---|---|
| GLB visual preview | Uses proportional valve/flange catalogue | Acceptable as fallback visual layer |
| RVM export | Does not yet use valve/flange catalogue primitives | Gap |
| ATT metadata | Still component-level metadata, not catalogue primitive metadata | Gap |
| ASME/rating dimensions | Not present | Gap |
| Valve/flange topology | Partly in catalogue, partly repaired by scene postprocess | Needs consolidation |
| Tests | Good structural continuity tests, limited export parity tests | Needs expansion |

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

This gives the GLB preview more useful visual symbols than a single centreline cylinder.

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

## Core gaps

## Gap 1 — RVM export does not yet use the catalogue

`src/export-model.js` currently emits component bodies as generic primitives:

```text
kind: cylinder
name: <component>_BODY
radius: bore / 2
length: trimmed component length
```

Rigid elements may get an additional marker cylinder, but catalogue roles such as flange plate, raised face, tapered shoulder, valve body, bonnet, and handwheel are not exported as RVM primitives.

This means the current outputs can diverge:

```text
GLB preview: valve/flange catalogue geometry
RVM export: simplified cylinder/marker geometry
```

This is the highest-priority core gap.

## Gap 2 — Catalogue is not dimensional / ASME-backed

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

## Gap 3 — Topology is split across catalogue, converter, and postprocess

The current pipeline has multiple responsibilities:

```text
catalogue     -> proposes visual primitive plan
converter     -> renders GLB meshes
postprocess   -> hides legacy base cylinders / adjusts some single-flange cases
export-model  -> independently emits RVM primitives
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

## Gap 4 — Test coverage does not yet prove GLB/RVM parity

Existing tests are useful for structure and continuity, but future gates should verify:

```text
same catalogue spec is used by GLB and RVM paths
RVM export contains catalogue primitive roles for valve/flange components
GLB visual roles and RVM primitive roles are compatible
single flange topology is represented directly, not repaired only by postprocess
BM_CII sample valve/flange components render/export consistently
```

## Required future architecture

The next implementation phase should introduce a shared adapter boundary:

```text
valve-flange-visual-catalog.js
  → buildLinearVisualPrimitivePlan()

new shared adapter / contract
  → GLB mesh adapter
  → RVM primitive adapter
```

This avoids maintaining two different visual/export concepts.

## Recommended implementation sequence

### C1 — Audit and guardrail

Status: this document and the related test.

Purpose:

```text
Document current scope.
Prove GLB uses the catalogue.
Prove RVM export does not yet use the catalogue.
Prevent accidental claims that the catalogue is ASME/dimensional or RVM-ready.
```

### C2 — Shared valve/flange primitive adapter

Create a common adapter that transforms catalogue plan primitives into renderer-neutral primitive records.

Expected output roles:

```text
VALVE_BODY
TAPERED_SHOULDER
FLANGE_PLATE
RAISED_FACE
GASKET
WELD_NECK_PIPE_SIDE
BONNET_STEM
HANDWHEEL
ACTUATOR
FLOW_ARROW
BOLTS
```

### C3 — RVM catalogue export parity

Update `src/export-model.js` so valve/flange components export catalogue primitives instead of a single generic cylinder where applicable.

Required acceptance:

```text
VALVE_FLANGED exports valve body + shoulders + flange plates + raised faces
FLANGE_WELD_NECK exports weld neck + flange plate + raised face / gasket roles
RVM primitive count increases only for valve/flange components
non-valve/flange components continue using existing primitive path
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
RVM export complete
Navis export parity complete
```

until C2/C3/C6 are implemented and tested.

Do not break the existing fallback behavior:

```text
Unknown valve/flange records must still render/export using existing fallback primitives.
Non-valve/flange component export must remain stable.
```
