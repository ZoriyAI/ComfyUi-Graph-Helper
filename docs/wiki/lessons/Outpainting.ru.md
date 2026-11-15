[English](Outpainting.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Аутпейнтинг: картинка за своими краями

<!-- lesson: outpaint -->
Урок «outpaint» в группе **Картинки: приёмы** списка уроков. Шагов: 6.

## Чему вы научитесь
Картинка получает новую полосу с одной стороны, и модель дорисовывает, что за рамкой.

## Что понадобится
- Урок продолжает [Инпейнтинг: перерисовать часть картинки](Inpainting.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Ноды: Load Checkpoint, CLIP Text Encode (Prompt), Load Image, InpaintModelConditioning, KSampler, Pad Image for Outpainting.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что такое аутпейнтинг** (чтение)

   Аутпейнтинг это инпейнтинг новой полосы. Картинка получает пустую рамку, рамка становится маской, и модель заполняет её так, чтобы она продолжала картинку.

   Урок продолжает «Инпейнтинг: перерисовать часть картинки».

2. **Нужен граф инпейнтинга**

   Этот урок продолжает граф из урока «Инпейнтинг: перерисовать часть картинки». На холсте должны быть **Load Checkpoint**, тексты **CLIP Text Encode (Prompt)** и **CLIP Text Encode (Prompt)**, **Load Image**, **InpaintModelConditioning** и **KSampler**, как их оставил тот урок.

   Если их нет, сначала пройдите тот урок.

3. **Добавьте рамку**

   Добавьте ноду **Pad Image for Outpainting** и подайте ей картинку на вход `image`, через ноду масштаба, если она есть. Её выход `IMAGE` идёт в `pixels` ноды **InpaintModelConditioning**, выход `MASK` в `mask`: нарисованная рукой маска заменится рамкой. В поле `right` поставьте 256.

   `left`, `top`, `right` и `bottom` говорят, сколько пикселей добавить с каждой стороны. `feathering` делает границу мягкой, чтобы шов не был виден. Добавляйте понемногу: 256 пикселей с одной стороны модели даются легче, чем 1024 со всех сторон.

4. **Нарисуйте рамку целиком**

   Поставьте `denoise` ноды **KSampler** на 1.

   Рамка пустая и серая, сохранять в ней нечего. При меньшем значении серое просвечивает.

5. **Опишите всю расширенную сцену** (чтение)

   Опишите картинку такой, какой она должна стать вместе с новой частью: «маяк на скале, море уходит вправо, вечерний свет».

   Модель, обученная для инпейнтинга, заполняет рамку лучше. Чтобы сильно расширить картинку, добавляйте по одной стороне и берите каждый результат как следующую картинку.

6. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Что попробовать: `feathering` 10 и 60; ту же рамку слева.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Нужен граф инпейнтинга**:
  - нода **Load Checkpoint**.
  - нода **CLIP Text Encode (Prompt)**.
  - нода **CLIP Text Encode (Prompt)**.
  - нода **Load Image**.
  - нода **InpaintModelConditioning**.
  - нода **KSampler**.
  - `MODEL` ноды **Load Checkpoint** во вход `model` ноды **KSampler** (можно через Load LoRA или LoraLoaderModelOnly или DifferentialDiffusion или ModelSamplingAuraFlow или ModelSamplingFlux или CFGNorm или IPAdapter Unified Loader или IPAdapter или IPAdapterAdvanced или IPAdapterStyleComposition).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (промпт) во вход `positive` ноды **InpaintModelConditioning** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (негатив) во вход `negative` ноды **InpaintModelConditioning** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `positive` ноды **InpaintModelConditioning** во вход `positive` ноды **KSampler** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `latent` ноды **InpaintModelConditioning** во вход `latent_image` ноды **KSampler**.
- Шаг 3, **Добавьте рамку**:
  - нода **Pad Image for Outpainting**.
  - `IMAGE` ноды **Load Image** во вход `image` ноды **Pad Image for Outpainting** (можно через Upscale Image или Upscale Image By или Scale Image to Total Pixels или FluxKontextImageScale или Resize Image или ImageResizeKJv2 или Pad Image for Outpainting).
  - `IMAGE` ноды **Pad Image for Outpainting** во вход `pixels` ноды **InpaintModelConditioning**.
  - `MASK` ноды **Pad Image for Outpainting** во вход `mask` ноды **InpaintModelConditioning** (можно через GrowMask или FeatherMask или Invert Mask или ThresholdMask).
  - `right` ноды **Pad Image for Outpainting**: от 64 до 512; «Сделать за меня» ставит 256.
- Шаг 4, **Нарисуйте рамку целиком**:
  - `denoise` ноды **KSampler**: `1`.

## См. также
- [Аутпейнтинг](../concepts/Outpainting.ru.md)
- [Инпейнтинг и маски](../concepts/Inpainting.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
