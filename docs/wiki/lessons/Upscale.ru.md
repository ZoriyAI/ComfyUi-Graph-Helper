[English](Upscale.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Увеличение моделью

<!-- lesson: upscale -->
Урок «upscale» в группе **Картинки: приёмы** списка уроков. Шагов: 7.

## Чему вы научитесь
Готовую картинку увеличивает модель, которая дорисовывает чёткие детали, а не растягивает пиксели.

## Что понадобится
- Урок продолжает [Первая картинка из текста](Image.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Ноды: Load Checkpoint, CLIP Text Encode (Prompt), KSampler, VAE Decode, Save Image / Preview Image, Load Upscale Model, Upscale Image (using Model), Save Image.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что такое модель увеличения** (чтение)

   Модель увеличения это небольшая сеть, обученная увеличивать картинки: она рисует края и фактуры там, где простое растягивание даёт размытость. Вашего описания она не знает и ничего нового не добавляет: она делает больше то, что есть.

   Урок добавляет три ноды к графу из урока «Первая картинка из текста».

2. **Нужен граф с картинкой**

   Этот урок продолжает граф из урока «Первая картинка из текста». На холсте должны быть **Load Checkpoint**, два текста **CLIP Text Encode (Prompt)** и **CLIP Text Encode (Prompt)**, **KSampler**, **VAE Decode** и **Save Image** со связями между ними.

   Если их нет, сначала пройдите тот урок.

3. **Загрузите модель увеличения**

   Добавьте ноду **Load Upscale Model** и выберите модель в её поле `model_name`. ComfyUI ищет такие файлы в `models/upscale_models`.

   Число в названии говорит, во сколько раз она увеличивает: 4x это в четыре раза, 2x вдвое. Одни модели обучены на фотографиях, другие на рисунках.

   Файлы старых форматов (.pth, .pt) могут выполнить код при загрузке: берите их только с официальной страницы модели или из собрания, которому доверяете, например OpenModelDB.

4. **Увеличьте картинку**

   Добавьте ноду **Upscale Image (using Model)**. Выход ноды **Load Upscale Model** идёт в её вход `upscale_model`, выход `IMAGE` ноды **VAE Decode** во вход `image`.

5. **Сохраните большую картинку**

   Добавьте ещё одну ноду **Save Image** и подключите выход ноды **Upscale Image (using Model)** к её входу `images`.

   Теперь граф сохраняет картинку дважды: как нарисована и увеличенной. Сравните их в полном размере.

6. **Что модель увеличения может и чего не может** (чтение)

   - Модель 4x делает из картинки 1024 картинку 4096 пикселей по стороне, в шестнадцать раз больше пикселей: это память и время. Возьмите модель 2x или уменьшите результат после.
   - Неправильную руку или размытое лицо она не исправит: она увеличит ошибку. Это делает второй проход, следующий урок.
   - Разные модели подходят разным картинкам: сравните две на одной картинке.

7. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Дальше урок «Второй проход после увеличения (hires fix)» добавит большой картинке деталей.

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
- Шаг 3, **Загрузите модель увеличения**:
  - нода **Load Upscale Model**.
  - `model_name` ноды **Load Upscale Model**: значение выбрано.
- Шаг 4, **Увеличьте картинку**:
  - нода **Upscale Image (using Model)**.
  - `UPSCALE_MODEL` ноды **Load Upscale Model** во вход `upscale_model` ноды **Upscale Image (using Model)**.
  - `IMAGE` ноды **VAE Decode** во вход `image` ноды **Upscale Image (using Model)**.
- Шаг 5, **Сохраните большую картинку**:
  - нода **Save Image**.
  - `IMAGE` ноды **Upscale Image (using Model)** во вход `images` ноды **Save Image** (крупная картинка).

## Что дальше
Этот урок продолжают: [Второй проход после увеличения (hires fix)](Hires-Fix.ru.md).

## См. также
- [Увеличение](../concepts/Upscaling.ru.md)
- [Опасные форматы моделей](../concepts/Unsafe-Model-Formats.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
