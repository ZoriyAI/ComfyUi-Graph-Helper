/**
 * Reading a pasted ComfyUI error (shared/journey/comfyError.ts, behind ComfyErrorDialog): the nodes it names are found
 * in the server's JSON answer, in the red box text and in the terminal log, so the dialog can find them on the canvas
 * (a number names one node, a class every node of it). A person pastes whatever they have, so all three shapes must work, and a text with no node names none.
 */
import { describe, expect, it } from 'vitest';
import { errorNodeRefs } from '../../../src/shared/journey/comfyError';
import { comfyErrorNotes } from '../../../src/shared/knowledge/sets/foundations';

describe('nodes a ComfyUI error names', () => {
  it('reads the server JSON answer', () => {
    const text = JSON.stringify({ error: { type: 'prompt_outputs_failed_validation', message: 'Prompt outputs failed validation' }, node_errors: { 12: { errors: [{ message: 'Required input is missing' }], class_type: 'KSampler' } } });
    expect(errorNodeRefs(text)).toContainEqual({ id: '12', classType: 'KSampler' });
  });

  it('reads the red box and the terminal', () => {
    expect(errorNodeRefs('Error occurred when executing VAEDecode:\n\nCUDA out of memory')).toContainEqual({ id: null, classType: 'VAEDecode' });
    const terminal = 'Failed to validate prompt for output 9:\n* CheckpointLoaderSimple 4:\n  - Value not in list: ckpt_name: missing.safetensors';
    const refs = errorNodeRefs(terminal);
    expect(refs).toContainEqual({ id: '9', classType: null });
    expect(refs).toContainEqual({ id: '4', classType: 'CheckpointLoaderSimple' });
  });

  it('names nothing in a text without nodes, and the built-in notes still explain known messages', () => {
    expect(errorNodeRefs('Something went wrong')).toEqual([]);
    expect(comfyErrorNotes('Value not in list: ckpt_name: x.safetensors', 'en').length).toBeGreaterThan(0);
  });
});
