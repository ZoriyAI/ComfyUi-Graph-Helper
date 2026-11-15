import { describe, expect, it, vi } from 'vitest';

// The dock reads the window size; a small window object is enough here.
vi.stubGlobal('window', { innerWidth: 1440, innerHeight: 900, matchMedia: () => ({ matches: false }), addEventListener: () => undefined, localStorage: { getItem: () => null, setItem: () => undefined } });
import { onAsk, requestAsk } from '../../src/renderer/services/ask';
import { useProviderStore } from '../../src/renderer/state/providerState';
import { useUiStore } from '../../src/renderer/state/uiState';
import { useDockStore } from '../../src/renderer/state/dockState';

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
});
