# Axis transform UI and debug proof

## RCA from live log

The live debug log showed:

```text
appLoaderVersion=input-persistent-root-card-20260629-f
```

That proved the browser/runtime was still reporting the old app-loader version, even after later Pages cache key bumps. Therefore the axis transform could not be trusted from visual inspection alone.

## Fix

This patch adds proof in three places:

1. `src/app-loader.js`
   - bumps `APP_LOADER_VERSION` to `input-persistent-root-card-20260629-m`;
   - loads `support-axis-transform-ui-debug-controller.js` after the support debug logger.

2. `src/support-axis-transform-ui-debug-controller.js`
   - exposes a visible `Navis Axis Transform Config` card in both the old Support Mapping settings dialog and the newer Support Mapping / ISONOTE workbench;
   - shows the table:
     - `+X -> +Y`
     - `-X -> -Y`
     - `+Y -> -X`
     - `-Y -> +X`
     - `+Z -> +Z`
     - `-Z -> -Z`
   - explicitly displays the proof target `source +X -> canvas +Y`.

3. Debug log wrapper
   - appends `SUPPORT_AXIS_TRANSFORM_DEBUG` after every support debug dump;
   - includes loader version, bundle version, matrix, transform table, resolved samples, family-rule samples, and runtime axis samples if present.

## Expected debug proof

After hard refresh, a debug dump should include:

```text
=== SUPPORT_AXIS_TRANSFORM_DEBUG_BEGIN ===
appLoaderVersion=input-persistent-root-card-20260629-m
priorityProof source +X -> canvas +Y
transformTable=+X->+Y, -X->-Y, +Y->-X, -Y->+X, +Z->+Z, -Z->-Z
=== SUPPORT_AXIS_TRANSFORM_DEBUG_END ===
```

If it still reports `...-f`, the browser is still running an old loader/cache path.

## Cache

Pages cache key bumped to `input-persistent-root-card-20260629-m`.
