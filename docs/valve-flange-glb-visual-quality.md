# Valve / flange GLB visual-quality tuning

## Scope

This note documents the C8 visual-quality pass for the proportional valve/flange catalogue.

The catalogue remains a **fallback visual catalogue**, not an ASME dimensional database. Exact dimensions must still come from a future rating / size / standard database.

## Problem corrected

The earlier proportional recipe could make valve/flange assemblies read as stacked collars or detached washer discs because:

- valve `bodyLengthFactor` existed in the profile but was not used by the axial primitive partition;
- the rounded valve body stretched through most of the component span;
- valve end collars could be larger than the valve body;
- flange plate and bolt-circle radii were visually aggressive for the GLB fallback scale;
- bolt circle radius was independent from the resolved plate radius.

## C8 visual intent

### Flanged valve

```text
pipe -> thin flange/collar -> tapered shoulder -> compact rounded body -> tapered shoulder -> thin flange/collar -> pipe
```

C8 keeps the valve body compact by applying `bodyLengthFactor` and using the remaining span for tapered shoulders. End collars are capped below body radius so they read as thin flange plates rather than detached valve barrels.

### Flange pair

```text
pipe -> weld-neck taper -> thin flange plate | raised face / gasket | thin flange plate -> weld-neck taper -> pipe
```

C8 caps the plate, raised-face, gasket, neck, bolt-circle, and bolt radii to compact fallback proportions. The bolt circle is constrained to fit within the resolved plate radius.

## CI guardrail

`tests/valve-flange-visual-quality.test.mjs` is part of `npm test` and verifies:

- flanged valve continuity is preserved;
- valve body length remains compact;
- tapered shoulders are longer than thin collars;
- collars are smaller than body radius;
- shoulder taper directions are correct;
- flange pair plates are compact and symmetric;
- raised faces and gasket overlays are smaller than plates;
- weld-neck hubs do not read as second flange discs;
- bolt patterns fit within the flange plate;
- single-oriented flanges obey the same compact fallback limits.

## Non-goals

C8 does not change:

- UI layout;
- RVM binary writer format;
- RVM primitive kinds;
- InputXML parsing;
- ASME/rating-size dimensional accuracy.
