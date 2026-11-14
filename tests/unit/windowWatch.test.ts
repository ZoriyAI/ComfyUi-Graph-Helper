import { EventEmitter } from 'events';
import { describe, expect, it, vi } from 'vitest';
import { isExpectedRestart, watchWindowHang } from '../../src/main/windowWatch';
import { createTranslator } from '../../src/shared/i18n';

function fakeWindow() {
  const emitter = new EventEmitter();
  const contents = { forcefullyCrashRenderer: vi.fn(), reload: vi.fn(), isDestroyed: () => false };
  return Object.assign(emitter, { isDestroyed: () => false, webContents: contents });
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('a window that stops responding', () => {
  it('asks once, in the interface language, and waits when asked to', async () => {
    const window = fakeWindow();
    const showMessageBox = vi.fn().mockResolvedValue({ response: 0 });
    watchWindowHang(window as never, { translate: () => createTranslator('ru'), showMessageBox });
    window.emit('unresponsive');
    window.emit('unresponsive');
    await flush();
    expect(showMessageBox).toHaveBeenCalledTimes(1);
    const options = showMessageBox.mock.calls[0][1];
    expect(options.title).toBe('Окно не отвечает');
    expect(options.buttons).toEqual(['Подождать', 'Перезагрузить']);
    expect(window.webContents.reload).not.toHaveBeenCalled();
    // A later hang asks again.
    window.emit('unresponsive');
    await flush();
    expect(showMessageBox).toHaveBeenCalledTimes(2);
  });

  it('reloads on request, and the ending of the hung page is not reported as a crash', async () => {
    const window = fakeWindow();
    watchWindowHang(window as never, { translate: () => createTranslator('en'), showMessageBox: vi.fn().mockResolvedValue({ response: 1 }) });
    window.emit('unresponsive');
    await flush();
    expect(window.webContents.forcefullyCrashRenderer).toHaveBeenCalledTimes(1);
    expect(window.webContents.reload).toHaveBeenCalledTimes(1);
    expect(isExpectedRestart(window.webContents)).toBe(true);
    // Only once: a later crash of the same page is a real one.
    expect(isExpectedRestart(window.webContents)).toBe(false);
  });
});
