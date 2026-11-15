[English](Wrapper-VACE.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# VACE: движение из другого видео

<!-- lesson: wrapper-vace -->
Урок «wrapper-vace» в группе **WanVideoWrapper** списка уроков. Шагов: 10.

## Чему вы научитесь
Ролик на WanVideoWrapper повторит движение, глубину или контуры другого видео.

## Что понадобится
- Урок продолжает [Видео на WanVideoWrapper](Wrapper.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Файлы моделей, которые урок проверяет:
  - модуль VACE для модели high_noise: `models/diffusion_models`, например `Wan2_2_Fun_VACE_module_A14B_HIGH_fp8_e4m3fn_scaled_KJ.safetensors`;
  - модуль VACE для модели low_noise: `models/diffusion_models`, например `Wan2_2_Fun_VACE_module_A14B_LOW_fp8_e4m3fn_scaled_KJ.safetensors`.
- Ноды: WanVideo Model Loader, WanVideo VAE Loader, WanVideo Sampler, WanVideo VACE Module Select, Load Video, Get Video Components, WanVideo VACE Encode.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что такое VACE** (чтение)

   Модуль VACE учит Wan брать подсказку из готового видео. Подсказкой может быть само видео, карта глубины, поза человека или контуры, сделанные из его кадров. Промпт говорит, что нарисовать, а подсказка говорит, как это движется и где стоит.

   Так переносят движение танцора на другого героя, меняют стиль ролика, сохраняя его движение, или задают движение камеры по примеру.

   Урок продолжает граф из урока «Видео на WanVideoWrapper».

2. **Нужен граф на WanVideoWrapper**

   На холсте должны быть два загрузчика **WanVideo Model Loader**, нода **WanVideo VAE Loader** и два сэмплера **WanVideo Sampler**, второй из которых берёт результат первого. Это граф из урока «Видео на WanVideoWrapper».

   Если его нет, сначала пройдите тот урок.

3. **Добавьте модуль VACE к обеим моделям**

   Добавьте две ноды **WanVideo VACE Module Select**. В поле `vace_model` одной выберите модуль VACE для модели `high_noise`, в другой для `low_noise`. Выход `extra_model` каждой подключите ко входу `extra_model` своего загрузчика модели.

   Модуль сделан под свою модель: для Wan 2.2 их два, для Wan 2.1 один. Он лежит в той же папке, что и модели.

   Если нужного файла в списке нет, значит, его нет в вашем ComfyUI. Приложение ничего не скачивает. Проще всего открыть в самом ComfyUI пример графа с VACE из папки `example_workflows` пака: он покажет, каких файлов не хватает и куда их положить. Потом выберите здесь в меню «Синхронизация ▸ Синхронизировать сейчас», и файлы появятся в списках.

4. **Загрузите видео-подсказку**

   Добавьте ноды **Load Video** и **Get Video Components**. В поле `file` выберите видео, движение которого нужно повторить. Выход ноды **Load Video** подключите ко входу `video` ноды **Get Video Components**: она разбирает видео на кадры.

   В списке видны видео из папки `input` вашего ComfyUI.

5. **Кадры, глубина, поза или контуры** (чтение)

   Кадры можно отдать VACE как есть: тогда модель держится за всё сразу, за форму, цвет и движение. Чаще из кадров сначала делают одну подсказку:
   - карта глубины держит расстановку и движение, а внешность оставляет промпту;
   - поза держит движение человека и не держит его одежду и лицо;
   - контуры держат форму предметов.

   Такие ноды есть в паке comfyui_controlnet_aux: Depth Anything, OpenPose, DWPose, Canny, Lineart. Их ставят между нодой **Get Video Components** и VACE: выход с кадрами в их вход, их выход дальше. Урок засчитает и прямую связь, и связь через них.

6. **Подготовьте подсказку для модели**

   Добавьте ноду **WanVideo VACE Encode**. Ко входу `vae` подключите выход ноды **WanVideo VAE Loader**, ко входу `input_frames` кадры из ноды **Get Video Components** или из ноды, которая сделала из них подсказку.

   Поставьте `num_frames` 81, `width` и `height` как у ролика. Поле `strength` задаёт силу подсказки: начните с 1.

7. **Отдайте подсказку обоим сэмплерам**

   Выход `vace_embeds` ноды **WanVideo VACE Encode** подключите ко входу `image_embeds` обоих сэмплеров.

   Прежние связи от пустой заготовки снимутся сами. Ноду пустой заготовки после этого можно удалить: размер и длину теперь задаёт нода VACE.

8. **Картинка-образец** (чтение)

   У ноды **WanVideo VACE Encode** есть вход `ref_images`: картинка того, кто или что должно быть в ролике. Подключите к нему ноду с картинкой, и модель будет держать этот вид всё время.

   Лучше всего работает картинка на однотонном фоне, без лишних предметов.

9. **Насколько слушаться подсказку** (чтение)

   Три поля ноды **WanVideo VACE Encode** решают, как сильно подсказка держит ролик:
   - `strength`: ниже 1 даёт модели больше свободы, выше 1 держит строже;
   - `vace_start_percent` и `vace_end_percent`: на какой доле шагов подсказка действует. Если поставить `vace_end_percent` 0.5, подсказка задаст начало, а доводить мелочи модель будет сама.

   Если ролик повторяет подсказку слишком буквально, со всеми её недостатками, снижайте `strength` или `vace_end_percent`.

10. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Длина ролика не больше длины видео-подсказки. Если видео короче, уменьшите `num_frames`.

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
- Шаг 3, **Добавьте модуль VACE к обеим моделям**:
  - нода **WanVideo VACE Module Select**.
  - нода **WanVideo VACE Module Select**.
  - `extra_model` ноды **WanVideo VACE Module Select** (VACE для первого прохода) во вход `extra_model` ноды **WanVideo Model Loader** (первый проход).
  - `extra_model` ноды **WanVideo VACE Module Select** (VACE для второго прохода) во вход `extra_model` ноды **WanVideo Model Loader** (второй проход).
  - в поле `vace_model` ноды **WanVideo VACE Module Select** (VACE для первого прохода) стоит файл такого вида: модуль VACE для модели high_noise; такой файл лежит в `models/diffusion_models`, например `Wan2_2_Fun_VACE_module_A14B_HIGH_fp8_e4m3fn_scaled_KJ.safetensors`.
  - `vace_model` ноды **WanVideo VACE Module Select** (VACE для второго прохода): не тот же файл, что в поле `vace_model` ноды **WanVideo VACE Module Select** (VACE для первого прохода).
  - в поле `vace_model` ноды **WanVideo VACE Module Select** (VACE для второго прохода) стоит файл такого вида: модуль VACE для модели low_noise; такой файл лежит в `models/diffusion_models`, например `Wan2_2_Fun_VACE_module_A14B_LOW_fp8_e4m3fn_scaled_KJ.safetensors`.
- Шаг 4, **Загрузите видео-подсказку**:
  - нода **Load Video**.
  - нода **Get Video Components**.
  - `VIDEO` ноды **Load Video** во вход `video` ноды **Get Video Components**.
  - `file` ноды **Load Video**: значение выбрано.
- Шаг 6, **Подготовьте подсказку для модели**:
  - нода **WanVideo VACE Encode**.
  - `vae` ноды **WanVideo VAE Loader** во вход `vae` ноды **WanVideo VACE Encode**.
  - `images` ноды **Get Video Components** во вход `input_frames` ноды **WanVideo VACE Encode** (можно через Depth Anything V2 - Relative или DepthAnythingPreprocessor или MiDaS-DepthMapPreprocessor или OpenPose Pose или DWPreprocessor или Canny Edge или LineArtPreprocessor или AnyLineArtPreprocessor_aux или Upscale Image или Resize Image).
  - `num_frames` ноды **WanVideo VACE Encode**: от 49 до 121, число кадров вида 4n + 1; «Сделать за меня» ставит 81. Почему: wan берёт число кадров вида 4n + 1: 49, 81, 121. 81 кадр при 16 в секунду даёт пять секунд.
  - `strength` ноды **WanVideo VACE Encode**: от 0.5 до 1.5; «Сделать за меня» ставит 1. Почему: сила подсказки: с 1 модель держится за неё обычным образом, и от неё удобно подбирать.
- Шаг 7, **Отдайте подсказку обоим сэмплерам**:
  - `WANVIDIMAGE_EMBEDS` ноды **WanVideo VACE Encode** во вход `image_embeds` ноды **WanVideo Sampler** (первый проход).
  - `WANVIDIMAGE_EMBEDS` ноды **WanVideo VACE Encode** во вход `image_embeds` ноды **WanVideo Sampler** (второй проход).

## Частые ошибки
- Один и тот же модуль для обеих моделей.
- Видео-подсказка короче `num_frames`.
- Подсказка слишком буквальная (повторяет огрехи): снизьте `strength` или `vace_end_percent`.

## См. также
- [Как устроены уроки](How-Lessons-Work.ru.md)
- [Видео из видео](../concepts/Video-To-Video.ru.md)
- [ControlNet и препроцессоры](../concepts/ControlNet.ru.md)
- [Анимация по позе](../concepts/Pose-Animation.ru.md)
- [Паки нод](../concepts/Node-Packs.ru.md)
