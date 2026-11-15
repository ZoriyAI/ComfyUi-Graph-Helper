/**
 * Protects the steps the chat shows when the local Ollama model's context window is too small.
 * A person copies these commands into a terminal, so the variable name, the service restart and the
 * closing memory warning must be exact, or the bigger window never takes effect.
 */
import { describe, expect, it } from 'vitest';
import { ollamaWindowSteps } from '../../src/shared/agent/windowHowTo';

describe('how to give Ollama a larger window', () => {
  it('names the variable Ollama reads, the service steps and the memory warning', () => {
    const steps = ollamaWindowSteps(16384);
    expect(steps.map((step) => step.command ?? '').join('\n')).toContain('Environment="OLLAMA_CONTEXT_LENGTH=16384"');
    expect(steps.some((step) => step.command?.includes('systemctl restart ollama'))).toBe(true);
    expect(steps.at(-1)).toEqual({ key: 'chat.windowHow.memory' });
  });
});
