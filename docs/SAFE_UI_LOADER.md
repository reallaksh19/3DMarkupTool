# Safe UI Loader

The live app uses a guarded optional-UI loader so a non-core UI module cannot break the core InputXML conversion/viewer workflow.

## Core path

Only these scripts are loaded directly from `index.html`:

1. `src/clip-render-hook.js`
2. `src/app.js`
3. `src/safe-ui-bootstrap.js`

Everything else is optional and must be loaded through `src/safe-ui-loader.js`.

## Protected scope

Do not use the safe UI loader to patch or replace:

- InputXML parsing/intake
- Core geometry construction/propagation
- Core property-building logic
- Support mapping/classification
- Support rendering/orientation/assembly
- RVM writer / primitive mapping
- ATT export mapping
- Any code in `reallaksh19/3D_Viewer`

## Module order

The current guarded order is:

1. UI diagnostics
2. Shell layout recovery
3. Property tabs
4. Input guard
5. Fit
6. Grid toggle
7. Clip adjuster
8. Clip / axis overlays
9. Color legend
10. Tree + visibility
11. Selection sync
12. Marquee zoom
13. Origin manager
14. RVM QA
15. Tag toolbar host
16. Tag import/views
17. Manual tag
18. Tag usability
19. Tag session
20. Tag XML QA

Each module is loaded with `await import(...)` inside a try/catch. A failure is shown in the UI diagnostics panel and must not stop the core app.

## Safe Mode

Safe Mode is enabled by either:

```text
?safe=1
```

or localStorage:

```js
localStorage.setItem('3dmarkup.safeUiMode', 'core')
```

In Safe Mode, only the UI diagnostics module is loaded. Use the UI diagnostics panel to exit Safe Mode.

## Cache control

Do not leave old phase query strings in direct script tags. If a module is part of the guarded path, it should be referenced only from `safe-ui-loader.js`.

For production hotfixes, bump:

- `index.html` direct script query strings
- `SAFE_LOADER_URL` in `safe-ui-bootstrap.js`
- any changed module URL in `safe-ui-loader.js`

## Forbidden patterns for optional UI modules

Avoid:

- Body-wide `MutationObserver` loops
- `setInterval` polling loops unless explicitly bounded
- monkey-patching Three.js prototypes
- replacing core export/conversion functions
- direct DOM relocation in an observed subtree
- importing the same module both from `index.html` and safe loader

Prefer:

- event-driven refresh
- idempotent DOM creation
- one module per feature
- guarded imports
- visible diagnostics for failures
