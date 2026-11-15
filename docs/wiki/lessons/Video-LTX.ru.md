[English](Video-LTX.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Видео со звуком: LTX-2.5

<!-- lesson: video-ltx -->
Урок «video-ltx» в группе **Видео** списка уроков. Шагов: 16.

## Чему вы научитесь
Один запуск рисует ролик и звук к нему вместе, по промпту.

## Что понадобится
- Урок продолжает [Видео на скромной видеокарте: Wan 2.2 5B](Video-Small.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Файлы моделей, которые урок проверяет:
  - для поля `unet_name` ноды **Load Diffusion Model**: файл, в имени которого есть `ltx-2`;
  - для поля `clip_name` ноды **Load CLIP**: файл, в имени которого есть `gemma`;
  - для поля `vae_name` ноды **Load VAE** (VAE видео): файл, в имени которого есть `ltx` и `video`;
  - для поля `vae_name` ноды **Load VAE** (VAE звука): файл, в имени которого есть `ltx` и `audio`;
  - для поля `model_name` ноды **Load Latent Upscale Model**: файл, в имени которого есть `ltx` и `upscaler`.
- Ноды: Load Diffusion Model, Load CLIP, Load VAE, CLIP Text Encode (Prompt), LTXVConditioning, EmptyLTXVLatentVideo, Empty LTXV Latent Audio, LTXVConcatAVLatent, RandomNoise, KSamplerSelect, ManualSigmas, LTXVDualCFGGuider, SamplerCustomAdvanced, LTXVSeparateAVLatent, Load Latent Upscale Model, LTXVLatentUpsampler, VAE Decode (Tiled) / VAE Decode, LTXV Audio VAE Decode, Create Video, Save Video.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Сначала о цене** (чтение)

   LTX-2.5 от Lightricks рисует картинку и звук за один проход: шаги, дождь, голос. Граф работает в два этапа: первый рисует ролик в половинном размере, апскейлер латента удваивает его, второй этап дорабатывает детали.

   Что нужно: дистиллированная модель (больше 20 ГБ) в `models/diffusion_models`; текстовый энкодер Gemma (около 12 ГБ) в `models/text_encoders`; два файла VAE, для видео и для звука, в `models/vae`; апскейлер в `models/latent_upscale_models`. Удобно с картой на 24 ГБ; с меньшей ComfyUI переносит части в оперативную память, и запуск медленнее. Дистиллированной модели нужно всего восемь шагов и три, поэтому пятисекундный ролик делается минуты.

   Это самый большой граф среди этих уроков. Если на холсте уже есть другой граф, начните с пустого: «Файл ▸ Новый проект».

2. **Загрузите модель**

   Добавьте ноду **Load Diffusion Model** и выберите в `unet_name` дистиллированный файл `ltx-2.5`.

   Если нужного файла в списке нет, значит, его нет в вашем ComfyUI. Приложение ничего не скачивает. Проще всего открыть в самом ComfyUI шаблон «LTX-2.5: Text to Video»: он покажет, каких файлов не хватает и куда их положить. Потом выберите здесь в меню «Синхронизация ▸ Синхронизировать сейчас», и файлы появятся в списках.

3. **Текстовый энкодер и два VAE**

   Добавьте ноды **Load CLIP**, **Load VAE** и вторую **Load VAE**.
   - В `clip_name` ноды **Load CLIP** выберите файл Gemma, сделанный для LTX-2.5, и в `type` поставьте `ltxv`.
   - В `vae_name` ноды **Load VAE** выберите файл `video-vae`.
   - В `vae_name` второго загрузчика VAE выберите файл `audio-vae`.

   У картинки и у звука свой VAE; если их перепутать, вместо звука будет шум.

4. **Напишите промпт со звуком**

   Добавьте две ноды **CLIP Text Encode (Prompt)** и подключите выход `CLIP` ноды **Load CLIP** к каждой. В поле `text` одной опишите сцену в несколько предложений и скажите, что слышно: «дождь стучит по жестяной крыше», «она тихо говорит: мы опаздываем». Вторая для негативного промпта.

   LTX лучше всего читает длинные подробные промпты.

5. **Сообщите модели частоту кадров**

   Добавьте ноду **LTXVConditioning**. Подключите два промпта к её входам `positive` и `negative` и поставьте `frame_rate` 24.

   Модели нужно знать, как быстро идёт время в ролике, чтобы движение и звук шли в ногу.

6. **Размер и длина первого этапа**

   Добавьте ноду **EmptyLTXVLatentVideo**. Поставьте `width` 768, `height` 512 и `length` 121.

   Это половина итогового размера: апскейлер его удвоит. У LTX число кадров вида 8n + 1 (97, 121), а стороны кратны 32. 121 кадр при 24 кадрах в секунду дают пять секунд.

7. **Заготовка для звука вместе с видео**

   Добавьте ноды **Empty LTXV Latent Audio** и **LTXVConcatAVLatent**.
   - Выход загрузчика звукового VAE подключите ко входу `audio_vae` ноды **Empty LTXV Latent Audio**. Поставьте `frames_number` 121 и `frame_rate` 24, как у видео.
   - Выход ноды **EmptyLTXVLatentVideo** подключите к `video_latent` ноды **LTXVConcatAVLatent**, выход **Empty LTXV Latent Audio** к `audio_latent`.

   Модель рисует картинку и звук в одном латенте, поэтому две заготовки идут вместе.

8. **Шум, сэмплер и шаги**

   Добавьте ноды **RandomNoise**, **KSamplerSelect** и **ManualSigmas**.
   - В `sampler_name` ноды **KSamplerSelect** выберите `euler_ancestral`.
   - В поле `sigmas` ноды **ManualSigmas** впишите: `1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0`.

   Этот сэмплер собирается из частей. Список чисел это шум, который остаётся после каждого шага: дистиллированная модель обучена ровно на эти восемь шагов.

9. **Направляющая нода**

   Добавьте ноду **LTXVDualCFGGuider**. Ко входу `model` подключите модель, к `positive` и `negative` одноимённые выходы ноды **LTXVConditioning**. Поставьте `video_cfg` и `audio_cfg` 1.

   Дистиллированной модели не нужен дополнительный нажим промпта; значение выше пережигает картинку.

10. **Первый этап**

   Добавьте ноду **SamplerCustomAdvanced** и подключите к ней: `noise` от **RandomNoise**, `guider` от **LTXVDualCFGGuider**, `sampler` от **KSamplerSelect**, `sigmas` от **ManualSigmas**, `latent_image` от **LTXVConcatAVLatent**.

11. **Удвойте размер видео**

   Добавьте ноды **LTXVSeparateAVLatent**, **Load Latent Upscale Model**, **LTXVLatentUpsampler** и вторую **LTXVConcatAVLatent**.
   - Выход `output` первого этапа идёт во вход `av_latent` ноды **LTXVSeparateAVLatent**: она разделяет видео и звук.
   - В `model_name` ноды **Load Latent Upscale Model** выберите файл пространственного апскейлера LTX-2.5. Его выход идёт в `upscale_model` ноды **LTXVLatentUpsampler**, видео-VAE в `vae`, а `video_latent` ноды **LTXVSeparateAVLatent** в `samples`.
   - Выход **LTXVLatentUpsampler** идёт в `video_latent` новой ноды соединения, а `audio_latent` ноды **LTXVSeparateAVLatent** в её `audio_latent`.

   Увеличивается только видео, звук идёт дальше как есть.

12. **Второй этап**

   Добавьте вторую ноду **ManualSigmas** с `sigmas` `0.85, 0.7250, 0.4219, 0.0` и вторую **SamplerCustomAdvanced**. К новому сэмплеру подключите тот же шум, ту же направляющую ноду и тот же выбор сэмплера, новый список шагов и выход второго соединения к `latent_image`.

   Три коротких шага дорабатывают детали большого ролика. В шаблоне у каждого этапа своя копия шума, направляющей ноды и выбора сэмплера с теми же настройками; одной на оба этапа достаточно.

13. **Превратите результат в кадры и звук**

   Добавьте вторую ноду **LTXVSeparateAVLatent**, ноду **VAE Decode (Tiled)** и ноду **LTXV Audio VAE Decode**.
   - Выход `output` второго этапа идёт в `av_latent` новой разделяющей ноды.
   - Её `video_latent` идёт в `samples` ноды **VAE Decode (Tiled)**, видео-VAE в `vae`.
   - Её `audio_latent` идёт в `samples` ноды **LTXV Audio VAE Decode**, звуковой VAE в `audio_vae`.

   Декодер по кусочкам превращает большой ролик в кадры частями, и конец запуска требует меньше памяти.

14. **Соберите ролик со звуком**

   Добавьте ноды **Create Video** и **Save Video**: кадры в `images`, звук в `audio`, ролик в `video`. В поле `fps` поставьте 24, как в ноде **LTXVConditioning**.

15. **Если результат не тот** (чтение)

   - Звук не подходит к картинке: опишите звук в промпте так же ясно, как картинку.
   - Ролик стоит на месте: опишите одно ясное действие и движение камеры.
   - Не помещается в память: поставьте `length` 97 или размер 640 × 384.

16. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Загрузите модель**:
  - нода **Load Diffusion Model**.
  - в поле `unet_name` ноды **Load Diffusion Model** стоит файл, в имени которого есть `ltx-2` (заглавные буквы, точки и дефисы не важны).
- Шаг 3, **Текстовый энкодер и два VAE**:
  - нода **Load CLIP**.
  - нода **Load VAE**.
  - нода **Load VAE**.
  - в поле `clip_name` ноды **Load CLIP** стоит файл, в имени которого есть `gemma` (заглавные буквы, точки и дефисы не важны).
  - `type` ноды **Load CLIP**: `ltxv`.
  - в поле `vae_name` ноды **Load VAE** (VAE видео) стоит файл, в имени которого есть `ltx` и `video` (заглавные буквы, точки и дефисы не важны).
  - `vae_name` ноды **Load VAE** (VAE звука): не тот же файл, что в поле `vae_name` ноды **Load VAE** (VAE видео).
  - в поле `vae_name` ноды **Load VAE** (VAE звука) стоит файл, в имени которого есть `ltx` и `audio` (заглавные буквы, точки и дефисы не важны).
- Шаг 4, **Напишите промпт со звуком**:
  - нода **CLIP Text Encode (Prompt)**.
  - нода **CLIP Text Encode (Prompt)**.
  - `CLIP` ноды **Load CLIP** во вход `clip` ноды **CLIP Text Encode (Prompt)** (промпт).
  - `CLIP` ноды **Load CLIP** во вход `clip` ноды **CLIP Text Encode (Prompt)** (негатив).
  - `text` ноды **CLIP Text Encode (Prompt)** (промпт): не меньше 40 знаков.
- Шаг 5, **Сообщите модели частоту кадров**:
  - нода **LTXVConditioning**.
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (промпт) во вход `positive` ноды **LTXVConditioning**.
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (негатив) во вход `negative` ноды **LTXVConditioning**.
  - `frame_rate` ноды **LTXVConditioning**: `24`.
- Шаг 6, **Размер и длина первого этапа**:
  - нода **EmptyLTXVLatentVideo**.
  - `width` ноды **EmptyLTXVLatentVideo**: от 512 до 960; «Сделать за меня» ставит 768.
  - `height` ноды **EmptyLTXVLatentVideo**: от 288 до 544; «Сделать за меня» ставит 512.
  - `length` ноды **EmptyLTXVLatentVideo**: от 49 до 121; «Сделать за меня» ставит 121.
- Шаг 7, **Заготовка для звука вместе с видео**:
  - нода **Empty LTXV Latent Audio**.
  - нода **LTXVConcatAVLatent**.
  - `VAE` ноды **Load VAE** (VAE звука) во вход `audio_vae` ноды **Empty LTXV Latent Audio**.
  - `LATENT` ноды **EmptyLTXVLatentVideo** во вход `video_latent` ноды **LTXVConcatAVLatent** (соединение, первая стадия).
  - `LATENT` ноды **Empty LTXV Latent Audio** во вход `audio_latent` ноды **LTXVConcatAVLatent** (соединение, первая стадия).
  - `frames_number` ноды **Empty LTXV Latent Audio** равно полю `length` ноды **EmptyLTXVLatentVideo**.
  - `frame_rate` ноды **Empty LTXV Latent Audio** равно полю `frame_rate` ноды **LTXVConditioning**.
- Шаг 8, **Шум, сэмплер и шаги**:
  - нода **RandomNoise**.
  - нода **KSamplerSelect**.
  - нода **ManualSigmas**.
  - `sampler_name` ноды **KSamplerSelect**: `euler_ancestral`.
  - `sigmas` ноды **ManualSigmas** (первая стадия): `1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0`.
- Шаг 9, **Направляющая нода**:
  - нода **LTXVDualCFGGuider**.
  - `MODEL` ноды **Load Diffusion Model** во вход `model` ноды **LTXVDualCFGGuider** (можно через LoraLoaderModelOnly или EasyCache).
  - `positive` ноды **LTXVConditioning** во вход `positive` ноды **LTXVDualCFGGuider**.
  - `negative` ноды **LTXVConditioning** во вход `negative` ноды **LTXVDualCFGGuider**.
  - `video_cfg` ноды **LTXVDualCFGGuider**: `1`.
  - `audio_cfg` ноды **LTXVDualCFGGuider**: `1`.
- Шаг 10, **Первый этап**:
  - нода **SamplerCustomAdvanced**.
  - `NOISE` ноды **RandomNoise** во вход `noise` ноды **SamplerCustomAdvanced** (первая стадия).
  - `GUIDER` ноды **LTXVDualCFGGuider** во вход `guider` ноды **SamplerCustomAdvanced** (первая стадия).
  - `SAMPLER` ноды **KSamplerSelect** во вход `sampler` ноды **SamplerCustomAdvanced** (первая стадия).
  - `SIGMAS` ноды **ManualSigmas** (первая стадия) во вход `sigmas` ноды **SamplerCustomAdvanced** (первая стадия).
  - `LATENT` ноды **LTXVConcatAVLatent** (соединение, первая стадия) во вход `latent_image` ноды **SamplerCustomAdvanced** (первая стадия).
- Шаг 11, **Удвойте размер видео**:
  - нода **LTXVSeparateAVLatent**.
  - нода **Load Latent Upscale Model**.
  - нода **LTXVLatentUpsampler**.
  - нода **LTXVConcatAVLatent**.
  - `output` ноды **SamplerCustomAdvanced** (первая стадия) во вход `av_latent` ноды **LTXVSeparateAVLatent** (после первой стадии).
  - `video_latent` ноды **LTXVSeparateAVLatent** (после первой стадии) во вход `samples` ноды **LTXVLatentUpsampler**.
  - `LATENT_UPSCALE_MODEL` ноды **Load Latent Upscale Model** во вход `upscale_model` ноды **LTXVLatentUpsampler**.
  - `VAE` ноды **Load VAE** (VAE видео) во вход `vae` ноды **LTXVLatentUpsampler**.
  - `LATENT` ноды **LTXVLatentUpsampler** во вход `video_latent` ноды **LTXVConcatAVLatent** (соединение, вторая стадия).
  - `audio_latent` ноды **LTXVSeparateAVLatent** (после первой стадии) во вход `audio_latent` ноды **LTXVConcatAVLatent** (соединение, вторая стадия).
  - в поле `model_name` ноды **Load Latent Upscale Model** стоит файл, в имени которого есть `ltx` и `upscaler` (заглавные буквы, точки и дефисы не важны).
- Шаг 12, **Второй этап**:
  - нода **ManualSigmas**.
  - нода **SamplerCustomAdvanced**.
  - `NOISE` ноды **RandomNoise** во вход `noise` ноды **SamplerCustomAdvanced** (вторая стадия).
  - `GUIDER` ноды **LTXVDualCFGGuider** во вход `guider` ноды **SamplerCustomAdvanced** (вторая стадия).
  - `SAMPLER` ноды **KSamplerSelect** во вход `sampler` ноды **SamplerCustomAdvanced** (вторая стадия).
  - `SIGMAS` ноды **ManualSigmas** (вторая стадия) во вход `sigmas` ноды **SamplerCustomAdvanced** (вторая стадия).
  - `LATENT` ноды **LTXVConcatAVLatent** (соединение, вторая стадия) во вход `latent_image` ноды **SamplerCustomAdvanced** (вторая стадия).
  - `sigmas` ноды **ManualSigmas** (вторая стадия): `0.85, 0.7250, 0.4219, 0.0`.
- Шаг 13, **Превратите результат в кадры и звук**:
  - нода **LTXVSeparateAVLatent**.
  - нода **VAE Decode (Tiled)** или **VAE Decode**.
  - нода **LTXV Audio VAE Decode**.
  - `output` ноды **SamplerCustomAdvanced** (вторая стадия) во вход `av_latent` ноды **LTXVSeparateAVLatent** (после второй стадии).
  - `video_latent` ноды **LTXVSeparateAVLatent** (после второй стадии) во вход `samples` ноды **VAE Decode (Tiled)** или **VAE Decode**.
  - `VAE` ноды **Load VAE** (VAE видео) во вход `vae` ноды **VAE Decode (Tiled)** или **VAE Decode**.
  - `audio_latent` ноды **LTXVSeparateAVLatent** (после второй стадии) во вход `samples` ноды **LTXV Audio VAE Decode**.
  - `VAE` ноды **Load VAE** (VAE звука) во вход `audio_vae` ноды **LTXV Audio VAE Decode**.
- Шаг 14, **Соберите ролик со звуком**:
  - нода **Create Video**.
  - нода **Save Video**.
  - `IMAGE` ноды **VAE Decode (Tiled)** или **VAE Decode** во вход `images` ноды **Create Video**.
  - `AUDIO` ноды **LTXV Audio VAE Decode** во вход `audio` ноды **Create Video**.
  - `VIDEO` ноды **Create Video** во вход `video` ноды **Save Video**.
  - `fps` ноды **Create Video**: `24`.

## См. также
- [LTX-2](../concepts/Family-LTX2.ru.md)
- [Звук](../concepts/Audio.ru.md)
- [Генерация видео](../concepts/Video-Models.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
