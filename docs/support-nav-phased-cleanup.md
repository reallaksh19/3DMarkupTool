# Support / navigation phased cleanup

## Phase 1 — Support workbench fallback rows

- Adds a fallback row to Support Mapping / ISONOTE tables.
- Applies to both InputXML basis and ISONOTE basis tabs.
- The row exposes axis-only/directional fallback cases such as `Y`, `+Z`, `-Z`, `+X`, and `-X` instead of silently hiding the fallback rule.

## Phase 2 — Orbit button placement

- The added canvas Orbit button now inserts directly after an existing zoom button when one is present.
- If no zoom button exists in the detected canvas rail, the fallback rail starts lower to avoid overlap.

## Phase 3 — Selection and zoom coexistence

- Click-to-zoom guard now skips Marquee Zoom and explicit zoom tools.
- Explicit Orbit/Pan buttons restore navigation controls.
- Marquee Zoom is bundled with the app path so it is not advanced-mode-only for the bundled deployment.

## Phase 4 — Shortcut and stale UI cleanup

- Removes Ctrl+C shortcut behavior in the viewer shell.
- Suppresses Ctrl-click selection shortcut before the old selection-first controller can use it.
- Updates help/tooltip text to direct users to visible buttons.
- Hides the obsolete Support Mapping side-panel summary and old launch/debug buttons; the popup is now the working surface.

## Cache

- Pages bundle cache key bumped to `input-persistent-root-card-20260629-i`.
