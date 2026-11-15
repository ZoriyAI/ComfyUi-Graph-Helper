/**
 * A shape check of the window.electronAPI contract: method names the renderer expects (llmSetConfig,
 * llmStreamChat and others), the platform names and the version format.
 * It checks a hand-made object, not src/preload itself; the real preload is loaded in preloadStream.test.ts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Preload API Contract', () => {
  it('should define expected electronAPI structure', () => {
    // Mock window.electronAPI for unit test
    const mockAPI = {
      platform: 'linux',
      versions: {
        node: '20.0.0',
        chrome: '120.0.0',
        electron: '45.2.3',
      },
      importWorkflow: vi.fn(),
      exportWorkflow: vi.fn(),
      saveProject: vi.fn(),
      loadProject: vi.fn(),
      listProjects: vi.fn(),
      llmSetConfig: vi.fn(),
      llmStreamChat: vi.fn(),
      sendToolResult: vi.fn(),
    };

    expect(mockAPI).toHaveProperty('platform');
    expect(mockAPI).toHaveProperty('versions');
    expect(mockAPI.versions).toHaveProperty('electron');
    expect(mockAPI).toHaveProperty('llmSetConfig');
    expect(mockAPI).toHaveProperty('llmStreamChat');
    expect(typeof mockAPI.llmSetConfig).toBe('function');
    expect(typeof mockAPI.llmStreamChat).toBe('function');
  });

  it('should validate platform types', () => {
    const validPlatforms = ['linux', 'darwin', 'win32'];
    const platform = 'linux';
    expect(validPlatforms).toContain(platform);
  });

  it('should validate version format', () => {
    const version = '45.2.3';
    const versionPattern = /^\d+\.\d+\.\d+$/;
    expect(version).toMatch(versionPattern);
  });
});
