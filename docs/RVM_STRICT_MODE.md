# RVM Export Profile / Strict Mode Foundation

## Current status

The current RVM writer remains the existing experimental exporter. Phase 28 does **not** change the binary writer, primitive mapping, geometry construction, support mapping, or ATT export mapping.

The purpose of this phase is to stop treating every `.rvm` download as automatically Navisworks-ready. The app now exposes an explicit export profile:

- **Experimental current** — existing RVM-like binary output. This remains the default.
- **Navis strict candidate** — a workflow gate that warns before download and directs the user to RVM QA. This is not yet a new certified binary dialect.

## Why this is needed

The current writer emits wide 32-bit big-endian token IDs and an absolute next-offset field. Example:

```text
00 00 00 48 00 00 00 45 00 00 00 41 00 00 00 44 = HEAD
```

This is valid only if the target reader expects that exact RVM dialect. Navisworks may reject or partially load the file if it expects different framing semantics, container offsets, primitive records, or material records.

## Strict candidate behavior

When **Navis strict candidate** is selected:

1. The app keeps the current generated RVM unchanged.
2. Clicking RVM download opens a strict preflight panel first.
3. The user is prompted to run **RVM QA**.
4. The user may still download the current file after explicit confirmation.

## Required before declaring Navis-ready

A future strict writer should only be called Navisworks-ready after fixture validation proves:

- Correct token encoding expected by Navisworks.
- Correct meaning of the chunk numeric field at byte 16.
- Correct `CNTB` / `CNTE` nesting and offsets.
- Correct `PRIM` primitive codes and parameter ordering.
- Valid material/color records if Navisworks requires them.
- Matching `.att` base name and hierarchy names.
- Successful import in Navisworks Simulate/Manage with known-good fixtures.

## Do not change by accident

Protected areas for this phase:

- InputXML parser/intake.
- Core geometry construction/propagation.
- Support mapping/classification.
- Support rendering/orientation.
- RVM writer binary dialect.
- ATT export mapping.

The strict profile is a workflow/preflight control until a known-good Navis RVM fixture is available.
