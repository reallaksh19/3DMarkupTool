# C17 — GLB Support / Restraint Scene Visual Audit

## Purpose

C17 audits the actual Three.js scene path for support/restraint symbols emitted by `convertInputXmlToGlb()`.

This is intentionally an audit/gate phase, not a production rewrite. The RVM/ATT support-restraint path was catalogue-wired by C15/C16, but the GLB preview path still creates legacy inline support symbols in `src/converter.js`.

## Current result

```text
RVM/ATT support catalogue parity = PRODUCTION_WIRED
GLB support catalogue scene parity = LEGACY_INLINE_SYMBOLS
```

C17 makes that boundary explicit and visible in CI artifacts.

## Generated artifact

The workflow uploads:

```text
glb-support-restraint-scene-audit
```

containing:

```text
BM_CII_glb_support_restraint_scene.audit.json
BM_CII_glb_support_restraint_scene.summary.md
```

## What the audit checks

The audit regenerates the real BM_CII GLB scene through:

```text
samples/BM_CII_Enriched_v8_lite.XML
→ convertInputXmlToGlb()
→ Three.js Scene
→ supports.restraints group
→ SUPPORT_RESTRAINT scene objects
```

It verifies:

```text
- the supports.restraints scene group exists
- actual GLB support/restraint scene objects are present
- each symbol has finite world bounds
- each symbol has at least one mesh descendant
- family, node, sourceClass, sourceMode, and mappingContract metadata remain visible
- expected catalogue family / recipe / schema can be resolved for every symbol
- proportional fallback / non-vendor-dimensional status remains explicit
```

## Deliberate warning

C17 intentionally reports missing GLB scene catalogue metadata as a warning, not a blocker:

```text
SUPPORT_CATALOGUE_* scene userData is not yet stamped in the GLB support symbol path.
```

That is the next phase.

## Non-claims

C17 does not claim:

```text
- vendor support catalogue dimensional accuracy
- ASME/rating-size dimensional backing
- external Navisworks/Review execution
- RVM writer changes
- UI behavior changes
```

## Follow-up

C18 should wire/stamp the support-restraint catalogue into the GLB scene path so support/restraint scene objects expose catalogue userData equivalent to the RVM/ATT metadata proven by C16.
