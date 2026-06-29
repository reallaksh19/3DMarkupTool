# Phase 3A full-file managed-stage importer hardening

## Purpose

Phase 3A hardens the shadow managed-stage importer so BM_CII-style topology-rich managed-stage JSON can become a topology-complete `PlantModelGraph.v1` before catalogue binding starts.

This phase exists because the minimal Phase 2 importer only proved a small golden fixture. The full BM_CII-style file exposed missing topology nodes and placeholder-generated engineering components.

## Dependency

Depends on:

- Phase 0/1 core contracts;
- Phase 2 managed-stage shadow importer;
- Phase 2A governance and `PlantGraphTopologyAudit.v1`;
- Phase 3 catalogue registry/load-only seed.

## Scope

This phase is importer hardening only.

It does not implement:

- catalogue binding;
- geometry solving;
- primitive compiling;
- RVM export;
- ATT export;
- GLB export;
- runtime switch;
- canvas changes.

## Topology rule

The importer no longer treats only `PIPE`, `TUBE`, `ROUTE`, and `SEGMENT` records as topology contributors.

Any managed-stage record with all of the following contributes graph endpoint topology:

```text
FROM_NODE
TO_NODE
APOS
LPOS
```

This includes inline flange, valve, bend, and rigid-style component records.

## Component intent rule

Engineering components must not become generated placeholder objects.

Blocked placeholder pattern:

```text
flanPlaceholder.v1
valvPlaceholder.v1
bendPlaceholder.v1
```

Replacement intent records:

```text
FLAN / FLANGE -> kind: component, family: flange, resolutionIntent: unresolved
VALV / VALVE  -> kind: component, family: valve,  resolutionIntent: unresolved
BEND / ELBOW  -> kind: component, family: elbow,  resolutionIntent: unresolved
```

These remain unresolved graph intent. They are not catalogue-bound and are not solved geometry.

## Bend evidence rule

Bend records preserve source evidence needed by a future geometry solver:

- from node;
- to node;
- start/end positions;
- diameter and wall;
- bend angle;
- bend radius;
- arc length;
- chord length;
- center estimate;
- center estimate source.

`inputxml-chord-midpoint-not-arc-center` remains audit evidence only. It is not used as a solved arc center in this phase.

## Benchmark gate

The Phase 3A benchmark must prove:

```text
graph validation ok
PlantGraphTopologyAudit.ok === true
missingRouteNodeRefs.length === 0
missingItemNodeRefs.length === 0
missingItemRouteRefs.length === 0
duplicate node/route/item IDs === 0
source components === 40
pipe items === 19
flange component items === 8
valve component items === 6
bend component items === 7
support items === 12
placeholderGeneratedComponentCount === 0
```

Open route ends remain diagnostic topology information. They do not fail the topology audit unless they are caused by missing node or route references.

## Runtime behavior guarantee

No runtime file is changed. The current managed-stage converter, RVM output, ATT output, canvas behavior, support mapping behavior, app loader, safe UI loader, and Pages cache-key chain remain unchanged.

## Next phase handoff

After Phase 3A passes, Phase 4 may implement exact-only catalogue binding audit:

```text
PlantModelGraph.v1
+ PlantGraphTopologyAudit.v1 ok
+ CatalogueRegistry.v1
+ ComponentCatalogueItem.v1
-> CatalogueBindingAudit.v1
```

Phase 4 must still remain shadow-mode and must not solve geometry or call writers.
