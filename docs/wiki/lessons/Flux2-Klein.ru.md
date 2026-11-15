[English](Flux2-Klein.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Flux.2 Klein: сэмплер из частей

<!-- lesson: flux2-klein -->
Урок «flux2-klein» в группе **Картинки: модели** списка уроков. Шагов: 15.

## Чему вы научитесь
Соберёте граф маленькой модели Flux.2, где сэмплер составлен из пяти нод.

## Что понадобится
- Урок продолжает [Flux.1: картинка из отдельных файлов](Flux1.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Файлы моделей, которые урок проверяет:
  - модель Flux.2 Klein: `models/diffusion_models`, например `flux-2-klein-base-4b-fp8.safetensors`;
  - файл qwen_3_4b или qwen_3_8b для модели 9B: `models/text_encoders`, например `qwen_3_8b_fp8mixed.safetensors`;
  - файл flux2-vae: `models/vae`, например `flux2-vae.safetensors`.
- Ноды: Load Diffusion Model, Load CLIP, Load VAE, CLIP Text Encode (Prompt), CFG Guider, Empty Flux 2 Latent, Flux2Scheduler, KSamplerSelect, RandomNoise, SamplerCustomAdvanced, VAE Decode, Save Image / Preview Image.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Flux.2 и её маленькие модели** (чтение)

   Flux.2 от Black Forest Labs выходит одной большой моделью, dev, и маленькими, Klein, двух размеров: 4B и 9B. Каждая Klein есть в базовом и в дистиллированном виде.

   Flux.2 не увеличенная Flux.1. Её текстовый энкодер это языковая модель, VAE и пустой латент у неё свои, и ни один файл от Flux.1 ей не подходит.

   Официальные шаблоны собирают её сэмплер из частей: KSampler делает всё одной нодой, а здесь шум, проводник, способ сэмплирования и расписание стоят отдельными нодами. Это граф шаблона «FLUX.2 [Klein] 4B: Text to Image».

2. **Какие файлы нужны вашему семейству** (чтение)

   Для Klein 4B:
   - модель: `flux-2-klein-base-4b.safetensors` (базовая) или `flux-2-klein-4b.safetensors` (дистиллированная) в models/diffusion_models;
   - текстовый энкодер: `qwen_3_4b.safetensors` в models/text_encoders, тот же файл, что у Z-Image;
   - VAE: `flux2-vae.safetensors` в models/vae.

   Klein 9B берёт `flux-2-klein-base-9b-fp8.safetensors` и энкодер побольше, `qwen_3_8b_fp8mixed.safetensors`. Flux.2 dev берёт энкодер Mistral и во много раз больше.

   Если файла нет в списке, значит, его нет в вашем ComfyUI. Приложение ничего не скачивает. Откройте в самом ComfyUI шаблон «FLUX.2 [Klein] 4B: Text to Image»: он покажет, каких файлов не хватает и куда их положить. Берите файлы только с официальной страницы модели. Потом выберите здесь в меню «Синхронизация ▸ Синхронизировать сейчас», и файлы появятся в списках.

3. **Загрузите модель**

   Добавьте ноду **Load Diffusion Model** и выберите файл Klein в поле `unet_name`.

   Этот урок ставит числа базовой модели. Что менять для дистиллированной, скажет шаг «Базовая и дистиллированная».

4. **Загрузите текстовый энкодер**

   Добавьте ноду **Load CLIP**. В поле `clip_name` выберите файл Qwen, а в поле `type` поставьте `flux2`.

   Тот же файл служит Z-Image с другим типом: тип говорит ComfyUI, какую модель кормит энкодер.

5. **Загрузите VAE**

   Добавьте ноду **Load VAE** и выберите `flux2-vae.safetensors` в поле `vae_name`.

   VAE от Flux.1 для Flux.2 не годится: сжатый вид картинки другой.

6. **Напишите промпт и негатив**

   Добавьте две ноды **CLIP Text Encode (Prompt)** и подключите выход ноды **Load CLIP** ко входу `clip` каждой. В поле `text` первой опишите картинку предложениями: ёжик в крошечном праздничном колпаке среди конфетти, снимок со вспышкой на старую цифровую камеру.

   Базовая модель читает негатив, поэтому во второй ноде может быть то, что не нужно, или ничего.

7. **Проводник: насколько слушать промпт**

   Добавьте ноду **CFG Guider** и подключите:
   - ко входу `model` выход ноды **Load Diffusion Model**;
   - ко входам `positive` и `negative` две текстовые ноды.

   В поле `cfg` поставьте 5. Эта нода и есть та часть KSampler, которая взвешивает промпт против негатива.

8. **Добавьте пустой латент Flux.2**

   Добавьте ноду **Empty Flux 2 Latent** и поставьте в полях `width` и `height` 1024.

   Её латент имеет 128 каналов при шестнадцатой доле размера, и это нода из шаблона ComfyUI. Обе стороны должны делиться на 16.

9. **Расписание шума**

   Добавьте ноду **Flux2Scheduler**. В поле `steps` поставьте 20, а в `width` и `height` те же числа, что в ноде **Empty Flux 2 Latent**.

   Эта нода считает, сколько шума остаётся перед каждым шагом. У Flux.2 это зависит от размера картинки, поэтому размер здесь должен совпадать с размером пустого латента.

10. **Способ сэмплирования и шум**

   Добавьте ноду **KSamplerSelect** и выберите `euler` в поле `sampler_name`. Добавьте ноду **RandomNoise**: её поле `noise_seed` это сид, число, из которого делается начальный шум.

   В KSampler это два поля, а здесь две ноды.

11. **Соберите сэмплер**

   Добавьте ноду **SamplerCustomAdvanced** и подключите пять её входов:
   - `noise`: выход ноды **RandomNoise**;
   - `guider`: выход ноды **CFG Guider**;
   - `sampler`: выход ноды **KSamplerSelect**;
   - `sigmas`: выход ноды **Flux2Scheduler**;
   - `latent_image`: выход ноды **Empty Flux 2 Latent**.

   Эта нода и делает работу. Её первый выход, `output`, это готовый латент.

12. **Превратите результат в картинку**

   Добавьте ноду **VAE Decode**. Ко входу `samples` подключите выход `output` ноды **SamplerCustomAdvanced**, ко входу `vae` выход ноды **Load VAE**.

13. **Сохраните картинку**

   Добавьте ноду **Save Image** и подключите выход ноды **VAE Decode** к её входу `images`.

   Без неё ComfyUI посчитает картинку и никуда её не положит.

14. **Базовая и дистиллированная** (чтение)

   Дистиллированная Klein сделана ради скорости. В том же шаблоне её числа такие: `steps` 4 в ноде **Flux2Scheduler**, `cfg` 1 в ноде **CFG Guider** и нода пустого условия вместо негативного промпта: при cfg 1 негатив не читается.

   Flux.2 dev устроена так же с двумя отличиями: Basic Guider без негатива вместо **CFG Guider** и нода Flux Guidance с числом 4 на промпте.

15. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Если результат плохой:
   - серый шум или ошибка: VAE не от Flux.2;
   - размытая или странная картинка: размер в ноде **Flux2Scheduler** не совпадает с размером в **Empty Flux 2 Latent**;
   - выжженные цвета у дистиллированной модели: `cfg` выше 1.

   LoRA от Flux.1 к Flux.2 не подходят, а LoRA от Klein 4B не подходят к Klein 9B.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 3, **Загрузите модель**:
  - нода **Load Diffusion Model**.
  - в поле `unet_name` ноды **Load Diffusion Model** стоит файл такого вида: модель Flux.2 Klein; такой файл лежит в `models/diffusion_models`, например `flux-2-klein-base-4b-fp8.safetensors`.
- Шаг 4, **Загрузите текстовый энкодер**:
  - нода **Load CLIP**.
  - в поле `clip_name` ноды **Load CLIP** стоит файл такого вида: файл qwen_3_4b или qwen_3_8b для модели 9B; такой файл лежит в `models/text_encoders`, например `qwen_3_8b_fp8mixed.safetensors`.
  - `type` ноды **Load CLIP**: `flux2`. Почему: с чтением текста не того типа модель прочтёт промпт неправильно и получит бессмыслицу.
- Шаг 5, **Загрузите VAE**:
  - нода **Load VAE**.
  - в поле `vae_name` ноды **Load VAE** стоит файл такого вида: файл flux2-vae; такой файл лежит в `models/vae`, например `flux2-vae.safetensors`.
- Шаг 6, **Напишите промпт и негатив**:
  - нода **CLIP Text Encode (Prompt)**.
  - нода **CLIP Text Encode (Prompt)**.
  - `CLIP` ноды **Load CLIP** во вход `clip` ноды **CLIP Text Encode (Prompt)** (промпт).
  - `CLIP` ноды **Load CLIP** во вход `clip` ноды **CLIP Text Encode (Prompt)** (негатив).
  - `text` ноды **CLIP Text Encode (Prompt)** (промпт): не меньше 20 знаков.
- Шаг 7, **Проводник: насколько слушать промпт**:
  - нода **CFG Guider**.
  - `MODEL` ноды **Load Diffusion Model** во вход `model` ноды **CFG Guider** (можно через LoraLoaderModelOnly).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (промпт) во вход `positive` ноды **CFG Guider**.
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (негатив) во вход `negative` ноды **CFG Guider**.
  - `cfg` ноды **CFG Guider**: от 3 до 6; «Сделать за меня» ставит 5. Почему: базовую модель Klein ведут с силой 5, как в её шаблоне.
- Шаг 8, **Добавьте пустой латент Flux.2**:
  - нода **Empty Flux 2 Latent**.
  - `width` ноды **Empty Flux 2 Latent**: от 512 до 2048; «Сделать за меня» ставит 1024. Почему: flux учили около одного мегапикселя: 1024 на 1024 или столько же пикселей в других пропорциях.
  - `height` ноды **Empty Flux 2 Latent**: от 512 до 2048; «Сделать за меня» ставит 1024. Почему: flux учили около одного мегапикселя: 1024 на 1024 или столько же пикселей в других пропорциях.
- Шаг 9, **Расписание шума**:
  - нода **Flux2Scheduler**.
  - `steps` ноды **Flux2Scheduler**: от 10 до 50; «Сделать за меня» ставит 20. Почему: в расписании шаблона Klein 20 шагов.
  - `width` ноды **Flux2Scheduler** равно полю `width` ноды **Empty Flux 2 Latent**. Почему: расписание зависит от размера картинки; он должен совпадать с размером латента.
  - `height` ноды **Flux2Scheduler** равно полю `height` ноды **Empty Flux 2 Latent**. Почему: расписание зависит от размера картинки; он должен совпадать с размером латента.
- Шаг 10, **Способ сэмплирования и шум**:
  - нода **KSamplerSelect**.
  - нода **RandomNoise**.
  - `sampler_name` ноды **KSamplerSelect**: `euler`.
- Шаг 11, **Соберите сэмплер**:
  - нода **SamplerCustomAdvanced**.
  - `NOISE` ноды **RandomNoise** во вход `noise` ноды **SamplerCustomAdvanced**.
  - `GUIDER` ноды **CFG Guider** во вход `guider` ноды **SamplerCustomAdvanced**.
  - `SAMPLER` ноды **KSamplerSelect** во вход `sampler` ноды **SamplerCustomAdvanced**.
  - `SIGMAS` ноды **Flux2Scheduler** во вход `sigmas` ноды **SamplerCustomAdvanced**.
  - `LATENT` ноды **Empty Flux 2 Latent** во вход `latent_image` ноды **SamplerCustomAdvanced**.
- Шаг 12, **Превратите результат в картинку**:
  - нода **VAE Decode**.
  - `output` ноды **SamplerCustomAdvanced** во вход `samples` ноды **VAE Decode**.
  - `VAE` ноды **Load VAE** во вход `vae` ноды **VAE Decode**.
- Шаг 13, **Сохраните картинку**:
  - нода **Save Image** или **Preview Image**.
  - `IMAGE` ноды **VAE Decode** во вход `images` ноды **Save Image** или **Preview Image**.

## См. также
- [Flux.2](../concepts/Family-Flux2.ru.md)
- [Сэмплер и имена сэмплеров](../concepts/Sampler.ru.md)
- [Планировщик](../concepts/Scheduler.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
