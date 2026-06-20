# RVM catalogue artifact inspection

This note records the C7 inspection of the generated `rvm-catalogue-sample` CI artifact from the C6 workflow run.

The artifact was generated from:

```text
samples/BM_CII_Enriched_v8_lite.XML
```

It is intentionally a proportional catalogue parity artifact. It is not an ASME/rating-size dimensional database artifact.

## Artifact files

```text
BM_CII_catalogue_sample.rvm
BM_CII_catalogue_sample.att
BM_CII_catalogue_sample.audit.json
BM_CII_catalogue_sample.summary.md
```

## Inspected C6 artifact metrics

The downloaded C6 artifact contained the following high-level values:

| Metric | Value |
|---|---:|
| RVM bytes | 48,316 |
| ATT bytes | 55,893 |
| Catalogue components | 14 |
| Catalogue primitives | 296 |
| Valve catalogue nodes | 6 |
| Flange catalogue nodes | 8 |
| Total nodes | 44 |
| Total primitives | 393 |
| RVM chunk count | 484 |
| PRIM chunks | 393 |
| CNTB chunks | 44 |
| CNTE chunks | 44 |
| END body length | 4 |

## Binary compatibility checks

The generated RVM passed the binary audit with:

```text
HEAD -> MODL -> CNTB/PRIM/CNTE -> END:
```

Required binary conditions:

```text
first chunk = HEAD
second chunk = MODL
terminal chunk = END:
all chunk header markers = 1
END: carries a 4-byte marker body
CNTB/CNTE are balanced
chunks are contiguous through END:
PRIM chunk count equals export primitive count
```

## Writer-safe primitive check

The inspected artifact used only:

```text
cylinder
sphere
```

The RVM writer is still restricted to:

```text
cylinder
box
pyramid
sphere
```

Adapter-only hints such as `frustum`, `torus`, `bolt-pattern`, `valve-body`, `direction-arrow`, and `radial-cylinder` must never be passed directly into the binary writer. They must be translated first.

## ATT metadata check

The inspected ATT exposed all catalogue parity fields:

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

## C7 CI gate

`tests/rvm-catalogue-artifact-inspection.test.mjs` regenerates the BM_CII artifact through the production artifact generator and checks:

- output file set is complete;
- audit schema remains `RvmCatalogueSampleArtifact.v2`;
- RVM/ATT outputs are non-empty;
- catalogue valve/flange counts remain present;
- binary audit is successful;
- PRIM/CNTB/CNTE counts match the export audit;
- only RVM-writer-safe primitive kinds are present;
- ATT metadata flags are present;
- catalogue node details include class, type, recipe, primitive count, primitive names, and writer-safe primitive kinds;
- markdown summary keeps human-visible catalogue, binary, writer-kind, metadata, and scope sections.

## Scope

This inspection validates structural export parity and binary chunk compatibility for the generated BM_CII sample. It does not validate exact Navisworks visual appearance and does not claim ASME dimensional accuracy.
