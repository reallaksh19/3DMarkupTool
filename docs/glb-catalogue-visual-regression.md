# GLB catalogue visual regression artifact

## Scope

C11 adds a deterministic, CI-safe visual regression artifact for the BM_CII valve/flange catalogue scene path.

The artifact is generated from the actual `convertInputXmlToGlb()` Three.js scene after catalogue valve/flange meshes are built. It does not use the RVM writer, does not modify runtime UI, and does not introduce ASME/rating-size dimensional claims.

## Generated artifact

Workflow artifact name:

```text
glb-catalogue-visual-regression
```

Files:

```text
BM_CII_glb_catalogue_visual_regression.audit.json
BM_CII_glb_catalogue_visual_regression.summary.md
BM_CII_glb_catalogue_visual_regression.top.svg
BM_CII_glb_catalogue_visual_regression.side.svg
BM_CII_glb_catalogue_visual_regression.isometric.svg
```

## What the SVGs show

The SVGs are screenshot-style component cards derived from actual scene userData and rendered local-axis spans.

They are intended to make these visual problems easy to spot in CI artifacts:

```text
- detached or over-dominant valve end collars
- oversized flange plates
- missing tapered valve shoulders / weld necks
- missing compact valve body
- discontinuous axial spans
- missing valve/flange role metadata
```

The SVGs are not WebGL raster screenshots. They are deterministic visual cards so CI can generate and upload them without a browser or GPU.

## CI gate

`tests/glb-catalogue-visual-regression-artifact.test.mjs` verifies:

```text
- package script exists
- CI workflow generates and uploads the artifact
- all five artifact files are produced
- schema is GlbCatalogueVisualRegressionArtifact.v1
- output is derived from convertInputXmlToGlb()
- top / side / isometric SVG files are generated
- valve and flange cards are present
- flanged valve cards include collar, neck, and body roles
- flange cards include plate/disc, raised-face/gasket, and weld-neck roles
- all catalogue spans remain continuous
- proportional fallback and non-ASME scope disclaimers remain visible
```

## Explicit non-goals

```text
- no UI layout work
- no RVM writer change
- no new RVM primitive kinds
- no GLB geometry algorithm change
- no ASME/rating-size dimensional database claim
- no byte-for-byte visual comparison
```

The artifact is a human-review aid and a regression visibility gate, not a dimensional acceptance certificate.
