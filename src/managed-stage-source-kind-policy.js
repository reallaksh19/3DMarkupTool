const NON_PRIMITIVE_SOURCE_KINDS = Object.freeze(['json', 'jscon', 'inputxml', 'txt', 'xml']);
const PRIMITIVE_SOURCE_KINDS = Object.freeze(['rvm', 'glb', 'gltf']);

export const MANAGED_STAGE_SOURCE_KIND_POLICY = Object.freeze({
  schema: 'ManagedStageSourceKindPolicy.v1',
  nonPrimitiveSourceKinds: [...NON_PRIMITIVE_SOURCE_KINDS],
  primitiveSourceKinds: [...PRIMITIVE_SOURCE_KINDS],
  supportOverlayRule: 'managed-stage support overlay is enabled only for non-primitive source files: .json/.jscon/.inputxml/.txt/.xml',
  autoBendRule: 'managed-stage auto-bend preview is enabled only for non-primitive source files and never for .rvm/.glb/.gltf',
});

export function detectManagedStageSourceKind(sourceName = '', options = {}) {
  const explicit = normalizeKind(options.sourceKind || options.loadedSourceKind || options.fileKind);
  if (explicit) return explicit;
  const name = String(sourceName || '').trim().toLowerCase();
  const clean = name.split(/[?#]/)[0];
  const match = clean.match(/\.([a-z0-9]+)$/i);
  const ext = normalizeKind(match?.[1] || '');
  if (ext) return ext;
  if (/inputxml/i.test(String(sourceName || ''))) return 'inputxml';
  return 'json';
}

export function canUseManagedStageSupportOverlay(sourceName = '', options = {}) {
  const kind = detectManagedStageSourceKind(sourceName, options);
  if (PRIMITIVE_SOURCE_KINDS.includes(kind)) return false;
  return NON_PRIMITIVE_SOURCE_KINDS.includes(kind);
}

export function canUseManagedStageAutoBend(sourceName = '', options = {}) {
  const kind = detectManagedStageSourceKind(sourceName, options);
  if (PRIMITIVE_SOURCE_KINDS.includes(kind)) return false;
  return NON_PRIMITIVE_SOURCE_KINDS.includes(kind);
}

export function resolveManagedStageSourceKindPolicy(sourceName = '', options = {}) {
  const sourceKind = detectManagedStageSourceKind(sourceName, options);
  const supportOverlayEnabled = canUseManagedStageSupportOverlay(sourceName, { ...options, sourceKind });
  const autoBendEnabled = canUseManagedStageAutoBend(sourceName, { ...options, sourceKind });
  return {
    schema: MANAGED_STAGE_SOURCE_KIND_POLICY.schema,
    sourceKind,
    supportOverlayEnabled,
    autoBendEnabled,
    supportOverlayReason: supportOverlayEnabled
      ? 'non-primitive source kind; source-anchored support overlay may be drawn'
      : 'primitive/native model source; support overlay is blocked',
    autoBendReason: autoBendEnabled
      ? 'non-primitive source kind; local orthogonal auto-bend preview may be drawn'
      : 'primitive/native model source; auto-bend reinterpretation is blocked',
  };
}

function normalizeKind(value) {
  const text = String(value || '').trim().toLowerCase().replace(/^\./, '');
  if (!text) return '';
  if (text === 'jscon') return 'jscon';
  if (text === 'json') return 'json';
  if (text === 'inputxml') return 'inputxml';
  if (text === 'xml') return 'xml';
  if (text === 'txt') return 'txt';
  if (text === 'rvm') return 'rvm';
  if (text === 'glb') return 'glb';
  if (text === 'gltf') return 'gltf';
  return text;
}
