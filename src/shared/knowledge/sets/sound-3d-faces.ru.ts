import type { KnowledgeSet } from '../coreKnowledge';

/**
 * Встроенные знания о звуке и речи, 3D, лицах и персонажах, по-русски. Английский файл говорит то же самое.
 * Всё, что касается переноса лица или голоса на кого-то, начинается с правила: настоящий человек только с его
 * согласия; никогда в откровенном содержимом; никогда тот, кто выглядит несовершеннолетним.
 */

const RULE = 'Лицо или голос настоящего человека только с его согласия; никогда в откровенном содержимом; никогда того, кто выглядит несовершеннолетним.';
const PACK_CODE = 'Пак запускает чужой код: ставьте его сами через менеджер ComfyUI и только тот, которому доверяете.';
const OLD_FORMAT = 'Файлы старых форматов (.ckpt, .pt, .pth, .bin) могут при загрузке выполнить код: берите их только со страницы самой модели.';

export const SOUND_3D_FACES_KNOWLEDGE_RU: KnowledgeSet = {
  nodes: {
    // Сам ComfyUI: звук.
    'TextEncodeAceStepAudio1.5': {
      what: 'Кодирует описание песни для ACE-Step 1.5: стиль в `tags`, слова для пения в `lyrics`, а ещё темп, длину, размер, тональность и язык песни.',
      why: 'Единственная текстовая нода, которая нужна графу ACE-Step 1.5: всё, какой должна быть песня, говорится здесь.',
      connect: 'Вход: CLIP от чекпойнта ACE-Step или от DualCLIPLoader с типом ace. Выход: CONDITIONING на вход positive сэмплера и в Conditioning Zero Out, которая делает негатив.',
      risk: 'Её duration должна совпадать с seconds пустого латента, иначе песня кончится рано или оборвётся.',
    },
    'EmptyAceStep1.5LatentAudio': {
      what: 'Создаёт пустой звуковой латент, сжатую заготовку, на которой пишет ACE-Step 1.5, заданной длины в секундах.',
      why: 'Начало песни: её seconds задают, сколько песня длится.',
      connect: 'Входы: seconds и batch_size. Выход: LATENT на вход latent_image сэмплера.',
      risk: 'У ACE-Step 1.0 свой пустой латент (EmptyAceStepLatentAudio); они не взаимозаменяемы.',
    },
    VAEDecodeAudio: {
      what: 'VAE Decode Audio: превращает звуковой латент от сэмплера в звуковую волну (AUDIO).',
      why: 'Последний шаг модели в каждом звуковом графе на сэмплере: ACE-Step, Stable Audio.',
      connect: 'Входы: samples от сэмплера и VAE той же модели. Выход: AUDIO для сохранения, прослушивания или Create Video.',
      risk: 'VAE должен быть из того же семейства; VAE для картинок звук не раскодирует.',
    },
    EmptyLatentAudio: {
      what: 'Создаёт пустой звуковой латент для Stable Audio заданной длины в секундах.',
      why: 'Начальная заготовка графа Stable Audio.',
      connect: 'Входы: seconds и batch_size. Выход: LATENT для сэмплера.',
      risk: 'Stable Audio Open 1.0 учили на кусках примерно до 47 секунд; более длинная заготовка заполняется тишиной или шумом.',
    },
    SaveAudioAdvanced: {
      what: 'Save Audio (Advanced): сохраняет звук в папку output (по умолчанию output/audio) в FLAC, MP3 или Opus.',
      why: 'Сохранение, которым пользуются нынешние официальные звуковые шаблоны; оно заменило отдельные ноды для FLAC, MP3 и Opus.',
      connect: 'Входы: audio, filename_prefix и format (с качеством для MP3 и Opus). Выход: тот же AUDIO для ноды, которая работает с ним дальше.',
    },
    PreviewAudio: {
      what: 'Проигрывает звук на ноде в ComfyUI, не сохраняя его.',
      why: 'Чтобы пробовать настройки, ничего не сохраняя.',
      connect: 'Вход: AUDIO. В папку output ничего не пишется.',
    },
    TrimAudioDuration: {
      what: 'Вырезает кусок звука: от start_index (секунды; отрицательное число считает от конца) длиной duration секунд.',
      why: 'Чтобы взять нужную часть записи, например чистый образец голоса.',
      connect: 'Входы: audio, start_index, duration. Выход: AUDIO.',
    },
    AudioConcat: {
      what: 'Concatenate Audio: ставит один звук после другого (или перед ним).',
      why: 'Чтобы склеить куски речи или музыки, сделанные за несколько запусков.',
      connect: 'Входы: audio1, audio2 и direction (after или before). Выход: AUDIO. Моно делается стерео, частоты дискретизации выравниваются.',
    },
    AudioMerge: {
      what: 'Merge Audio: накладывает два звука друг на друга (сложение, среднее, вычитание или умножение).',
      why: 'Чтобы смешать голос с музыкой или эффектами.',
      connect: 'Входы: audio1, audio2 и merge_method. Выход: AUDIO.',
      risk: 'Сложение двух громких звуков может дать перегруз; сначала сделайте один тише нодой Adjust Audio Volume.',
    },
    AudioAdjustVolume: {
      what: 'Adjust Audio Volume: делает звук громче или тише на число децибел (0 без изменений, +6 примерно вдвое громче, -6 вдвое тише).',
      why: 'Чтобы уравнять голос и музыку перед смешиванием.',
      connect: 'Входы: audio и volume. Выход: AUDIO.',
    },
    PreviewAny: {
      what: 'Preview as Text: показывает любое значение текстом на ноде, например текст, записанный Whisper.',
      why: 'Чтобы увидеть результат, который не картинка и не звук.',
      connect: 'Вход: source любого типа. Выход: то же самое как STRING.',
    },
    // Сам ComfyUI: 3D.
    ImageOnlyCheckpointLoader: {
      what: 'Загружает из models/checkpoints чекпойнт модели, которая читает картинки, а не текст: модель, её чтение картинки (CLIP_VISION) и её VAE.',
      why: 'Так устроены файлы Hunyuan3D 2 и моделей «картинка в видео» вроде SVD.',
      connect: 'Вход: ckpt_name. Выходы: MODEL для сэмплера (через сдвиг шума), CLIP_VISION для CLIP Vision Encode, VAE для декодера.',
    },
    Hunyuan3Dv2Conditioning: {
      what: 'Превращает закодированную картинку в позитивное и негативное условие, которое нужно Hunyuan3D 2.',
      why: 'В графе Hunyuan3D картинка и есть всё описание: руками ничего не пишут.',
      connect: 'Вход: clip_vision_output от CLIP Vision Encode. Выходы: positive и negative для сэмплера.',
    },
    EmptyLatentHunyuan3Dv2: {
      what: 'Создаёт пустой латент формы Hunyuan3D 2; resolution задаёт, насколько тонко прорабатывается форма.',
      why: 'Начальная заготовка графа Hunyuan3D: шаблон 2.0 ставит 3072, шаблон 2.1 ставит 4096.',
      connect: 'Входы: resolution и batch_size. Выход: LATENT для сэмплера.',
    },
    VAEDecodeHunyuan3D: {
      what: 'Hunyuan 3D VAE Decode: превращает латент формы в воксельную сетку, пространство из маленьких кубиков внутри или снаружи предмета.',
      why: 'Шаг между сэмплером и сеткой.',
      connect: 'Входы: samples и VAE чекпойнта Hunyuan3D; num_chunks и octree_resolution меняют память на детали. Выход: VOXEL.',
      risk: 'Больший octree_resolution требует намного больше памяти.',
    },
    VoxelToMesh: {
      what: 'Voxel to Mesh: превращает воксельную сетку в сетку из треугольников (меш).',
      why: 'Меш открывают 3D-программы.',
      connect: 'Входы: voxel, algorithm (surface net глаже, basic ступеньками) и threshold (где кончается «внутри»). Выход: MESH.',
    },
    SaveGLB: {
      what: 'Save 3D Model: сохраняет меш или 3D-файл в папку output (по умолчанию 3d/ComfyUI); меш записывается в .glb.',
      why: 'Конец 3D-графа; ComfyUI ещё и показывает сохранённую модель на ноде.',
      connect: 'Входы: mesh (MESH или 3D-файл) и filename_prefix. Файл .glb открывается в Blender, в игровых движках и в любом просмотрщике glTF.',
    },
    // Сам ComfyUI: персонажи и лица.
    PhotoMakerLoader: {
      what: 'Загружает файл PhotoMaker из models/photomaker.',
      why: 'PhotoMaker держит одно лицо через много картинок SDXL, взяв его с нескольких фотографий этого лица.',
      connect: 'Вход: photomaker_model_name. Выход: PHOTOMAKER для PhotoMaker Encode.',
      risk: RULE,
    },
    PhotoMakerEncode: {
      what: 'Вмешивает лицо с картинки в описание: слово «photomaker» в тексте означает это лицо.',
      why: 'Текстовая нода графа PhotoMaker.',
      connect: 'Входы: photomaker, image (лицо), clip (модели SDXL) и text. Выход: CONDITIONING для сэмплера.',
      risk: RULE,
    },
    // ComfyUI-MMAudio.
    MMAudioModelLoader: {
      what: 'Загружает модель MMAudio из models/mmaudio.',
      why: 'MMAudio делает звук видео в такт с его кадрами.',
      connect: 'Входы: mmaudio_model и base_precision. Выход: mmaudio_model для MMAudio Sampler.',
      risk: 'Модели 44k нужен декодер 44k и mode 44k в загрузчике помощников.',
    },
    MMAudioFeatureUtilsLoader: {
      what: 'Загружает модели-помощники MMAudio из models/mmaudio: декодер звука (vae_model), модель, которая сводит звук с кадрами (synchformer_model), и ту, что видит кадры (clip_model).',
      why: 'Сэмплеру нужны все три.',
      connect: 'Входы: три файла, mode (16k или 44k) и precision; по желанию вокодер BigVGAN. Выход: mmaudio_featureutils для сэмплера.',
      risk: 'Режим должен совпадать с моделью и декодером.',
    },
    MMAudioSampler: {
      what: 'Делает звук: смотрит кадры (images), читает необязательный prompt и возвращает AUDIO заданной длины duration.',
      why: 'Сердце графа MMAudio.',
      connect: 'Входы: mmaudio_model, feature_utils, images (по желанию), duration, steps, cfg, seed, prompt и negative_prompt. Выход: audio для сохранения или сборки видео.',
      risk: 'Модель учили на роликах около 8 секунд; на намного более длинных качество падает.',
    },
    // ComfyUI-VideoHelperSuite.
    // ComfyUI_Fill-ChatterBox.
    FL_ChatterboxTTS: {
      what: 'Читает текст вслух моделью Chatterbox; если дать короткую запись голоса, говорит этим голосом.',
      why: 'Речь из текста на своём компьютере, выбранным голосом.',
      connect: 'Входы: text, exaggeration, cfg_weight, temperature, seed; по желанию audio_prompt (голос), use_cpu и keep_model_loaded. Выходы: audio и сообщение.',
      risk: `${RULE} Эта нода говорит по-английски; многоязычная нода пака говорит на 23 языках.`,
    },
    // ComfyUI-Whisper.
    'Apply Whisper': {
      what: 'Записывает речь текстом моделью OpenAI Whisper: текст и время каждой фразы и каждого слова.',
      why: 'Расшифровки и субтитры.',
      connect: 'Входы: audio, model (от tiny до large-v3 и turbo), language (или auto) и prompt. Выходы: text, segments_alignment и words_alignment.',
      risk: 'Лицензия пака не разрешает коммерческое использование.',
    },
    'Save SRT': {
      what: 'Сохраняет разметку времени Whisper файлом субтитров SRT в output/srt.',
      why: 'SRT читает любой видеоплеер и редактор.',
      connect: 'Входы: alignment (фразы или слова от Apply Whisper) и name. Выход: путь к файлу.',
    },
    // ComfyUI-ReActor.
    ReActorRestoreFace: {
      what: 'Restore Face из ReActor: находит лица на картинке и перерисовывает их чёткими моделью восстановления (CodeFormer, GFPGAN, GPEN).',
      why: 'Для старых, маленьких или размытых фотографий и после того, как модель плохо нарисовала лицо.',
      connect: 'Входы: image, facedetection, model (из models/facerestore_models), visibility и codeformer_weight. Выход: IMAGE.',
      risk: 'Модель угадывает детали: результат даёт сходство, а не запись. С model, равным none, ничего не происходит.',
    },
    ReActorFaceSwap: {
      what: 'Fast Face Swap из ReActor: переносит лицо с картинки-источника (или из сохранённой модели лица) на лица другой картинки.',
      why: 'Чтобы держать лицо одного придуманного героя на картинках, нарисованных по отдельности, или вставить на картинку своё лицо.',
      connect: 'Входы: input_image (куда), source_image или face_model (чьё лицо), swap_model, facedetection, face_restore_model и номера лиц. Выходы: картинка с заменой, модель лица и исходная картинка.',
      risk: `${RULE} В паке есть детектор, который отказывается работать с откровенными картинками. Модели InsightFace, которые он использует, только для некоммерческих исследований.`,
    },
    IPAdapterUnifiedLoaderFaceID: {
      what: 'IPAdapter Unified Loader FaceID: загружает по имени пресета адаптер FaceID, его LoRA, чтение картинки и InsightFace и применяет LoRA к модели.',
      why: 'Одна нода вместо четырёх загрузчиков для графа FaceID.',
      connect: 'Входы: model, preset (FACEID, FACEID PLUS V2, FACEID PORTRAIT...), lora_strength и provider. Выходы: MODEL с LoRA и ipadapter, оба для IPAdapter FaceID.',
      risk: `${RULE} Свои файлы она ищет по именам в models/ipadapter, models/loras, models/clip_vision и models/insightface.`,
    },
    IPAdapterFaceID: {
      what: 'IPAdapter FaceID: заставляет модель нарисовать лицо с фото; лицо читает InsightFace.',
      why: 'То же лицо на новой картинке без всякого обучения.',
      connect: 'Входы: model и ipadapter от загрузчика FaceID, image (лицо), weight, weight_faceidv2, start_at и end_at. Выход: MODEL для сэмплера.',
      risk: `${RULE} Слишком большой weight сжигает картинку: резкий контраст, сломанные цвета, застывшее лицо.`,
    },
  },
  linkTypes: {
    MESH: {
      what: 'Трёхмерная поверхность из треугольников: точки (вершины) и треугольники между ними, иногда с цветом или текстурой.',
      why: 'То, что получается в графе «картинка в 3D» и что открывают 3D-программы.',
      connect: 'Выходит из Voxel to Mesh и нод 3D-моделей; идёт в Save 3D Model, которая записывает файл .glb.',
    },
    VOXEL: {
      what: 'Сетка маленьких кубиков в пространстве, каждый внутри предмета или снаружи: сырая форма, в которую раскодируется 3D-модель.',
      why: 'Шаг между латентом 3D-модели и сеткой.',
      connect: 'Выходит из Hunyuan 3D VAE Decode; идёт в Voxel to Mesh.',
    },
  },
  families: {
    'ace-step': {
      what: 'ACE-Step: открытые музыкальные модели, которые пишут целые песни по тегам и словам. Версия 1.5 бывает одним чекпойнтом (ace_step_1.5_turbo_aio) или отдельными файлами: диффузионная модель, два текстовых энкодера Qwen для DualCLIPLoader с типом ace и VAE.',
      risk: 'У версий 1.0 и 1.5 свои текстовые ноды и пустые латенты; не смешивайте их в одном графе.',
    },
    'stable-audio': {
      what: 'Stable Audio Open 1.0: модель для коротких звуков и музыкальных петель по тексту. Чекпойнт в models/checkpoints и текстовый энкодер t5-base, загружаемый CLIPLoader с типом stable_audio.',
      risk: 'Без речи, без пения, куски примерно до 47 секунд.',
    },
    mmaudio: {
      what: 'MMAudio: делает звук видео по его кадрам и необязательному тексту. Файлы в models/mmaudio: модель (16k или 44k), её VAE, Synchformer и модель CLIP.',
      risk: 'Берите все файлы одной частоты (все 44k или все 16k).',
    },
    'hunyuan-foley': {
      what: 'HunyuanVideo-Foley: модель Tencent для звука видео, больше, чем MMAudio. Пак ComfyUI-HunyuanVideo-Foley загружает её из models/foley, есть файлы fp8 для карт примерно на 8 ГБ.',
      risk: 'Примерно 10 до 12 ГБ видеопамяти в полной точности на ролик в 5 секунд.',
    },
    chatterbox: {
      what: 'Chatterbox от Resemble AI: речь из текста с копированием голоса по нескольким секундам записи. Standard и Turbo говорят по-английски, Multilingual на 23 языках.',
      risk: RULE,
    },
    'qwen-tts': {
      what: 'Qwen3-TTS от команды Qwen: речь из текста на десяти языках, с готовыми голосами, голосом по словесному описанию и копированием голоса. Пак ComfyUI-Qwen-TTS читает её из models/qwen-tts.',
      risk: RULE,
    },
    whisper: {
      what: 'Whisper от OpenAI: речь в текст на многих языках, от tiny до large-v3 и turbo. Пак ComfyUI-Whisper сам скачивает выбранную модель в models/stt/whisper.',
      risk: 'Модели с именем на .en знают только английский.',
    },
    hunyuan3d: {
      what: 'Hunyuan3D 2 от Tencent: 3D-форма по одной картинке (2.0, 2.1) или по нескольким видам (2mv). Чекпойнт в models/checkpoints, загружается Image Only Checkpoint Loader; результат: сетка без текстуры.',
      risk: 'У каждой версии свои числа в шаблоне (resolution, steps, cfg); берите их из шаблона своей версии.',
    },
    trellis2: {
      what: 'TRELLIS.2 от Microsoft: 3D-модель с текстурой по картинке. В ComfyUI есть свои ноды для неё; официальный шаблон большой: форма, уточнение и текстура в три этапа сэмплирования.',
      risk: 'Намного больше памяти и времени, чем Hunyuan3D; начинайте с официального шаблона, а не с пустого холста.',
    },
    'flux-kontext': {
      what: 'FLUX.1 Kontext dev: модель FLUX.1, которая меняет картинку по фразе и сохраняет остальное, в том числе того же героя. Диффузионная модель в models/diffusion_models с текстовыми энкодерами и VAE от FLUX.1.',
      risk: 'Картинку-образец читает только файл Kontext; обычный FLUX.1 dev её не замечает. Лицензия dev ограничивает коммерческое использование самой модели.',
    },
    'face-restore': {
      what: 'Модели восстановления лиц: CodeFormer, GFPGAN, GPEN, RestoreFormer. Файлы в models/facerestore_models, их читают ReActor и facerestore_cf.',
      risk: `${OLD_FORMAT} Лицензия CodeFormer не разрешает коммерческое использование.`,
    },
    photomaker: {
      what: 'PhotoMaker: держит одно лицо через картинки SDXL по нескольким фотографиям этого лица. Файл кладут в models/photomaker; ноды встроены в сам ComfyUI.',
      risk: RULE,
    },
    infiniteyou: {
      what: 'InfiniteYou от ByteDance: одно лицо на картинках FLUX. Паку ComfyUI_InfiniteYou нужны его файлы в models/infinite_you и InsightFace AntelopeV2 в models/insightface.',
      risk: `${RULE} Около 24 ГБ видеопамяти с FP8; модель только для академических исследований.`,
    },
    'ipadapter-faceid': {
      what: 'IP-Adapter FaceID: варианты IP-Adapter для лиц под SD 1.5 и SDXL в паке ComfyUI_IPAdapter_plus. Им нужен InsightFace (models/insightface), свои файлы в models/ipadapter и обычно LoRA FaceID.',
      risk: `${RULE} Модели InsightFace только для некоммерческого использования.`,
    },
    instantid: {
      what: 'InstantID: одно лицо с фото на картинках SDXL, вместе с поворотом головы. Паку ComfyUI_InstantID нужны адаптер InstantID в models/instantid, его ControlNet в models/controlnet и InsightFace AntelopeV2 в models/insightface.',
      risk: `${RULE} Только SDXL; модели InsightFace только для некоммерческого использования.`,
    },
    pulid: {
      what: 'PuLID: одно лицо с фото, есть паки для SDXL и для Flux. Файл PuLID в models/pulid, InsightFace AntelopeV2 и модель EVA-CLIP, которую пак скачивает сам.',
      risk: `${RULE} Каждый пак служит одному семейству; файл PuLID для Flux не работает с SDXL.`,
    },
  },
  packs: {
    'ComfyUI-MMAudio': {
      what: 'Звук для видео моделью MMAudio: модель смотрит кадры и делает звук в такт с ними.',
      nodes: 'MMAudio ModelLoader, MMAudio FeatureUtilsLoader, MMAudio VoCoderLoader, MMAudio Sampler.',
      risk: `Лучше всего около 8 секунд за запуск. Файлы в models/mmaudio. ${PACK_CODE}`,
    },
    'ComfyUI-HunyuanVideo-Foley': {
      what: 'Звук для видео или звук по тексту моделью HunyuanVideo-Foley от Tencent.',
      nodes: 'Hunyuan-Foley Model Loader, Hunyuan-Foley Dependencies Loader, Hunyuan-Foley Sampler; по желанию Torch Compile и BlockSwap Settings.',
      risk: `Примерно 10 до 12 ГБ видеопамяти в fp16, меньше 8 ГБ с fp8. Файлы в models/foley. ${PACK_CODE}`,
    },
    'ComfyUI-Qwen-TTS': {
      what: 'Речь из текста моделью Qwen3-TTS: готовые голоса, голос по словесному описанию, копирование голоса, диалоги нескольких ролей.',
      nodes: 'Qwen3-TTS Custom Voice, Voice Design, Voice Clone, Multi-role Dialogue, Load Speaker, Save Voice.',
      risk: `${RULE} Десять языков. Файлы в models/qwen-tts. ${PACK_CODE}`,
    },
    'ComfyUI-Whisper': {
      what: 'Речь в текст и субтитры моделью Whisper.',
      nodes: 'Apply Whisper, Save SRT, Add Subtitles To Frames, Add Subtitles To Background.',
      risk: `Модели скачиваются в models/stt/whisper при первом запуске. Лицензия не разрешает коммерческое использование. ${PACK_CODE}`,
    },
    'ComfyUI_AudioTools': {
      what: 'Повседневные инструменты для звука: загрузка, громкость, склейка, удаление тишины, очистка голоса, водяной знак.',
      nodes: 'Load Audio (MW), Adjust Audio, Audio Concatenate, Remove Silence, ClearVoice, Audio Add Watermark и другие.',
      risk: `Сам ComfyUI уже обрезает, склеивает, смешивает звук и меняет громкость; пак добавляет остальное. ${PACK_CODE}`,
    },
    'ComfyUI_Fill-ChatterBox': {
      what: 'Речь из текста и замена голоса моделью Chatterbox.',
      nodes: 'FL Chatterbox TTS, Turbo TTS, Multilingual TTS, Dialog TTS, VC (замена голоса).',
      risk: `${RULE} Около 40 секунд за запуск; модели скачиваются в models/chatterbox при первом запуске. ${PACK_CODE}`,
    },
    'ComfyUI-3D-Pack': {
      what: 'Большой набор 3D-инструментов: картинка в 3D многими моделями (Hunyuan3D, TRELLIS, TripoSG, StableFast3D и другие), сетки, текстуры, гауссовы сплаты.',
      nodes: 'Загрузчики и сэмплеры для каждой модели, сохранение сеток и сплатов (.obj, .ply, .glb), облёт камерой, запекание текстур.',
      risk: `Трудно ставится: готовые сборки есть только для некоторых версий Python, CUDA и torch, а часть нод компилируется при запуске. ${PACK_CODE}`,
    },
    'ComfyUI-Trellis2': {
      what: 'Обёртка над TRELLIS.2 от Microsoft с дополнительными инструментами для сеток: текстуры, чистка, перестройка сетки, экспорт.',
      nodes: 'Export Mesh, Voxel to Mesh, Smooth Mesh, Simplify, Weld Vertices, Render MultiView и другие.',
      risk: `В самом ComfyUI теперь есть свои ноды TRELLIS.2 и официальный шаблон; пак нужен для того, чего они не делают. Нужен доступ к модели DINOv3. ${PACK_CODE}`,
    },
    'ComfyUI-UniRig': {
      what: 'Автоматический риггинг: ставит скелет в сетку персонажа и привязывает к нему кожу (UniRig или Make it Animatable для человекоподобных).',
      nodes: 'Извлечение скелета, привязка кожи, позирование и экспорт оснащённой модели.',
      risk: `Ставит своё окружение (вместе с Blender) экспериментальным установщиком. Модели в models/unirig. ${PACK_CODE}`,
    },
    'ComfyUI_InfiniteYou': {
      what: 'Одно лицо на картинках FLUX (InfiniteYou от ByteDance).',
      nodes: 'InfuseNet Loader, InfuseNet Apply, ID Embedding Model Loader, Extract ID Embedding, Extract Face Pose Image.',
      risk: `${RULE} Около 43 ГБ видеопамяти в bf16, около 24 ГБ с FP8; только для академических исследований. ${PACK_CODE}`,
    },
    'ComfyUI-ReActor': {
      what: 'Замена и восстановление лиц.',
      nodes: 'Fast Face Swap, Face Swap [Options], Face Booster, Restore Face, Restore Face Advanced, Build / Save / Load Face Model, Masking Helper.',
      risk: `${RULE} Пак своим детектором отказывается работать с откровенными картинками. Модели InsightFace и CodeFormer только для некоммерческого использования. ${PACK_CODE}`,
    },
    facerestore_cf: {
      what: 'Восстановление лиц моделями CodeFormer и GFPGAN, та же мысль, что у восстановления лиц в других программах.',
      nodes: 'Загрузчик модели и нода восстановления с настройкой точности CodeFormer.',
      risk: `Модели в models/facerestore_models; модели поиска лиц скачиваются в models/facedetection. ${OLD_FORMAT}`,
    },
    'ComfyUI_InstantID': {
      what: 'InstantID для SDXL: лицо с одного фото сохраняется на новых картинках вместе с поворотом головы.',
      nodes: 'InstantID Model Loader, InstantID Face Analysis, Apply InstantID.',
      risk: `${RULE} Только SDXL. Файлы в models/instantid, models/controlnet и models/insightface. ${PACK_CODE}`,
    },
  },
  fields: {
    'TextEncodeAceStepAudio1.5': {
      tags: 'Стиль песни короткими словами через запятую: жанр, настроение, инструменты, голос.',
      lyrics: 'Слова для пения, части песни в квадратных скобках на отдельных строках ([Verse 1], [Chorus]).',
      bpm: 'Удары в минуту: около 70 для баллады, от 120 до 130 для танцевальной музыки.',
      duration: 'Длина, которую задумывает модель, в секундах; ставьте равной seconds пустого латента.',
      language: 'Язык, на котором поются слова.',
    },
    'EmptyAceStep1.5LatentAudio': {
      seconds: 'Настоящая длина песни в секундах; шаблон ставит 120.',
    },
    EmptyLatentAudio: {
      seconds: 'Длина звука; Stable Audio Open 1.0 делает примерно до 47 секунд.',
    },
    ModelSamplingAuraFlow: {
      shift: 'Сдвиг шума: 3 для ACE-Step 1.5, 1 для Hunyuan3D 2, как ставят их шаблоны.',
    },
    MMAudioSampler: {
      duration: 'Длина звука в секундах: длина ролика, лучше всего около 8.',
      prompt: 'Необязательные слова о звуке; ведут кадры.',
      mask_away_clip: 'Включено: модель не смотрит на кадры и следует только тексту.',
    },
    MMAudioFeatureUtilsLoader: {
      mode: '16k или 44k: частота модели и её VAE; все файлы должны совпадать.',
    },
    FL_ChatterboxTTS: {
      exaggeration: 'Насколько живая речь; по умолчанию 0.5, выше выразительнее и менее ровно.',
      cfg_weight: 'Насколько точно модель следует образцу голоса; ниже медленнее и спокойнее. По умолчанию 0.5.',
      temperature: 'Насколько прочтения отличаются от запуска к запуску. По умолчанию 0.8.',
    },
    'Apply Whisper': {
      model: 'Размер Whisper: tiny и base быстрые, large-v3 и turbo точные; имена на .en знают только английский.',
      language: 'Язык речи или auto, чтобы модель определила его сама.',
    },
    EmptyLatentHunyuan3Dv2: {
      resolution: 'Насколько тонко прорабатывается форма: 3072 в шаблоне 2.0, 4096 в шаблоне 2.1.',
    },
    VoxelToMesh: {
      threshold: 'Где кончается «внутри» предмета: ниже делает его толще, выше тоньше и с дырами. В шаблонах 0.6.',
      algorithm: 'surface net даёт гладкую поверхность, basic ступенчатую.',
    },
    FluxGuidance: {
      guidance: 'Насколько сильно модель FLUX следует описанию; FLUX.1 Kontext ставит 2.5.',
    },
    ReActorRestoreFace: {
      visibility: 'Насколько сильно восстановленное лицо закрывает старое; ниже смешивает их.',
      codeformer_weight: 'Только для CodeFormer: ближе к 0 чётче и меньше похоже, ближе к 1 похожее и мягче.',
      facedetection: 'Как ищутся лица: retinaface_resnet50 самый аккуратный, YOLOv5n самый быстрый.',
    },
    IPAdapterUnifiedLoaderFaceID: {
      preset: 'Какой адаптер FaceID и какую LoRA загрузить; FACEID PLUS V2 выбран в примере пака.',
      lora_strength: 'Сила LoRA FaceID; 0.6 в примере пака. Больше давит лицо сильнее и делает картинку деревянной.',
    },
    IPAdapterFaceID: {
      weight: 'Насколько сильно лицо вдавливается в картинку; 1 в примере, уменьшайте к 0.7, когда картинка горит.',
      weight_faceidv2: 'Только для адаптеров V2: насколько лицо следует фото; 2 в примере.',
    },
    ReActorFaceSwap: {
      face_restore_visibility: 'Насколько сильно восстановленное лицо закрывает перенесённое; 1 закрывает целиком, меньше смешивает.',
      input_faces_index: 'Какие лица на картинке меняются, считая с 0 слева.',
    },
  },
  concepts: {
    identity: {
      term: 'Облик: адаптер, LoRA или замена: что выбрать',
      text: `${RULE}\n\nОдно лицо или одного героя держат три способа:\n- адаптер (IP-Adapter FaceID, InstantID, PuLID или картинка-образец в Kontext): одно фото, ничего не обучать, вокруг лица рисуется новая картинка; лицо он держит, а причёску, возраст и свет нет;\n- LoRA, обученная на герое: десяток картинок и больше и обучение; потом лицо, тело и одежда держатся на каждой картинке, а LoRA работает только со своим семейством моделей;\n- замена (ReActor): у готовой картинки остаются поза, свет и одежда, меняется только лицо; быстро, но лицо выходит мелким и его надо восстанавливать.\n\nНачинайте со слов описания и закреплённого seed, потом адаптер; учите LoRA, когда должна держаться длинная серия; заменой правьте одну готовую картинку.`,
    },
    'models-mmaudio': {
      term: 'models/mmaudio',
      text: 'Файлы MMAudio: модель, её VAE, Synchformer и модель CLIP (папку добавляет ComfyUI-MMAudio).',
    },
    'models-foley': {
      term: 'models/foley',
      text: 'Файлы HunyuanVideo-Foley: модель, Synchformer и DAC-VAE (ComfyUI-HunyuanVideo-Foley).',
    },
    'models-hunyuan_foley': {
      term: 'models/hunyuan_foley',
      text: 'Файлы HunyuanVideo-Foley в папке, которую используют некоторые установки; нынешний пак читает models/foley.',
    },
    'models-qwen-tts': {
      term: 'models/qwen-tts',
      text: 'Модели Qwen3-TTS, токенизатор и сохранённые голоса (ComfyUI-Qwen-TTS).',
    },
    'models-stt': {
      term: 'models/stt',
      text: 'Модели «речь в текст»; ComfyUI-Whisper держит Whisper в models/stt/whisper.',
    },
    'models-chatterbox': {
      term: 'models/chatterbox',
      text: 'Модели речи Chatterbox, их туда скачивает ComfyUI_Fill-ChatterBox.',
    },
    'models-audio_encoders': {
      term: 'models/audio_encoders',
      text: 'Звуковые энкодеры, которые читает встроенная нода Audio Encoder Loader, например wav2vec2, для видеомоделей, которые слушают голос.',
    },
    'models-demucs': {
      term: 'models/demucs',
      text: 'Модели Demucs, которые делят песню на голос, барабаны, бас и остальное; их читают паки для разделения на дорожки.',
    },
    'models-facerestore_models': {
      term: 'models/facerestore_models',
      text: 'Модели восстановления лиц (CodeFormer, GFPGAN, GPEN), их читают ReActor и facerestore_cf.',
    },
    'models-facedetection': {
      term: 'models/facedetection',
      text: 'Модели поиска лиц для паков восстановления лиц.',
    },
    'models-facexlib': {
      term: 'models/facexlib',
      text: 'Модели поиска и разбора лиц библиотеки facexlib, их используют некоторые паки для лиц.',
    },
    'models-insightface': {
      term: 'models/insightface',
      text: 'Модели анализа лиц InsightFace (AntelopeV2, buffalo_l) и модель замены ReActor; нужны для замены лиц, FaceID и InfiniteYou.',
    },
    'models-photomaker': {
      term: 'models/photomaker',
      text: 'Файлы PhotoMaker для SDXL (ноды самого ComfyUI).',
    },
    'models-ipadapter': {
      term: 'models/ipadapter',
      text: 'Файлы IP-Adapter, в том числе FaceID (ComfyUI_IPAdapter_plus).',
    },
    'models-infinite_you': {
      term: 'models/infinite_you',
      text: 'Файлы InfiniteYou (ComfyUI_InfiniteYou).',
    },
    'models-reswapper': {
      term: 'models/reswapper',
      text: 'Модели замены лиц ReSwapper для ReActor.',
    },
    'models-unirig': {
      term: 'models/unirig',
      text: 'Модели риггинга UniRig (ComfyUI-UniRig).',
    },
    'models-ultralytics': {
      term: 'models/ultralytics',
      text: 'Детекторы YOLO (bbox и segm) пака ComfyUI-Impact-Subpack, например bbox/face_yolov8m.pt.',
    },
    'models-sams': {
      term: 'models/sams',
      text: 'Модели Segment Anything, например sam_vit_b_01ec64.pth, для Impact Pack и ReActor.',
    },
    'models-instantid': {
      term: 'models/instantid',
      text: 'Адаптер InstantID (ComfyUI_InstantID).',
    },
    'models-pulid': {
      term: 'models/pulid',
      text: 'Файлы PuLID для паков PuLID.',
    },
  },

};
