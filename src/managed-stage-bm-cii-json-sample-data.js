/**
 * BM_CII managed-stage sample data module.
 *
 * The canonical benchmark is now loaded via fetch() inside
 * managed-stage-bm-cii-json-sample-controller.js directly.
 * This module is retained only as a named-export stub so that any
 * cached browser module that imports from it does not throw a hard
 * SyntaxError (missing export).
 *
 * DO NOT add createBmCiiManagedStageSampleJson back here.
 * The controller is fully self-contained as of v5.
 */

export const BM_CII_MANAGED_STAGE_SAMPLE_NAME = 'BM_CII_INPUT_managed_stage.json';
export const BM_CII_MANAGED_STAGE_SAMPLE_URL = '/src/BM_CII_INPUT_managed_stage.json';
