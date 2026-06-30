# Phase 11A catalogue-backed bend / elbow TORUS primitive compiler

## Purpose

Phase 11A unlocks shadow-only logical TORUS primitive compilation for bends and elbows.

The pipeline is:

```text
PlantModelGraph bend/elbow item
+ exact catalogue-backed bend identity
+ verified bend arc geometry evidence
-> BendArcFrame.v1 in ResolvedGeometryModel.v1
-> TORUS / RVM primitive code 4 in ResolvedPrimitiveModel.v1
-> downstream export/writer/artifact/diagnostic layers classify it as resolved-but-not-writer-proven
```

## Why it follows Phase 10

Phase 10 can display proven diagnostic and artifact state without making runtime canvas state the export source of truth. Phase 11A adds a new shadow primitive class but keeps it non-writer-proven, so diagnostics and controlled preview can report the new state safely.

## Exact catalogue-backed rule

A bend/elbow may resolve only when exact bend identity matches a catalogue item. The exact identity includes:

- family `elbow`;
- type `bend`;
- outside diameter;
- wall thickness;
- bend angle;
- bend radius.

Partial, ambiguous, or missing evidence remains unresolved. Flanges and valves are not affected by bend matching. Supports remain support-intent/deferred.

## Bend arc geometry evidence rule

A `bendArcFrame.v1` requires deterministic authoring-basis arc evidence:

- start point;
- end point;
- arc center;
- plane normal;
- start tangent;
- end tangent;
- bend/sweep angle;
- major radius;
- tube radius;
- catalogue identity/source.

The frame records evidence for the center, normal, and tangents.

## Why chord midpoint is forbidden

The chord midpoint is not the bend arc center. Phase 11A rejects chord midpoint as TORUS center and audits this with `chordMidpointTorusCenterCount === 0`.

## TORUS/code-4 primitive descriptor

The primitive compiler emits authoring-basis descriptors only from `bendArcFrame.v1`:

```text
primitiveKind: TORUS
primitiveCode: 4
resolver: bendArcTorusPrimitive.v1
basis: authoring
```

It preserves center, normal, tangents, radii, angle, catalogue identity, source reference, and evidence.

## Shadow-only boundary

Phase 11A does not implement RVM code-4 byte writing. TORUS/code-4 is deferred at the RVM export/writer/artifact boundary with reason:

```text
TORUS/code4 RVM byte writer bridge not implemented in Phase 11A
```

The RVM byte proof remains limited to the straight-pipe CYLINDER/code-8 subset.

## BM_CII expected state

After Phase 11A:

```text
CYLINDER/code-8 primitives: 19
TORUS/code-4 primitives: 7
blocked flanges: 8
blocked valves: 6
blocked bends: 0
deferred supports: 12
RVM byte proof writes: 19 cylinders only
TORUS byte writing: deferred
full RVM model: not ready
ATT/GLB: blocked
```

## Diagnostics and controlled preview

Diagnostics and controlled preview must report:

```text
Bends resolved as TORUS primitive: 7
Bend TORUS writer/artifact: DEFERRED
RVM full model: NOT READY
```

They must not show TORUS geometry, canvas overlays, Three.js/WebGL objects, downloads, object URLs, raw bytes, ATT text, or GLB bytes.

## Handoff

Phase 11A prepares:

- Phase 11B RVM TORUS/code-4 test-only byte writer bridge;
- Phase 11C catalogue-backed flange primitive compiler;
- Phase 11D catalogue-backed valve primitive compiler;
- future controlled geometry/canvas overlay only after writer/artifact proof.
