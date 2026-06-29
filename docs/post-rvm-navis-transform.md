# Post-RVM Navis transform

## Reverted scope

The corrective signed-axis support resolver changes from PR #453 and the debug-proof module from PR #454 are reverted.

Support-axis semantic mapping remains the PR #452 mapping only:

```text
Navis N   -> Canvas +Y
Navis Top -> Canvas +Z
Navis W   -> Canvas -X
```

This mapping is not applied inside the support-axis resolver as a signed-axis geometry rotation.

## Correct transform stage

The Navis transform is applied after the managed-stage RVM export model has been generated.

The model flow is intentionally split:

```text
raw export model       -> canvas preview / coordinate audit / canvas selection metadata
transformed RVM model  -> writeRvm() / writeAtt() / RVM audit / stitch manifest / bounds
```

This keeps the canvas in the original source axis while transforming only the generated RVM/ATT transaction.

## Transform scope for RVM only

The post-RVM transform applies to the RVM/ATT export model only:

```text
node CNTB positions
primitive centers
endpoint-locked cylinder start/end points
primitive directions
explicit primitive basis vectors
support marker positions
support marker primitive geometry
ATT attributes
RVM audit metadata
```

It does not transform `result.exportModel`, because `result.exportModel` is what the managed-stage canvas preview consumes.

The transformed model is returned separately as:

```text
result.rvmExportModel
result.transformedExportModel
```

## Canvas fallback support cubes

The legacy visible fallback overlay no longer creates support-like fallback boxes/cubes:

```text
TYPE: SUPPORT_RESTRAINT
```

Those were canvas-only markers with incomplete metadata such as Family=N/A / Source=N/A / Visual Resolver=not applied.

Canvas support visualization is now expected to come from canonical support marker geometry only.

## Popup

A new `RVM Navis Transform` popup is added. It displays the retained observed mapping and the selected post-export-model transform preset.

The config is stored in local storage under:

```text
managedStage.rvmPostAxisTransform.v1
```

and is also exposed at runtime as:

```text
window.__3D_MARKUP_RVM_POST_AXIS_TRANSFORM_CONFIG__
```

## Default preset

Default preset:

```text
canvasEngineeringToNavis
```

Matrix:

```text
[xPrime, yPrime, zPrime] = [-z, -x, y]
```

This is a right-handed transform, so RVM primitive basis validation remains valid.

## Audit proof

The converter audit includes:

```text
audit.modelFlow.canvasPreviewTransformed = false
audit.modelFlow.rvmBinaryTransformed = true
audit.postRvmAxisTransform
```

The visible fallback audit includes:

```text
managedStageVisibleFallback.suppressedSupportFallbackCount
managedStageVisibleFallback.supportFallbackPolicy
```

## Cache

Pages cache key is bumped to:

```text
input-persistent-root-card-20260629-o
```
