/**
 * Search that understands the person: Russian words for the English names ComfyUI gives its nodes and models,
 * and one slip of the finger in a longer word. Used by the node search and the model search in main
 * (main/knowledge/repository.ts), so the library and the assistant find the same things.
 *
 * The table maps Russian word stems (as people type them, inflections included through the stem) to the English
 * words that appear in ComfyUI display names, class names, categories and model folders. It was built from the
 * real names: the core nodes, the packs the fake catalog carries (tests/fixtures/mcp/fakeMcpServer.ts) and their
 * categories (loaders, conditioning, sampling, latent, image, image/upscaling, image/video, audio …).
 */
import { MATCH_PREFIX, MATCH_SUBSTRING, MATCH_WORD, rankMatch } from './search';

/** The field is exactly the query. Ranked before everything else. */
export const MATCH_EXACT = -1;
/** The query is a Russian word for an English word found in the field: just after the direct matches. */
const SYNONYM_PENALTY = 0.5;
/** One letter wrong, missing, extra or swapped in a word of 5+ letters: after every real match. */
export const MATCH_FUZZY = 3;

/** One group: Russian stems → English words. A stem matches every word that starts with it. */
interface WordGroup {
  ru: string[];
  en: string[];
}

export const RU_WORDS: readonly WordGroup[] = [
  // Generating
  { ru: ['сэмплер', 'семплер', 'самплер', 'сэмплир', 'семплир', 'сэмплинг', 'семплинг'], en: ['sampler', 'ksampler', 'sampling'] },
  { ru: ['генерац', 'генерир', 'рисова', 'нарисова'], en: ['sampler', 'ksampler'] },
  { ru: ['планировщ', 'шедулер', 'расписан'], en: ['scheduler'] },
  { ru: ['шум'], en: ['noise'] },
  { ru: ['шаг'], en: ['step', 'steps'] },
  { ru: ['сид', 'зерн'], en: ['seed'] },
  { ru: ['сдвиг', 'смещен'], en: ['shift'] },
  // Loading and saving
  { ru: ['загруз', 'загрузк', 'загрузчик', 'открыт'], en: ['load', 'loader', 'loaders'] },
  { ru: ['сохран', 'запис'], en: ['save'] },
  { ru: ['чекпоинт', 'чекпойнт', 'контрольн'], en: ['checkpoint', 'checkpoints', 'ckpt'] },
  { ru: ['модел'], en: ['model', 'models'] },
  { ru: ['диффуз'], en: ['diffusion', 'unet'] },
  { ru: ['лора', 'лору', 'лоры', 'лор'], en: ['lora', 'loras'] },
  { ru: ['контролнет', 'контрол-нет', 'контролнэт', 'управляющ'], en: ['controlnet', 'control'] },
  { ru: ['вае', 'вэа', 'ваэ'], en: ['vae'] },
  { ru: ['клип'], en: ['clip'] },
  { ru: ['эмбед', 'эмбединг', 'эмбеддинг', 'встраиван'], en: ['embed', 'embeds', 'embedding', 'embeddings'] },
  { ru: ['апскейлер', 'апскейл', 'увелич', 'масштаб', 'укрупн'], en: ['upscale', 'upscaling', 'scale', 'upscaler'] },
  // Text and conditioning
  { ru: ['промпт', 'промт', 'подсказк', 'описани', 'запрос'], en: ['prompt', 'text', 'cliptextencode'] },
  { ru: ['текст', 'строк'], en: ['text', 'string'] },
  { ru: ['кондишн', 'кондиционир', 'услови', 'обусловлив'], en: ['conditioning'] },
  { ru: ['объедин', 'соедин', 'смеш', 'смешив', 'комбин'], en: ['combine', 'concat', 'merge'] },
  { ru: ['слой', 'слоя'], en: ['layer'] },
  { ru: ['примен', 'наложи'], en: ['apply'] },
  { ru: ['энкодер', 'энкод', 'кодир', 'кодиров', 'кодировщ'], en: ['encode', 'encoder', 'textencode'] },
  { ru: ['декодер', 'декод', 'раскодир', 'декодир'], en: ['decode', 'decoder'] },
  // Latent and pictures
  { ru: ['латент', 'латентн', 'скрыт'], en: ['latent'] },
  { ru: ['пуст'], en: ['empty'] },
  { ru: ['картин', 'изображ', 'фото', 'снимок', 'кадр'], en: ['image', 'images', 'pixels'] },
  { ru: ['превью', 'просмотр', 'предпросмотр', 'показ', 'посмотр'], en: ['preview', 'display'] },
  { ru: ['вывод', 'отобраз'], en: ['display', 'preview', 'output'] },
  { ru: ['размер', 'ресайз', 'разрешен'], en: ['size', 'resize', 'resolution', 'width', 'height'] },
  { ru: ['ширин'], en: ['width'] },
  { ru: ['высот'], en: ['height'] },
  { ru: ['обрез', 'кадрир'], en: ['crop'] },
  { ru: ['поворот', 'поверн', 'поверну'], en: ['rotate'] },
  { ru: ['отраз', 'зеркал'], en: ['flip', 'mirror'] },
  { ru: ['цвет', 'цвета', 'краск'], en: ['color', 'colour'] },
  { ru: ['размыт', 'размыв'], en: ['blur'] },
  { ru: ['резкост'], en: ['sharpen'] },
  { ru: ['яркост', 'контраст'], en: ['brightness', 'contrast'] },
  { ru: ['сравн'], en: ['compare', 'comparer'] },
  { ru: ['маск'], en: ['mask'] },
  { ru: ['фон'], en: ['background', 'rembg'] },
  { ru: ['дорисов', 'инпейнт', 'перерисов'], en: ['inpaint', 'inpainting'] },
  { ru: ['аутпейнт', 'дострои', 'достраив'], en: ['outpaint', 'pad'] },
  { ru: ['пакет', 'батч', 'партия', 'партии'], en: ['batch'] },
  // Guidance from pictures
  { ru: ['препроцесс', 'предобработ', 'подготов'], en: ['preprocessor', 'preprocessors'] },
  { ru: ['контур', 'край', 'края', 'кромк', 'канни', 'линии', 'линия'], en: ['canny', 'edge', 'line', 'lineart'] },
  { ru: ['глубин', 'глубина'], en: ['depth'] },
  { ru: ['поза', 'позы', 'позу', 'скелет'], en: ['pose', 'openpose', 'dwpose'] },
  { ru: ['лиц'], en: ['face'] },
  { ru: ['детект', 'обнаруж', 'распозна'], en: ['detection', 'detector', 'detect'] },
  // Video and sound
  { ru: ['видео', 'ролик'], en: ['video', 'wanvideo'] },
  { ru: ['кадров', 'частот'], en: ['fps', 'frames', 'frame'] },
  { ru: ['длин', 'длительн'], en: ['length', 'duration'] },
  { ru: ['анимац', 'оживл', 'анимир'], en: ['animate', 'animation'] },
  { ru: ['камер'], en: ['camera'] },
  { ru: ['звук', 'аудио', 'голос', 'речь', 'речи'], en: ['audio', 'wav2vec', 'voice'] },
  { ru: ['говор', 'разговор', 'говорящ'], en: ['talk', 'talking', 'multitalk', 'infinitetalk', 'fantasytalking'] },
  // Values and logic
  { ru: ['числ', 'целое', 'целых'], en: ['int', 'number', 'float'] },
  { ru: ['дробн'], en: ['float'] },
  { ru: ['логич', 'булев', 'да/нет'], en: ['boolean', 'bool'] },
  { ru: ['переключ'], en: ['switch'] },
  { ru: ['выбор', 'выбра', 'выбира'], en: ['select', 'selector'] },
  { ru: ['продвинут', 'расширенн'], en: ['advanced'] },
  { ru: ['стил'], en: ['style'] },
  { ru: ['лучш', 'улучш', 'детализ', 'детал'], en: ['detail', 'enhance', 'refiner'] },
  { ru: ['быстр', 'ускор'], en: ['lightning', 'turbo', 'fast', 'lightx2v'] },
];

