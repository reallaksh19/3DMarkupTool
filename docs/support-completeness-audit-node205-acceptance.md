# Support completeness acceptance

Expected audit outcomes for BM_CII after this PR:

- `supportCompletenessAudit.schema = ManagedStageSupportCompletenessAudit.v1`
- `supportCompletenessPass = true` when all support rows render or topology suppression is absent
- `node205SupportSourceCount` equals source support rows at node 205
- `node205RenderedSupportCount` equals rendered support rows at node 205
- `node205MissingRows` is empty
- `node205YSupportRendered = true` when a Y/+Y support exists at node 205
- `node205SpringRendered = true` when a SPRING/SPRING_CAN support exists at node 205

Exact-axis supports that previously had zero primitives are repaired with one code-8 directional glyph and stamped with `supportExactAxisZeroPrimitiveRepair=true`.
