import * as THREE from 'three';

const bridgePlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
const previousRender = THREE.WebGLRenderer.prototype.render;

THREE.WebGLRenderer.prototype.render = function renderWithToolbarClipBridge(scene, camera) {
  const clipButton = document.getElementById('clipBtn');
  const toolbarClipOn = Boolean(
    clipButton && (
      clipButton.classList.contains('tool-active') ||
      /clip\s+on/i.test(clipButton.textContent || '')
    )
  );

  const planes = Array.isArray(this.clippingPlanes) ? this.clippingPlanes : [];

  if (toolbarClipOn && !planes.length) {
    this.clippingPlanes = [bridgePlane];
  }

  return previousRender.call(this, scene, camera);
};
