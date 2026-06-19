# UI Controller Cleanup Contract

This note records the current UI/runtime ownership after the static review shell cleanup. The goal is to keep the app deterministic and avoid layered controllers competing for the same viewer state or DOM nodes.

## Current load contract

The intended browser load path is:

1. `index.html`
2. `src/clip-render-hook.js`
3. `src/render-context-prebridge.js`
4. `src/app.js`
5. `src/safe-ui-bootstrap.js`
6. active static review modules listed in `CORE_MODULE_URLS`
7. opt-in modules only when a query flag or localStorage flag is present

`src/clip-render-hook.js` must not start the safe UI loader. It is only a recovery guard.

`src/render-context-prebridge.js` is loaded before `src/app.js` and owns only the small remaining legacy DOM contract that `app.js` still reads directly: hidden `#hint` and hidden `#supportMode` derived from the visible support checkboxes.

## Active default review ownership map

| Feature area | Current owner |
|---|---|
| Static review bootstrap | `src/safe-ui-bootstrap.js` |
| Pre-app legacy DOM contract | `src/render-context-prebridge.js` |
| Base shell/status/grid/panel toggles | `src/static-shell-core-controller.js` |
| Review-mode text/layout polish | `src/static-review-ui-polish-controller.js` |
| Professional toolbar sizing/labels | `src/static-toolbar-polish-controller.js` |
| Professional SVG icons | `src/static-svg-icons-controller.js` |
| Model tree | `src/static-tree-core-controller.js` |
| Properties action bar | `src/static-properties-actions-controller.js` |
| Color By legend | `src/static-color-legend-controller.js` |
| Workflow progress strip | `src/static-workflow-status-controller.js` |
| Drawer workflow summary | `src/static-drawer-summary-controller.js` |
| Help / shortcuts | `src/static-help-shortcuts-controller.js` |
| Tag / XML / session row | `src/static-markup-core-controller.js` |
| Quick exports | `src/static-quick-export-core-controller.js` |

## Opt-in only modules

These modules are not part of default review mode and should only load with an explicit flag:

- `?clipTools=1` or `localStorage['3dmarkup.clipTools']='1'`
  - `src/fresh-clip-controller.js`
  - `src/fresh-clip-box-adjust-controller.js`

- `?uiBehavior=1`, `?uiAdvanced=1`, `?uiAcceptance=1`, or safe-mode flags
  - optional legacy/safe-loader modules from `src/safe-ui-loader.js`

## Deprecated controllers not loaded in default review mode

These files must not be reintroduced into default startup without a focused review:

- `src/phase35-ui-cleanup-controller.js`
- `src/phase36-input-drawer-fix-controller.js`
- `src/phase37-input-drawer-stack-controller.js`
- `src/phase38-clipbox-ui-cleanup-controller.js`
- `src/phase40-legacy-hint-compat-controller.js`
- `src/phase41-tree-clip-controls-controller.js`
- `src/conversion-options-compat-controller.js`
- `src/two-row-icon-ribbon-controller.js`
- `src/ribbon-menu-polish-controller.js`
- `src/professional-ui-shell-controller.js`
- `src/shell-layout-recovery-controller.js`
- `src/viewer-clipbox-controller.js`
- `src/clip-adjuster.js` in default mode
- `src/static-clipbox-core-controller.js` in default mode
- `src/static-clip-diagnostics-controller.js` in default mode
- `src/static-clipbox-material-fallback-controller.js` in default mode

Keep them only for traceability until browser acceptance testing confirms no hidden dependency remains.

## Future cleanup rules

1. Extend the current static owner instead of adding a generic hotfix controller.
2. Do not move the same DOM nodes from more than one module.
3. Do not force drawers open after the user closes them.
4. Keep context menus hidden until an explicit context action opens them.
5. Keep Grid Off by default on startup/model load while preserving user control.
6. Keep pre-app compatibility explicit and small; do not add broad DOM polyfills.
7. Do not modify InputXML parsing, support mapping, geometry conversion, RVM writer, or ATT writer from UI cleanup patches unless a bug is proven there.
8. Clip tools are hidden in normal review mode until `app.js` explicitly publishes the real Three.js renderer into `window.__3D_MARKUP_VIEWER_RUNTIME__`.

## Manual acceptance before deleting deprecated files

Run the BM_CII browser flow before deleting old controllers:

- Startup has no floating context menu.
- Input drawer opens by default and closes/reopens reliably.
- Header/ribbon has no page-level horizontal overflow.
- BM_CII sample loads and converts without null `value` or `style` errors.
- GLB/RVM/ATT buttons enable after conversion.
- Tree opens from ribbon and selection updates Props/status.
- Color By modes apply and Legend opens/moves correctly.
- Properties actions Copy ID / Copy JSON / Fit Sel / Clear work.
- Quick Export buttons proxy existing export actions.
- Help panel opens with `?`, `H`, or `F1` and closes with `Esc`.

No RVM/Navisworks certification is implied by these UI cleanup changes.
