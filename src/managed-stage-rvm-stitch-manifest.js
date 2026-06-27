const PRIMITIVE_CODE_BY_KIND = Object.freeze({ pyramid: 1, box: 2, elbow: 4, snout: 7, cylinder: 8, sphere: 9 });
const SUPPORT_OVERLAY_PRIMITIVE_CODES = Object.freeze([8]);

export function buildManagedStageRvmStitchManifest(profile = {}, exportModel = {}, primitivePayloads = []) {
  const geometryRecords = profile.geometryRecords || [];
  const elementNodes = managedStageElementNodes(exportModel);
  const supportNodes = managedStageSupportNodes(exportModel);
  const plannedSupportPrimitives = supportNodes.flatMap((node) => node.primitives || []);
  const issues = [];
  let primitiveCursor = 0;
  const elements = geometryRecords.map((record, index) => {
    const node = elementNodes[index] || {};
    const plannedPrimitives = node.primitives || [];
    const decodedPrimitives = primitivePayloads.slice(primitiveCursor, primitiveCursor + plannedPrimitives.length);
    primitiveCursor += plannedPrimitives.length;
    if (!node.reviewName) issues.push(`missing export node for input element ${index + 1}: ${record.name}`);
    if (node.reviewName && node.reviewName !== record.name) issues.push(`element order mismatch at ${index + 1}: ${record.name} -> ${node.reviewName}`);
    if (decodedPrimitives.length !== plannedPrimitives.length) issues.push(`primitive decode count mismatch for ${record.name}`);
    const primitives = plannedPrimitives.map((primitive, primitiveIndex) => {
      const decoded = decodedPrimitives[primitiveIndex] || {};
      const expectedCode = PRIMITIVE_CODE_BY_KIND[primitive.kind] || null;
      if (expectedCode !== Number(decoded.code)) issues.push(`primitive code mismatch for ${record.name}.${primitive.localName || primitiveIndex}: expected ${expectedCode}, got ${decoded.code}`);
      return {
        index: primitiveIndex + 1,
        localName: primitive.localName || primitive.name || `PRIM_${primitiveIndex + 1}`,
        primitiveRole: primitive.primitiveRole || primitive.localName || '',
        primitiveRoleTag: primitive.primitiveRoleTag || primitive.primitiveRole || primitive.localName || '',
        kind: primitive.kind,
        expectedCode,
        emittedCode: Number(decoded.code),
        bodyLength: decoded.bodyLength || 0,
        chunkOffset: decoded.offset ?? null,
        material: primitive.material ?? node.material ?? null,
        centerMm: roundVector(primitive.center),
        direction: roundVector(primitive.direction || [0, 0, 1]),
        dimensions: primitiveDimensions(primitive),
        placement: primitivePlacement(primitive)
      };
    });
    return { index: index + 1, inputName: record.name, reviewName: node.reviewName || '', fromNode: record.attributes?.FROM_NODE || '', toNode: record.attributes?.TO_NODE || '', type: record.type || '', dtxr: record.attributes?.DTXR || '', material: node.material ?? null, primitiveCount: primitives.length, primitiveCodes: primitives.map((primitive) => primitive.emittedCode), primitiveRoleTags: primitives.map((primitive) => primitive.primitiveRoleTag), primitives };
  });
  const supportOverlayPrimitives = primitivePayloads.slice(primitiveCursor).map((decoded, index) => {
    const planned = plannedSupportPrimitives[index] || {};
    const expectedCode = PRIMITIVE_CODE_BY_KIND[planned.kind] || null;
    if (planned.kind && expectedCode !== Number(decoded.code)) issues.push(`support overlay primitive ${index + 1} code mismatch: expected ${expectedCode}, got ${decoded.code}`);
    if (planned.kind === 'pyramid') issues.push(`support overlay primitive ${index + 1} uses blocked filled pyramid substitute`);
    return { index: index + 1, localName: planned.localName || planned.name || `SUPPORT_PRIM_${index + 1}`, primitiveRole: planned.primitiveRole || planned.localName || '', primitiveRoleTag: planned.primitiveRoleTag || planned.primitiveRole || planned.localName || '', kind: planned.kind || '', expectedCode, emittedCode: Number(decoded.code), bodyLength: decoded.bodyLength || 0, chunkOffset: decoded.offset ?? null, material: planned.material ?? null, centerMm: roundVector(planned.center), direction: roundVector(planned.direction || [0, 0, 1]), dimensions: primitiveDimensions(planned), placement: primitivePlacement(planned) };
  });
  const supportOverlayPrimitiveCodes = supportOverlayPrimitives.map((primitive) => primitive.emittedCode);
  const geometryPrimitiveCodes = elements.flatMap((element) => element.primitiveCodes);
  const primitiveCodeHistogram = histogram([...geometryPrimitiveCodes, ...supportOverlayPrimitiveCodes]);
  return { schema: 'ManagedStageRvmStitchManifest.v1', stitchStrategy: 'single RVM stream assembled from ordered managed-stage piping element CNTB nodes plus optional support overlay CNTB nodes', supportOverlayPolicy: 'support overlays are Review-safe code-8 cylinder bar glyphs only; filled code-1 pyramid/cone/snout substitutes are blocked', elementCount: elements.length, exportElementNodeCount: elementNodes.length, primitiveCount: elements.reduce((sum, element) => sum + element.primitiveCount, 0) + supportOverlayPrimitives.length, geometryPrimitiveCount: elements.reduce((sum, element) => sum + element.primitiveCount, 0), supportOverlayPrimitiveCount: supportOverlayPrimitives.length, decodedPrimitiveCount: primitivePayloads.length, primitiveCodeHistogram, supportOverlayAllowedPrimitiveCodes: [...SUPPORT_OVERLAY_PRIMITIVE_CODES], allElementsMapped: issues.length === 0 && elements.length === elementNodes.length, elementOrderStable: issues.filter((issue) => issue.includes('element order mismatch')).length === 0, issues, supportOverlayPrimitives, elements };
}

