# InputXML Fitting Fallback Policy

InputXML records can classify a source item as `BEND`, `ELBOW`, or `TEE`, but they do not contain enough contract-grade geometry to build reliable bend sweeps or tee composites.

Therefore, the contract pipeline must follow this rule:

```text
InputXML BEND / ELBOW / TEE
→ normalized PipingComponent.v1 with the correct componentClass
→ FALLBACK_LEGACY GeometryContract.v1
→ RenderInstruction.v1 with userData.fallbackRendered = true
```

The layer must not synthesize `ELBOW_SWEEP` or `TEE_COMPOSITE` from InputXML guesses such as visual direction, branch labels, or inferred topology. The existing renderer remains the explicit fallback for those source records until a richer adapter supplies real topology and dimensions.

`ELBOW_SWEEP` and `TEE_COMPOSITE` remain valid geometry contracts only for adapters that provide explicit contract topology and geometry, for example a future PCF/UXML/staged source record with verified ports, bend radius, bend angle, and tee branch data.

Diagnostics should expose delegated fitting records with `delegatedTopologyComponents` and count their fallback render instructions in `fallbackRendered`.
