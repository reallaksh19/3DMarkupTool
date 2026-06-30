const STORAGE_KEY = '3dmt.shadowDiagnostics.enabled';

export function isShadowDiagnosticsEnabled(locationLike = globalThis?.location, storageLike = globalThis?.localStorage) {
  return getShadowDiagnosticsFlagSource(locationLike, storageLike) !== 'disabled';
}

export function getShadowDiagnosticsFlagSource(locationLike = globalThis?.location, storageLike = globalThis?.localStorage) {
  if (hasQueryFlag(locationLike)) return 'url';
  if (hasStorageFlag(storageLike)) return 'localStorage';
  return 'disabled';
}

function hasQueryFlag(locationLike) {
  try {
    if (!locationLike) return false;
    const search = typeof locationLike.search === 'string' ? locationLike.search : '';
    if (!search) return false;
    return new URLSearchParams(search).get('shadowDiagnostics') === '1';
  } catch (_) {
    return false;
  }
}

function hasStorageFlag(storageLike) {
  try {
    if (!storageLike || typeof storageLike.getItem !== 'function') return false;
    return storageLike.getItem(STORAGE_KEY) === 'true';
  } catch (_) {
    return false;
  }
}
