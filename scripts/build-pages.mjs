import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollup } from 'rollup';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_DIR = path.join(ROOT, '_site');
const ASSET_DIR = path.join(SITE_DIR, 'assets');
const VERSION = 'perf-static-drawer-bundle-20260620';

await rm(SITE_DIR, { recursive: true, force: true });
await copyStaticSite(ROOT, SITE_DIR);
await mkdir(ASSET_DIR, { recursive: true });

await buildBundle('src/app-bundle-entry.js', 'assets/app.bundle.js');
await buildBundle('src/static-shell-bundle-entry.js', 'assets/static-shell.bundle.js');
await injectBundleManifest();

console.log('Built GitHub Pages artifact with bundled app/static shell assets.');

async function copyStaticSite(from, to) {
  await cp(from, to, {
    recursive: true,
    filter(source) {
      const rel = path.relative(from, source).replace(/\\/g, '/');
      if (!rel) return true;
      return !(
        rel === '.git' || rel.startsWith('.git/') ||
        rel === '.github' || rel.startsWith('.github/') ||
        rel === 'node_modules' || rel.startsWith('node_modules/') ||
        rel === '_site' || rel.startsWith('_site/') ||
        rel === 'coverage' || rel.startsWith('coverage/')
      );
    }
  });
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
