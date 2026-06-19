# Piping Component Layer Contract

Status: contract / guardrail only. This document does not replace the current renderer by itself.

## Purpose

`3DMarkupTool` must stop treating InputXML as a direct mesh recipe. InputXML, raw RVM+ATT, staged JSON, future UXML, and other sources should all feed a normalized component layer.

The intended flow is:

```text
Source file
→ Source Adapter
→ PipingComponent.v1[]
→ PipingGraph.v1
→ GeometryContract.v1[]
→ RenderInstruction.v1[]
→ Viewer / GLB / RVM+ATT export
```

The current InputXML direct-rendering path remains allowed only as an explicit fallback path.

## Non-negotiable rules

1. Source-specific type codes must be interpreted only in source adapters or classifiers.
2. Renderers must consume component classes, geometry kinds, and render recipes, not raw InputXML type codes.
3. Unknown items must remain unknown. They must not silently become `PIPE`, `REST`, or `ANCHOR`.
4. Every rendered object must carry a stable component link in `userData`.
5. GLB, RVM+ATT, and the viewer must eventually consume the same geometry contracts.
6. Fallback rendering must be explicit and counted in diagnostics.

## PipingComponent.v1

A component is the normalized engineering object created from a source record.

Required fields:

```ts
type PipingComponent = {
  schemaVersion: 'PipingComponent.v1';
  componentId: string;
  componentClass:
    | 'PIPE'
    | 'ELBOW'
    | 'BEND'
    | 'TEE'
    | 'VALVE'
    | 'FLANGE'
    | 'REDUCER'
    | 'SUPPORT'
    | 'RESTRAINT'
    | 'UNKNOWN';
  componentType: string;
  sourceRef: {
    sourceType: 'INPUTXML' | 'RVM_ATT' | 'STAGED_JSON' | 'UXML' | 'PCF' | string;
    sourceId: string;
    rawKind?: string;
    rawTypeCode?: string;
  };
  topology: Record<string, unknown>;
  geometryIntent: Record<string, unknown>;
  renderIntent: {
    renderRecipeId: string;
    materialRecipeId?: string;
    fallbackAllowed: boolean;
  };
  metadata: Record<string, string | number | boolean | null>;
  diagnostics: string[];
};
```

Recommended component classes:

```text
PIPE
ELBOW / BEND
TEE
VALVE
FLANGE
REDUCER
SUPPORT
RESTRAINT
UNKNOWN
```

Recommended restraint/support types:

```text
REST
GUIDE
LINESTOP
LIMIT_STOP
ANCHOR
HANGER
SPRING
DIRECTIONAL_X
DIRECTIONAL_Y
DIRECTIONAL_Z
UNKNOWN_RESTRAINT
```

## PipingGraph.v1

The graph owns topology. Renderers must not infer joins by visual clustering.

```ts
type PipingGraph = {
  schemaVersion: 'PipingGraph.v1';
  nodes: Array<{
    nodeId: string;
    position: [number, number, number];
    connectedComponentIds: string[];
  }>;
  edges: Array<{
    edgeId: string;
    fromNode: string;
    toNode: string;
    componentId: string;
  }>;
  components: PipingComponent[];
  diagnostics: Record<string, unknown>;
};
```

This layer is responsible for pipe continuity, branch detection, bend placeholder collapse, support snapping, and duplicate/open node diagnostics.

## GeometryContract.v1

A geometry contract is renderable intent. It is not a Three.js mesh.

```ts
type GeometryContract = {
  schemaVersion: 'GeometryContract.v1';
  geometryContractId: string;
  componentId: string;
  componentClass: string;
  geometryKind:
    | 'CYLINDER_BETWEEN_NODES'
    | 'ELBOW_SWEEP'
    | 'TEE_COMPOSITE'
    | 'VALVE_SYMBOLIC'
    | 'FLANGE_PAIR'
    | 'REDUCER_TRANSITION'
    | 'RESTRAINT_SYMBOL'
    | 'UNKNOWN_PLACEHOLDER'
    | 'FALLBACK_LEGACY';
  placement: Record<string, unknown>;
  dimensions: Record<string, number>;
  ports: Array<Record<string, unknown>>;
  renderRecipeId: string;
  selection: {
    selectable: boolean;
    selectionProxy: 'GROUP' | 'MESH' | 'BOUNDS';
  };
  export: {
    includeInGlb: boolean;
    includeInRvm: boolean;
    includeInAtt: boolean;
  };
  fallbackRendered?: boolean;
  diagnostics: string[];
};
```

## RenderInstruction.v1

A render instruction converts a geometry contract into viewer/export-specific output.

```ts
type RenderInstruction = {
  schemaVersion: 'RenderInstruction.v1';
  target: 'VIEWER' | 'GLB' | 'RVM_ATT';
  componentId: string;
  geometryContractId: string;
  renderRecipeId: string;
  materialRecipeId: string;
  userData: {
    objectRole: 'component-render';
    componentId: string;
    componentClass: string;
    sourceRef: { sourceType: string; sourceId: string };
    geometryContractId: string;
    renderRecipeId: string;
    fallbackRendered: boolean;
    fallbackReason?: string;
  };
};
```

Render instructions must not contain raw InputXML type-code branches. If raw source details are needed for properties, keep them in metadata/source inspection, not renderer decision logic.

## Fallback policy

Fallback is allowed only when contract rendering is unavailable or invalid.

Fallback objects must set:

```text
geometryKind = FALLBACK_LEGACY
fallbackRendered = true
userData.fallbackRendered = true
userData.fallbackReason = <non-empty reason>
```

Diagnostics must count fallback objects.

## Diagnostics schema

Minimum required diagnostics:

```text
sourceRecordsTotal
componentsTotal
componentsByClass
unknownComponents
restraintsByKind
geometryContractsTotal
contractsByGeometryKind
fallbackRendered
unrenderableComponents
```

## Acceptance for future geometry/catalog work

1. `npm test` stays green.
2. Existing RVM/ATT phase gates stay green.
3. Source records are not dropped silently.
4. Unknown components and unknown restraints remain explicit.
5. Pipe contracts use `CYLINDER_BETWEEN_NODES`.
6. Elbow/bend contracts use `ELBOW_SWEEP`.
7. Tee contracts use `TEE_COMPOSITE`.
8. Valve/flange/reducer/support contracts have explicit geometry kinds.
9. Current direct InputXML rendering remains fallback only until the new contract renderer is complete.
