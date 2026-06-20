# Core C20 — GLB support/restraint visual regression artifact

C20 adds a deterministic, CI-safe visual-regression artifact for support/restraint symbols in the actual GLB scene path.

## Scope

The artifact is generated from the real BM_CII conversion boundary:

```text
samples/BM_CII_Enriched_v8_lite.XML
→ convertInputXmlToGlb()
→ actual Three.js scene
→ SUPPORT_RESTRAINT scene symbols
→ SUPPORT_RESTRAINT_PART adapter primitive children
→ JSON / Markdown / SVG visual-regression outputs
```

This is a browserless SVG artifact. It is intended for human review in CI artifacts and for regression gating of the C19 support/restraint catalogue geometry adapter.

## Artifact files

The `glb-support-restraint-visual-regression` CI artifact contains:

```text
BM_CII_glb_support_restraint_visual_regression.audit.json
BM_CII_glb_support_restraint_visual_regression.summary.md
BM_CII_glb_support_restraint_visual_regression.top.svg
BM_CII_glb_support_restraint_visual_regression.side.svg
BM_CII_glb_support_restraint_visual_regression.isometric.svg
```

## What is gated

The C20 gate verifies:

```text
- the artifact runs through convertInputXmlToGlb()
- support/restraint scene parity is CATALOGUE_GEOMETRY_ADAPTER
- every support visual card has finite scene bounds
- every support visual card uses adapter-generated SUPPORT_RESTRAINT_PART children
- adapter parts expose support catalogue schema metadata
- adapter parts expose writer-safe primitive kinds only:
  cylinder / box / pyramid / sphere
- three deterministic SVG snapshot views are generated:
  top / side / isometric
- Markdown summary and SVG files keep visible proportional-fallback disclaimers
```

## Non-claims

C20 does not claim:

```text
- vendor support dimensional catalogue accuracy
- ASME/rating-size dimensional database backing
- external viewer / Navisworks execution
- WebGL raster screenshot equivalence
```

It also does not change:

```text
- UI runtime/layout behavior
- RVM writer primitive kinds
- valve/flange geometry
- InputXML parsing
```

## Relationship to C17–C19

```text
C17 = audited current GLB support scene state
C18 = stamped support catalogue metadata onto GLB support scene objects
C19 = replaced GLB legacy inline support geometry with support-restraint primitive adapter output
C20 = generates visual-regression artifacts for those adapter-generated support symbols
```
