# Navis signed-axis transform RCA fix

## RCA

PR #452 encoded the observed Navis/canvas relationship as a semantic basis only. That was insufficient because existing support rows already contained signed XYZ axes such as `+Y`, `+Z`, and `-X`. The resolver kept those signed axes unchanged, so the live canvas showed no noticeable axis change.

## Observed relationship

From side-by-side Navis/canvas validation:

- Navis `N` was observed on canvas `+Y`
- Navis `Top` was observed on canvas `+Z`
- Navis `W` was observed on canvas `-X`

## Corrective transform

To move Navis North onto canvas North (`-X`) while keeping Top on `+Z`, apply a right-handed signed-axis transform:

```text
source +X -> canvas +Y
source -X -> canvas -Y
source +Y -> canvas -X
source -Y -> canvas +X
source +Z -> canvas +Z
source -Z -> canvas -Z
```

Matrix form:

```text
[x', y', z'] = [-y, x, z]
```

## Source changes

- `support-axis-basis-config.js` now declares the signed-axis transform table.
- `support-axis-transform.js` now applies the transform to:
  - explicit source axis;
  - explicit canvas-axis fields that were already pre-resolved;
  - pipe-axis fallback;
  - family-rule support action axes such as REST/HOLDDOWN;
  - requested support action axes.

## Cache

Pages cache key bumped to `input-persistent-root-card-20260629-l`.
