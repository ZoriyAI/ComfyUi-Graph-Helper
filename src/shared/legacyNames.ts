/**
 * The names the product had before 1.0, kept only so that what people made with an older version still works.
 *
 * Who reads them: the profile adoption at start (src/main/profileAdoption.ts moves the old profile folder to the new
 * one), the project file reader (src/shared/native-project.ts accepts the old `format` id) and the save code
 * (src/main/projectFiles.ts knows the old file ending). Nothing here is ever shown to a person or written anew.
 *
 * Why a separate file: tests/unit/oldNames.test.ts fails when an old name appears anywhere else in the tracked
 * files (outside the frozen 0.x release notes and the packaging lines that remove the old package), so every
 * upgrade path that still needs an old spelling must take it from here.
 */

/** The profile folder under ~/.config, and the .deb / .rpm package, executable and install folder of 0.x. */
export const LEGACY_APP_ID = 'comfyui-graph-builder';

/** Project file endings of 0.x (the first is what 0.9 wrote; the second appeared in early documents). */
export const LEGACY_PROJECT_FILE_SUFFIXES = ['.graph-helper.json', '.cozygraph.json'] as const;

/** The `format` field of a project file written by 0.x. */
export const LEGACY_NATIVE_PROJECT_FORMAT_IDS = ['comfy-graph-helper-project'] as const;

/**
 * Every old spelling, for the check that keeps them out of the tree (tests/unit/oldNames.test.ts). Case does not
 * matter; "graph helper" also catches "Graph Helper for ComfyUI".
 */
export const OLD_NAME_PATTERN = /graph[ -]helper|comfyui-graph-builder|GraphHelperForComfyUI|cozygraph/i;
