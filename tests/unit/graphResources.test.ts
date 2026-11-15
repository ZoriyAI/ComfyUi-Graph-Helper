import { describe, expect, it } from 'vitest';
import { assessGraphResources } from '../../src/shared/resources/assess';
import { hardwareOf } from '../../src/main/comfy/hardware';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import type { CatalogView } from '../../src/shared/catalog/types';
import type { GraphSnapshot } from '../../src/shared/workflow/codec';
const G = 1024 ** 3;
const catalog: CatalogView = { nodeTypes: ['UNETLoader', 'KSampler', 'OllamaVision'], nodes: parseObjectInfo({ UNETLoader: { input: { required: { unet_name: [['one.safetensors','two.safetensors']] } }, output: ['MODEL'] } }).nodes, models: [{ directory: 'diffusion_models', name: 'one.safetensors', sizeBytes: 6 * G }, { directory: 'diffusion_models', name: 'two.safetensors', sizeBytes: 8 * G }] };
const load = (id: string, name: string) => ({ id, data: { comfyType: 'UNETLoader', inputs: [], parameters: { unet_name: name }, comfy: { widgets_values: [name] } } });
const snapshot = (nodes: Record<string, any>[]): GraphSnapshot => ({ nodes, edges: [], document: null });
const hardware = hardwareOf('http://127.0.0.1:8188', { system: { ram_total: 32 * G, ram_free: 20 * G, argv: ['private'] }, devices: [{ name: 'GPU', type: 'cuda', vram_total: 12 * G, vram_free: 10 * G }] }, 1000)!;
describe('conservative combined-graph resource assessment', () => {
  it('counts unique weights, includes nested model stages and reports overlap risk without claiming execution', () => {
    const graph = snapshot([load('1', 'one.safetensors'), load('2', 'one.safetensors'), { id: '3', data: { comfyType: 'inner' } }]);
    graph.subgraphs = [{ id: 'inner', name: 'Stage2', inputs: [], outputs: [], nodes: [load('1', 'two.safetensors')], edges: [], raw: {}, nestedIn: null }];
    const result = assessGraphResources(graph, catalog, hardware, 1100); expect(result.models).toHaveLength(2); expect(result.totalWeightFileBytes).toBe(14 * G); expect(result.stages).toHaveLength(3); expect(result.verdict).toBe('risk'); expect(result.reasons).toContain('combined-weights-exceed-free'); expect(JSON.stringify(hardware)).not.toContain('private');
  });
  it('distinguishes missing weights, unknown hardware and reference headroom from runtime success', () => {
    expect(assessGraphResources(snapshot([load('1','gone.safetensors')]), catalog, hardware, 1100).verdict).toBe('blocked');
    expect(assessGraphResources(snapshot([load('1','one.safetensors')]), catalog, null, 1100).verdict).toBe('unknown');
    const reference = assessGraphResources(snapshot([load('1','one.safetensors')]), catalog, hardware, 1100); expect(reference.verdict).toBe('within-reference'); expect(reference).not.toHaveProperty('canRun');
    expect(assessGraphResources(snapshot([load('1','one.safetensors')]), catalog, hardware, 100000).verdict).toBe('unknown');
    expect(assessGraphResources(snapshot([load('1','one.safetensors')]), catalog, { ...hardware, devices: [{ ...hardware.devices[0], free: 0 }] }, 1100).verdict).toBe('risk');
  });
  it('does not infer Ollama memory from ComfyUI model files', () => {
    const result = assessGraphResources(snapshot([{ id: '1', data: { comfyType: 'OllamaVision', parameters: { model: 'vision:latest' } } }]), catalog, hardware, 1100); expect(result.verdict).toBe('unknown'); expect(result.unknownRuntimeModels).toEqual(['OllamaVision']); expect(result.totalWeightFileBytes).toBe(0);
  });
});
