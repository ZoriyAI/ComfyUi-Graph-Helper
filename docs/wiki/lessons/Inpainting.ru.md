[English](Inpainting.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Инпейнтинг: перерисовать часть картинки

<!-- lesson: inpaint -->
Урок «inpaint» в группе **Картинки: приёмы** списка уроков. Шагов: 10.

## Чему вы научитесь
Вы закрашиваете маской часть картинки, и модель перерисовывает только её, по новому описанию.

## Что понадобится
- Урок продолжает [Картинка из картинки](Image-To-Image.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Ноды: Load Checkpoint, CLIP Text Encode (Prompt), KSampler, VAE Decode, Save Image / Preview Image, Load Image, InpaintModelConditioning.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что такое инпейнтинг** (чтение)

   Инпейнтинг перерисовывает часть картинки под маской, а остальное оставляет как было. Маску рисуют рукой в ComfyUI или получают от ноды, которая находит предмет; об этом урок «Маска по словам».

   Этот урок продолжает «Картинку из картинки» и ставит ноду инпейнтинга на место простого кодирования.

2. **Нужен граф «картинки из картинки»**

   На холсте должны быть **Load Checkpoint**, тексты **CLIP Text Encode (Prompt)** и **CLIP Text Encode (Prompt)**, **KSampler**, **VAE Decode**, **Save Image** и **Load Image**, как их оставил урок «Картинка из картинки».

   Если их нет, сначала пройдите тот урок.

3. **Нарисуйте маску в ComfyUI** (чтение)

   Маску рисуют в ComfyUI, не в этом приложении. Откройте граф там, нажмите правой кнопкой на ноду Load Image и выберите «Open in MaskEditor». Закрасьте то, что должно измениться, чуть шире самого предмета, и нажмите «Save».

   ComfyUI сохраняет картинку с маской в папку `input`, а выход `MASK` ноды несёт эту маску. Так же работает картинка с прозрачной областью: прозрачная часть и есть маска.

   В этом приложении маска не видна. Граф от этого не меняется.

4. **Какая модель лучше перерисовывает часть** (чтение)

   Под маской умеет рисовать любая модель, но граница часто заметна. Модели, обученные для инпейнтинга, видят картинку вокруг маски и сшивают лучше: для SD 1.5 это чекпойнты со словом «inpainting» в названии, для Flux модель Flux.1 Fill (у неё отдельные загрузчики: откройте в ComfyUI официальный шаблон «Flux.1 Fill Dev», чтобы увидеть её граф).

   Чекпойнт для инпейнтинга ставится в ту же ноду **Load Checkpoint**, что и обычный.

5. **Добавьте ноду инпейнтинга**

   Добавьте ноду **InpaintModelConditioning** и подключите к ней:
   - к `positive` и `negative` оба текста;
   - к `vae` выход `VAE` ноды **Load Checkpoint**;
   - к `pixels` картинку, через ноду масштаба, если картинка через неё идёт;
   - к `mask` выход `MASK` ноды **Load Image**.

   Нода кодирует картинку, отмечает в латенте закрашенную часть и сообщает модели для инпейнтинга, что вокруг. Оставьте `noise_mask` включённым: тогда заново рисуется только закрашенное.

6. **Кормите сэмплер от неё**

   Подключите три выхода ноды **InpaintModelConditioning** к **KSampler**: `positive` к `positive`, `negative` к `negative`, `latent` к `latent_image`.

   Нода кодирования из прошлого урока больше не нужна: её связь с сэмплером заменится.

7. **Задайте силу**

   Поставьте `denoise` ноды **KSampler** на 1 для модели для инпейнтинга. Для обычной модели берите от 0.6 до 0.8: тогда цвета старого содержимого просвечивают и помогают новому вписаться.

   Если закрашенная часть выходит такой же, как была, поднимите `denoise`. Если выходит чужой для картинки, опустите его или возьмите модель для инпейнтинга.

8. **Опишите, что должно там быть** (чтение)

   Описывайте всю картинку с новым содержимым, а не приказ что-то заменить. Для шляпы на мужчине: «мужчина в красной шерстяной шляпе на городской улице». Модель видит остальную картинку и подгоняет новую часть к ней.

   Описание может быть коротким: остальное скажет картинка вокруг.

9. **Когда видна граница** (чтение)

   Что помогает:
   - рисуйте маску шире предмета; нода Grow Mask расширяет её на несколько пикселей;
   - нода Differential Diffusion между моделью и сэмплером смягчает край маски, так делает шаблон Flux Fill в ComfyUI;
   - для маленькой части большой картинки пак ComfyUI-Inpaint-CropAndStitch вырезает область вокруг маски, рисует её в удобном модели размере и вставляет обратно.

   Пак нод запускает на вашем компьютере чужой код. Ставьте его сами через менеджер ComfyUI, с его официальной страницы, и только если доверяете авторам. Приложение ничего не устанавливает.

10. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Что попробовать: одну маску с тремя разными `seed`; маску, нарисованную вплотную, и маску пошире.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Нужен граф «картинки из картинки»**:
  - нода **Load Checkpoint**.
  - нода **CLIP Text Encode (Prompt)**.
  - нода **CLIP Text Encode (Prompt)**.
  - нода **KSampler**.
  - нода **VAE Decode**.
  - нода **Save Image** или **Preview Image**.
  - нода **Load Image**.
  - `CLIP` ноды **Load Checkpoint** во вход `clip` ноды **CLIP Text Encode (Prompt)** (промпт) (можно через Load LoRA или CLIP Set Last Layer).
  - `CLIP` ноды **Load Checkpoint** во вход `clip` ноды **CLIP Text Encode (Prompt)** (негатив) (можно через Load LoRA или CLIP Set Last Layer).
  - `MODEL` ноды **Load Checkpoint** во вход `model` ноды **KSampler** (можно через Load LoRA или LoraLoaderModelOnly или DifferentialDiffusion или ModelSamplingAuraFlow или ModelSamplingFlux или CFGNorm или IPAdapter Unified Loader или IPAdapter или IPAdapterAdvanced или IPAdapterStyleComposition).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (промпт) во вход `positive` ноды **KSampler** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (негатив) во вход `negative` ноды **KSampler** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `LATENT` ноды **KSampler** во вход `samples` ноды **VAE Decode**.
  - `VAE` ноды **Load Checkpoint** во вход `vae` ноды **VAE Decode**.
  - `IMAGE` ноды **VAE Decode** во вход `images` ноды **Save Image** или **Preview Image**.
- Шаг 5, **Добавьте ноду инпейнтинга**:
  - нода **InpaintModelConditioning**.
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (промпт) во вход `positive` ноды **InpaintModelConditioning** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (негатив) во вход `negative` ноды **InpaintModelConditioning** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `VAE` ноды **Load Checkpoint** во вход `vae` ноды **InpaintModelConditioning**.
  - `IMAGE` ноды **Load Image** во вход `pixels` ноды **InpaintModelConditioning** (можно через Upscale Image или Upscale Image By или Scale Image to Total Pixels или FluxKontextImageScale или Resize Image или ImageResizeKJv2 или Pad Image for Outpainting).
  - `MASK` ноды **Load Image** во вход `mask` ноды **InpaintModelConditioning** (можно через GrowMask или FeatherMask или Invert Mask или ThresholdMask).
- Шаг 6, **Кормите сэмплер от неё**:
  - `positive` ноды **InpaintModelConditioning** во вход `positive` ноды **KSampler** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `negative` ноды **InpaintModelConditioning** во вход `negative` ноды **KSampler** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `latent` ноды **InpaintModelConditioning** во вход `latent_image` ноды **KSampler**.
- Шаг 7, **Задайте силу**:
  - `denoise` ноды **KSampler**: от 0.5 до 1; «Сделать за меня» ставит 1.

## Что дальше
Этот урок продолжают: [Аутпейнтинг: картинка за своими краями](Outpainting.ru.md), [Маска по словам](Mask-By-Words.ru.md).

## См. также
- [Инпейнтинг и маски](../concepts/Inpainting.ru.md)
- [Denoise](../concepts/Denoise.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
