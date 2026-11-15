[English](Video-Upscale.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Видео крупнее и чётче: SeedVR2

<!-- lesson: video-upscale -->
Урок «video-upscale» в группе **Паки и инструменты** списка уроков. Шагов: 8.

## Чему вы научитесь
Ролик низкого разрешения перерисовывается в 1080p с восстановленными деталями.

## Что понадобится
- Урок продолжает [Загрузить, обрезать и сохранить видео: VideoHelperSuite](VideoHelperSuite.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Паки нод: **ComfyUI-SeedVR2_VideoUpscaler**. Их вы ставите в ComfyUI сами, потом выбираете **Синхронизация ▸ Синхронизировать сейчас**. До тех пор карточка говорит, что урок не подходит, и называет пак.
- Файлы моделей, которые урок проверяет:
  - для поля `model` ноды **SeedVR2 (Down)Load DiT Model**: файл, в имени которого есть `seedvr2`;
  - для поля `model` ноды **SeedVR2 (Down)Load VAE Model**: файл, в имени которого есть `vae`.
- Ноды: Load Video, Get Video Components, SeedVR2 (Down)Load DiT Model, SeedVR2 (Down)Load VAE Model, SeedVR2 Video Upscaler, Create Video, Save Video.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Сначала о цене** (чтение)

   Для урока нужен пак ComfyUI-SeedVR2_VideoUpscaler. Поставьте его сами через менеджер ComfyUI. Пак запускает на вашем компьютере чужой код, поэтому берите его с официальной страницы и обновляйте.

   SeedVR2 не просто растягивает кадры: он перерисовывает их крупнее, восстанавливая детали, и держит соседние кадры согласованными.

   Цена: модель 3B (около 7 ГБ) или 7B (около 16 ГБ, чётче) и VAE. Если файла нет, загрузчик пака сам скачает его в `models/SEEDVR2` при первом запуске графа в ComfyUI; приложение ничего не скачивает. С переносом блоков и VAE по кусочкам, как здесь, модель 3B работает на скромных картах. Каждый кадр перерисовывается, поэтому длинный ролик делается долго: начните с нескольких секунд.

   Если на холсте уже есть другой граф, начните с пустого: «Файл ▸ Новый проект».

2. **Загрузите ролик**

   Добавьте ноды **Load Video** и **Get Video Components**. В `file` выберите ролик и подключите **Load Video** ко входу `video` ноды **Get Video Components**.

3. **Загрузите модель с переносом блоков**

   Добавьте ноду **SeedVR2 (Down)Load DiT Model**. В `model` для начала выберите файл 3B. Поставьте `blocks_to_swap` 32 и `offload_device` `cpu`.

   Перенос блоков держит большую часть блоков модели в оперативной памяти и подгружает каждый, когда он нужен: намного меньше видеопамяти, медленнее запуск. С большой картой поставьте 0.

4. **Загрузите VAE по кусочкам**

   Добавьте ноду **SeedVR2 (Down)Load VAE Model**, выберите в `model` файл VAE и поставьте `encode_tiled` и `decode_tiled` в `true`.

   Кадры читаются и пишутся частями, и пик памяти остаётся низким.

5. **Увеличитель**

   Добавьте ноду **SeedVR2 Video Upscaler**. Выход `images` ноды **Get Video Components** подключите к её входу `image`, **SeedVR2 (Down)Load DiT Model** к `dit`, **SeedVR2 (Down)Load VAE Model** к `vae`. Поставьте `resolution` 1080, `batch_size` 33 и `color_correction` `lab`.

   `resolution` это длина короткой стороны результата. `batch_size` это сколько кадров перерисовываются вместе: больше держит движение согласованным и требует больше памяти. Число вида 4n + 1 (5, 21, 33).

6. **Сохраните со звуком**

   Добавьте ноды **Create Video** и **Save Video**. Кадры ноды **SeedVR2 Video Upscaler** идут в `images`, выход `audio` ноды **Get Video Components** в `audio`, ролик в `video` ноды **Save Video**. В поле `fps` поставьте частоту исходного ролика, например 24.

7. **Если результат не тот** (чтение)

   - Не хватает памяти: уменьшите `batch_size` до 21 или 5 или `resolution` до 720.
   - Мерцание между группами кадров: увеличьте `batch_size`.
   - Сдвигаются цвета: попробуйте `wavelet` в `color_correction`.
   - Слишком долго: сначала укоротите ролик; шаблон берёт первые 96 кадров нодой Image From Batch, и приложение принимает её на пути.

8. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Загрузите ролик**:
  - нода **Load Video**.
  - нода **Get Video Components**.
  - `VIDEO` ноды **Load Video** во вход `video` ноды **Get Video Components**.
  - `file` ноды **Load Video**: значение выбрано.
- Шаг 3, **Загрузите модель с переносом блоков**:
  - нода **SeedVR2 (Down)Load DiT Model**.
  - в поле `model` ноды **SeedVR2 (Down)Load DiT Model** стоит файл, в имени которого есть `seedvr2` (заглавные буквы, точки и дефисы не важны).
  - `blocks_to_swap` ноды **SeedVR2 (Down)Load DiT Model**: от 0 до 36; «Сделать за меня» ставит 32.
  - `offload_device` ноды **SeedVR2 (Down)Load DiT Model**: `cpu`.
- Шаг 4, **Загрузите VAE по кусочкам**:
  - нода **SeedVR2 (Down)Load VAE Model**.
  - в поле `model` ноды **SeedVR2 (Down)Load VAE Model** стоит файл, в имени которого есть `vae` (заглавные буквы, точки и дефисы не важны).
  - `encode_tiled` ноды **SeedVR2 (Down)Load VAE Model**: `true`.
  - `decode_tiled` ноды **SeedVR2 (Down)Load VAE Model**: `true`.
- Шаг 5, **Увеличитель**:
  - нода **SeedVR2 Video Upscaler**.
  - `images` ноды **Get Video Components** во вход `image` ноды **SeedVR2 Video Upscaler** (можно через Upscale Image или Upscale Image By или ImageFromBatch или ImageResizeKJv2 или Resize Image или GetImageRangeFromBatch или ResizeImageMaskNode).
  - `SEEDVR2_DIT` ноды **SeedVR2 (Down)Load DiT Model** во вход `dit` ноды **SeedVR2 Video Upscaler**.
  - `SEEDVR2_VAE` ноды **SeedVR2 (Down)Load VAE Model** во вход `vae` ноды **SeedVR2 Video Upscaler**.
  - `resolution` ноды **SeedVR2 Video Upscaler**: от 720 до 2160; «Сделать за меня» ставит 1080.
  - `batch_size` ноды **SeedVR2 Video Upscaler**: от 5 до 81; «Сделать за меня» ставит 33.
  - `color_correction` ноды **SeedVR2 Video Upscaler**: `lab`.
- Шаг 6, **Сохраните со звуком**:
  - нода **Create Video**.
  - нода **Save Video**.
  - `IMAGE` ноды **SeedVR2 Video Upscaler** во вход `images` ноды **Create Video**.
  - `audio` ноды **Get Video Components** во вход `audio` ноды **Create Video**.
  - `VIDEO` ноды **Create Video** во вход `video` ноды **Save Video**.
  - `fps` ноды **Create Video**: от 1 до 120; «Сделать за меня» ставит 24.

## См. также
- [Увеличение](../concepts/Upscaling.ru.md)
- [Паки нод](../concepts/Node-Packs.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
