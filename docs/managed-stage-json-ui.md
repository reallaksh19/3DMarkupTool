# Managed-stage JSON UI load flow

This flow adds a browser-side entry point for `inputxml-managed-stage/v1` JSON files such as `BM_CII_managedstaged.json`.

## User flow

1. Open the viewer.
2. In **Input / Export**, click **Load Managed Stage JSON**.
3. Choose the managed-stage JSON file.
4. The controller converts the JSON through the managed-stage RVM path and displays the generated RVM preview geometry.
5. Use the existing **RVM**, **ATT**, and **Audit** download buttons.

## Scope

The UI controller uses the same infrastructure as the CLI artifact path:

```text
managed-stage JSON
→ convertManagedStageJsonToRvmAtt()
→ RVM export model
→ createRvmPreviewScene()
→ binary .rvm + .att + audit downloads
```

The UI does not route managed-stage JSON through the InputXML GLB converter. GLB download is disabled for this source mode.

## Primitive scope

Managed-stage JSON preview/export remains restricted to the managed-stage RVM contract:

```text
code 8 cylinder
code 4 elbow / torus
```

The preview renderer now supports code-4 elbow primitives as torus arcs using the solver-provided basis from the export model.

## Why this is separate from the XML loader

The existing `xmlFile` input remains InputXML-first. Managed-stage JSON is a post-XML staged profile and therefore has its own load icon and controller. This prevents JSON input from accidentally entering the XML parser/converter path.
