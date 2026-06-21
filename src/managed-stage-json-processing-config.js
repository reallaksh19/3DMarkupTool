export const MANAGED_STAGE_JSON_PROCESSING_CONFIG_SCHEMA = 'ManagedStageJsonProcessingConfig.v1';

export const MANAGED_STAGE_DEFAULT_PROCESSING_CONFIG = Object.freeze({
  excludeBendsWhileProcessingInputXmlBasedJson: true,
  genericInputXmlBendRadiusMultiplier: 1.5,
  inputXmlBendTrimMaxContractFraction: 0.35
});

export function resolveManagedStageJsonProcessingConfig(profile, options = {}) {
  const inputXmlBasedJson = isInputXmlBasedManagedStageProfile(profile);
  const excludeOption = options.excludeBendsWhileProcessingInputXmlBasedJson;
  const legacyExcludeOption = options.excludeInputXmlBends;
  const excludeRequested = excludeOption ?? legacyExcludeOption ?? MANAGED_STAGE_DEFAULT_PROCESSING_CONFIG.excludeBendsWhileProcessingInputXmlBasedJson;
  const config = {
    schema: MANAGED_STAGE_JSON_PROCESSING_CONFIG_SCHEMA,
    inputXmlBasedJson,
    excludeBendsWhileProcessingInputXmlBasedJson: inputXmlBasedJson && excludeRequested !== false,
    genericInputXmlBendRadiusMultiplier: positiveNumber(
      options.genericInputXmlBendRadiusMultiplier ?? MANAGED_STAGE_DEFAULT_PROCESSING_CONFIG.genericInputXmlBendRadiusMultiplier,
      'genericInputXmlBendRadiusMultiplier'
    ),
    inputXmlBendTrimMaxContractFraction: boundedFraction(
      options.inputXmlBendTrimMaxContractFraction ?? MANAGED_STAGE_DEFAULT_PROCESSING_CONFIG.inputXmlBendTrimMaxContractFraction,
      'inputXmlBendTrimMaxContractFraction'
    )
  };
  return {
    ...config,
    mode: config.excludeBendsWhileProcessingInputXmlBasedJson ? 'inputxml-json-generic-1p5d-bends' : 'managed-stage-native-bends',
    reason: config.excludeBendsWhileProcessingInputXmlBasedJson
      ? 'InputXML marker found in managed-stage JSON and bend exclusion config is ON'
      : inputXmlBasedJson
        ? 'InputXML marker found but bend exclusion config is OFF'
        : 'No InputXML marker found in managed-stage JSON'
  };
}

export function isInputXmlBasedManagedStageProfile(profile = {}) {
  return /inputxml/i.test(inputXmlMarkerText(profile));
}

export function inputXmlMarkerText(profile = {}) {
  const parts = [
    profile.source,
    profile.converter,
    profile.profile,
    profile.schema,
    ...(profile.branches || []).flatMap((branch) => [branch?.name, branch?.type]),
    ...(profile.records || []).flatMap((record) => [
      record?.name,
      record?.rawName,
      record?.type,
      record?.attributes?.SOURCE_FORMAT,
      record?.attributes?.SOURCE_ELEMENT_ID,
      record?.attributes?.NAME,
      record?.attributes?.REF
    ])
  ];
  return parts.filter(Boolean).join('\n');
}

function positiveNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid ${fieldName}: expected positive number`);
  return parsed;
}

function boundedFraction(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed >= 0.5) {
    throw new Error(`Invalid ${fieldName}: expected fraction >= 0 and < 0.5`);
  }
  return parsed;
}
