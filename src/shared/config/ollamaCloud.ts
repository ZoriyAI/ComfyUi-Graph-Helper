/**
 * Ollama's cloud models: Ollama runs some models on its own servers and serves them through the local Ollama program
 * under names such as `gemma4:cloud` or `gpt-oss:120b-cloud`. A person who picks "Your own server" with such a name
 * still talks to the Ollama on their computer, but the question and the graph leave the computer through it.
 *
 * Who uses it: every place in the window that says where an answer comes from or what leaves the computer (the
 * provider chip in the toolbar, Settings ▸ Assistant, Settings ▸ Privacy, the conversation log). They all ask
 * `answerPlace` so one rule decides; there is deliberately no setting to mark such a model as local.
 */

/**
 * True when a model name follows Ollama's naming for cloud models: the tag (after the last `:`) is `cloud` or ends
 * in `-cloud`, or the name itself ends in `-cloud`. Kept narrow on purpose: `cloudy:7b` or `x:8b` are local names,
 * and a name that merely mentions clouds elsewhere is not matched.
 */
export function isOllamaCloudModel(model: string): boolean {
  const name = model.trim().toLowerCase();
  if (name === '') return false;
  // The tag starts at the last ':' after the last '/' (an `org/name:tag` or `host:port/org/name` form).
  const slash = name.lastIndexOf('/');
  const colon = name.lastIndexOf(':');
  const hasTag = colon > slash;
  const base = (hasTag ? name.slice(slash + 1, colon) : name.slice(slash + 1));
  const tag = hasTag ? name.slice(colon + 1) : '';
  return tag === 'cloud' || tag.endsWith('-cloud') || base.endsWith('-cloud');
}

/**
 * Where a question goes, for what the window says about it:
 * `none` no assistant; `test` the scripted test helper (nothing leaves the app); `local` your own server;
 * `ollama-cloud` your own server with an Ollama cloud model (the request goes to the local address, then on to
 * Ollama's cloud); `cloud` a cloud provider.
 */
export type AnswerPlace = 'none' | 'test' | 'local' | 'ollama-cloud' | 'cloud';

/** The place of a provider and its model. A cloud model name on your own server is never `local`. */
export function answerPlace(provider: string, model: string): AnswerPlace {
  if (provider === '') return 'none';
  if (provider === 'test') return 'test';
  if (provider === 'local') return isOllamaCloudModel(model) ? 'ollama-cloud' : 'local';
  return 'cloud';
}
