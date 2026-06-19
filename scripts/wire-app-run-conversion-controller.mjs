#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

export const APP_DELEGATE_CODEMOD_SCHEMA = 'AppRunConversionDelegateCodemod.v1';

const IMPORT_BLOCK = `import { convertInputXmlToGlb } from './converter.js?v=professional-viewer-3';\nimport { convertInputXmlToRvmAtt } from './rvm-converter.js?v=professional-viewer-3';\nimport { createRvmPreviewScene } from './rvm-preview.js?v=professional-viewer-3';`;

const DELEGATE_IMPORT = `import { runAppConversionController } from './app-run-conversion-controller.js?v=professional-viewer-3';`;

const LEGACY_RUN_CONVERSION_BODY = `async function runConversion() {
  try {
    if (!state.xmlText.trim()) throw new Error('No InputXML loaded. Choose a file or load the BM_CII sample.');
    status('Converting');
    el('convertBtn').disabled = true;
    clearMeasurement();
    clearSelection();

    const options = collectOptions();
    log(\`Run Conversion mode=\${options.supportMode}, singleAxis=\${options.singleAxisDecision}\`);
    const glbResult = await convertInputXmlToGlb(state.xmlText, options);
    const rvmResult = convertInputXmlToRvmAtt(state.xmlText, options);

    state.glb = glbResult.glb;
    state.rvm = rvmResult.rvm;
    state.att = rvmResult.att;
    state.audit = {
      glb: glbResult.audit,
      rvmAtt: rvmResult.audit
    };
    state.glbScene = glbResult.scene;
    state.rvmScene = createRvmPreviewScene(rvmResult.exportModel);
    publishViewerRuntime('conversion:scenes-created');

    setModelScene(state.glbScene, 'glb');
    setInputDrawer(false);
    setPropsDrawer(true);
    setDownloadButtons(true);

    log(\`Converted GLB: components=\${glbResult.audit.componentCount}, nodes=\${glbResult.audit.nodeCount}, supportSymbols=\${glbResult.audit.supportSymbols.length}, isonoteRecords=\${glbResult.audit.isonoteRecords}\`);
    log(\`Converted RVM+ATT: components=\${rvmResult.audit.componentCount}, supports=\${rvmResult.audit.supportCount}, primitives=\${rvmResult.audit.primitiveCount}, annotations=\${rvmResult.audit.annotationCount}\`);
    log(\`GLB size=\${formatBytes(glbResult.glb.byteLength)}, RVM size=\${formatBytes(rvmResult.rvm.byteLength)}, ATT size=\${formatBytes(rvmResult.audit.attBytes)}\`);
    status('Converted');
  } catch (err) {
    console.error(err);
    log(\`ERROR: \${err.message}\`);
    status('Conversion failed');
  } finally {
    el('convertBtn').disabled = false;
  }
}`;

const DELEGATED_RUN_CONVERSION_BODY = `async function runConversion() {
  await runAppConversionController({
    sourceText: state.xmlText,
    options: collectOptions(),
    state,
    ui: {
      status,
      log,
      onError: (err) => console.error(err),
      setConvertDisabled: (disabled) => { el('convertBtn').disabled = disabled; },
      setInputDrawer,
      setPropsDrawer,
      setDownloadButtons
    },
    actions: {
      clearMeasurement,
      clearSelection,
      publishViewerRuntime,
      setModelScene
    }
  });
}`;

export function transformAppJsDelegate(source) {
  if (typeof source !== 'string' || !source.trim()) {
    throw new Error('app.js source text is required');
  }

  let output = source;
  const changes = [];

  if (output.includes(IMPORT_BLOCK)) {
    output = output.replace(IMPORT_BLOCK, DELEGATE_IMPORT);
    changes.push('replace-direct-conversion-imports');
  } else if (!output.includes(DELEGATE_IMPORT)) {
    throw new Error('Could not find legacy conversion import block or delegate import');
  }

  if (output.includes(LEGACY_RUN_CONVERSION_BODY)) {
    output = output.replace(LEGACY_RUN_CONVERSION_BODY, DELEGATED_RUN_CONVERSION_BODY);
    changes.push('delegate-runConversion');
  } else if (!output.includes(DELEGATED_RUN_CONVERSION_BODY)) {
    throw new Error('Could not find legacy runConversion body or delegated runConversion body');
  }

  return {
    schemaVersion: APP_DELEGATE_CODEMOD_SCHEMA,
    changed: output !== source,
    changes,
    output
  };
}

export function assertDelegatedAppJs(source) {
  if (!source.includes(DELEGATE_IMPORT)) throw new Error('app.js must import runAppConversionController');
  if (!source.includes('await runAppConversionController({')) throw new Error('runConversion must delegate to runAppConversionController');
  if (source.includes("import { convertInputXmlToGlb } from './converter.js")) throw new Error('app.js must not import convertInputXmlToGlb directly');
  if (source.includes("import { convertInputXmlToRvmAtt } from './rvm-converter.js")) throw new Error('app.js must not import convertInputXmlToRvmAtt directly');
  if (source.includes("import { createRvmPreviewScene } from './rvm-preview.js")) throw new Error('app.js must not import createRvmPreviewScene directly');
  if (source.includes('const glbResult = await convertInputXmlToGlb(')) throw new Error('runConversion must not directly call convertInputXmlToGlb');
  if (source.includes('const rvmResult = convertInputXmlToRvmAtt(')) throw new Error('runConversion must not directly call convertInputXmlToRvmAtt');
  if (source.includes('state.rvmScene = createRvmPreviewScene(')) throw new Error('runConversion must not directly build RVM preview scene');
  if (!source.includes("publishViewerRuntime,")) throw new Error('delegate actions must pass publishViewerRuntime');
  if (!source.includes('setModelScene')) throw new Error('delegate actions must pass setModelScene');
  return true;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const repoRoot = process.cwd();
  const appPath = path.join(repoRoot, 'src', 'app.js');
  const source = fs.readFileSync(appPath, 'utf8');
  const result = transformAppJsDelegate(source);

  if (args.has('--check')) {
    assertDelegatedAppJs(result.output);
    console.log(JSON.stringify({ schemaVersion: APP_DELEGATE_CODEMOD_SCHEMA, changed: result.changed, changes: result.changes }, null, 2));
    return;
  }

  if (args.has('--write')) {
    fs.writeFileSync(appPath, result.output);
    assertDelegatedAppJs(result.output);
    console.log(JSON.stringify({ schemaVersion: APP_DELEGATE_CODEMOD_SCHEMA, wrote: true, changes: result.changes }, null, 2));
    return;
  }

  console.log(result.output);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
