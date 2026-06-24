import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollup } from 'rollup';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_DIR = path.join(ROOT, '_site');
const ASSET_DIR = path.join(SITE_DIR, 'assets');
const VERSION = 'support-ringless-input-panel-revamp-20260624';
const LEGACY_CACHE_KEYS = Object.freeze([
  'tool-fixes-v2-20260620',
  'support-ui-render-export-fix-20260623',
  'app-boot-dialog-conversion-hotfix-20260623',
  'support-native-dialog-render-fix-20260623',
  'support-debug-log-20260623',
  'support-profile-source-bridge-20260624',
  'support-visibility-boost-20260624',
  'support-human-visible-scale-20260624',
  'support-od-offset-human-scale-20260624',
  'support-cone-can-catalogue-20260624',
  'support-disc-click-popup-cleanup-20260624',
  'support-preview-disc-source-fix-20260624',
  'support-axis-transform-generalized-20260624'
]);

await rm(SITE_DIR, { recursive: true, force: true });
await copyStaticSite(ROOT, SITE_DIR);
await ensurePagesIndexArtifact();
await mkdir(ASSET_DIR, { recursive: true });

await buildBundle('src/app-bundle-entry.js', 'assets/app.bundle.js');
await buildBundle('src/static-shell-bundle-entry.js', 'assets/static-shell.bundle.js');
await injectBundleManifest();
await assertFile(path.join(SITE_DIR, 'index.html'), 'Pages index artifact');

console.log('Built GitHub Pages artifact with bundled app/static shell assets.');

async function copyStaticSite(from, to) {
  // fs.cp rejects copying into a subdirectory of itself at the path-check
  // stage, before the filter runs — so we walk the tree manually instead.
  await mkdir(to, { recursive: true });
  const entries = await readdir(from, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    const rel = path.relative(ROOT, src).replace(/\\/g, '/');
    if (
      rel === '.git' || rel.startsWith('.git/') ||
      rel === '.github' || rel.startsWith('.github/') ||
      rel === 'node_modules' || rel.startsWith('node_modules/') ||
      rel === '_site' || rel.startsWith('_site/') ||
      rel === 'coverage' || rel.startsWith('coverage/')
    ) continue;
    if (entry.isDirectory()) {
      await copyStaticSite(src, dest);
    } else {
      await copyFile(src, dest);
    }
  }
}

async function ensurePagesIndexArtifact() {
  // Keep the Pages entry point explicit.  The recursive copier normally copies
  // root/index.html, but the deploy workflow validates this exact path and a
  // missing index should fail inside the build step with a useful message.
  const sourceIndex = path.join(ROOT, 'index.html');
  const siteIndex = path.join(SITE_DIR, 'index.html');
  await assertFile(sourceIndex, 'source index.html');
  await mkdir(path.dirname(siteIndex), { recursive: true });
  await copyFile(sourceIndex, siteIndex);
  await assertFile(siteIndex, 'Pages index artifact after explicit copy');
}

async function assertFile(filePath, label) {
  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) {
    throw new Error(`${label} missing at ${filePath}`);
  }
}

async function buildBundle(input, output) {
  const bundle = await rollup({
    input: path.join(ROOT, input),
    external: (id) => id === 'three' || id === 'lucide' || id.startsWith('three/'),
    plugins: [stripVersionQueryPlugin()]
  });

  await bundle.write({
    file: path.join(SITE_DIR, output),
    format: 'es',
    inlineDynamicImports: true,
    sourcemap: false
  });
  await bundle.close();
}

function stripVersionQueryPlugin() {
  return {
    name: 'strip-version-query',
    async resolveId(source, importer) {
      if (!source.includes('?v=')) return null;
      const clean = source.split('?')[0];
      if (!clean.startsWith('.')) return { id: clean, external: true };
      const resolved = await this.resolve(clean, importer, { skipSelf: true });
      return resolved || null;
    }
  };
}

async function injectBundleManifest() {
  const indexPath = path.join(SITE_DIR, 'index.html');
  let html = await readFile(indexPath, 'utf8');
  for (const key of LEGACY_CACHE_KEYS) html = html.replaceAll(`?v=${key}`, `?v=${VERSION}`);
  const scriptOpen = '<' + 'script>';
  const scriptClose = '<' + '/script>';
  const moduleScriptAnchor = '  <' + 'script type="module" src="./src/render-context-prebridge.js';
  const manifest = [
    `<link rel="modulepreload" href="./assets/app.bundle.js?v=${VERSION}" />`,
    `<link rel="modulepreload" href="./assets/static-shell.bundle.js?v=${VERSION}" />`,
    scriptOpen,
    `  window.__3D_MARKUP_BUNDLED_ASSETS__ = {`,
    `    version: ${JSON.stringify(VERSION)},`,
    `    app: './assets/app.bundle.js?v=${VERSION}',`,
    `    shell: './assets/static-shell.bundle.js?v=${VERSION}'`,
    '  };',
    scriptClose
  ].join('\n');

  if (!html.includes('__3D_MARKUP_BUNDLED_ASSETS__')) {
    html = html.replace(moduleScriptAnchor, `${manifest}\n${moduleScriptAnchor}`);
  }

  await writeFile(indexPath, html, 'utf8');
}
