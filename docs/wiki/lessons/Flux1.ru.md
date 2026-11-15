[English](Flux1.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Flux.1: картинка из отдельных файлов

<!-- lesson: flux -->
Урок «flux» в группе **Картинки: модели** списка уроков. Шагов: 14.

## Чему вы научитесь
Соберёте граф Flux из десяти нод, где модель, два текстовых энкодера и VAE загружаются каждый своей нодой.

## Что понадобится
- Урок продолжает [Какой загрузчик для какого файла](Which-Loader.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Файлы моделей, которые урок проверяет:
  - модель Flux.1 (dev, schnell или Krea): `models/diffusion_models`, например `flux1-dev-fp8.safetensors`;
  - файл clip_l: `models/text_encoders`, например `clip_l.safetensors`;
  - файл t5xxl: `models/text_encoders`, например `t5xxl_fp8_e4m3fn_scaled.safetensors`;
  - VAE от Flux, файл ae.safetensors: `models/vae`, например `ae.safetensors`.
- Ноды: Load Diffusion Model, DualCLIPLoader, Load VAE, CLIP Text Encode (Prompt), ConditioningZeroOut, EmptySD3LatentImage, KSampler, FluxGuidance, VAE Decode, Save Image / Preview Image.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Один файл или несколько** (чтение)

   SD 1.5 и SDXL приходят одним файлом-чекпойнтом: в нём модель, которая рисует, текстовый энкодер и VAE. Новые семейства приходят отдельными файлами, и у каждого файла своя нода-загрузчик.

   У семейства Flux от Black Forest Labs три модели с одним графом: dev (основная), schnell (быстрая, дистиллированная на несколько шагов) и Krea dev (dev, дообученная ради более естественной картинки). Меняются только файл модели и число шагов.

   Это граф собственного шаблона ComfyUI «Flux.1 Dev: Text to Image».

2. **Какие файлы нужны вашему семейству** (чтение)

   Разложите файлы по папкам ComfyUI:
   - модель: `flux1-dev.safetensors`, `flux1-schnell.safetensors` или `flux1-krea-dev_fp8_scaled.safetensors` в models/diffusion_models;
   - два текстовых энкодера: `clip_l.safetensors` и `t5xxl_fp16.safetensors` (или меньший `t5xxl_fp8_e4m3fn_scaled.safetensors`) в models/text_encoders;
   - VAE: `ae.safetensors` в models/vae.

   Энкодеры и VAE общие для dev, schnell и Krea. Полная модель dev весит около 24 ГБ: для небольшой видеокарты берите файл fp8 или файл GGUF (урок «Квантованная модель: GGUF»).

   Есть и `flux1-dev-fp8.safetensors` в models/checkpoints, один файл со всеми тремя частями: он идёт в ноду Load Checkpoint, как SDXL. Этот урок про отдельные файлы.

   Если файла нет в списке, значит, его нет в вашем ComfyUI. Приложение ничего не скачивает. Откройте в самом ComfyUI шаблон «Flux.1 Dev: Text to Image»: он покажет, каких файлов не хватает и куда их положить. Берите файлы только с официальной страницы модели. Потом выберите здесь в меню «Синхронизация ▸ Синхронизировать сейчас», и файлы появятся в списках.

3. **Загрузите модель**

   Добавьте ноду **Load Diffusion Model** и выберите модель Flux в поле `unet_name`.

   Этот загрузчик берёт из models/diffusion_models только ту часть, которая рисует. У него один выход, `MODEL`. Поле `weight_dtype` оставьте `default`; `fp8_e4m3fn` вдвое сокращает память для полного файла ценой небольшой потери качества.

4. **Загрузите два текстовых энкодера**

   Добавьте ноду **DualCLIPLoader**. В поле `clip_name1` выберите `clip_l.safetensors`, в `clip_name2` файл t5xxl, а в поле `type` поставьте `flux`.

   Flux читает промпт двумя энкодерами сразу: CLIP-L даёт общий смысл, T5-XXL читает длинные предложения. Поле `type` говорит ComfyUI, как их соединить. С другим типом промпт прочитается неверно, и картинка не будет его слушать.

5. **Загрузите VAE**

   Добавьте ноду **Load VAE** и выберите `ae.safetensors` в поле `vae_name`.

   Это VAE от Flux. VAE от SD 1.5 или SDXL даст здесь шум или ошибку: Flux работает с другим сжатым видом картинки.

6. **Напишите промпт предложениями**

   Добавьте ноду **CLIP Text Encode (Prompt)** и подключите выход ноды **DualCLIPLoader** к её входу `clip`. В поле `text` опишите картинку целыми предложениями (по-английски). Например: красный велосипед прислонён к белой стене в утреннем солнце, длинные мягкие тени.

   T5 понимает обычный язык. Скажите, что на картинке, где, при каком свете и в каком стиле. Теги и веса в скобках здесь значат гораздо меньше, чем в SD 1.5.

7. **Дайте что-то на вход негатива**

   Добавьте ноду **ConditioningZeroOut** и подключите выход ноды **CLIP Text Encode (Prompt)** к её входу `conditioning`.

   Flux dev учили без негативного промпта: при cfg 1 сэмплер вход negative вообще не читает. Но вход должен быть подключён, и эта нода даёт пустое условие нужной формы, как в шаблоне ComfyUI. Что не нужно, скажите в самом промпте: «чистая стена без плакатов».

8. **Добавьте пустой латент Flux**

   Добавьте ноду **EmptySD3LatentImage**. В полях `width` и `height` поставьте 1024.

   У этого пустого латента 16 каналов, в таком виде работает Flux, и эту ноду ставит шаблон ComfyUI. Обычная нода Empty Latent Image делает 4 канала SD 1.5 и SDXL; свежий ComfyUI сам подгоняет пустой латент под модель, так что сработает и она, но держитесь ноды из шаблона. Flux хорошо рисует примерно от 0.5 до 2 мегапикселей: 1024 на 1024, 832 на 1216, 1216 на 832. Обе стороны должны делиться на 16.

9. **Добавьте сэмплер**

   Добавьте ноду **KSampler** и подключите:
   - ко входу `model` выход ноды **Load Diffusion Model**;
   - ко входу `positive` выход ноды **CLIP Text Encode (Prompt)**;
   - ко входу `negative` выход ноды **ConditioningZeroOut**;
   - ко входу `latent_image` выход ноды **EmptySD3LatentImage**.

10. **Настройте сэмплер для Flux**

   В ноде **KSampler** поставьте:
   - `steps`: 20 (4 для schnell);
   - `cfg`: 1;
   - `sampler_name`: `euler`;
   - `scheduler`: `simple`.

   Flux dev и schnell дистиллированы: насколько точно слушать промпт, заложено в саму модель. При cfg выше 1 ComfyUI считает ещё и негатив: каждый шаг идёт вдвое дольше, а цвета обычно выгорают. Schnell сделан на 1 до 4 шагов, dev и Krea нужно около 20.

11. **Задайте guidance для Flux**

   Добавьте ноду **FluxGuidance** между промптом и сэмплером: выход ноды **CLIP Text Encode (Prompt)** идёт в её вход `conditioning`, а её выход во вход `positive` ноды **KSampler**. В поле `guidance` поставьте 3.5.

   Так Flux dev говорят, насколько точно слушать промпт, вместо cfg. Без этой ноды ComfyUI и так берёт 3.5, поэтому нода нужна для другого числа: 2 до 3 для более мягкой, естественной картинки, 4 до 5 для более строгой. Schnell это число не читает. У других моделей Flux свои числа: Kontext 2.5, Fill и Canny 30.

12. **Превратите результат в картинку**

   Добавьте ноду **VAE Decode**. Ко входу `samples` подключите выход ноды **KSampler**, ко входу `vae` выход ноды **Load VAE**.

   Сэмплер выдаёт картинку в сжатом виде, латент. VAE того же семейства разворачивает его в пиксели.

13. **Сохраните картинку**

   Добавьте ноду **Save Image** и подключите выход ноды **VAE Decode** к её входу `images`.

   Без неё ComfyUI посчитает картинку и никуда её не положит.

14. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Если результат плохой:
   - серый шум или ошибка: VAE или пустой латент не от Flux;
   - картинка не слушает промпт: проверьте `type` `flux` и оба файла энкодеров;
   - выжженные цвета: `cfg` выше 1 или слишком большой `guidance`;
   - не хватает видеопамяти: файлы fp8, `weight_dtype` `fp8_e4m3fn` или модель GGUF.

   Здесь работают только LoRA, сделанные для Flux.1. Их ставят между **Load Diffusion Model** и **KSampler** в ноду Load LoRA, обычно в ту, что только для модели.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 3, **Загрузите модель**:
  - нода **Load Diffusion Model**.
  - в поле `unet_name` ноды **Load Diffusion Model** стоит файл такого вида: модель Flux.1 (dev, schnell или Krea); такой файл лежит в `models/diffusion_models`, например `flux1-dev-fp8.safetensors`.
- Шаг 4, **Загрузите два текстовых энкодера**:
  - нода **DualCLIPLoader**.
  - в поле `clip_name1` ноды **DualCLIPLoader** стоит файл такого вида: файл clip_l; такой файл лежит в `models/text_encoders`, например `clip_l.safetensors`.
  - `clip_name2` ноды **DualCLIPLoader**: не тот же файл, что в поле `clip_name1` ноды **DualCLIPLoader**.
  - в поле `clip_name2` ноды **DualCLIPLoader** стоит файл такого вида: файл t5xxl; такой файл лежит в `models/text_encoders`, например `t5xxl_fp8_e4m3fn_scaled.safetensors`.
  - `type` ноды **DualCLIPLoader**: `flux`. Почему: с чтением текста не того типа модель прочтёт промпт неправильно и получит бессмыслицу.
- Шаг 5, **Загрузите VAE**:
  - нода **Load VAE**.
  - в поле `vae_name` ноды **Load VAE** стоит файл такого вида: VAE от Flux, файл ae.safetensors; такой файл лежит в `models/vae`, например `ae.safetensors`.
- Шаг 6, **Напишите промпт предложениями**:
  - нода **CLIP Text Encode (Prompt)**.
  - `CLIP` ноды **DualCLIPLoader** во вход `clip` ноды **CLIP Text Encode (Prompt)**.
  - `text` ноды **CLIP Text Encode (Prompt)**: не меньше 20 знаков.
- Шаг 7, **Дайте что-то на вход негатива**:
  - нода **ConditioningZeroOut**.
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** во вход `conditioning` ноды **ConditioningZeroOut**.
- Шаг 8, **Добавьте пустой латент Flux**:
  - нода **EmptySD3LatentImage**.
  - `width` ноды **EmptySD3LatentImage**: от 512 до 2048; «Сделать за меня» ставит 1024. Почему: flux учили около одного мегапикселя: 1024 на 1024 или столько же пикселей в других пропорциях.
  - `height` ноды **EmptySD3LatentImage**: от 512 до 2048; «Сделать за меня» ставит 1024. Почему: flux учили около одного мегапикселя: 1024 на 1024 или столько же пикселей в других пропорциях.
- Шаг 9, **Добавьте сэмплер**:
  - нода **KSampler**.
  - `MODEL` ноды **Load Diffusion Model** во вход `model` ноды **KSampler** (можно через LoraLoaderModelOnly или ModelSamplingAuraFlow или ModelSamplingFlux или ModelSamplingSD3).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** во вход `positive` ноды **KSampler** (можно через FluxGuidance).
  - `CONDITIONING` ноды **ConditioningZeroOut** во вход `negative` ноды **KSampler**.
  - `LATENT` ноды **EmptySD3LatentImage** во вход `latent_image` ноды **KSampler**.
- Шаг 10, **Настройте сэмплер для Flux**:
  - `steps` ноды **KSampler**: от 4 до 30; «Сделать за меня» ставит 20. Почему: шаблоны Flux ставят 20 шагов; с меньшим числом картинка выходит недорисованной.
  - `cfg` ноды **KSampler**: `1`. Почему: flux dev выучил своё число строгости вместо cfg: cfg больше 1 удваивает время и выжигает цвета.
  - `sampler_name` ноды **KSampler**: `euler`.
  - `scheduler` ноды **KSampler**: `simple`.
- Шаг 11, **Задайте guidance для Flux**:
  - нода **FluxGuidance**.
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** во вход `conditioning` ноды **FluxGuidance**.
  - `CONDITIONING` ноды **FluxGuidance** во вход `positive` ноды **KSampler**.
  - `guidance` ноды **FluxGuidance**: от 1.5 до 5; «Сделать за меня» ставит 3.5. Почему: это число Flux dev выучил вместо cfg; 3.5 стоит в ComfyUI для него по умолчанию.
- Шаг 12, **Превратите результат в картинку**:
  - нода **VAE Decode**.
  - `LATENT` ноды **KSampler** во вход `samples` ноды **VAE Decode**.
  - `VAE` ноды **Load VAE** во вход `vae` ноды **VAE Decode**.
- Шаг 13, **Сохраните картинку**:
  - нода **Save Image** или **Preview Image**.
  - `IMAGE` ноды **VAE Decode** во вход `images` ноды **Save Image** или **Preview Image**.

## Что дальше
Этот урок продолжают: [Flux.2 Klein: сэмплер из частей](Flux2-Klein.ru.md), [Квантованная модель: GGUF](GGUF.ru.md), [Картинка-образец для стиля (Flux Redux)](Style-Reference.ru.md).

## См. также
- [Flux.1](../concepts/Family-Flux1.ru.md)
- [Отдельные загрузчики: диффузионная модель, текстовый энкодер, VAE](../concepts/Separate-Loaders.ru.md)
- [Текстовые энкодеры: CLIP, T5 и другие](../concepts/Text-Encoders.ru.md)
- [CFG и guidance](../concepts/CFG.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
