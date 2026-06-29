export const SUPPORT_AXIS_BASIS_CONFIG_SCHEMA = 'SupportAxisBasisConfig.v2';

/**
 * Observed BM_CII/Navis-to-current-canvas relationship from side-by-side validation:
 *
 *   Navis N     is currently seen on Canvas +Y
 *   Navis Top   is currently seen on Canvas +Z
 *   Navis W     is currently seen on Canvas -X
 *
 * Encoding only that observation does not change rendered support axes. The corrective
 * transform below rotates signed plan axes around +Z so Navis North is moved onto the
 * canvas North direction (-X), while Top stays +Z.
 *
 * Corrective signed-axis transform:
 *   source +Y / Navis N   -> canvas -X / canvas North
 *   source +Z / Navis Top -> canvas +Z
 *   source -X / Navis W   -> canvas -Y
 *
 * Matrix form, using source vector [x,y,z] -> canvas vector [x',y',z']:
 *   x' = -y
 *   y' =  x
 *   z' =  z
 */
export const NAVIS_TO_CANVAS_SUPPORT_AXIS_BASIS = Object.freeze({
  schema: SUPPORT_AXIS_BASIS_CONFIG_SCHEMA,
  name: 'Navis-to-canvas corrective support axis basis',
  description: 'Corrective BM_CII/Navis mapping: source +Y/Navis N -> canvas -X, source +Z/Navis Top -> canvas +Z, source -X/Navis W -> canvas -Y.',
  observedAxes: Object.freeze({
    '+Y': Object.freeze({ engineeringDirection: 'NAVIS_NORTH_OBSERVED', currentCanvasAxis: '+Y', navisDirection: 'N' }),
    '+Z': Object.freeze({ engineeringDirection: 'NAVIS_TOP_OBSERVED', currentCanvasAxis: '+Z', navisDirection: 'TOP' }),
    '-X': Object.freeze({ engineeringDirection: 'NAVIS_WEST_OBSERVED', currentCanvasAxis: '-X', navisDirection: 'W' })
  }),
  axes: Object.freeze({
    '+X': Object.freeze({ engineeringDirection: 'NAVIS_EAST', canvasAxis: '+Y', navisDirection: 'E', transformed: true }),
    '-X': Object.freeze({ engineeringDirection: 'NAVIS_WEST', canvasAxis: '-Y', navisDirection: 'W', transformed: true }),
    '+Y': Object.freeze({ engineeringDirection: 'NAVIS_NORTH', canvasAxis: '-X', navisDirection: 'N', transformed: true }),
    '-Y': Object.freeze({ engineeringDirection: 'NAVIS_SOUTH', canvasAxis: '+X', navisDirection: 'S', transformed: true }),
    '+Z': Object.freeze({ engineeringDirection: 'NAVIS_TOP', canvasAxis: '+Z', navisDirection: 'TOP', transformed: false }),
    '-Z': Object.freeze({ engineeringDirection: 'NAVIS_BOTTOM', canvasAxis: '-Z', navisDirection: 'BOTTOM', transformed: false })
  }),
  semanticAxes: Object.freeze({
    N: '+Y',
    NORTH: '+Y',
    S: '-Y',
    SOUTH: '-Y',
    TOP: '+Z',
    T: '+Z',
    UP: '+Z',
    U: '+Z',
    BOTTOM: '-Z',
    BOT: '-Z',
    DOWN: '-Z',
    D: '-Z',
    W: '-X',
    WEST: '-X',
    E: '+X',
    EAST: '+X'
  }),
  matrix: Object.freeze([
    Object.freeze([0, -1, 0]),
    Object.freeze([1, 0, 0]),
    Object.freeze([0, 0, 1])
  ]),
  signedAxisTransform: Object.freeze({
    '+X': '+Y',
    '-X': '-Y',
    '+Y': '-X',
    '-Y': '+X',
    '+Z': '+Z',
    '-Z': '-Z'
  })
});

export function resolveSemanticNavisAxisToken(value) {
  const key = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!key) return '';
  return NAVIS_TO_CANVAS_SUPPORT_AXIS_BASIS.semanticAxes[key] || '';
}

export function transformNavisSourceAxisToCanvas(axisToken, basis = NAVIS_TO_CANVAS_SUPPORT_AXIS_BASIS) {
  const axis = normalizeSignedAxis(axisToken);
  if (!axis) return '';
  return normalizeSignedAxis(basis?.signedAxisTransform?.[axis] || basis?.axes?.[axis]?.canvasAxis || axis);
}

export function transformNavisAxisListToCanvas(axisTokens = [], basis = NAVIS_TO_CANVAS_SUPPORT_AXIS_BASIS) {
  const entries = Array.isArray(axisTokens) ? axisTokens : String(axisTokens || '').split(/[|,\s]+/);
  const out = [];
  for (const entry of entries) {
    const transformed = transformNavisSourceAxisToCanvas(entry, basis);
    if (transformed && !out.includes(transformed)) out.push(transformed);
  }
  return out;
}

function normalizeSignedAxis(value) {
  const match = String(value || '').toUpperCase().match(/([+-]?)(X|Y|Z)/);
  return match ? `${match[1] || '+'}${match[2]}` : '';
}
