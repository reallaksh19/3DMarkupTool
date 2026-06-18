# InputXML to GLB / RVM+ATT Standalone Converter

A standalone browser app for converting CAESAR II InputXML into GLB and Navisworks-oriented RVM+ATT with plant geometry, component metadata, node labels, Line No sideload, ISONOTE boards, and support/restraint overlays.

## Run locally

```bash
cd inputxml_glb_standalone_app
python3 -m http.server 5173
# open http://localhost:5173
```

The app is static and can be deployed to Netlify, GitHub Pages, or any HTTP server. It uses Three.js from jsDelivr CDN via an import map.

## Deployment

Upload the complete folder contents to your static host. For Netlify, drag-drop the folder or zip. `netlify.toml` is included.

## Included sample

- `samples/BM_CII_Enriched_v8_lite.XML`
- `samples/BM_CII_ISONOTE_sideload.csv`
- `samples/BM_CII_LINE_NO_sideload.csv`
- `samples/BM_CII_reference_v69_isonote_axial_resolver.glb` (reference output from previous chat generation, if present)

## Converter modes

- **InputXML actual restraints**: plant geometry + InputXML supports only.
- **ISONOTE expected restraints**: plant geometry + ISONOTE expected supports only.
- **Compare actual vs expected**: plant geometry + both actual and expected supports.

## Navisworks RVM+ATT export

The app generates `inputxml_converted.rvm` and `inputxml_converted.att` alongside the GLB. Keep the RVM and ATT files in the same folder with the same basename before opening the RVM in Navisworks.

The ATT file mirrors the RVM group names and starts with the CADC attributes header expected by common Navisworks RVM workflows. The RVM preview mode renders the generated export tree in the canvas so components, restraints, node annotations, and ISONOTE annotations can be inspected through the same property panel.

InputXML does not provide bend length. When a bend radius is missing, the converter uses an explicit `1.5D` visual/export fallback based on pipe OD.

## Locked support mapping rules

- REST is always +Y, vertical upward arrow.
- HOLDDOWN is always double arrow in vertical axis (±Y).
- GUIDE:
  - horizontal pipe in X → lateral Z pair.
  - horizontal pipe in Z → lateral X pair.
  - vertical pipe → four arrows in X and Z.
- LINE STOP / LIMIT / LIM are axial ± pairs unless explicit sign exists.
- SINGLE AXIS with no +/- does not assume direction; it creates a warning marker and records popupRequired=true.
- Can Spring / Spring Can creates a warning coil below the pipe.
- Gap is record-scoped; no carry-forward.
- Axial restraints use axial corner/tip contact, with 10×gap separation if a positive gap exists.
- After engineering contact, OD×2/3 visual resolver is applied only to final pipe-parallel/axial symbols.

## Notes

This is a standalone recovery/deployable app, not dependent on the corrupted repo module graph. It is intentionally self-contained in `src/` and does not import project repository files.
