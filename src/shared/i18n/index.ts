import i18next, { type InitOptions } from 'i18next';
import { en, ru } from './catalog';
import { redactSecrets } from '../config/draft';

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
  'This file is not a Graph Helper for ComfyUI project.': 'errors.nativeFormat',
  'The native project file is not valid.': 'errors.nativeShape',
  'The native project repeats a component owner.': 'errors.nativeDuplicate',
  'The project file could not be parsed.': 'errors.parseProject',
  'The project file could not be written.': 'errors.writeProject',
  'The disk is full; the change was not saved.': 'errors.storageFull',
  'The change could not be stored.': 'errors.storageFailed',
  'The folder cannot be written to.': 'errors.writeReadOnly',
  'The disk is full.': 'errors.writeDiskFull',
  'The file is too large to open.': 'errors.fileTooLarge',
  'Cloud model has no key for this session.': 'errors.cloudKey',
  'The model list could not be read.': 'errors.modelListUnread',
  'The server did not send the model list in time.': 'errors.modelListTimeout',
  'The server did not answer.': 'errors.modelListUnreachable',
  'The provider refused the key.': 'errors.modelListRefused',
  'The server answered without a model list.': 'errors.modelListShape',
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
  'MCP server requires sign-in.': 'errors.mcpNeedsSignIn',
  'MCP server lists no tools.': 'errors.mcpNoTools',
  'Sign-in did not finish in time.': 'errors.signInTimeout',
  'Sign-in was cancelled in the browser.': 'errors.signInDenied',
  'Sign-in was cancelled.': 'errors.signInCancelled',
  'Sign-in did not finish.': 'errors.signInFailed',
  'The browser could not be opened.': 'errors.signInBrowser',
  'MCP sign-in has expired. Sign in through the browser again.': 'errors.signInAgain',
  'OS key storage is not an OS password manager, so a key is not written.': 'errors.secretOs',
  'OS key storage proved encryption.': 'errors.secretProved',
  'OS key storage fell back to an unprotected cipher, so a key is not written.': 'errors.secretFallback',
  'OS key storage did not prove encryption, so a key is not written.': 'errors.secretUnproven',
  'The proposal payload is not a graph change.': 'proposals.errors.payload',
  'The proposal kind does not match its payload.': 'proposals.errors.kind',
  'Proposal was not found.': 'proposals.errors.missing',
  'The request does not match the schema.': 'proposals.errors.request',
  'Subgraphs need workflow format 1.': 'proposals.errors.subgraphFormat',
  'Node was not found.': 'proposals.errors.nodeMissing',
  'Revision was not found.': 'errors.revisionMissing',
  'A node is already inside a subgraph.': 'proposals.errors.nodeInside',
  'Subgraph definition was not found.': 'proposals.errors.definitionMissing',
  'That node is not a subgraph instance.': 'proposals.errors.notInstance',
  'That port is not on the inner node.': 'proposals.errors.portMissing',
  'That inner input is already connected.': 'proposals.errors.portTaken',
  'Port types cannot be connected.': 'proposals.errors.portType',
  'A boundary slot repeats an inner port.': 'proposals.errors.slotRepeated',
  'Subgraph slot was not found.': 'proposals.errors.slotMissing',
  'Group was not found.': 'proposals.errors.groupMissing',
  'A subgraph cannot be placed inside itself.': 'errors.subgraphInItself',
  'Model metadata could not be read.': 'errors.metadataUnread',
  'Node ports were not updated: the MCP server did not name a ComfyUI address.': 'errors.nodePortsNoUrl',
  'Node ports were not updated: the ComfyUI address the server named is not on this computer or saved in Settings.': 'errors.nodePortsNotAllowed',
  'The key was given for another address.': 'errors.keyOtherAddress',
  'Node names and models were read, but not the inputs and settings of nodes: ComfyUI answers only on its own computer. Run this app on that computer, or enter a ComfyUI address this computer can open in Settings ▸ Connection.': 'errors.nodeDetailsElsewhere',
  'Model metadata reading stopped after 5 failed reads in a row; it continues at the next sync.': 'errors.metadataStopped',
  'MCP catalog page could not be read.': 'errors.mcpPage',
  'MCP server URL must use https unless it is on this machine.': 'errors.mcpHttps',
  // src/main/mcp/client.ts: what is wrong with an MCP address, one sentence each.
  'MCP server URL has no http:// or https:// in front.': 'errors.mcpNoScheme',
  'MCP server URL must start with http:// or https://.': 'errors.mcpProtocol',
  'MCP server URL is not an address.': 'errors.mcpNotAddress',
  'MCP server URL must not carry a user name or password.': 'errors.mcpCredentials',
  'The address answers, but there is no MCP server at this path.': 'errors.mcpNoServerAtPath',
  'This is the address of ComfyUI itself, not of its MCP server.': 'errors.mcpIsComfy',
  'The address answers, but not as an MCP server.': 'errors.mcpNotMcp',
  'Explanations cannot store a secret.': 'errors.explanationSecret',
  'The project record does not match the schema.': 'errors.projectRecord',
  'The request did not come from the app window.': 'errors.untrustedSender',
  'Connection slots must be numbers.': 'errors.slotsNumbers',
  'Connection was not found.': 'errors.connectionMissing',
  'Source node was not found.': 'errors.sourceMissing',
  'Target node was not found.': 'errors.targetMissing',
  'Source handle is not an output on that node.': 'errors.sourceHandle',
  'Target handle is not an input on that node.': 'errors.targetHandle',
  'Catalog widget order does not match widgets_values.': 'errors.widgetOrderMismatch',
  'widgetIndex does not match the catalog widget order.': 'errors.widgetIndexMismatch',
  'widgetIndex is outside widgets_values.': 'errors.widgetIndexOutside',
  'widgetIndex is required when widgets_values is an array.': 'errors.widgetIndexRequired',
};

