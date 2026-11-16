/**
 * Protects "Ask about this" when no assistant is chosen: the question opens the Explain tab on the object with the
 * built-in knowledge instead of going to a chat that cannot answer. With an assistant chosen, it goes to the chat.
 * A person without a model key must still get help from a right click.
 */
import { describe, expect, it, vi } from 'vitest';

// The dock reads the window size; a small window object is enough here.
vi.stubGlobal('window', { innerWidth: 1440, innerHeight: 900, matchMedia: () => ({ matches: false }), addEventListener: () => undefined, dispatchEvent: vi.fn(), localStorage: { getItem: () => null, setItem: () => undefined } });
import { onAsk, requestAsk } from '../../src/renderer/services/ask';
import { useProviderStore } from '../../src/renderer/state/providerState';
import { useUiStore } from '../../src/renderer/state/uiState';
import { useDockStore } from '../../src/renderer/state/dockState';
import { askForNodeFix } from '../../src/renderer/components/graph/askAbout';

describe('asking about an object with no assistant chosen (owner\'s list)', () => {
  it('opens the Explain tab on the object with the built-in knowledge, and posts nothing to the chat', () => {
    const heard: string[] = [];
    const stop = onAsk((request) => heard.push(request.message));
    useProviderStore.setState({ provider: '' });
    const port = { kind: 'port' as const, id: 'in-1', nodeId: '4', direction: 'input' as const, portName: 'positive' };
    requestAsk({ context: { intent: 'ask', objectRef: port, selection: [], language: 'ru' }, message: 'Что сюда подключить?' });
    expect(heard).toEqual([]);
    expect(useUiStore.getState().focusRef).toEqual(port);
    expect(useDockStore.getState().tab).toBe('explain');
    // With an assistant the question goes to the chat as before.
    useProviderStore.setState({ provider: 'test' });
    requestAsk({ context: { intent: 'ask', objectRef: port, selection: [], language: 'ru' }, message: 'Что сюда подключить?' });
    expect(heard).toEqual(['Что сюда подключить?']);
    stop();
  });
  it('reveals the phone assistant even when its dock is already logically open', () => {
    vi.stubGlobal('CustomEvent', class { constructor(readonly type: string, readonly options: unknown) {} });
    useProviderStore.setState({ provider: 'test' });
    useDockStore.setState({ tab: 'assistant', collapsed: false });
    const stop = onAsk(() => undefined);
    vi.mocked(window.dispatchEvent).mockClear();
    requestAsk({ context: { intent: 'ask', selection: [], language: 'ru' }, message: 'Объясни' });
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'workspace:panel', options: { detail: 'assistant' } }));
    stop();
  });
  it('opens assistant setup for a proposed repair when no provider is configured', () => {
    useProviderStore.setState({ provider: '' });
    const heard: string[] = []; const stop = onAsk((request) => heard.push(request.message));
    requestAsk({ context: { intent: 'build', objectRef: { kind: 'node', id: '4' }, selection: [], language: 'ru' }, message: 'Предложи исправление' });
    expect(heard).toEqual([]);
    expect(useUiStore.getState().settingsRequest?.section).toBe('assistant');
    stop();
  });
  it('requests a node repair as a reviewable proposal, never as a direct build', () => {
    useProviderStore.setState({ provider: 'test' });
    const heard = vi.fn(); const stop = onAsk(heard);
    const node = { kind: 'node' as const, id: '4' };
    askForNodeFix(node, 'Предложи исправление');
    expect(heard).toHaveBeenCalledOnce();
    expect(heard).toHaveBeenCalledWith(expect.objectContaining({ context: expect.objectContaining({ intent: 'ask', objectRef: node, selection: [node] }) }));
    stop();
  });
});
