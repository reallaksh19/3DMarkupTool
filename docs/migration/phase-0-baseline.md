# Phase 0 baseline checklist

## Purpose

Phase 0 freezes the current working tool before introducing the catalogue-driven authoring platform.

The objective is to avoid silent regressions while the new architecture is introduced in shadow mode.

## Current runtime baseline

The existing workflow remains the baseline:

```text
managed-stage JSON
  -> convertManagedStageJsonToRvmAtt()
  -> buildManagedStageRvmExportModel()
  -> canvas preview from result.exportModel
  -> writeRvm()/writeAtt()
```

The new platform must not alter this path during Phase 0/1.

## Baseline evidence to capture manually

For BM_CII managed-stage sample:

- input file loads;
- canvas preview appears;
- RVM/ATT/audit downloads are available;
- Support Mapping / ISONOTE default sample appears;
- ISONOTE Basis can be applied;
- RVM opens in Navis or compatible viewer;
- audit includes support count and primitive histogram;
- canvas remains in its existing axis convention.

## Phase 0 artefact names

Recommended manual baseline names:

```text
artifacts/baseline/BM_CII_INPUT_managed_stage.phase0.rvm
artifacts/baseline/BM_CII_INPUT_managed_stage.phase0.att
artifacts/baseline/BM_CII_INPUT_managed_stage.phase0.audit.json
artifacts/baseline/BM_CII_INPUT_managed_stage.phase0.canvas.png
artifacts/baseline/BM_CII_INPUT_managed_stage.phase0.navis.png
```

These are not committed by default unless explicitly required.

## Regression blockers

Any Phase 1 PR must be rejected if it changes:

- `src/app.js`
- `src/managed-stage-rvm-converter.js`
- `src/rvm-writer.js`
- `src/att-writer.js`
- canvas runtime module loading
- support mapping runtime behavior
- RVM primitive payload layout

unless the change is explicitly part of a later migration phase.

## Phase 0 done criteria

- Architecture plan exists.
- Phase gates exist.
- Contract files can be added without runtime imports.
- Current app remains functionally unchanged.
