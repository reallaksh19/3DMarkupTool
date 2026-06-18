# 3DMarkupTool Upgrade Phases

## Hard guardrails

The following areas are protected and must not be changed during UI/viewer upgrade work:

- InputXML parsing/intake logic
- Core geometry construction and propagation
- Core metadata/property construction logic
- Support mapping/classification logic
- Support semantic interpretation
- Support rendering assembly/orientation logic
- RVM/ATT export mapping logic

Allowed Phase-1 changes are limited to display/UI concerns:

- Viewer layout and toolbar organization
- Canvas control modes and keyboard shortcuts
- Camera fit/view commands
- Selection helper/outline display
- Status bar and panel visibility
- Metadata display formatting only
- Material color overrides through the existing color-by viewer mode
- CSS sizing/spacing and static webpage UX

## Phase 1 — Static Navis-style review shell

Status: implemented on branch `phase-1-static-ui-shell`.

Scope:

- Reorganized top toolbar into navigation, view, review, preview, color, and panel groups.
- Added Select, Orbit, Pan, Measure, Clip, Fit All, Fit Selection, and Clear controls.
- Added keyboard shortcuts: `S`, `O`, `P`, `M`, `C`, `H`, `F`, `Esc`.
- Added canvas help overlay.
- Added bottom viewer status bar for coordinates, selected item, object count, and protected-core note.
- Added non-destructive selection box helper.
- Preserved existing converter modules and support mapping rules.

## Phase 2 — Appearance controls

Planned:

- Add safe viewer-only appearance controls for pipe/component color presets.
- Add support color/opacity controls only through display material override.
- Add support scale display controls only if they do not affect support mapping, classification, or export.
- Add light/dark/high-contrast theme selector.

## Phase 3 — Model tree and isolate/hide

Planned:

- Add read-only model tree based on existing object metadata.
- Add hide/isolate/show-all viewer operations.
- Add search/filter by node, line number, support family, source mode, and component type.

## Phase 4 — Markup tools

Planned:

- Add camera viewpoint save/load.
- Add text callouts and redline markup stored separately from parsed model data.
- Export/import markup JSON without modifying InputXML conversion results.

## Navisworks comparison target

This app targets a Freedom-style review workflow in a static browser:

- Navigate model
- Select object
- Review properties
- Fit view/selection
- Measure
- Section/clip
- Color by metadata
- Add markup later

It does not target Navisworks Manage clash/4D functionality in the initial upgrade phases.
