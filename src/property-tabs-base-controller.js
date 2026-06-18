const TAB_ORDER = [
  { id: 'common', label: 'Common' },
  { id: 'geometry', label: 'Geometry' },
  { id: 'support', label: 'Support' },
  { id: 'raw', label: 'Raw' }
];

const EMPTY_MESSAGES = {
  common: 'No common identity fields for this object.',
  geometry: 'No geometry or process fields for this object.',
  support: 'No support-specific fields for this object.',
  raw: 'No raw metadata section available.'
};

const state = {
  scheduled: false,
  activeTab: 'common'
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initPropertyTabs, { once: true });
} else {
  initPropertyTabs();
}

function initPropertyTabs() {
  injectStyles();
  const body = getBody();
  if (!body) return;

  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(body, { childList: true, subtree: false });
  body.addEventListener('click', onTabClick);
  scheduleEnhance();
}

function getBody() {
  return document.getElementById('propertiesBody');
}

function scheduleEnhance() {
  if (state.scheduled) return;
  state.scheduled = true;
  window.requestAnimationFrame(() => {
    state.scheduled = false;
    enhanceProperties();
  });
}\n
function enhanceProperties() {
  const body = getBody();
  if (!body || body.dataset.propertyTabsProcessing === 'true') return;
  if (body.classList.contains('empty-state')) {
    body.classList.remove('property-tabs-enhanced');
    return;
  }
  if (body.querySelector(':scope > .property-tabs-shell')) return;

  const selectedCard = body.querySelector(':scope > .selected-card');
  const sections = Array.from(body.querySelectorAll(':scope > .prop-section'));
  if (!selectedCard && sections.length === 0) return;

  body.dataset.propertyTabsProcessing = 'true';
  body.classList.add('property-tabs-enhanced');

  const buckets = createBuckets();
  if (selectedCard) buckets.common.appendChild(selectedCard);

  sections.forEach((section) => {
    const tabId = classifySection(section);
    buckets[tabId].appendChild(section);
  });

  const activeTab = pickActiveTab(buckets);
  state.activeTab = activeTab;

  const shell = document.createElement('div');
  shell.className = 'property-tabs-shell';
  shell.innerHTML = `
    <div class="property-tabs-nav" role="tablist" aria-label="Property categories"></div>
    <div class="property-tabs-panels"></div>
  `;

  const nav = shell.querySelector('.property-tabs-nav');
  const panels = shell.querySelector('.property-tabs-panels');

  TAB_ORDER.forEach(({ id, label }) => {
    const count = countMeaningfulChildren(buckets[id]);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'property-tab-btn';
    button.dataset.propertyTab = id;
    button.role = 'tab';
    button.ariaSelected = String(id === activeTab);
    button.disabled = count === 0;
    button.innerHTML = `<span>${label}</span><em>${count}</em>`;
    nav.appendChild(button);

    const panel = document.createElement('section');
    panel.className = 'property-tab-panel';
    panel.dataset.propertyPanel = id;
    panel.role = 'tabpanel';
    panel.hidden = id !== activeTab;

    if (count === 0) {
      const empty = document.createElement('div');
      empty.className = 'property-tab-empty';
      empty.textContent = EMPTY_MESSAGES[id];
      panel.appendChild(empty);
    } else {
      panel.appendChild(buckets[id]);
    }
    panels.appendChild(panel);
  });

  body.appendChild(shell);
  body.dataset.propertyTabsProcessing = 'false';
}

function createBuckets() {
  return TAB_ORDER.reduce((acc, { id }) => {
    const node = document.createElement('div');
    node.className = `property-tab-bucket property-tab-bucket-${id}`;
    acc[id] = node;
    return acc;
  }, {});
}

