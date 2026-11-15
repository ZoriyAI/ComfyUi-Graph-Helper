/**
 * The product's names are spelled in src/shared/productNames.ts; files that cannot import it repeat them. This
 * keeps every copy equal, keeps the name out of the catalog's sentences, and keeps the brand rule (no "Comfy" in
 * the product's own name, ids or file names).
 */
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { APP_ID, DISPLAY_NAME, NATIVE_PROJECT_FORMAT_ID, PROJECT_FILE_SUFFIX, SHORT_NAME, USER_AGENT_PRODUCT } from '../../src/shared/productNames';
import { LEGACY_APP_ID } from '../../src/shared/legacyNames';
import { catalogLeaves, createTranslator, en, ru } from '../../src/shared/i18n';

const require = createRequire(import.meta.url);
const root = path.join(__dirname, '..', '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const pkg = JSON.parse(read('package.json')) as Record<string, string>;

function leaf(catalog: unknown, key: string): string {
  return key.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown>)[part], catalog) as string;
}

describe('product names', () => {
  it('are the chosen ones', () => {
    expect([DISPLAY_NAME, SHORT_NAME, APP_ID, USER_AGENT_PRODUCT, PROJECT_FILE_SUFFIX]).toEqual(['NodeWise Studio', 'NodeWise', 'nodewise-studio', 'NodeWiseStudio', '.nodewise.json']);
  });

  it('match in package.json, the lock file, the page title and the build scripts', () => {
    expect([pkg.name, pkg.productName, pkg.desktopName]).toEqual([APP_ID, DISPLAY_NAME, `${APP_ID}.desktop`]);
    const lock = JSON.parse(read('package-lock.json')) as { name: string; packages: Record<string, { name?: string }> };
    expect([lock.name, lock.packages[''].name]).toEqual([APP_ID, APP_ID]);
    expect(read('src/renderer/index.html')).toContain(`<title>${DISPLAY_NAME}</title>`);
    expect(require('../../scripts/lib/product-names.js')).toEqual({ DISPLAY_NAME, APP_ID, LEGACY_APP_ID });
    const forge = require('../../forge.config.js') as { packagerConfig: { executableName: string }; makers: Array<{ config: { options: { productName: string; description: string } } }> };
    expect(forge.packagerConfig.executableName).toBe(APP_ID);
    for (const maker of forge.makers) expect(maker.config.options.productName).toBe(DISPLAY_NAME);
  });

  it('match in the portable shell scripts', () => {
    for (const file of ['run.sh', 'install.sh', 'uninstall.sh']) {
      const script = read(`resources/linux/portable/${file}`);
      expect(script, file).toContain(`\nNAME=${APP_ID}\n`);
      expect(script, file).toContain(`\nDISPLAY_NAME='${DISPLAY_NAME}'\n`);
      expect(script.split('\n')[1], file).toMatch(new RegExp(`^# ${DISPLAY_NAME}: `));
    }
    // install.sh removes a 0.9 copy installed under the old name.
    expect(read('resources/linux/portable/install.sh')).toContain(`\nLEGACY_NAME=${LEGACY_APP_ID}\n`);
  });

  it('give the same line under the name everywhere: About, package.json, the package summary, the desktop entry', () => {
    const english = 'A desktop tutor for ComfyUI graphs';
    const russian = 'Учебный помощник по графам ComfyUI';
    expect(leaf(en, 'shell.tagline')).toBe(english);
    expect(leaf(ru, 'shell.tagline')).toBe(russian);
    expect(pkg.description).toBe(english);
    const desktop = read('resources/linux/desktop.ejs');
    expect(desktop).toContain('\nName=<%= productName %>\n');
    expect(desktop).toContain('\nComment=<%= description %>\n');
    expect(desktop).toContain(`\nComment[ru]=${russian}\n`);
    const forge = require('../../forge.config.js') as { makers: Array<{ config: { options: { description: string } } }> };
    for (const maker of forge.makers) expect(maker.config.options.description).toBe(english);
  });

  it('reach the texts only through {{app}} and {{appShort}}: no catalog sentence spells the name', () => {
    for (const catalog of [en, ru]) {
      for (const key of catalogLeaves(catalog)) {
        const text = leaf(catalog, key);
        expect(text.includes('NodeWise'), key).toBe(false);
      }
    }
    for (const language of ['en', 'ru'] as const) {
      const t = createTranslator(language);
      expect(t('shell.title')).toBe(DISPLAY_NAME);
      expect(t('diagnostics.startupFailedTitle')).toContain(DISPLAY_NAME);
    }
  });

  it('keep the brand rule: ComfyUI is what the app works with, never part of its own name, ids or file names', () => {
    for (const value of [DISPLAY_NAME, SHORT_NAME, APP_ID, USER_AGENT_PRODUCT, PROJECT_FILE_SUFFIX, NATIVE_PROJECT_FORMAT_ID, pkg.name, pkg.productName, pkg.desktopName]) {
      expect(value.toLowerCase(), value).not.toContain('comfy');
    }
    // The icons are installed under the package name (forge.config.js, make-linux-portable.js).
    for (const file of fs.readdirSync(path.join(root, 'resources', 'icons'))) expect(file.toLowerCase()).not.toContain('comfy');
  });
});
