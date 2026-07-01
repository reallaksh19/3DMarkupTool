# Phase E1 — ElementRvmLedger.v1

## Purpose

Phase E1 adds `ElementRvmLedger.v1` as a downstream trace/readiness ledger for future element-by-element RVM generation.

`PlantModelGraph.v1` remains the engineering source-of-truth. Managed/staged JSON child identity is preserved as source-import evidence and traceability, not as the master model.

The allowed Phase E1 evidence chain is:

```text
Managed/Staged JSON child
→ PlantModelGraph.v1 import trace
→ NewCoreReadinessAudit.v1
→ ElementRvmLedger.v1 trace/readiness row
→ future RvmElementUnit.v1 candidate
→ future stitch manifest
```

This intentionally avoids treating primitive/output rows, aggregate byte proof results, staged JSON child records, or ledger rows as replacement source-of-truth models.

## Why this remains graph-first

Aggregate byte proof is useful readiness evidence, but it is not the long-term production architecture by itself. The correct long-term architecture remains graph-first: `PlantModelGraph.v1` owns engineering intent; downstream audit, primitive, export, byte-proof, and ledger records only prove readiness and traceability.

`ElementRvmLedger.v1` records one downstream trace/readiness row per preserved staged JSON child so later RVM element-unit work can prove that no imported source evidence was dropped. It does not bypass graph import, readiness audit, primitive resolution, writer adapters, or production runtime policy.

## What the ledger preserves

`ElementRvmLedger.v1` records every staged JSON branch child with:

- source element ID and name;
- source element type and normalized family;
- branch and line context;
- deterministic source sequence index;
- source node evidence;
- available catalogue reference;
- available primitive status;
- future RVM element-unit status;
- byte/stitch status, both `notStarted` in Phase E1;
- block or defer reason;
- source trace where `sourceEvidence` is `staged-json-child` and `sourceOfTruth` is `PlantModelGraph.v1`.

## BM_CII inventory

For the BM_CII-style staged fixture, the expected source inventory is:

```text
1 BRANCH
52 staged JSON source children
40 physical components
12 supports/restraints
19 PIPE
7 BEND
8 FLAN
6 VALV
12 ATTA
```

The branch is counted as source context through `branchCount` and `typeCounts.BRANCH`, but it is not inserted as a 53rd ledger entry. The 52 ledger entries are downstream trace/readiness rows for the 52 branch children that will later become element units or explicit blocked/deferred records.

## Status rules

- PIPE entries can become candidate element units when existing primitive status is available.
- BEND entries can become candidate element units when existing TORUS primitive status is available.
- FLAN entries can become candidate element units when existing `FLANGE_CYLINDER` primitive status is available.
- VALV entries are blocked in Phase E1 because valve solving is not implemented.
- ATTA/support entries are deferred in Phase E1 because support unit/compiler decisions are not implemented.

No dummy cylinders, boxes, spheres, pyramids, or placeholder geometry are introduced.

## What Phase E1 does not do

Phase E1 does not implement:

- RVM byte writing;
- RVM stitching;
- RVM downloads;
- browser object URLs;
- canvas preview;
- Three.js geometry;
- ATT export;
- GLB export;
- valve solving;
- support solving;
- production writer integration;
- full-model readiness;
- production runtime switch.

Every ledger entry keeps `rvmByteStatus: "notStarted"` and `stitchStatus: "notStarted"`. `generationReadiness.fullRvmReady` is always false.

## Handoff

Phase E1 prepares Phase E2:

```text
ElementRvmLedger.v1 trace/readiness row
→ RvmElementUnit.v1 candidate
```

Phase E2 should create one future element unit per candidate ledger entry while preserving blocked/deferred entries for valves and supports. Later phases can introduce a stitch manifest and stitched RVM artifact only after element units are proven individually and production policy explicitly approves the next boundary.
