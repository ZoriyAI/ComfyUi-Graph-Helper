/**
 * Which nodes a pasted ComfyUI error names, by number and by class.
 *
 * Who uses it: the "Explain a ComfyUI error" dialog (renderer/components/journey/ComfyErrorDialog.tsx), which shows
 * those nodes on the canvas next to the explanations of knowledge/sets/foundations.ts comfyErrorNotes.
 * Why: ComfyUI names a failing node in several ways, depending on where the person copied the error from: the JSON
 * answer of its server ("node_errors": {"12": {"class_type": "KSampler"}}), the red box in its window ("KSampler 12:",
 * "Error occurred when executing KSampler:"), or its terminal ("Failed to validate prompt for output 9",
 * "Prompt outputs failed validation\nKSampler:"). Node numbers of a workflow the app opened are the same numbers.
 * The text is only read; nothing in it is run or sent.
 */

/** A node the error names: by its number, by its class, or both. */
export interface ErrorNodeRef {
  id: string | null;
  classType: string | null;
}

const CLASS = '[A-Z][A-Za-z0-9_+.-]{2,80}';

/** The nodes a ComfyUI error names, each once, in the order the text names them. */
export function errorNodeRefs(text: string): ErrorNodeRef[] {
  const out: ErrorNodeRef[] = [];
  const add = (id: string | null, classType: string | null) => {
    const known = out.find((item) => (id && item.id === id) || (!id && classType && !item.id && item.classType === classType));
    if (known) {
      if (!known.classType && classType) known.classType = classType;
      return;
    }
    out.push({ id, classType });
  };
  // The server's JSON answer: node_errors keyed by node number, each with its class.
  try {
    const start = text.indexOf('{');
    const parsed = start >= 0 ? JSON.parse(text.slice(start)) as { node_errors?: Record<string, { class_type?: unknown }>; node_id?: unknown; node_type?: unknown } : null;
    for (const [id, value] of Object.entries(parsed?.node_errors ?? {})) add(id, typeof value?.class_type === 'string' ? value.class_type : null);
    if (parsed && (typeof parsed.node_id === 'string' || typeof parsed.node_id === 'number')) add(String(parsed.node_id), typeof parsed.node_type === 'string' ? parsed.node_type : null);
  } catch {
    // Not JSON: the patterns below read it.
  }
  const patterns: Array<{ pattern: RegExp; id?: number; classType?: number }> = [
    { pattern: /"node_id"\s*:\s*"?(\d+)"?/g, id: 1 },
    { pattern: new RegExp(`Error occurred when executing (${CLASS}):`, 'g'), classType: 1 },
    { pattern: new RegExp(`^\\s*[*-]?\\s*(${CLASS})\\s+#?(\\d+):?\\s*$`, 'gm'), classType: 1, id: 2 },
    { pattern: new RegExp(`^\\s*[*-]?\\s*(${CLASS}):\\s*$`, 'gm'), classType: 1 },
    { pattern: /Failed to validate prompt for output (\d+)/g, id: 1 },
    { pattern: /(?:\bnode\s*(?:id)?\s*[#:]?\s*|#)(\d{1,6})\b/gi, id: 1 },
  ];
  for (const { pattern, id, classType } of patterns) {
    for (const match of text.matchAll(pattern)) {
      add(id ? match[id] : null, classType ? match[classType] : null);
    }
  }
  return out.slice(0, 20);
}