function classifySection(section) {
  const title = section.querySelector('summary')?.textContent?.trim() || '';
  const normalized = title.toLowerCase();

  if (/raw/.test(normalized)) return 'raw';
  if (/support|restraint|isonote/.test(normalized)) return 'support';
  if (/component|geometry|process|analysis|bore|wall|bend|material|pressure|temp/.test(normalized)) return 'geometry';
  return 'common';
}

function pickActiveTab(buckets) {
  if (state.activeTab && countMeaningfulChildren(buckets[state.activeTab]) > 0) return state.activeTab;
  const first = TAB_ORDER.find(({ id }) => countMeaningfulChildren(buckets[id]) > 0);
  return first?.id || 'common';
}

function countMeaningfulChildren(node) {
  return Array.from(node.children).filter((child) => !child.classList.contains('property-tab-empty')).length;
}

function onTabClick(event) {
  const button = event.target.closest?.('[data-property-tab]');
  if (!button || button.disabled) return;
  const body = getBody();
  const shell = body?.querySelector(':scope > .property-tabs-shell');
  if (!shell) return;

  const tab = button.dataset.propertyTab;
  state.activeTab = tab;

  shell.querySelectorAll('.property-tab-btn').forEach((btn) => {
    const isActive = btn.dataset.propertyTab === tab;
    btn.classList.toggle('active', isActive);
    btn.ariaSelected = String(isActive);
  });

  shell.querySelectorAll('.property-tab-panel').forEach((panel) => {
    panel.hidden = panel.dataset.propertyPanel !== tab;
  });
}

function injectStyles() {
  if (document.getElementById('propertyTabsControllerStyles')) return;
  const style = document.createElement('style');
  style.id = 'propertyTabsControllerStyles';
  style.textContent = `
    .properties-body.property-tabs-enhanced {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .property-tabs-shell {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 0;
    }

    .property-tabs-nav {
      position: sticky;
      top: -14px;
      z-index: 2;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
      padding: 8px 0;
      background: linear-gradient(180deg, rgba(15, 27, 42, .98), rgba(15, 27, 42, .88));
      backdrop-filter: blur(10px);
    }

    .property-tab-btn {
      min-width: 0;
      min-height: 32px;
      padding: 6px 6px;
      border-radius: 9px;
      background: rgba(18, 35, 58, .94);
      border: 1px solid rgba(73, 104, 136, .86);
      color: #d9e8f7;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .1px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }

    .property-tab-btn.active,
    .property-tab-btn[aria-selected="true"] {
      background: rgba(90, 67, 44, .98);
      border-color: rgba(247, 183, 92, .96);
      color: #fff0cf;
    }

    .property-tab-btn:disabled {
      opacity: .38;
      cursor: not-allowed;
    }

    .property-tab-btn em {
      min-width: 16px;
      padding: 1px 4px;
      border-radius: 999px;
      background: rgba(101, 213, 255, .14);
      border: 1px solid rgba(101, 213, 255, .25);
      color: #b9eaff;
      font-style: normal;
      font-size: 9px;
      line-height: 1.35;
    }

    .property-tab-btn.active em,
    .property-tab-btn[aria-selected="true"] em {
      background: rgba(255, 240, 207, .16);
      border-color: rgba(255, 240, 207, .35);
      color: #fff6df;
    }

    .property-tabs-panels {
      min-height: 0;
    }

    .property-tab-panel[hidden] {
      display: none !important;
    }

    .property-tab-bucket {
      display: grid;
      gap: 10px;
    }

    .property-tab-bucket .selected-card {
      margin-bottom: 0;
    }

    .property-tab-bucket .prop-section {
      margin: 0;
    }

    .property-tab-empty {
      border: 1px dashed rgba(101, 213, 255, .24);
      border-radius: 10px;
      padding: 12px;
      color: #b9c9da;
      background: rgba(8, 18, 31, .42);
      font-size: 12px;
      line-height: 1.35;
    }

    @media (max-width: 940px) {
      .property-tabs-nav {
        top: 0;
      }
    }
  `;
  document.head.appendChild(style);
}
