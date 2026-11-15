[English](Style-Reference.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Картинка-образец для стиля (Flux Redux)

<!-- lesson: style-reference -->
Урок «style-reference» в группе **Картинки: приёмы** списка уроков. Шагов: 9.

## Чему вы научитесь
Картинка Flux.1 берёт облик у картинки-образца: цвета, материалы, настроение.

## Что понадобится
- Урок продолжает [Flux.1: картинка из отдельных файлов](Flux1.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Ноды: Load Diffusion Model, DualCLIPLoader, Load VAE, CLIP Text Encode (Prompt), ConditioningZeroOut, Load Image, Load CLIP Vision, CLIP Vision Encode, Load Style Model, Apply Style Model, EmptySD3LatentImage, KSampler, VAE Decode, Save Image / Preview Image.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что делает Redux** (чтение)

   Словами стиль описывается плохо. Redux позволяет его показать: модель зрения смотрит на картинку-образец, а маленькая модель стиля превращает увиденное в добавку к описанию.

   Граф это граф Flux.1 dev из ComfyUI с той частью официального шаблона «Flux Redux», которая это делает. Он собирается с пустого холста: «Файл ▸ Новый проект». Flux.1 dev нужна сильная видеокарта; его файлы fp8 требуют меньше памяти.

2. **Загрузите Flux.1**

   Добавьте **Load Diffusion Model**, **DualCLIPLoader** и **Load VAE**.
   - `unet_name` ноды **Load Diffusion Model**: flux1-dev из `models/diffusion_models`.
   - **DualCLIPLoader** читает описание двумя файлами: `clip_name1` clip_l, `clip_name2` t5xxl. В `type` поставьте `flux`.
   - `vae_name` ноды **Load VAE**: ae.

   Если нужного файла в списке нет, значит, его нет в вашем ComfyUI. Приложение ничего не скачивает. Проще всего открыть в самом ComfyUI официальный шаблон «Flux Redux»: он покажет, каких файлов не хватает и куда их положить. Потом выберите здесь в меню «Синхронизация ▸ Синхронизировать сейчас», и файлы появятся в списках.

3. **Напишите описание**

   Добавьте **CLIP Text Encode (Prompt)** и **ConditioningZeroOut**. Выход ноды **DualCLIPLoader** идёт в `clip` ноды **CLIP Text Encode (Prompt)**, выход ноды **CLIP Text Encode (Prompt)** в `conditioning` ноды **ConditioningZeroOut**. В `text` напишите, что на картинке: предмет, место.

   Flux не пользуется описанием нежелательного. **ConditioningZeroOut** даёт сэмплеру пустое, как это делает шаблон Flux в ComfyUI.

4. **Покажите образец**

   Добавьте **Load Image**, **Load CLIP Vision** и **CLIP Vision Encode**.
   - В **Load Image** выберите картинку-образец.
   - В `clip_name` ноды **Load CLIP Vision**: sigclip_vision_patch14_384 из `models/clip_vision`.
   - **CLIP Vision Encode** получает `clip_vision` от **Load CLIP Vision** и `image` от **Load Image**.

   Модель зрения превращает картинку в числа, которые говорят, что на ней и как она выглядит.

5. **Примените модель стиля**

   Добавьте **Load Style Model** и **Apply Style Model**.
   - В `style_model_name` ноды **Load Style Model**: flux1-redux-dev из `models/style_models`.
   - **Apply Style Model** получает `conditioning` от **CLIP Text Encode (Prompt)**, `style_model` от **Load Style Model**, `clip_vision_output` от **CLIP Vision Encode**.

   Выход ноды **Apply Style Model** это ваше описание с добавленным образцом.

6. **Пустой латент и сэмплер**

   Добавьте **EmptySD3LatentImage** и **KSampler**. Подключите: `model` от **Load Diffusion Model**, `positive` от **Apply Style Model**, `negative` от **ConditioningZeroOut**, `latent_image` от **EmptySD3LatentImage**. Поставьте `cfg` на 1.

   Flux.1 dev дистиллирована: она следует описанию без обычного усиления, а больший `cfg` выжигает картинку. Пустой латент 1024 × 1024 ей подходит.

7. **Раскодируйте и сохраните**

   Добавьте **VAE Decode** и **Save Image**: выход ноды **KSampler** в `samples`, выход ноды **Load VAE** в `vae`, картинку в `images`.

8. **Когда образец побеждает слова** (чтение)

   При `strength` 1 у **Apply Style Model** Redux часто копирует образец и забывает описание. Опустите до 0.5, и слова снова получат голос.

   Два образца: поставьте две ноды **Apply Style Model** цепочкой, выход первой в `conditioning` второй, у каждой своя картинка, как в шаблоне.

   Для SD 1.5 и SDXL та же мысль это IP-Adapter, смотрите урок «Картинка-образец через IP-Adapter».

9. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Что попробовать: одно описание с двумя очень разными образцами.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Загрузите Flux.1**:
  - нода **Load Diffusion Model**.
  - нода **DualCLIPLoader**.
  - нода **Load VAE**.
  - `unet_name` ноды **Load Diffusion Model**: значение выбрано.
  - `clip_name1` ноды **DualCLIPLoader**: значение выбрано.
  - `clip_name2` ноды **DualCLIPLoader**: не тот же файл, что в поле `clip_name1` ноды **DualCLIPLoader**.
  - `type` ноды **DualCLIPLoader**: `flux`.
  - `vae_name` ноды **Load VAE**: значение выбрано.
- Шаг 3, **Напишите описание**:
  - нода **CLIP Text Encode (Prompt)**.
  - нода **ConditioningZeroOut**.
  - `CLIP` ноды **DualCLIPLoader** во вход `clip` ноды **CLIP Text Encode (Prompt)**.
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** во вход `conditioning` ноды **ConditioningZeroOut**.
  - `text` ноды **CLIP Text Encode (Prompt)**: не меньше 3 знаков.
- Шаг 4, **Покажите образец**:
  - нода **Load Image**.
  - нода **Load CLIP Vision**.
  - нода **CLIP Vision Encode**.
  - `CLIP_VISION` ноды **Load CLIP Vision** во вход `clip_vision` ноды **CLIP Vision Encode**.
  - `IMAGE` ноды **Load Image** во вход `image` ноды **CLIP Vision Encode** (можно через Upscale Image или Upscale Image By или Scale Image to Total Pixels или FluxKontextImageScale или Resize Image или ImageResizeKJv2 или Pad Image for Outpainting).
  - `image` ноды **Load Image**: значение выбрано.
  - `clip_name` ноды **Load CLIP Vision**: значение выбрано.
- Шаг 5, **Примените модель стиля**:
  - нода **Load Style Model**.
  - нода **Apply Style Model**.
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** во вход `conditioning` ноды **Apply Style Model** (можно через FluxGuidance или Apply Style Model).
  - `STYLE_MODEL` ноды **Load Style Model** во вход `style_model` ноды **Apply Style Model**.
  - `CLIP_VISION_OUTPUT` ноды **CLIP Vision Encode** во вход `clip_vision_output` ноды **Apply Style Model**.
  - `style_model_name` ноды **Load Style Model**: значение выбрано.
- Шаг 6, **Пустой латент и сэмплер**:
  - нода **EmptySD3LatentImage**.
  - нода **KSampler**.
  - `MODEL` ноды **Load Diffusion Model** во вход `model` ноды **KSampler** (можно через Load LoRA или LoraLoaderModelOnly или DifferentialDiffusion или ModelSamplingAuraFlow или ModelSamplingFlux или CFGNorm или IPAdapter Unified Loader или IPAdapter или IPAdapterAdvanced или IPAdapterStyleComposition).
  - `CONDITIONING` ноды **Apply Style Model** во вход `positive` ноды **KSampler** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `CONDITIONING` ноды **ConditioningZeroOut** во вход `negative` ноды **KSampler**.
  - `LATENT` ноды **EmptySD3LatentImage** во вход `latent_image` ноды **KSampler**.
  - `cfg` ноды **KSampler**: `1`.
- Шаг 7, **Раскодируйте и сохраните**:
  - нода **VAE Decode**.
  - нода **Save Image** или **Preview Image**.
  - `LATENT` ноды **KSampler** во вход `samples` ноды **VAE Decode**.
  - `VAE` ноды **Load VAE** во вход `vae` ноды **VAE Decode**.
  - `IMAGE` ноды **VAE Decode** во вход `images` ноды **Save Image** или **Preview Image**.

## См. также
- [Картинки-образцы: IP-Adapter, Redux, модели правки](../concepts/Reference-Images.ru.md)
- [Flux.1](../concepts/Family-Flux1.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
