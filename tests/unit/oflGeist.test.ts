import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

describe('bundled Geist OFL notice', () => {
  it('keeps the SIL OFL notice shipped with @fontsource/geist', () => {
    // Vite bundles the font into the renderer, so the package is a devDependency; its notice ships in dist/notices.
    const app = JSON.parse(readFileSync('package.json', 'utf8')) as { devDependencies: Record<string, string> };
    const font = JSON.parse(readFileSync('node_modules/@fontsource/geist/package.json', 'utf8')) as { name: string; version: string; license: string };
    const notice = readFileSync('node_modules/@fontsource/geist/LICENSE', 'utf8');
    const entry = readFileSync('src/renderer/index.tsx', 'utf8');
    expect(app.devDependencies['@fontsource/geist']).toBe('5.3.0');
    expect(font.name).toBe('@fontsource/geist');
    expect(font.version).toBe('5.3.0');
    expect(font.license).toBe('OFL-1.1');
    expect(notice).toContain('SIL Open Font License, Version 1.1');
    expect(entry).toContain("import '@fontsource/geist/400.css'");
    expect(entry).toContain("import '@fontsource/geist/cyrillic-400.css'");
    console.log(`OFL_GEIST package=@fontsource/geist@${font.version} license=${font.license} notice=present`);
  });
});
