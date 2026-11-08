import i18next, { type InitOptions } from 'i18next';
import { en, ru } from './catalog';

export { en, ru } from './catalog';
export type { Catalog } from './catalog';

export type AppLanguage = 'en' | 'ru';

export function catalogLeaves(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value == null) return prefix ? [prefix] : [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => catalogLeaves(child, prefix ? `${prefix}.${key}` : key));
}

export type Translator = (key: string, options?: Record<string, unknown>) => string;

const ERROR_KEYS: Record<string, string> = {
  'Settings cannot store a secret': 'errors.secret',
  'Settings do not match the schema': 'errors.schema',
  'Workflow JSON could not be parsed.': 'errors.parseWorkflow',
  'The workflow file could not be written.': 'errors.writeWorkflow',
  'Catalog JSON could not be parsed.': 'errors.parseCatalog',
  'Catalog snapshot could not be read.': 'errors.readCatalog',
  'Catalog snapshot is not object_info.': 'errors.catalogShape',
  'Catalog snapshot is too large.': 'errors.catalogSize',
  'Project is not ready.': 'errors.project',
  'API prompt is not a canvas workflow.': 'errors.apiPrompt',
  'Workflow JSON is not UI format 1 or legacy 0.4.': 'errors.workflowFormat',
  'Import was rejected.': 'errors.rejected',
  'Export failed.': 'errors.exportFailed',
};

export function createTranslator(language: AppLanguage): Translator {
  const instance = i18next.createInstance();
  const options: InitOptions = {
    resources: {
      en: { translation: en },
      ru: { translation: ru },
    },
    lng: language,
    fallbackLng: 'en',
    supportedLngs: ['en', 'ru'],
    load: 'currentOnly',
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  };
  (options as InitOptions & { initImmediate: boolean }).initImmediate = false;
  instance.init(options);
  return (key, options) => String(instance.t(key, options ?? {}));
}

export function explainError(translate: Translator, code: string): { summary: string; diagnostic: string | null } {
  const key = ERROR_KEYS[code];
  if (key) return { summary: translate(key), diagnostic: null };
  return { summary: translate('errors.unknown'), diagnostic: redactDiagnostic(code) };
}

export function redactDiagnostic(value: string): string {
  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\bsk-[A-Za-z0-9]+/g, '[redacted]');
}

export function formatClock(timestamp: number, language: AppLanguage, timeZone?: string): string {
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(timestamp);
}

export function fileDialogCopy(language: AppLanguage) {
  const translate = createTranslator(language);
  return {
    importWorkflow: {
      title: translate('dialog.importTitle'),
      buttonLabel: translate('dialog.importButton'),
      filter: translate('dialog.workflowFilter'),
    },
    importCatalog: {
      title: translate('dialog.catalogTitle'),
      buttonLabel: translate('dialog.importButton'),
      filter: translate('dialog.catalogFilter'),
    },
    exportWorkflow: {
      title: translate('dialog.exportTitle'),
      buttonLabel: translate('dialog.exportButton'),
      filter: translate('dialog.workflowFilter'),
    },
  };
}

export function languageOf(read: { source: string; values?: { language?: string } }): AppLanguage {
  if (read.source === 'corrupt') return 'en';
  return read.values?.language === 'en' ? 'en' : 'ru';
}
