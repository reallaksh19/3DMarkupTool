initPropertyPanelRevampReset();

function initPropertyPanelRevampReset() {
  const boot = () => {
    const body = document.getElementById('propertiesBody');
    if (!body) return false;
    const observer = new MutationObserver(() => handlePanelMutation(body));
    observer.observe(body, { childList: true, subtree: false });
    handlePanelMutation(body);
    return true;
  };
  if (!boot()) document.addEventListener('DOMContentLoaded', boot, { once: true });
}

function handlePanelMutation(body) {
  if (body.classList.contains('empty-state')) {
    body.dataset.revamped = 'false';
    return;
  }

  const hasLegacyPanel = Boolean(body.querySelector('.selected-card'));
  const hasRevampedPanel = Boolean(body.querySelector('.revamp-panel'));
  if (!hasLegacyPanel || hasRevampedPanel || body.dataset.revampResetPending === 'true') return;

  body.dataset.revamped = 'false';
  body.dataset.revampResetPending = 'true';
  queueMicrotask(() => {
    body.dataset.revampResetPending = 'false';
    const marker = document.createComment('property-panel-revamp-refresh');
    body.appendChild(marker);
    marker.remove();
  });
}
