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
  'That component is not in the graph.': 'errors.componentMissing',
  'This file is not a Graph Helper project.': 'errors.nativeFormat',
  'The native project file is not valid.': 'errors.nativeShape',
  'The native project repeats a component owner.': 'errors.nativeDuplicate',
  'The project file could not be parsed.': 'errors.parseProject',
  'The project file could not be written.': 'errors.writeProject',
  'Cloud model has no key for this session.': 'errors.cloudKey',
  'Cloud model has no model id.': 'errors.cloudModel',
  'Cloud key is not sent to an http address.': 'errors.cloudHttp',
  'Catalog widget order is not reliable, so those values are not exported.': 'errors.widgetOrder',
  'Local model has no endpoint.': 'errors.localEndpoint',
  'Local model has no model id.': 'errors.localModel',
  'Comfy origin is empty.': 'errors.comfyEmpty',
  'Comfy origin was not read.': 'errors.comfyUnread',
  'MCP server URL is empty.': 'errors.mcpEmpty',
  'MCP server was not read.': 'errors.mcpUnread',
  'MCP server refused the token.': 'errors.mcpToken',
  'MCP server lists no tools.': 'errors.mcpNoTools',
  'OS key storage is not an OS password manager, so a key is not written.': 'errors.secretOs',
  'OS key storage proved encryption.': 'errors.secretProved',
  'OS key storage fell back to an unprotected cipher, so a key is not written.': 'errors.secretFallback',
  'OS key storage did not prove encryption, so a key is not written.': 'errors.secretUnproven',
};

const NATIVE_VERSION_PREFIX = 'Unsupported native project version ';

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

export function translateKnownError(translate: Translator, code: string): string | null {
  const key = ERROR_KEYS[code];
  return key ? translate(key) : null;
}

export function explainError(translate: Translator, code: string): { summary: string; diagnostic: string | null } {
  const key = ERROR_KEYS[code];
  if (key) return { summary: translate(key), diagnostic: null };
  if (code.startsWith(NATIVE_VERSION_PREFIX)) {
    const version = code.slice(NATIVE_VERSION_PREFIX.length).replace(/\.$/, '');
    return { summary: translate('errors.nativeVersion', { version }), diagnostic: redactDiagnostic(code) };
  }
  return { summary: translate('errors.unknown'), diagnostic: redactDiagnostic(code) };
}

export function redactDiagnostic(value: string): string {
  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]+/g, '[redacted]');
}

const MOVE_DIRECTIONS: Record<string, string> = {
  up: 'graph.directionUp',
  down: 'graph.directionDown',
  left: 'graph.directionLeft',
  right: 'graph.directionRight',
};

/** React Flow reports direction as up, down, left, or right. The announcement uses the catalog word. */
export function moveAnnouncement(translate: Translator, direction: string, x: number, y: number): string {
  const key = MOVE_DIRECTIONS[direction];
  return translate('graph.nodeMoved', {
    direction: key ? translate(key) : direction,
    x,
    y,
  });
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
    openProject: {
      title: translate('dialog.openProjectTitle'),
      buttonLabel: translate('dialog.openProjectButton'),
      filter: translate('dialog.projectFilter'),
    },
    saveProject: {
      title: translate('dialog.saveProjectTitle'),
      buttonLabel: translate('dialog.saveProjectButton'),
      filter: translate('dialog.projectFilter'),
    },
  };
}

export function languageOf(read: { source: string; values?: { language?: string } }): AppLanguage {
  if (read.source === 'corrupt') return 'en';
  return read.values?.language === 'en' ? 'en' : 'ru';
}
