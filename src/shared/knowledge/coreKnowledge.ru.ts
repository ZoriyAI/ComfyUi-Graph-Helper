import type { CoreLanguagePack } from './coreKnowledge';

/** Встроенные учебные знания, русский. Английский пакет (coreKnowledge.en.ts) говорит то же самое. */
export const CORE_KNOWLEDGE_RU: CoreLanguagePack = {
  nodes: {
    CheckpointLoaderSimple: {
      what: 'Загружает чекпойнт из models/checkpoints: один файл, в котором вместе лежат диффузионная модель, её текстовый энкодер (CLIP) и VAE.',
      why: 'Обычная первая нода графа SD 1.5 или SDXL: один загрузчик даёт всё, что нужно простому графу «текст в картинку».',
      connect: 'Входов нет, кроме выбора файла (ckpt_name). Выходы: MODEL (к загрузчикам LoRA или сэмплеру), CLIP (к текстовым энкодерам) и VAE (к VAE Decode / VAE Encode).',
      risk: 'Новые семейства (Flux, Qwen-Image, Wan) часто поставляются отдельными файлами; такой файл загружают через Load Diffusion Model (UNETLoader) с отдельными загрузчиками текстового энкодера и VAE, а не этой нодой.',
    },
    UNETLoader: {
      what: 'Load Diffusion Model: загружает только диффузионную модель (UNet или трансформер) из models/diffusion_models, без текстового энкодера и VAE.',
      why: 'Нужна для семейств, которые поставляются отдельными файлами: Flux, Qwen-Image, Wan, HunyuanVideo; текстовые энкодеры и VAE берутся из своих загрузчиков.',
      connect: 'Входы: файл (unet_name) и тип весов (weight_dtype). Выход: MODEL — к загрузчикам LoRA, нодам model sampling или к сэмплеру.',
      risk: 'Одна модель работать не будет: ей нужны подходящие текстовые энкодеры и VAE того же семейства.',
    },
    CLIPLoader: {
      what: 'Load CLIP: загружает один файл текстового энкодера из models/text_encoders (или models/clip) и задаёт, для какого типа модели он нужен.',
      why: 'Используется, когда диффузионная модель идёт без текстового энкодера и семейству нужен один энкодер, например Wan (umt5) или Qwen-Image (Qwen2.5-VL).',
      connect: 'Входы: файл (clip_name) и тип (например sd3, wan, qwen_image). Выход: CLIP — к CLIP Text Encode и загрузчикам LoRA.',
      risk: 'Тип должен соответствовать семейству модели; неверный тип или энкодер другого семейства дают ошибку или бессмысленные картинки.',
    },
    DualCLIPLoader: {
      what: 'Загружает сразу два файла текстовых энкодеров и объединяет их в один CLIP — для моделей, которые читают промпт двумя энкодерами.',
      why: 'Flux.1 использует её с clip_l и t5xxl; SDXL и HunyuanVideo тоже могут её использовать, когда энкодеры лежат отдельно.',
      connect: 'Входы: clip_name1, clip_name2 и тип (например flux, sdxl, hunyuan_video). Выход: CLIP — к нодам кодирования текста.',
      risk: 'Оба файла и тип должны относиться к тому же семейству, что и диффузионная модель.',
    },
    VAELoader: {
      what: 'Загружает VAE из models/vae — часть, которая переводит между пикселями (IMAGE) и латентным пространством (LATENT).',
      why: 'Нужна, когда модель идёт без VAE (Flux, Qwen-Image, Wan), или чтобы заменить VAE, встроенный в чекпойнт.',
      connect: 'Вход: файл (vae_name). Выход: VAE — к VAE Decode, VAE Encode и нодам инпейнтинга.',
      risk: 'У каждого семейства свой VAE; VAE другого семейства даёт испорченные цвета, шум или ошибку.',
    },
    LoraLoader: {
      what: 'Load LoRA: применяет файл LoRA (небольшое дополнение, обученное поверх базовой модели) и к модели, и к текстовому энкодеру.',
      why: 'Добавляет стиль, персонажа или понятие, не меняя базовую модель; несколько загрузчиков LoRA можно соединить цепочкой.',
      connect: 'Входы: MODEL и CLIP (от загрузчика или предыдущей LoRA), файл, strength_model и strength_clip. Выходы: изменённые MODEL и CLIP, которые дальше заменяют исходные.',
      risk: 'LoRA работает только с тем базовым семейством, для которого обучена (LoRA для SDXL не работает с моделью SD 1.5). Слишком большая сила искажает картинку.',
    },
    LoraLoaderModelOnly: {
      what: 'Применяет LoRA только к диффузионной модели, не трогая текстовый энкодер.',
      why: 'Используется, когда у LoRA нет части для текстового энкодера или в графе нет CLIP для изменения — так часто бывает с LoRA для Flux, Qwen-Image и Wan.',
      connect: 'Входы: MODEL, файл LoRA и strength_model. Выход: изменённая MODEL — к сэмплеру или следующей LoRA.',
      risk: 'LoRA должна соответствовать базовому семейству модели.',
    },
    CLIPTextEncode: {
      what: 'CLIP Text Encode (Prompt): превращает текстовый промпт в conditioning — форму промпта, понятную сэмплеру.',
      why: 'Через неё проходит каждый промпт графа: обычно одна нода для позитивного промпта и одна для негативного.',
      connect: 'Входы: CLIP (от загрузчика или LoRA) и текст. Выход: CONDITIONING — к входу positive или negative сэмплера или к нодам conditioning.',
      risk: 'Если перепутать провода к positive и negative, сэмплер будет избегать того, что вы просили.',
    },
    CLIPSetLastLayer: {
      what: 'CLIP Set Last Layer: заставляет текстовый энкодер остановиться на более раннем слое («CLIP skip»).',
      why: 'Некоторые модели SD 1.5, особенно аниме, обучены с clip skip 2 (stop_at_clip_layer = -2).',
      connect: 'Вход: CLIP и stop_at_clip_layer. Выход: CLIP — к нодам кодирования текста.',
      risk: 'Ставьте её, только если этого просит описание модели; при -1 она ничего не меняет.',
    },
    EmptyLatentImage: {
      what: 'Создаёт пустое латентное изображение заданной ширины, высоты и размера пакета — чистый холст, с которого начинает сэмплер.',
      why: 'Начальная точка «текст в картинку» для SD 1.5 и SDXL; ширина и высота задают размер результата.',
      connect: 'Входы: width, height, batch_size. Выход: LATENT — ко входу latent_image сэмплера.',
      risk: 'Размеры, далёкие от разрешения обучения модели (512 для SD 1.5, около 1024 для SDXL), часто дают повторы и сломанную композицию.',
    },
    EmptySD3LatentImage: {
      what: 'Создаёт пустой латент в 16-канальном формате, который используют SD3 и модели вроде Flux.',
      why: 'Начальный латент для «текст в картинку» с SD3, Flux.1 и другими моделями с 16-канальным латентом.',
      connect: 'Входы: width, height, batch_size. Выход: LATENT — к сэмплеру.',
      risk: 'Формат латента должен подходить модели; если не уверены, посмотрите, какую ноду пустого латента использует шаблон семейства.',
    },
    KSampler: {
      what: 'Основной сэмплер: начиная с латента, шаг за шагом убирает шум, следуя модели и позитивному и негативному conditioning.',
      why: 'Именно здесь создаётся изображение; seed, steps, cfg, sampler и scheduler управляют результатом.',
      connect: 'Входы: MODEL, positive и negative CONDITIONING, LATENT (пустой для «текст в картинку», закодированный для «картинка в картинку») и настройки. Выход: LATENT — к VAE Decode.',
      risk: 'При denoise меньше 1.0 на пустом латенте результат остаётся шумным; пониженный denoise нужен для «картинка в картинку». Слишком высокий CFG «пережигает» картинку; Flux обычно требует cfg 1.0.',
    },
    KSamplerAdvanced: {
      what: 'KSampler с управлением диапазоном шагов: может начинать и заканчивать на выбранных шагах и решать, добавлять ли шум.',
      why: 'Используется, чтобы разделить одну генерацию между несколькими сэмплерами или моделями, например base и refiner или двумя экспертами Wan 2.2.',
      connect: 'Те же входы, что у KSampler, плюс add_noise, start_at_step, end_at_step и return_with_leftover_noise. Выход: LATENT — к следующему сэмплеру или VAE Decode.',
      risk: 'Диапазоны шагов в цепочке должны стыковаться, а первый сэмплер должен возвращать остаточный шум, чтобы второй мог продолжить.',
    },
    SamplerCustom: {
      what: 'Сэмплер, собранный из отдельных частей: алгоритм сэмплирования (SAMPLER) и расписание шума (SIGMAS) приходят от других нод.',
      why: 'Даёт более тонкое управление, чем KSampler, например особый планировщик или сэмплер со своими настройками.',
      connect: 'Входы: MODEL, positive и negative CONDITIONING, SAMPLER (от KSamplerSelect), SIGMAS (от планировщика, например BasicScheduler), LATENT, seed шума и cfg. Выходы: LATENT (output) и LATENT (denoised_output).',
    },
    BasicScheduler: {
      what: 'Вычисляет расписание шума (SIGMAS) для модели: сколько шума остаётся до и после каждого шага.',
      why: 'Снабжает кастомные сэмплеры (SamplerCustom, SamplerCustomAdvanced) расписанием выбранного типа, числа шагов и denoise.',
      connect: 'Входы: MODEL, scheduler, steps, denoise. Выход: SIGMAS — ко входу sigmas сэмплера.',
    },
    KSamplerSelect: {
      what: 'Выбирает алгоритм сэмплирования (euler, dpmpp_2m и другие) и выдаёт его как SAMPLER.',
      why: 'Кастомные сэмплеры принимают алгоритм входом, а не настройкой; эта нода его даёт.',
      connect: 'Вход: sampler_name. Выход: SAMPLER — к SamplerCustom или SamplerCustomAdvanced.',
    },
    VAEDecode: {
      what: 'VAE Decode: превращает латент, полученный от сэмплера, в обычную картинку (пиксели).',
      why: 'Без неё нечего смотреть и сохранять: сэмплер работает в латентном пространстве.',
      connect: 'Входы: samples (LATENT) и VAE. Выход: IMAGE — к Save Image, Preview Image или нодам изображений.',
      risk: 'VAE должен подходить семейству модели, иначе цвета или детали получатся неправильными.',
    },
    VAEEncode: {
      what: 'VAE Encode: превращает картинку в латент, чтобы сэмплер мог с ней работать.',
      why: 'Основа «картинка в картинку»: загрузить изображение, закодировать, затем сэмплировать с denoise меньше 1.0.',
      connect: 'Входы: pixels (IMAGE) и VAE. Выход: LATENT — ко входу latent_image сэмплера.',
    },
    VAEEncodeForInpaint: {
      what: 'Кодирует картинку для инпейнтинга: область под маской очищается, чтобы сэмплер её заполнил.',
      why: 'Используется с inpainting-моделями, чтобы перерисовать только часть изображения.',
      connect: 'Входы: pixels (IMAGE), VAE, MASK и grow_mask_by. Выход: LATENT с маской — к сэмплеру.',
      risk: 'Она стирает область под маской, поэтому нужен denoise 1.0; для мягкого изменения области используйте SetLatentNoiseMask или InpaintModelConditioning.',
    },
    SaveImage: {
      what: 'Сохраняет изображения в папку output ComfyUI и показывает их на ноде.',
      why: 'Обычная последняя нода графа: это выходная нода, поэтому ComfyUI выполняет ведущую к ней ветку.',
      connect: 'Входы: images (IMAGE) и filename_prefix. Выходов нет.',
    },
    PreviewImage: {
      what: 'Показывает изображения на ноде, не сохраняя их в папку output (они попадают во временную папку).',
      why: 'Для проверки промежуточных результатов или подбора настроек перед сохранением.',
      connect: 'Вход: images (IMAGE). Выходов нет.',
    },
    LoadImage: {
      what: 'Загружает картинку из папки input ComfyUI (или загруженную вами) в граф.',
      why: 'Исходное изображение для «картинка в картинку», инпейнтинга, ControlNet или апскейла.',
      connect: 'Вход: файл изображения. Выходы: IMAGE и MASK (из альфа-канала или нарисованная в редакторе масок).',
    },
    ImageScale: {
      what: 'Upscale Image: меняет размер картинки до точной ширины и высоты простым методом (bilinear, lanczos и др.), с возможной обрезкой.',
      why: 'Чтобы подогнать изображение под размер, которого ждёт модель или другая нода.',
      connect: 'Входы: IMAGE, upscale_method, width, height, crop. Выход: IMAGE.',
      risk: 'Ширина или высота 0 сохраняет пропорции по другой стороне; без обрезки другие пропорции растягивают картинку.',
    },
    ImageScaleBy: {
      what: 'Upscale Image By: меняет размер картинки в заданное число раз (например 1.5 или 2) простым методом, без ИИ.',
      why: 'Быстрое изменение размера; для настоящей добавленной детализации используйте модель апскейла или второй проход сэмплера.',
      connect: 'Входы: IMAGE, upscale_method, scale_by. Выход: IMAGE.',
    },
    UpscaleModelLoader: {
      what: 'Загружает модель апскейла (ESRGAN и подобные) из models/upscale_models.',
      why: 'Первая половина ИИ-апскейла; саму модель применяет Upscale Image (using Model).',
      connect: 'Вход: model_name. Выход: UPSCALE_MODEL — к ImageUpscaleWithModel.',
    },
    ImageUpscaleWithModel: {
      what: 'Upscale Image (using Model): увеличивает картинку моделью апскейла, которая добавляет детали, а не просто растягивает пиксели.',
      why: 'Для более чётких больших изображений; часто после неё идёт уменьшение до нужного размера или второй проход сэмплера.',
      connect: 'Входы: upscale_model (UPSCALE_MODEL) и image (IMAGE). Выход: IMAGE.',
      risk: 'Масштаб задан моделью (часто 4x); большие изображения требуют много памяти.',
    },
    ControlNetLoader: {
      what: 'Загружает модель ControlNet из models/controlnet — модель, которая управляет генерацией по контрольной картинке: контурам, глубине или позе.',
      why: 'Первый шаг, чтобы результат повторял структуру референса.',
      connect: 'Вход: control_net_name. Выход: CONTROL_NET — к Apply ControlNet.',
      risk: 'ControlNet обучен для одного базового семейства; ControlNet для SD 1.5 не работает с SDXL или Flux.',
    },
    ControlNetApplyAdvanced: {
      what: 'Apply ControlNet: добавляет управление ControlNet к позитивному и негативному conditioning по контрольной картинке.',
      why: 'Заставляет сэмплер следовать контурам, глубине или позе контрольного изображения, с силой и диапазоном начала и конца.',
      connect: 'Входы: positive и negative CONDITIONING, CONTROL_NET, image (IMAGE, обычно уже обработанная), необязательный VAE, strength, start_percent, end_percent. Выходы: positive и negative CONDITIONING — к сэмплеру.',
      risk: 'Контрольную картинку обычно сначала нужно обработать препроцессором (например в контуры canny или карту глубины) под тип ControlNet.',
    },
    ConditioningCombine: {
      what: 'Объединяет два conditioning, чтобы сэмплер учитывал оба; их предсказания смешиваются.',
      why: 'Чтобы совместить два промпта, часто вместе с conditioning по областям или маскам для разных частей картинки.',
      connect: 'Входы: conditioning_1 и conditioning_2 (CONDITIONING). Выход: CONDITIONING.',
    },
    ConditioningConcat: {
      what: 'Склеивает два conditioning в один более длинный промпт (conditioning_from добавляется к conditioning_to).',
      why: 'Другой способ соединить промпты; работает иначе, чем Conditioning (Combine), и может лучше разделять понятия.',
      connect: 'Входы: conditioning_to и conditioning_from (CONDITIONING). Выход: CONDITIONING.',
    },
    ConditioningSetArea: {
      what: 'Ограничивает conditioning прямоугольной областью изображения, заданной в пикселях, с силой.',
      why: 'Чтобы разместить разные промпты в разных частях картинки; обычно потом объединяется с другими conditioning.',
      connect: 'Входы: CONDITIONING, width, height, x, y, strength. Выход: CONDITIONING — обычно к Conditioning (Combine).',
    },
    LatentUpscale: {
      what: 'Upscale Latent: меняет размер латента до заданной ширины и высоты.',
      why: 'Для «hires fix»: увеличить латент, затем снова сэмплировать с частичным denoise, чтобы добавить детали.',
      connect: 'Входы: samples (LATENT), upscale_method, width, height, crop. Выход: LATENT — ко второму сэмплеру.',
      risk: 'Увеличенный латент нужно пересэмплировать (denoise примерно 0.4–0.6); если сразу декодировать, будет размыто или сломано.',
    },
    LatentUpscaleBy: {
      what: 'Upscale Latent By: меняет размер латента в заданное число раз.',
      why: 'То же назначение, что у Upscale Latent (второй проход сэмплера в большем размере), но задаётся множителем.',
      connect: 'Входы: samples (LATENT), upscale_method, scale_by. Выход: LATENT.',
    },
    SetLatentNoiseMask: {
      what: 'Прикрепляет маску к латенту, чтобы сэмплер менял только область под маской, а остальное сохранял.',
      why: 'Инпейнтинг обычной моделью: закодировать картинку, задать маску, сэмплировать с частичным denoise.',
      connect: 'Входы: samples (LATENT) и MASK. Выход: LATENT с маской шума — к сэмплеру.',
    },
    InpaintModelConditioning: {
      what: 'Готовит conditioning и латент для инпейнтинга: кодирует картинку и маску и прикрепляет их к промпту.',
      why: 'Используется с inpainting-моделями (и с Flux Fill) для лучшего сращивания перерисованной области, чем простая маска.',
      connect: 'Входы: positive и negative CONDITIONING, VAE, pixels (IMAGE), MASK. Выходы: positive, negative (CONDITIONING) и latent (LATENT) — всё к сэмплеру.',
    },
    CLIPVisionLoader: {
      what: 'Загружает модель CLIP Vision из models/clip_vision — энкодер изображений, который описывает картинку числами.',
      why: 'Нужна для функций с картинкой-подсказкой: unCLIP, style-модели, IP-Adapter и некоторые модели «картинка в видео» (например Wan 2.1 image-to-video).',
      connect: 'Вход: clip_name. Выход: CLIP_VISION — к CLIP Vision Encode.',
    },
    CLIPVisionEncode: {
      what: 'Кодирует картинку моделью CLIP Vision.',
      why: 'Превращает референс в эмбеддинг, который используют ноды стиля, unCLIP или «картинка в видео».',
      connect: 'Входы: clip_vision (CLIP_VISION), image (IMAGE), crop. Выход: CLIP_VISION_OUTPUT.',
    },
    ModelSamplingFlux: {
      what: 'Задаёт сдвиг сэмплирования модели Flux в зависимости от разрешения (max_shift, base_shift, width, height).',
      why: 'Используется в графах Flux, особенно Flux dev, чтобы настроить поведение расписания шума при данном размере.',
      connect: 'Вход: MODEL, значения сдвига и размер изображения. Выход: MODEL — к сэмплеру или guider.',
      risk: 'Ширина и высота должны совпадать с размером генерируемого латента.',
    },
    FluxGuidance: {
      what: 'Задаёт значение guidance, которое модели Flux читают из conditioning («дистиллированный CFG»).',
      why: 'Flux dev использует это guidance вместо высокого CFG; около 3.5 — обычное начальное значение.',
      connect: 'Вход: CONDITIONING и guidance. Выход: CONDITIONING — ко входу positive сэмплера.',
      risk: 'Держите cfg сэмплера равным 1.0 с Flux dev; если поднять оба, картинка станет резкой, а генерация медленной.',
    },
    Note: {
      what: 'Простая текстовая заметка на холсте. При выполнении графа ничего не делает.',
      why: 'Чтобы оставить инструкции или напоминания внутри workflow.',
      connect: 'Нет входов и выходов.',
    },
    MarkdownNote: {
      what: 'Заметка на холсте с разметкой Markdown (заголовки, списки, ссылки). При выполнении графа ничего не делает.',
      why: 'Для длинных инструкций, например какие файлы моделей нужны шаблону и куда их положить.',
      connect: 'Нет входов и выходов.',
    },
    Reroute: {
      what: 'Точка перенаправления: пропускает одну связь без изменений, чтобы аккуратно проложить длинные провода.',
      why: 'Упорядочивает схему или позволяет протянуть один выход в несколько далёких мест.',
      connect: 'Один вход и один выход одного типа; она принимает тип того, что к ней подключено.',
    },
    PrimitiveNode: {
      what: 'Primitive: нода только интерфейса, которая хранит значение (число, текст, выбор) и подаёт его во вход-виджет других нод.',
      why: 'Чтобы одно значение, например seed или размер, использовалось в нескольких нодах или управлялось из одного места.',
      connect: 'Входов нет; её выход принимает тип подключённого входа-виджета (INT, FLOAT, STRING, COMBO).',
      risk: 'Она существует только в редакторе: в API-промпте её значение записывается прямо в подключённые ноды.',
    },
  },
  linkTypes: {
    MODEL: {
      what: 'MODEL: сама диффузионная модель (UNet или трансформер) — часть, которая убирает шум.',
      why: 'Она нужна каждому сэмплеру; LoRA и патчи модели изменяют её по пути.',
      connect: 'Идёт от Load Checkpoint, Load Diffusion Model или нод LoRA и патчей; идёт к сэмплерам, планировщикам, загрузчикам LoRA и нодам model sampling.',
    },
    CLIP: {
      what: 'CLIP: текстовый энкодер, который читает ваш промпт.',
      why: 'С его помощью промпты превращаются в conditioning.',
      connect: 'Идёт от Load Checkpoint, Load CLIP, DualCLIPLoader или Load LoRA; идёт к CLIP Text Encode и другим нодам кодирования текста.',
    },
    VAE: {
      what: 'VAE: модель, которая переводит между пикселями и латентным пространством.',
      why: 'Нужен, чтобы увидеть результат (decode) или начать с картинки (encode).',
      connect: 'Идёт от Load Checkpoint или Load VAE; идёт к VAE Decode, VAE Encode и нодам инпейнтинга.',
    },
    CONDITIONING: {
      what: 'CONDITIONING: закодированный промпт (и прикреплённое к нему дополнительное управление), который направляет сэмплер.',
      why: 'Его принимают входы positive и negative сэмплера.',
      connect: 'Идёт от нод кодирования текста и изменяется нодами ControlNet, областей, объединения и guidance; идёт ко входу positive или negative сэмплера.',
    },
    LATENT: {
      what: 'LATENT: изображение в сжатом латентном пространстве, в котором работает модель; у большинства моделей оно в 8 раз меньше картинки по каждой стороне.',
      why: 'Сэмплеры читают и пишут латенты; картинка становится видимой только после VAE Decode.',
      connect: 'Идёт от Empty Latent Image, VAE Encode или сэмплера; идёт к сэмплерам, нодам апскейла латента или VAE Decode.',
    },
    IMAGE: {
      what: 'IMAGE: пакет обычных картинок в пикселях (красный, зелёный и синий).',
      why: 'То, что вы сохраняете, просматриваете, загружаете, масштабируете или используете как контрольную картинку.',
      connect: 'Идёт от Load Image, VAE Decode или нод изображений; идёт к Save Image, Preview Image, VAE Encode, апскейлерам и ControlNet.',
    },
    MASK: {
      what: 'MASK: чёрно-белая карта, которая отмечает, какую область менять.',
      why: 'Используется для инпейнтинга и чтобы ограничить действие частью картинки.',
      connect: 'Идёт от Load Image (альфа-канал или редактор масок) или нод масок; идёт к SetLatentNoiseMask, VAE Encode (for Inpainting) и InpaintModelConditioning.',
    },
    CONTROL_NET: {
      what: 'CONTROL_NET: загруженная модель ControlNet.',
      why: 'Управляет структурой результата по контрольной картинке.',
      connect: 'Идёт от Load ControlNet Model; идёт к Apply ControlNet.',
    },
    UPSCALE_MODEL: {
      what: 'UPSCALE_MODEL: загруженная модель апскейла (в духе ESRGAN).',
      why: 'Увеличивает картинки с добавлением деталей.',
      connect: 'Идёт от Load Upscale Model; идёт к Upscale Image (using Model).',
    },
    CLIP_VISION: {
      what: 'CLIP_VISION: загруженная модель-энкодер изображений.',
      why: 'Нужна, чтобы описать референс для стиля, unCLIP или управления «картинка в видео».',
      connect: 'Идёт от Load CLIP Vision; идёт к CLIP Vision Encode и некоторым нодам «картинка в видео».',
    },
    CLIP_VISION_OUTPUT: {
      what: 'CLIP_VISION_OUTPUT: кодировка одной картинки, сделанная моделью CLIP Vision.',
      why: 'Передаёт, как выглядит референс, нодам, которые используют его для управления.',
      connect: 'Идёт от CLIP Vision Encode; идёт к нодам стиля, unCLIP и conditioning для «картинка в видео».',
    },
    SIGMAS: {
      what: 'SIGMAS: расписание шума — список уровней шума до и после каждого шага сэмплирования.',
      why: 'Кастомные сэмплеры принимают расписание входом вместо настройки steps.',
      connect: 'Идёт от нод-планировщиков, например BasicScheduler; идёт к SamplerCustom или SamplerCustomAdvanced.',
    },
    SAMPLER: {
      what: 'SAMPLER: алгоритм сэмплирования (например euler или dpmpp_2m) как объект.',
      why: 'Кастомные сэмплеры принимают алгоритм входом.',
      connect: 'Идёт от KSamplerSelect или других нод сэмплеров; идёт к SamplerCustom или SamplerCustomAdvanced.',
    },
    GUIDER: {
      what: 'GUIDER: часть, которая объединяет модель и conditioning в одно предсказание шума (CFG и подобное).',
      why: 'SamplerCustomAdvanced принимает guidance отдельной частью, что позволяет использовать особые guider-ы.',
      connect: 'Идёт от нод guider, например BasicGuider или CFGGuider; идёт к SamplerCustomAdvanced.',
    },
    NOISE: {
      what: 'NOISE: источник начального шума (со своим seed), а не сам шум.',
      why: 'SamplerCustomAdvanced принимает шум отдельным входом.',
      connect: 'Идёт от нод шума, например RandomNoise; идёт к SamplerCustomAdvanced.',
    },
    INT: {
      what: 'INT: целое число, например seed, steps или размер.',
      why: 'Обычно задаётся виджетом на ноде; становится связью, когда одно значение общее или вычисляется.',
      connect: 'Идёт от Primitive или математических нод; идёт к любому входу-виджету INT.',
    },
    FLOAT: {
      what: 'FLOAT: дробное число, например cfg, denoise или сила.',
      why: 'Обычно значение виджета; связь позволяет одному значению управлять несколькими нодами.',
      connect: 'Идёт от Primitive или математических нод; идёт к любому входу-виджету FLOAT.',
    },
    STRING: {
      what: 'STRING: текст, например промпт или префикс имени файла.',
      why: 'Связь позволяет подать один текст в несколько нод или получить его от ноды обработки текста.',
      connect: 'Идёт от Primitive или текстовых нод; идёт к текстовым входам, например промпту CLIP Text Encode.',
    },
    BOOLEAN: {
      what: 'BOOLEAN: переключатель «да/нет».',
      why: 'Включает или выключает опцию ноды.',
      connect: 'Идёт от Primitive или логических нод; идёт к входам-виджетам BOOLEAN.',
    },
    COMBO: {
      what: 'COMBO: выбор из списка, например имя файла модели, сэмплер или планировщик.',
      why: 'Большинство настроек загрузчиков и сэмплеров — это combo; список часто составлен из файлов, которые нашёл ComfyUI.',
      connect: 'Обычно выпадающий виджет; подключённый к нему Primitive может разделить выбор с другими нодами.',
    },
  },
  families: {
    sd15: {
      what: 'Stable Diffusion 1.5: классическая модель изображений на 512 пикселей. Обычно один чекпойнт, загружаемый через Load Checkpoint, который даёт MODEL, CLIP и VAE.',
      risk: 'LoRA, ControlNet и эмбеддинги должны быть сделаны для SD 1.5; дополнения для SDXL или Flux с ней не работают.',
    },
    sdxl: {
      what: 'Stable Diffusion XL: модель изображений примерно на 1024 пикселя с двумя текстовыми энкодерами. Обычно один чекпойнт, загружаемый через Load Checkpoint.',
      risk: 'Используйте только LoRA и ControlNet для SDXL. Pony и Illustrious построены на SDXL, но их LoRA обычно лучше работают внутри своей линейки.',
    },
    pony: {
      what: 'Pony Diffusion: линейка моделей, дообученных из SDXL; загружается как SDXL через Load Checkpoint и опирается на собственные теги оценки и рейтинга в промпте.',
      risk: 'Технически это SDXL, поэтому LoRA для SDXL загрузятся, но ожидаемый результат дают LoRA, обученные для Pony; LoRA для SD 1.5 или Flux не работают.',
    },
    illustrious: {
      what: 'Illustrious XL: линейка аниме-моделей, дообученных из SDXL; загружается как SDXL через Load Checkpoint.',
      risk: 'Технически это SDXL, но лучше всего подходят LoRA, обученные для Illustrious (или его потомков); LoRA для SD 1.5 или Flux не работают.',
    },
    flux1: {
      what: 'Flux.1 (dev, schnell) от Black Forest Labs: модель загружается через Load Diffusion Model, текстовые энкодеры clip_l и t5xxl — через DualCLIPLoader (тип flux), VAE ae.safetensors — через Load VAE.',
      risk: 'С ней работают только LoRA для Flux.1. Flux dev ожидает cfg 1.0 и FluxGuidance вместо высокого CFG.',
    },
    flux2: {
      what: 'Flux.2 от Black Forest Labs: модель загружается через Load Diffusion Model, собственный текстовый энкодер на основе Mistral — через Load CLIP, собственный VAE (flux2-vae) — через Load VAE.',
      risk: 'Flux.2 несовместим с файлами Flux.1: LoRA, текстовые энкодеры и VAE должны быть от Flux.2.',
    },
    chroma: {
      what: 'Chroma: модель изображений, выросшая из Flux.1 schnell; использует текстовый энкодер T5-XXL без clip_l и VAE от Flux.',
      risk: 'Используйте LoRA, сделанные для Chroma; LoRA для Flux.1 могут загрузиться, но часто ведут себя не так, как ожидается.',
    },
    'qwen-image': {
      what: 'Qwen-Image от Alibaba Qwen: модель изображений, хорошо рисующая текст на картинках. Модель загружается через Load Diffusion Model, текстовый энкодер Qwen2.5-VL — через Load CLIP, qwen_image_vae — через Load VAE.',
      risk: 'С ней работают только LoRA и ControlNet для Qwen-Image; варианты для редактирования (Qwen-Image-Edit) используют свои графы.',
    },
    'wan2.1': {
      what: 'Wan 2.1 от Alibaba: видеомодель («текст в видео» и «картинка в видео»). Модель загружается через Load Diffusion Model, текстовый энкодер umt5_xxl — через Load CLIP, wan_2.1_vae — через Load VAE; для «картинка в видео» нужен ещё clip_vision_h.',
      risk: 'Используйте LoRA для Wan 2.1 и того же размера модели (1.3B и 14B не взаимозаменяемы).',
    },
    'wan2.2': {
      what: 'Wan 2.2 от Alibaba: видеомодель. Модели 14B состоят из двух экспертов — high noise и low noise, которые работают друг за другом; они используют текстовый энкодер umt5_xxl и wan_2.1_vae, а модель 5B — wan2.2_vae.',
      risk: 'Используйте LoRA для Wan 2.2 под нужного эксперта и размер; двум экспертам 14B нужны два сэмплера с согласованными диапазонами шагов.',
    },
    ltx2: {
      what: 'LTX-2 от Lightricks: аудио-видео модель для «текст в видео» и «картинка в видео», со своим текстовым энкодером и моделями апскейла; точный набор файлов берите из официального шаблона.',
      risk: 'С ней работают только LoRA для LTX-2; LoRA для старых моделей LTX-Video несовместимы.',
    },
    hunyuan: {
      what: 'HunyuanVideo от Tencent: видеомодель. Модель загружается через Load Diffusion Model, текстовые энкодеры clip_l и llava_llama3 — через DualCLIPLoader (тип hunyuan_video), hunyuan_video_vae — через Load VAE.',
      risk: 'Используйте LoRA для HunyuanVideo; HunyuanVideo 1.5 и модели изображений Hunyuan — отдельные семейства.',
    },
    zimage: {
      what: 'Z-Image (Turbo) от Alibaba Tongyi: быстрая модель изображений. Модель загружается через Load Diffusion Model, текстовый энкодер qwen_3_4b — через Load CLIP, VAE от Flux ae.safetensors — через Load VAE.',
      risk: 'С ней работают только LoRA для Z-Image. Модель Turbo рассчитана на малое число шагов и низкий CFG.',
    },
    krea: {
      what: 'FLUX.1 Krea [dev]: модель Flux.1 dev, переобученная Krea и Black Forest Labs; загружается точно как Flux.1 (Load Diffusion Model, DualCLIPLoader с clip_l и t5xxl, ae.safetensors).',
      risk: 'Построена на Flux.1 dev, поэтому LoRA для Flux.1 dev обычно загружаются, но результат может отличаться от исходной модели.',
    },
    sd3: {
      what: 'Stable Diffusion 3 / 3.5 от Stability AI: модель изображений с тремя текстовыми энкодерами (clip_l, clip_g, t5xxl) и 16-канальным латентом (EmptySD3LatentImage).',
      risk: 'С ней работают только LoRA и ControlNet для SD3; SD3 Medium и SD3.5 Large — разные размеры, их дополнения не смешиваются.',
    },
    kolors: {
      what: 'Kolors от Kuaishou: модель изображений, похожая на SDXL, но с текстовым энкодером ChatGLM, поэтому ей нужны свои ноды загрузки.',
      risk: 'LoRA и ControlNet для SDXL с ней надёжно не совместимы; используйте дополнения, сделанные для Kolors.',
    },
    auraflow: {
      what: 'AuraFlow от fal: открытая модель изображений на основе flow; обычно распространяется одним чекпойнтом.',
      risk: 'С ней работают только дополнения, сделанные для AuraFlow.',
    },
    cascade: {
      what: 'Stable Cascade от Stability AI: модель изображений, работающая стадиями (сначала stage C, затем stage B) со своим форматом латента.',
      risk: 'Её стадии и дополнения несовместимы с файлами SD 1.5 или SDXL.',
    },
  },
};
