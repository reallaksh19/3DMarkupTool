import * as THREE from 'three';
import { mat } from './geometry.js?v=professional-viewer-3';
import { createManagedStageSupportPreviewObject } from './managed-stage-support-visual-resolver.js';

export const MANAGED_STAGE_TOPOLOGY_SUPPORT_GATE_SCHEMA = 'ManagedStageTopologySupportGate.v1';

const WARNING_COLOR = 0xff8c73;
const EPS_MM = 0.001;

export function createTopologyGatedManagedStageSupportPreviewObject(record, options = {}) {
  const gate = resolveManagedStageSupportTopologyGate(record, options.topologyAudit);
  if (gate.status === 'blocked') {
    return {
      object: createBlockedSupportMarker(record, gate, options),
      supportVisual: {
        schema: MANAGED_STAGE_TOPOLOGY_SUPPORT_GATE_SCHEMA,
        family: 'TOPOLOGY_BLOCKED_SUPPORT',
        popupRequired: true,
        popupReason: gate.reason,
        topologyGate: gate,
        previewPrimitiveBudgetCount: 1,
        previewPrimitiveBudgetLimit: 1,
        previewPrimitiveBudgetPass: true
      },
      supportTopologyGate: gate
    };
  }

  const result = createManagedStageSupportPreviewObject(record, options);
  if (!result?.object) return { ...result, supportTopologyGate: gate };
  stampTopologyGate(result.object, gate);
  result.supportVisual = {
    ...(result.supportVisual || {}),
    topologyGate: gate,
    topologyAssociationOnly: gate.associationOnly,
    topologySupportAnchorId: gate.supportAnchorId,
    topologySupportComponentId: gate.componentId,
    topologySupportSegmentId: gate.segmentId,
    topologySupportContinuityEdgesBlocked: gate.supportContinuityEdgeCount === 0
  };
  result.supportTopologyGate = gate;
  return result;
}

export function resolveManagedStageSupportTopologyGate(record, topologyAudit) {
  const supportName = supportRecordName(record);
  const base = {
    schema: MANAGED_STAGE_TOPOLOGY_SUPPORT_GATE_SCHEMA,
    supportName,
    supportNode: String(record?.attrs?.NODE || record?.attributes?.NODE || record?.fromNode || record?.toNode || ''),
    status: 'not-run',
    reason: 'topology audit not provided',
    componentId: '',
    supportId: '',
    supportAnchorId: '',
    segmentId: '',
    associationOnly: false,
    supportContinuityEdgeCount: null,
    supportInlineFaceCount: null,
    topologyReady: false
  };

  if (!topologyAudit) return base;

  const supportContinuityEdgeCount = Number(topologyAudit.summary?.supportContinuityEdgeCount || 0);
  const supportInlineFaceCount = Number(topologyAudit.faceModel?.summary?.supportInlineFaceCount || 0);
  base.supportContinuityEdgeCount = supportContinuityEdgeCount;
  base.supportInlineFaceCount = supportInlineFaceCount;
  base.topologyReady = topologyAudit.validation?.ready === true;

  if (supportContinuityEdgeCount > 0 || supportInlineFaceCount > 0) {
    return {
      ...base,
      status: 'blocked',
      reason: 'topology audit reports support pipe-continuity edges or inline support faces'
    };
  }

  const doc = topologyAudit.topologyDocument;
  if (!doc) return { ...base, status: 'blocked', reason: 'topology audit has no topology document' };

  const component = findSupportComponent(doc, record);
  if (!component) {
    return { ...base, status: 'blocked', reason: 'support record is not present in topology document' };
  }

  const support = (doc.supports || []).find((item) => item.componentId === component.id) || null;
  const anchor = (doc.anchors || []).find((item) => item.id === support?.supportAnchorId || item.componentId === component.id && item.role === 'SUPPORT_POINT') || null;
  const port = (doc.ports || []).find((item) => item.anchorId === anchor?.id) || null;
  const segment = (doc.segments || []).find((item) => item.componentId === component.id && item.type === 'SUPPORT_ASSOCIATION') || null;
  const associationOnly = component.normalizedType === 'SUPPORT' && port?.connectsTo === 'SEGMENT' && segment?.type === 'SUPPORT_ASSOCIATION';

  if (!associationOnly) {
    return {
      ...base,
      status: 'blocked',
      reason: 'support topology is not association-only',
      componentId: component.id,
      supportId: support?.id || '',
      supportAnchorId: anchor?.id || '',
      segmentId: segment?.id || '',
      associationOnly: false
    };
  }

  return {
    ...base,
    status: 'ok',
    reason: 'support is association-only in topology document; symbol preview may be generated',
    componentId: component.id,
    supportId: support?.id || '',
    supportAnchorId: anchor?.id || '',
    segmentId: segment?.id || '',
    associationOnly: true,
    supportPointMm: clonePoint(anchor?.point),
    portConnectsTo: port?.connectsTo || '',
    segmentType: segment?.type || ''
  };
}

