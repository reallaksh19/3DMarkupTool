# RCA: node 10 REST, node 205 spring, and click camera movement

## Observed

- Canvas shows REST at node 10 even though BM_CII should not have REST at node 10.
- Hanger/spring at node 205 does not render.
- Canvas still moves/zooms/focuses during object click.

## Root causes

1. The bundled BM_CII managed-stage sample data included `['10', 'REST']` in `supports(nodes)`. The renderer was showing what the bundled sample declared.
2. The same sample had two node 205 REST rows and no explicit spring/can/hanger row. Therefore there was no source-level support record for the support contract to render as spring.
3. The app's core Select mode still allows OrbitControls camera movement. The guard now forces Select mode to be selection-only by disabling rotate while keeping wheel zoom and explicit Fit buttons available.

## Fix

- Remove node 10 REST from the bundled sample.
- Replace the duplicated node 205 REST rows with explicit HOLDDOWN and SPRING_CAN rows while keeping the total support count at 12.
- Enforce selection-only navigation policy in the click-zoom guard whenever Select mode is active.
