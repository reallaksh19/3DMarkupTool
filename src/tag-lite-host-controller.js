const TAG_GROUP_ID = 'tagLiteHostGroup';

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initTagLiteHost, { once: true });
} else {
  initTagLiteHost();
}

function initTagLiteHost() {
  ensureStyles();
  ensureTagGroup();
}

function ensureTagGroup() {
  let group = document.querySelector('.navis-tag-tools');
  if (group) {
    group.id ||= TAG_GROUP_ID;
    group.classList.add('tag-lite-host');
    group.setAttribute('aria-label', group.getAttribute('aria-label') || 'Tag XML tools');
    return group;
  }

  const toolbar = document.querySelector('.toolbar');
  if (!toolbar) {
    window.setTimeout(ensureTagGroup, 250);
    return null;
  }

  group = document.createElement('div');
  group.id = TAG_GROUP_ID;
  group.className = 'toolbar-group navis-tag-tools tag-lite-host';
  group.setAttribute('aria-label', 'Tag XML tools');
  group.title = 'Tag XML import and viewpoint list';

  const rvmQa = document.getElementById('rvmCompatBtn')?.closest('.toolbar-group');
  const outputGroup = document.querySelector('.toolbar-group[aria-label="Output preview"]');
  const anchor = rvmQa || outputGroup;
  if (anchor?.nextSibling) {
    toolbar.insertBefore(group, anchor.nextSibling);
  } else {
    toolbar.appendChild(group);
  }

  return group;
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
    .tag-lite-host #navisImportTagsBtn::before { content: '⭳ '; }
    .tag-lite-host #navisTagViewsBtn::before { content: '☰ '; }
  `;
  document.head.appendChild(style);
}
