# Default ISONOTE sample and Navis-to-canvas axis config

## Priority 1 — ISONOTE sample and display identity

The Support Mapping / ISONOTE popup now defaults the ISONOTE text area to:

```csv
NODE,ISONOTE
35,:/PS-123 :ISONOTE 'REST(28kN), GUIDE(6kN),LINE STOP(15kN)'
130,:ISONOTE 'REST NOT DEFINED, SINGLE AXIS Z'
255,:ISONOTE 'REST(3kN), GUIDE(1kN)'
205,:/PS-456 :ISONOTE 'REST(10kN), HOLDDOWN,LINE STOP(6kN), Holddown without Guide Can Spring'
```

The ISONOTE parser now preserves both:

- per-restraint segment text, for example `REST(28kN)`;
- full row display text, for example `/PS-123 :ISONOTE 'REST(28kN), GUIDE(6kN),LINE STOP(15kN)'`.

When ISONOTE Basis emits support markers, the full row display text is used as the marker display identity while the staged canonical ID is preserved in metadata.

## Priority 2 — Navis-to-canvas support axis basis

Observed mapping:

- Navis `N` -> Canvas `+Y`
- Navis `Top` -> Canvas `+Z`
- Navis `W` -> Canvas `-X`

Added `support-axis-basis-config.js` and updated `support-axis-transform.js` to use the new basis.

Semantic tokens such as `N`, `NORTH`, `TOP`, `UP`, `W`, and `WEST` now resolve into the configured canvas axes.

## Cache

Pages cache key is bumped to `input-persistent-root-card-20260629-k`.
