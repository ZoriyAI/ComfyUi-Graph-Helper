import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Render through the same installer implementation that the RPM maker uses.
const { generateTemplate } = require('electron-installer-common/src/template');

it('renders copyright as a retained license with its owned directory and sandbox attributes', async () => {
  const spec = await generateTemplate('resources/linux/rpm.spec.ejs', {
    name: 'comfyui-graph-builder', version: '0.9.0', revision: 1, compressionLevel: 9,
    description: 'Graph helper', productDescription: 'ComfyUI graph helper', license: 'MIT', homepage: '',
    requires: ['glibc'], icon: 'icon.png', pre: '', preun: '', post: '', postun: '',
  });
  const files = spec.split('%files\n')[1].trim().split('\n');
  expect(files).toContain('%dir /usr/share/doc/comfyui-graph-builder');
  expect(files).toContain('%license /usr/share/doc/comfyui-graph-builder/copyright');
  expect(files).not.toContain('/usr/share/doc/comfyui-graph-builder/');
  expect(files).toContain('%attr(4755, root, root) /usr/lib/comfyui-graph-builder/chrome-sandbox');
});
