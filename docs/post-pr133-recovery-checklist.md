# Post-PR133 Recovery Checklist

Baseline: `main` restored to PR #133 behavior by PR #144. New work must be added in small phases only.

Legend:

```text
⬜ Open / not started
🟡 In progress
✅ Cleared in merged PR
🔴 Failed / needs rework
```

## Phase 1 — Navigation / zoom smoothness

| Status | Comment ID | Original feedback | Completion note |
|---|---|---|---|
| ✅ | B1 — Zoom is not smooth | Zoom/orbit felt rough after restore. | Added event-driven navigation smoothness controller with OrbitControls damping/zoom tuning and stable FOV/aspect-aware fit behavior. |

## Phase 1A — Browser diagnostics / Chrome cache help

| Status | Comment ID | Original feedback | Completion note |
|---|---|---|---|
| ✅ | X1 — Chrome-only erratic response | Erratic response appears only in Chrome, not Edge. Console showed a missing dynamic import: `static-properties-actions-controller.js` 404. | Removed the missing startup import and added a browser diagnostic banner/API that detects Chrome/module-load failures and gives Ctrl+F5 / disable-cache / clear-site-data guidance. |

## Phase 1B — Chrome runtime/cache diagnostics

| Status | Comment ID | Original feedback | Completion note |
|---|---|---|---|
| ✅ | X2 — Chrome runtime/cache diagnostics | Chrome still felt erratic after the missing-module fix. Console showed no module failures but still showed the old outer `fresh-clip-core-20260619` shell key. | Bumped visible shell asset keys to `chrome-runtime-diagnostics-20260619`, added stale-shell detection, WebGL/GPU capture, bounded frame-time sampling, wheel-latency diagnostics, and a visible Chrome help banner only when mismatch/lag is detected. |

## Phase 2 — Input panel always-visible block

| Status | Comment ID | Original feedback | Completion note |
|---|---|---|---|
| ✅ | C1 — Input controls must always remain visible | “This should be always visible.” | Added a sticky real input-control block at the top of the input drawer and a non-polling controller that keeps the input drawer open. |
| ✅ | C2 — Required visible input block | Show always: `No file chosen`, `Choose InputXML`, `Load BM_CII sample`, `Clear All`. | The real file status, file chooser label, BM_CII sample button, and Clear All button are now grouped in the always-visible input block. |
| ✅ | C3 — Real browse/sample controls hidden | Input panel choose/browse/load BM not visible. | The controller uses the real `xmlFile`, `loadSampleBtn`, and `clearBtn` controls and updates status without creating fake duplicates. |

## Phase 3 — Dropdown / ribbon cleanup

| Status | Comment ID | Original feedback | Completion note |
|---|---|---|---|
| ✅ | D1 — Broken dropdown menu | Fix broken dropdown menu. | Added a Phase 3 ribbon/dropdown cleanup controller that positions topbar menus as fixed popovers above the shell instead of allowing parent overflow clipping. |
| ✅ | D2 — Truncated dropdown | Fix truncating dropdown. | Topbar dropdowns now use bounded max-height and internal scrolling, with overflow visible on the topbar/action containers. |
| ✅ | D3 — Remove duplication | Remove duplicate tool/menu entries. | Duplicate Review dropdown and legacy quick-export ribbon group are hidden/removed; Review tools remain in the ribbon and canvas context path. |
| ✅ | D4 — Export menu grouping | Group/merge export buttons into Export. | Quick export is now menu-only; GLB/RVM/ATT/Audit downloads stay under the existing Export dropdown. |
| ✅ | D5 — Icon size consistency | Make all icon sizes similar. | Ribbon and review icons are normalized to the same 64×56 tile and 20 px icon grammar. |
| ✅ | D6 — Collapsible ribbon groups | Collapse groups and add `>>` / `<<` expand affordance. | View/Fit has an explicit `>>` / `<<` toggle with secondary buttons collapsed by default and state saved in localStorage. |
| ✅ | D7 — Preserve icon UI grammar | Preserve new app structure with icon buttons, not text shortcuts. | The icon-first ribbon remains the primary UI; hidden shortcut hooks remain non-visible implementation hooks only. |

