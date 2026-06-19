# Contract Dry Run

`src/contract-dry-run.js` is an audit-only orchestrator for the normalized piping pipeline. It does not render meshes and does not replace the legacy renderer.

The dry-run flow is:

```text
Source Adapter
→ PipingComponent.v1[]
→ PipingGraph.v1
→ GeometryContract.v1[]
→ RenderInstruction.v1[]
→ RenderPlan.v1[]
→ ExportPlan.v1[]
```

## Policy

The dry run must prove that downstream consumers use contracts, not raw source records.

Rules:

1. Source records may carry raw source fields upstream.
2. `RenderPlan.v1` and `ExportPlan.v1` must reject raw source fields such as `rawKind`, `rawTypeCode`, `record`, `props`, or `sourceXmlElement`.
3. InputXML `BEND`, `ELBOW`, and `TEE` must remain classification-only and produce explicit `FALLBACK_LEGACY` contracts unless a richer non-InputXML source provides verified topology and dimensions.
4. GLB and RVM+ATT export plans must consume the same stable metadata from `RenderPlan.v1`.
5. Fallback must be counted and carried as `LEGACY_FALLBACK_REF`, not generated geometry.

## Required diagnostics

The dry-run diagnostics must include:

```text
sourceRecordsTotal
componentsTotal
componentsByClass
geometryContractsTotal
renderInstructionsTotal
renderPlansTotal
exportPlansTotal
fallbackRendered
fallbackRenderPlans
unknownComponents
unrenderableComponents
inputXmlDelegatedFittings
renderPlansByTarget
exportPlansByTarget
```

## Test gate

`tests/contract-dry-run.test.mjs` verifies:

- no dropped source records
- acceptance diagnostics are present
- InputXML bend/tee fallback is explicit
- no `ELBOW_SWEEP_PRIMITIVE` or `TEE_COMPOSITE_PRIMITIVE` is produced for InputXML fittings
- pipe/support/unknown still produce contract-visible plans
- GLB and RVM+ATT share stable metadata
- raw source payload is rejected at the downstream plan boundary
