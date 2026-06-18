// Emergency safe wrapper: keep the app responsive by loading only the stable base property tabs.
// Late-stage optional UI controllers are temporarily disabled and will be re-enabled one by one
// behind explicit safe-load guards after runtime profiling.

import './property-tabs-base-controller.js?v=phase20-property-tabs-base';

window.__3D_MARKUP_SAFE_UI_MODE__ = true;
console.info('[3DMarkupTool] Safe UI mode enabled: optional late UI controllers disabled.');
