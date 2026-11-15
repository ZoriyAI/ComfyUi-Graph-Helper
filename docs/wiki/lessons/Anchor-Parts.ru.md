[English](Anchor-Parts.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Длинное видео частями

<!-- lesson: anchor-parts -->
Урок «anchor-parts» в группе **Видео: опорная картинка** списка уроков. Шагов: 12.

## Сначала согласие
Оживлять так можно только того, кто на это согласен: себя, придуманного героя или человека, который разрешил. Получите разрешение на исходные материалы и учитывайте местные законы. Для взрослого (18+) содержимого получите согласие участников и учитывайте местные законы. См. [Правила содержимого](../trust/Content-Rules.ru.md).

## Чему вы научитесь
Две части ролика соединяются через общий опорный кадр в одно длинное видео.

## Что понадобится
- Урок продолжает [Две опоры: первый и последний кадр](First-And-Last-Frame.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Ноды: ModelSamplingSD3, CLIP Text Encode (Prompt), Load VAE, Load Image, WanFirstLastFrameToVideo, KSampler (Advanced), VAE Decode / VAE Decode (Tiled), Create Video, Batch Images.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Прежде чем начать** (чтение)

   Оживлять так можно только того, кто на это согласен: себя, придуманного героя или человека, который разрешил. Получите разрешение на исходные материалы и учитывайте местные законы. Для взрослого (18+) содержимого получите согласие участников и учитывайте местные законы. Исключайте тех, кто младше 18 лет или так выглядит; обозначайте синтетические изображения, чтобы не вводить людей в заблуждение. Уроки учат технике без откровенных подробностей.

   Видеомодель делает несколько секунд за раз. Длинный ролик делается частями, и кадр, которым кончается одна часть, становится опорой, с которой начинается следующая. Этот урок добавляет вторую часть к графу урока «Две опоры: первый и последний кадр», как это делает официальный шаблон с шестью ключевыми кадрами.

   Цена: каждая часть стоит столько же, сколько весь прежний граф, поэтому две части делаются вдвое дольше. Память та же: части идут одна за другой.

2. **Нужна первая часть**

   На холсте должен быть граф урока «Две опоры: первый и последний кадр»: две ноды сдвига, промпты, **Load VAE**, картинка **Load Image** в конце ролика, **WanFirstLastFrameToVideo**, два сэмплера **KSampler (Advanced)** и **KSampler (Advanced)**, **VAE Decode** и **Create Video**. Если его нет, сначала пройдите тот урок.

3. **Загрузите следующий ключевой кадр**

   Добавьте ноду **Load Image** и выберите в `image` картинку, которой кончается вторая часть. Последняя картинка первой части становится началом второй.

4. **Начало второй части**

   Добавьте вторую ноду **WanFirstLastFrameToVideo**. Промпты и VAE подключите как у первой; **Load Image** подключите к её `start_image`, а **Load Image** к `end_image`. Поставьте `width`, `height` и `length` те же, что у первой.

   Общая картинка и есть шов: первая часть кончается на ней, вторая с неё начинается, и стык не прыгает.

5. **Два прохода для второй части**

   Добавьте ещё две ноды **KSampler (Advanced)**. Первая берёт модель `high_noise` через её ноду сдвига и три выхода ноды **WanFirstLastFrameToVideo**; вторая берёт модель `low_noise` через её ноду сдвига, промпты ноды **WanFirstLastFrameToVideo** и выход первой. Модели загружаются один раз и служат обеим частям.

6. **То же деление шагов**

   Дайте новой паре настройки первой части: `add_noise` `enable` и `disable`, те же `steps` и `cfg`, первая останавливается на том же `end_at_step`, с которого у второй `start_at_step`, `return_with_leftover_noise` `enable` и `disable`.

7. **Тот же сид**

   Поставьте `noise_seed` ноды **KSampler (Advanced)** тем же числом, что у **KSampler (Advanced)**.

   С тем же сидом и настройками части начинаются с одинакового шума, и цвет и фактура меньше меняются на шве. Неудачную часть всё равно можно переделать с другим сидом.

8. **Превратите вторую часть в кадры**

   Добавьте ноду **VAE Decode**. Ко входу `samples` подключите выход второго нового сэмплера, к `vae` VAE.

9. **Соедините части**

   Добавьте ноду **Batch Images**. Кадры ноды **VAE Decode** подключите к её входу `image1`, кадры **VAE Decode** к `image2`. Затем её выход подключите ко входу `images` ноды **Create Video** вместо одной первой части.

   Шаблон соединяет свои части нодой Batch Images так же. Общий ключевой кадр на шве повторяется дважды, и при 16 кадрах в секунду этого не видно.

10. **Почему цвет и лицо плывут от части к части и что их держит** (чтение)

   - Каждая часть видит только свои две опоры. Всё, чего на них нет (затылок, рука), в каждой части придумывается заново и немного иначе.
   - Что держит: один образец для всех частей (ключевые кадры из одной картинки или одна LoRA героя), одни и те же слова о герое в промпте, тот же сид и настройки.
   - Цвет: нода подгонки цвета после разворачивания приводит каждую часть к цветам одного опорного кадра. Это делает нода Color Match из KJNodes; официальный шаблон продления SCAIL подгоняет каждую часть к последнему кадру предыдущей.
   - Детали: лёгкий проход доработки по кадрам или увеличение склеенного ролика (урок «Видео крупнее и чётче: SeedVR2») сглаживает мелкие различия.

11. **Без ключевых кадров: последний кадр как следующая опора** (чтение)

   Если картинки для конца каждой части нет, возьмите последний кадр готовой части стартовой картинкой следующей: его выбирает Image From Batch с `batch_index` -1 и `length` 1. Следующая часть это обычная «картинка в видео» от этого кадра.

   Каждая передача идёт через развёрнутый кадр, и мелкие потери копятся: через несколько частей лицо и цвета плывут сильнее, чем с ключевыми кадрами. Держите цепочку короткой или сохраняйте каждую часть через Save Video и склейте файлы потом в видеоредакторе.

12. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Нужна первая часть**:
  - нода **ModelSamplingSD3**.
  - нода **ModelSamplingSD3**.
  - нода **CLIP Text Encode (Prompt)**.
  - нода **CLIP Text Encode (Prompt)**.
  - нода **Load VAE**.
  - нода **Load Image**.
  - нода **WanFirstLastFrameToVideo**.
  - нода **KSampler (Advanced)**.
  - нода **KSampler (Advanced)**.
  - нода **VAE Decode** или **VAE Decode (Tiled)**.
  - нода **Create Video**.
  - `IMAGE` ноды **Load Image** (последний кадр первой части) во вход `end_image` ноды **WanFirstLastFrameToVideo** (старт первой части) (можно через Upscale Image или Upscale Image By или ImageFromBatch или ImageResizeKJv2 или Resize Image или GetImageRangeFromBatch или ResizeImageMaskNode).
  - `latent` ноды **WanFirstLastFrameToVideo** (старт первой части) во вход `latent_image` ноды **KSampler (Advanced)** (первая часть, первый проход).
  - `LATENT` ноды **KSampler (Advanced)** (первая часть, первый проход) во вход `latent_image` ноды **KSampler (Advanced)** (первая часть, второй проход).
  - `LATENT` ноды **KSampler (Advanced)** (первая часть, второй проход) во вход `samples` ноды **VAE Decode** или **VAE Decode (Tiled)** (первая часть).
- Шаг 3, **Загрузите следующий ключевой кадр**:
  - нода **Load Image**.
  - `image` ноды **Load Image** (следующий ключевой кадр): не тот же файл, что в поле `image` ноды **Load Image** (последний кадр первой части).
- Шаг 4, **Начало второй части**:
  - нода **WanFirstLastFrameToVideo**.
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (промпт) во вход `positive` ноды **WanFirstLastFrameToVideo** (старт второй части).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (негатив) во вход `negative` ноды **WanFirstLastFrameToVideo** (старт второй части).
  - `VAE` ноды **Load VAE** во вход `vae` ноды **WanFirstLastFrameToVideo** (старт второй части).
  - `IMAGE` ноды **Load Image** (последний кадр первой части) во вход `start_image` ноды **WanFirstLastFrameToVideo** (старт второй части) (можно через Upscale Image или Upscale Image By или ImageFromBatch или ImageResizeKJv2 или Resize Image или GetImageRangeFromBatch или ResizeImageMaskNode).
  - `IMAGE` ноды **Load Image** (следующий ключевой кадр) во вход `end_image` ноды **WanFirstLastFrameToVideo** (старт второй части) (можно через Upscale Image или Upscale Image By или ImageFromBatch или ImageResizeKJv2 или Resize Image или GetImageRangeFromBatch или ResizeImageMaskNode).
  - `width` ноды **WanFirstLastFrameToVideo** (старт второй части) равно полю `width` ноды **WanFirstLastFrameToVideo** (старт первой части).
  - `height` ноды **WanFirstLastFrameToVideo** (старт второй части) равно полю `height` ноды **WanFirstLastFrameToVideo** (старт первой части).
  - `length` ноды **WanFirstLastFrameToVideo** (старт второй части) равно полю `length` ноды **WanFirstLastFrameToVideo** (старт первой части).
- Шаг 5, **Два прохода для второй части**:
  - нода **KSampler (Advanced)**.
  - нода **KSampler (Advanced)**.
  - `MODEL` ноды **ModelSamplingSD3** (сдвиг первого прохода) во вход `model` ноды **KSampler (Advanced)** (вторая часть, первый проход) (можно через LoraLoaderModelOnly или EasyCache).
  - `positive` ноды **WanFirstLastFrameToVideo** (старт второй части) во вход `positive` ноды **KSampler (Advanced)** (вторая часть, первый проход).
  - `negative` ноды **WanFirstLastFrameToVideo** (старт второй части) во вход `negative` ноды **KSampler (Advanced)** (вторая часть, первый проход).
  - `latent` ноды **WanFirstLastFrameToVideo** (старт второй части) во вход `latent_image` ноды **KSampler (Advanced)** (вторая часть, первый проход).
  - `MODEL` ноды **ModelSamplingSD3** (сдвиг второго прохода) во вход `model` ноды **KSampler (Advanced)** (вторая часть, второй проход) (можно через LoraLoaderModelOnly или EasyCache).
  - `positive` ноды **WanFirstLastFrameToVideo** (старт второй части) во вход `positive` ноды **KSampler (Advanced)** (вторая часть, второй проход).
  - `negative` ноды **WanFirstLastFrameToVideo** (старт второй части) во вход `negative` ноды **KSampler (Advanced)** (вторая часть, второй проход).
  - `LATENT` ноды **KSampler (Advanced)** (вторая часть, первый проход) во вход `latent_image` ноды **KSampler (Advanced)** (вторая часть, второй проход).
- Шаг 6, **То же деление шагов**:
  - `add_noise` ноды **KSampler (Advanced)** (вторая часть, первый проход): `enable`.
  - `steps` ноды **KSampler (Advanced)** (вторая часть, первый проход) равно полю `steps` ноды **KSampler (Advanced)** (первая часть, первый проход).
  - `cfg` ноды **KSampler (Advanced)** (вторая часть, первый проход) равно полю `cfg` ноды **KSampler (Advanced)** (первая часть, первый проход).
  - `end_at_step` ноды **KSampler (Advanced)** (вторая часть, первый проход) равно полю `end_at_step` ноды **KSampler (Advanced)** (первая часть, первый проход).
  - `return_with_leftover_noise` ноды **KSampler (Advanced)** (вторая часть, первый проход): `enable`.
  - `add_noise` ноды **KSampler (Advanced)** (вторая часть, второй проход): `disable`.
  - `steps` ноды **KSampler (Advanced)** (вторая часть, второй проход) равно полю `steps` ноды **KSampler (Advanced)** (первая часть, первый проход).
  - `cfg` ноды **KSampler (Advanced)** (вторая часть, второй проход) равно полю `cfg` ноды **KSampler (Advanced)** (первая часть, первый проход).
  - `start_at_step` ноды **KSampler (Advanced)** (вторая часть, второй проход) равно полю `end_at_step` ноды **KSampler (Advanced)** (вторая часть, первый проход).
  - `return_with_leftover_noise` ноды **KSampler (Advanced)** (вторая часть, второй проход): `disable`.
- Шаг 7, **Тот же сид**:
  - `noise_seed` ноды **KSampler (Advanced)** (вторая часть, первый проход) равно полю `noise_seed` ноды **KSampler (Advanced)** (первая часть, первый проход).
- Шаг 8, **Превратите вторую часть в кадры**:
  - нода **VAE Decode** или **VAE Decode (Tiled)**.
  - `LATENT` ноды **KSampler (Advanced)** (вторая часть, второй проход) во вход `samples` ноды **VAE Decode** или **VAE Decode (Tiled)** (вторая часть).
  - `VAE` ноды **Load VAE** во вход `vae` ноды **VAE Decode** или **VAE Decode (Tiled)** (вторая часть).
- Шаг 9, **Соедините части**:
  - нода **Batch Images**.
  - `IMAGE` ноды **VAE Decode** или **VAE Decode (Tiled)** (первая часть) во вход `image1` ноды **Batch Images**.
  - `IMAGE` ноды **VAE Decode** или **VAE Decode (Tiled)** (вторая часть) во вход `image2` ноды **Batch Images**.
  - `IMAGE` ноды **Batch Images** во вход `images` ноды **Create Video**.

## См. также
- [Первый и последний кадр](../concepts/First-And-Last-Frame.ru.md)
- [Длина видео и частота кадров](../concepts/Video-Length-And-Frame-Rate.ru.md)
- [Правила содержимого](../trust/Content-Rules.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
