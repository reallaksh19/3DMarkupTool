const TAG_GROUP_ID = 'tagLiteHostGroup';

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initTagLiteHost, { once: true });
} else {
  initTagLiteHost();
}

function initTagLiteHost() {
  ensureStyles();
  const group = ensureTagGroup();
  ensureLiteActionButtons(group);
}

function ensureTagGroup() {
  let group = document.querySelector('.navis-tag-tools');
  if (group) {
    group.id ||= TAG_GROUP_ID;
    group.classList.add('tag-lite-host');
    group.setAttribute('aria-label', group.getAttribute('aria-label') || 'Tag XML tools');
    ensureLiteActionButtons(group);
    return group;
  }

  const toolbar = document.querySelector('.toolbar');
  if (!toolbar) {
    window.setTimeout(initTagLiteHost, 250);
    return null;
  }

  group = document.createElement('div');
  group.id = TAG_GROUP_ID;
  group.className = 'toolbar-group navis-tag-tools tag-lite-host';
  group.setAttribute('aria-label', 'Tag XML tools');
  group.title = 'Tag XML import, viewpoint list, ISONOTE conversion, manual tag, and XML export';

  const rvmQa = document.getElementById('rvmCompatBtn')?.closest('.toolbar-group');
  const outputGroup = document.querySelector('.toolbar-group[aria-label="Output preview"]');
  const anchor = rvmQa || outputGroup;
  if (anchor?.nextSibling) {
    toolbar.insertBefore(group, anchor.nextSibling);
  } else {
    toolbar.appendChild(group);
  }

  ensureLiteActionButtons(group);
  return group;
}

function ensureLiteActionButtons(group) {
  if (!group) return;

  // Batch 5C exposes manual leader tagging through a separate guarded safe controller.
  if (!document.getElementById('navisTagBtn')) {
    const btn = document.createElement('button');
    btn.id = 'navisTagBtn';
    btn.type = 'button';
    btn.className = 'tool-btn';
    btn.title = 'Manual leader annotation: click leader point, then annotation box location';
    btn.textContent = 'Tag';
    group.appendChild(btn);
  }

  if (!document.getElementById('navisIsonoteBtn')) {
    const btn = document.createElement('button');
    btn.id = 'navisIsonoteBtn';
    btn.type = 'button';
    btn.className = 'tool-btn';
    btn.title = 'Prepare sideloaded ISONOTE boards as Navis XML tag viewpoints';
    btn.textContent = 'ISONOTE XML';
    group.appendChild(btn);
    btn.addEventListener('click', () => {
      window.setTimeout(() => {
        document.getElementById('navisTagViewsBtn')?.click();
      }, 80);
    });
  }

  if (!document.getElementById('navisExportTagsBtn')) {
    const btn = document.createElement('button');
    btn.id = 'navisExportTagsBtn';
    btn.type = 'button';
    btn.className = 'tool-btn accent';
    btn.title = 'Export imported, ISONOTE, and manual tag viewpoints to Navis XML';
    btn.textContent = 'Export XML';
    group.appendChild(btn);
  }
}

function ensureStyles() {
  if (document.getElementById('tagLiteHostStyles')) return;
  const style = document.createElement('style');
  style.id = 'tagLiteHostStyles';
  style.textContent = `
    .tag-lite-host:empty::before {
      content: 'Tags…';
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px dashed rgba(125, 172, 222, .25);
      color: #a7bdd4;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .02em;
    }
    .tag-lite-host .tool-btn {
      min-width: 0;
      white-space: nowrap;
    }
    .tag-lite-host #navisTagBtn::before { content: '↗ '; }
    .tag-lite-host #navisImportTagsBtn::before { content: '⭳ '; }
    .tag-lite-host #navisTagViewsBtn::before { content: '☰ '; }
    .tag-lite-host #navisIsonoteBtn::before { content: '⌖ '; }
    .tag-lite-host #navisExportTagsBtn::before { content: '⇩ '; }
  `;
  document.head.appendChild(style);
}
