import { describe, expect, it } from 'vitest';
import { modelDisplayName } from '../../src/renderer/components/shell/modelDisplayName';

// The model names here are invented.
describe('the name of the helper model in the top bar', () => {
  it('keeps the model of a hub address and drops the hub, the uploader, the format and the quantisation', () => {
    expect(modelDisplayName('hf.co/someone/Example2.5-Coder-32B-Instruct-tuned-GGUF:Q4_K_M')).toBe('Example2.5-Coder-32B-Instruct-tuned');
    expect(modelDisplayName('hf.co/other/sample-3-12b-it-GGUF:IQ4_XS')).toBe('sample-3-12b-it');
  });

  it('drops the file path, the .gguf and a quantisation in the file name', () => {
    expect(modelDisplayName('/srv/models/Example-Small-24B-Instruct-Q4_K_M.gguf')).toBe('Example-Small-24B-Instruct');
    expect(modelDisplayName('C:\\models\\sample-4.f16.gguf')).toBe('sample-4');
  });

  it('keeps a size tag, drops "latest"', () => {
    expect(modelDisplayName('example3.1:8b')).toBe('example3.1:8b');
    expect(modelDisplayName('example2.5:latest')).toBe('example2.5');
    expect(modelDisplayName('example3:30b-a3b')).toBe('example3:30b-a3b');
  });

  it('leaves the plain name of a cloud model as it is', () => {
    expect(modelDisplayName('cloud-4o')).toBe('cloud-4o');
    expect(modelDisplayName('models/cloud-2.0-flash')).toBe('cloud-2.0-flash');
    expect(modelDisplayName('cloud-4.1-mini')).toBe('cloud-4.1-mini');
  });

  it('never returns an empty name for something', () => {
    expect(modelDisplayName('')).toBe('');
    expect(modelDisplayName('  ')).toBe('');
    expect(modelDisplayName('Q4_K_M.gguf')).toBe('Q4_K_M');
  });
});
