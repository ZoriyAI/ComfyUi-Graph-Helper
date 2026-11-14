import { isSecretField } from '../shared/agent/graph';

/**
 * Before "Save workflow for ComfyUI" and "Save project" write a file: fields that look like a key or a token (an API
 * node's `api_key`, a pasted bearer token) are reported to the person, who chooses to save without those values or
 * as they are. The values never leave main: the renderer gets the node and the field name only. Blanking works on
 * the finished document by value, so the workflow codec is not touched.
 */

export type SecretChoice = 'ask' | 'omit' | 'keep';

export interface SecretField {
  nodeId: string;
  classType: string;
  title: string;
  name: string;
}

interface Found extends SecretField {
  value: string;
}

export function parseSecretChoice(value: unknown): SecretChoice {
  return value === 'omit' || value === 'keep' ? value : 'ask';
}

type Loose = Record<string, unknown>;

/**
 * A value that looks like a key or token by itself, or a key-shaped value (one word of 8+ characters) in a field
 * named like a credential. `token_normalization: mean` or `max_tokens` are not keys.
 */
function looksSecret(name: string, value: string): boolean {
  if (isSecretField('value', value)) return true;
  return isSecretField(name, value) && /^\S{8,}$/.test(value.trim());
}

function record(value: unknown): Loose | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Loose : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

/**
 * Every secret-looking field of a graph snapshot: canvas nodes (`data.parameters`, `data.comfy.widgets_values`) and
 * any ComfyUI node inside it (`widgets_values` of subgraph definitions and the kept raw document). Depth-bounded.
 */
function collect(snapshot: unknown): Found[] {
  const found: Found[] = [];
  const seen = new Set<string>();
  const add = (owner: Loose, name: string, value: unknown) => {
    if (typeof value !== 'string' || !looksSecret(name, value)) return;
    const data = record(owner.data) ?? owner;
    const nodeId = text(owner.id);
    const key = `${nodeId}\n${name}\n${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({
      nodeId,
      classType: text(data.comfyType) || text(owner.type) || text(owner.class_type),
      title: text(data.title) || text(owner.title),
      name,
      value,
    });
  };
  const fields = (owner: Loose, widgets: unknown) => {
    if (Array.isArray(widgets)) widgets.forEach((value, index) => add(owner, `widget[${index}]`, value));
    else if (record(widgets)) for (const [name, value] of Object.entries(record(widgets)!)) add(owner, name, value);
  };
  const walk = (value: unknown, depth: number) => {
    if (depth > 12 || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    const node = value as Loose;
    const data = record(node.data);
    if (data) {
      const named = record(data.parameters);
      if (named && Object.keys(named).length > 0) for (const [name, item] of Object.entries(named)) add(node, name, item);
      else fields(node, record(data.comfy)?.widgets_values);
    }
    if ('widgets_values' in node) fields(node, node.widgets_values);
    for (const [key, child] of Object.entries(node)) {
      if (key === 'parameters' || key === 'widgets_values') continue;
      walk(child, depth + 1);
    }
  };
  walk(snapshot, 0);
  return found;
}

/** What the person is shown: node and field, never the value. */
export function secretFieldsOf(snapshot: unknown): SecretField[] {
  const shown: SecretField[] = [];
  for (const { nodeId, classType, title, name } of collect(snapshot)) {
    if (!shown.some((item) => item.nodeId === nodeId && item.name === name)) shown.push({ nodeId, classType, title, name });
  }
  return shown;
}

/**
 * The document with every secret value of the snapshot blanked: a string equal to one becomes '', and a longer
 * text that contains one (a note that repeats it) loses it. Values shorter than 8 characters are blanked only where
 * they are the whole string, so a short word elsewhere is not cut.
 */
export function withoutSecretValues<T>(document: T, snapshot: unknown): T {
  const values = [...new Set(collect(snapshot).map((item) => item.value))].sort((a, b) => b.length - a.length);
  if (values.length === 0) return document;
  const scrub = (value: unknown, depth: number): unknown => {
    if (typeof value === 'string') {
      if (values.includes(value)) return '';
      let out = value;
      for (const secret of values) if (secret.length >= 8 && out.includes(secret)) out = out.split(secret).join('');
      return out;
    }
    if (depth > 40 || !value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((item) => scrub(item, depth + 1));
    const out: Loose = {};
    for (const [key, child] of Object.entries(value as Loose)) {
      Object.defineProperty(out, key, { value: scrub(child, depth + 1), enumerable: true, writable: true, configurable: true });
    }
    return out;
  };
  return scrub(document, 0) as T;
}

/**
 * The check a file save runs: with no answer yet, the key-like fields (never the values) instead of a document;
 * 'omit' blanks them in the document; 'keep', or a graph without such fields, leaves it as it is.
 */
export function guardSecretsIn<T>(document: T, snapshot: unknown, choice: unknown): { document: T } | { ok: false; secrets: SecretField[] } {
  const decided = parseSecretChoice(choice);
  if (decided === 'keep') return { document };
  const fields = secretFieldsOf(snapshot);
  if (fields.length === 0) return { document };
  if (decided === 'ask') return { ok: false, secrets: fields };
  return { document: withoutSecretValues(document, snapshot) };
}
