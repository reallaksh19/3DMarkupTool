const PRIMITIVE_CODE_BY_KIND = Object.freeze({ cylinder: 8, elbow: 4 });

export function buildManagedStageRvmStitchManifest(profile = {}, exportModel = {}, primitivePayloads = []) {
  const geometryRecords = profile.geometryRecords || [];
  const elementNodes = managedStageElementNodes(exportModel);
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
      if (expectedCode !== Number(decoded.code)) {
        issues.push(`primitive code mismatch for ${record.name}.${primitive.localName || primitiveIndex}: expected ${expectedCode}, got ${decoded.code}`);
      }
      return {
        index: primitiveIndex + 1,
        localName: primitive.localName || primitive.name || `PRIM_${primitiveIndex + 1}`,
        kind: primitive.kind,
        expectedCode,
        emittedCode: Number(decoded.code),
        bodyLength: decoded.bodyLength || 0,
        chunkOffset: decoded.offset ?? null,
        material: primitive.material ?? node.material ?? null,
        centerMm: roundVector(primitive.center),
        direction: roundVector(primitive.direction || [0, 0, 1]),
        dimensions: primitiveDimensions(primitive)
      };
    });

    return {
      index: index + 1,
      inputName: record.name,
      reviewName: node.reviewName || '',
      fromNode: record.attributes?.FROM_NODE || '',
      toNode: record.attributes?.TO_NODE || '',
      type: record.type || '',
      dtxr: record.attributes?.DTXR || '',
      material: node.material ?? null,
      primitiveCount: primitives.length,
      primitiveCodes: primitives.map((primitive) => primitive.emittedCode),
      primitives
    };
  });

  const supportOverlayPrimitives = primitivePayloads.slice(primitiveCursor).map((decoded, index) => ({
    index: index + 1,
    emittedCode: Number(decoded.code),
    bodyLength: decoded.bodyLength || 0,
    chunkOffset: decoded.offset ?? null
  }));
  const supportOverlayPrimitiveCodes = supportOverlayPrimitives.map((primitive) => primitive.emittedCode);
  const geometryPrimitiveCodes = elements.flatMap((element) => element.primitiveCodes);
  const primitiveCodeHistogram = histogram([...geometryPrimitiveCodes, ...supportOverlayPrimitiveCodes]);
  return {
    schema: 'ManagedStageRvmStitchManifest.v1',
    stitchStrategy: 'single RVM stream assembled from ordered managed-stage piping element CNTB nodes plus optional support overlay CNTB nodes',
    elementCount: elements.length,
    exportElementNodeCount: elementNodes.length,
    primitiveCount: elements.reduce((sum, element) => sum + element.primitiveCount, 0) + supportOverlayPrimitives.length,
    geometryPrimitiveCount: elements.reduce((sum, element) => sum + element.primitiveCount, 0),
    supportOverlayPrimitiveCount: supportOverlayPrimitives.length,
    decodedPrimitiveCount: primitivePayloads.length,
    primitiveCodeHistogram,
    allElementsMapped: issues.length === 0 && elements.length === elementNodes.length,
    elementOrderStable: issues.filter((issue) => issue.includes('element order mismatch')).length === 0,
    issues,
    supportOverlayPrimitives,
    elements
  };
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
    for (const primitive of element.primitives || []) {
      if (primitive.expectedCode !== primitive.emittedCode) issues.push(`element ${element.index} primitive ${primitive.index} code mismatch`);
    }
  }
  for (const primitive of manifest.supportOverlayPrimitives || []) {
    if (primitive.emittedCode !== 8) issues.push(`support overlay primitive ${primitive.index} code mismatch: expected 8, got ${primitive.emittedCode}`);
  }
  if (issues.length) throw new Error(`Managed-stage RVM stitch manifest failed: ${issues.join('; ')}`);
  return {
    schema: 'ManagedStageRvmStitchManifestGate.v1',
    ok: true,
    elementCount: manifest.elementCount,
    primitiveCount: manifest.primitiveCount,
    supportOverlayPrimitiveCount: manifest.supportOverlayPrimitiveCount || 0,
    primitiveCodeHistogram: manifest.primitiveCodeHistogram
  };
}

function managedStageElementNodes(exportModel) {
  return exportModel?.root?.children?.[0]?.children?.[0]?.children || [];
}

function primitiveDimensions(primitive) {
  if (primitive.kind === 'cylinder') {
    return { radiusMm: round(primitive.radius), lengthMm: round(primitive.length) };
  }
  if (primitive.kind === 'elbow') {
    return { bendRadiusMm: round(primitive.bendRadius), tubeRadiusMm: round(primitive.tubeRadius), sweepAngleRad: round(primitive.sweepAngleRad) };
  }
  return {};
}

function histogram(values) {
  return values.reduce((out, value) => {
    const key = Number(value);
    out[key] = (out[key] || 0) + 1;
    return out;
  }, {});
}

function roundVector(value) {
  return Array.isArray(value) ? value.map(round) : [];
}

function round(value) {
  return Number(Number(value).toFixed(6));
}
