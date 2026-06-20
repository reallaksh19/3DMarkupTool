# C4 — BM_CII RVM/ATT Catalogue Sample Parity Gate

This gate verifies the production RVM/ATT export path against the repository BM_CII InputXML sample.

## Scope

The gate is intentionally core-only:

- no UI changes
- no GLB visual changes
- no parser behavior changes beyond exercising the existing InputXML parser path
- no ASME/rating-size claim
- no new RVM writer primitive kinds

## Production path under test

```text
samples/BM_CII_Enriched_v8_lite.XML
→ convertInputXmlToRvmAtt()
→ parseMarkupSource()
→ parseInputXml()
→ buildRvmExportModel()
→ applyRvmCatalogueExportParity()
→ normalizeNavisExportModelNames()
→ assertNavisExportModel()
→ writeRvm() / writeAtt()
```

## Required outcomes

The sample export must prove:

1. RVM catalogue parity is enabled in the audit.
2. The sample produces multiple catalogue-rendered valve/flange components.
3. Flanged valve output is segmented into collars, stepped necks, and body primitives.
4. Flange output is segmented into weld-neck steps, flange discs, raised faces, gasket, and bolt primitives.
5. Non-catalogue pipe components keep the existing fallback primitive path.
6. RVM writer receives only supported primitive kinds:

```text
cylinder
box
pyramid
sphere
```

7. Adapter-only primitive hints must not reach the writer model:

```text
frustum
torus
bolt-pattern
valve-body
radial-cylinder
direction-arrow
```

8. ATT exposes catalogue metadata:

```text
CATALOGUE_EXPORT_PRODUCTION_WIRING
CATALOGUE_CLASS
CATALOGUE_TYPE
PROPORTIONAL_FALLBACK
ASME_DIMENSIONAL_DB_BACKED
RVM_CATALOGUE_PARITY
```

## GLB/RVM parity intent

The test also checks that the same BM_CII valve/flange elements resolve through the shared valve/flange primitive adapter seam. This does not change the GLB preview; it guards that the GLB visual catalogue and RVM catalogue translator remain aligned at the catalogue-plan level.

## Current dimensional policy

The catalogue remains a proportional visual fallback. The gate explicitly keeps:

```text
PROPORTIONAL_FALLBACK = TRUE
ASME_DIMENSIONAL_DB_BACKED = FALSE
```

A future dimensional database can replace the proportional factors only through a separate DB-backed contract PR.
