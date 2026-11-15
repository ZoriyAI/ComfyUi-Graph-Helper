[English](Wrapper-Image.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Видео из картинки на WanVideoWrapper

<!-- lesson: wrapper-image -->
Урок «wrapper-image» в группе **WanVideoWrapper** списка уроков. Шагов: 8.

## Чему вы научитесь
Ролик на нодах WanVideoWrapper начнётся с вашей картинки.

## Что понадобится
- Урок продолжает [Видео на WanVideoWrapper](Wrapper.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Файлы моделей, которые урок проверяет:
  - половина high_noise модели Wan 2.2 «картинка в видео» (i2v): `models/diffusion_models`, например `wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors`;
  - половина low_noise модели Wan 2.2 «картинка в видео» (i2v): `models/diffusion_models`, например `wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors`.
- Ноды: WanVideo Model Loader, WanVideo VAE Loader, WanVideo Sampler, Load Image, WanVideo ImageToVideo Encode.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что меняется** (чтение)

   Граф тот же, что в уроке «Видео на WanVideoWrapper». Меняются три вещи: файлы моделей, нода с картинкой и нода, которая вкладывает картинку в начало ролика вместо пустой заготовки.

2. **Нужен граф на WanVideoWrapper**

   Этот урок продолжает граф из урока «Видео на WanVideoWrapper». На холсте должны быть два загрузчика **WanVideo Model Loader**, нода **WanVideo VAE Loader** и два сэмплера **WanVideo Sampler**, второй из которых берёт результат первого.

   Если их нет, сначала пройдите тот урок.

3. **Модели для картинки**

   В поле `model` обоих загрузчиков выберите файлы `i2v`: один со словами `high_noise`, другой со словами `low_noise`.

   Модели `t2v` картинку на вход не принимают. Остальное в графе не меняется.

4. **Загрузите картинку**

   Добавьте ноду **Load Image** и выберите в поле `image` свою картинку. В списке видны файлы из папки `input` вашего ComfyUI.

5. **Подготовьте старт**

   Добавьте ноду **WanVideo ImageToVideo Encode** и подключите к ней:
   - ко входу `vae` выход ноды **WanVideo VAE Loader**;
   - ко входу `start_image` выход `IMAGE` ноды **Load Image**.

   Поставьте `width` 832, `height` 480 и `num_frames` 81. Пропорции лучше взять такие же, как у картинки.

6. **Подключите старт к сэмплерам**

   Выход `image_embeds` ноды **WanVideo ImageToVideo Encode** подключите ко входу `image_embeds` обоих сэмплеров.

   Прежние связи от пустой заготовки снимутся сами. Ноду пустой заготовки после этого можно удалить.

7. **Как добавить движения** (чтение)

   Если ролик почти стоит на месте, в ноде **WanVideo ImageToVideo Encode** есть два поля, которые это меняют:
   - `noise_aug_strength`: немного шума поверх картинки, например 0.02, даёт модели свободу двигать;
   - `start_latent_strength`: значение меньше 1, например 0.8, меньше держит первый кадр.

   Меняйте по одному полю за раз. Слишком большие значения уводят ролик от картинки.

   Ещё у ноды есть вход `end_image`: картинка для последнего кадра. Для него нужны модели, которые этому обучены. Страница модели говорит, умеет ли она.

8. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Промпт для ролика из картинки говорит о том, что меняется, а не о том, что уже видно. Подробнее в уроке «Промпт для видео».

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Нужен граф на WanVideoWrapper**:
  - нода **WanVideo Model Loader**.
  - нода **WanVideo Model Loader**.
  - нода **WanVideo VAE Loader**.
  - нода **WanVideo Sampler**.
  - нода **WanVideo Sampler**.
  - `model` ноды **WanVideo Model Loader** (первый проход) во вход `model` ноды **WanVideo Sampler** (первый проход).
  - `model` ноды **WanVideo Model Loader** (второй проход) во вход `model` ноды **WanVideo Sampler** (второй проход).
  - `samples` ноды **WanVideo Sampler** (первый проход) во вход `samples` ноды **WanVideo Sampler** (второй проход).
- Шаг 3, **Модели для картинки**:
  - в поле `model` ноды **WanVideo Model Loader** (первый проход) стоит файл такого вида: половина high_noise модели Wan 2.2 «картинка в видео» (i2v); такой файл лежит в `models/diffusion_models`, например `wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors`.
  - в поле `model` ноды **WanVideo Model Loader** (второй проход) стоит файл такого вида: половина low_noise модели Wan 2.2 «картинка в видео» (i2v); такой файл лежит в `models/diffusion_models`, например `wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors`.
- Шаг 4, **Загрузите картинку**:
  - нода **Load Image**.
  - `image` ноды **Load Image**: значение выбрано.
- Шаг 5, **Подготовьте старт**:
  - нода **WanVideo ImageToVideo Encode**.
  - `vae` ноды **WanVideo VAE Loader** во вход `vae` ноды **WanVideo ImageToVideo Encode**.
  - `IMAGE` ноды **Load Image** во вход `start_image` ноды **WanVideo ImageToVideo Encode**.
  - `num_frames` ноды **WanVideo ImageToVideo Encode**: от 49 до 121, число кадров вида 4n + 1; «Сделать за меня» ставит 81. Почему: wan берёт число кадров вида 4n + 1: 49, 81, 121. 81 кадр при 16 в секунду даёт пять секунд.
- Шаг 6, **Подключите старт к сэмплерам**:
  - `image_embeds` ноды **WanVideo ImageToVideo Encode** во вход `image_embeds` ноды **WanVideo Sampler** (первый проход).
  - `image_embeds` ноды **WanVideo ImageToVideo Encode** во вход `image_embeds` ноды **WanVideo Sampler** (второй проход).

## Частые ошибки
- Оставить один сэмплер на пустых embeds.
- Поднять оба поля движения сразу: ролик уходит от картинки.

## См. также
- [Как устроены уроки](How-Lessons-Work.ru.md)
- [Урок: Видео из картинки](Video-Image.ru.md)
- [Первый и последний кадр](../concepts/First-And-Last-Frame.ru.md)
- [Модели для видео](../concepts/Video-Models.ru.md)