## Phase 4 — Global Esc and tool lifecycle

| Status | Comment ID | Original feedback | Completion note |
|---|---|---|---|
| ⬜ | E1 — Global Esc | Make `Esc` global for escaping any tool and exiting. | Pending. |
| ⬜ | E2 — Clear persistent area selection | Area selection remains forever. | Pending. |
| ⬜ | E3 — Reassemble exploded view | Once exploded, how to reassemble/undo? | Pending. |

## Phase 5 — Selection resolver foundation

| Status | Comment ID | Original feedback | Completion note |
|---|---|---|---|
| ⬜ | G4 — Common selection resolver | Area Sel / Explode / Box / Isolate completely not working. | Pending. |
| ⬜ | G5 — Hide only selection | Hide hides entire geometry instead of selected part. | Pending. |
| ⬜ | G7 — Ribbon/right-click parity | Area Select works via right-click only, not ribbon. | Pending. |

## Phase 6 — Section Box

| Status | Comment ID | Original feedback | Completion note |
|---|---|---|---|
| ⬜ | G3a — Box not working | Box / Section Box not working from restored UI. | Pending. |
| ⬜ | G6 — Preserve working box select | Box select later worked and should be preserved. | Pending. |

## Phase 7 — Isolate / Hide / Show All

| Status | Comment ID | Original feedback | Completion note |
|---|---|---|---|
| ⬜ | G1 — Isolate not working | Isolate tool not working. | Pending. |
| ⬜ | G5 — Hide hides full model | Hide hides entire geometry instead of hiding selection. | Pending. |

## Phase 8 — Area Select practical workflow

| Status | Comment ID | Original feedback | Completion note |
|---|---|---|---|
| ⬜ | G3b — Area Select not working | Area Select not working from restored UI. | Pending. |
| ⬜ | G7 — Area Select ribbon path | Area Select works via right-click only, not ribbon icon. | Pending. |
| ⬜ | G8 — Selection remains forever | One area is selected and remains forever in canvas. | Pending. |
| ⬜ | H1 — Practical Area Select use | How to practically use Area Select? | Pending. |
| ⬜ | H2 — Export selected properties | Export selected properties or anything else? | Pending. |
| ⬜ | H3 — Clear selected area | Add Clear Selection and selected count/status. | Pending. |
| ⬜ | H4 — Downstream actions | Area selected set should work with Isolate, Hide, Show All, Export Selected. | Pending. |

## Phase 9 — Explode / Reassemble

| Status | Comment ID | Original feedback | Completion note |
|---|---|---|---|
| ⬜ | G2 — Explode not working | Explode view not working. | Pending. |
| ⬜ | I1 — Visible component offset | Explode must offset visible component roots safely. | Pending. |
| ⬜ | I2 — Reassemble / undo | Once exploded, how to reassemble or undo? | Pending. |
| ⬜ | I3 — Non-destructive explode | Original positions must be cached and restored. | Pending. |

## Phase 10 — Measure Polyline marker rewrite

| Status | Comment ID | Original feedback | Completion note |
|---|---|---|---|
| ⬜ | F1 — Large circle | Measure invokes large circle. | Pending. |
| ⬜ | F2 — Aspect/model scale issue | GLB/RVM aspect or scale causes marker size problem. | Pending. |
| ⬜ | F3 — Large disk flicker | Poly measure still shows large disk as flicker. | Pending. |

## Process guardrails

| Status | Guardrail | Requirement |
|---|---|---|
| ✅ | No bulk reactivation | Do not re-add all tools in one PR. |
| ✅ | No startup polling | Do not use `setInterval` or repeated scene traversal during startup. |
| ✅ | No relocation loops | Do not repeatedly move/recreate ribbon buttons. |
| ✅ | Event-driven tools only | Scene traversal is allowed only when user invokes a tool. |
| ✅ | Phase checklist | Each phase must tick only comments cleared by that merged phase. |
