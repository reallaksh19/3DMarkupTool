import * as THREE from 'three';

export function createSpringCoil(center, axis = new THREE.Vector3(0, 1, 0), radius = 0.22, length = 1.0, material = null, name = 'spring_coil') {
  const points = [];
  const coils = 5;
  const steps = 96;
  const dir = resolveSpringCoilAxis(axis, name);
  const a = new THREE.Vector3(1, 0, 0);
  const b = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const theta = t * coils * Math.PI * 2;
    points.push(center.clone().add(dir.clone().multiplyScalar((t - 0.5) * length)).add(a.clone().multiplyScalar(Math.cos(theta) * radius)).add(b.clone().multiplyScalar(Math.sin(theta) * radius)));
  }
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 120, 0.035, 8, false), material || new THREE.MeshStandardMaterial());
}

export function resolveSpringCoilAxis(axis, name = 'spring_coil') {
  const n = String(name || '').toUpperCase();
  if (n.includes('SPRING_WARNING') && n.includes('BELOW_PIPE')) return new THREE.Vector3(0, 1, 0);
  return axis.clone().normalize();
}
