/**
 * Where every built-in lesson stands in the programme: its level (0 to 5), the tracks it belongs to and its priority.
 * The groups of the list (lessons.ts LESSON_PATH) say what kind of graph a lesson builds; this table says how far
 * along a person is when they meet it and which specialisation it serves.
 *
 * Who uses it: lessons.ts nextLesson (a lesson more than one level above the one just finished is offered only when
 * nothing nearer is left), navigation.ts (the list by level and by track, the path of a track, related lessons in
 * level order), share/builtin.ts (a lesson file carries level, tracks and priority), the lesson panel, and
 * tests/unit/lessonProgramme.test.ts (every lesson has a level and a track).
 *
 * Why a table apart from the lessons: the levels and tracks follow the programme of the audit of version 1.0.0
 * (levels 0 environment, 1 graph basics, 2 reliable practice, 3 creative specialisation, 4 technical specialisation,
 * 5 projects), and they change with the programme, not with the steps. No import from lessons.ts, so lessons.ts can
 * read it without a cycle.
 */

/** The levels of the programme, from setting up ComfyUI to a finished project. */
export const LESSON_LEVELS = [0, 1, 2, 3, 4, 5] as const;
/** One of LESSON_LEVELS. */
export type LessonLevel = (typeof LESSON_LEVELS)[number];

/** The tracks: the shared base and the specialisations a person chooses after it. */
export const LESSON_TRACKS = ['base', 'image', 'video', 'audio-3d', 'lora', 'api', 'nodes', 'projects'] as const;
/** One of LESSON_TRACKS. */
export type LessonTrack = (typeof LESSON_TRACKS)[number];

/** core: reliability almost everyone needs; pro: the professional core of a track; deep: depth and fast-changing tools. */
export const LESSON_PRIORITIES = ['core', 'pro', 'deep'] as const;
/** One of LESSON_PRIORITIES. */
export type LessonPriority = (typeof LESSON_PRIORITIES)[number];

/** Where one lesson stands in the programme. */
export interface LessonPlace {
  level: LessonLevel;
  tracks: LessonTrack[];
  priority: LessonPriority;
}

const at = (level: LessonLevel, priority: LessonPriority, ...tracks: LessonTrack[]): LessonPlace => ({ level, tracks, priority });

/**
 * Every built-in lesson. Level 1 is what the audit names as the graph basics (comfy-basics, image, prompt,
 * sampler-fields) with the reading of a workflow; level 2 holds the lessons the audit ties to reliable practice
 * (memory, samplers, loaders, a switch, the experiments); every recipe of a model, a technique or a medium is level 3.
 * Lessons that follow one model family or one pack, which change fastest, are "deep".
 */
