[English](ControlNet.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# ControlNet: рисунок по контурам картинки

<!-- lesson: controlnet -->
Урок «controlnet» в группе **Картинки: приёмы** списка уроков. Шагов: 11.

## Чему вы научитесь
Модель рисует новую картинку, сохраняя контуры картинки-образца.

## Что понадобится
- Урок продолжает [Первая картинка из текста](Image.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Ноды: Load Checkpoint, CLIP Text Encode (Prompt), KSampler, VAE Decode, Save Image / Preview Image, Load ControlNet Model, Load Image, Detect Edges (Canny), Apply ControlNet.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что делает ControlNet** (чтение)

   Описание говорит, что нарисовать, но не где. ControlNet добавляет второй вид указаний, управляющую картинку: контуры, глубину, позу человека. Модель держится её, пока рисует то, что сказано в описании.

   Управляющую картинку делают из обычной. В этом уроке её делает встроенный в ComfyUI искатель контуров. Урок добавляет четыре ноды к графу из урока «Первая картинка из текста».

2. **Нужен граф с картинкой**

   Этот урок продолжает граф из урока «Первая картинка из текста». На холсте должны быть **Load Checkpoint**, два текста **CLIP Text Encode (Prompt)** и **CLIP Text Encode (Prompt)**, **KSampler**, **VAE Decode** и **Save Image** со связями между ними.

   Если их нет, сначала пройдите тот урок.

3. **Загрузите ControlNet**

   Добавьте ноду **Load ControlNet Model** и выберите в её поле `control_net_name` ControlNet для контуров: в названии стоит «canny». ComfyUI ищет их в `models/controlnet`.

   ControlNet обучен для одного семейства моделей и одного вида управляющей картинки. ControlNet для SD 1.5 не работает с SDXL, а ControlNet для глубины не читает контуры.

   Если нужного файла в списке нет, значит, его нет в вашем ComfyUI. Приложение ничего не скачивает. Проще всего открыть в самом ComfyUI шаблон ComfyUI с ControlNet: он покажет, каких файлов не хватает и куда их положить. Потом выберите здесь в меню «Синхронизация ▸ Синхронизировать сейчас», и файлы появятся в списках.

4. **Загрузите картинку-образец**

   Добавьте ноду **Load Image** и выберите в её поле `image` картинку, контуры которой хотите сохранить.

   Эта картинка только план: её цвета и содержимое в результат не идут.

5. **Найдите контуры**

   Добавьте ноду **Detect Edges (Canny)** и подключите выход ноды **Load Image** к её входу `image`.

   Она рисует белые линии там, где у картинки края. `low_threshold` и `high_threshold` говорят, насколько сильным должен быть край: меньшие значения дают больше линий, мелкие детали тоже. Подключите её к ноде Preview Image, чтобы увидеть, что получит ControlNet.

6. **Примените ControlNet**

   Добавьте ноду **Apply ControlNet** и подключите к ней:
   - к `positive` и `negative` оба текста;
   - к `control_net` выход ноды **Load ControlNet Model**;
   - к `image` выход ноды **Detect Edges (Canny)**.

   Нода добавляет контуры к обоим описаниям, и модель получает их вместе со словами.

7. **Отдайте сэмплеру новые описания**

   Подключите выход `positive` ноды **Apply ControlNet** ко входу `positive` ноды **KSampler**, а `negative` к `negative`. Прямые связи от текстов заменятся.

8. **Задайте силу**

   Для первого запуска оставьте `strength` ноды **Apply ControlNet** на 1.

   При 1 модель строго держится контуров. Когда результат выглядит обведённым и деревянным, опустите до 0.6: контуры останутся, а внутри них модель рисует свободнее.

9. **Когда он действует: начало и конец** (чтение)

   `start_percent` и `end_percent` говорят, в какой части шагов действует ControlNet, от 0 до 1. Первые шаги задают композицию, последние детали.
   - `end_percent` 0.8: контуры закрепляются рано, а последние шаги свободно рисуют детали;
   - `start_percent` 0.2: модель сама раскладывает картинку и только потом следует контурам.

10. **Другие виды управления** (чтение)

   Каждый ControlNet читает свой вид картинки: canny и lineart читают линии, depth карту глубины, openpose скелет человека, scribble грубый набросок. Сам ComfyUI находит только контуры; остальные управляющие картинки делает пак comfyui_controlnet_aux, смотрите урок «ControlNet по карте глубины».

   Несколько ControlNet могут действовать сразу: поставьте две ноды **Apply ControlNet** цепочкой, выходы первой во входы второй. ControlNet «union» читает несколько видов в одном файле.

   Для Flux, SD3.5 и Qwen-Image в ComfyUI есть шаблоны со своими ControlNet.

11. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Что попробовать: одни контуры с двумя разными описаниями; `strength` 0.4.

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
  - `IMAGE` ноды **VAE Decode** во вход `images` ноды **Save Image** или **Preview Image**.
- Шаг 3, **Загрузите ControlNet**:
  - нода **Load ControlNet Model**.
  - `control_net_name` ноды **Load ControlNet Model**: значение выбрано.
  - файл в поле `control_net_name` ноды **Load ControlNet Model** сделан для семейства файла из поля `ckpt_name` ноды **Load Checkpoint**. Почему: loRA и ControlNet работают только с тем семейством моделей, для которого сделаны; с другим они ничего не дают или портят картинку.
- Шаг 4, **Загрузите картинку-образец**:
  - нода **Load Image**.
  - `image` ноды **Load Image**: значение выбрано.
- Шаг 5, **Найдите контуры**:
  - нода **Detect Edges (Canny)**.
  - `IMAGE` ноды **Load Image** во вход `image` ноды **Detect Edges (Canny)** (можно через Upscale Image или Upscale Image By или Scale Image to Total Pixels или FluxKontextImageScale или Resize Image или ImageResizeKJv2 или Pad Image for Outpainting).
- Шаг 6, **Примените ControlNet**:
  - нода **Apply ControlNet**.
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (промпт) во вход `positive` ноды **Apply ControlNet** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (негатив) во вход `negative` ноды **Apply ControlNet** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `CONTROL_NET` ноды **Load ControlNet Model** во вход `control_net` ноды **Apply ControlNet**.
  - `IMAGE` ноды **Detect Edges (Canny)** во вход `image` ноды **Apply ControlNet**.
- Шаг 7, **Отдайте сэмплеру новые описания**:
  - `positive` ноды **Apply ControlNet** во вход `positive` ноды **KSampler** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `negative` ноды **Apply ControlNet** во вход `negative` ноды **KSampler** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
- Шаг 8, **Задайте силу**:
  - `strength` ноды **Apply ControlNet**: от 0.3 до 1; «Сделать за меня» ставит 1.

## Что дальше
Этот урок продолжают: [ControlNet по карте глубины](ControlNet-Depth.ru.md).

## См. также
- [ControlNet и препроцессоры](../concepts/ControlNet.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
