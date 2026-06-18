# Support / Restraint Mapping Contract

This standalone app converts ISONOTE expected restraints into normalized support records, then routes them through one common support mapper.

## Families

| Keyword | Family | Axis | Symbol |
|---|---|---|---|
| REST | REST | +Y | Single upward arrow |
| HOLDDOWN | HOLDDOWN | ±Y | Double vertical arrows |
| GUIDE | GUIDE | lateral | Horizontal pipe in X → ±Z; pipe in Z → ±X; vertical pipe → ±X and ±Z |
| LINE STOP | LINE_STOP | pipe axial | ± axial pair unless explicit sign exists |
| LIMIT / LIM | LIMIT | pipe axial | always ± axial |
| SINGLE AXIS X/Y/Z | AXIS_RESTRAINT_UNRESOLVED | stated axis | warning marker unless sign selected |
| Can Spring / Spring Can | SPRING_WARNING | below pipe | warning coil below pipe |

## Gap

Gap is record-scoped. No carry-forward and no same-node inheritance.

InputXML: GAP comes from the same RESTRAINT row. Negative sentinel means no gap.

ISONOTE: GAP is parsed only if explicitly written as GAP, GAP=, GAP:, or GAP 25 mm. Bare loads like REST(28kN) are not gaps.

## Contact and visual resolver

1. Apply engineering contact first.
2. Classify final symbol orientation.
3. Apply OD×2/3 visual resolver only to final pipe-parallel / axial symbols.

Axial restraints do not use OD/2 radial contact. No positive gap means opposing axial arrow tips touch. Positive gap means separation = 10×gap.
