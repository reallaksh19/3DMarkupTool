# Support / restraint visual catalogue foundation

## Status

This module is a proportional visual fallback catalogue for support and restraint symbols. It is not a vendor support catalogue, not a pipe-support standard database, and not a dimensional support design database.

The C14 foundation introduces:

- `src/support-restraint-visual-catalog.js`
- `src/support-restraint-primitive-adapter.js`
- `tests/support-restraint-visual-catalog.test.mjs`

The module is intentionally not wired into production `export-model.js` in C14. Production wiring belongs to a follow-up phase after the catalogue seam is stable.

## Supported visual families

The initial proportional catalogue resolves these families:

- `REST`
- `GUIDE`
- `LINE_STOP`
- `LIMIT_STOP`
- `ANCHOR`
- `HOLDDOWN`
- `SPRING`
- `AXIS_RESTRAINT`
- `UNKNOWN_RESTRAINT`

Unknown values must remain `UNKNOWN_RESTRAINT`. They must not silently become `REST`, `ANCHOR`, `PIPE`, or any other known support family.

## Metadata contract

Every resolved support/restraint spec exposes:

- `componentClass = SUPPORT_RESTRAINT`
- `catalogSchemaVersion = SupportRestraintVisualCatalog.v1.proportional-fallback`
- `proportionalFallback = true`
- `vendorDimensionalDbBacked = false`
- `recipeId`
- `visualKey`

Every primitive adapter record stamps:

- `supportCatalogue = true`
- `supportVisualKey`
- `supportVisualRecipeId`
- `supportVisualSchema`
- `supportVisualFamily`
- `proportionalFallback = true`
- `vendorDimensionalDbBacked = false`

## RVM primitive safety

The adapter only emits RVM-writer-safe primitive kinds:

- `cylinder`
- `pyramid`
- `box`
- `sphere`

This keeps the support/restraint catalogue compatible with the existing RVM writer and avoids introducing unsupported primitive kinds.

## Non-claims

C14 does not claim:

- vendor standard support dimensions
- spring hanger catalogue geometry
- shoe/clamp/trunnion engineering details
- ASME/rating-size support geometry
- byte-for-byte RVM equivalence with any external reference model

## Next phase

C15 should wire the support/restraint catalogue adapter into `export-model.js`, replacing the current inline support symbol construction while preserving the existing RVM/ATT output contract and artifact gates.
