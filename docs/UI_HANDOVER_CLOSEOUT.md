# UI Handover Closeout

Date: 2026-06-20

This document records the UI-only handover completion state for `reallaksh19/3DMarkupTool` after the focused UI stabilization phases.

## Scope boundary

The completed UI work intentionally avoided these areas:

- GLB/RVM geometry generation
- InputXML parser logic
- RVM/ATT exporter logic
- Navis export contract
- valve/flange catalogue logic
- piping contract layer
- converter pipeline

UI work was limited to:

- `index.html`
- `src/styles.css`
- `src/safe-ui-bootstrap.js`
- static UI controllers
- UI tests
- UI checklist / handover documentation

## Completed UI phases

| Phase | Area | Status |
| --- | --- | --- |
| Input final state | Compact INPUT panel, file-status separation, Conversion/Sideload collapsed by marker | Done |
| Rules Checklist CI | TDZ/cache/gitignore/diagnostics/containment/network/test gates | Done |
| Phase 5 | Shared selection resolver foundation | Done |
| Phase 6 | Section Box lifecycle hardening | Done |
| Phase 7 | Hide / Isolate / Show All lifecycle | Done |
| Phase 8 | Area Select workflow actions and selected CSV export | Done |
| Phase 9 | Explode / Reassemble lifecycle | Done |
| Phase 10 | Measure Polyline marker rewrite | Done |
| Phase 11 | UI integration acceptance gate | Done |

## Final UI acceptance state

The current UI gate coverage includes:

- INPUT panel remains compact after JavaScript finishes.
- Local file status remains `No file chosen` unless a local file is selected.
- BM_CII sample state does not overwrite the local file chooser status.
- Conversion and Sideload are collapsed by explicit markers, not DOM position.
- Dropdown/menu rows preserve icon + text label grammar.
- Ribbon avoids shortcut-only labels such as `MZ`, `AS`, `XP`, and `SR`.
- Review tools use a shared selection resolver where applicable.
- Section Box, Hide, Isolate, Show All, Area Select, Explode/Reassemble, and Measure Polyline each have regression gates.
- No UI phase should reintroduce `MutationObserver` for layout correction, `setInterval` polling, startup scene traversal, or repeated runtime DOM relocation loops.

## Remaining work boundary

The UI handover is closed through Phase 11. Core GLB/RVM work can now continue independently.

Any future UI changes should use small PRs, keep the same CI rule, and merge only after GitHub Actions completes successfully.
