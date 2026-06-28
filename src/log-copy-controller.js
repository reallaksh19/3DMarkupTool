const LOG_COPY_SCHEMA = 'LogCopyController.v1';

installLogCopyButton();

export function installLogCopyButton() {
  if (window.__3D_MARKUP_LOG_COPY__?.schema === LOG_COPY_SCHEMA) return window.__3D_MARKUP_LOG_COPY__;
  const log = document.getElementById('log');
  const section = log?.closest('.log-section');
  if (!log || !section) return null;
  section.classList.add('log-section-copy-ready');
  let button = document.getElementById('copyLogBtn');
  if (!button) {
    button = document.createElement('button');
    button.id = 'copyLogBtn';
    button.type = 'button';
    button.className = 'log-copy-btn';
    button.title = 'Copy log to clipboard';
    button.setAttribute('aria-label', 'Copy log to clipboard');
    button.innerHTML = '<i data-lucide="copy"></i><span>Copy</span>';
    section.appendChild(button);
  }
  button.addEventListener('click', async () => {
    const text = log.textContent || '';
    try {
      await navigator.clipboard.writeText(text);
      flash(button, 'Copied');
    } catch (_) {
      fallbackCopy(text);
      flash(button, 'Copied');
    }
  });
  hydrateIcons();
  const api = { schema: LOG_COPY_SCHEMA, copy: () => navigator.clipboard?.writeText(log.textContent || '') };
  window.__3D_MARKUP_LOG_COPY__ = api;
  return api;
}

function fallbackCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', 'true');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

function flash(button, label) {
  const old = button.querySelector('span')?.textContent || 'Copy';
  const span = button.querySelector('span');
  if (span) span.textContent = label;
  button.classList.add('copied');
  window.setTimeout(() => {
    if (span) span.textContent = old;
    button.classList.remove('copied');
  }, 1200);
}

function hydrateIcons() {
  try { window.lucide?.createIcons?.(); } catch (_) { /* optional */ }
}
