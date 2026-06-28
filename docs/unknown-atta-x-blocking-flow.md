# Unknown / generic support X fallback

This change makes unknown or unmapped support rows visible instead of silently treating them as a normal support family.

## Behavior

When a support is classified as `UNKNOWN`, `UNKNOWN_RESTRAINT`, or generic ATTA/ANCI/SUPPORT without a recognizable mapped family, the topology-gated support export replaces the generic warning marker with two crossed Review-safe code-8 cylinder bars.

The two bars are placed in the plane normal to the matched pipe axis, creating an X symbol that visually blocks the flow path.

## Audit fields

- `unknownSupportCount`
- `xFallbackSupportCount`
- `unknownSupportRows`
- `xFallbackRows`
- per-row `unknownSupport`
- per-row `xFallback`
- per-row `warningCode = UNKNOWN_SUPPORT_REQUIRES_MAPPING`

## Scope

This does not alter pipe geometry, bends, XML enrichment, ATT schema, or support basis selection. It only makes unknown/generic supports visible and auditable in the support export path.
