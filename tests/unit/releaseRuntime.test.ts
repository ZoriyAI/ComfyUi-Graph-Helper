import { afterEach, describe, expect, it, vi } from 'vitest';
import { allowTestProvider, MainLLMService } from '../../src/main/llmService';
import { commandLineAnswer } from '../../src/main/cli';

describe('the scripted test provider', () => {
  afterEach(() => allowTestProvider(true));

  it('answers in development and tests', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const service = new MainLLMService();
    service.setConfig({ provider: 'test', model: 'test-fixture' });
    expect(service.currentProvider()).toBe('test');
    expect(service.getModel()).not.toBeNull();
  });

  it('is refused by a packaged app, also when a profile has it saved', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    allowTestProvider(false);
    const service = new MainLLMService();
    service.setConfig({ provider: 'test', model: 'test-fixture' });
    expect(service.currentProvider()).toBe('');
    expect(service.getModel()).toBeNull();
    const listed = await service.listModels({ provider: 'test', model: '', baseURL: '' } as never);
    expect('source' in listed && listed.source === 'test').toBe(false);
  });
});

describe('command line', () => {
  it('prints the version and the help without starting the app', () => {
    expect(commandLineAnswer(['/usr/lib/comfyui-graph-builder/comfyui-graph-builder', '--version'], '1.2.3')).toBe('Graph Helper for ComfyUI 1.2.3\n');
    expect(commandLineAnswer(['app', '-v'], '1.2.3')).toBe('Graph Helper for ComfyUI 1.2.3\n');
    const help = commandLineAnswer(['app', '--help'], '1.2.3') ?? '';
    expect(help).toContain('Usage: comfyui-graph-builder [options]');
    expect(help).toContain('--user-data-dir=<folder>');
  });

  it('leaves every other start alone', () => {
    expect(commandLineAnswer(['app'], '1.2.3')).toBeNull();
    expect(commandLineAnswer(['electron', '.', '--user-data-dir=/tmp/x', '--no-sandbox'], '1.2.3')).toBeNull();
  });
});
