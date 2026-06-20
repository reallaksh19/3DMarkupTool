import './clip-render-hook.js';

const installGuard = window.__3D_MARKUP_INSTALL_STARTUP_FREEZE_GUARD__;
if (typeof installGuard === 'function') {
  installGuard({ source: 'app-bundle' });
}

await import('./app.js');

try {
  await import('./fresh-clip-controller.js');
} catch (error) {
  console.warn('[3DMarkupTool] Fresh clip controller skipped inside app bundle.', error);
  window.dispatchEvent(new CustomEvent('viewer:fresh-clip-module-skipped', {
    detail: {
      version: 'perf-rules-20260620',
      bundled: true,
      reason: error && (error.message || String(error))
    }
  }));
}

window.__3D_MARKUP_APP_BUNDLE_READY__ = true;
window.dispatchEvent(new CustomEvent('viewer:app-bundle-ready', {
  detail: { version: 'perf-rules-20260620' }
}));
