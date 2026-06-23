export const MANAGED_STAGE_STAGEDJSON_SUPPORT_MAPPER_PREVIEW_NOTES = Object.freeze({
  schema: 'ManagedStageStagedJsonSupportMapperPreviewNotes.v1',
  purpose: 'The editable stagedJson support mapper must drive preview support normalization before symbol resolution.',
  rules: [
    'Use SUPPORT_GAP_MM first, then current-record *GAP* fields only.',
    'Do not carry gaps across support records.',
    'Normalize source axes through the CAESAR-to-Canvas axis-basis mapper before graphics rules.',
    'stagedJson and ISONOTE are mutually exclusive support sources.'
  ]
});
