# UI Diagnostic Log Plan

Status: planned for a follow-up UI phase.

This document defines the target design for a detailed diagnostics log covering errors, rendering issues, and warnings without blocking the Tag/XML grouping cleanup.

## Scope

The diagnostic log is a UI/runtime-observability feature only. It must not change:

- GLB/RVM geometry generation
- InputXML parsing
- RVM/ATT export contracts
- Navis export contracts
- valve/flange catalogue logic
- converter pipeline data

## Log categories

The log should classify entries into these categories:

| Category | Examples |
|---|---|
| Error | module import failure, conversion exception, export failure, uncaught app error |
| Rendering issue | WebGL context loss, renderer fallback, shader/material warning, clipping-plane failure |
| Warning | stale asset key, unsupported browser capability, suspicious frame lag with visible/focused/long-task evidence |
| Info | model loaded, conversion completed, export downloaded, UI module loaded |

## Required entry schema

Each entry should use a stable JSON-compatible shape:

```js
{
  id: 'log-000001',
  ts: '2026-06-20T00:00:00.000Z',
  level: 'error' | 'warning' | 'render' | 'info',
  source: 'app' | 'renderer' | 'diagnostics' | 'ui' | 'export' | 'converter',
  message: 'Human-readable summary',
  detail: 'Optional detailed text',
  context: {
    module: 'optional-module-name',
    objectId: 'optional-selected-object-id',
    phase: 'optional-workflow-phase'
  }
}
```

## UI behavior

- Add one compact **Log** button in the topbar or Review tools.
- The log opens a side/drawer panel, not a blocking modal.
- The panel shows filters: All, Errors, Warnings, Rendering, Info.
- The newest severe item may update `#runtimeStatus`, but the full details stay in the log panel.
- Provide Copy JSON and Download JSON actions.

## Guardrails

- No continuous polling.
- No `setInterval`.
- No startup scene traversal.
- No layout-correction `MutationObserver`.
- No false jank banners based on rAF cadence alone.
- Jank warnings require: visible page, focused window, and accumulated Long Task evidence over threshold.
- WebGL/GPU probes remain late-idle diagnostics, not first-paint blockers.

## Event sources to capture

The implementation should listen to explicit events first:

- `viewer:status-message`
- `viewer:module-load-failed`
- `viewer:render-warning`
- `viewer:webgl-context-lost`
- `viewer:conversion-error`
- `viewer:export-error`
- `error`
- `unhandledrejection`

## Acceptance criteria

- A runtime API exists as `window.__3D_MARKUP_DIAGNOSTIC_LOG__`.
- API includes `add(entry)`, `clear()`, `exportJson()`, `getEntries()`, and `open()`.
- Errors and warnings are timestamped and source-tagged.
- Rendering warnings do not require scene traversal.
- The log panel is hidden by default and does not shift first-paint layout.
- `npm test` includes a diagnostic-log phase gate before merge.
