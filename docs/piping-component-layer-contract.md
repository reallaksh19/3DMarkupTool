# Piping Component Layer Contract

Status: contract and implementation guardrail. This document defines the normalized pipeline that must sit between source parsers and render/export adapters. It does not replace the current renderer by itself.

## Purpose

`3DMarkupTool` must stop treating InputXML as a direct mesh recipe. InputXML, raw RVM+ATT, staged JSON, future UXML, PCF, and other sources should all feed a normalized component layer.

The intended flow is:

```text
Source Adapter
→ PipingComponent.v1[]
→ PipingGraph.v1
→ GeometryContract.v1[]
→ RenderInstruction.v1[]
→ Viewer / GLB / RVM+ATT export
```

The current InputXML direct-rendering path remains available only as an explicit legacy fallback path.

## Non-negotiable rules

1. Source-specific type codes must be interpreted only in source adapters or classifiers.
2. Renderers must consume component classes, geometry kinds, and render recipes, not raw InputXML type codes.
3. Unknown items must remain unknown. They must not silently become `PIPE`, `REST`, or `ANCHOR`.
4. Every rendered component object must carry stable contract metadata in `userData`.
5. GLB, RVM+ATT, and the viewer must eventually consume the same `GeometryContract.v1` objects.
6. Fallback rendering must be explicit and counted in diagnostics.
7. Invalid geometry must be rejected before render/export instructions are emitted.

## Implementation modules

Current contract-layer entry points:

```text
src/piping-component-contract.js   validation, enums, diagnostics
src/piping-component-catalog.js    component catalog + render recipe catalog + source classifiers
src/piping-component-layer.js      SourceRecord → Component → Graph → GeometryContract → RenderInstruction pipeline
```

The current legacy visual renderer is listed in `src/render-boundary-manifest.js` as fallback-only.

## SourceRecord.v1

A source adapter may keep raw source details in a source record, but raw source type codes must not pass into renderer decision logic.

```ts
type SourceRecord = {
  schemaVersion: 'SourceRecord.v1';
  sourceType: 'INPUTXML' | 'RVM_ATT' | 'STAGED_JSON' | 'UXML' | 'PCF' | string;
  sourceId: string;
  sourceRecordKind: 'ELEMENT' | 'RESTRAINT' | 'SUPPORT' | 'ANNOTATION' | string;
  rawKind?: string;
  rawTypeCode?: string;
  sourceIndex?: number;
  record?: unknown;
  props?: Record<string, unknown>;
  diagnostics: string[];
};
```

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

Required component classes:

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

Required restraint/support types:

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

`UNKNOWN_RESTRAINT` is valid only as a preserved unknown restraint/support subtype. It must not be normalized to `REST`, `GUIDE`, `ANCHOR`, or any directional type without an explicit adapter/classifier rule.

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
  diagnostics: {
    nodeCount: number;
    edgeCount: number;
    openNodes: string[];
    duplicateNodes: string[];
    [key: string]: unknown;
  };
};
```

This layer is responsible for pipe continuity, branch detection, bend placeholder collapse, support snapping, and duplicate/open node diagnostics.

## GeometryContract.v1

A geometry contract is renderable intent. It is not a Three.js mesh and must remain exporter-neutral.

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

Minimum geometry kind mapping:

```text
PIPE       → CYLINDER_BETWEEN_NODES
ELBOW/BEND → ELBOW_SWEEP
TEE        → TEE_COMPOSITE
VALVE      → VALVE_SYMBOLIC
FLANGE     → FLANGE_PAIR
REDUCER    → REDUCER_TRANSITION
SUPPORT    → RESTRAINT_SYMBOL
RESTRAINT  → RESTRAINT_SYMBOL
UNKNOWN    → UNKNOWN_PLACEHOLDER
fallback   → FALLBACK_LEGACY
```

## RenderRecipe.v1

A render recipe is a stable adapter contract that explains how a geometry kind may be rendered or exported. It is not source-specific.

```ts
type RenderRecipe = {
  schemaVersion: 'RenderRecipe.v1';
  renderRecipeId: string;
  componentClass: string;
  geometryKind: string;
  targets: Array<'VIEWER' | 'GLB' | 'RVM_ATT'>;
  primitiveStrategy: string;
  fallbackOnly: boolean;
  notes: string;
};
```

Required recipe skeleton:

```text
pipe-cylinder-between-nodes.v1
elbow-sweep.v1
bend-sweep.v1
tee-composite.v1
valve-symbolic.v1
flange-pair.v1
reducer-transition.v1
restraint-symbol.v1
support-symbol.v1
unknown-placeholder.v1
fallback-legacy.v1
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

## Catalog skeleton

The catalog must cover at least:

```text
pipe
elbow
bend
tee
valve
flange
reducer
support/restraint
unknown placeholder
```

Each catalog entry must specify:

```ts
type PipingComponentCatalogEntry = {
  schemaVersion: 'PipingComponentCatalogEntry.v1';
  key: string;
  componentClass: PipingComponent['componentClass'];
  componentType: string;
  geometryKind: GeometryContract['geometryKind'];
  renderRecipeId: string;
  requiredTopology: string[];
  requiredDimensions: string[];
  aliases: string[];
};
```

Source-specific aliases such as InputXML raw rigid types and restraint type codes belong in the adapter/classifier tables, not in renderer code.

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

```ts
type PipingContractDiagnostics = {
  schema: string;
  sourceRecordsTotal: number;
  componentsTotal: number;
  componentsByClass: Record<string, number>;
  unknownComponents: number;
  restraintsByKind: Record<string, number>;
  geometryContractsTotal: number;
  contractsByGeometryKind: Record<string, number>;
  fallbackRendered: number;
  unrenderableComponents: string[];
  graphNodesTotal?: number;
  graphEdgesTotal?: number;
  phases?: {
    sourceRecordsTotal: number;
    componentsTotal: number;
    graphNodesTotal: number;
    graphEdgesTotal: number;
    geometryContractsTotal: number;
    renderInstructionsTotal: number;
  };
};
```

Required acceptance fields:

```text
sourceRecordsTotal
componentsTotal
componentsByClass
geometryContractsTotal
fallbackRendered
unknownComponents
unrenderableComponents
```

## Test gates

The contract layer must keep tests for:

```text
classification does not drop records
unknown remains unknown
pipe produces CYLINDER_BETWEEN_NODES contract
elbow/bend produces ELBOW_SWEEP contract
tee produces TEE_COMPOSITE contract
support/restraint produces RESTRAINT_SYMBOL contract
invalid geometry is rejected
fallback is explicitly flagged
existing RVM/ATT phase gates remain green
no new source-specific direct-render path appears outside the fallback manifest
```
