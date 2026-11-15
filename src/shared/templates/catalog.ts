/** Pinned official native blueprints, shared by the wizard and the agent. No downloads or execution here. */
import bundleA from './blueprints-a.json';
import bundleB from './blueprints-b.json';
const bundled = [...bundleA, ...bundleB];
import provenance from './provenance.json';
import { projectWorkflow } from '../workflow/codec';
import { editorKind } from '../workflow/comfyLook';
import type { SubgraphDefinition } from '../graph/subgraphs';

export type TemplateFamily = 'image' | 'video' | 'audio' | '3d' | 'text';
export type TemplateLocale = 'ru' | 'en';
export interface Blueprint {
  id: string; title: Record<TemplateLocale, string>; description: Record<TemplateLocale, string>;
  family: TemplateFamily; category: string; workflow: Record<string, any>;
}
const RU: Record<string, string> = {
  image_edit: 'Редактирование фото по описанию', text_to_image: 'Картинка из текста',
  get_any_video_frame: 'Фото из видео: выбрать кадр', first_last_frame_to_video: 'Видео между первым и последним кадром',
  merge_videos: 'Объединить видеоклипы', video_stitch: 'Склеить видео', frame_interpolation: 'Плавность видео: промежуточные кадры',
  color_adjustment: 'Коррекция цвета', brightness_and_contrast: 'Яркость и контраст', chromatic_aberration: 'Хроматическая аберрация',
  color_balance: 'Цветовой баланс', color_curves: 'Цветовые кривые', crop_images_2x2: 'Разделить изображение на 2 × 2',
  crop_images_3x3: 'Разделить изображение на 3 × 3', edge_preserving_blur: 'Размытие с сохранением контуров',
  film_grain: 'Плёночное зерно', glow: 'Свечение', hue_and_saturation: 'Цветовой тон и насыщенность',
  image_blur: 'Размытие изображения', image_channels: 'Каналы изображения', image_levels: 'Уровни изображения',
  sharpen: 'Резкость', unsharp_mask: 'Контурная резкость', split_image_grid_to_tiles: 'Разделить сетку на изображения',
  prompt_enhance: 'Улучшить описание с Gemini', select_per_line_text_by_index: 'Выбрать строку текста по номеру',
};
const PHRASES: Array<[string, string]> = [
  ['First-Last-Frame to Video', 'Видео между первым и последним кадром'], ['Text to Image', 'Картинка из текста'],
  ['Image to Video', 'Видео из фото'], ['Text to Video', 'Видео из текста'], ['Image Edit', 'Фото из фото: редактирование'],
  ['Image Inpainting', 'Изменить область фото по маске'], ['Image Outpainting', 'Достроить края фото'],
  ['Image to Layers', 'Разложить фото на слои'], ['Image to 3D Model', '3D-модель из фото'], ['Image to Model', '3D-модель из фото'],
  ['Remove Background', 'Удалить фон'], ['Image Depth Estimation', 'Карта глубины из фото'], ['Video Depth Estimation', 'Карта глубины из видео'],
  ['Image to Depth Map', 'Карта глубины из фото'], ['Image to Pose Map', 'Карта позы из фото'], ['Video to Pose Map', 'Карта позы из видео'],
  ['Image Face Detection', 'Найти лица на фото'], ['Video Face Detection', 'Найти лица в видео'],
  ['Image Segmentation', 'Маски объектов на фото'], ['Video Segmentation', 'Маски объектов в видео'],
  ['Geometry Estimation', 'Оценка геометрии'], ['Image to Gaussian Splat', 'Объёмная сцена из фото'],
  ['Video Inpainting', 'Изменить область видео по маске'], ['Video Inpaint', 'Изменить область видео по маске'],
  ['Video Edit', 'Редактирование видео'], ['Motion Transfer', 'Перенос движения'], ['Character Replacement', 'Замена персонажа'],
  ['Canny to Image', 'Картинка по контурам Canny'], ['Depth to Image', 'Картинка по глубине'], ['Pose to Image', 'Картинка по позе'],
  ['Canny to Video', 'Видео по контурам Canny'], ['Depth to Video', 'Видео по глубине'], ['Pose to Video', 'Видео по позе'],
  ['Control to Image', 'Управляемое создание картинки'], ['Image Style Reference', 'Картинка по образцу стиля'],
  ['Video Upscale', 'Увеличить разрешение видео'], ['Image Upscale', 'Увеличить разрешение фото'],
  ['Upscale Video', 'Увеличить разрешение видео'], ['Audio Generation', 'Создать звук'], ['Text to Audio', 'Звук и музыка из текста'],
  ['Text to Music', 'Музыка из текста'], ['Image Captioning', 'Описание изображения'], ['Video Captioning', 'Описание видео'],
  ['Video Generation', 'Создать видео'],
];
function titleRu(id: string, title: string): string { return RU[id] ?? PHRASES.reduce((text, [from, to]) => text.replace(new RegExp(from, 'ig'), to), title); }
function familyOf(id: string, category: string): TemplateFamily {
  if (/video|frame_interpolation/.test(id)) return 'video';
  if (/audio|music/.test(id)) return 'audio';
  if (/3d|geometry|gaussian/.test(`${id} ${category}`.toLowerCase())) return '3d';
  if (/text tools/i.test(category)) return 'text';
  return 'image';
}
export const BLUEPRINT_SOURCE = provenance;
export const BLUEPRINTS: readonly Blueprint[] = (bundled as unknown as Array<{ id: string; title: string; description: string; category: string; workflow: Record<string, any> }>).map((entry) => {
  const ru = titleRu(entry.id, entry.title);
  return { ...entry, title: { en: entry.title, ru }, description: { en: entry.description, ru: `${ru}. Готовый внутренний граф ComfyUI; подключите исходные данные, выберите модели и настройте параметры.`, }, family: familyOf(entry.id, entry.category) };
});
export const blueprintById = (id: string) => BLUEPRINTS.find((entry) => entry.id === id);
export interface BlueprintFacts {
  definition: SubgraphDefinition; definitions: SubgraphDefinition[];
  inputs: Array<{ name: string; type: string }>; outputs: Array<{ name: string; type: string }>;
  classes: string[]; models: Array<{ name: string; directory: string; url?: string }>;
  packs: string[]; api: boolean;
}
const factsCache = new Map<string, BlueprintFacts>();
/** Only actual native nodes/definitions count. Cached extra.prompt never supplies dependencies. */
export function blueprintFacts(entry: Blueprint): BlueprintFacts {
  const cached = factsCache.get(entry.id); if (cached) return cached;
  const parsed = projectWorkflow(entry.workflow); if ('error' in parsed) throw Error(parsed.error);
  const definitions = parsed.snapshot.subgraphs ?? [];
  const rootType = parsed.snapshot.nodes[0]?.data.comfyType;
  const definition = definitions.find((item) => item.id === rootType); if (!definition) throw Error(`Blueprint definition is missing: ${entry.id}`);
  const local = new Set(definitions.map((item) => item.id));
  const nodes = definitions.flatMap((item) => item.nodes).filter((node) => !local.has(node.data.comfyType));
  const classes = [...new Set(nodes.map((node) => String(node.data.comfyType)).filter((type) => !editorKind(type)))].sort();
  const models = new Map<string, { name: string; directory: string; url?: string }>(); const packs = new Set<string>();
  for (const node of nodes) {
    const raw = node.data.comfy ?? {}; const props = raw.properties ?? {};
    if (typeof props.cnr_id === 'string') packs.add(props.cnr_id);
    for (const model of Array.isArray(props.models) ? props.models : []) if (typeof model.name === 'string' && typeof model.directory === 'string') models.set(`${model.directory}/${model.name}`, { name: model.name, directory: model.directory, ...(typeof model.url === 'string' && /^https?:\/\//.test(model.url) ? { url: model.url } : {}) });
    // Older native templates name loader files without properties.models; these positions are native loader schemas.
    const loaders: Record<string, string[]> = { UNETLoader: ['diffusion_models'], CLIPLoader: ['text_encoders'], DualCLIPLoader: ['text_encoders', 'text_encoders'], VAELoader: ['vae'], CheckpointLoaderSimple: ['checkpoints'], ImageOnlyCheckpointLoader: ['checkpoints'], LoraLoader: ['loras'], LoraLoaderModelOnly: ['loras'], ControlNetLoader: ['controlnet'], UpscaleModelLoader: ['upscale_models'] };
    (loaders[node.data.comfyType] ?? []).forEach((directory, index) => { const name = raw.widgets_values?.[index]; if (typeof name === 'string' && /\.(safetensors|sft|ckpt|pt|pth|bin|gguf)$/i.test(name)) models.set(`${directory}/${name}`, models.get(`${directory}/${name}`) ?? { name, directory }); });
  }
  const api = classes.some((type) => /gemini|minimax|ideogram|krea2|krea_2|api_|gpt|openai|seedream/i.test(type));
  const facts = { definition, definitions, inputs: definition.inputs.map((p) => ({ name: String(p.raw?.label ?? p.name), type: p.type })), outputs: definition.outputs.map((p) => ({ name: String(p.raw?.label ?? p.name), type: p.type })), classes, models: [...models.values()], packs: [...packs].sort(), api };
  factsCache.set(entry.id, facts); return facts;
}
export const TYPE_HELP: Record<string, Record<TemplateLocale, string>> = {
  IMAGE: { en: 'Pixels or a batch of frames. Connect an image source here.', ru: 'Пиксели картинки или кадры. Подключите источник изображения.' },
  MASK: { en: 'Grayscale selection of the area to change. Check the template for mask polarity.', ru: 'Чёрно-белая маска области. Сверьте, какая часть маски изменяется в этом шаблоне.' },
  VIDEO: { en: 'Video object containing frames, frame rate and optional sound.', ru: 'Видео: кадры, частота и, при наличии, звук.' },
  AUDIO: { en: 'Sound samples and sample rate.', ru: 'Звуковой сигнал и частота дискретизации.' },
  LATENT: { en: 'Encoded samples, not displayable pixels; VAE converts them.', ru: 'Закодированное представление, не готовая картинка. VAE преобразует его в пиксели и обратно.' },
  STRING: { en: 'Text: describe the wanted result.', ru: 'Текст: опишите нужный результат.' },
  COMBO: { en: 'Choose a value in the control, often an installed model filename.', ru: 'Выбор значения в поле, часто имени установленной модели.' },
  INT: { en: 'Whole number: frame index, dimensions, seed or length.', ru: 'Целое число: номер кадра, размер, seed или длина.' },
  FLOAT: { en: 'Numeric setting such as strength or scale.', ru: 'Числовая настройка, например сила воздействия или масштаб.' },
  BOOLEAN: { en: 'Enable or disable an option.', ru: 'Включить или выключить опцию.' },
  MESH: { en: '3D geometry; connect an appropriate mesh preview or save node.', ru: '3D-геометрия; подключите подходящую ноду просмотра или сохранения.' },
};
