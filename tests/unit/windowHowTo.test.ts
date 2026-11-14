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
