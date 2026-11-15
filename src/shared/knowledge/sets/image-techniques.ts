/**
 * The knowledge set on picture techniques (inpainting, upscaling, ControlNet, LoRA, editing by words, masks, removing
 * a background, detailers): where its facts come from (a docs.comfy.org page for ComfyUI's own classes, the
 * repository for a pack's) and its texts in both languages turned into the KnowledgeSet that coreKnowledge.ts
 * registers in KNOWLEDGE_SETS, so that node cards, the inspector, the glossary and the assistant can explain them.
 */
import type { ConceptTexts, CoreTexts, KnowledgeLanguage, KnowledgeSet, KnowledgeSetDocs, PackTexts } from '../coreKnowledge';
import { IMAGE_TECHNIQUES_KNOWLEDGE_EN } from './image-techniques.en';
import { IMAGE_TECHNIQUES_KNOWLEDGE_RU } from './image-techniques.ru';

/** A kind of model file or a technique that is not one node: what it is, and what does not mix. */
export interface TopicTexts {
  what: string;
  risk?: string;
}

/** The texts of the set as they are written: nodes, packs, topics by id, fields by "ClassType.field". */
export interface TechniqueTexts {
  nodes: Record<string, CoreTexts>;
  packs: Record<string, PackTexts>;
  topics: Record<string, TopicTexts>;
  fields: Record<string, string>;
}

const DOCS = 'https://docs.comfy.org/built-in-nodes';
const REPO = 'https://github.com';

/** The repository of each pack this set speaks of. */
export const IMAGE_TECHNIQUE_PACK_SOURCES: Record<string, string> = {
  comfyui_controlnet_aux: `${REPO}/Fannovel16/comfyui_controlnet_aux`,
  'ComfyUI-Advanced-ControlNet': `${REPO}/Kosinkadink/ComfyUI-Advanced-ControlNet`,
  ComfyUI_IPAdapter_plus: `${REPO}/cubiq/ComfyUI_IPAdapter_plus`,
  'ComfyUI-Impact-Pack': `${REPO}/ltdrdata/ComfyUI-Impact-Pack`,
  'ComfyUI-Impact-Subpack': `${REPO}/ltdrdata/ComfyUI-Impact-Subpack`,
  'ComfyUI-Inpaint-CropAndStitch': `${REPO}/lquesada/ComfyUI-Inpaint-CropAndStitch`,
  'ComfyUI-segment-anything-2': `${REPO}/kijai/ComfyUI-segment-anything-2`,
  'ComfyUI-Florence2': `${REPO}/kijai/ComfyUI-Florence2`,
  'ComfyUI-RMBG': `${REPO}/1038lab/ComfyUI-RMBG`,
  'ComfyUI-WD14-Tagger': `${REPO}/pythongosssss/ComfyUI-WD14-Tagger`,
  'ComfyUI-JoyCaption': `${REPO}/1038lab/ComfyUI-JoyCaption`,
  'ComfyUI-Detail-Daemon': `${REPO}/Jonseed/ComfyUI-Detail-Daemon`,
  'comfyui-prompt-control': `${REPO}/asagi4/comfyui-prompt-control`,
  ComfyUI_LayerStyle: `${REPO}/chflame163/ComfyUI_LayerStyle`,
  'comfyui-propost': `${REPO}/digitaljohn/comfyui-propost`,
  'ComfyUI-Lora-Manager': `${REPO}/willmiao/ComfyUI-Lora-Manager`,
  ComfyUI_UltimateSDUpscale: `${REPO}/ssitu/ComfyUI_UltimateSDUpscale`,
};

/** The classes of packs, by the pack whose source declares them. */
const PACK_CLASSES: Record<string, string> = {
  DepthAnythingV2Preprocessor: 'comfyui_controlnet_aux',
  CannyEdgePreprocessor: 'comfyui_controlnet_aux',
  AIO_Preprocessor: 'comfyui_controlnet_aux',
  IPAdapterUnifiedLoader: 'ComfyUI_IPAdapter_plus',
  IPAdapter: 'ComfyUI_IPAdapter_plus',
  IPAdapterAdvanced: 'ComfyUI_IPAdapter_plus',
  FaceDetailer: 'ComfyUI-Impact-Pack',
  SAMLoader: 'ComfyUI-Impact-Pack',
  UltralyticsDetectorProvider: 'ComfyUI-Impact-Subpack',
  InpaintCropImproved: 'ComfyUI-Inpaint-CropAndStitch',
  InpaintStitchImproved: 'ComfyUI-Inpaint-CropAndStitch',
  DownloadAndLoadSAM2Model: 'ComfyUI-segment-anything-2',
  Sam2Segmentation: 'ComfyUI-segment-anything-2',
  DownloadAndLoadFlorence2Model: 'ComfyUI-Florence2',
  Florence2Run: 'ComfyUI-Florence2',
  'WD14Tagger|pysssss': 'ComfyUI-WD14-Tagger',
  DetailDaemonSamplerNode: 'ComfyUI-Detail-Daemon',
  PCLazyTextEncode: 'comfyui-prompt-control',
};

