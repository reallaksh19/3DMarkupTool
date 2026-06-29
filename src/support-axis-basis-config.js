export const SUPPORT_AXIS_BASIS_CONFIG_SCHEMA = 'SupportAxisBasisConfig.v1';

/**
 * Navisworks-to-canvas basis observed from side-by-side validation:
 *
 *   Navis N     -> Canvas +Y
 *   Navis Top   -> Canvas +Z
 *   Navis W     -> Canvas -X
 *
 * This keeps signed XYZ axes stable in canvas coordinates while correcting the
 * semantic engineering direction labels used by support-axis resolution.
 */
export const NAVIS_TO_CANVAS_SUPPORT_AXIS_BASIS = Object.freeze({
  schema: SUPPORT_AXIS_BASIS_CONFIG_SCHEMA,
  name: 'Navis-to-canvas support axis basis',
  description: 'Observed BM_CII/Navis mapping: Navis N -> canvas +Y, Navis Top -> canvas +Z, Navis W -> canvas -X.',
  axes: Object.freeze({
    '+Y': Object.freeze({ engineeringDirection: 'NAVIS_NORTH', canvasAxis: '+Y', navisDirection: 'N' }),
    '-Y': Object.freeze({ engineeringDirection: 'NAVIS_SOUTH', canvasAxis: '-Y', navisDirection: 'S' }),
    '+Z': Object.freeze({ engineeringDirection: 'NAVIS_TOP', canvasAxis: '+Z', navisDirection: 'TOP' }),
    '-Z': Object.freeze({ engineeringDirection: 'NAVIS_BOTTOM', canvasAxis: '-Z', navisDirection: 'BOTTOM' }),
    '-X': Object.freeze({ engineeringDirection: 'NAVIS_WEST', canvasAxis: '-X', navisDirection: 'W' }),
    '+X': Object.freeze({ engineeringDirection: 'NAVIS_EAST', canvasAxis: '+X', navisDirection: 'E' })
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
  })
});

export function resolveSemanticNavisAxisToken(value) {
  const key = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!key) return '';
  return NAVIS_TO_CANVAS_SUPPORT_AXIS_BASIS.semanticAxes[key] || '';
}
