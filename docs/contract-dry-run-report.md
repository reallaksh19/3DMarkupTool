# Contract Dry-Run Report

`ContractDryRunReport.v1` is the CI-facing summary for the non-visual piping component contract path.

It runs the same dry-run flow documented in `docs/contract-dry-run.md`:

```text
SourceRecord.v1
→ PipingComponent.v1[]
→ PipingGraph.v1
→ GeometryContract.v1[]
→ RenderInstruction.v1[]
→ RenderPlan.v1[]
→ ExportPlan.v1[]
→ ContractDryRunReport.v1
```

The report is intentionally diagnostic. It must not become a visual renderer and must not reintroduce raw InputXML branching downstream of the source adapter.

## Command

```bash
npm run contract:dry-run
```

Equivalent direct command:

```bash
node scripts/contract-dry-run-report.mjs \
  --input fixtures/contract-dry-run/inputxml-delegated-fittings.json
```

Optional output file:

```bash
node scripts/contract-dry-run-report.mjs \
  --input fixtures/contract-dry-run/inputxml-delegated-fittings.json \
  --output artifacts/contract-dry-run-report.json
```

## Report schema

Required top-level fields:

- `schemaVersion: "ContractDryRunReport.v1"`
- `dryRunSchemaVersion: "ContractDryRun.v1"`
- `status: "PASS" | "FAIL"`
- `acceptance`
- `diagnostics`
- `phaseCounts`
- `warnings`
- `samples`

Required acceptance gates:

- `noDroppedRecords`
- `requiredDiagnosticsPresent`
- `unknownPreserved`
- `fallbackExplicit`
- `inputXmlFittingsDelegated`
- `downstreamRawPayloadRejected`
- `glbAndRvmShareStableMetadata`

`status` must be `PASS` only when all acceptance gates are `true`.

## InputXML fitting rule

The canonical fixture intentionally includes InputXML `BEND` and `TEE` records without contract-grade fitting geometry.

The report must show:

- the records are preserved as components;
- the components remain classified as `BEND` / `TEE`;
- they are counted in `diagnostics.inputXmlDelegatedFittings`;
- their geometry contracts are explicit `FALLBACK_LEGACY`;
- their downstream render/export plans carry `LEGACY_FALLBACK_REF` and `fallbackRendered: true`.

This protects the rule that InputXML does not invent elbow or tee topology.