export function assertManagedStageRvmStitchManifest(manifest = {}) {
  const issues = [];
  if (manifest.schema !== 'ManagedStageRvmStitchManifest.v1') issues.push(`unexpected stitch manifest schema ${manifest.schema}`);
  if (!manifest.allElementsMapped) issues.push('not all input elements are mapped to export CNTB nodes');
  if (!manifest.elementOrderStable) issues.push('element order is not stable');
  if (manifest.elementCount !== manifest.exportElementNodeCount) issues.push(`element/export node count mismatch: ${manifest.elementCount}/${manifest.exportElementNodeCount}`);
  if (manifest.primitiveCount !== manifest.decodedPrimitiveCount) issues.push(`planned/decoded primitive count mismatch: ${manifest.primitiveCount}/${manifest.decodedPrimitiveCount}`);
  if (Array.isArray(manifest.issues) && manifest.issues.length) issues.push(...manifest.issues);
  for (const element of manifest.elements || []) {
    if (!element.reviewName || element.reviewName !== element.inputName) issues.push(`element ${element.index} reviewName mismatch`);
    if (element.primitiveCount <= 0) issues.push(`element ${element.index} has no primitive records`);
    for (const primitive of element.primitives || []) if (primitive.expectedCode !== primitive.emittedCode) issues.push(`element ${element.index} primitive ${primitive.index} code mismatch`);
  }
  for (const primitive of manifest.supportOverlayPrimitives || []) {
    if (!SUPPORT_OVERLAY_PRIMITIVE_CODES.includes(Number(primitive.emittedCode))) issues.push(`support overlay primitive ${primitive.index} code mismatch: expected one of ${SUPPORT_OVERLAY_PRIMITIVE_CODES.join('/')}, got ${primitive.emittedCode}`);
    if (Number(primitive.emittedCode) === 1 || primitive.kind === 'pyramid') issues.push(`support overlay primitive ${primitive.index} uses blocked filled pyramid substitute`);
    if (primitive.expectedCode !== null && primitive.expectedCode !== undefined && primitive.expectedCode !== primitive.emittedCode) issues.push(`support overlay primitive ${primitive.index} planned code mismatch: expected ${primitive.expectedCode}, got ${primitive.emittedCode}`);
  }
  if (issues.length) throw new Error(`Managed-stage RVM stitch manifest failed: ${issues.join('; ')}`);
  return { schema: 'ManagedStageRvmStitchManifestGate.v1', ok: true, elementCount: manifest.elementCount, primitiveCount: manifest.primitiveCount, supportOverlayPrimitiveCount: manifest.supportOverlayPrimitiveCount || 0, supportOverlayAllowedPrimitiveCodes: [...SUPPORT_OVERLAY_PRIMITIVE_CODES], primitiveCodeHistogram: manifest.primitiveCodeHistogram };
}

function managedStageElementNodes(exportModel) { return exportModel?.root?.children?.[0]?.children?.[0]?.children || []; }
function managedStageSupportNodes(exportModel) { return exportModel?.root?.children?.[0]?.children?.[1]?.children || []; }
function primitiveDimensions(primitive) {
  if (primitive?.kind === 'cylinder') return { radiusMm: round(primitive.radius), lengthMm: round(primitive.length) };
  if (primitive?.kind === 'snout') return { radiusBottomMm: round(primitive.radiusBottom), radiusTopMm: round(primitive.radiusTop), heightMm: round(primitive.height), offsetX: round(primitive.offsetX), offsetY: round(primitive.offsetY) };
  if (primitive?.kind === 'sphere') return { diameterMm: round(primitive.diameter) };
  if (primitive?.kind === 'pyramid') return { bottomMm: (primitive.bottom || []).map(round), topMm: (primitive.top || []).map(round), heightMm: round(primitive.height) };
  if (primitive?.kind === 'elbow') return { bendRadiusMm: round(primitive.bendRadius), tubeRadiusMm: round(primitive.tubeRadius), sweepAngleRad: round(primitive.sweepAngleRad) };
  return {};
}
function primitivePlacement(primitive) { return { endpointLocked: Boolean(primitive?.endpointLocked), startMm: roundVector(primitive?.startMm), endMm: roundVector(primitive?.endMm), parentStartMm: roundVector(primitive?.parentStartMm), parentEndMm: roundVector(primitive?.parentEndMm), startOffsetMm: primitive?.startOffsetMm === undefined ? null : round(primitive.startOffsetMm), endOffsetMm: primitive?.endOffsetMm === undefined ? null : round(primitive.endOffsetMm), recipeSegmentIndex: primitive?.recipeSegmentIndex ?? null, recipeSegmentCount: primitive?.recipeSegmentCount ?? null, recipeSegmentStartDistanceMm: primitive?.recipeSegmentStartDistanceMm === undefined ? null : round(primitive.recipeSegmentStartDistanceMm), recipeSegmentEndDistanceMm: primitive?.recipeSegmentEndDistanceMm === undefined ? null : round(primitive.recipeSegmentEndDistanceMm), sphereSegmentSpanMm: primitive?.sphereSegmentSpanMm === undefined ? null : round(primitive.sphereSegmentSpanMm) }; }
function histogram(values) { return values.reduce((out, value) => { const key = Number(value); out[key] = (out[key] || 0) + 1; return out; }, {}); }
function roundVector(value) { return Array.isArray(value) ? value.map(round) : []; }
function round(value) { return Number(Number(value || 0).toFixed(6)); }
