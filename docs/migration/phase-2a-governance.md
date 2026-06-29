# Phase 2A governance: PlantGraph topology and migration boundaries

## Why this phase exists

Phase 2A exists to stop the migration from moving into catalogue binding, geometry solving, primitive compiling, or export decisions before the `PlantModelGraph.v1` boundary is governed.

The reviewer concern was that a catalogue-registry seed can be technically clean but still out of sequence if the graph boundary, coordinate basis policy, core dependency rules, fallback policy, and topology audit are not formalized first.

This phase adds governance and shadow validation only:

```text
PlantModelGraph.v1
  -> boundary validation
  -> PlantGraphTopologyAudit.v1
  -> governance audit
```

## Reviewer concerns addressed

This phase addresses the following concerns:

- `PlantModelGraph.v1` must not contain solved geometry or export semantics.
- Authoring coordinates must remain unchanged until the export compiler boundary.
- Core migration modules must not depend on current runtime controllers or browser globals.
- Fallback behavior must be explicit and cannot silently become production export behavior.
- Topology defects must be reported deterministically before catalogue or geometry agents consume the graph.

## What future agents must obey

Future agents must preserve these boundaries:

- Import adapters may create graph intent and source traceability only.
- Catalogue binder must read graph intent and catalogue records without solving geometry.
- Geometry solver must solve in authoring coordinates only.
- Primitive compiler must not mutate source graph intent.
- RVM export transform may happen only at `RvmExportModelCompiler` boundary.
- Runtime adapters must be one-way bridges into core functions; core functions must not import runtime modules.

## Catalogue binder rule

The catalogue binder must be exact-only for now.

Nearest-match catalogue binding is explicitly blocked for now. A graph item whose catalogue key does not exactly match an available catalogue record must remain unresolved or blocked by policy. It must not silently bind to a nearby NPS, schedule, family, rating, or generic component.

## Fallback policy rule

Fallback cannot silently become production RVM.

Unknown engineering items default to:

```json
{
  "fallbackKind": "blocked",
  "requiresUserApproval": true
}
```

Fallback records must include:

- fallback kind;
- reason;
- confidence;
- user-approval requirement.

A visual-only fallback may support diagnostics or preview work, but it must not become export output unless a later governed phase explicitly permits that behavior and tests it.

## Topology audit rule

`PlantGraphTopologyAudit.v1` reports graph topology defects and does not repair them.

The audit is deterministic and reports:

- missing route node references;
- missing item node references;
- missing item route references;
- duplicate node IDs;
- duplicate route IDs;
- duplicate item IDs;
- open route ends;
- branch nodes;
- support nodes.

Open route ends and branch/support nodes are reported for downstream awareness. Missing references and duplicate identities make the audit fail.

## Runtime behavior guarantee

No runtime path is changed in Phase 2A. The current converter, canvas, RVM output, ATT output, support mapping behavior, Pages cache keys, and existing importer output remain unchanged.

Phase 2A only adds documentation, governance contracts, a topology audit module, golden audit fixtures, and tests.
