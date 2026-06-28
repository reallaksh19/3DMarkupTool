import './clip-render-hook.js';

const installGuard = window.__3D_MARKUP_INSTALL_STARTUP_FREEZE_GUARD__;
if (typeof installGuard === 'function') {
  installGuard({ source: 'app-bundle' });
}

await import('./app.js?v=bust-cache-4');
await import('./disable-click-zoom-controller.js?v=bust-cache-4');

try {
  await import('./fresh-clip-controller.js?v=bust-cache-4');
} catch (error) {
  console.warn('[3DMarkupTool] Fresh clip controller skipped inside app bundle.', error);
  window.dispatchEvent(new CustomEvent('viewer:fresh-clip-module-skipped', {
    detail: {
      version: 'perf-static-drawer-bundle-20260620',
      bundled: true,
      reason: error && (error.message || String(error))
    }
  }));
}

window.__3D_MARKUP_APP_BUNDLE_READY__ = true;
window.dispatchEvent(new CustomEvent('viewer:app-bundle-ready', {
  detail: { version: 'select-click-camera-policy-bundle-20260628' }
}));
