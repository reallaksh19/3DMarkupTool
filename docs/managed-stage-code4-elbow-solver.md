# Managed-stage code-4 elbow solver

This phase moves BEND planning from a midpoint/fallback code-4 primitive to an endpoint-fit geometry solver.

## Scope

The solver is only used by the managed-stage RVM profile path. Code 4 remains opt-in through the managed-stage writer options and remains default-disabled in the normal RVM writer path.

## Input

The solver consumes a `ManagedStageGeometryContract` for a staged `BEND` record:

```text
APOS / LPOS endpoints
BEND_RADIUS
BEND_ANGLE
DIAMETER / tube radius
```

## Output

The solver returns a code-4-ready elbow geometry record:

```text
arc center
explicit right-handed transform basis
plane-normal direction
endpoint-fit bend radius
sweep angle
local bbox
audit fields for declared/effective radius and endpoint-fit error
```

## Endpoint fit rule

The staged JSON sometimes provides a bend chord that is longer than the declared radius and angle can physically span. In that case the solver keeps the declared bend angle and inflates the effective code-4 bend radius enough to span `APOS → LPOS`.

This is intentional for the current managed-stage RVM benchmark path because the primary objective is a continuous RMSS-style RVM centerline, not catalogue-accurate elbow radius extraction.

## Binary layout preserved

The writer still emits the same RMSS/RHBG-observed code-4 body layout:

```text
record version
primitive code 4
12-float transform
6-float local bbox
bendRadius
tubeRadius
sweepAngleRad
```

The only geometry-authoring change is that BEND primitives now carry an explicit basis from the solver instead of relying on a generic axis-derived basis.

## Follow-up visual acceptance

After this phase, the generated `.rvm` should be re-opened in the viewer. If elbows are still visually rotated, the next correction should be plane-normal hinting from adjacent pipe tangents, not a binary writer change.