/** McpRefusedError text carries the tool name; it is translated with the name kept. */
const MCP_REFUSED = /^MCP tool call refused: ([A-Za-z0-9_.-]{1,80}) is not on the read-only list\.$/;

/** AI SDK NoSuchToolError: the model asked for a tool this turn does not offer (a build tool in an Ask turn). */
const UNAVAILABLE_TOOL = /Model tried to call unavailable tool '([A-Za-z0-9_.-]{1,80})'/;
const BUILD_TOOL_NAMES = new Set(['addNode', 'connectNodes', 'setParameter', 'removeNode', 'createSubgraph', 'insertSubgraph', 'annotateNode', 'setComponentDocumentation', 'setProcess']);

/** Sync errors and warnings that carry a host or a catalog section (src/main/mcp/sync.ts). */
const MCP_UNREACHABLE = /^MCP server unreachable: ([A-Za-z0-9.:\[\]_-]{1,255})\.$/;
const MCP_BAD_HOST = /^MCP server URL host is not a valid address: ([A-Za-z0-9.:\[\]_-]{1,255})\.$/;
const MCP_HOST_NOT_FOUND = /^MCP server host was not found: ([A-Za-z0-9.:\[\]_-]{1,255})\.$/;
const MCP_TOO_SLOW = /^MCP server answered too slowly: nothing came within (\d{1,5}) s\.$/;
const COMFY_NOT_RUNNING = /^ComfyUI is not running at ([A-Za-z0-9.:\[\]_-]{1,255}) — node ports were not updated; start ComfyUI and sync again\.$/;
const MCP_SECTION = /^MCP catalog section could not be read: (node classes|node packs|model files)\.$/;
const MODEL_FOLDER = /^Model folder could not be read: ([A-Za-z0-9_.-]{1,80})\.$/;
/** src/main/llm/modelList.ts modelListHttpError. */
const MODEL_LIST_HTTP = /^The server answered HTTP (\d{3}) to the model list request\.$/;
const SECTION_KEYS: Record<string, string> = {
  'node classes': 'sync.section.nodeClasses',
  'node packs': 'sync.section.nodePacks',
  'model files': 'sync.section.modelFiles',
};

function translatePattern(translate: Translator, code: string): string | null {
  const refused = MCP_REFUSED.exec(code);
  if (refused) return translate('errors.mcpRefused', { tool: refused[1] });
  const unreachable = MCP_UNREACHABLE.exec(code);
  if (unreachable) return translate('errors.mcpUnreachable', { host: unreachable[1] });
  const badHost = MCP_BAD_HOST.exec(code);
  if (badHost) return translate('errors.mcpBadHost', { host: badHost[1] });
  const notFound = MCP_HOST_NOT_FOUND.exec(code);
  if (notFound) return translate('errors.mcpHostNotFound', { host: notFound[1] });
  const slow = MCP_TOO_SLOW.exec(code);
  if (slow) return translate('errors.mcpTooSlow', { seconds: slow[1] });
  const comfy = COMFY_NOT_RUNNING.exec(code);
  if (comfy) return translate('errors.comfyNotRunning', { host: comfy[1] });
  const listHttp = MODEL_LIST_HTTP.exec(code);
  if (listHttp) return translate('errors.modelListHttp', { status: listHttp[1] });
  const section = MCP_SECTION.exec(code);
  if (section) return translate('errors.mcpSection', { section: translate(SECTION_KEYS[section[1]]) });
  const folder = MODEL_FOLDER.exec(code);
  if (folder) return translate('errors.modelFolderUnread', { folder: folder[1] });
  const unavailable = UNAVAILABLE_TOOL.exec(code);
  if (unavailable) {
    return BUILD_TOOL_NAMES.has(unavailable[1])
      ? translate('errors.buildToolInAsk', { tool: unavailable[1] })
      : translate('errors.toolUnavailable', { tool: unavailable[1] });
  }
  return null;
}

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
    // A text that did not get one of its values shows "…" there, never the placeholder itself ("{{done}}").
    missingInterpolationHandler: () => '…',
    returnNull: false,
  };
  (options as InitOptions & { initImmediate: boolean }).initImmediate = false;
  instance.init(options);
  return (key, options) => String(instance.t(key, options ?? {}));
}

export function translateKnownError(translate: Translator, code: string): string | null {
  const key = ERROR_KEYS[code];
  return key ? translate(key) : translatePattern(translate, code);
}

export function explainError(translate: Translator, code: string): { summary: string; diagnostic: string | null } {
  const key = ERROR_KEYS[code];
  if (key) return { summary: translate(key), diagnostic: null };
  const pattern = translatePattern(translate, code);
  if (pattern) return { summary: pattern, diagnostic: null };
  if (code.startsWith(NATIVE_VERSION_PREFIX)) {
    const version = code.slice(NATIVE_VERSION_PREFIX.length).replace(/\.$/, '');
    return { summary: translate('errors.nativeVersion', { version }), diagnostic: redactDiagnostic(code) };
  }
  return { summary: translate('errors.unknown'), diagnostic: redactDiagnostic(code) };
}

export function redactDiagnostic(value: string): string {
  return redactSecrets(value.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]'));
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
