# Support completeness audit and node 205 gate

This change adds `ManagedStageSupportCompletenessAudit.v1` to the topology-gated support RVM export path.

## Purpose

The audit proves whether every staged support source row becomes a rendered support marker primitive set, or is suppressed with a specific reason.

## Key fields

- `supportCompletenessAudit`
- `supportCompletenessRows`
- `supportCompletenessPass`
- `node205SupportSourceCount`
- `node205RenderedSupportCount`
- `node205MissingRows`
- `node205YSupportRendered`
- `node205SpringRendered`

## Exact-axis repair

Exact-axis families such as `Y`, `+Y`, `Z`, `+Z`, `X`, and signed variants are valid support families. If topology allows the support but the base support visual resolver produced zero primitives, the export path now emits one compact Review-safe code-8 directional glyph and stamps `supportExactAxisZeroPrimitiveRepair=true`.

## Scope

This is limited to support export completeness and node 205 proofing. It does not change code-4 bend planning, pipe geometry, XML enrichment, ATT format, or parser behavior.
