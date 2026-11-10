// A small app for the translation audit's own test: each call below is a case the audit must judge. The
// comment after a call says what it must report there (nothing after a call means it must stay silent).
// This file is read by the audit, never run.
declare function t(key: string, values?: Record<string, unknown>): string;
declare const React: { createElement: (...args: unknown[]) => unknown };

type Group = 'file' | 'edit';
type Day = 'today' | 'yesterday' | 'date';

interface StatusView {
  labelKey: string;
  labelParams?: Record<string, number>;
  hintKey: string | null;
}

interface Command {
  id: string;
  labelKey: string;
}

/** The shape of the reported bug: a status label that sometimes carries numbers. */
function statusView(state: 'idle' | 'running', reading: { done: number; total: number } | null): StatusView {
  let labelKey = `status.${state}`;
  let labelParams: Record<string, number> | undefined;
  let hintKey: string | null = null;
  if (reading) {
    labelKey = 'status.reading';
    labelParams = { done: reading.done, total: reading.total };
  } else if (state === 'idle') {
    hintKey = 'status.hint';
  }
  return { labelKey, labelParams, hintKey };
}

const COMMANDS: Command[] = [
  { id: 'open', labelKey: 'menu.file' },
  { id: 'undo', labelKey: 'menu.edit' },
];

const SECTION_KEYS: Record<string, string> = { nodes: 'section.nodes', models: 'section.models' };
const COUNTED_KEYS: Record<string, string> = { plain: 'section.nodes', counted: 'items' };

function kindKey(kind: string): string {
  switch (kind) {
    case 'lora': return 'kind.lora';
    default: return 'kind.other';
  }
}

function greetingKey(named: boolean): string {
  return named ? 'greeting.named' : 'greeting.plain';
}

const tr = (key: string, values?: Record<string, unknown>) => String(t(key, values));

/** A key that arrives as a later argument: followed to what the callers pass. */
function errorText(error: string | undefined, fallbackKey: string): string {
  return error ?? t(fallbackKey);
}

function countedText(error: string | undefined, fallbackKey: string): string {
  return error ?? t(fallbackKey); // dynamic-needs-values
}

function ToolButton({ shortKey }: { shortKey?: string }) {
  return shortKey ? t(shortKey) : null;
}

export function cases(view: StatusView, command: Command, group: Group, day: Day, name: string | undefined, fromOutside: string) {
  const reading = { done: 3, total: 9 };
  return [
    t('status.idle'),
    t('status.reading', { done: reading.done, total: reading.total }),
    t('status.reading', reading),
    t('status.reading'), // missing-values
    t('status.reading', { done: 1 }), // missing-values
    t('status.reading', { done: 1, all: 9 }), // missing-values
    t('no.such.text'), // unknown-key
    t('items', { count: 3 }),
    t('items'), // missing-values
    t(view.labelKey), // dynamic-needs-values
    t(view.labelKey, view.labelParams ?? {}),
    view.hintKey ? t(view.hintKey) : '',
    t(command.labelKey),
    COMMANDS.map((item) => t(item.labelKey)),
    t(`menu.${group}`),
    day === 'date' ? '' : t(`day.${day}`, { time: '14:32' }),
    t(`day.${day}`, { time: '14:32' }), // unknown-key
    t(SECTION_KEYS[fromOutside]),
    t(COUNTED_KEYS[fromOutside]), // dynamic-needs-values
    t(kindKey(fromOutside)),
    t(greetingKey(Boolean(name))), // dynamic-needs-values
    t(greetingKey(Boolean(name)), { name: name ?? '' }),
    t('greeting.named', { name }), // empty-value
    t('greeting.named', { name: name ?? 'you' }),
    tr('status.idle'),
    tr('status.reading'), // missing-values
    tr('greeting.named', { name: 'Ada' }),
    React.createElement(ToolButton, { shortKey: 'menu.file' }),
    <ToolButton shortKey="menu.edit" />,
    errorText(name, 'status.hint'),
    errorText(name, 'section.nodes'),
    countedText(name, 'status.idle'),
    countedText(name, 'status.reading'),
    t(JSON.parse(fromOutside) as string), // unresolved
    t(fromOutside, { anything: 1 }),
  ];
}

export { statusView };
