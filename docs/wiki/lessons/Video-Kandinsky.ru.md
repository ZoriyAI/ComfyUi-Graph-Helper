[English](Video-Kandinsky.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Видео из текста: Kandinsky 5 Lite

<!-- lesson: video-kandinsky -->
Урок «video-kandinsky» в группе **Видео** списка уроков. Шагов: 12.

## Чему вы научитесь
Соберёте лёгкий граф из одной модели, который делает пятисекундный ролик по промпту.

## Что понадобится
- Урок продолжает [Видео на скромной видеокарте: Wan 2.2 5B](Video-Small.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Файлы моделей, которые урок проверяет:
  - для поля `unet_name` ноды **Load Diffusion Model**: файл, в имени которого есть `kandinsky5` и `t2v`;
  - для поля `clip_name1` ноды **DualCLIPLoader**: файл, в имени которого есть `qwen_2.5_vl`;
  - для поля `clip_name2` ноды **DualCLIPLoader**: файл, в имени которого есть `clip_l`;
  - для поля `vae_name` ноды **Load VAE**: файл, в имени которого есть `hunyuan_video_vae`.
- Ноды: Load Diffusion Model, DualCLIPLoader, Load VAE, CLIP Text Encode (Prompt), ModelSamplingSD3, Kandinsky5ImageToVideo, KSampler, VAE Decode / VAE Decode (Tiled), Create Video, Save Video.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Сначала о цене** (чтение)

   Kandinsky 5.0 Video Lite от Сбера это малая видеомодель на 2B, около 4 ГБ на диске. Промпт она читает двумя текстовыми энкодерами, а разворачивает кадры VAE от HunyuanVideo.

   Что нужно: файл `kandinsky5lite_t2v` в `models/diffusion_models`; `qwen_2.5_vl_7b` (около 9 ГБ в `fp8`) и `clip_l` в `models/text_encoders`; `hunyuan_video_vae` в `models/vae`. Сама модель помещается на скромные карты; самый большой файл здесь текстовый энкодер. 50 шагов делают запуск долгим: рассчитывайте на много минут.

   Если на холсте уже есть другой граф, начните с пустого: «Файл ▸ Новый проект».

2. **Загрузите модель**

   Добавьте ноду **Load Diffusion Model** и выберите в `unet_name` файл `kandinsky5lite_t2v`.

   Если нужного файла в списке нет, значит, его нет в вашем ComfyUI. Приложение ничего не скачивает. Проще всего открыть в самом ComfyUI шаблон «Kandinsky 5.0 Video Lite Text to Video»: он покажет, каких файлов не хватает и куда их положить. Потом выберите здесь в меню «Синхронизация ▸ Синхронизировать сейчас», и файлы появятся в списках.

3. **Загрузите два текстовых энкодера**

   Добавьте ноду **DualCLIPLoader**. В `clip_name1` выберите `qwen_2.5_vl_7b`, в `clip_name2` `clip_l`, в `type` поставьте `kandinsky5`.

4. **Загрузите VAE**

   Добавьте ноду **Load VAE** и выберите в `vae_name` файл `hunyuan_video_vae`. Kandinsky 5 работает с VAE от HunyuanVideo 1.0.

5. **Напишите промпт**

   Добавьте две ноды **CLIP Text Encode (Prompt)** и подключите выход `CLIP` ноды **DualCLIPLoader** ко входу `clip` каждой. В поле `text` одной опишите ролик: кто или что в кадре, что происходит, как движется камера. Вторая для негативного промпта: чего в ролике быть не должно.

   Для видео важнее всего действие. «Кошка запрыгивает на подоконник, камера следует за ней» работает лучше, чем «кошка на подоконнике».

6. **Задайте сдвиг**

   Добавьте ноду **ModelSamplingSD3** и подключите выход `MODEL` загрузчика к её входу `model`. В поле `shift` поставьте 5.

7. **Размер и длина**

   Добавьте ноду **Kandinsky5ImageToVideo** и подключите к ней два промпта и VAE. Поставьте `width` 768, `height` 512 и `length` 121.

   Файл Lite из этого урока сделан для пятисекундных роликов: 121 кадр при 24 кадрах в секунду. Вход `start_image` для видео из текста остаётся пустым.

8. **Добавьте сэмплер**

   Добавьте ноду **KSampler**. Её вход `model` берёт выход ноды **ModelSamplingSD3**; `positive`, `negative` и `latent_image` берут одноимённые выходы ноды **Kandinsky5ImageToVideo**.

9. **Настройте сэмплер**

   Поставьте `steps` 50, `cfg` 5, `sampler_name` `euler_ancestral` и `scheduler` `beta`, как в шаблоне. С меньшим числом шагов запуск быстрее, а ролик грубее.

10. **Превратите результат в кадры**

   Добавьте ноду **VAE Decode**. Ко входу `samples` подключите выход сэмплера, ко входу `vae` выход ноды **Load VAE**.

   Сэмплер выдаёт ролик в сжатом виде, латенте. Эта нода разворачивает его в кадры.

11. **Соберите и сохраните ролик**

   Добавьте ноды **Create Video** и **Save Video**. Кадры из ноды **VAE Decode** идут во вход `images` ноды **Create Video**, а её выход во вход `video` ноды **Save Video**. В поле `fps` поставьте 24.

   Kandinsky 5 рисует 24 кадра в секунду. С другим числом ролик пойдёт быстрее или медленнее, чем задумано.

12. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Загрузите модель**:
  - нода **Load Diffusion Model**.
  - в поле `unet_name` ноды **Load Diffusion Model** стоит файл, в имени которого есть `kandinsky5` и `t2v` (заглавные буквы, точки и дефисы не важны).
- Шаг 3, **Загрузите два текстовых энкодера**:
  - нода **DualCLIPLoader**.
  - в поле `clip_name1` ноды **DualCLIPLoader** стоит файл, в имени которого есть `qwen_2.5_vl` (заглавные буквы, точки и дефисы не важны).
  - `clip_name2` ноды **DualCLIPLoader**: не тот же файл, что в поле `clip_name1` ноды **DualCLIPLoader**.
  - `type` ноды **DualCLIPLoader**: `kandinsky5`.
  - в поле `clip_name2` ноды **DualCLIPLoader** стоит файл, в имени которого есть `clip_l` (заглавные буквы, точки и дефисы не важны).
- Шаг 4, **Загрузите VAE**:
  - нода **Load VAE**.
  - в поле `vae_name` ноды **Load VAE** стоит файл, в имени которого есть `hunyuan_video_vae` (заглавные буквы, точки и дефисы не важны).
- Шаг 5, **Напишите промпт**:
  - нода **CLIP Text Encode (Prompt)**.
  - нода **CLIP Text Encode (Prompt)**.
  - `CLIP` ноды **DualCLIPLoader** во вход `clip` ноды **CLIP Text Encode (Prompt)** (промпт).
  - `CLIP` ноды **DualCLIPLoader** во вход `clip` ноды **CLIP Text Encode (Prompt)** (негатив).
  - `text` ноды **CLIP Text Encode (Prompt)** (промпт): не меньше 3 знаков.
- Шаг 6, **Задайте сдвиг**:
  - нода **ModelSamplingSD3**.
  - `MODEL` ноды **Load Diffusion Model** во вход `model` ноды **ModelSamplingSD3** (можно через LoraLoaderModelOnly или EasyCache).
  - `shift` ноды **ModelSamplingSD3**: от 3 до 8; «Сделать за меня» ставит 5.
- Шаг 7, **Размер и длина**:
  - нода **Kandinsky5ImageToVideo**.
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (промпт) во вход `positive` ноды **Kandinsky5ImageToVideo**.
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (негатив) во вход `negative` ноды **Kandinsky5ImageToVideo**.
  - `VAE` ноды **Load VAE** во вход `vae` ноды **Kandinsky5ImageToVideo**.
  - `width` ноды **Kandinsky5ImageToVideo**: от 512 до 1280; «Сделать за меня» ставит 768.
  - `height` ноды **Kandinsky5ImageToVideo**: от 320 до 768; «Сделать за меня» ставит 512.
  - `length` ноды **Kandinsky5ImageToVideo**: от 49 до 121; «Сделать за меня» ставит 121.
- Шаг 8, **Добавьте сэмплер**:
  - нода **KSampler**.
  - `MODEL` ноды **ModelSamplingSD3** во вход `model` ноды **KSampler** (можно через LoraLoaderModelOnly или EasyCache).
  - `positive` ноды **Kandinsky5ImageToVideo** во вход `positive` ноды **KSampler**.
  - `negative` ноды **Kandinsky5ImageToVideo** во вход `negative` ноды **KSampler**.
  - `latent` ноды **Kandinsky5ImageToVideo** во вход `latent_image` ноды **KSampler**.
- Шаг 9, **Настройте сэмплер**:
  - `steps` ноды **KSampler**: от 20 до 50; «Сделать за меня» ставит 50.
  - `cfg` ноды **KSampler**: от 3 до 7; «Сделать за меня» ставит 5.
  - `sampler_name` ноды **KSampler**: `euler_ancestral`.
  - `scheduler` ноды **KSampler**: `beta`.
- Шаг 10, **Превратите результат в кадры**:
  - нода **VAE Decode** или **VAE Decode (Tiled)**.
  - `LATENT` ноды **KSampler** во вход `samples` ноды **VAE Decode** или **VAE Decode (Tiled)**.
  - `VAE` ноды **Load VAE** во вход `vae` ноды **VAE Decode** или **VAE Decode (Tiled)**.
- Шаг 11, **Соберите и сохраните ролик**:
  - нода **Create Video**.
  - нода **Save Video**.
  - `IMAGE` ноды **VAE Decode** или **VAE Decode (Tiled)** во вход `images` ноды **Create Video**.
  - `VIDEO` ноды **Create Video** во вход `video` ноды **Save Video**.
  - `fps` ноды **Create Video**: `24`.

## См. также
- [Генерация видео](../concepts/Video-Models.ru.md)
- [Семейства моделей](../concepts/Model-Families.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
