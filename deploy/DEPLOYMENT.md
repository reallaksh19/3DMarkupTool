# Deployment Guide

## Local test

```bash
cd inputxml_glb_standalone_app
python3 -m http.server 5173
```

Open `http://localhost:5173`.

## Netlify

Drag and drop the full `inputxml_glb_standalone_app` folder, or zip contents, into Netlify Deploys. `netlify.toml` is included.

## GitHub Pages

Copy the folder contents into a repository branch or `/docs` folder and enable Pages. Because the app uses ES modules, serve via HTTP; do not open `index.html` directly as `file://`.

## Static hosting requirements

- Serve `.glb` as `model/gltf-binary` where possible.
- Network access to jsDelivr CDN for Three.js modules:
  - `three`
  - `three/addons/controls/OrbitControls.js`
  - `three/addons/exporters/GLTFExporter.js`

If your environment is fully offline, vendor the Three.js files locally and update the import map in `index.html`.
