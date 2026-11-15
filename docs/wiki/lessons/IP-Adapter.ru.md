[English](IP-Adapter.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Картинка-образец через IP-Adapter

<!-- lesson: ipadapter -->
Урок «ipadapter» в группе **Паки и инструменты** списка уроков. Шагов: 9.

## Сначала согласие
Переносить так можно лицо только того, кто на это согласен. Сначала получите это согласие. См. [Правила содержимого](../trust/Content-Rules.ru.md).

## Чему вы научитесь
Модель SD 1.5 или SDXL берёт стиль картинки-образца через пак ComfyUI_IPAdapter_plus.

## Что понадобится
- Урок продолжает [LoRA для картинок](LoRA-Image.ru.md), [Первая картинка из текста](Image.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Паки нод: **ComfyUI_IPAdapter_plus**. Их вы ставите в ComfyUI сами, потом выбираете **Синхронизация ▸ Синхронизировать сейчас**. До тех пор карточка говорит, что урок не подходит, и называет пак.
- Ноды: Load Checkpoint, CLIP Text Encode (Prompt), KSampler, VAE Decode, Save Image / Preview Image, IPAdapter Unified Loader, Load Image, IPAdapter.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что делает IP-Adapter** (чтение)

   IP-Adapter это «LoRA из одной картинки»: он показывает модели образец, и модель рисует в его манере. Он работает с моделями SD 1.5 и SDXL.

   Ноды приходят с паком ComfyUI_IPAdapter_plus. Пак нод запускает на вашем компьютере чужой код. Ставьте его сами через менеджер ComfyUI, с его официальной страницы, и только если доверяете авторам. Приложение ничего не устанавливает. Автор держит пак в режиме поддержки: он работает, но новые модели не добавляются.

   Урок добавляет три ноды к графу из урока «Первая картинка из текста».

2. **Нужен граф с картинкой**

   Этот урок продолжает граф из урока «Первая картинка из текста». На холсте должны быть **Load Checkpoint**, два текста **CLIP Text Encode (Prompt)** и **CLIP Text Encode (Prompt)**, **KSampler**, **VAE Decode** и **Save Image** со связями между ними.

   Если их нет, сначала пройдите тот урок.

3. **Какие файлы нужны паку** (чтение)

   Общий загрузчик пака находит файлы по имени, поэтому называть их нужно точно так, как сказано на странице пака:
   - модели IP-Adapter в `models/ipadapter`, например ip-adapter-plus_sdxl_vit-h;
   - модель зрения в `models/clip_vision`, с именем со страницы пака.

   Файлы старых форматов (.bin, .pth) могут выполнить код при загрузке: берите их только с официальных страниц, которые называет пак.

4. **Общий загрузчик**

   Добавьте ноду **IPAdapter Unified Loader** и подключите выход `MODEL` ноды **Load Checkpoint** к её входу `model`. В `preset` поставьте `PLUS (high strength)`.

   Пресет говорит, какой IP-Adapter взять; загрузчик находит его и модель зрения по именам.

5. **Загрузите образец**

   Добавьте ноду **Load Image** и выберите в её поле `image` картинку-образец: с нужным стилем, а не с нужным предметом.

6. **Примените к модели**

   Добавьте ноду **IPAdapter** и подключите: `model` и `ipadapter` от одноимённых выходов ноды **IPAdapter Unified Loader**, `image` от **Load Image**. Её выход `MODEL` идёт в `model` ноды **KSampler** вместо прямой связи.

   IP-Adapter меняет саму модель, а не описание; поэтому он стоит на пути модели.

7. **Задайте вес и вид**

   Поставьте `weight` ноды **IPAdapter** на 0.8, а `weight_type` на `style transfer`.

   `style transfer` берёт облик образца и оставляет его содержимое; `standard` берёт и то и другое. При `weight` 1 и выше образец давит на картинку; при 0.5 только подкрашивает её.

8. **Тонкая настройка** (чтение)

   - `start_at` и `end_at` говорят, в какой части шагов он действует, как у ControlNet.
   - Нода пака «IPAdapter Style & Composition» берёт одну картинку для стиля, а другую для композиции.
   - `style transfer` точен с SDXL и грубее с SD 1.5.
   - Ноды FaceID этого пака переносят лицо. Переносить так можно лицо только того, кто на это согласен. Сначала получите это согласие.

9. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Что попробовать: один образец при `weight` 0.5 и при 1.

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
- Шаг 4, **Общий загрузчик**:
  - нода **IPAdapter Unified Loader**.
  - `MODEL` ноды **Load Checkpoint** во вход `model` ноды **IPAdapter Unified Loader** (можно через Load LoRA или LoraLoaderModelOnly).
  - `preset` ноды **IPAdapter Unified Loader**: `PLUS (high strength)`.
- Шаг 5, **Загрузите образец**:
  - нода **Load Image**.
  - `image` ноды **Load Image**: значение выбрано.
- Шаг 6, **Примените к модели**:
  - нода **IPAdapter**.
  - `model` ноды **IPAdapter Unified Loader** во вход `model` ноды **IPAdapter**.
  - `ipadapter` ноды **IPAdapter Unified Loader** во вход `ipadapter` ноды **IPAdapter**.
  - `IMAGE` ноды **Load Image** во вход `image` ноды **IPAdapter** (можно через Upscale Image или Upscale Image By или Scale Image to Total Pixels или FluxKontextImageScale или Resize Image или ImageResizeKJv2 или Pad Image for Outpainting).
  - `MODEL` ноды **IPAdapter** во вход `model` ноды **KSampler** (можно через Load LoRA или LoraLoaderModelOnly или DifferentialDiffusion или ModelSamplingAuraFlow или ModelSamplingFlux или CFGNorm или IPAdapter Unified Loader или IPAdapter или IPAdapterAdvanced или IPAdapterStyleComposition).
- Шаг 7, **Задайте вес и вид**:
  - `weight` ноды **IPAdapter**: от 0.5 до 0.9; «Сделать за меня» ставит 0.8.
  - `weight_type` ноды **IPAdapter**: `style transfer`.

## См. также
- [Картинки-образцы: IP-Adapter, Redux, модели правки](../concepts/Reference-Images.ru.md)
- [Правила содержимого](../trust/Content-Rules.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
