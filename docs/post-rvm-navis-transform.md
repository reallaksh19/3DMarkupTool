# Post-RVM Navis transform

## Reverted scope

The corrective signed-axis support resolver changes from PR #453 and the debug-proof module from PR #454 are reverted in this branch.

Support-axis semantic mapping remains the PR #452 mapping only:

```text
Navis N   -> Canvas +Y
Navis Top -> Canvas +Z
Navis W   -> Canvas -X
```

This mapping is not applied inside the support-axis resolver as a signed-axis geometry rotation.

## Correct transform stage

The Navis transform is now applied after the managed-stage RVM export model has been generated and before these consumers run:

```text
writeRvm(exportModel)
writeAtt(exportModel)
createRvmPreviewScene(exportModel)
audit/stitch/bounds checks
```

That means the same transformed export model is used by canvas preview and binary RVM output.

## Transform scope

The post-RVM transform applies to the complete export model:

```text
node CNTB positions
primitive centers
endpoint-locked cylinder start/end points
primitive directions
explicit primitive basis vectors
support marker positions
support marker primitive geometry
ATT attributes
audit metadata
```

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

The converter audit now includes:

```text
audit.postRvmAxisTransform
```

with:

```text
enabled
transformed
presetId
matrixSummary
handedness
applyStage
transformScope
sampleRows
```

## Cache

Pages cache key is bumped to:

```text
input-persistent-root-card-20260629-n
```
