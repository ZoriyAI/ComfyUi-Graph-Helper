[English](Hires-Fix.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Второй проход после увеличения (hires fix)

<!-- lesson: hires-fix -->
Урок «hires-fix» в группе **Картинки: приёмы** списка уроков. Шагов: 10.

## Чему вы научитесь
Увеличенную картинку модель рисует ещё раз: чёткие детали в размере, который ей не нарисовать за один раз.

## Что понадобится
- Урок продолжает [Увеличение моделью](Upscale.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Ноды: Load Checkpoint, CLIP Text Encode (Prompt), KSampler, VAE Decode, Save Image / Preview Image, Load Upscale Model, Upscale Image (using Model), Upscale Image, VAE Encode.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Зачем два прохода** (чтение)

   Модель хорошо рисует только около того размера, на котором её учили. Картинку больше делают в два прохода: нарисовать в обычном размере, увеличить, а потом дать модели нарисовать большую картинку заново с частью шума. Композиция приходит из первого прохода, детали из второго.

   Это называют «hires fix». Урок продолжает «Увеличение моделью».

2. **Нужен граф с увеличением**

   На холсте должны быть граф с картинкой, **Load Checkpoint**, **CLIP Text Encode (Prompt)**, **CLIP Text Encode (Prompt)**, **KSampler**, **VAE Decode**, **Save Image**, а после **VAE Decode** ноды **Load Upscale Model** и **Upscale Image (using Model)**.

   Если их нет, сначала пройдите «Увеличение моделью».

3. **Приведите к нужному размеру**

   Добавьте ноду **Upscale Image** и подключите выход ноды **Upscale Image (using Model)** к её входу `image`. В `width` и `height` поставьте вдвое больше первой картинки: 2048 для картинки 1024 у SDXL, 1024 для картинки 512 у SD 1.5. 0 в одном из полей сохраняет пропорции.

   Модель 4x даёт в четыре раза больше. Для второго прохода хватит вдвое, а каждый лишний пиксель стоит памяти.

4. **Переведите в латент**

   Добавьте ноду **VAE Encode**: выход ноды **Upscale Image** в её вход `pixels`, выход `VAE` ноды **Load Checkpoint** во вход `vae`.

5. **Второй сэмплер**

   Добавьте вторую ноду **KSampler** и подключите к ней:
   - к `model` выход `MODEL` ноды **Load Checkpoint**, через загрузчики LoRA, если они есть;
   - к `positive` и `negative` те же два текста;
   - к `latent_image` выход ноды **VAE Encode**.

   Та же модель и то же описание заново рисуют свою же картинку, теперь большую.

6. **Решите, сколько рисовать заново**

   Поставьте `denoise` ноды **KSampler** на 0.5.

   При 0.5 композиция остаётся, а каждая деталь рисуется заново в большом размере. При 0.3 изменения слабые. Выше 0.6 модель начинает дорисовывать новые предметы, а в размере, на котором её не учили, повторяет их: две головы, лишние окна.

7. **Сохраните результат**

   Добавьте **VAE Decode** и **Save Image**: выход ноды **KSampler** в `samples`, `VAE` ноды **Load Checkpoint** в `vae`, картинку в `images`.

   Сохранялки прежних проходов можно заменить нодами Preview Image, чтобы на диск писалась только итоговая картинка.

8. **Другой путь: в латенте** (чтение)

   В ComfyUI есть второй вид hires fix, без модели увеличения: нода Upscale Latent между первым и вторым сэмплером и второй сэмплер на `denoise` 0.5. Это быстрее, но увеличенный латент размыт, и второму проходу приходится это дорисовывать, поэтому `denoise` сильно не опустить. Шаблоны ComfyUI показывают оба пути.

9. **Очень большие картинки** (чтение)

   Когда второму проходу не хватает памяти:
   - VAE Decode (Tiled) и VAE Encode (Tiled) переводят картинку в латент и обратно по кускам;
   - пак ComfyUI_UltimateSDUpscale перерисовывает большую картинку плитками, каждую в удобном модели размере;
   - Impact Pack делает то же своими нодами плиток.

   Пак нод запускает на вашем компьютере чужой код. Ставьте его сами через менеджер ComfyUI, с его официальной страницы, и только если доверяете авторам. Приложение ничего не устанавливает.

10. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Что попробовать: `denoise` 0.35 и 0.55 при одном `seed`.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Нужен граф с увеличением**:
  - нода **Load Checkpoint**.
  - нода **CLIP Text Encode (Prompt)**.
  - нода **CLIP Text Encode (Prompt)**.
  - нода **KSampler**.
  - нода **VAE Decode**.
  - нода **Save Image** или **Preview Image**.
  - нода **Load Upscale Model**.
  - нода **Upscale Image (using Model)**.
  - `CLIP` ноды **Load Checkpoint** во вход `clip` ноды **CLIP Text Encode (Prompt)** (промпт) (можно через Load LoRA или CLIP Set Last Layer).
  - `CLIP` ноды **Load Checkpoint** во вход `clip` ноды **CLIP Text Encode (Prompt)** (негатив) (можно через Load LoRA или CLIP Set Last Layer).
  - `MODEL` ноды **Load Checkpoint** во вход `model` ноды **KSampler** (первый проход) (можно через Load LoRA или LoraLoaderModelOnly или DifferentialDiffusion или ModelSamplingAuraFlow или ModelSamplingFlux или CFGNorm или IPAdapter Unified Loader или IPAdapter или IPAdapterAdvanced или IPAdapterStyleComposition).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (промпт) во вход `positive` ноды **KSampler** (первый проход) (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (негатив) во вход `negative` ноды **KSampler** (первый проход) (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `LATENT` ноды **KSampler** (первый проход) во вход `samples` ноды **VAE Decode** (первый проход).
  - `VAE` ноды **Load Checkpoint** во вход `vae` ноды **VAE Decode** (первый проход).
  - `IMAGE` ноды **VAE Decode** (первый проход) во вход `images` ноды **Save Image** или **Preview Image** (первая картинка).
  - `UPSCALE_MODEL` ноды **Load Upscale Model** во вход `upscale_model` ноды **Upscale Image (using Model)**.
  - `IMAGE` ноды **VAE Decode** (первый проход) во вход `image` ноды **Upscale Image (using Model)**.
- Шаг 3, **Приведите к нужному размеру**:
  - нода **Upscale Image**.
  - `IMAGE` ноды **Upscale Image (using Model)** во вход `image` ноды **Upscale Image**.
- Шаг 4, **Переведите в латент**:
  - нода **VAE Encode**.
  - `IMAGE` ноды **Upscale Image** во вход `pixels` ноды **VAE Encode**.
  - `VAE` ноды **Load Checkpoint** во вход `vae` ноды **VAE Encode**.
- Шаг 5, **Второй сэмплер**:
  - нода **KSampler**.
  - `MODEL` ноды **Load Checkpoint** во вход `model` ноды **KSampler** (второй проход) (можно через Load LoRA или LoraLoaderModelOnly или DifferentialDiffusion или ModelSamplingAuraFlow или ModelSamplingFlux или CFGNorm или IPAdapter Unified Loader или IPAdapter или IPAdapterAdvanced или IPAdapterStyleComposition).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (промпт) во вход `positive` ноды **KSampler** (второй проход) (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (негатив) во вход `negative` ноды **KSampler** (второй проход) (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `LATENT` ноды **VAE Encode** во вход `latent_image` ноды **KSampler** (второй проход).
- Шаг 6, **Решите, сколько рисовать заново**:
  - `denoise` ноды **KSampler** (второй проход): от 0.3 до 0.6; «Сделать за меня» ставит 0.5.
- Шаг 7, **Сохраните результат**:
  - нода **VAE Decode**.
  - нода **Save Image** или **Preview Image**.
  - `LATENT` ноды **KSampler** (второй проход) во вход `samples` ноды **VAE Decode** (второй проход).
  - `VAE` ноды **Load Checkpoint** во вход `vae` ноды **VAE Decode** (второй проход).
  - `IMAGE` ноды **VAE Decode** (второй проход) во вход `images` ноды **Save Image** или **Preview Image** (второй проход).

## См. также
- [Увеличение](../concepts/Upscaling.ru.md)
- [Denoise](../concepts/Denoise.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
