[English](Image-To-Image.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Картинка из картинки

<!-- lesson: img2img -->
Урок «img2img» в группе **Картинки: приёмы** списка уроков. Шагов: 9.

## Чему вы научитесь
Ваша картинка становится новой: та же композиция, заново нарисованная моделью по описанию.

## Что понадобится
- Урок продолжает [Первая картинка из текста](Image.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Ноды: Load Checkpoint, CLIP Text Encode (Prompt), KSampler, VAE Decode, Save Image / Preview Image, Load Image, Scale Image to Total Pixels, VAE Encode.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что такое «картинка из картинки»** (чтение)

   Здесь модель начинает не с пустого шума, а с вашей картинки. Картинку переводят в сжатый вид, с которым работает модель, в латент; к нему добавляют часть шума, и сэмплер убирает этот шум по вашему описанию.

   Сколько шума добавить, задаёт `denoise`. При 1 от картинки ничего не остаётся. При 0.3 меняются только мелкие детали. Между ними композиция остаётся, а остальное рисуется заново.

   Урок добавляет три ноды к графу из урока «Первая картинка из текста».

2. **Нужен граф с картинкой**

   Этот урок продолжает граф из урока «Первая картинка из текста». На холсте должны быть **Load Checkpoint**, два текста **CLIP Text Encode (Prompt)** и **CLIP Text Encode (Prompt)**, **KSampler**, **VAE Decode** и **Save Image** со связями между ними.

   Если их нет, сначала пройдите тот урок.

3. **Загрузите свою картинку**

   Добавьте ноду **Load Image** и выберите картинку в её поле `image`. ComfyUI берёт картинки из своей папки `input`; кнопка на ноде загружает картинку туда.

   Композиция, цвета и свет результата придут из этой картинки.

4. **Приведите картинку к размеру, который знает модель**

   Добавьте ноду **Scale Image to Total Pixels** и подключите выход `IMAGE` ноды **Load Image** к её входу `image`. В поле `megapixels` поставьте 1.

   Модель лучше всего рисует в том размере, на котором её учили. Один мегапиксель это около 1024 × 1024, как раз для SDXL и более новых моделей. Для модели SD 1.5 поставьте 0.25, это 512 × 512. Снимок с телефона во много раз больше, и модель начала бы повторять его части.

5. **Переведите картинку в латент**

   Добавьте ноду **VAE Encode**. Ко входу `pixels` подключите выход ноды **Scale Image to Total Pixels**, ко входу `vae` выход `VAE` ноды **Load Checkpoint**.

   Сэмплер работает не с пикселями, а с их сжатым видом. Эта нода сжимает картинку тем VAE, который принадлежит рисующей модели.

6. **Отдайте сэмплеру свою картинку**

   Подключите выход ноды **VAE Encode** ко входу `latent_image` ноды **KSampler**. Связь от пустого латента заменится: во вход идёт только одна связь.

   Пустой латент больше не нужен. Оставьте его или удалите: ComfyUI не запускает ноду, выход которой никуда не идёт.

7. **Решите, сколько рисовать заново**

   Поставьте `denoise` ноды **KSampler** на 0.6.

   При 0.6 композиция и крупные формы остаются, а фактуры, лица и стиль следуют описанию. Опустите до 0.4, когда результат должен остаться близким к исходнику. Поднимите до 0.8, когда важна только раскладка.

   Описывайте, что должно быть на картинке, а не что поменять: модель не сравнивает, а рисует.

8. **Сравнивайте варианты честно** (чтение)

   Чтобы увидеть, что делает одна настройка, меняйте только её. Под полем `seed` ноды **KSampler** поставьте «control after generate» в `fixed`: шум тогда одинаков от запуска к запуску, и разницу даёт только то, что вы поменяли. С `randomize` каждый запуск начинается с нового шума, и вы сравниваете удачу, а не настройки.

   Несколько вариантов за один запуск: в графе из текста это `batch_size` пустого латента, здесь нода Repeat Latent Batch между **VAE Encode** и **KSampler**. Каждая картинка пачки получает свой шум из того же `seed`.

9. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Что попробовать: `denoise` 0.4 и 0.8 при одном `seed`; рисунок или набросок вместо картинки и описание фотографии.

   Save Image записывает в сохраняемый PNG весь граф вместе с описаниями: картинка, перетащенная в ComfyUI, снова открывает граф. Прежде чем делиться картинкой, граф которой должен остаться при вас, переведите её в другой формат или запустите ComfyUI с параметром `--disable-metadata`, тогда граф в файлы не пишется.

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
- Шаг 3, **Загрузите свою картинку**:
  - нода **Load Image**.
  - `image` ноды **Load Image**: значение выбрано.
- Шаг 4, **Приведите картинку к размеру, который знает модель**:
  - нода **Scale Image to Total Pixels**.
  - `IMAGE` ноды **Load Image** во вход `image` ноды **Scale Image to Total Pixels**.
  - `megapixels` ноды **Scale Image to Total Pixels**: от 0.2 до 2; «Сделать за меня» ставит 1.
- Шаг 5, **Переведите картинку в латент**:
  - нода **VAE Encode**.
  - `IMAGE` ноды **Scale Image to Total Pixels** во вход `pixels` ноды **VAE Encode**.
  - `VAE` ноды **Load Checkpoint** во вход `vae` ноды **VAE Encode**.
- Шаг 6, **Отдайте сэмплеру свою картинку**:
  - `LATENT` ноды **VAE Encode** во вход `latent_image` ноды **KSampler**.
- Шаг 7, **Решите, сколько рисовать заново**:
  - `denoise` ноды **KSampler**: от 0.3 до 0.9; «Сделать за меня» ставит 0.6.

## Что дальше
Этот урок продолжают: [Инпейнтинг: перерисовать часть картинки](Inpainting.ru.md).

## См. также
- [Картинка из картинки](../concepts/Image-To-Image.ru.md)
- [Denoise](../concepts/Denoise.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
