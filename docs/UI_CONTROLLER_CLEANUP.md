# UI Controller Cleanup Contract

This note records the UI/runtime ownership after the cleanup sequence through PR #84. The goal is to keep the app deterministic and avoid layered controllers competing for the same viewer state or DOM nodes.

## Current load contract

The intended browser load path is:

1. `index.html`
2. `src/clip-render-hook.js`
3. `src/render-context-prebridge.js`
4. `src/app.js`
5. `src/safe-ui-bootstrap.js`
6. `src/safe-ui-loader.js`
7. active optional modules listed in `ALL_MODULES`

`src/clip-render-hook.js` should not start the safe UI loader. It should stay limited to clip recovery concerns.

`src/render-context-prebridge.js` is loaded before `src/app.js` and owns only the small remaining legacy DOM contract that `app.js` still reads directly: hidden `#hint` and hidden `#supportMode` derived from the visible support checkboxes.

## Active ownership map

| Feature area | Current owner |
|---|---|
| Optional UI loading | `src/safe-ui-bootstrap.js`, `src/safe-ui-loader.js` |
| Pre-app legacy DOM contract | `src/render-context-prebridge.js` |
| Input drawer | `src/input-drawer-controller.js` |
| Runtime bridge | `src/viewer-runtime-bridge-controller.js` |
| Core safety | `src/core-app-safety-controller.js` |
| Grid toggle | `src/grid-toggle-controller.js` |
| Clip plane | `src/clip-adjuster.js` |
| 3D Clip Box | `src/viewer-clipbox-controller.js` |
| Model tree | `src/model-tree-panel.js`, `src/tree-panel-bridge-controller.js` |
| Tree selection | `src/tree-selection-bridge-controller.js`, `src/selection-sync-controller.js` |
| Context menu | `src/visibility-context-menu.js` |
| Two-row ribbon | `src/two-row-icon-ribbon-controller.js` |
| Ribbon menus | `src/ribbon-menu-polish-controller.js` |
| Tag/session/XML tools | `src/tag-lite-host-controller.js`, `src/navis-*` safe controllers |
| RVM QA UI helpers | `src/rvm-compat-validator-controller.js`, `src/rvm-strict-mode-controller.js` |
| Opt-in UI acceptance checks | `src/ui-acceptance-harness.js` via `?uiAcceptance=1` only |

## Deprecated controllers not loaded

These files are intentionally excluded from `safe-ui-loader.js`:

- `src/phase35-ui-cleanup-controller.js`
- `src/phase36-input-drawer-fix-controller.js`
- `src/phase37-input-drawer-stack-controller.js`
- `src/phase38-clipbox-ui-cleanup-controller.js`
- `src/phase40-legacy-hint-compat-controller.js`
- `src/phase41-tree-clip-controls-controller.js`
- `src/conversion-options-compat-controller.js`

Keep them only for traceability until browser acceptance testing confirms no hidden dependency remains.

## Future cleanup rules

1. Extend the current owner instead of adding a new generic hotfix controller.
2. Do not move the same DOM nodes from more than one module.
3. Do not force the input drawer open after the user closes it.
4. Use `window.__3D_MARKUP_VIEWER_RUNTIME__` for renderer, scene, model, selection, and clipping state.
5. Keep context menus hidden until an explicit context action opens them.
6. Keep Grid Off by default on startup/model load while preserving user control.
7. Keep pre-app compatibility explicit and small; do not add broad DOM polyfills.
8. Do not modify InputXML parsing, support mapping, geometry conversion, RVM writer, or ATT writer from UI cleanup patches unless a bug is proven there.

## Manual acceptance before deleting deprecated files

Run the BM_CII browser flow before deleting old controllers:

- Startup has no floating context menu.
- Input drawer opens by default and closes/reopens reliably.
- Header is exactly two rows with no horizontal scrollbar and no third tag row.
- BM_CII sample loads and converts without null `value` or `style` errors.
- GLB/RVM/ATT buttons enable after conversion.
- Tree opens from ribbon and selection updates Props/status.
- Clip plane slider visibly clips the model.
- Clip Box displays a helper and uses selected-object bounds when available.
- Color By modes apply and Default restores materials.
- Export / Tags / Session / XML submenu actions remain accessible.

Optional deterministic preflight:

- Open the app with `?uiAcceptance=1`.
- Check console output from `window.__3D_MARKUP_UI_ACCEPTANCE__.run('manual')`.

No RVM/Navisworks certification is implied by these UI cleanup changes.
