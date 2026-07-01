# Phase E1 — ElementRvmLedger.v1

## Purpose

Phase E1 realigns the migration around element-by-element RVM generation.

The source element is now the master unit:

```text
Managed/Staged JSON child
→ ElementRvmLedger entry
→ future RVM element unit
→ future stitch manifest
→ future stitched Review-style RVM
```

This intentionally avoids treating primitive/output rows or aggregate byte proof results as the master model.

## Why the roadmap resets

Aggregate byte proof is useful evidence, but it is not the correct long-term architecture for Review-style RVM generation. The correct unit of ownership is the original staged JSON child, because each RVM element unit must remain traceable back to one source element even when geometry, byte writing, or stitching is not available yet.

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
- source trace back to the staged JSON child.

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

The branch is counted as source context through `branchCount` and `typeCounts.BRANCH`, but it is not inserted as a 53rd ledger entry. The 52 ledger entries are the 52 branch children that will later become element units or explicit blocked/deferred records.

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
- full-model readiness.

Every ledger entry keeps `rvmByteStatus: "notStarted"` and `stitchStatus: "notStarted"`. `generationReadiness.fullRvmReady` is always false.

## Handoff

Phase E1 prepares Phase E2:

```text
ElementRvmLedger.v1
→ RvmElementUnit.v1
```

Phase E2 should create one future element unit per candidate ledger entry while preserving blocked/deferred entries for valves and supports. Later phases can introduce a stitch manifest and stitched RVM artifact only after element units are proven individually.
