[English](Detailer.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Исправление лиц и рук детейлером

<!-- lesson: detailer -->
Урок «detailer» в группе **Паки и инструменты** списка уроков. Шагов: 8.

## Чему вы научитесь
Impact Pack находит лица на готовой картинке и рисует каждое заново в большем размере, так что мелкие лица выходят чёткими.

## Что понадобится
- Урок продолжает [Первая картинка из текста](Image.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Паки нод: **ComfyUI-Impact-Pack**, **ComfyUI-Impact-Subpack**. Их вы ставите в ComfyUI сами, потом выбираете **Синхронизация ▸ Синхронизировать сейчас**. До тех пор карточка говорит, что урок не подходит, и называет пак.
- Файлы моделей, которые урок проверяет:
  - для поля `model_name` ноды **UltralyticsDetectorProvider**: файл, в имени которого есть `face` или `hand`.
- Ноды: Load Checkpoint, CLIP Text Encode (Prompt), KSampler, VAE Decode, Save Image / Preview Image, UltralyticsDetectorProvider, FaceDetailer, Save Image.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что делает детейлер** (чтение)

   На картинке в полный рост лицо маленькое, и у модели слишком мало пикселей, чтобы нарисовать его хорошо. Детейлер находит каждое лицо, вырезает, увеличивает, рисует заново той же моделью и по тому же описанию с частью шума и ставит обратно.

   Он перерисовывает то лицо, которое есть. Он не ставит на его место лицо другого человека, и этот урок не об этом.

   Ноды приходят с паками ComfyUI-Impact-Pack и ComfyUI-Impact-Subpack. Пак нод запускает на вашем компьютере чужой код. Ставьте его сами через менеджер ComfyUI, с его официальной страницы, и только если доверяете авторам. Приложение ничего не устанавливает.

   Урок добавляет три ноды к графу из урока «Первая картинка из текста».

2. **Нужен граф с картинкой**

   Этот урок продолжает граф из урока «Первая картинка из текста». На холсте должны быть **Load Checkpoint**, два текста **CLIP Text Encode (Prompt)** и **CLIP Text Encode (Prompt)**, **KSampler**, **VAE Decode** и **Save Image** со связями между ними.

   Если их нет, сначала пройдите тот урок.

3. **Загрузите искатель лиц**

   Добавьте ноду **UltralyticsDetectorProvider** и выберите `bbox/face_yolov8m.pt` в её поле `model_name`. ComfyUI держит искатели в `models/ultralytics/bbox`.

   Файл «.pt» может выполнить код при загрузке: берите его только со страницы, которую называет пак.

4. **Добавьте детейлер**

   Добавьте ноду **FaceDetailer** и подключите к ней:
   - `image`: выход ноды **VAE Decode**;
   - `model`, `clip` и `vae`: выходы ноды **Load Checkpoint**, через загрузчики LoRA, если они есть;
   - `positive` и `negative`: оба текста;
   - `bbox_detector`: выход `BBOX_DETECTOR` ноды **UltralyticsDetectorProvider**.

   Внутри детейлера свой сэмплер: он рисует той же моделью и теми же словами, что и картинку.

5. **Решите, сколько рисовать заново**

   Оставьте `denoise` ноды **FaceDetailer** на 0.5.

   При 0.5 лицо сохраняет черты и получает чёткие глаза и кожу. Выше 0.6 оно может превратиться в другое лицо. `guide_size` это размер, до которого лицо увеличивают перед рисованием: 512 для SD 1.5, 1024 для SDXL.

6. **Сохраните исправленную картинку**

   Добавьте ноду **Save Image** и подключите выход `image` ноды **FaceDetailer** к её входу `images`. Сравните с картинкой до исправления.

7. **Руки и более точные маски** (чтение)

   - Для рук выберите в **UltralyticsDetectorProvider** `bbox/hand_yolov8s.pt` или поставьте второй детейлер после первого: один для лиц, другой для рук.
   - Нода SAMLoader во входе `sam_model_opt` заставляет маску идти по контуру лица, а не прямоугольником: меньше швов.
   - Руки с неправильными пальцами детейлеру часто не по силам: перерисуйте их инпейнтингом или с ControlNet.

8. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Что попробовать: картинку с несколькими людьми вдали; детейлер должен исправить каждое лицо.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Нужен граф с картинкой**:
  - нода **Load Checkpoint**.
  - нода **CLIP Text Encode (Prompt)**.
  - нода **CLIP Text Encode (Prompt)**.
  - нода **KSampler**.
  - нода **VAE Decode**.
  - нода **Save Image** или **Preview Image**.
  - `CLIP` ноды **Load Checkpoint** во вход `clip` ноды **CLIP Text Encode (Prompt)** (промпт) (можно через Load LoRA или CLIP Set Last Layer).
  - `CLIP` ноды **Load Checkpoint** во вход `clip` ноды **CLIP Text Encode (Prompt)** (негатив) (можно через Load LoRA или CLIP Set Last Layer).
  - `MODEL` ноды **Load Checkpoint** во вход `model` ноды **KSampler** (можно через Load LoRA или LoraLoaderModelOnly или DifferentialDiffusion или ModelSamplingAuraFlow или ModelSamplingFlux или CFGNorm или IPAdapter Unified Loader или IPAdapter или IPAdapterAdvanced или IPAdapterStyleComposition).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (промпт) во вход `positive` ноды **KSampler** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (негатив) во вход `negative` ноды **KSampler** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `LATENT` ноды **KSampler** во вход `samples` ноды **VAE Decode**.
  - `VAE` ноды **Load Checkpoint** во вход `vae` ноды **VAE Decode**.
  - `IMAGE` ноды **VAE Decode** во вход `images` ноды **Save Image** или **Preview Image** (первая картинка).
- Шаг 3, **Загрузите искатель лиц**:
  - нода **UltralyticsDetectorProvider**.
  - в поле `model_name` ноды **UltralyticsDetectorProvider** стоит файл, в имени которого есть `face` или `hand` (заглавные буквы, точки и дефисы не важны).
- Шаг 4, **Добавьте детейлер**:
  - нода **FaceDetailer**.
  - `IMAGE` ноды **VAE Decode** во вход `image` ноды **FaceDetailer**.
  - `MODEL` ноды **Load Checkpoint** во вход `model` ноды **FaceDetailer** (можно через Load LoRA или LoraLoaderModelOnly или DifferentialDiffusion или ModelSamplingAuraFlow или ModelSamplingFlux или CFGNorm или IPAdapter Unified Loader или IPAdapter или IPAdapterAdvanced или IPAdapterStyleComposition).
  - `CLIP` ноды **Load Checkpoint** во вход `clip` ноды **FaceDetailer** (можно через Load LoRA или CLIP Set Last Layer).
  - `VAE` ноды **Load Checkpoint** во вход `vae` ноды **FaceDetailer**.
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (промпт) во вход `positive` ноды **FaceDetailer** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (негатив) во вход `negative` ноды **FaceDetailer** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `BBOX_DETECTOR` ноды **UltralyticsDetectorProvider** во вход `bbox_detector` ноды **FaceDetailer**.
- Шаг 5, **Решите, сколько рисовать заново**:
  - `denoise` ноды **FaceDetailer**: от 0.3 до 0.6; «Сделать за меня» ставит 0.5.
- Шаг 6, **Сохраните исправленную картинку**:
  - нода **Save Image**.
  - `image` ноды **FaceDetailer** во вход `images` ноды **Save Image** (исправленная картинка).

## См. также
- [Инпейнтинг и маски](../concepts/Inpainting.ru.md)
- [Паки нод](../concepts/Node-Packs.ru.md)
- [Правила содержимого](../trust/Content-Rules.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
