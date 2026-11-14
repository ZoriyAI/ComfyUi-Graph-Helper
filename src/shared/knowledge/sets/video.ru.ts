import type { KnowledgeSet } from '../coreKnowledge';

/**
 * Встроенные знания о видео, по-русски. Английский набор (video.en.ts) говорит то же самое.
 *
 * Источники: исходники самого ComfyUI (comfy_extras/nodes_wan.py, nodes_lt*.py, nodes_hunyuan.py, nodes_kandinsky5.py,
 * nodes_video.py, nodes_audio*.py, nodes_custom_sampler.py, nodes_frame_interpolation.py, nodes.py), официальные
 * шаблоны и репозитории паков. Несколько записей исправляют основные знания (LATENT, семейства Wan 2.2 и LTX-2):
 * запись набора заменяет основную с тем же владельцем.
 */
export const VIDEO_KNOWLEDGE_RU: KnowledgeSet = {
  nodes: {
    ModelSamplingSD3: {
      what: 'ModelSamplingSD3: задаёт сдвиг (shift) потоковой модели вроде SD3, Wan, HunyuanVideo или Kandinsky 5, то есть сколько работы уходит на ранние, шумные шаги.',
      why: 'Видеомодели запускают со сдвигом из официальных шаблонов: 8 для Wan 2.2, 7 для HunyuanVideo 1.5, 5 для Kandinsky 5. Больший сдвиг отдаёт больше шагов композиции и движению.',
      connect: 'Вход: MODEL (от загрузчика или LoRA) и shift. Выход: MODEL, он идёт в сэмплер или направляющую ноду.',
      risk: 'При слишком маленьком сдвиге видеомодель хуже держит композицию и движение, ролик выходит вялым; при слишком большом страдают мелкие детали.',
    },
    EmptyHunyuanLatentVideo: {
      what: 'Empty Hunyuan Video 1.0 Latent: пустой латент видео (сжатая заготовка, на которой рисует модель) заданной ширины, высоты и числа кадров.',
      why: 'Стартовая заготовка видео из текста для HunyuanVideo 1.0 и для моделей Wan 2.1 и Wan 2.2 на 14B, которые сжимают видео так же.',
      connect: 'Входы: width, height, length (кадры), batch_size. Выход: LATENT, он идёт во вход latent_image сэмплера.',
      risk: 'Число кадров должно быть вида 4n + 1 (49, 81, 121); малой модели Wan 2.2 5B нужна вместо этого Wan22ImageToVideoLatent.',
    },
    WanImageToVideo: {
      what: 'WanImageToVideo: кладёт стартовую картинку в заготовку ролика Wan и в оба промпта, и ролик начинается с этой картинки.',
      why: 'Сердце «картинки в видео» у Wan с моделями i2v (Wan 2.1 и пара Wan 2.2 на 14B).',
      connect: 'Входы: positive и negative (CONDITIONING), vae, width, height, length и по желанию start_image и clip_vision_output. Выходы: positive, negative и latent, они идут в сэмплер вместо простых промптов и заготовки.',
      risk: 'Сэмплер, который по-прежнему берёт промпты напрямую, о картинке не узнаёт. Модели t2v картинку не берут.',
    },
    CreateVideo: {
      what: 'Create Video: собирает пачку кадров (IMAGE) и по желанию звук (AUDIO) в одно VIDEO с заданной частотой кадров.',
      why: 'Шаг перед сохранением: кадры из VAE Decode становятся роликом, который идёт с той скоростью, с какой его нарисовала модель.',
      connect: 'Входы: images, fps и по желанию audio. Выход: VIDEO, он идёт в Save Video.',
      risk: 'fps должен совпадать с моделью: 16 у Wan на 14B, 24 у Wan 2.2 5B, LTX-2, HunyuanVideo 1.5 и Kandinsky 5, 25 у HuMo и InfiniteTalk. С другим числом ролик идёт слишком быстро или медленно.',
    },
    SaveVideo: {
      what: 'Save Video: записывает VIDEO файлом в папку output ComfyUI (по умолчанию mp4).',
      why: 'Конец видеографа; без неё ComfyUI посчитает ролик и ничего не сохранит.',
      connect: 'Входы: video, filename_prefix (может содержать подпапку, например video/ComfyUI), format и codec. Выхода для связи нет.',
    },
    LoadVideo: {
      what: 'Load Video: загружает видеофайл из папки input ComfyUI одним VIDEO, со звуком и частотой кадров.',
      why: 'Начало любого графа, который работает с готовым видео: управляющее видео, источник движения, ролик, который надо сделать плавнее или крупнее.',
      connect: 'Вход: file. Выход: VIDEO, он идёт в Get Video Components за кадрами или прямо в ноду, которая берёт VIDEO.',
      risk: 'Берёт видео целиком. Чтобы взять кусок, с нужной частотой или размером, используйте загрузчик VideoHelperSuite или обрежьте кадры потом.',
    },
    GetVideoComponents: {
      what: 'Get Video Components: делит VIDEO на кадры (IMAGE), звук (AUDIO) и частоту кадров (FLOAT).',
      why: 'С кадрами работают ноды картинок и видео; звук и частота нужны, чтобы вернуть их в результат.',
      connect: 'Вход: video. Выходы: images, audio, fps (в новых версиях ещё bit_depth).',
    },
    LoadAudio: {
      what: 'Load Audio: загружает звуковой файл из папки input ComfyUI как AUDIO.',
      why: 'Голос для видео по речи или звуковая дорожка для Create Video.',
      connect: 'Вход: audio (файл). Выход: AUDIO, он идёт в аудиоэнкодер, в Create Video или в ноды паков говорящего видео.',
    },
    Wan22ImageToVideoLatent: {
      what: 'Wan22ImageToVideoLatent: пустой латент модели Wan 2.2 5B, по желанию со стартовой картинкой.',
      why: 'Модель 5B сжимает видео сильнее, чем модели 14B (16 × 16 пикселей и 4 кадра на ячейку латента), поэтому у неё своя заготовка. Подключите картинку к start_image, и получится «картинка в видео».',
      connect: 'Входы: vae, width, height (кратные 32), length, batch_size и по желанию start_image. Выход: LATENT, он идёт в сэмплер.',
      risk: 'Только для модели 5B с wan2.2_vae; модели 14B берут EmptyHunyuanLatentVideo или WanImageToVideo.',
    },
    WanFirstLastFrameToVideo: {
      what: 'WanFirstLastFrameToVideo: готовит ролик Wan, который начинается одной картинкой и заканчивается другой.',
      why: 'Для превращений и переходов: движение между двумя кадрами модель придумывает сама. Официальный шаблон запускает её на паре Wan 2.2 i2v на 14B.',
      connect: 'Входы: positive, negative, vae, width, height, length, start_image и end_image (и по желанию выходы CLIP Vision обеих картинок). Выходы: positive, negative, latent, они идут в сэмплеры.',
      risk: 'Картинки разных пропорций или из разных сцен дают кашу в середине.',
    },
    Wan22FunControlToVideo: {
      what: 'Wan22FunControlToVideo: готовит ролик Wan 2.2 Fun Control из картинки-образца и управляющего видео (глубина, поза или контуры).',
      why: 'Управляющее видео говорит, как всё движется, картинка-образец говорит, что рисовать.',
      connect: 'Входы: positive, negative, vae, width, height, length, ref_image и control_video. Выходы: positive, negative, latent.',
      risk: 'Нужен файл модели Fun Control (5B или 14B); обычная модель Wan управление не замечает. В управляющем видео должно быть не меньше length кадров.',
    },
    WanFunControlToVideo: {
      what: 'WanFunControlToVideo: вариант ноды управления для Wan 2.1 Fun Control, со стартовой картинкой и входом CLIP Vision.',
      why: 'Для моделей Wan 2.1 Fun Control.',
      connect: 'Входы: positive, negative, vae, width, height, length и по желанию clip_vision_output, start_image, control_video. Выходы: positive, negative, latent.',
    },
    WanVaceToVideo: {
      what: 'WanVaceToVideo: готовит ролик Wan VACE, где одна модель берёт управляющее видео, маски и картинки-образцы для многих задач: видео из видео, инпейнтинг, аутпейнтинг, первый и последний кадр.',
      why: 'Одна нода и одна модель VACE закрывают то, для чего иначе нужна отдельная модель на каждую задачу.',
      connect: 'Входы: positive, negative, vae, width, height, length, strength и по желанию control_video, control_masks, reference_image. Выходы: positive, negative, latent и trim_latent, по которому TrimVideoLatent отрезает кадры образца после сэмплера.',
      risk: 'С картинкой-образцом в начале результата лишние кадры; шаблон отрезает их нодой TrimVideoLatent.',
    },
    WanSoundImageToVideo: {
      what: 'WanSoundImageToVideo: готовит ролик Wan 2.2 S2V, где человек с картинки-образца двигается и говорит под звук.',
      why: 'Видео по речи на нодах самого ComfyUI; длинные ролики делаются кусками по 77 кадров нодой WanSoundImageToVideoExtend.',
      connect: 'Входы: positive, negative, vae, width, height, length и по желанию audio_encoder_output, ref_image, control_video, ref_motion. Выходы: positive, negative, latent.',
      risk: 'Только с согласия человека, чьи лицо и голос используются.',
    },
    WanHuMoImageToVideo: {
      what: 'WanHuMoImageToVideo: готовит ролик HuMo, где человек с картинки-образца произносит слова из звука.',
      why: 'HuMo это модель «речь в видео» на 17B на основе Wan 2.1; шаблон запускает её с LoRA lightx2v за 6 шагов при cfg 1 и 25 кадрах в секунду.',
      connect: 'Входы: positive, negative, vae, width, height, length (по умолчанию 97) и по желанию audio_encoder_output (от энкодера Whisper) и ref_image. Выходы: positive, negative, latent.',
      risk: 'Только с согласия человека, чьи лицо и голос используются.',
    },
    WanAnimateToVideo: {
      what: 'WanAnimateToVideo: готовит ролик Wan 2.2 Animate, где герой с картинки-образца перенимает позы и мимику человека из видео или заменяет этого человека в видео.',
      why: 'Анимация героя на нодах самого ComfyUI. Официальный шаблон делает видео позы и лица паком comfyui_controlnet_aux, а маску героя SAM2.',
      connect: 'Входы: positive, negative, vae, width, height, length и по желанию clip_vision_output, reference_image, face_video, pose_video, background_video и character_mask (для замены), continue_motion. Выходы: positive, negative, latent и значения обрезки для следующего куска.',
      risk: 'Только с согласия человека, чьи лицо или тело используются.',
    },
    TrimVideoLatent: {
      what: 'TrimVideoLatent: отрезает несколько кадров в начале видеолатента.',
      why: 'Убирает кадры образца, которые VACE и Animate добавляют в начало.',
      connect: 'Входы: samples (LATENT) и trim_amount. Выход: LATENT, он идёт в VAE Decode.',
    },
    AudioEncoderLoader: {
      what: 'Audio Encoder Loader: загружает энкодер речи (Whisper или wav2vec2) из models/audio_encoders.',
      why: 'Через него слушают модели видео по речи: HuMo берёт Whisper, Wan 2.2 S2V берёт wav2vec2.',
      connect: 'Вход: audio_encoder_name. Выход: AUDIO_ENCODER, он идёт в Audio Encoder Encode.',
      risk: 'Берите энкодер, который называет шаблон модели; другой даёт губы мимо слов или ошибку.',
    },
    AudioEncoderEncode: {
      what: 'Audio Encoder Encode: превращает звук в то, что читает модель видео по речи.',
      why: 'Связка между Load Audio и стартовой нодой видеомодели.',
      connect: 'Входы: audio_encoder и audio. Выход: AUDIO_ENCODER_OUTPUT, он идёт в WanHuMoImageToVideo или WanSoundImageToVideo.',
    },
    LTXVConditioning: {
      what: 'LTXVConditioning: добавляет частоту кадров к обоим промптам графа LTX.',
      why: 'LTX нужно знать, как быстро идёт время в ролике, для движения и для звука.',
      connect: 'Входы: positive, negative и frame_rate. Выходы: positive и negative, они идут в направляющую ноду.',
      risk: 'Частота здесь, в пустом звуковом латенте и в Create Video должна быть одна.',
    },
    EmptyLTXVLatentVideo: {
      what: 'EmptyLTXVLatentVideo: пустой видеолатент моделей LTX.',
      why: 'LTX сжимает видео сильно (32 × 32 пикселя и 8 кадров на ячейку латента), поэтому у него своя заготовка.',
      connect: 'Входы: width, height (кратные 32), length (8n + 1: 97, 121), batch_size. Выход: LATENT.',
    },
    LTXVEmptyLatentAudio: {
      what: 'Empty LTXV Latent Audio: пустой звуковой латент ролика LTX-2 той же длины, что и видео.',
      why: 'LTX-2 рисует звук вместе с картинкой; звуку нужна своя заготовка.',
      connect: 'Входы: frames_number, frame_rate, batch_size и audio_vae. Выход: LATENT, он идёт вместе с видеозаготовкой в LTXVConcatAVLatent.',
    },
    LTXVConcatAVLatent: {
      what: 'LTXVConcatAVLatent: соединяет видеолатент и звуковой латент в один, чтобы LTX-2 рисовал их вместе.',
      why: 'Картинка и звук рисуются за один проход и не расходятся.',
      connect: 'Входы: video_latent и audio_latent. Выход: latent, он идёт в сэмплер.',
    },
    LTXVSeparateAVLatent: {
      what: 'LTXVSeparateAVLatent: снова делит общий латент LTX-2 на видео и звук.',
      why: 'После сэмплера: видео идёт в апскейлер или VAE, звук в свой декодер.',
      connect: 'Вход: av_latent. Выходы: video_latent и audio_latent.',
    },
    LTXVDualCFGGuider: {
      what: 'LTXVDualCFGGuider: направляющая нода LTX-2 с отдельной силой для видео и для звука.',
      why: 'Промпт может давить на картинку и на звук по-разному. Дистиллированным моделям ставят 1 для обоих.',
      connect: 'Входы: model, positive, negative, video_cfg, audio_cfg. Выход: GUIDER, он идёт в SamplerCustomAdvanced.',
    },
    LTXVLatentUpsampler: {
      what: 'LTXVLatentUpsampler: удваивает ширину и высоту видеолатента LTX моделью апскейла латента.',
      why: 'Двухэтапные графы LTX-2 рисуют в половинном размере и увеличивают перед вторым этапом, это намного быстрее, чем рисовать сразу в полном.',
      connect: 'Входы: samples (видеолатент), upscale_model, vae. Выход: LATENT.',
    },
    LatentUpscaleModelLoader: {
      what: 'Load Latent Upscale Model: загружает апскейлер латента из models/latent_upscale_models.',
      why: 'LTX-2 и HunyuanVideo 1.5 увеличивают свои латенты такими моделями между двумя этапами.',
      connect: 'Вход: model_name. Выход: LATENT_UPSCALE_MODEL.',
      risk: 'Апскейлер привязан к версии модели: от LTX-2.5 не подходит к LTX-2.0, от HunyuanVideo не подходит к LTX.',
    },
    LTXVAudioVAEDecode: {
      what: 'LTXV Audio VAE Decode: превращает звуковой латент LTX-2 в AUDIO.',
      why: 'Звуковая пара для VAE Decode.',
      connect: 'Входы: samples (звуковой латент) и audio_vae. Выход: Audio, он идёт в Create Video.',
    },
    LTXVAudioVAELoader: {
      what: 'LTXV Audio VAE Loader: загружает звуковой VAE, который LTX-2.0 и 2.3 хранят внутри своего чекпойнта.',
      why: 'Для графов, где LTX грузится одним чекпойнтом; у LTX-2.5 звуковой VAE отдельным файлом для Load VAE.',
      connect: 'Вход: ckpt_name. Выход: Audio VAE.',
    },
    LTXAVTextEncoderLoader: {
      what: 'LTXAVTextEncoderLoader: загружает текстовый энкодер Gemma для LTX-2.0 и 2.3 вместе с соединителем из чекпойнта LTX.',
      why: 'Текстовый энкодер графов LTX-2 на чекпойнте; LTX-2.5 грузит свой энкодер нодой Load CLIP с типом ltxv.',
      connect: 'Входы: text_encoder, ckpt_name, device. Выход: CLIP.',
    },
    SamplerCustomAdvanced: {
      what: 'SamplerCustomAdvanced: сэмплер из частей: шум, направляющая нода, метод сэмплирования и список уровней шума (sigmas) приходят из отдельных нод.',
      why: 'Новым семействам (LTX-2, HunyuanVideo 1.5, Flux) нужны настройки, которых у KSampler нет: особая направляющая нода, список шагов вручную.',
      connect: 'Входы: noise, guider, sampler, sigmas, latent_image. Выходы: output (результат) и denoised_output.',
    },
    RandomNoise: {
      what: 'RandomNoise: стартовый шум составного сэмплера, сделанный из сида.',
      why: 'Хранит сид; тот же сид при тех же настройках даёт тот же результат.',
      connect: 'Вход: noise_seed. Выход: NOISE.',
    },
    KSamplerSelect: {
      what: 'KSamplerSelect: выбирает метод сэмплирования (euler, euler_ancestral, uni_pc…) для составного сэмплера.',
      why: 'Тот же выбор, что sampler_name у KSampler, отдельной нодой.',
      connect: 'Вход: sampler_name. Выход: SAMPLER.',
    },
    ManualSigmas: {
      what: 'ManualSigmas: список уровней шума, записанный вручную, по одному на шаг.',
      why: 'Дистиллированные модели обучены на точный короткий список шагов; шаблоны LTX-2 пишут его здесь.',
      connect: 'Вход: sigmas (числа через запятую, от большого до 0). Выход: SIGMAS.',
      risk: 'Копируйте список из официального шаблона; выдуманный даёт шум или кашу.',
    },
    BasicScheduler: {
      what: 'BasicScheduler: считает список уровней шума на заданное число шагов по планировщику.',
      why: 'Обычный способ дать составному сэмплеру шаги.',
      connect: 'Входы: model, scheduler, steps, denoise. Выход: SIGMAS.',
    },
    CFGGuider: {
      what: 'CFGGuider: направляющая нода составного сэмплера с одной силой cfg.',
      why: 'Держит модель и оба промпта, как это делал бы KSampler.',
      connect: 'Входы: model, positive, negative, cfg. Выход: GUIDER.',
    },
    VAEDecodeTiled: {
      what: 'VAE Decode (Tiled): превращает латент в кадры по кусочкам, плитками по пространству и, у видео, по времени.',
      why: 'Разворачивание всех кадров разом это пик памяти в конце видеозапуска; плитки держат его низким. Его берут шаблоны LTX-2 и HunyuanVideo 1.5.',
      connect: 'Входы: samples, vae, tile_size, overlap, temporal_size, temporal_overlap. Выход: IMAGE.',
      risk: 'Совсем маленькие плитки могут оставить слабые швы; их прячет перекрытие (overlap).',
    },
    EasyCache: {
      what: 'EasyCache: пропускает часть работы на шагах, где результат почти не меняется.',
      why: 'Видео быстрее ценой небольшой потери деталей; шаблон HunyuanVideo 1.5 ставит её после загрузчика.',
      connect: 'Вход: model и её пороги. Выход: MODEL.',
    },
    EmptyHunyuanVideo15Latent: {
      what: 'Empty Hunyuan Video 1.5 Latent: пустой латент HunyuanVideo 1.5.',
      why: 'Версия 1.5 сжимает 16 × 16 пикселей на ячейку (1.0 сжимала 8 × 8), поэтому у неё своя заготовка.',
      connect: 'Входы: width, height, length (4n + 1), batch_size. Выход: LATENT.',
    },
    HunyuanVideo15ImageToVideo: {
      what: 'HunyuanVideo15ImageToVideo: готовит ролик HunyuanVideo 1.5 «картинка в видео» со стартовой картинкой.',
      why: 'Пара пустому латенту для «картинки в видео», с файлами модели i2v.',
      connect: 'Входы: positive, negative, vae, width, height, length и по желанию start_image и clip_vision_output. Выходы: positive, negative, latent.',
    },
    Kandinsky5ImageToVideo: {
      what: 'Kandinsky5ImageToVideo: готовит ролик Kandinsky 5 из текста или из стартовой картинки.',
      why: 'Стартовая нода каждого видеографа Kandinsky 5.',
      connect: 'Входы: positive, negative, vae, width, height, length и по желанию start_image. Выходы: positive, negative, latent и cond_latent (закодированная стартовая картинка).',
    },
    FrameInterpolationModelLoader: {
      what: 'Load Frame Interpolation Model: загружает модель FILM или RIFE из models/frame_interpolation.',
      why: 'Чтобы сделать ролик плавнее, дорисовав кадры между кадрами, на нодах самого ComfyUI.',
      connect: 'Вход: model_name. Выход: INTERP_MODEL, он идёт в Frame Interpolate.',
    },
    FrameInterpolate: {
      what: 'Frame Interpolate: дорисовывает новые кадры между каждыми двумя кадрами пачки.',
      why: 'Ролик в 16 кадров с множителем 2 становится плавным, в 32 кадра; оставленный на 16 кадрах он становится замедленным.',
      connect: 'Входы: interp_model, images, multiplier (от 2 до 16). Выход: IMAGE.',
      risk: 'Поставьте fps в Create Video равным старой частоте, умноженной на множитель, иначе ролик пойдёт медленнее.',
    },
    ImageFromBatch: {
      what: 'Image From Batch: берёт из пачки отрезок кадров начиная с batch_index длиной length.',
      why: 'Укорачивает ролик перед медленной работой вроде увеличения.',
      connect: 'Входы: image, batch_index, length. Выход: IMAGE.',
    },
    ImageToMask: {
      what: 'Convert Image to Mask: берёт один цветовой канал картинки (или каждого кадра) как MASK.',
      why: 'Превращает нарисованную видеомаску в маску, которую читает инпейнтинг видео.',
      connect: 'Входы: image и channel (red, green, blue, alpha). Выход: MASK.',
    },
    Canny: {
      what: 'Canny: рисует контуры картинки или каждого кадра видео.',
      why: 'Встроенный способ сделать управляющее видео из контуров для Fun Control или VACE.',
      connect: 'Входы: image, low_threshold, high_threshold. Выход: IMAGE.',
    },
    ImageBatch: {
      what: 'Batch Images: соединяет две пачки кадров в одну, вторую после первой.',
      why: 'Склеивает части длинного видео, сделанные одна за другой; новая нода Batch Images из шаблонов берёт больше входов и делает то же.',
      connect: 'Входы: image1 и image2 (кадры одного размера). Выход: IMAGE, он идёт в Create Video.',
      risk: 'У обеих частей должны быть одинаковые ширина и высота.',
    },
    VHS_LoadVideo: {
      what: 'Load Video (Upload) из VideoHelperSuite: загружает кадры видео из папки input с выбором, какие и сколько.',
      why: 'Берёт кусок видео с нужной частотой и размером: force_rate, skip_first_frames, frame_load_cap, select_every_nth, custom_width и custom_height.',
      connect: 'Выходы: IMAGE (кадры), frame_count, audio (обрезанный по тому же куску) и video_info.',
      risk: 'Кадры считаются после того, как force_rate сменил частоту. Длинное видео в полном размере может заполнить память: ограничьте кадры.',
    },
    VHS_LoadVideoPath: {
      what: 'Load Video (Path) из VideoHelperSuite: тот же загрузчик для видео по пути или адресу.',
      why: 'Для видео, которых нет в папке input.',
      connect: 'Те же поля и выходы, что у Load Video (Upload).',
    },
    VHS_VideoCombine: {
      what: 'Video Combine из VideoHelperSuite: сохраняет кадры видео (mp4, webm, ProRes…) или анимированным gif или webp, со звуком.',
      why: 'Самый частый сохранятель видео в опубликованных графах; он же показывает результат прямо на ноде.',
      connect: 'Входы: images, frame_rate, loop_count, filename_prefix, format, pingpong, save_output и по желанию audio. Выход: Filenames.',
      risk: 'frame_rate должен совпадать с кадрами; с выключенным save_output файл попадает только во временную папку.',
    },
    VHS_VideoInfo: {
      what: 'Video Info из VideoHelperSuite: частота, число кадров, длительность и размер загруженного видео, до и после загрузки.',
      why: 'Чтобы брать частоту из источника, а не вписывать руками.',
      connect: 'Вход: video_info от загрузчика VideoHelperSuite. Выходы: source_ и loaded_ fps, число кадров, длительность, ширина, высота.',
    },
    SeedVR2LoadDiTModel: {
      what: 'SeedVR2 (Down)Load DiT Model: выбирает модель SeedVR2 (3B или 7B, fp16, fp8 или GGUF) и то, как она держится в памяти.',
      why: 'blocks_to_swap держит часть модели в оперативной памяти, и модель 3B работает на скромных картах.',
      connect: 'Входы: model, device, blocks_to_swap, offload_device и другие. Выход: SEEDVR2_DIT, он идёт в SeedVR2 Video Upscaler.',
      risk: 'Если модели нет, пак сам скачивает её в models/SEEDVR2 при первом запуске в ComfyUI.',
    },
    SeedVR2LoadVAEModel: {
      what: 'SeedVR2 (Down)Load VAE Model: загружает VAE SeedVR2, по желанию с кодированием и разворачиванием по кусочкам.',
      why: 'Кусочки держат пик памяти низким на больших кадрах.',
      connect: 'Входы: model, device, encode_tiled, decode_tiled и размеры кусочков. Выход: SEEDVR2_VAE.',
    },
    SeedVR2VideoUpscaler: {
      what: 'SeedVR2 Video Upscaler: перерисовывает кадры видео крупнее, восстанавливая детали и держа соседние кадры согласованными.',
      why: 'Восстановление и увеличение видео (и отдельных картинок) одной моделью.',
      connect: 'Входы: image (кадры), dit, vae, seed, resolution (короткая сторона результата), batch_size (4n + 1 кадров вместе), color_correction и другие. Выход: IMAGE.',
      risk: 'Больший batch_size держит движение согласованным и требует больше памяти.',
    },
    'RIFE VFI': {
      what: 'RIFE VFI из ComfyUI-Frame-Interpolation: дорисовывает кадры между кадрами моделью RIFE.',
      why: 'Быстрая интерполяция; пак советует RIFE 4.25 и новее.',
      connect: 'Входы: ckpt_name, frames, multiplier, clear_cache_after_n_frames, fast_mode, ensemble, scale_factor. Выход: IMAGE.',
      risk: 'Пак сам скачивает модели при первом запуске; часть из них старые файлы .pth.',
    },
    'FILM VFI': {
      what: 'FILM VFI из ComfyUI-Frame-Interpolation: дорисовывает кадры между кадрами моделью FILM от Google.',
      why: 'Медленнее RIFE и хорош на большом движении.',
      connect: 'Входы: ckpt_name, frames, clear_cache_after_n_frames, multiplier. Выход: IMAGE.',
    },
    ProPainterInpaint: {
      what: 'ProPainter Inpainting: убирает то, что закрыто маской, в каждом кадре видео и заполняет это по другим кадрам.',
      why: 'Убрать из видео предмет, логотип или человека так, чтобы фон остался цельным.',
      connect: 'Входы: image (кадры), mask (по одной на кадр), width, height, mask_dilates, flow_mask_dilates, ref_stride, neighbor_length, subvideo_length, raft_iter, fp16. Выходы: IMAGE, FLOW_MASK, MASK_DILATE.',
      risk: 'Память быстро растёт с размером и числом кадров. Фон, который в ролике нигде не виден, можно только угадать.',
    },
    ProPainterOutpaint: {
      what: 'ProPainter Outpainting: расширяет кадры видео и заполняет новые края.',
      why: 'Сменить пропорции видео без обрезки.',
      connect: 'Входы: image, width, height, width_scale, height_scale и другие. Выходы: IMAGE, OUTPAINT_MASK, output_width, output_height.',
    },
    CoTrackerNode: {
      what: 'CoTracker из comfyui_cotracker_node: следит за точками через кадры видео (трекинг точек).',
      why: 'Даёт пути движущихся точек для моделей, управляемых движением (например, треки Wan ATI и Wan Move), или для эффектов, которые держатся за предмет.',
      connect: 'Входы: images, tracking_points (по желанию x,y построчно), grid_size, max_num_of_points и по желанию tracking_mask. Выходы: tracking_results (текст) и image_with_results.',
    },
    OnnxDetectionModelLoader: {
      what: 'ONNX Detection Model Loader из ComfyUI-WanAnimatePreprocess: загружает модель поз ViTPose и поисковик людей YOLO.',
      why: 'Первый шаг подготовки ведущего видео для Wan Animate.',
      connect: 'Входы: vitpose_model, yolo_model (файлы в models/detection), onnx_device. Выход: model, он идёт в Pose and Face Detection.',
    },
    PoseAndFaceDetection: {
      what: 'Pose and Face Detection: находит позу и вырезает лицо в каждом кадре видео.',
      why: 'Даёт Wan Animate движение тела и движение лица по отдельности.',
      connect: 'Входы: model, images, width, height. Выходы: pose_data, face_images и рамки.',
    },
    DrawViTPose: {
      what: 'Draw ViT Pose: рисует найденные позы скелетиками, кадр за кадром.',
      why: 'Wan Animate читает позу именно такими картинками.',
      connect: 'Входы: pose_data, width, height. Выход: pose_images.',
    },
    ImageResizeKJv2: {
      what: 'Resize Image v2 из KJNodes: меняет размер картинок или кадров, сохраняя пропорции растяжением, полями или обрезкой, до размера, кратного заданному числу.',
      why: 'Видеомодели хотят стороны, кратные 16 или 32; эта нода приводит кадры к ним за один шаг.',
      connect: 'Входы: image, width, height, upscale_method, keep_proportion, divisible_by и по желанию mask. Выходы: IMAGE, width, height (и маска).',
    },
    GetImageRangeFromBatch: {
      what: 'Get Image or Mask Range From Batch из KJNodes: берёт num_frames кадров начиная с start_index.',
      why: 'Обрезает ролик или видеомаску до куска, нужного модели.',
      connect: 'Входы: start_index, num_frames и images или masks. Выходы: IMAGE и MASK.',
    },
    ImageBatchMulti: {
      what: 'Image Batch Multi из KJNodes: соединяет несколько картинок или пачек кадров в одну пачку.',
      why: 'Ставит ролики или картинки-образцы друг за другом.',
      connect: 'Входы: inputcount и image_1, image_2, … Выход: images.',
    },
    GetImageSizeAndCount: {
      what: 'Get Image Size & Count из KJNodes: пропускает кадры дальше и сообщает их ширину, высоту и число.',
      why: 'Чтобы передать размер и число кадров видео следующим нодам.',
      connect: 'Вход: image. Выходы: image, width, height, count.',
    },
    ColorMatch: {
      what: 'Color Match из KJNodes: подгоняет цвета кадров к картинке-образцу.',
      why: 'Убирает дрейф цвета в длинном или склеенном видео.',
      connect: 'Входы: image_ref, image_target, method, strength. Выход: image.',
    },
    SetNode: {
      what: 'Set из KJNodes: даёт значению имя, чтобы нода Get в другом месте холста взяла его без длинной связи.',
      why: 'Большие видеографы передают модель, VAE или число кадров во много мест; Set и Get держат холст читаемым.',
      connect: 'Один вход любого типа и имя. Работает только во фронтенде ComfyUI: в сохранённом графе связь идёт прямо от источника к получателю.',
    },
    GetNode: {
      what: 'Get из KJNodes: берёт значение, которое держит нода Set с тем же именем.',
      why: 'Вторая половина Set: связь без провода.',
      connect: 'Выбирает имя; один выход того типа, что держит Set.',
    },
  },
  linkTypes: {
    LATENT: {
      what: 'LATENT: картинка или видео в сжатом виде, в котором работает модель. Модели картинок обычно уменьшают её в 8 раз по каждой стороне; видеомодели сжимают сильнее и ещё по времени (Wan 2.1 и Wan 2.2 на 14B: 8 × 8 пикселей и 4 кадра на ячейку; Wan 2.2 5B и HunyuanVideo 1.5: 16 × 16 и 4; LTX: 32 × 32 и 8).',
      why: 'Сэмплеры читают и пишут латенты; картинка становится видна только после VAE Decode.',
      connect: 'Приходит из ноды пустого латента, VAE Encode или сэмплера; идёт в сэмплеры, ноды увеличения латента или VAE Decode.',
    },
    VIDEO: {
      what: 'VIDEO: целый ролик одним значением: кадры, звук и частота кадров.',
      why: 'Его отдаёт Load Video и берёт Save Video.',
      connect: 'Приходит из Load Video или Create Video; идёт в Save Video или Get Video Components.',
    },
    AUDIO: {
      what: 'AUDIO: звук, как волна с частотой дискретизации.',
      why: 'Голос для видео по речи, дорожка для Create Video, звук, который делает LTX-2.',
      connect: 'Приходит из Load Audio, Get Video Components или звукового декодера; идёт в аудиоэнкодер, Create Video или сохранятель видео.',
    },
    AUDIO_ENCODER: {
      what: 'AUDIO_ENCODER: загруженный энкодер речи (Whisper или wav2vec2).',
      why: 'Через него слушают модели видео по речи.',
      connect: 'Приходит из Audio Encoder Loader; идёт в Audio Encoder Encode.',
    },
    AUDIO_ENCODER_OUTPUT: {
      what: 'AUDIO_ENCODER_OUTPUT: звук, каким его услышал энкодер речи.',
      why: 'Его читают HuMo и Wan 2.2 S2V, чтобы двигать губы.',
      connect: 'Приходит из Audio Encoder Encode; идёт в WanHuMoImageToVideo или WanSoundImageToVideo.',
    },
    LATENT_UPSCALE_MODEL: {
      what: 'LATENT_UPSCALE_MODEL: модель, которая увеличивает латент, не разворачивая его.',
      why: 'Её берут двухэтапные графы LTX-2 и HunyuanVideo 1.5 между этапами.',
      connect: 'Приходит из Load Latent Upscale Model; идёт в LTXVLatentUpsampler или HunyuanVideo15LatentUpscaleWithModel.',
    },
    INTERP_MODEL: {
      what: 'INTERP_MODEL: загруженная модель интерполяции кадров (FILM или RIFE).',
      why: 'Чтобы дорисовывать кадры между кадрами.',
      connect: 'Приходит из Load Frame Interpolation Model; идёт в Frame Interpolate.',
    },
    NOISE: {
      what: 'NOISE: стартовый шум составного сэмплера вместе с сидом.',
      why: 'Одна из четырёх частей SamplerCustomAdvanced.',
      connect: 'Приходит из RandomNoise (или DisableNoise для прохода без нового шума); идёт в SamplerCustomAdvanced.',
    },
    GUIDER: {
      what: 'GUIDER: модель и промпты вместе со способом, каким они направляют сэмплирование (один cfg или отдельный для видео и звука).',
      why: 'Одна из четырёх частей SamplerCustomAdvanced.',
      connect: 'Приходит из CFGGuider, LTXVDualCFGGuider и других направляющих нод; идёт в SamplerCustomAdvanced.',
    },
    SEEDVR2_DIT: {
      what: 'SEEDVR2_DIT: настройки модели SeedVR2 (какой файл, на каком устройстве, сколько блоков переносится).',
      why: 'Модельная часть увеличителя SeedVR2.',
      connect: 'Приходит из SeedVR2 (Down)Load DiT Model; идёт в SeedVR2 Video Upscaler.',
    },
    SEEDVR2_VAE: {
      what: 'SEEDVR2_VAE: настройки VAE SeedVR2.',
      why: 'Часть VAE увеличителя SeedVR2.',
      connect: 'Приходит из SeedVR2 (Down)Load VAE Model; идёт в SeedVR2 Video Upscaler.',
    },
    VHS_VIDEOINFO: {
      what: 'VHS_VIDEOINFO: что VideoHelperSuite знает о загруженном видео: частота, кадры, длительность, размер.',
      why: 'Чтобы дальше брать частоту источника.',
      connect: 'Приходит из загрузчика VideoHelperSuite; идёт в Video Info.',
    },
    VHS_FILENAMES: {
      what: 'VHS_FILENAMES: имена файлов, которые записал Video Combine.',
      why: 'Подключают редко; некоторые ноды выбирают по нему записанный файл.',
      connect: 'Приходит из Video Combine.',
    },
  },
  families: {
    'wan2.2': {
      what: 'Wan 2.2 от Alibaba: семейство видеомоделей. Модели на 14B идут парой экспертов, high noise и low noise, их по очереди запускают два сэмплера (t2v для текста, i2v для картинки; ещё первый и последний кадр, Fun Control, Fun Inpaint, S2V для речи и Animate для героев); они берут umt5_xxl и wan_2.1_vae и рисуют 16 кадров в секунду. Малая модель TI2V 5B берёт текст или картинку одним сэмплером, работает с wan2.2_vae и рисует 24 кадра в секунду.',
      risk: 'LoRA для Wan 2.1 на 14B часто подходят и к моделям Wan 2.2 на 14B (так используют LoRA для ускорения); проверьте страницу LoRA. LoRA для 1.3B, 5B и 14B не взаимозаменяемы, а wan2.2_vae подходит только к модели 5B.',
    },
    ltx2: {
      what: 'LTX-2 от Lightricks (версии 2.0, 2.3 и 2.5): видеомодели, которые рисуют картинку и звук вместе. Текст в видео, картинка в видео, первый и последний кадр и управление глубиной, позой или контурами через IC-LoRA. Шаблоны работают в два этапа с апскейлером латента между ними; текстовый энкодер Gemma. 2.0 и 2.3 грузятся одним чекпойнтом; 2.5 идёт отдельными файлами модели, видео-VAE, звукового VAE и текстового энкодера.',
      risk: 'Файлы одной версии не смешиваются с другой (апскейлер, VAE, текстовый энкодер). Кадров 8n + 1, стороны кратны 32. LoRA старой LTX-Video 0.9 не работают.',
    },
    'wan2.2-5b': {
      what: 'Wan 2.2 TI2V 5B: малая модель Wan 2.2 для текста и картинки в видео одним файлом, около 10 ГБ в fp16. Load Diffusion Model, umt5_xxl через Load CLIP (тип wan), wan2.2_vae, Wan22ImageToVideoLatent; 1280 × 704, 121 кадр, 24 кадра в секунду, 20 шагов, cfg 5. Работает на картах с 8 ГБ с переносом в оперативную память.',
      risk: 'Нужен wan2.2_vae, а не wan_2.1_vae. LoRA моделей 14B к ней не подходят.',
    },
    'wan-fun': {
      what: 'Wan Fun (Control, InP, Camera) от Alibaba PAI: модели Wan, обученные следовать управляющему видео, заполнять промежуток между кадрами или следовать пути камеры. Wan 2.2 Fun Control бывает на 5B и на 14B; ноды Wan22FunControlToVideo и WanFunControlToVideo.',
      risk: 'Модель Fun не замечает управления, если оно идёт не через её ноду; обычная модель Wan не замечает его вовсе.',
    },
    'wan-vace': {
      what: 'Wan VACE: одна модель Wan 2.1 (1.3B или 14B), которая берёт управляющие видео, маски и картинки-образцы для многих задач: видео из видео, образец в видео, инпейнтинг, аутпейнтинг, первый и последний кадр. Нода WanVaceToVideo, после сэмплера TrimVideoLatent.',
      risk: 'Берёт VAE и текстовый энкодер Wan 2.1; кадры образца нужно отрезать от результата.',
    },
    'wan-animate': {
      what: 'Wan 2.2 Animate 14B: герой с картинки-образца перенимает позы и мимику человека из видео или заменяет этого человека. Встроенная нода WanAnimateToVideo; шаблон готовит позу паком comfyui_controlnet_aux, а маску SAM2; на стороне паков это делают WanVideoWrapper и ComfyUI-WanAnimatePreprocess.',
      risk: 'Только с согласия того, чьи лицо или тело используются. Длинные ролики делаются кусками, и цвет между ними может плыть.',
    },
    'wan-s2v': {
      what: 'Wan 2.2 S2V 14B: речь в видео. Человек с картинки-образца говорит и двигается под звук, услышанный аудиоэнкодером wav2vec2. Ноды: WanSoundImageToVideo для первых 77 кадров, WanSoundImageToVideoExtend для каждого следующего куска; 16 кадров в секунду.',
      risk: 'Только с согласия человека, чьи лицо и голос используются.',
    },
    humo: {
      what: 'HuMo: модель «речь в видео» на 17B на основе Wan 2.1, от Университета Цинхуа и ByteDance. Человек с картинки-образца произносит слова звука, услышанного через Whisper. Нода WanHuMoImageToVideo; 640 × 640, 97 кадров, 25 кадров в секунду; с LoRA lightx2v 6 шагов при cfg 1.',
      risk: 'Только с согласия человека, чьи лицо и голос используются. Берёт VAE и текстовый энкодер Wan 2.1.',
    },
    hunyuan15: {
      what: 'HunyuanVideo 1.5 от Tencent: видеомодель на 8.3B, 480p и 720p, текст и картинка в видео. qwen_2.5_vl_7b и byt5_small_glyphxl через DualCLIPLoader (тип hunyuan_video_15), hunyuanvideo15_vae, EmptyHunyuanVideo15Latent или HunyuanVideo15ImageToVideo, составной сэмплер со сдвигом 7, 24 кадра в секунду; второй этап по желанию увеличивает до 1080p.',
      risk: 'Не совместима с файлами HunyuanVideo 1.0 (VAE, LoRA, текстовые энкодеры).',
    },
    kandinsky5: {
      what: 'Kandinsky 5.0 Video от Сбера: видеомодели Lite (2B) и Pro, текст и картинка в видео. qwen_2.5_vl_7b с clip_l через DualCLIPLoader (тип kandinsky5), VAE от HunyuanVideo 1.0, Kandinsky5ImageToVideo; шаблон Lite: 768 × 512, 121 кадр, 24 кадра в секунду, сдвиг 5, 50 шагов, cfg 5.',
      risk: 'Файлы Lite сделаны для роликов на 5 или 10 секунд (это видно по имени); дистиллированным нужно меньше шагов.',
    },
    ltxv: {
      what: 'LTX-Video 0.9 от Lightricks: ранние, меньшие модели LTX, видео без звука, быстрые на скромных картах. Встроенные ноды LTXV, текстовый энкодер t5 через Load CLIP (тип ltxv).',
      risk: 'Не совместима с файлами и LoRA от LTX-2.',
    },
    seedvr2: {
      what: 'SeedVR2 от ByteDance: модель восстановления и увеличения видео, 3B или 7B, в fp16, fp8 или GGUF. Работает через пак ComfyUI-SeedVR2_VideoUpscaler (он сам скачивает файлы в models/SEEDVR2) или через собственные ноды SeedVR2 в ComfyUI.',
      risk: 'Каждый кадр перерисовывается: длинные ролики делаются долго. Модель 7B чётче и требует намного больше памяти.',
    },
    'frame-interpolation': {
      what: 'Модели интерполяции кадров (FILM, RIFE и другие): маленькие модели, которые дорисовывают кадры между кадрами. Собственная нода ComfyUI Frame Interpolate читает их из models/frame_interpolation; у пака ComfyUI-Frame-Interpolation своя нода на каждую модель.',
      risk: 'Быстрое движение даёт размазанные формы; старые файлы .pth при загрузке могут выполнить код.',
    },
  },
  packs: {
    'ComfyUI-VideoHelperSuite': {
      what: 'Загрузка и сохранение видео с выбором: кусок видео с нужной частотой и размером, сохранение в mp4, webm, gif и не только, со звуком.',
      nodes: 'Load Video (Upload), Load Video (Path), Video Combine, Video Info, Meta Batch Manager и ноды, которые делят, соединяют и выбирают кадры.',
    },
    'ComfyUI-LTXVideo': {
      what: 'Дополнительные ноды от Lightricks для LTX-2 сверх того, что есть в самом ComfyUI: сэмплеры по кусочкам и по кругу, направляющие IC-LoRA, улучшение промпта через Gemma, HDR и другое.',
      nodes: 'LTXVBaseSampler, LTXVExtendSampler, LTXVLoopingSampler, LTXVTiledSampler, LTXAddVideoICLoRAGuide, LTXVGemmaEnhancePrompt, LTXVSpatioTemporalTiledVAEDecode.',
      risk: 'Сама LTX-2 работает на нодах ComfyUI; пак нужен только графам, которые берут его ноды. Некоторые его ноды скачивают модели при первом запуске.',
    },
    'ComfyUI-Frame-Interpolation': {
      what: 'Интерполяция кадров многими моделями: RIFE, FILM, AMT, GMFSS и другими.',
      nodes: 'RIFE VFI, FILM VFI, AMT VFI и по ноде на модель; Make Interpolation State List, чтобы пропускать кадры.',
      risk: 'Сам скачивает модели при первом запуске; несколько из них файлы .pth.',
    },
    'ComfyUI-SeedVR2_VideoUpscaler': {
      what: 'Увеличение и восстановление видео и картинок через SeedVR2, с переносом блоков, VAE по кусочкам и GGUF для скромных карт.',
      nodes: 'SeedVR2 (Down)Load DiT Model, SeedVR2 (Down)Load VAE Model, SeedVR2 Video Upscaler, SeedVR2 Torch Compile Settings.',
      risk: 'Сам скачивает модели в models/SEEDVR2 при первом запуске.',
    },
    ComfyUI_ProPainter_Nodes: {
      what: 'Инпейнтинг и аутпейнтинг видео через ProPainter: убрать предметы и расширить кадры, заполняя их по соседним кадрам.',
      nodes: 'ProPainter Inpainting, ProPainter Outpainting.',
      risk: 'Сам скачивает модели при первом запуске. Нужна маска на каждый кадр.',
    },
    comfyui_cotracker_node: {
      what: 'Трекинг точек через CoTracker: пути точек через видео для генерации по движению и для эффектов.',
      nodes: 'CoTracker со служебными нодами для треков и генератором шума Перлина.',
    },
    'ComfyUI-WanAnimatePreprocess': {
      what: 'Подготовка ведущего видео для Wan 2.2 Animate: поза тела и вырезанное лицо в каждом кадре.',
      nodes: 'ONNX Detection Model Loader, Pose and Face Detection, Draw ViT Pose.',
      risk: 'Файлы ViTPose и YOLO кладутся в models/detection.',
    },
    'ComfyUI-KJNodes': {
      what: 'Большой набор инструментов от kijai, на который опираются многие видеографы: изменение размера, пачки кадров, маски, подгонка цвета и ноды Set и Get без проводов.',
      nodes: 'Resize Image v2, Get Image or Mask Range From Batch, Image Batch Multi, Get Image Size & Count, Color Match, Set, Get, Points Editor, VRAM Debug.',
    },
  },
  fields: {
    ModelSamplingSD3: {
      shift: 'Сколько сэмплирования уходит на ранние, шумные шаги, где складываются композиция и движение. Wan 2.2: 8 (5 с некоторыми LoRA для ускорения); HunyuanVideo 1.5: 7; Kandinsky 5: 5. Слишком маленькое значение даёт вялое движение и слабую композицию.',
    },
    CreateVideo: {
      fps: 'Кадров в секунду в ролике. Берите частоту модели: 16 у Wan на 14B, 24 у Wan 2.2 5B, LTX-2, HunyuanVideo 1.5 и Kandinsky 5, 25 у HuMo и InfiniteTalk. После интерполяции: старая частота, умноженная на множитель.',
    },
    SaveVideo: {
      filename_prefix: 'Начало имени файла; может содержать подпапку output, например video/ComfyUI.',
      format: 'Контейнер: auto или mp4.',
      codec: 'Кодек: auto или h264.',
    },
    EmptyHunyuanLatentVideo: {
      length: 'Число кадров вида 4n + 1 (49, 81, 121). 81 кадр при 16 кадрах в секунду это пять секунд у Wan на 14B.',
    },
    WanImageToVideo: {
      length: 'Число кадров вида 4n + 1. 81 при 16 кадрах в секунду это пять секунд.',
    },
    Wan22ImageToVideoLatent: {
      width: 'Кратно 32. Модель обучена на 1280 × 704 (и 704 × 1280).',
      length: 'Число кадров вида 4n + 1. 121 при 24 кадрах в секунду это пять секунд.',
    },
    WanFirstLastFrameToVideo: {
      length: 'Число кадров от первой картинки до последней включительно, вида 4n + 1. В шаблоне 81.',
    },
    WanHuMoImageToVideo: {
      length: 'Число кадров; 97 при 25 кадрах в секунду это около четырёх секунд. Звук дальше этого не проговаривается.',
    },
    UNETLoader: {
      weight_dtype: 'Как веса держатся в памяти. default оставляет формат файла; fp8_e4m3fn вдвое уменьшает память модели fp16 ценой небольшой потери качества.',
    },
    VAEDecodeTiled: {
      tile_size: 'Сторона квадратного кусочка в пикселях. Меньше экономит память и работает дольше; 512 надёжное начало, 256 для совсем малых карт.',
      overlap: 'Насколько кусочки перекрываются, чтобы не было видно швов.',
      temporal_size: 'Для видео: сколько кадров разворачивается за раз. Обычно 32 или 64; меньше экономит память.',
      temporal_overlap: 'Для видео: сколько кадров у соседних кусков общих.',
    },
    LTXVConditioning: {
      frame_rate: 'Частота, под которую рисуется ролик: 24 в шаблонах LTX-2.5, 25 в некоторых LTX-2.0. То же число идёт в пустой звуковой латент и в Create Video.',
    },
    EmptyLTXVLatentVideo: {
      length: 'Число кадров вида 8n + 1 (97, 121). Ширина и высота кратны 32.',
    },
    LTXVDualCFGGuider: {
      video_cfg: 'Насколько сильно промпт направляет картинку. 1 у дистиллированных моделей; полным нужно больше.',
      audio_cfg: 'Насколько сильно промпт направляет звук. 1 у дистиллированных моделей.',
    },
    ManualSigmas: {
      sigmas: 'Уровни шума, по одному на шаг, от большого до 0, через запятую. Копируйте их из официального шаблона модели.',
    },
    FrameInterpolate: {
      multiplier: 'Во сколько раз больше кадров: 2 вставляет один новый кадр между каждыми двумя, 4 три.',
    },
    SeedVR2LoadDiTModel: {
      blocks_to_swap: 'Сколько блоков модели держится в оперативной памяти и подгружается по мере нужды: до 32 у модели 3B, до 36 у 7B. Больше экономит видеопамять и работает медленнее; 0 выключает.',
    },
    SeedVR2VideoUpscaler: {
      resolution: 'Длина короткой стороны результата в пикселях: 1080 для Full HD.',
      batch_size: 'Сколько кадров перерисовываются вместе, вида 4n + 1 (5, 21, 33). Больше держит движение согласованным и требует больше памяти.',
      color_correction: 'Как цвета возвращаются к исходным: lab рекомендуемый по умолчанию, wavelet бережёт мелкие детали.',
    },
    VHS_LoadVideo: {
      force_rate: 'Брать кадры так, будто у видео такая частота; 0 оставляет родную.',
      skip_first_frames: 'Сколько кадров пропустить в начале, считая по новой частоте.',
      frame_load_cap: 'Не больше стольких кадров; 0 берёт все.',
      select_every_nth: 'Брать каждый n-й кадр: 2 вдвое уменьшает число кадров.',
      custom_width: 'Изменить размер кадров при загрузке; 0 оставляет размер, одна сторона сохраняет пропорции.',
    },
    VHS_VideoCombine: {
      frame_rate: 'Кадров в секунду в сохранённом видео; та же частота, с которой кадры загружены или нарисованы.',
      format: 'Тип файла: video/h264-mp4 для обычного mp4, video/webm, image/gif и другие.',
      save_output: 'Включено: файл идёт в папку output; выключено: только во временную папку.',
    },
    KSamplerAdvanced: {
      noise_seed: 'Сид стартового шума. Тот же сид при тех же настройках даёт тот же результат; части длинного видео с одним сидом меньше меняются на швах.',
    },
    WanVaceToVideo: {
      strength: 'Насколько крепко держат картинка-образец и управляющее видео: 1, как в шаблонах; меньше даёт промпту больше свободы.',
    },
    TrimVideoLatent: {
      trim_amount: 'Сколько кадров латента отрезать в начале. Подключите выход trim_latent ноды WanVaceToVideo: она знает, сколько добавил образец.',
    },
    ImageFromBatch: {
      batch_index: 'Первый кадр, который берётся, считая с 0; -1 это последний кадр, опора для следующей части длинного видео.',
      length: 'Сколько кадров взять оттуда.',
    },
    ProPainterInpaint: {
      mask_dilates: 'На сколько пикселей расширить маску, чтобы край предмета не остался. По умолчанию 5.',
      subvideo_length: 'Сколько кадров обрабатывается за раз; меньше экономит память.',
    },
  },
  concepts: {
    'anchor-picture': {
      term: 'Опорная картинка',
      text: 'Картинка, которая привязывает видео к облику: стартовая картинка (первый кадр), первый и последний кадры или образец, который модель читает на каждом кадре. Она закрепляет то, что на ней видно; чего на ней нет, модель придумывает сама.',
    },
    'identity-drift': {
      term: 'Дрейф личности',
      text: 'Лицо или герой понемногу меняется на протяжении видео: чем дальше ролик уходит от опоры, тем больше модель рисует по своему представлению о человеке. Растёт с длиной и с большим движением; его сдерживают короткие ролики, вход образца, LoRA героя и части, склеенные по ключевым кадрам.',
    },
    'reference-input': {
      term: 'Вход образца',
      text: 'Вход, который видеомодель читает на каждом кадре, чтобы герой оставался тем же, например reference_image у WanVaceToVideo или ref_image у WanHuMoImageToVideo. В отличие от стартовой картинки, это не первый кадр, и он не закрепляет позу и место.',
    },
  },
};
