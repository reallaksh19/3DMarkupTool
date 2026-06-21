# Unified InputXML / managed-stage JSON load flow

The viewer uses one model-load dialog for both source formats:

```text
Input / Export
→ Choose InputXML / Managed JSON
→ .xml / .txt / .json
```

This supports ordinary InputXML files and managed-stage JSON files such as:

```text
BM_CII_INPUT_managed_stage.json
```

## User flow

1. Open the viewer.
2. In **Input / Export**, click **Choose InputXML / Managed JSON** or the **Load XML / JSON** icon.
3. Select either:
   - InputXML: `.xml` / `.txt`
   - Managed-stage JSON: `.json`
4. The loader auto-detects the file type:
   - XML/TXT continues through the existing InputXML GLB/RVM conversion path.
   - Managed-stage JSON is intercepted before the XML parser and routed to the managed-stage RVM path.
5. For managed-stage JSON, the viewer immediately creates an RVM preview scene and enables **RVM**, **ATT**, and **Audit** downloads.

## Managed-stage path

```text
BM_CII_INPUT_managed_stage.json
→ convertManagedStageJsonToRvmAtt()
→ RVM export model
→ createRvmPreviewScene()
→ binary .rvm + .att + audit downloads
```

The JSON path does not enter the InputXML parser. GLB download is disabled for managed-stage JSON because this source mode is RVM-first.

## InputXML path

```text
InputXML
→ existing app.js file handler
→ runAppConversionController()
→ GLB / RVM / ATT / audit
```

The unified managed-stage controller only intercepts `.json` files that declare:

```text
schema  = inputxml-managed-stage/v1
profile = AVEVA_JSON_FOR_3D_RVM_VIEWER
```

Non-JSON files pass through to the existing app handler.

## Primitive scope

Managed-stage JSON preview/export remains restricted to the managed-stage RVM contract:

```text
code 8 cylinder
code 4 elbow / torus
```

The preview renderer supports code-4 elbow primitives as torus arcs using the solver-provided basis from the export model.

## Why one dialog

The file chooser is now source-aware, not XML-only. This prevents `BM_CII_INPUT_managed_stage.json` from being sent into the XML parser while keeping the user workflow compact:

```text
one icon
one file chooser
auto-route by source type
```
