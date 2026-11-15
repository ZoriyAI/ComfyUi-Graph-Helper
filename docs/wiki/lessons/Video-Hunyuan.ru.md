[English](Video-Hunyuan.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Видео из текста: HunyuanVideo 1.5

<!-- lesson: video-hunyuan -->
Урок «video-hunyuan» в группе **Видео** списка уроков. Шагов: 14.

## Чему вы научитесь
Соберёте граф HunyuanVideo 1.5 с составным сэмплером и получите пятисекундный ролик 720p.

## Что понадобится
- Урок продолжает [Видео на скромной видеокарте: Wan 2.2 5B](Video-Small.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Файлы моделей, которые урок проверяет:
  - для поля `unet_name` ноды **Load Diffusion Model**: файл, в имени которого есть `hunyuanvideo1.5` и `t2v`;
  - для поля `clip_name1` ноды **DualCLIPLoader**: файл, в имени которого есть `qwen_2.5_vl`;
  - для поля `clip_name2` ноды **DualCLIPLoader**: файл, в имени которого есть `byt5`;
  - для поля `vae_name` ноды **Load VAE**: файл, в имени которого есть `hunyuanvideo15_vae`.
- Ноды: Load Diffusion Model, DualCLIPLoader, Load VAE, CLIP Text Encode (Prompt), ModelSamplingSD3, Empty Hunyuan Video 1.5 Latent, RandomNoise, KSamplerSelect, BasicScheduler, CFG Guider, SamplerCustomAdvanced, VAE Decode / VAE Decode (Tiled), Create Video, Save Video.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Сначала о цене** (чтение)

   HunyuanVideo 1.5 от Tencent это видеомодель на 8B, по размеру между малой и большой Wan. Её граф работает на составном сэмплере: шум, направляющая нода, сэмплер и список шагов отдельными нодами.

   Что нужно: модель `720p_t2v`, около 17 ГБ в `fp16`, в `models/diffusion_models`; два текстовых энкодера (`qwen_2.5_vl_7b` в `fp8` и маленький `byt5` для надписей) в `models/text_encoders`; `hunyuanvideo15_vae` в `models/vae`. Удобно с картой от 16 ГБ; 121 кадр в 1280 × 720 делается долго, меньший размер намного быстрее.

   Если на холсте уже есть другой граф, начните с пустого: «Файл ▸ Новый проект».

2. **Загрузите модель**

   Добавьте ноду **Load Diffusion Model** и выберите в `unet_name` файл `hunyuanvideo1.5_720p_t2v`.

   Если нужного файла в списке нет, значит, его нет в вашем ComfyUI. Приложение ничего не скачивает. Проще всего открыть в самом ComfyUI шаблон «Hunyuan Video 1.5 Text to Video»: он покажет, каких файлов не хватает и куда их положить. Потом выберите здесь в меню «Синхронизация ▸ Синхронизировать сейчас», и файлы появятся в списках.

3. **Загрузите два текстовых энкодера**

   Добавьте ноду **DualCLIPLoader**. В `clip_name1` выберите `qwen_2.5_vl_7b`, в `clip_name2` `byt5_small_glyphxl`, в `type` поставьте `hunyuan_video_15`.

   Первый читает промпт, второй помогает с надписями в кадре.

4. **Загрузите VAE**

   Добавьте ноду **Load VAE** и выберите в `vae_name` файл `hunyuanvideo15_vae`. VAE от HunyuanVideo 1.0 к версии 1.5 не подходит.

5. **Напишите промпт**

   Добавьте две ноды **CLIP Text Encode (Prompt)** и подключите выход `CLIP` ноды **DualCLIPLoader** ко входу `clip` каждой. В поле `text` одной опишите ролик: кто или что в кадре, что происходит, как движется камера. Вторая для негативного промпта: чего в ролике быть не должно.

   Для видео важнее всего действие. «Кошка запрыгивает на подоконник, камера следует за ней» работает лучше, чем «кошка на подоконнике».

6. **Задайте сдвиг**

   Добавьте ноду **ModelSamplingSD3** и подключите выход `MODEL` загрузчика к её входу `model`. В поле `shift` поставьте 7.

7. **Размер и длина**

   Добавьте ноду **Empty Hunyuan Video 1.5 Latent**. Поставьте `width` 1280, `height` 720 и `length` 121.

   121 кадр при 24 кадрах в секунду дают пять секунд; число кадров вида 4n + 1. Для запуска полегче возьмите модель 480p и размер 848 × 480.

8. **Шум, сэмплер и шаги**

   Добавьте ноды **RandomNoise**, **KSamplerSelect** и **BasicScheduler**.
   - В `sampler_name` ноды **KSamplerSelect** выберите `euler`.
   - Подключите модель ко входу `model` ноды **BasicScheduler**, поставьте `scheduler` `simple` и `steps` 20.

   Планировщик считает список уровней шума на двадцать шагов, нода шума хранит сид.

9. **Направляющая нода**

   Добавьте ноду **CFG Guider**. Её вход `model` берёт выход ноды **ModelSamplingSD3**, входы `positive` и `negative` два промпта. Поставьте `cfg` 6.

10. **Сэмплер**

   Добавьте ноду **SamplerCustomAdvanced** и подключите к ней: `noise` от **RandomNoise**, `guider` от **CFG Guider**, `sampler` от **KSamplerSelect**, `sigmas` от **BasicScheduler**, `latent_image` от **Empty Hunyuan Video 1.5 Latent**.

11. **Превратите результат в кадры**

   Добавьте ноду **VAE Decode**. Ко входу `samples` подключите выход `output` ноды **SamplerCustomAdvanced**, к `vae` VAE. Если памяти мало, возьмите вместо неё VAE Decode (Tiled).

12. **Соберите и сохраните ролик**

   Добавьте ноды **Create Video** и **Save Video**. Кадры из ноды **VAE Decode** идут во вход `images` ноды **Create Video**, а её выход во вход `video` ноды **Save Video**. В поле `fps` поставьте 24.

   HunyuanVideo 1.5 рисует 24 кадра в секунду. С другим числом ролик пойдёт быстрее или медленнее, чем задумано.

13. **Что ещё делает шаблон** (чтение)

   Официальный шаблон добавляет к этому графу две вещи:
   - EasyCache между загрузчиком и сдвигом: пропускает работу на шагах, где мало что меняется, быстрее при небольшой потере деталей;
   - второй этап, который увеличивает ролик до 1080p своей моделью и апскейлером латента.

   Обе можно добавить позже; EasyCache на пути модели приложение принимает.

14. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Загрузите модель**:
  - нода **Load Diffusion Model**.
  - в поле `unet_name` ноды **Load Diffusion Model** стоит файл, в имени которого есть `hunyuanvideo1.5` и `t2v` (заглавные буквы, точки и дефисы не важны).
- Шаг 3, **Загрузите два текстовых энкодера**:
  - нода **DualCLIPLoader**.
  - в поле `clip_name1` ноды **DualCLIPLoader** стоит файл, в имени которого есть `qwen_2.5_vl` (заглавные буквы, точки и дефисы не важны).
  - `clip_name2` ноды **DualCLIPLoader**: не тот же файл, что в поле `clip_name1` ноды **DualCLIPLoader**.
  - `type` ноды **DualCLIPLoader**: `hunyuan_video_15`.
  - в поле `clip_name2` ноды **DualCLIPLoader** стоит файл, в имени которого есть `byt5` (заглавные буквы, точки и дефисы не важны).
- Шаг 4, **Загрузите VAE**:
  - нода **Load VAE**.
  - в поле `vae_name` ноды **Load VAE** стоит файл, в имени которого есть `hunyuanvideo15_vae` (заглавные буквы, точки и дефисы не важны).
- Шаг 5, **Напишите промпт**:
  - нода **CLIP Text Encode (Prompt)**.
  - нода **CLIP Text Encode (Prompt)**.
  - `CLIP` ноды **DualCLIPLoader** во вход `clip` ноды **CLIP Text Encode (Prompt)** (промпт).
  - `CLIP` ноды **DualCLIPLoader** во вход `clip` ноды **CLIP Text Encode (Prompt)** (негатив).
  - `text` ноды **CLIP Text Encode (Prompt)** (промпт): не меньше 3 знаков.
- Шаг 6, **Задайте сдвиг**:
  - нода **ModelSamplingSD3**.
  - `MODEL` ноды **Load Diffusion Model** во вход `model` ноды **ModelSamplingSD3** (можно через LoraLoaderModelOnly или EasyCache).
  - `shift` ноды **ModelSamplingSD3**: от 5 до 9; «Сделать за меня» ставит 7.
- Шаг 7, **Размер и длина**:
  - нода **Empty Hunyuan Video 1.5 Latent**.
  - `width` ноды **Empty Hunyuan Video 1.5 Latent**: от 640 до 1280; «Сделать за меня» ставит 1280.
  - `height` ноды **Empty Hunyuan Video 1.5 Latent**: от 368 до 720; «Сделать за меня» ставит 720.
  - `length` ноды **Empty Hunyuan Video 1.5 Latent**: от 33 до 121; «Сделать за меня» ставит 121.
- Шаг 8, **Шум, сэмплер и шаги**:
  - нода **RandomNoise**.
  - нода **KSamplerSelect**.
  - нода **BasicScheduler**.
  - `MODEL` ноды **Load Diffusion Model** во вход `model` ноды **BasicScheduler** (можно через LoraLoaderModelOnly или EasyCache).
  - `sampler_name` ноды **KSamplerSelect**: `euler`.
  - `scheduler` ноды **BasicScheduler**: `simple`.
  - `steps` ноды **BasicScheduler**: от 8 до 50; «Сделать за меня» ставит 20.
- Шаг 9, **Направляющая нода**:
  - нода **CFG Guider**.
  - `MODEL` ноды **ModelSamplingSD3** во вход `model` ноды **CFG Guider** (можно через LoraLoaderModelOnly или EasyCache).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (промпт) во вход `positive` ноды **CFG Guider**.
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (негатив) во вход `negative` ноды **CFG Guider**.
  - `cfg` ноды **CFG Guider**: от 1 до 8; «Сделать за меня» ставит 6.
- Шаг 10, **Сэмплер**:
  - нода **SamplerCustomAdvanced**.
  - `NOISE` ноды **RandomNoise** во вход `noise` ноды **SamplerCustomAdvanced**.
  - `GUIDER` ноды **CFG Guider** во вход `guider` ноды **SamplerCustomAdvanced**.
  - `SAMPLER` ноды **KSamplerSelect** во вход `sampler` ноды **SamplerCustomAdvanced**.
  - `SIGMAS` ноды **BasicScheduler** во вход `sigmas` ноды **SamplerCustomAdvanced**.
  - `LATENT` ноды **Empty Hunyuan Video 1.5 Latent** во вход `latent_image` ноды **SamplerCustomAdvanced**.
- Шаг 11, **Превратите результат в кадры**:
  - нода **VAE Decode** или **VAE Decode (Tiled)**.
  - `output` ноды **SamplerCustomAdvanced** во вход `samples` ноды **VAE Decode** или **VAE Decode (Tiled)**.
  - `VAE` ноды **Load VAE** во вход `vae` ноды **VAE Decode** или **VAE Decode (Tiled)**.
- Шаг 12, **Соберите и сохраните ролик**:
  - нода **Create Video**.
  - нода **Save Video**.
  - `IMAGE` ноды **VAE Decode** или **VAE Decode (Tiled)** во вход `images` ноды **Create Video**.
  - `VIDEO` ноды **Create Video** во вход `video` ноды **Save Video**.
  - `fps` ноды **Create Video**: `24`.

## См. также
- [HunyuanVideo](../concepts/Family-HunyuanVideo.ru.md)
- [Генерация видео](../concepts/Video-Models.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