export function summarizeManagedStageSupportTopologyGates(gates = []) {
  const list = gates.filter(Boolean);
  return {
    schema: 'ManagedStageSupportTopologyGateSummary.v1',
    supportGateCount: list.length,
    okCount: list.filter((gate) => gate.status === 'ok').length,
    blockedCount: list.filter((gate) => gate.status === 'blocked').length,
    associationOnlyCount: list.filter((gate) => gate.associationOnly === true).length,
    missingTopologyAuditCount: list.filter((gate) => gate.status === 'not-run').length,
    supportContinuityEdgeCount: Math.max(0, ...list.map((gate) => Number(gate.supportContinuityEdgeCount || 0))),
    supportInlineFaceCount: Math.max(0, ...list.map((gate) => Number(gate.supportInlineFaceCount || 0))),
    pass: list.length > 0 && list.every((gate) => gate.status === 'ok' && gate.associationOnly === true && Number(gate.supportContinuityEdgeCount || 0) === 0 && Number(gate.supportInlineFaceCount || 0) === 0)
  };
}

function createBlockedSupportMarker(record, gate, options = {}) {
  const pos = supportPosition(record) || { x: 0, y: 0, z: 0 };
  const radius = Math.max(Number(options.pointRadius || 12), 8);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), mat(WARNING_COLOR, { transparent: true, opacity: 0.92 }));
  mesh.name = `MANAGED_STAGE_SUPPORT_TOPOLOGY_BLOCKED_${safeName(supportRecordName(record))}`;
  mesh.position.set(Number(pos.x) || 0, Number(pos.y) || 0, Number(pos.z) || 0);
  mesh.userData = {
    TYPE: 'MANAGED_STAGE_SUPPORT_RESTRAINT_PREVIEW',
    primitiveKind: 'managed-stage-support-topology-blocked-marker',
    managedStageSupportVisual: true,
    previewOnly: true,
    exportedRvmGeometry: false,
    popupRequired: true,
    supportTopologyGate: gate,
    supportTopologyGateStatus: gate.status,
    supportTopologyAssociationOnly: false,
    supportContinuityEdgeBlocked: true,
    coordinatePolicy: 'support glyph generation blocked because topology gate did not prove SUPPORT_ASSOCIATION-only behavior'
  };
  mesh.raycast = noopRaycast;
  return mesh;
}

function stampTopologyGate(root, gate) {
  root.userData = {
    ...(root.userData || {}),
    supportTopologyGate: gate,
    supportTopologyGateStatus: gate.status,
    supportTopologyAssociationOnly: gate.associationOnly === true,
    supportTopologySupportComponentId: gate.componentId,
    supportTopologySupportAnchorId: gate.supportAnchorId,
    supportTopologySupportSegmentId: gate.segmentId,
    supportContinuityEdgeBlocked: Number(gate.supportContinuityEdgeCount || 0) === 0,
    supportInlineFaceBlocked: Number(gate.supportInlineFaceCount || 0) === 0,
    coordinatePolicy: 'topology-gated support symbol; support is association-only and excluded from pipe continuity before preview glyph creation'
  };
  root.traverse?.((object) => {
    object.userData = {
      ...(object.userData || {}),
      supportTopologyGateStatus: gate.status,
      supportTopologyAssociationOnly: gate.associationOnly === true,
      supportContinuityEdgeBlocked: Number(gate.supportContinuityEdgeCount || 0) === 0,
      supportInlineFaceBlocked: Number(gate.supportInlineFaceCount || 0) === 0
    };
  });
}

function findSupportComponent(doc, record) {
  const wanted = candidateNames(record);
  return (doc.components || []).find((component) => {
    if (component.normalizedType !== 'SUPPORT') return false;
    const attrs = component.rawAttributes || {};
    const values = candidateNames({ name: component.name, rawName: component.name, attrs, attributes: attrs });
    return [...wanted].some((value) => values.has(value));
  }) || null;
}

function candidateNames(record) {
  const attrs = record?.attrs || record?.attributes || {};
  return new Set([
    record?.name,
    record?.rawName,
    attrs.SOURCE_RESTRAINT_ID,
    attrs.REF,
    attrs.NAME,
    attrs.SKEY,
    attrs.NODE ? `NODE_${attrs.NODE}` : ''
  ].map((value) => normalize(value)).filter(Boolean));
}

function supportRecordName(record) {
  const attrs = record?.attrs || record?.attributes || {};
  return attrs.NAME || attrs.SOURCE_RESTRAINT_ID || attrs.REF || record?.name || record?.rawName || 'SUPPORT';
}

function supportPosition(record) {
  return record?.source?.supportCoord || record?.source?.pos || record?.source?.bpos || record?.source?.apos || record?.source?.lpos;
}

function clonePoint(point) {
  if (!point) return null;
  return { x: Number(point.x) || 0, y: Number(point.y) || 0, z: Number(point.z) || 0 };
}

function normalize(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function safeName(value) {
  return String(value || 'SUPPORT').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '') || 'SUPPORT';
}

function noopRaycast() {}