/** Lower case, ё as е: the way the table is written. */
export function normalizeWord(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е');
}

/** Levenshtein distance with adjacent swaps, stopping early once it exceeds `limit`. */
export function editDistance(a: string, b: string, limit = 2): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i += 1) {
    rows.push([i]);
    for (let j = 1; j <= b.length; j += 1) rows[i][j] = i === 0 ? j : 0;
  }
  for (let i = 1; i <= a.length; i += 1) {
    let best = Infinity;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, rows[i - 2][j - 2] + 1);
      rows[i][j] = value;
      best = Math.min(best, value);
    }
    if (best > limit) return limit + 1;
  }
  return rows[a.length][b.length];
}

/** Whether a typed word means this stem: it starts with it, is its beginning (typing), or is one slip away. */
function meansStem(word: string, stem: string): boolean {
  if (word.startsWith(stem)) return true;
  if (word.length >= 3 && stem.startsWith(word)) return true;
  if (stem.length >= 5 && word.length >= 5 && editDistance(word.slice(0, stem.length), stem, 1) <= 1) return true;
  return false;
}

/** The English words a Russian (or mixed) query word stands for; empty for a word the table does not know. */
export function englishFor(word: string): string[] {
  const value = normalizeWord(word);
  if (!/[а-я]/.test(value)) return [];
  const found = new Set<string>();
  for (const group of RU_WORDS) {
    if (group.ru.some((stem) => meansStem(value, normalizeWord(stem)))) for (const en of group.en) found.add(en);
  }
  return [...found];
}

