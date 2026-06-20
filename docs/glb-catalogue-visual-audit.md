# GLB catalogue visual audit artifact

## Purpose

C9 adds a CI-safe inspection artifact for the proportional valve/flange catalogue used by the GLB preview path.

The audit is intentionally not a binary GLB export. It validates the catalogue primitive plan before Three.js mesh creation:

```text
InputXML sample
→ parseMarkupSource()
→ buildValveFlangePrimitiveAdapterPlan()
→ role/span/radius/continuity audit
→ JSON + Markdown artifact
```

## Generated files

The CI job writes the artifact to:

```text
artifacts/glb-catalogue-visual-audit/
```

with these files:

```text
BM_CII_glb_catalogue_visual.audit.json
BM_CII_glb_catalogue_visual.summary.md
```

## What the audit checks

The C9 gate verifies that the real BM_CII sample still resolves valve/flange catalogue candidates and that the catalogue plan remains suitable for GLB preview rendering:

```text
- valve/flange catalogue candidates are present
- all catalogue centerline-replacement spans are continuous
- flanged valve contains collars, tapered shoulders, and compact body
- end collars remain smaller than the valve body
- valve body axial span remains compact
- flange plate/disc primitives remain visually thin
- raised faces and gasket stay inside flange plate radius
- bolt circle stays inside flange plate radius
- proportional fallback is explicit
- no ASME/rating-size dimensional database claim is made
```

## Explicit non-goals

```text
- does not render or compare pixels
- does not emit binary GLB
- does not change RVM writer behavior
- does not add ASME/rating-size dimensional data
- does not replace future visual screenshot review
```

## Why this exists after C8

C8 tuned the proportional catalogue to reduce detached washer/collar appearance in GLB preview. C9 keeps those visual proportions inspectable in CI, so future changes cannot silently stretch valve bodies, oversize collar discs, or place bolts outside flange plates.
