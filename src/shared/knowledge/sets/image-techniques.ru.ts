/**
 * Built-in knowledge on picture techniques, Russian; seeded for the node cards, the inspector and the assistant. The
 * English file says the same things. Facts are checked against ComfyUI's nodes.py and comfy_extras, docs.comfy.org and
 * the repositories of the packs (image-techniques.ts names the source of each class).
 */
import type { TechniqueTexts } from './image-techniques';

export const IMAGE_TECHNIQUES_KNOWLEDGE_RU: TechniqueTexts = {
  nodes: {
    ImageScaleToTotalPixels: {
      what: 'Scale Image to Total Pixels: меняет размер картинки так, чтобы в ней было примерно заданное число мегапикселей, сохраняя пропорции.',
      why: 'Приводит загруженную картинку к размеру, на котором учили модель, до кодирования: 1 мегапиксель для SDXL и более новых моделей, около 0.25 для SD 1.5.',
      connect: 'Входы: image (IMAGE), upscale_method, megapixels, resolution_steps. Выход: IMAGE, обычно в VAE Encode или в ноду инпейнтинга.',
      risk: 'Маска к этой картинке должна в итоге быть того же размера; нода инпейнтинга ComfyUI сама растягивает её до картинки.',
    },
    ImagePadForOutpaint: {
      what: 'Pad Image for Outpainting: добавляет к картинке пустую рамку с выбранных сторон и выдаёт маску этой рамки.',
      why: 'Первая нода аутпейнтинга: рамку модель дорисовывает, маска говорит ей, где.',
      connect: 'Входы: image, left, top, right, bottom (пиксели, шагом 8) и feathering (мягкая граница внутрь картинки). Выходы: IMAGE в pixels и MASK в mask ноды инпейнтинга или VAE Encode (for Inpainting).',
      risk: 'Новая рамка серая, сохранять в ней нечего, поэтому сэмплеру нужен denoise 1. Добавляйте понемногу: полосу модель заполняет лучше, чем широкую рамку со всех сторон.',
    },
    SAM3_Detect: {
      what: 'SAM3 Detect: находит на картинке то, что названо текстом (или отмечено точками либо рамками), и выдаёт его точную маску.',
      why: 'Маска без рисования рукой: напишите «hat» и получите маску шляпы для инпейнтинга, замены фона или детейлера.',
      connect: 'Входы: model (MODEL из чекпойнта SAM3, загруженного через Load Checkpoint), image, conditioning (CLIP Text Encode со словом, на CLIP того же чекпойнта), необязательные bboxes, positive_coords и negative_coords, threshold, refine_iterations, individual_masks. Выходы: masks (MASK) и bboxes.',
      risk: 'Маска совпадает с той картинкой, которую видела нода: давайте ей картинку в том размере, в каком её берёт следующая нода. Плотная маска оставляет швы при инпейнтинге; расширьте её нодой Grow Mask.',
    },
    LoadBackgroundRemovalModel: {
      what: 'Load Background Removal Model: загружает модель, которая отличает предмет картинки от фона, например BiRefNet, из models/background_removal.',
      why: 'Первая половина удаления фона встроенными нодами ComfyUI.',
      connect: 'Вход: bg_removal_name. Выход: bg_model, в Remove Background.',
    },
    RemoveBackground: {
      what: 'Remove Background: прогоняет картинку через модель удаления фона и выдаёт маску предмета.',
      why: 'Маска белая на предмете; с Invert Mask и Join Image with Alpha фон становится прозрачным.',
      connect: 'Входы: bg_removal_model (из Load Background Removal Model) и image. Выход: mask (MASK).',
      risk: 'Join Image with Alpha читает маску как «что спрятать», поэтому шаблон самого ComfyUI сначала выворачивает маску нодой Invert Mask.',
    },
    InvertMask: {
      what: 'Invert Mask: выворачивает маску, так что закрытое становится открытым и наоборот.',
      why: 'Когда нода даёт маску предмета, а следующей нужна маска фона, или наоборот.',
      connect: 'Вход: mask. Выход: MASK.',
    },
    JoinImageWithAlpha: {
      what: 'Join Image with Alpha: добавляет к картинке маску как её прозрачность.',
      why: 'Последний шаг удаления фона: картинка с прозрачностью сохраняется в PNG.',
      connect: 'Входы: image и alpha (MASK; где она белая, картинка становится прозрачной). Выход: IMAGE с четырьмя каналами, в Save Image.',
      risk: 'Формат без прозрачности, например JPEG, заливает прозрачную часть цветом.',
    },
    GrowMask: {
      what: 'Grow Mask: расширяет маску на заданное число пикселей (отрицательное число сужает её).',
      why: 'Маска от искателя облегает предмет вплотную; несколько лишних пикселей дают модели место сшить край при перерисовке.',
      connect: 'Входы: mask, expand (пиксели), tapered_corners. Выход: MASK.',
    },
    ImageCompositeMasked: {
      what: 'Image Composite Masked: кладёт одну картинку на другую в заданное место через маску.',
      why: 'Ставит вырезанный предмет на новый фон или возвращает перерисованную часть на всю картинку.',
      connect: 'Входы: destination (нижняя картинка), source (верхняя), x, y, resize_source и необязательная mask (где видна верхняя). Выход: IMAGE.',
    },
    MaskPreview: {
      what: 'Preview Mask: показывает маску на ноде чёрно-белой картинкой, не сохраняя её.',
      why: 'Чтобы увидеть, что на самом деле закрывает маска искателя или нарисованная рукой, до того как что-то рисуется.',
      connect: 'Вход: mask. Выходов нет.',
    },
    ConditioningSetMask: {
      what: 'Conditioning (Set Mask): ограничивает описание (conditioning) областью маски, с заданной силой.',
      why: 'Разные описания для разных частей одной картинки, нарисованных рукой или найденных моделью; части соединяют нодой Conditioning (Combine).',
      connect: 'Входы: conditioning, mask, strength, set_cond_area (default или «mask bounds», чтобы считать описание только внутри рамки маски). Выход: CONDITIONING.',
      risk: 'Частям картинки вне всех масок тоже нужно своё описание, обычно описание всей сцены, добавленное к остальным.',
    },
    ConditioningSetAreaPercentage: {
      what: 'Conditioning (Set Area with Percentage): ограничивает описание прямоугольником, заданным долями картинки, от 0 до 1.',
      why: 'То же, что Conditioning (Set Area), но прямоугольник остаётся на месте, когда меняется размер картинки.',
      connect: 'Входы: conditioning, width, height, x, y (от 0 до 1) и strength. Выход: CONDITIONING, обычно в Conditioning (Combine).',
    },
    DifferentialDiffusion: {
      what: 'Differential Diffusion: заставляет мягкую маску действовать мягко, так что серый край маски перерисовывается лишь отчасти.',
      why: 'Прячет шов инпейнтинга и аутпейнтинга; шаблоны Flux Fill в ComfyUI ставят её перед сэмплером.',
      connect: 'Входы: model и strength. Выход: MODEL, в сэмплер.',
    },
    StyleModelLoader: {
      what: 'Load Style Model: загружает модель стиля из models/style_models, например Flux.1 Redux.',
      why: 'Первая половина работы с картинкой как образцом стиля или содержания.',
      connect: 'Вход: style_model_name. Выход: STYLE_MODEL, в Apply Style Model.',
      risk: 'Модель стиля принадлежит одному семейству: Redux сделан для Flux.1 dev и schnell.',
    },
    StyleModelApply: {
      what: 'Apply Style Model: добавляет к описанию то, что модель зрения увидела на картинке-образце.',
      why: 'Модель тогда рисует с обликом образца: цвета, материалы, настроение, часто и содержимое.',
      connect: 'Входы: conditioning (описание), style_model, clip_vision_output (из CLIP Vision Encode), strength, strength_type (multiply масштабирует добавку; attn_bias вместо этого взвешивает её во внимании модели). Выход: CONDITIONING, во вход positive сэмплера или в ещё одну Apply Style Model.',
      risk: 'При strength 1 Redux склонен копировать образец и забывать слова; опустите примерно до 0.5, чтобы вернуть описанию голос.',
    },
    FluxKontextImageScale: {
      what: 'FluxKontextImageScale: приводит картинку к ближайшему размеру, на котором учили модель для правки, около одного мегапикселя, сохраняя пропорции.',
      why: 'Шаблоны Flux.1 Kontext и Qwen-Image-Edit ставят её сразу после Load Image, чтобы картинку не обрезало и не исказило.',
      connect: 'Вход: image. Выход: IMAGE, в ноду текста модели для правки и в VAE Encode.',
    },
    TextEncodeQwenImageEditPlus: {
      what: 'Text Encode Qwen Image Edit Plus: читает указание для правки вместе с тремя картинками самое большее, для Qwen-Image-Edit 2509 и 2511.',
      why: 'Читатель текста этих моделей видит картинки, поэтому указание понимается о самой картинке: «сделай диван зелёным».',
      connect: 'Входы: clip (CLIPLoader с type qwen_image), prompt, vae, image1, image2, image3. Выход: CONDITIONING, в сэмплер; вторая такая нода с пустым prompt и теми же картинками даёт negative.',
      risk: 'Старая нода Text Encode Qwen Image Edit берёт одну картинку и сделана для первой модели Qwen-Image-Edit.',
    },
    ReferenceLatent: {
      what: 'Set Reference Latent: прикрепляет к описанию латент картинки как картинку, на которую смотрит модель.',
      why: 'Так Flux.1 Kontext и Flux.2 Klein получают картинку, которую правят или которой следуют.',
      connect: 'Входы: conditioning и latent (из VAE Encode). Выход: CONDITIONING, в ноду усиления или сэмплер.',
    },
    VAEEncodeTiled: {
      what: 'VAE Encode (Tiled): превращает большую картинку в латент по кускам.',
      why: 'Второй проход по большой картинке, когда VAE Encode не хватает памяти.',
      connect: 'Входы: pixels, vae, tile_size, overlap. Выход: LATENT.',
    },
    RepeatLatentBatch: {
      what: 'Repeat Latent Batch: повторяет латент несколько раз и делает из него пачку.',
      why: 'Несколько вариантов «картинки из картинки» за один запуск: каждая копия получает свой шум.',
      connect: 'Входы: samples и amount. Выход: LATENT, в сэмплер.',
    },
    LatentFromBatch: {
      what: 'Latent From Batch: берёт из пачки один или несколько латентов по номеру, считая с 0.',
      why: 'Чтобы работать дальше с понравившимся вариантом пачки, с тем же шумом, что у него был.',
      connect: 'Входы: samples, batch_index, length. Выход: LATENT.',
    },
    LoadImageMask: {
      what: 'Load Image (as Mask): загружает один канал картинки (alpha, red, green или blue) как маску.',
      why: 'Для масок, нарисованных в другой программе и сохранённых картинкой.',
      connect: 'Входы: image и channel. Выход: MASK.',
    },
    SetUnionControlNetType: {
      what: 'SetUnionControlNetType: говорит ControlNet вида «union», какую управляющую картинку он получает: canny, depth, openpose и другие.',
      why: 'ControlNet «union» читает несколько видов в одном файле; эта нода говорит, какой придёт.',
      connect: 'Входы: control_net (из Load ControlNet Model) и type. Выход: CONTROL_NET, в Apply ControlNet.',
    },
    ImageStitch: {
      what: 'Image Stitch: ставит две картинки рядом или одну над другой.',
      why: 'Чтобы сравнить результат с исходником на одной картинке или дать модели для правки две картинки как одну.',
      connect: 'Входы: image1, direction, match_image_size, spacing_width, spacing_color, image2. Выход: IMAGE.',
    },
    DepthAnythingV2Preprocessor: {
      what: 'Depth Anything V2 - Relative (comfyui_controlnet_aux): превращает картинку в карту глубины, близкое светлое, далёкое тёмное.',
      why: 'Делает управляющую картинку для ControlNet глубины, чтобы новая картинка сохранила пространство образца.',
      connect: 'Входы: image, ckpt_name (по умолчанию vitl), resolution. Выход: IMAGE, в Apply ControlNet.',
      risk: 'Свою модель нода скачивает сама при первом запуске. Карте глубины нужен ControlNet для глубины, а не для контуров.',
    },
    CannyEdgePreprocessor: {
      what: 'Canny Edge (comfyui_controlnet_aux): находит края картинки, как встроенная Detect Edges (Canny), в заданном разрешении.',
      why: 'Управляющая картинка для ControlNet canny, в том же виде, что и у остальных препроцессоров пака.',
      connect: 'Входы: image, low_threshold и high_threshold (от 0 до 255), resolution. Выход: IMAGE.',
    },
    AIO_Preprocessor: {
      what: 'AIO Aux Preprocessor (comfyui_controlnet_aux): все препроцессоры пака за одним списком.',
      why: 'Переключаться между глубиной, линиями и позой без смены нод; шаблоны ComfyUI используют её с Depth Anything V2.',
      connect: 'Входы: image, preprocessor, resolution. Выход: IMAGE.',
    },
    IPAdapterUnifiedLoader: {
      what: 'IPAdapter Unified Loader (ComfyUI_IPAdapter_plus): загружает модель IP-Adapter и её модель зрения по пресету.',
      why: 'Избавляет от выбора двух файлов руками: пресет называет силу и вид (PLUS, FACE и другие).',
      connect: 'Входы: model и preset. Выходы: model и ipadapter, в IPAdapter или IPAdapter Advanced.',
      risk: 'Он находит файлы по точным именам в models/ipadapter и models/clip_vision; переименованный файл не найдётся.',
    },
    IPAdapter: {
      what: 'IPAdapter (ComfyUI_IPAdapter_plus): заставляет модель рисовать в манере картинки-образца.',
      why: '«LoRA из одной картинки» для SD 1.5 и SDXL: стиль, содержание или и то и другое.',
      connect: 'Входы: model и ipadapter (из общего загрузчика), image, weight, start_at, end_at, weight_type (standard, prompt is more important, style transfer), необязательная attn_mask. Выход: MODEL, в сэмплер.',
      risk: 'Он меняет модель, а не описание, поэтому стоит на пути модели. Работает только с SD 1.5 и SDXL.',
    },
    IPAdapterAdvanced: {
      what: 'IPAdapter Advanced (ComfyUI_IPAdapter_plus): то же, что IPAdapter, со всеми настройками: больше видов веса, способ соединить несколько картинок, картинка нежелательного.',
      why: 'Когда простой ноды мало: только композиция, сильный стиль, тонкий баланс нескольких образцов.',
      connect: 'Входы: model, ipadapter, image, weight, weight_type, combine_embeds, start_at, end_at, embeds_scaling, необязательные image_negative, attn_mask, clip_vision. Выход: MODEL.',
    },
    FaceDetailer: {
      what: 'FaceDetailer (ComfyUI-Impact-Pack): находит на готовой картинке лица (или другие предметы, по искателю), увеличивает каждое, рисует заново и ставит обратно.',
      why: 'Мелкие лица на картинке в полный рост выходят чёткими; с искателем рук то же делается для рук. Он перерисовывает то лицо, которое есть; лицо другого человека на его место он не ставит.',
      connect: 'Входы: image, model, clip, vae, positive, negative (те же, что у картинки), bbox_detector (из UltralyticsDetectorProvider), guide_size, denoise и обычные настройки сэмплера, необязательная sam_model_opt. Выходы: image (исправленная картинка), вырезанные лица, mask.',
      risk: 'Выше denoise 0.6 лицо может превратиться в другое. guide_size 512 подходит для SD 1.5, 1024 для SDXL.',
    },
    SAMLoader: {
      what: 'SAMLoader (ComfyUI-Impact-Pack): загружает модель SAM из models/sams для детейлеров.',
      why: 'С ней маска детейлера идёт по контуру лица, а не прямоугольником, и оставляет меньше швов.',
      connect: 'Входы: model_name и device_mode. Выход: SAM_MODEL, в sam_model_opt ноды FaceDetailer.',
    },
    UltralyticsDetectorProvider: {
      what: 'UltralyticsDetectorProvider (ComfyUI-Impact-Subpack): загружает искатель YOLO для лиц, рук или людей из models/ultralytics.',
      why: 'Искатели говорят FaceDetailer и другим детейлерам, где лица или руки.',
      connect: 'Вход: model_name (bbox/... для рамок, segm/... для контуров). Выходы: BBOX_DETECTOR и SEGM_DETECTOR.',
      risk: 'Искатели это файлы .pt, которые могут выполнить код при загрузке: берите их только со страницы, которую называет пак.',
    },
    InpaintCropImproved: {
      what: '✂️ Inpaint Crop (ComfyUI-Inpaint-CropAndStitch): вырезает область вокруг маски с запасом и приводит её к удобному модели размеру.',
      why: 'Маленькая часть большой картинки рисуется в родном размере модели и выходит чёткой; остальная картинка не трогается вовсе.',
      connect: 'Входы: image, mask, настройки размера и смешивания. Выходы: stitcher (для ✂️ Inpaint Stitch), вырезанная картинка и её маска, в граф инпейнтинга.',
    },
    InpaintStitchImproved: {
      what: '✂️ Inpaint Stitch (ComfyUI-Inpaint-CropAndStitch): вставляет перерисованный кусок обратно в исходную картинку с мягкой границей.',
      why: 'Вторая половина «вырезать и вшить»: в исходнике меняется только закрашенная часть.',
      connect: 'Входы: stitcher (из ✂️ Inpaint Crop) и перерисованная картинка из VAE Decode. Выход: IMAGE.',
    },
    DownloadAndLoadSAM2Model: {
      what: '(Down)Load SAM2Model (ComfyUI-segment-anything-2): загружает модель SAM2, при первом запуске скачивая её в models/sam2.',
      why: 'Искатель для Sam2Segmentation.',
      connect: 'Входы: model, segmentor (single_image для картинок, video для роликов), device, precision. Выход: sam2_model.',
    },
    Sam2Segmentation: {
      what: 'Sam2Segmentation (ComfyUI-segment-anything-2): обводит предмет, отмеченный точками или рамками, и выдаёт его маску.',
      why: 'С рамками от Florence2 получается маска по словам; с точками из редактора точек маска по щелчкам.',
      connect: 'Входы: sam2_model, image, необязательные coordinates_positive, coordinates_negative, bboxes, individual_objects. Выход: mask.',
    },
    DownloadAndLoadFlorence2Model: {
      what: 'DownloadAndLoadFlorence2Model (ComfyUI-Florence2): загружает модель Florence-2, при первом запуске скачивая её в models/LLM.',
      why: 'Модель для Florence2Run: подписи, рамки по словам, текст на картинках.',
      connect: 'Входы: model, precision, attention. Выход: florence2_model.',
    },
    Florence2Run: {
      what: 'Florence2Run (ComfyUI-Florence2): выполняет задачу Florence-2 над картинкой: подпись, подробную подпись, рамки того, что названо текстом, и другое.',
      why: 'caption_to_phrase_grounding находит рамки по словам для SAM2; more_detailed_caption описывает картинку словами, понятными модели.',
      connect: 'Входы: image, florence2_model, text_input, task и её настройки. Выходы: image, mask, caption, data (рамки в JSON, в Florence2 Coordinates).',
    },
    'WD14Tagger|pysssss': {
      what: 'WD14 Tagger (ComfyUI-WD14-Tagger): перечисляет теги, которые модель WD14 видит на картинке, строкой слов.',
      why: 'Показывает, как описали бы картинку аниме-модели (и семейства Pony и Illustrious): готовое описание, с которого можно начать.',
      connect: 'Входы: image, model, threshold, character_threshold и настройки текста. Выход: STRING, например в ноду текста или в просмотр.',
      risk: 'Теги описывают видимое, в том числе то, чего вы не хотите в описании; прочтите их, прежде чем использовать.',
    },
    DetailDaemonSamplerNode: {
      what: 'Detail Daemon Sampler (ComfyUI-Detail-Daemon): оборачивает сэмплер так, что на средних шагах он убирает чуть меньше шума, а это добавляет мелких деталей.',
      why: 'Меньше размытых фонов и больше фактуры, особенно с Flux.',
      connect: 'Входы: sampler (из KSamplerSelect), detail_amount, start, end, bias, exponent и другие. Выход: SAMPLER, в SamplerCustom или SamplerCustomAdvanced.',
      risk: 'Она работает со сборными сэмплерами, не с KSampler. Слишком большой detail_amount пересушивает резкость: для SDXL держитесь ниже примерно 0.25.',
    },
    PCLazyTextEncode: {
      what: 'PC: Schedule prompt (comfyui-prompt-control): нода текста, которая понимает расписание в тексте, например [cat:dog:0.5], и записанные в нём LoRA.',
      why: 'Одно описание меняется по шагам: сначала одно, к концу другое, без лишних нод.',
      connect: 'Входы: clip и text. Выход: CONDITIONING, в сэмплер.',
    },
  },
  packs: {
    comfyui_controlnet_aux: {
      what: 'Делает управляющие картинки для ControlNet из обычных: глубину, линии, контуры, позу человека, карты нормалей, сегментацию.',
      nodes: 'Depth Anything V2 - Relative, Canny Edge, LineArt, OpenPose Pose, DWPose, AIO Aux Preprocessor (все они за одним списком).',
      risk: 'Большинство нод скачивают свои модели сами при первом запуске.',
    },
    'ComfyUI-Advanced-ControlNet': {
      what: 'Тонкий ControlNet: сила, которая меняется по шагам и по пачке, маски того, где он действует, мягкие веса на манер других программ.',
      nodes: 'Apply Advanced ControlNet, Load Advanced ControlNet Model, Timestep Keyframe, Latent Keyframe.',
    },
    ComfyUI_IPAdapter_plus: {
      what: 'IP-Adapter для SD 1.5 и SDXL: картинка-образец управляет стилем, композицией или лицом.',
      nodes: 'IPAdapter Unified Loader, IPAdapter, IPAdapter Advanced, IPAdapter Style & Composition, ноды FaceID.',
      risk: 'Автор держит пак в режиме поддержки. Общему загрузчику нужны файлы с именами точно как на странице пака. Переносить лицо можно только того, кто на это согласен.',
    },
    'ComfyUI-Impact-Pack': {
      what: 'Детейлеры, которые находят на картинке лица, руки или другие предметы и рисуют их заново крупнее, а ещё маски по найденному и инструменты для плиток.',
      nodes: 'FaceDetailer, SAMLoader, Detailer (SEGS), Make Tile SEGS, Simple Detector (SEGS).',
      risk: 'Детейлер перерисовывает то, что есть; лицо другого человека на его место он не ставит.',
    },
    'ComfyUI-Impact-Subpack': {
      what: 'Искатели YOLO для Impact Pack.',
      nodes: 'UltralyticsDetectorProvider: искатели лиц, рук и людей из models/ultralytics (bbox и segm).',
      risk: 'Искатели это файлы .pt, которые могут выполнить код при загрузке.',
    },
    'ComfyUI-Inpaint-CropAndStitch': {
      what: 'Инпейнтинг маленькой части большой картинки: область вокруг маски вырезается, рисуется в размере модели и вшивается обратно.',
      nodes: '✂️ Inpaint Crop, ✂️ Inpaint Stitch.',
    },
    'ComfyUI-segment-anything-2': {
      what: 'Маски SAM2: предмет обводится по точкам, по рамкам или по рамкам, найденным Florence2; работает и для видео.',
      nodes: '(Down)Load SAM2Model, Sam2Segmentation, Florence2 Coordinates, Sam2 Video Segmentation.',
    },
    'ComfyUI-Florence2': {
      what: 'Florence-2, небольшая модель, которая видит картинки: подписи, рамки по словам, текст на картинках.',
      nodes: 'DownloadAndLoadFlorence2Model, Florence2Run.',
    },
    'ComfyUI-RMBG': {
      what: 'Удаление фона и сегментация многими моделями (RMBG-2.0, BiRefNet, BEN и другие), в том числе для лиц, одежды и волос.',
      nodes: 'RMBG (Remove Background) и ноды Segment этого пака.',
    },
    'ComfyUI-WD14-Tagger': {
      what: 'Подбирает к картинке теги, на которых учили аниме-модели, чтобы понять, как такая модель её описала бы.',
      nodes: 'WD14 Tagger; он есть и в меню правой кнопки у нод, которые показывают картинку.',
    },
    'ComfyUI-JoyCaption': {
      what: 'JoyCaption описывает картинку длинными предложениями или тегами, в нескольких стилях, моделью, которая видит картинки.',
      nodes: 'JoyCaption, JoyCaption (Advanced), JoyCaption GGUF, инструменты подписей для пачек.',
      risk: 'Модели большие; моделям GGUF нужны дополнительные библиотеки.',
    },
    'ComfyUI-Detail-Daemon': {
      what: 'Добавляет мелких деталей, меняя, сколько шума убирается на средних шагах.',
      nodes: 'Detail Daemon Sampler, Detail Daemon Sampler GUI, Detail Daemon Graph Sigmas, Multiply Sigmas, Lying Sigma Sampler.',
    },
    'comfyui-prompt-control': {
      what: 'Расписания в описании: слова и LoRA, которые меняются по шагам, области, записанные прямо в тексте.',
      nodes: 'PC: Schedule prompt, PC: Schedule LoRAs.',
    },
    ComfyUI_LayerStyle: {
      what: 'Отделка картинки как в графическом редакторе: тени, свечение, обводка, цветокоррекция, уровни, LUT, маски и слои.',
      nodes: 'DropShadow, OuterGlow, Stroke, ColorBalance, Levels, LUT Apply, AutoAdjust и многие другие.',
    },
    'comfyui-propost': {
      what: 'Фотографическая отделка: зерно плёнки, виньетка, радиальное размытие, размытие по глубине, LUT.',
      nodes: 'Film Grain, Vignette, Radial Blur, Depth Map Blur, Apply LUT.',
    },
    'ComfyUI-Lora-Manager': {
      what: 'Библиотека LoRA и чекпойнтов с их страницами, картинками-превью, словами-триггерами и заметками; приложение читает оттуда слова и заметки LoRA.',
      nodes: 'Lora Loader (LoraManager), его Lora Stacker и ноды слов-триггеров, своя Save Image.',
    },
    ComfyUI_UltimateSDUpscale: {
      what: 'Увеличивает картинку и перерисовывает её плитками, каждую в размере модели, так что очень большие картинки получают детали и не упираются в память.',
      nodes: 'Ultimate SD Upscale и его вариант без шага увеличения.',
    },
  },
  topics: {
    'inpainting-models': {
      what: 'Модели, обученные рисовать под маской: они видят картинку вокруг и сшивают границу. У SD 1.5 это чекпойнты со словом «inpainting» в названии (models/checkpoints); у Flux это Flux.1 Fill (models/diffusion_models, со своими загрузчиками). Инпейнтить умеет любая модель, просто граница заметнее.',
      risk: 'Модели для инпейнтинга нужен denoise 1. Обычная лучше работает при 0.6-0.8 с InpaintModelConditioning и включённой маской шума.',
    },
    'upscale-models': {
      what: 'Небольшие сети, которые увеличивают картинки в 2 или 4 раза и рисуют чёткие края (ESRGAN и родственные), из models/upscale_models, загрузка через Load Upscale Model. Разные обучены на фотографиях, рисунках или аниме.',
      risk: 'Многие приходят файлами .pth, которые могут выполнить код при загрузке: берите их со страницы модели или из собрания, которому доверяете. Ошибок они не исправляют; это делает второй проход сэмплером.',
    },
    controlnets: {
      what: 'Модели ControlNet (models/controlnet) управляют рисованием через управляющую картинку. Каждая читает один вид (canny, lineart, depth, openpose, scribble) или несколько (вида union), и каждая обучена для одного семейства моделей.',
      risk: 'ControlNet для SD 1.5 не работает с SDXL, Flux или Qwen-Image; ControlNet глубины не читает контуры.',
    },
    'ip-adapter-files': {
      what: 'Модели IP-Adapter (models/ipadapter) с их моделями зрения (models/clip_vision), для SD 1.5 и SDXL; моделям FaceID нужны ещё insightface и своя LoRA.',
      risk: 'Общий загрузчик ComfyUI_IPAdapter_plus находит их только по точным именам со страницы пака; файлы .bin могут выполнить код при загрузке.',
    },
    'style-models': {
      what: 'Модели стиля (models/style_models), например Flux.1 Redux, превращают то, что модель зрения увидела на картинке, в добавку к описанию. Redux нужна модель зрения sigclip в models/clip_vision.',
      risk: 'Redux сделан для Flux.1 dev и schnell; на полной силе он копирует образец.',
    },
    'editing-models': {
      what: 'Модели, которые меняют картинку по указанию. Шаблоны ComfyUI показывают Qwen-Image-Edit 2509 и 2511 (TextEncodeQwenImageEditPlus), Qwen Image 2.1 (своя нода текста), Flux.1 Kontext dev и Flux.2 Klein (Set Reference Latent). Их файлы лежат в models/diffusion_models, models/text_encoders и models/vae.',
      risk: 'У каждого семейства своя нода текста и свои настройки; граф одного не запускает другое. Платные ноды API для правки стоят денег и отправляют картинку и слова в облачный сервис.',
    },
    'background-removal-models': {
      what: 'Модели, которые отличают предмет от фона, например BiRefNet, в models/background_removal для встроенной Load Background Removal Model. Паки вроде ComfyUI-RMBG приносят больше.',
    },
    'segmentation-models': {
      what: 'Модели, которые обводят предметы: SAM3 как чекпойнт для встроенной SAM3 Detect (models/checkpoints), SAM2 для ComfyUI-segment-anything-2 (models/sam2), SAM для Impact Pack (models/sams).',
    },
    detectors: {
      what: 'Искатели YOLO лиц, рук и людей для Impact Pack, в models/ultralytics/bbox (рамки) и models/ultralytics/segm (контуры).',
      risk: 'Файлы .pt могут выполнить код при загрузке: берите их только со страницы, которую называет пак.',
    },
    'image-loras': {
      what: 'LoRA для картинок лежат в models/loras. Для SD 1.5 и SDXL их ставят в Load LoRA, которая меняет модель и читателя текста (strength_model и strength_clip); для Flux, Qwen-Image и Z-Image в LoraLoaderModelOnly. Их можно ставить цепочкой; действия складываются.',
      risk: 'LoRA работает с тем семейством, для которого её обучили; LoRA для Pony и Illustrious действуют друг на друге и на чистом SDXL слабее или странно. Многим нужны их слова-триггеры в описании.',
    },
    'lora-kinds': {
      what: 'Виды LoRA: персонаж (один человек или фигура, прежде всего лицо), тело (телосложение, пропорции, анатомия), одежда, поза (приблизительно), стиль, детали (больше или меньше мелких деталей) и ускорение (меньше шагов, со своими шагами и cfg). Вид узнают по карточке файла на вкладке «Модели» (базовая модель, слова-триггеры, заметки автора), по странице, откуда файл взят, и по ComfyUI-Lora-Manager, если он установлен; имени файла мало.',
      risk: 'LoRA реального человека можно использовать только с его согласия. Точная поза приходит от ControlNet, а не от LoRA позы.',
    },
    'lora-strength': {
      what: 'Сила LoRA: у Load LoRA их две. strength_model говорит, насколько LoRA меняет рисование, strength_clip, насколько она меняет чтение слов. 1 это сила, на которой её учили; большинство работает от 0.6 до 1; у LoraLoaderModelOnly есть только strength_model. Лучшее значение автор часто пишет на странице.',
      risk: 'Выше 1 LoRA обычно выжигает цвета и двоит формы. Отрицательная сила разворачивает её действие, и это редко даёт то, чего ждут.',
    },
    'lora-several': {
      what: 'Несколько LoRA сразу: ноды Load LoRA цепочкой, каждая получает выходы предыдущей. Их изменения складываются, поэтому место в цепочке значит мало, а сила много. Настраивайте по одной, остальные на 0: сначала персонажа, потом тело или одежду, стиль последним; сравнивайте каждую с ней и без неё при неизменном seed.',
      risk: 'Две или три на полной силе спорят и ломают картинку: давайте каждой чуть меньше, чем дали бы одной. Держите в описании только слова-триггеры тех LoRA, что стоят в графе.',
    },
    'lora-side-effects': {
      what: 'LoRA меняет больше, чем обещает: она выучила всё, что было на её картинках, а не только свой предмет. LoRA тела или одежды тянет к своим картинкам и лица, свет и стиль; LoRA стиля может менять лица и анатомию.',
      risk: 'Чтобы удержать лицо: опустите силу другой LoRA, держите её strength_clip ниже strength_model, LoRA персонажа чуть сильнее остальных, а лицо перерисуйте после детейлером. LoRA для другого семейства моделей ничего не делает или ломает картинку.',
    },
    'seeds-and-batches': {
      what: 'Seed задаёт начальный шум. Когда «control after generate» стоит на fixed, одинаковые настройки дают одну и ту же картинку, и изменение показывает, что оно делает; на randomize каждый запуск новый. batch_size пустого латента (или Repeat Latent Batch для картинки из картинки) делает несколько картинок сразу, каждую со своим шумом.',
    },
    'saved-workflow': {
      what: 'Save Image записывает в сохраняемый PNG весь граф вместе с описаниями, и картинка, перетащенная в ComfyUI, снова его открывает. Preview Image держит картинки только во временной папке.',
      risk: 'Отправленный PNG отправляет и свой граф с описаниями. ComfyUI, запущенный с параметром --disable-metadata, не пишет граф в файлы; перевод картинки в другой формат тоже его убирает.',
    },
    luts: {
      what: 'LUT (таблица цвета, файл .cube) это готовый цветовой облик, как при цветокоррекции кино. ComfyUI_LayerStyle и comfyui-propost применяют их к готовой картинке; держат их в своих папках или в models/luts.',
    },
  },
  fields: {
    'ImageScaleToTotalPixels.megapixels': 'К какому размеру привести картинку, в миллионах пикселей: 1 для SDXL и более новых моделей, около 0.25 для SD 1.5.',
    'InpaintModelConditioning.noise_mask': 'Включено: заново рисуется только закрашенное. Выключено: рисуется вся картинка, а модель для инпейнтинга берёт маску только как подсказку.',
    'ImagePadForOutpaint.right': 'Сколько пикселей добавить справа, шагом 8; left, top и bottom работают так же. Полоса около 256 за раз даётся модели легче, чем широкая рамка.',
    'ImagePadForOutpaint.feathering': 'Сколько пикселей старой картинки мягко переходят в новую рамку, чтобы шов не был виден.',
    'ControlNetApplyAdvanced.strength': 'Насколько строго модель держится управляющей картинки: 1 строго; около 0.6 свободнее внутри контуров; 0 выключает его.',
    'ControlNetApplyAdvanced.start_percent': 'С какой части шагов действует ControlNet, от 0 до 1. 0.2 даёт модели сначала самой разложить картинку.',
    'ControlNetApplyAdvanced.end_percent': 'До какой части шагов действует ControlNet, от 0 до 1. 0.8 оставляет последние шаги свободными для деталей.',
    'Canny.low_threshold': 'Края слабее этого отбрасываются; меньшие значения оставляют больше мелких деталей.',
    'Canny.high_threshold': 'Края сильнее этого остаются всегда; вместе с low_threshold решает, сколько линий получит картинка.',
    'LoraLoader.strength_model': 'Насколько LoRA меняет рисование. Обычно от 0.6 до 1; выше 1 картинки часто ломаются. Двум LoRA в цепочке давайте чуть меньше, чем каждой отдельно.',
    'LoraLoader.strength_clip': 'Насколько LoRA меняет чтение слов. По умолчанию 1; 0 оставляет слова такими, как их читает модель без LoRA.',
    'LoraLoader.lora_name': 'Файл LoRA из models/loras. Он должен быть сделан для семейства той модели, на которую его ставят; его карточка на вкладке «Модели» говорит семейство и слова-триггеры.',
    'LoraLoaderModelOnly.lora_name': 'Файл LoRA из models/loras для моделей, чей читатель текста загружается отдельно (Flux, Qwen-Image, Z-Image, Wan). Он должен быть сделан для того же семейства.',
    'LoraLoaderModelOnly.strength_model': 'Насколько LoRA меняет рисование; 1 это сила, на которой её учили. LoRA ускорения ставят на ту силу, что названа на её странице.',
    'SAM3_Detect.threshold': 'Насколько уверен должен быть искатель: ниже находит больше, в том числе похожее; выше может не найти ничего. По умолчанию 0.5; 0.3, когда маска выходит пустой.',
    'SAM3_Detect.individual_masks': 'Включено: отдельная маска на каждый найденный предмет вместо одной на все.',
    'StyleModelApply.strength': 'Сколько весит картинка-образец: при 1 Redux склонен её копировать; около 0.5 оставляет место словам.',
    'StyleModelApply.strength_type': 'multiply масштабирует добавку образца; attn_bias вместо этого взвешивает её во внимании модели. Сравните оба при одном seed.',
    'IPAdapter.weight': 'Насколько образец управляет моделью: 0.8 хорошее начало; 0.5 только подкрашивает; 1 и выше давит образцом на картинку.',
    'IPAdapter.weight_type': 'standard берёт стиль и содержимое; style transfer только облик (точен с SDXL); prompt is more important оставляет главным описание.',
    'IPAdapterUnifiedLoader.preset': 'Какой IP-Adapter загрузить: LIGHT слабый, STANDARD средний, PLUS сильный, пресеты FACE для портретов. Пресеты только для SD1.5 говорят об этом в названии.',
    'FaceDetailer.denoise': 'Насколько лицо рисуется заново: 0.5 делает его чётким и сохраняет черты; выше 0.6 оно может стать другим лицом.',
    'FaceDetailer.guide_size': 'До какого размера увеличивают найденное лицо перед рисованием: 512 для SD 1.5, 1024 для SDXL.',
    'FaceDetailer.bbox_threshold': 'Насколько искатель должен быть уверен, что нашёл лицо; ниже находит маленькие и отвёрнутые лица, но и ложные тоже.',
    'DepthAnythingV2Preprocessor.resolution': 'Размер, в котором считается глубина; чем ближе к размеру картинки, тем тоньше детали. 1024 хорошее начало.',
    'ImageScale.width': 'Ширина, к которой привести картинку; 0 сохраняет пропорции по высоте. Для второго прохода вдвое больше первой картинки.',
    'CLIPVisionEncode.crop': 'center вырезает квадрат из середины картинки, прежде чем её увидит модель зрения; none показывает всю картинку сжатой.',
    'SaveImage.filename_prefix': 'Начало имени файла; косая черта делает подпапку в output, например portraits/test.',
  },
};