export const LESSON_PROGRAMME: Readonly<Record<string, LessonPlace>> = {
  // Foundations and first pictures.
  'comfy-basics': at(1, 'core', 'base'),
  image: at(1, 'core', 'base', 'image'),
  prompt: at(1, 'core', 'base', 'image'),
  'sampler-fields': at(1, 'core', 'base', 'image'),
  'read-workflow': at(1, 'core', 'base'),
  vram: at(2, 'core', 'base'),
  refine: at(3, 'pro', 'image'),
  // Video on ComfyUI's own nodes.
  'video-text': at(3, 'pro', 'video'),
  'prompt-video': at(3, 'pro', 'video'),
  'video-image': at(3, 'pro', 'video'),
  lora: at(3, 'pro', 'video', 'lora'),
  'video-fast': at(3, 'pro', 'video'),
  'two-models': at(3, 'pro', 'video'),
  'video-small': at(3, 'pro', 'video'),
  'video-memory': at(3, 'pro', 'video'),
  'video-control': at(3, 'deep', 'video'),
  'video-speech': at(3, 'deep', 'video'),
  'video-ltx': at(3, 'deep', 'video'),
  'video-hunyuan': at(3, 'deep', 'video'),
  'video-kandinsky': at(3, 'deep', 'video'),
  'video-interpolate': at(3, 'pro', 'video'),
  // WanVideoWrapper: one pack, fast-changing.
  wrapper: at(3, 'deep', 'video'),
  'wrapper-image': at(3, 'deep', 'video'),
  'wrapper-vace': at(3, 'deep', 'video'),
  'wrapper-animate': at(3, 'deep', 'video'),
  'wrapper-unianimate': at(3, 'deep', 'video'),
  'wrapper-talk': at(3, 'deep', 'video'),
  'wrapper-duo': at(3, 'deep', 'video'),
  'wrapper-fantasy': at(3, 'deep', 'video'),
  'wrapper-ovi': at(3, 'deep', 'video'),
  'wrapper-recam': at(3, 'deep', 'video'),
  // Picture models.
  sdxl: at(3, 'pro', 'image'),
  tags: at(3, 'pro', 'image'),
  samplers: at(2, 'core', 'base', 'image'),
  loaders: at(2, 'core', 'base', 'image'),
  flux: at(3, 'pro', 'image'),
  'zimage-turbo': at(3, 'deep', 'image'),
  'qwen-image': at(3, 'deep', 'image'),
  'flux2-klein': at(3, 'deep', 'image'),
  sd35: at(3, 'deep', 'image'),
  gguf: at(3, 'deep', 'image'),
  // Video from a reference picture.
  'anchor-start': at(3, 'pro', 'video'),
  'video-flf': at(3, 'pro', 'video'),
  'anchor-reference': at(3, 'deep', 'video'),
  'anchor-parts': at(3, 'pro', 'video'),
  // Packs and tools.
  'video-vhs': at(3, 'pro', 'video'),
  'video-upscale': at(3, 'pro', 'video'),
  'video-remove': at(3, 'pro', 'video'),
  'controlnet-depth': at(3, 'pro', 'image'),
  ipadapter: at(3, 'pro', 'image'),
  detailer: at(3, 'pro', 'image'),
  switch: at(2, 'pro', 'base', 'api'),
  'llm-prompt': at(3, 'deep', 'image', 'api'),
  // Picture techniques.
  img2img: at(3, 'pro', 'image'),
  inpaint: at(3, 'pro', 'image'),
  outpaint: at(3, 'pro', 'image'),
  'mask-text': at(3, 'pro', 'image'),
  upscale: at(3, 'pro', 'image'),
  'hires-fix': at(3, 'pro', 'image'),
  controlnet: at(3, 'pro', 'image'),
  'lora-image': at(3, 'pro', 'image', 'lora'),
  'lora-character': at(3, 'pro', 'image', 'lora'),
  'edit-words': at(3, 'pro', 'image'),
  'style-reference': at(3, 'deep', 'image'),
  'remove-background': at(3, 'pro', 'image'),
  // Sound, 3D, faces.
  'audio-music': at(3, 'pro', 'audio-3d'),
  'audio-sound': at(3, 'pro', 'audio-3d'),
  'audio-speech': at(3, 'pro', 'audio-3d'),
  'audio-foley': at(3, 'pro', 'audio-3d', 'video'),
  'audio-transcribe': at(3, 'pro', 'audio-3d'),
  '3d-image': at(3, 'deep', 'audio-3d'),
  'character-kontext': at(3, 'pro', 'image'),
  'character-series': at(3, 'pro', 'image'),
  'face-same-photo': at(3, 'pro', 'image'),
  'face-swap': at(3, 'pro', 'image'),
  'face-restore': at(3, 'pro', 'image'),
  // Experiments and quality: the first lessons of the new standard.
  'one-factor': at(2, 'core', 'base', 'image'),
  'blind-compare': at(2, 'core', 'base', 'image'),
  // Reliable practice: reading a model card; diagnostics, performance and safety.
  'model-card': at(2, 'core', 'base'),
  'diagnose-missing': at(2, 'core', 'base'),
  'audit-workflow': at(2, 'core', 'base'),
  'partner-cost': at(2, 'core', 'base'),
  // Start and a reliable setup: level 0, before the graph basics.
  'choose-setup': at(0, 'core', 'base'),
  'first-run': at(0, 'core', 'base'),
  'model-library': at(0, 'core', 'base'),
  'first-pack': at(0, 'core', 'base'),
  snapshots: at(0, 'core', 'base'),
  // The daily work cycle: templates, the queue, partial runs, the log, the forms of a workflow file.
  'template-own': at(1, 'core', 'base'),
  'queue-history': at(1, 'core', 'base'),
  'partial-cache': at(1, 'core', 'base'),
  // For adults: behind the switch, never on a path while it is off.
  'adult-image': at(3, 'deep', 'image'),
  'adult-lora': at(3, 'deep', 'image', 'lora'),
  adult: at(3, 'deep', 'video'),
};

/** Where a built-in lesson stands; null for an id the table does not have (a lesson of the person). */
export function lessonPlace(id: string): LessonPlace | null {
  return LESSON_PROGRAMME[id] ?? null;
}

/** The level of a lesson; a lesson the table does not know counts as level 1, the start of the graph basics. */
export function levelOf(id: string): LessonLevel {
  return LESSON_PROGRAMME[id]?.level ?? 1;
}
