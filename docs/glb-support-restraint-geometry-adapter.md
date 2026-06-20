# GLB Support / Restraint Geometry Adapter Wiring

## Scope

C19 replaces the previous GLB support/restraint scene geometry with support-restraint primitive adapter output while keeping the existing converter boundary and support metadata contract intact.

This is still a proportional fallback catalogue. It is not a vendor support dimensional database and it is not ASME/rating-size backed.

## Production path

```text
convertInputXmlToGlb()
→ createSupportSymbols()
→ SUPPORT_RESTRAINT scene object userData assignment
→ support-restraint-primitive-adapter.js
→ actual Three.js primitive meshes
```

The adapter emits only these primitive kinds for GLB support symbols:

```text
cylinder
pyramid
box
sphere
```

Those match the writer-safe primitive families already used on the RVM/ATT side.

## Metadata

Top-level support/restraint scene objects keep the C18 metadata fields:

```text
SUPPORT_CATALOGUE_VISUAL
SUPPORT_CATALOGUE_FAMILY
SUPPORT_CATALOGUE_RECIPE_ID
SUPPORT_CATALOGUE_SCHEMA
SUPPORT_CATALOGUE_PROPORTIONAL_FALLBACK
SUPPORT_CATALOGUE_VENDOR_DIMENSIONAL_DB_BACKED
SUPPORT_CATALOGUE_EXPORT_PRODUCTION_WIRING
```

C19 additionally marks the actual GLB geometry path as:

```text
supportCatalogueSceneParity = CATALOGUE_GEOMETRY_ADAPTER
supportCatalogueSceneGeometryAdapter = true
supportCatalogueSceneMetadataOnly = false
```

Child primitive meshes are stamped with:

```text
TYPE = SUPPORT_RESTRAINT_PART
supportCataloguePrimitiveAdapter = true
primitiveKind = cylinder | pyramid | box | sphere
supportCatalogueSceneParity = CATALOGUE_GEOMETRY_ADAPTER
```

## Non-claims

C19 does not claim:

- vendor-specific support dimensions
- ASME dimensional database backing
- RVM writer primitive-kind changes
- valve/flange catalogue changes
- UI behavior changes

## CI gate

`tests/glb-support-restraint-geometry-adapter.test.mjs` converts the real BM_CII sample through `convertInputXmlToGlb()` and checks that each actual support/restraint scene object contains adapter-generated primitive meshes with finite bounds and writer-safe primitive kinds.
