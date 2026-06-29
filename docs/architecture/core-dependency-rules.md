# Core dependency rules

## Purpose

Core migration modules must remain independent from the current browser runtime. This keeps the new contracts, audits, catalogue logic, geometry solvers, and compilers testable without the app shell, DOM controllers, canvas lifecycle, or global runtime state.

## Rule

Core modules must not import:

- `src/app.js`;
- runtime DOM controllers;
- `safe-ui-loader`;
- `app-loader`;
- popup controllers;
- download button controllers;
- canvas scene controllers;
- global `window` state modules.

Only adapter modules may touch current runtime code.

## Core module examples

The following families are core modules:

- `src/contracts/`;
- `src/audit/`;
- future catalogue binding modules;
- future geometry solving modules;
- future primitive compiler modules.

These modules must accept explicit input objects or source text and return explicit result objects. They must not read DOM state, browser globals, app singletons, canvas scene globals, popup state, or download-button state.

## Adapter exception

Adapter modules may bridge between current runtime code and core contracts only when a phase explicitly owns that integration. Adapters must keep the direction clear:

```text
runtime/current app -> adapter -> core contract function
```

Core modules must not import the adapter back.

## Test expectation

Governance tests should keep checking that core modules do not reference runtime-only modules or browser globals. A passing unit test is not sufficient if the dependency direction is wrong.
