const LOG_COPY_SCHEMA = 'LogCopyController.v1';

installLogCopyButton();

export function installLogCopyButton() {
  if (window.__3D_MARKUP_LOG_COPY__?.schema === LOG_COPY_SCHEMA) return window.__3D_MARKUP_LOG_COPY__;
  injectStyles();
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

function injectStyles() {
  if (document.getElementById('logCopyControllerStyles')) return;
  const style = document.createElement('style');
  style.id = 'logCopyControllerStyles';
  style.textContent = `
    .log-section-copy-ready { position: relative; }
    .log-section-copy-ready h3 { padding-right: 92px; }
    .log-copy-btn {
      position: absolute;
      top: 9px;
      right: 0;
      min-height: 27px;
      height: 27px;
      padding: 4px 8px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border-radius: 8px;
      font-size: 10px;
      line-height: 1;
      color: #dbeafe;
      border-color: rgba(83,125,176,.42);
      background: linear-gradient(180deg, rgba(22,45,75,.96), rgba(8,21,38,.96));
      z-index: 2;
    }
    .log-copy-btn .lucide { width: 13px; height: 13px; stroke-width: 2.2; }
    .log-copy-btn.copied { color: #8ff7c4; border-color: rgba(39,224,161,.6); }
  `;
  document.head.appendChild(style);
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
