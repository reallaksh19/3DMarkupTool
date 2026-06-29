# ISONOTE workbench symbology label correction

Fixes Support Mapping / ISONOTE table display labels without changing generated support geometry.

## Corrected cases

- Axis-only unmatched ISONOTE rows such as `SINGLE AXIS Z` now display:
  - `directional-cones (read "Z" from parsed data)`
- Matched support-family rows such as `GUIDE(1kN)` now display the semantic family:
  - `GUIDE`

## Reason

The workbench table previously used the rendered glyph label when a row matched a generated marker, and otherwise fell back to the normalized family. That made:

- unmatched axis-only UNKNOWN rows display `UNKNOWN` even though parsed axis data was available;
- matched GUIDE rows display `directional-cones` instead of `GUIDE`.

The added normalizer adjusts only the table label after workbench render. It does not alter support matching, geometry generation, RVM export, ATT output, or mapper rules.

## Cache

Pages cache key bumped to `input-persistent-root-card-20260629-j`.
