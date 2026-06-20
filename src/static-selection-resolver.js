// Shared UI selection resolver for review tools.
// This module does not traverse the model at startup. It only inspects the
// current runtime selection or area-selected roots when a tool invokes it.

const VERSION = 'selection-resolver-phase5-20260620';

export function runtime() {
  return window.__3D_MARKUP_VIEWER_RUNTIME__ || window.__3D_MARKUP_CLIP_RUNTIME__ || {};
}

export function getModelRoot(rt = runtime()) {
  return rt?.getModelRoot?.() || rt?.modelRoot || null;
}

export function resolveSelectedObject(options = {}) {
  const rt = options.runtime || runtime();
  const candidates = [
    rt?.selectedObject,
    rt?.selectedMesh,
    rt?.selected,
    rt?.activeObject,
    rt?.selection?.object,
    rt?.selection?.selectedObject,
    window.__3D_MARKUP_STATIC_TREE__?.state?.selectedObject,
    window.__3D_MARKUP_TREE__?.state?.selectedObject,
    window.__3D_MARKUP_SELECTION__?.object,
    window.__3D_MARKUP_SELECTION__?.selectedObject
  ];

  for (const candidate of candidates) {
    if (isSelectableObject(candidate, rt)) return candidate;
  }
  return null;
}

export function resolveComponentRoot(object = undefined, options = {}) {
  const rt = options.runtime || runtime();
  const modelRoot = getModelRoot(rt);
  let selected = object || resolveSelectedObject({ runtime: rt });

  if (!isSelectableObject(selected, rt)) return null;
  if (isForbiddenRoot(selected, rt)) return null;

  let component = selected;
  let cursor = selected;
  while (cursor?.parent && cursor.parent !== modelRoot && !isScene(cursor.parent)) {
    if (isComponentNode(cursor.parent)) component = cursor.parent;
    cursor = cursor.parent;
  }

  return isForbiddenRoot(component, rt) ? null : component;
}

export function resolveSafeHideTarget(object = undefined, options = {}) {
  const rt = options.runtime || runtime();
  const target = resolveComponentRoot(object, { runtime: rt });
  if (!target || isForbiddenRoot(target, rt)) return null;
  return target;
}

export function getAreaSelectedRoots(options = {}) {
  const rt = options.runtime || runtime();
  const areaApi = window.__3D_MARKUP_AREA_SELECT__;
  const source = firstArray([
    callMaybe(areaApi?.selectedRoots, areaApi),
    callMaybe(areaApi?.getSelectedRoots, areaApi),
    areaApi?.roots,
    rt?.areaSelectedRoots,
    rt?.selectedRoots,
    window.__3D_MARKUP_AREA_SELECTED_ROOTS__
  ]);

  return uniqueObjects((source || [])
    .map((object) => resolveSafeHideTarget(object, { runtime: rt }))
    .filter(Boolean));
}

export function getSelectionSummary(options = {}) {
  const rt = options.runtime || runtime();
  const selectedObject = resolveSelectedObject({ runtime: rt });
  const componentRoot = resolveComponentRoot(selectedObject, { runtime: rt });
  const safeHideTarget = resolveSafeHideTarget(componentRoot, { runtime: rt });
  const areaRoots = getAreaSelectedRoots({ runtime: rt });
  return {
    version: VERSION,
    hasRuntime: Boolean(rt && Object.keys(rt).length),
    hasModelRoot: Boolean(getModelRoot(rt)),
    selectedObjectId: objectId(selectedObject),
    componentRootId: objectId(componentRoot),
    safeHideTargetId: objectId(safeHideTarget),
    hasSelectedObject: Boolean(selectedObject),
    hasComponentRoot: Boolean(componentRoot),
    hasSafeHideTarget: Boolean(safeHideTarget),
    areaSelectedCount: areaRoots.length,
    areaSelectedIds: areaRoots.map(objectId).filter(Boolean),
    fullModelRejected: Boolean(selectedObject && !componentRoot)
  };
}

function isSelectableObject(object, rt = runtime()) {
  return Boolean(object)
    && typeof object === 'object'
    && !isScene(object)
    && !isForbiddenRoot(object, rt);
}

function isForbiddenRoot(object, rt = runtime()) {
  if (!object) return true;
  const modelRoot = getModelRoot(rt);
  if (object === modelRoot) return true;
  if (isScene(object)) return true;
  const data = object.userData || {};
  return data.isModelRoot === true
    || data.modelRoot === true
    || data.TYPE === 'MODEL_ROOT'
    || data.TYPE === 'MODEL'
    || data.componentClass === 'MODEL_ROOT'
    || object.name === 'MODEL_ROOT'
    || object.name === 'GLB_ROOT'
    || object.name === 'RVM_ROOT';
}

function isScene(object) {
  return Boolean(object?.isScene || object?.type === 'Scene');
}

function isComponentNode(object) {
  const data = object?.userData || {};
  return Boolean(
    data.ID
    || data.id
    || data.componentId
    || data.componentClass
    || data.componentType
    || data.TYPE === 'COMPONENT'
    || data.PCF_COMPONENT
    || data.pipingComponent
  );
}

function firstArray(values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
    if (value && typeof value[Symbol.iterator] === 'function' && typeof value !== 'string') return Array.from(value);
  }
  return [];
}

function callMaybe(fn, owner) {
  try {
    return typeof fn === 'function' ? fn.call(owner) : undefined;
  } catch (_) {
    return undefined;
  }
}

function uniqueObjects(objects) {
  const seen = new Set();
  const result = [];
  for (const object of objects) {
    if (!object || seen.has(object)) continue;
    seen.add(object);
    result.push(object);
  }
  return result;
}

export function objectId(object) {
  const data = object?.userData || {};
  return data.ID || data.id || data.componentId || data.NAME || data.name || object?.name || object?.uuid || '';
}

window.__3D_MARKUP_SELECTION_RESOLVER__ = {
  version: VERSION,
  runtime,
  getModelRoot,
  resolveSelectedObject,
  resolveComponentRoot,
  resolveSafeHideTarget,
  getAreaSelectedRoots,
  getSelectionSummary,
  objectId
};

window.dispatchEvent(new CustomEvent('viewer:selection-resolver-ready', {
  detail: { version: VERSION }
}));
