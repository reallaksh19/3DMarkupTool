export const MANAGED_STAGE_PROFILE_SCHEMA = 'inputxml-managed-stage/v1';
export const MANAGED_STAGE_RVM_PROFILE = 'AVEVA_JSON_FOR_3D_RVM_VIEWER';

export function parseManagedStageProfile(sourceText) {
  const json = parseJson(sourceText);
  if (json.schema !== MANAGED_STAGE_PROFILE_SCHEMA) {
    throw new Error(`Unsupported managed-stage schema: ${json.schema || 'UNKNOWN'}`);
  }
  if (json.profile !== MANAGED_STAGE_RVM_PROFILE) {
    throw new Error(`Unsupported managed-stage profile: ${json.profile || 'UNKNOWN'}`);
  }
  if (json.units?.length !== 'mm') {
    throw new Error('Managed-stage RVM export requires units.length = mm');
  }

  const branches = Array.isArray(json.hierarchy) ? json.hierarchy : [];
  const records = [];
  for (const branch of branches) {
    for (const child of branch.children || []) {
      const attributes = child.attributes || {};
      records.push({
        branchName: branch.name || '',
        branchType: branch.type || '',
        rawName: child.name || attributes.NAME || 'UNNAMED',
        name: attributes.NAME || child.name || 'UNNAMED',
        type: child.type || attributes.TYPE || 'UNKNOWN',
        attributes
      });
    }
  }

  const geometryRecords = records.filter((record) => record.type !== 'ATTA');
  const supportRecords = records.filter((record) => record.type === 'ATTA');
  return {
    schema: json.schema,
    profile: json.profile,
    source: json.source || 'UNKNOWN',
    converter: json.converter || '',
    generatedAt: json.generatedAt || '',
    units: 'mm',
    inputStats: json.stats || {},
    branches,
    records,
    geometryRecords,
    supportRecords
  };
}

function parseJson(sourceText) {
  if (typeof sourceText === 'string') return JSON.parse(sourceText);
  if (sourceText && typeof sourceText === 'object') return sourceText;
  throw new Error('Managed-stage profile parser expects JSON text or object');
}
