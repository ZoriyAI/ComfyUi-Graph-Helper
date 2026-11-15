import type { FileRow } from './files';

/**
 * The kinds of file the lessons of the later sets ask for, as their authors listed them (the image-techniques,
 * foundations and sound-3d-faces sets have no table of their own yet). The registry in lessons.ts puts each row
 * into its lesson with withFileTable, the same way it puts the video set's VIDEO_FILE_KINDS.
 */
export const SET_FILE_KINDS: Readonly<Record<string, ReadonlyArray<FileRow>>> = {
  detailer: [{ role: 'detector', field: 'model_name', has: [], any: ['face', 'hand'] }],
  'llm-prompt': [{ role: 'llmClip', field: 'clip_name', has: [], any: ['qwen', 'gemma'] }],
  'audio-music': [{ role: 'checkpoint', field: 'ckpt_name', has: ['ace_step'] }],
  'audio-sound': [{ role: 'checkpoint', field: 'ckpt_name', has: ['stable', 'audio'] }, { role: 'clip', field: 'clip_name', has: ['t5', 'base'] }],
  'audio-foley': [{ role: 'model', field: 'mmaudio_model', has: ['44k'] }, { role: 'features', field: 'vae_model', has: ['44k'] }],
  '3d-image': [{ role: 'checkpoint', field: 'ckpt_name', has: ['hunyuan3d'] }],
  'character-kontext': [
    { role: 'model', field: 'unet_name', has: ['kontext'] },
    { role: 'clip', field: 'clip_name1', has: ['clip_l'] },
    { role: 'clip', field: 'clip_name2', has: ['t5xxl'] },
    { role: 'vae', field: 'vae_name', has: ['ae'], not: ['sdxl', 'wan', 'qwen', 'flux2', 'taesd'] },
  ],
  // "none" is in the list of restore models: a lesson that restores a face needs a model.
  'face-restore': [{ role: 'restore', field: 'model', has: [], not: ['none'] }],
  'face-swap': [{ role: 'swap', field: 'face_restore_model', has: [], not: ['none'] }],
};
