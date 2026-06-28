const ELBOW_LOG_NOTICE_SCHEMA = 'ManagedStageElbowLogNotice.v1';

installManagedStageElbowLogNotice();

export function installManagedStageElbowLogNotice() {
  if (window.__3D_MARKUP_MANAGED_STAGE_ELBOW_LOG_NOTICE__?.schema === ELBOW_LOG_NOTICE_SCHEMA) return window.__3D_MARKUP_MANAGED_STAGE_ELBOW_LOG_NOTICE__;
  window.addEventListener('viewer:managed-stage-json-loaded', (event) => {
    const audit = event.detail?.audit || {};
    const histogram = audit.primitiveHistogram || {};
    const geometry = audit.rvmGeometryAudit?.geometry || {};
    const code4Count = Number(histogram[4] || geometry.code4Elbows?.count || 0);
    const visualMarkerCount = Number(geometry.primitiveRoleTagCounts?.bendCode4VisualMarker || 0);
    const sourceRouteCylinderCount = Number(geometry.primitiveRoleTagCounts?.bendSourceRouteCylinder || 0);
    log(`Managed-stage elbow visibility: code4=${code4Count}, visualMarkers=${visualMarkerCount}, sourceRouteBendCylinders=${sourceRouteCylinderCount}`);
  });
  const api = { schema: ELBOW_LOG_NOTICE_SCHEMA };
  window.__3D_MARKUP_MANAGED_STAGE_ELBOW_LOG_NOTICE__ = api;
  return api;
}

function log(message) {
  const logEl = document.getElementById('log');
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  if (logEl) logEl.textContent += `${line}\n`;
  else console.log(line);
}
