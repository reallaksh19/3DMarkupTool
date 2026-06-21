const EPS_MM = 1e-6;

export function applyManagedStageInputXmlBendEndpointLock(contracts = [], config = {}) {
  const byName = new Map(contracts.map((contract) => [contract?.name, contract]).filter(([name]) => name));
  const applications = [];
  const adjusted = contracts.map((contract) => {
    if (contract?.dtxr !== 'BEND' || !Array.isArray(contract.genericInputXmlBend?.segments)) return contract;
    const locked = lockBendContractToTrimmedSources(contract, byName);
    if (locked.application) applications.push(locked.application);
    return locked.contract;
  });

  return {
    contracts: adjusted,
    audit: {
      schema: 'ManagedStageInputXmlBendEndpointLockAudit.v1',
      enabled: Boolean(config.excludeBendsWhileProcessingInputXmlBasedJson),
      lockPolicy: 'generic InputXML bend code-8 segment endpoints are rebuilt from final trimmed source-contract endpoints, not from pre-cap 1.5D assumptions',
      checkedBendCount: contracts.filter((contract) => contract?.dtxr === 'BEND').length,
      lockedBendCount: applications.length,
      cappedEndpointCorrectionCount: applications.filter((entry) => entry.correctedForCappedTrim).length,
      applications,
      ok: true
    }
  };
}

export function assertManagedStageInputXmlBendEndpointLockAudit(audit = {}) {
  if (audit.schema !== 'ManagedStageInputXmlBendEndpointLockAudit.v1') throw new Error('Invalid InputXML bend endpoint-lock audit schema');
  if (audit.enabled && audit.ok !== true) throw new Error('InputXML bend endpoint-lock audit failed');
  return true;
}

function lockBendContractToTrimmedSources(bend, byName) {
  const meta = bend.genericInputXmlBend || {};
  const segments = Array.isArray(meta.segments) ? meta.segments : [];
  if (!segments.length) return { contract: bend, application: null };
  const node = String(meta.reconstructionNode || '');
  const corner = nodePointForContract(bend, node);
  if (!node || !corner) return { contract: bend, application: null };

  const originalPoints = pointsFromSegments(segments);
  if (originalPoints.length < 2) return { contract: bend, application: null };

  let startPoint = originalPoints[0];
  let endPoint = originalPoints[originalPoints.length - 1];
  const endpointLocks = [];

  const incomingSourceName = meta.incomingSource && meta.incomingSource !== bend.name ? meta.incomingSource : '';
  const outgoingSourceName = meta.outgoingSource && meta.outgoingSource !== bend.name ? meta.outgoingSource : '';

  const incoming = renderedEndpointForTrimmedSource(byName.get(incomingSourceName), node);
  if (incoming) {
    startPoint = incoming.point;
    endpointLocks.push({ role: 'incoming', sourceName: incomingSourceName, side: incoming.side, trimMm: incoming.trimMm, pointMm: incoming.point });
  }

  const outgoing = renderedEndpointForTrimmedSource(byName.get(outgoingSourceName), node);
  if (outgoing) {
    endPoint = outgoing.point;
    endpointLocks.push({ role: 'outgoing', sourceName: outgoingSourceName, side: outgoing.side, trimMm: outgoing.trimMm, pointMm: outgoing.point });
  }

  if (!endpointLocks.length) return { contract: bend, application: null };

  const rebuiltPoints = quadraticCornerCurve(startPoint, corner, endPoint, segments.length);
  const rebuiltSegments = segments.map((segment, index) => {
    const startMm = rebuiltPoints[index];
    const endMm = rebuiltPoints[index + 1];
    return {
      ...segment,
      startMm: startMm.map(round),
      endMm: endMm.map(round),
      lengthMm: round(distance(startMm, endMm)),
      endpointLockedToTrimmedSource: true
    };
  }).filter((segment) => segment.lengthMm > EPS_MM);

  const originalEnd = originalPoints[originalPoints.length - 1];
  const correctedForCappedTrim = Boolean(outgoing && distance(originalEnd, outgoing.point) > EPS_MM);
  const application = {
    bendName: bend.name,
    reconstructionNode: node,
    incomingSource: incomingSourceName || bend.name,
    outgoingSource: outgoingSourceName || '',
    endpointLocks: endpointLocks.map((entry) => ({
      ...entry,
      pointMm: entry.pointMm.map(round)
    })),
    correctedForCappedTrim,
    originalOutgoingEndpointMm: originalEnd.map(round),
    lockedOutgoingEndpointMm: endPoint.map(round),
    outgoingEndpointDeltaMm: round(distance(originalEnd, endPoint))
  };

  return {
    contract: {
      ...bend,
      genericInputXmlBend: {
        ...meta,
        schema: meta.schema || 'ManagedStageInputXmlGenericBend.v4',
        endpointLockPolicy: 'segments rebuilt after source trim caps; final segment endpoint equals trimmed adjacent source endpoint',
        endpointLocks: application.endpointLocks,
        correctedForCappedTrim,
        segments: rebuiltSegments
      }
    },
    application
  };
}

function renderedEndpointForTrimmedSource(source, node) {
  if (!source || !Array.isArray(source.axis)) return null;
  const axis = unitOrNull(source.axis);
  if (!axis) return null;
  if (String(source.fromNode) === String(node)) {
    const trimMm = Number(source.rvmTrimStartOffsetMm || 0);
    if (!(trimMm > EPS_MM)) return null;
    return { side: 'start', trimMm: round(trimMm), point: pointAlong(source.startMm, axis, trimMm) };
  }
  if (String(source.toNode) === String(node)) {
    const trimMm = Number(source.rvmTrimEndOffsetMm || 0);
    if (!(trimMm > EPS_MM)) return null;
    return { side: 'end', trimMm: round(trimMm), point: pointAlong(source.endMm, axis, -trimMm) };
  }
  return null;
}

function pointsFromSegments(segments) {
  if (!segments.length) return [];
  const out = [vector3OrNull(segments[0].startMm)].filter(Boolean);
  for (const segment of segments) {
    const end = vector3OrNull(segment.endMm);
    if (end) out.push(end);
  }
  return out;
}

function quadraticCornerCurve(start, corner, end, segmentCount) {
  const points = [];
  for (let index = 0; index <= segmentCount; index += 1) {
    const t = index / segmentCount;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    points.push([
      a * start[0] + b * corner[0] + c * end[0],
      a * start[1] + b * corner[1] + c * end[1],
      a * start[2] + b * corner[2] + c * end[2]
    ]);
  }
  return points;
}

function nodePointForContract(contract, node) {
  if (String(contract?.fromNode) === String(node)) return vector3OrNull(contract.startMm);
  if (String(contract?.toNode) === String(node)) return vector3OrNull(contract.endMm);
  return null;
}

function vector3OrNull(value) {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const vector = value.map(Number);
  return vector.some((entry) => !Number.isFinite(entry)) ? null : vector;
}

function unitOrNull(vector) {
  const v = vector3OrNull(vector);
  if (!v) return null;
  const len = Math.hypot(v[0], v[1], v[2]);
  if (!(len > EPS_MM)) return null;
  return v.map((value) => value / len);
}

function pointAlong(start, axis, distanceMm) {
  return [
    start[0] + axis[0] * distanceMm,
    start[1] + axis[1] * distanceMm,
    start[2] + axis[2] * distanceMm
  ];
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function round(value) {
  return Number(Number(value).toFixed(6));
}
