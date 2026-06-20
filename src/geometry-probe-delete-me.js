import * as THREE from 'three';

export function resolveSpringCoilAxis(axis, name = 'spring_coil') {
  const n = String(name || '').toUpperCase();
  if (n.includes('SPRING_WARNING') && n.includes('BELOW_PIPE')) return new THREE.Vector3(0, 1, 0);
  return axis.clone().normalize();
}

export const probe = true;
