const STORAGE_KEY = '3dmt.shadowPreview.enabled';

export function isShadowPreviewEnabled(locationLike = globalThis?.location, storageLike = globalThis?.localStorage) {
  return getShadowPreviewFlagSource(locationLike, storageLike) !== 'disabled';
}

export function getShadowPreviewFlagSource(locationLike = globalThis?.location, storageLike = globalThis?.localStorage) {
  if (hasQueryFlag(locationLike)) return 'url';
  if (hasStorageFlag(storageLike)) return 'localStorage';
  return 'disabled';
}

function hasQueryFlag(locationLike) {
  try {
    if (!locationLike) return false;
    const search = typeof locationLike.search === 'string' ? locationLike.search : '';
    if (!search) return false;
    return new URLSearchParams(search).get('shadowPreview') === '1';
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
