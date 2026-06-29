# Support restraint type workbench

Adds a first-class editable `Restraint Type` mapping for InputXML support resolution.

## Behavior

- Support Mapping / ISONOTE popup gains a `Restraint Type` tab.
- The tab lists restraint type code, support family, source axis, canvas axis, action axis, and symbology rule.
- The table is editable and persisted in localStorage.
- `Apply as per InputXML` saves the edited restraint-type table before reprocessing the current managed-stage source.
- The stagedJson source contract applies the restraint-type table before support family/axis/visual resolution, so generated support geometry uses the configured type-code rules.

## Default examples

- `17` -> REST, source `+Y`, canvas `+Y`, action `+Y`
- `18` -> GUIDE, source `+X`, canvas `+X`, action `+X`
- `19` -> LINE_STOP, source `+Z`, canvas `+Z`, action `+Z`
- `20` -> HOLDDOWN, source `-Y`, canvas `-Y`, action `-Y`
- `21` -> SPRING_CAN, source `+Y`, canvas `+Y`, action `+Y`

## UI cleanup

- Legacy support launch buttons are hidden because the Support Mapping / ISONOTE popup is now the working surface.
- The popup mode summary now carries the useful support mode, source-count, ISONOTE, Restraint Type, and audit information.

## Canvas

- Adds a bottom-right `Enriched axis` HUD.
- Adds an Orbit button to the right-side canvas tool rail.
- Strengthens the select-click camera guard by continuously enforcing selection-only left-click behavior while Select mode is active.
