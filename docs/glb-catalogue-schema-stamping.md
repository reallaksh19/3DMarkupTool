# GLB catalogue schema stamping gate

C10B hardens the GLB valve/flange catalogue metadata path.

## Scope

The proportional valve/flange visual catalogue remains a fallback visual catalogue. This gate does not introduce ASME/rating-size dimensional data and does not change RVM writer output.

## Production requirement

Every resolved valve/flange visual spec must carry both schema levels:

- `schemaVersion`: the linear component visual-spec contract schema.
- `catalogSchemaVersion`: the owning valve/flange visual-catalogue schema.

The GLB converter stamps `catalogSchemaVersion` into real Three.js scene `userData` as `visualCatalogSchema` on:

- the catalogue visual group, and
- every catalogue child role object.

## CI gate

`tests/glb-catalogue-schema-stamping.test.mjs` regenerates the BM_CII GLB catalogue scene-mesh audit and fails if any catalogue group or role object lacks:

```text
visualCatalogSchema = valve-flange-visual-catalog/v1
```

Missing schema metadata is no longer accepted as a soft audit warning.

## Non-goals

- No GLB geometry change.
- No RVM binary/writer change.
- No UI/runtime layout change.
- No ASME dimensional database claim.