const WORD_SPLIT = /[^a-zа-я0-9]+/;

/** One slip in a word of 5+ letters: against each word of the field and each word's beginning of the same length. */
function fuzzyMatches(field: string, word: string): boolean {
  if (word.length < 5) return false;
  for (const part of normalizeWord(field).split(WORD_SPLIT).filter(Boolean)) {
    if (editDistance(part, word, 1) <= 1) return true;
    if (part.length > word.length && editDistance(part.slice(0, word.length), word, 1) <= 1) return true;
    // CamelCase class names are one word ("KSamplerAdvanced"): their beginning counts too.
    if (part.length > word.length + 1 && editDistance(part.slice(0, word.length + 1), word, 1) <= 1) return true;
  }
  return false;
}

/** Rank of one field for one query word: exact, prefix, word, substring, then a Russian word, then one slip. */
export function rankWord(field: string, word: string): number {
  const value = normalizeWord(field);
  const needle = normalizeWord(word);
  if (!needle) return MATCH_PREFIX;
  if (value === needle) return MATCH_EXACT;
  const direct = rankMatch(value, needle);
  if (direct !== Infinity) return direct;
  const english = englishFor(needle);
  let best = Infinity;
  for (const term of english) best = Math.min(best, rankMatch(value, term) + SYNONYM_PENALTY);
  if (best !== Infinity) return best;
  return fuzzyMatches(value, needle) ? MATCH_FUZZY : Infinity;
}

/** Lower-case words of a query. "flux lora" is two words, each of which must match some field. */
export function queryWords(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter((token) => token !== '');
}

/**
 * Sum over the query's words of the best rank any field gives it; Infinity when a word matches no field. Lower is
 * better: an exact name first, then a name that starts with the query, a whole word, a part of a word, a Russian
 * word for it, and last one slip of the finger.
 */
export function rankFields(fields: Array<string | null | undefined>, words: string[]): number {
  let total = 0;
  for (const word of words) {
    let best = Infinity;
    for (const field of fields) best = Math.min(best, rankWord(field ?? '', word));
    if (best === Infinity) return Infinity;
    total += best;
  }
  return total;
}

export { MATCH_PREFIX, MATCH_SUBSTRING, MATCH_WORD };
