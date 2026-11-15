/**
 * The name of a model as a person says it, for the helper's label in the toolbar (Toolbar.tsx), the onboarding card
 * (graph/Onboarding.tsx) and the model log (log/ModelLogDialog.tsx): what a server or a hub calls it
 * ("hf.co/<uploader>/Example-Coder-32B-Instruct-GGUF:Q4_K_M") carries the hub, the uploader, the file
 * format and the quantisation, and only the middle is the model ("Example-Coder-32B-Instruct").
 * A size tag ("example3.1:8b") is part of the name and stays. The full id stays wherever the model is chosen.
 */

/** A quantisation or a number format, as a tag (":Q4_K_M") or a file suffix ("-Q4_K_M", ".f16"). */
const QUANT = /^(?:i?q\d[\w]*|f16|f32|bf16|fp16|fp32|fp8\w*|int[48]|latest)$/i;

/** The short name of a model id; falls back to the full id when stripping would leave nothing. */
export function modelDisplayName(id: string): string {
  const full = id.trim();
  if (!full) return '';
  // The last part of a path or a hub address: "hf.co/<uploader>/<repo>" or "/models/<file>.gguf".
  let name = full.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? full;
  // A tag after a colon: a quantisation goes, a size ("8b", "70b-instruct") stays.
  const colon = name.lastIndexOf(':');
  if (colon > 0 && QUANT.test(name.slice(colon + 1))) name = name.slice(0, colon);
  // The file format.
  name = name.replace(/\.gguf$/i, '').replace(/[-_.]gguf$/i, '');
  // A quantisation written into a file name: "model-Q4_K_M", "model.f16".
  const suffix = /[-_.]([A-Za-z]+\d[\w]*|bf16|fp16|f16|f32)$/.exec(name);
  if (suffix && QUANT.test(suffix[1])) name = name.slice(0, suffix.index);
  return name || full;
}
