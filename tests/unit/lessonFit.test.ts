/**
 * Which lessons fit the person's ComfyUI (shared/lessons/fit.ts, shown by LessonPanel and MyLessons): a lesson whose
 * nodes are missing, or that continues one that is, does not fit and says which nodes to install, once each, grouped
 * by pack. Also "Do this for me" on a second loader picks another file. A person must not start a lesson they cannot
 * finish on their install, and must be told what to install for it.
 */
import { describe, expect, it } from 'vitest';
import { fitLines, fits, groupGaps, lessonFit, packOf } from '../../src/shared/lessons/fit';
import { fixFor, lessonProgress, type ClassPorts, type LessonGraph } from '../../src/shared/lessons/engine';
import { LESSONS, lessonById } from '../../src/shared/lessons/lessons';
import { CLASSES, VIDEO_CLASSES } from '../fixtures/mcp/fakeMcpServer';

/** The ports of the fake ComfyUI's classes, with or without its video nodes. */
function portsOf(video: boolean): ClassPorts {
  const classes = video ? [...CLASSES, ...VIDEO_CLASSES] : CLASSES;
  const byType = new Map(classes.map((item) => [item.classType, item]));
  return (classType) => {
    const item = byType.get(classType);
    if (!item) return null;
    const inputs = [...Object.keys(item.required ?? {}), ...Object.keys(item.optional ?? {})];
    const names = item.outputName ?? item.output;
    return { inputs, outputs: item.output.map((type, index) => ({ name: names[index] ?? type, type })) };
  };
}

// A translator that returns the key and its values, so a test can read which sentence was chosen.
const t = (key: string, values?: Record<string, unknown>) => `${key}${values ? JSON.stringify(values) : ''}`;

describe('which lessons fit', () => {
  it('a lesson that continues a lesson that does not fit does not fit either, and says which', () => {
    const ports = portsOf(false);
    const promptVideo = lessonFit(lessonById('prompt-video')!, ports);
    expect(promptVideo.blockedBy).toBe('video-text');
    expect(fits(lessonFit(lessonById('lora')!, ports))).toBe(false);
    expect(fits(lessonFit(lessonById('video-fast')!, ports))).toBe(false);
    expect(fits(lessonFit(lessonById('image')!, ports))).toBe(true);
    expect(fits(lessonFit(lessonById('prompt')!, ports))).toBe(true);
    // With the video nodes, every lesson fits.
    for (const lesson of LESSONS) expect(fits(lessonFit(lesson, portsOf(true))), lesson.id).toBe(true);
  });

  it('says each missing node once, grouped by pack, with how many more, and that the person installs them', () => {
    const ports = portsOf(false);
    for (const lesson of LESSONS) {
      const lines = fitLines(lessonFit(lesson, ports), t, (classType) => classType, (id) => id);
      expect(new Set(lines).size, lesson.id).toBe(lines.length);
    }
    const vace = lessonFit(lessonById('wrapper-vace')!, ports);
    // At most two names per pack; the rest is counted. The group with no known pack comes last.
    const { groups } = groupGaps(vace.gaps, (classType) => classType, 2);
    for (const group of groups) expect(new Set(group.names).size).toBe(group.names.length);
    const wrapper = groups.find((group) => group.pack === 'ComfyUI-WanVideoWrapper');
    expect(wrapper?.names).toHaveLength(2);
    expect(groups.at(-1)?.pack).toBeNull();
    const lines = fitLines(lessonFit(lessonById('wrapper')!, ports), t, (classType) => classType, (id) => id);
    expect(lines.some((line) => line.startsWith('lessons.missingPack') && line.includes('ComfyUI-WanVideoWrapper'))).toBe(true);
    expect(lines.at(-1)).toBe('lessons.installYourself');
    expect(packOf('CreateVideo')).toBeNull();
    expect(packOf('MultiTalkModelLoader')).toBe('ComfyUI-WanVideoWrapper');
  });
});

describe('"Do this for me" for a second loader', () => {
  it('chooses a compatible low-noise file and refuses an unrelated or unknown alternative', () => {
    const lesson = lessonById('video-text')!;
    const node = (id: string, unet: string) => ({ id, classType: 'UNETLoader', title: 'Load Diffusion Model', inputs: [], outputs: [{ id: 'out-0', name: 'MODEL', type: 'MODEL' }], values: { unet_name: unet } });
    const graph: LessonGraph = { nodes: [node('1', 'wan2.2_t2v_high_noise.safetensors'), node('2', 'wan2.2_t2v_high_noise.safetensors')], links: [] } as unknown as LessonGraph;
    const progress = lessonProgress(lesson, graph, {}, new Set(['intro']));
    const missing = progress.missing.find((item) => item.kind === 'field' && item.test.kind === 'differs');
    expect(missing).toBeTruthy();
    const options = ['wan2.2_t2v_high_noise.safetensors', 'flux_dev.safetensors', 'wan2.2_t2v_low_noise.safetensors'];
    expect(fixFor(missing!, graph, () => true, () => options)).toMatchObject({ kind: 'set-field', field: 'unet_name', value: 'wan2.2_t2v_low_noise.safetensors' });
    expect(fixFor(missing!, graph, () => true, () => ['wan2.2_t2v_high_noise.safetensors', 'flux_dev.safetensors', 'unknown.safetensors'])).toBeNull();
    expect(fixFor(missing!, graph, () => true)).toBeNull();
  });
});
