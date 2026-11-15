[English](Mask-By-Words.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Маска по словам

<!-- lesson: mask-text -->
Урок «mask-text» в группе **Картинки: приёмы** списка уроков. Шагов: 8.

## Чему вы научитесь
ComfyUI находит предмет по названию и отдаёт его маску ноде инпейнтинга, рисовать рукой не нужно.

## Что понадобится
- Урок продолжает [Инпейнтинг: перерисовать часть картинки](Inpainting.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Ноды: Load Checkpoint, CLIP Text Encode (Prompt), Load Image, InpaintModelConditioning, KSampler, SAM3 Detect.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что делает SAM3** (чтение)

   SAM3 это модель, которая находит на картинке то, что названо словом, и точно обводит его. Напишите «hat», и она даст маску шляпы. Эта маска идёт туда, куда шла нарисованная рукой.

   Её ноды входят в новые версии ComfyUI. Урок продолжает «Инпейнтинг: перерисовать часть картинки».

2. **Нужен граф инпейнтинга**

   Этот урок продолжает граф из урока «Инпейнтинг: перерисовать часть картинки». На холсте должны быть **Load Checkpoint**, тексты **CLIP Text Encode (Prompt)** и **CLIP Text Encode (Prompt)**, **Load Image**, **InpaintModelConditioning** и **KSampler**, как их оставил тот урок.

   Если их нет, сначала пройдите тот урок.

3. **Загрузите искателя**

   Добавьте ещё одну ноду **Load Checkpoint** и выберите в её поле `ckpt_name` файл искателя, например sam3.1_multiplex_fp16. В одном файле и искатель, и его читатель текста, поэтому он ставится в обычный загрузчик чекпойнтов.

   Он не рисует: рисующая модель остаётся в **Load Checkpoint**.

   Если нужного файла в списке нет, значит, его нет в вашем ComfyUI. Приложение ничего не скачивает. Проще всего открыть в самом ComfyUI официальный шаблон «Image Segment (SAM3)»: он покажет, каких файлов не хватает и куда их положить. Потом выберите здесь в меню «Синхронизация ▸ Синхронизировать сейчас», и файлы появятся в списках.

4. **Скажите, что искать**

   Добавьте **CLIP Text Encode (Prompt)** и **SAM3 Detect**.
   - Выход `CLIP` ноды **Load Checkpoint** идёт во вход `clip` ноды **CLIP Text Encode (Prompt)**. В её поле `text` напишите, что искать, одним-двумя словами по-английски: hat, red car.
   - **SAM3 Detect** получает `model` от **Load Checkpoint**, `image` от **Load Image**, через ноду масштаба, как её получает нода инпейнтинга, и `conditioning` от **CLIP Text Encode (Prompt)**.

   Искатель должен видеть картинку в том же размере, что и нода инпейнтинга, иначе маска не совпадёт.

5. **Задайте, насколько он должен быть уверен**

   Оставьте `threshold` ноды **SAM3 Detect** на 0.5.

   Ниже, и искатель примет за предмет больше, в том числе то, что только похоже. Выше, и он может не найти ничего. Если маска пустая, опустите до 0.3.

6. **Отдайте маску ноде инпейнтинга**

   Подключите выход `masks` ноды **SAM3 Detect** ко входу `mask` ноды **InpaintModelConditioning**. Связь от нарисованной рукой маски заменится.

   Маска найденного предмета плотная. Пропустите её через ноду Grow Mask, которая добавит от 8 до 16 пикселей, чтобы модели было где сшить край.

7. **Щелчком вместо слова** (чтение)

   Искатель принимает и точки: `positive_coords` говорит, где предмет, `negative_coords`, где его нет. Точки задаются текстом с координатами; ноду, где их ставят щелчком по картинке, дают паки, например Points Editor из ComfyUI-KJNodes.

   Паки ComfyUI-Florence2 и ComfyUI-segment-anything-2 делают то же старыми моделями: Florence2 находит рамку по словам, SAM2 обводит то, что в ней. Пак нод запускает на вашем компьютере чужой код. Ставьте его сами через менеджер ComfyUI, с его официальной страницы, и только если доверяете авторам. Приложение ничего не устанавливает.

   Чтобы увидеть маску до перерисовки, подключите `masks` к ноде Preview Mask.

8. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Что попробовать: включите `individual_masks`, когда слово находит несколько предметов, а нужен один.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Нужен граф инпейнтинга**:
  - нода **Load Checkpoint**.
  - нода **CLIP Text Encode (Prompt)**.
  - нода **CLIP Text Encode (Prompt)**.
  - нода **Load Image**.
  - нода **InpaintModelConditioning**.
  - нода **KSampler**.
  - `MODEL` ноды **Load Checkpoint** (модель картинки) во вход `model` ноды **KSampler** (можно через Load LoRA или LoraLoaderModelOnly или DifferentialDiffusion или ModelSamplingAuraFlow или ModelSamplingFlux или CFGNorm или IPAdapter Unified Loader или IPAdapter или IPAdapterAdvanced или IPAdapterStyleComposition).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (промпт) во вход `positive` ноды **InpaintModelConditioning** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (негатив) во вход `negative` ноды **InpaintModelConditioning** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `positive` ноды **InpaintModelConditioning** во вход `positive` ноды **KSampler** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `latent` ноды **InpaintModelConditioning** во вход `latent_image` ноды **KSampler**.
- Шаг 3, **Загрузите искателя**:
  - нода **Load Checkpoint**.
  - `ckpt_name` ноды **Load Checkpoint** (поиск): не тот же файл, что в поле `ckpt_name` ноды **Load Checkpoint** (модель картинки).
- Шаг 4, **Скажите, что искать**:
  - нода **CLIP Text Encode (Prompt)**.
  - нода **SAM3 Detect**.
  - `CLIP` ноды **Load Checkpoint** (поиск) во вход `clip` ноды **CLIP Text Encode (Prompt)** (что найти).
  - `MODEL` ноды **Load Checkpoint** (поиск) во вход `model` ноды **SAM3 Detect**.
  - `IMAGE` ноды **Load Image** во вход `image` ноды **SAM3 Detect** (можно через Upscale Image или Upscale Image By или Scale Image to Total Pixels или FluxKontextImageScale или Resize Image или ImageResizeKJv2 или Pad Image for Outpainting).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (что найти) во вход `conditioning` ноды **SAM3 Detect**.
  - `text` ноды **CLIP Text Encode (Prompt)** (что найти): не меньше 3 знаков.
- Шаг 5, **Задайте, насколько он должен быть уверен**:
  - `threshold` ноды **SAM3 Detect**: от 0.3 до 0.7; «Сделать за меня» ставит 0.5.
- Шаг 6, **Отдайте маску ноде инпейнтинга**:
  - `masks` ноды **SAM3 Detect** во вход `mask` ноды **InpaintModelConditioning** (можно через GrowMask или FeatherMask или Invert Mask или ThresholdMask).

## См. также
- [Инпейнтинг и маски](../concepts/Inpainting.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