/**
 * Where each class of the set can be checked: a pack's class links to its repository, ComfyUI's own to its page on
 * docs.comfy.org (every one checked against the sitemap of docs.comfy.org).
 */
export const IMAGE_TECHNIQUES_KNOWLEDGE_DOCS: KnowledgeSetDocs = {
  nodes: Object.fromEntries(Object.keys(IMAGE_TECHNIQUES_KNOWLEDGE_EN.nodes).map((classType) => [
    classType,
    PACK_CLASSES[classType] ? IMAGE_TECHNIQUE_PACK_SOURCES[PACK_CLASSES[classType]] : `${DOCS}/${classType}`,
  ])),
  families: {},
};

/** The name a person reads for each topic in the glossary. */
const TERMS: Record<KnowledgeLanguage, Record<string, string>> = {
  en: {
    'inpainting-models': 'Inpainting models', 'upscale-models': 'Upscale models', controlnets: 'ControlNet models', 'ip-adapter-files': 'IP-Adapter files',
    'style-models': 'Style models (Redux)', 'editing-models': 'Editing models', 'background-removal-models': 'Background removal models',
    'segmentation-models': 'Segmentation models (SAM)', detectors: 'Detectors (YOLO)', 'image-loras': 'LoRA for pictures', 'lora-kinds': 'Kinds of LoRA',
    'lora-strength': 'LoRA strength: model and text encoder', 'lora-several': 'Several LoRAs at once', 'lora-side-effects': 'A LoRA changes more than it promises',
    'seeds-and-batches': 'Seeds and batches', 'saved-workflow': 'The graph inside a saved picture', luts: 'LUT (colour look-up table)',
  },
  ru: {
    'inpainting-models': 'Модели для инпейнтинга', 'upscale-models': 'Модели увеличения', controlnets: 'Модели ControlNet', 'ip-adapter-files': 'Файлы IP-Adapter',
    'style-models': 'Модели стиля (Redux)', 'editing-models': 'Модели для правки', 'background-removal-models': 'Модели удаления фона',
    'segmentation-models': 'Модели сегментации (SAM)', detectors: 'Искатели (YOLO)', 'image-loras': 'LoRA для картинок', 'lora-kinds': 'Виды LoRA',
    'lora-strength': 'Сила LoRA: модель и читатель текста', 'lora-several': 'Несколько LoRA сразу', 'lora-side-effects': 'LoRA меняет больше, чем обещает',
    'seeds-and-batches': 'Seed и пачки', 'saved-workflow': 'Граф внутри сохранённой картинки', luts: 'LUT (таблица цвета)',
  },
};

function toSet(texts: TechniqueTexts, language: KnowledgeLanguage): KnowledgeSet {
  const fields: Record<string, Record<string, string>> = {};
  for (const [key, note] of Object.entries(texts.fields)) {
    const dot = key.indexOf('.');
    const classType = key.slice(0, dot);
    (fields[classType] ??= {})[key.slice(dot + 1)] = note;
  }
  const concepts: Record<string, ConceptTexts> = Object.fromEntries(Object.entries(texts.topics).map(([id, topic]) => [
    id,
    { term: TERMS[language][id] ?? id, text: topic.risk ? `${topic.what} ${topic.risk}` : topic.what },
  ]));
  return { nodes: texts.nodes, linkTypes: {}, families: {}, packs: texts.packs, fields, concepts };
}

export const IMAGE_TECHNIQUES_KNOWLEDGE: Record<KnowledgeLanguage, KnowledgeSet> = {
  en: toSet(IMAGE_TECHNIQUES_KNOWLEDGE_EN, 'en'),
  ru: toSet(IMAGE_TECHNIQUES_KNOWLEDGE_RU, 'ru'),
};

/** The sources as written, for the tests and for anyone who wants the topic's what and risk apart. */
export const IMAGE_TECHNIQUES_TEXTS: Record<KnowledgeLanguage, TechniqueTexts> = { en: IMAGE_TECHNIQUES_KNOWLEDGE_EN, ru: IMAGE_TECHNIQUES_KNOWLEDGE_RU };
