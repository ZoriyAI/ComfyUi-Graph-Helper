/** Instance controls in both legacy proxyWidgets and current definition-based ComfyUI files. */
type RecordValue = Record<string, unknown>;
type Data = { comfy?: unknown; promotedWidgets?: unknown; promotedWidgetNames?: unknown } | null | undefined;
const record = (value: unknown): RecordValue | undefined => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : undefined;

/** Projection-only fallback; it never adds obsolete fields to an untouched native document. */
export function promotedWidgetPairs(data: Data): unknown[] {
  const native = record(data?.comfy);
  const legacy = record(native?.properties)?.proxyWidgets;
  return Array.isArray(legacy) ? legacy : Array.isArray(data?.promotedWidgets) ? data.promotedWidgets : [];
}

export function promotedWidgetName(data: Data, index: number): string | undefined {
  const names = data?.promotedWidgetNames;
  if (Array.isArray(names) && typeof names[index] === 'string') return names[index];
  const pairs = promotedWidgetPairs(data); const pair = pairs[index];
  if (!Array.isArray(pair) || typeof pair[1] !== 'string') return undefined;
  const named = record(record(data?.comfy)?.widgets_values_named);
  if (named) {
    const keys = Object.keys(named);
    if (keys.length === pairs.length) return keys[index];
    const qualified = `${pair[0]}::${pair[1]}`;
    if (Object.hasOwn(named, qualified)) return qualified;
  }
  return pairs.filter(entry => Array.isArray(entry) && entry[1] === pair[1]).length === 1 ? pair[1] : undefined;
}

export function promotedWidgetValue(data: Data, index: number): { held: boolean; value: unknown } {
  const native = record(data?.comfy); const named = record(native?.widgets_values_named);
  const name = promotedWidgetName(data, index);
  const values = native?.widgets_values;
  const value = named && name && Object.hasOwn(named, name) ? named[name] : Array.isArray(values) ? values[index] : undefined;
  return { held: value != null, value };
}

export function definitionWidgetPairs(raw: RecordValue): Array<[string, string]> {
  return Array.isArray(raw.widgets) ? raw.widgets.flatMap(value => {
    const entry = record(value);
    return entry && (typeof entry.id === 'string' || typeof entry.id === 'number') && typeof entry.name === 'string' ? [[String(entry.id), entry.name] as [string, string]] : [];
  }) : [];
}
