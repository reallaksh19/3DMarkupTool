const ROOT_REVIEW_NAME = '/INPUTXML';

const TOP_LEVEL_REVIEW_NAMES = {
  PLANT_GEOMETRY: '/INPUTXML-PI',
  SUPPORTS_RESTRAINTS: '/INPUTXML-SU',
  ANNOTATIONS: '/INPUTXML-AN'
};

/**
 * Adds writer-facing Review/RHBG-style node names without changing stable internal node keys.
 * Parameters: renderer-neutral export model after catalogue parity wiring and internal safe-name normalization.
 * Output: same export model with node.reviewName plus ATT-visible REVIEW_NAME / REVIEW_PATH attributes.
 * Fallback: unknown nodes keep deterministic label-of-zone names under their parent container.
 */
export function applyReviewStyleNodeNames(exportModel, options = {}) {
  if (!exportModel || typeof exportModel !== 'object' || !exportModel.root) return exportModel;

  const rootName = toReviewNodeName(options.rootName || ROOT_REVIEW_NAME, ROOT_REVIEW_NAME);
  const seen = new Map();
  const siblingCounters = new Map();

  stampNode(exportModel.root, {
    depth: 0,
    parentReviewName: '',
    rootName,
    seen,
    siblingCounters
  });

  exportModel.audit = {
    ...(exportModel.audit || {}),
    reviewStyleNodeNames: true,
    reviewStyleNodeNameSchema: 'rvm-review-node-names/v1',
    reviewStyleRootName: exportModel.root.reviewName || rootName
  };

  return exportModel;
}

function stampNode(node, context) {
  if (!node || typeof node !== 'object') return;

  const reviewName = uniqueReviewName(resolveReviewName(node, context), context.seen);
  node.reviewName = reviewName;
  node.attributes = {
    ...(node.attributes || {}),
    REVIEW_NAME: reviewName,
    REVIEW_PATH: reviewName
  };

  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    stampNode(child, {
      depth: context.depth + 1,
      parentReviewName: reviewName,
      rootName: context.rootName,
      seen: context.seen,
      siblingCounters: context.siblingCounters
    });
  }
}

function resolveReviewName(node, context) {
  if (context.depth === 0) return context.rootName;

  if (context.depth === 1) {
    const known = TOP_LEVEL_REVIEW_NAMES[node.name];
    if (known) return known;
    return `/${toReviewToken(node.name, 'GROUP')}`;
  }

  const label = reviewLabel(node);
  const parent = context.parentReviewName || context.rootName;
  const counterKey = `${parent}::${label}`;
  const next = (context.siblingCounters.get(counterKey) || 0) + 1;
  context.siblingCounters.set(counterKey, next);
  return `${label} ${next} of ZONE ${parent}`;
}

function reviewLabel(node) {
  const attributes = node.attributes || {};
  if (attributes.TYPE === 'COMPONENT') {
    return componentLabel(attributes.ENGINEERING_TYPE || attributes.MESH_ROLE || node.name);
  }
  if (attributes.TYPE === 'SUPPORT_RESTRAINT') {
    return supportLabel(attributes.FAMILY || node.name);
  }
  if (attributes.TYPE === 'NODE') return 'NODE';
  if (attributes.TYPE === 'ISONOTE_NAME_PLATE') return 'ISONOTE';
  if (attributes.ROLE) return toReviewToken(attributes.ROLE, 'GROUP');
  if (attributes.TYPE) return toReviewToken(attributes.TYPE, 'NODE');
  return toReviewToken(node.name, 'NODE');
}

function componentLabel(value) {
  const text = String(value || '').toUpperCase();
  if (text.includes('FLANGE')) return 'FLANGE';
  if (text.includes('VALVE')) return 'VALVE';
  if (text.includes('TEE')) return 'TEE';
  if (text.includes('BEND') || text.includes('ELBOW')) return 'ELBOW';
  if (text.includes('GASKET')) return 'GASKET';
  if (text.includes('PIPE')) return 'PIPE';
  if (text.includes('RIGID')) return 'RIGID';
  return toReviewToken(value, 'COMPONENT');
}

function supportLabel(value) {
  const text = String(value || '').toUpperCase();
  if (text.includes('GUIDE')) return 'GUIDE SUPPORT';
  if (text.includes('LINE_STOP') || text.includes('STOP')) return 'LINE STOP SUPPORT';
  if (text.includes('ANCHOR')) return 'ANCHOR SUPPORT';
  if (text.includes('SPRING')) return 'SPRING SUPPORT';
  if (text.includes('HOLDDOWN')) return 'HOLDDOWN SUPPORT';
  if (text.includes('REST')) return 'REST SUPPORT';
  return `${toReviewToken(value, 'SUPPORT')} SUPPORT`;
}

function uniqueReviewName(value, seen) {
  const base = toReviewNodeName(value, 'UNNAMED');
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base} ${count + 1}`;
}

function toReviewNodeName(value, fallback) {
  const clean = String(value || fallback || 'UNNAMED')
    .replace(/\+/g, ' PLUS ')
    .replace(/-/g, '-')
    .replace(/[^A-Za-z0-9_/ .:()-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+\//g, ' /')
    .replace(/\/\s+/g, '/')
    .trim();
  return clean || fallback || 'UNNAMED';
}

function toReviewToken(value, fallback) {
  const clean = toReviewNodeName(value, fallback)
    .replace(/^\/+/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  return clean || fallback || 'UNNAMED';
}
