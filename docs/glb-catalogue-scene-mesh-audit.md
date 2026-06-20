# C10 — GLB Catalogue Scene Mesh Audit

## Purpose

C9 audits the valve/flange catalogue primitive plan before Three.js mesh creation. C10 audits the actual scene objects emitted by the production GLB conversion boundary.

The gate uses the real BM_CII sample and calls:

```text
samples/BM_CII_Enriched_v8_lite.XML
→ convertInputXmlToGlb()
→ src/converter.js catalogue mesh creation
→ Three.js Scene traversal
→ BM_CII_glb_catalogue_scene_mesh.audit.json
→ BM_CII_glb_catalogue_scene_mesh.summary.md
```

## What is verified

The generated audit verifies:

```text
- catalogue visual groups exist in the actual Three.js scene
- group userData carries visualCatalogSchema, visualRecipeId, visualKey, componentClass, componentType
- child role objects are stamped with meshRole and catalogue userData
- actual mesh descendants exist below catalogue groups
- centerline-replacing role spans remain continuous after mesh construction
- flanged valves include end collars, tapered necks, and compact valve body roles
- valve collars are emitted as cylinders and stay smaller than the body
- valve necks are emitted as frustums and keep taper metadata
- flanges include plate/disc, raised face, and weld-neck/taper roles
- flange plates/raised faces are emitted as cylinders
- weld necks are emitted as frustums
```

## Scope boundaries

This gate intentionally does not change:

```text
- UI runtime/layout
- RVM writer behavior
- RVM binary chunk format
- ASME/rating-size dimensional rules
```

The catalogue is still a proportional fallback:

```text
PROPORTIONAL_FALLBACK = TRUE
ASME_DIMENSIONAL_DB_BACKED = FALSE
```

## Artifact

CI uploads a `glb-catalogue-scene-mesh-audit` artifact containing:

```text
BM_CII_glb_catalogue_scene_mesh.audit.json
BM_CII_glb_catalogue_scene_mesh.summary.md
```

The JSON is machine-readable. The Markdown summary is for quick review in the GitHub Actions artifact.

## Follow-up

C10 is a scene-mesh contract audit. It does not create screenshots. A later visual regression phase can add rendered image snapshots or camera-view diagnostics if needed.
