/**
 * "How to do it" under the small-window advice: the steps that give Ollama on Linux a larger context
 * window, as its FAQ says (docs.ollama.com/faq, checked 2026-11): the server reads OLLAMA_CONTEXT_LENGTH when it
 * starts; installed as a systemd service, the variable goes into the service with `systemctl edit ollama.service`
 * under [Service], then `systemctl daemon-reload` and `systemctl restart ollama`. A one-off start takes it in front
 * of `ollama serve`. The app changes nothing itself: it only tells.
 */
export interface WindowHowToStep {
  /** Catalog key of the sentence for this step. */
  key: string;
  /** A command to copy, when the step has one. */
  command?: string;
}

export function ollamaWindowSteps(tokens: number): WindowHowToStep[] {
  const size = Math.max(4096, Math.round(tokens));
  return [
    { key: 'chat.windowHow.service', command: 'sudo systemctl edit ollama.service' },
    { key: 'chat.windowHow.line', command: `[Service]\nEnvironment="OLLAMA_CONTEXT_LENGTH=${size}"` },
    { key: 'chat.windowHow.restart', command: 'sudo systemctl daemon-reload && sudo systemctl restart ollama' },
    { key: 'chat.windowHow.manual', command: `OLLAMA_CONTEXT_LENGTH=${size} ollama serve` },
    { key: 'chat.windowHow.memory' },
  ];
}
