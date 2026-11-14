import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { APP_ID, DISPLAY_NAME, STABLE_APP_NAME, appVersion, userAgent, usesStableProfile } from '../../src/main/identity';
import { mcpClientInfo, setMcpClientVersion } from '../../src/main/mcp/client';

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8')) as Record<string, unknown>;

describe('app identity', () => {
  it('keeps the profile name that every released deb used', () => {
    // The profile folder ~/.config/comfyui-graph-builder and the keyring entry depend on it: never change it.
    expect(STABLE_APP_NAME).toBe('comfyui-graph-builder');
    expect(pkg.name).toBe(STABLE_APP_NAME);
  });

  it('shows one display name, the one package.json gives the window', () => {
    expect(DISPLAY_NAME).toBe('Graph Helper for ComfyUI');
    expect(pkg.productName).toBe(DISPLAY_NAME);
  });

  it('names the desktop entry after the package, so the window class matches the launcher', () => {
    expect(pkg.desktopName).toBe(`${STABLE_APP_NAME}.desktop`);
  });

  it('sends the real version to servers and sites', () => {
    expect(appVersion()).toBe(pkg.version);
    setMcpClientVersion(appVersion());
    expect(mcpClientInfo()).toEqual({ name: APP_ID, version: pkg.version });
    expect(userAgent('page reader')).toBe(`GraphHelperForComfyUI/${pkg.version} (+read-only; page reader)`);
  });

  it('uses the stable profile whatever the display name is', () => {
    expect(usesStableProfile('Graph Helper for ComfyUI', true)).toBe(true);
    expect(usesStableProfile('Graph Helper for ComfyUI', false)).toBe(true);
    expect(usesStableProfile('ComfyUI Graph Helper', false)).toBe(true);
    expect(usesStableProfile('Some Later Name', false)).toBe(true);
    expect(usesStableProfile('comfyui-graph-builder', true)).toBe(true);
    // A bare script launch keeps Electron's own name and folder.
    expect(usesStableProfile('Electron', false)).toBe(false);
  });
});
