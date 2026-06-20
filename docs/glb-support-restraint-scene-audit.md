# C18 — GLB Support / Restraint Catalogue Scene Metadata

## Purpose

C18 hardens the actual Three.js scene path for support/restraint symbols emitted by `convertInputXmlToGlb()`.

The RVM/ATT support-restraint path was catalogue-wired by C15/C16. C17 proved that the GLB preview path still created legacy inline support symbols. C18 keeps that GLB symbol geometry unchanged but stamps catalogue metadata onto the actual scene objects.

## Current result

```text
RVM/ATT support catalogue parity = PRODUCTION_WIRED
GLB support catalogue scene parity = CATALOGUE_METADATA_STAMPED
```

This is still a proportional fallback visual layer. It is not a vendor support catalogue or ASME/rating-size dimensional database.

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
- SUPPORT_CATALOGUE_* / supportCatalogue* scene metadata is stamped on every symbol
- stamped family / recipe / schema matches the support-restraint visual catalogue resolver
- proportional fallback / non-vendor-dimensional status remains explicit
```

## C18 metadata fields

Every actual GLB support/restraint scene object must expose catalogue metadata equivalent to the RVM/ATT support path:

```text
SUPPORT_CATALOGUE_VISUAL
SUPPORT_CATALOGUE_FAMILY
SUPPORT_CATALOGUE_RECIPE_ID
SUPPORT_CATALOGUE_SCHEMA
SUPPORT_CATALOGUE_PROPORTIONAL_FALLBACK
SUPPORT_CATALOGUE_VENDOR_DIMENSIONAL_DB_BACKED
SUPPORT_CATALOGUE_EXPORT_PRODUCTION_WIRING
```

Camel-case mirrors are also stamped for JavaScript/UI consumers:

```text
supportCatalogueVisual
supportCatalogueFamily
supportCatalogueRecipeId
supportCatalogueSchema
supportCatalogueProportionalFallback
supportCatalogueVendorDimensionalDbBacked
supportCatalogueExportProductionWiring
supportCatalogueSceneParity
```

## Deliberate boundary

C18 is a metadata hardening phase only:

```text
- GLB support symbol geometry remains legacy inline geometry
- support/restraint primitive adapter is not yet used for GLB symbol mesh construction
- RVM writer is unaffected
- UI behavior is unaffected
```

The scene parity value is therefore:

```text
CATALOGUE_METADATA_STAMPED
```

not a vendor-dimensional support geometry claim.

## Non-claims

C18 does not claim:

```text
- vendor support catalogue dimensional accuracy
- ASME/rating-size dimensional backing
- external Navisworks/Review execution
- RVM writer changes
- UI behavior changes
- GLB support geometry replacement
```

## Follow-up

C19 can replace the remaining GLB legacy inline support symbol geometry with the `support-restraint-primitive-adapter.js` output, after this metadata contract is stable.
