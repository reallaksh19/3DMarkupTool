# Stable Baseline After PR #164

## Current stable point

This document records the current stable application baseline after the rollback sequence completed through PR #164.

Stable baseline:

```text
main after PR #163 and PR #164
```

## What was reverted

### PR #163

Reverted the Phase 4A input visibility correction from PR #162.

Reason:

```text
The app could hang after the input visibility reordering change.
```

Result:

```text
The drawer/input runtime was restored to the pre-PR162 behavior.
```

### PR #164

Reverted the menu-label text patch from PR #160.

Reason:

```text
The app was stable after removing the most recent menu-label patch from the active bootstrap path.
```

Result:

```text
The menu-label controller was removed from the active bootstrap load path and converted to a no-op placeholder for stale cached imports.
```

## Stability rule from this point

Do not restart the earlier stacked UI-fix approach.

Future changes should follow these rules:

```text
1. One small phase per PR.
2. No startup polling.
3. No setInterval scene traversal.
4. No full-scene traversal during page load.
5. No repeated DOM relocation loops.
6. No broad UI override controller loaded late to patch many unrelated features.
7. Any UI helper must be event-driven and bounded.
8. Each phase must update the consolidated checklist only for comments actually cleared.
```

## Next safe sequence

Recommended next order:

```text
1. Verify stable startup in Chrome and Edge.
2. Revisit input visibility with a pure static HTML/CSS approach only.
3. Start Phase 5 selection resolver foundation.
4. Reintroduce Section Box before Area Select / Explode / Measure.
5. Avoid adding multiple review-tool runtimes in one PR.
```

## Current status summary

Known stable:

```text
- App startup is responsive.
- BM_CII sample can be loaded.
- Navigation baseline remains usable.
- PR #133 ribbon review integration is restored.
- Phase 1, Phase 1A, Phase 1B, Phase 2, Phase 3, and Phase 4 checklist entries remain as documented unless separately reverted.
```

Known open:

```text
- Phase 4A / C4 input practical visibility remains open after revert.
- Phase 5 selection resolver foundation remains open.
- Section Box, Isolate/Hide/Show, Area Select, Explode/Reassemble, and Measure Polyline recovery remain open.
```

## PR purpose

This PR is documentation-only. It does not change viewer runtime, parser, renderer, export, geometry, or UI behavior.
