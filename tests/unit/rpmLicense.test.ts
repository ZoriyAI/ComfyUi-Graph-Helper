/**
 * Protects the Linux .rpm package spec rendered from resources/linux/rpm.spec.ejs: the copyright file is kept
 * as a license (so it survives installs that skip documentation), the Chromium sandbox helper keeps its setuid
 * mode (without it the app does not start), and the package replaces the one the 0.x versions were shipped as,
 * so an upgrade does not leave two copies of the app installed.
 */
import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { LEGACY_APP_ID } from '../../src/shared/legacyNames';
const require = createRequire(import.meta.url);
// Render through the same installer implementation that the RPM maker uses.
const { generateTemplate } = require('electron-installer-common/src/template');

it('renders copyright as a retained license with its owned directory and sandbox attributes', async () => {
  const spec = await generateTemplate('resources/linux/rpm.spec.ejs', {
    name: 'nodewise-studio', version: '0.9.0', revision: 1, compressionLevel: 9,
    description: 'A desktop tutor', productDescription: 'A desktop tutor for graphs', license: 'MIT', homepage: '',
    requires: ['glibc'], icon: 'icon.png', pre: '', preun: '', post: '', postun: '',
  });
  const files = spec.split('%files\n')[1].trim().split('\n');
  expect(files).toContain('%dir /usr/share/doc/nodewise-studio');
  expect(files).toContain('%license /usr/share/doc/nodewise-studio/copyright');
  expect(files).not.toContain('/usr/share/doc/nodewise-studio/');
  expect(files).toContain('%attr(4755, root, root) /usr/lib/nodewise-studio/chrome-sandbox');
});

it('declares that the package replaces the one 0.x was shipped as, and only when asked', async () => {
  const options = {
    name: 'nodewise-studio', version: '1.0.0', revision: 1, compressionLevel: 9,
    description: 'A desktop tutor', productDescription: 'A desktop tutor for graphs', license: 'MIT', homepage: '',
    requires: ['glibc'], icon: 'icon.png', pre: '', preun: '', post: '', postun: '',
  };
  const spec = await generateTemplate('resources/linux/rpm.spec.ejs', { ...options, legacyPackages: [LEGACY_APP_ID] });
  expect(spec).toContain(`Provides: ${LEGACY_APP_ID} = %{version}-%{release}\nObsoletes: ${LEGACY_APP_ID} < %{version}-%{release}\n`);
  // forge.config.js passes the old name; without it the spec has no such lines.
  const plain = await generateTemplate('resources/linux/rpm.spec.ejs', options);
  expect(plain).not.toMatch(/^(Obsoletes|Provides):/m);
  const forge = require('../../forge.config.js') as { makers: Array<{ name: string; config: { options: Record<string, unknown> } }> };
  expect(forge.makers.find((maker) => maker.name === '@electron-forge/maker-rpm')?.config.options.legacyPackages).toEqual([LEGACY_APP_ID]);
});
