/**
 * Protects the error boundary around the app (renderer/ErrorBoundary): children render as they are until something
 * fails, then a localized card offers Reload and Copy diagnostics with collapsed, redacted details. A person whose
 * window crashed must get a way back and a report they can share without leaking a key.
 */
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { createInstance } from 'i18next';
import ErrorBoundary, { ErrorFallback } from '../../src/renderer/ErrorBoundary';
import { en, ru } from '../../src/shared/i18n';

/** An i18next instance loaded synchronously with the app catalog, for static rendering. */
function translator(language: 'en' | 'ru') {
  const i18n = createInstance();
  void i18n.init({ resources: { en: { translation: en }, ru: { translation: ru } }, lng: language, interpolation: { escapeValue: false }, initImmediate: false } as Parameters<typeof i18n.init>[0]);
  return i18n;
}

function render(element: React.ReactElement, language: 'en' | 'ru' = 'en'): string {
  return renderToStaticMarkup(React.createElement(I18nextProvider, { i18n: translator(language) }, element));
}

describe('error boundary', () => {
  it('passes children through while nothing failed', () => {
    const html = render(React.createElement(ErrorBoundary, null, React.createElement('p', null, 'the app')));
    expect(html).toBe('<p>the app</p>');
  });

  it('renders the fallback card after an error, with details collapsed and redacted', () => {
    // Static rendering cannot throw into a boundary, so the test sets the error state the way React would.
    const boundary = new ErrorBoundary({ children: React.createElement('p', null, 'the app') });
    boundary.state = ErrorBoundary.getDerivedStateFromError(new Error('render failed with sk-ant-abcdefghijklmnop'));
    const html = render(boundary.render() as React.ReactElement);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Something went wrong');
    expect(html).toContain('<details');
    expect(html).not.toContain('<details open');
    expect(html).toContain('Reload');
    expect(html).toContain('Copy diagnostics');
    expect(html).toContain('render failed');
    expect(html).not.toContain('sk-ant-abcdefghijklmnop');
    expect(html).not.toContain('the app');
  });

  it('is localized', () => {
    const html = render(React.createElement(ErrorFallback, { error: new Error('x'), onReload: () => undefined, onCopy: () => undefined }), 'ru');
    expect(html).toContain('Что-то пошло не так');
    expect(html).toContain('Перезагрузить');
    expect(html).toContain('Скопировать диагностику');
  });

  it('turns a thrown non-Error into an Error', () => {
    expect(ErrorBoundary.getDerivedStateFromError('plain').error).toBeInstanceOf(Error);
  });
});
