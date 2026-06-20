import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollup } from 'rollup';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_DIR = path.join(ROOT, '_site');
const ASSET_DIR = path.join(SITE_DIR, 'assets');
const VERSION = 'tool-fixes-v2-20260620';

await rm(SITE_DIR, { recursive: true, force: true });
await copyStaticSite(ROOT, SITE_DIR);
await mkdir(ASSET_DIR, { recursive: true });

await buildBundle('src/app-bundle-entry.js', 'assets/app.bundle.js');
await buildBundle('src/static-shell-bundle-entry.js', 'assets/static-shell.bundle.js');
await injectBundleManifest();

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
  const manifest = [
    `<link rel="modulepreload" href="./assets/app.bundle.js?v=${VERSION}" />`,
    `<link rel="modulepreload" href="./assets/static-shell.bundle.js?v=${VERSION}" />`,
    '<script>',
    `  window.__3D_MARKUP_BUNDLED_ASSETS__ = {`,
    `    version: ${JSON.stringify(VERSION)},`,
    `    app: './assets/app.bundle.js?v=${VERSION}',`,
    `    shell: './assets/static-shell.bundle.js?v=${VERSION}'`,
    '  };',
    '</script>'
  ].join('\n');

  if (!html.includes('__3D_MARKUP_BUNDLED_ASSETS__')) {
    html = html.replace(
      '  <script type="module" src="./src/render-context-prebridge.js',
      `${manifest}\n  <script type="module" src="./src/render-context-prebridge.js`
    );
  }

  await writeFile(indexPath, html, 'utf8');
}
