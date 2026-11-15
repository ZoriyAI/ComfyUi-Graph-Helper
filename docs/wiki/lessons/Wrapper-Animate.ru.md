[English](Wrapper-Animate.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Анимация по позе: Wan Animate

<!-- lesson: wrapper-animate -->
Урок «wrapper-animate» в группе **WanVideoWrapper** списка уроков. Шагов: 14.

## Сначала согласие
Оживлять так можно только того, кто на это согласен: себя, придуманного героя или человека, который разрешил. Получите разрешение на исходные материалы и учитывайте местные законы. См. [Правила содержимого](../trust/Content-Rules.ru.md).

## Чему вы научитесь
Герой с вашей картинки повторит движения и мимику человека из видео.

## Что понадобится
- Файлы моделей, которые урок проверяет:
  - модель Wan 2.2 Animate: `models/diffusion_models`, например `Wan2_2-Animate-14B_fp8_e4m3fn_scaled_KJ.safetensors`;
  - чтение текста Wan, umt5-xxl: `models/text_encoders`, например `umt5_xxl_fp8_e4m3fn_scaled.safetensors`;
  - VAE от Wan 2.1 (wan_2.1_vae): `models/vae`, например `wan_2.1_vae.safetensors`;
  - файл clip_vision_h: `models/clip_vision`, например `clip_vision_h.safetensors`;
  - модель позы ViTPose: `models/detection`, например `vitpose-l-wholebody.onnx`;
  - модель поиска людей YOLO: `models/detection`, например `yolov10m.onnx`.
- Ноды: WanVideo Model Loader, WanVideo T5 Text Encoder Loader, WanVideo VAE Loader, WanVideo TextEncode, Load Image, Load CLIP Vision, WanVideo ClipVision Encode, Load Video, Get Video Components, ONNX Detection Model Loader, Pose and Face Detection, Draw ViT Pose, WanVideo Animate Embeds, WanVideo Sampler, WanVideo Decode, Create Video, Save Video.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что делает Wan Animate** (чтение)

   Wan 2.2 Animate берёт картинку с героем и видео с движущимся человеком. Особые ноды вынимают из каждого кадра видео позу и лицо, а модель рисует вашего героя в этих позах и с этой мимикой.

   Оживлять так можно только того, кто на это согласен: себя, придуманного героя или человека, который разрешил. Получите разрешение на исходные материалы и учитывайте местные законы.

   Это отдельная модель одним файлом, не пара `high` и `low`. Урок собирает граф с пустого холста: «Файл ▸ Новый проект».

2. **Загрузите модель Animate**

   Добавьте ноду **WanVideo Model Loader** и выберите в поле `model` файл Wan 2.2 Animate.

   Если нужного файла в списке нет, значит, его нет в вашем ComfyUI. Приложение ничего не скачивает. Проще всего открыть в самом ComfyUI пример графа Animate из папки `example_workflows` пака WanVideoWrapper: он покажет, каких файлов не хватает и куда их положить. Потом выберите здесь в меню «Синхронизация ▸ Синхронизировать сейчас», и файлы появятся в списках.

3. **Чтение текста и VAE**

   Добавьте ноды **WanVideo T5 Text Encoder Loader** и **WanVideo VAE Loader**. В поле `model_name` первой выберите файл `umt5-xxl-enc`, второй файл `wan_2.1_vae`. Это те же файлы, что в уроке «Видео на WanVideoWrapper».

4. **Коротко опишите сцену**

   Добавьте ноду **WanVideo TextEncode** и подключите ко входу `t5` выход ноды **WanVideo T5 Text Encoder Loader**. В поле `positive_prompt` опишите героя и место парой предложений.

   Движение здесь задаёт видео, поэтому промпт короче, чем обычно.

5. **Загрузите картинку с героем**

   Добавьте ноду **Load Image** и выберите в поле `image` картинку с героем. Лучше всего подходит герой во весь рост или по пояс, лицом к камере, без лишних людей рядом.

6. **Покажите картинку модели**

   Добавьте ноды **Load CLIP Vision** и **WanVideo ClipVision Encode**. В поле `clip_name` первой выберите файл `clip_vision_h`. Её выход подключите ко входу `clip_vision` второй, а картинку ко входу `image_1`.

   Так модель видит, как выглядит герой, а не только читает о нём.

7. **Загрузите видео с движением**

   Добавьте ноды **Load Video** и **Get Video Components**. В поле `file` выберите видео с человеком, движения которого нужно повторить. Выход ноды **Load Video** подключите ко входу `video` ноды **Get Video Components**.

   Модель рисует 16 кадров в секунду. Если видео снято с другой частотой, движение в ролике пойдёт быстрее или медленнее.

8. **Выньте позу и лицо**

   Добавьте три ноды пака ComfyUI-WanAnimatePreprocess: **ONNX Detection Model Loader**, **Pose and Face Detection** и **Draw ViT Pose**.
   - В **ONNX Detection Model Loader** выберите в поле `vitpose_model` модель позы ViTPose, в поле `yolo_model` модель поиска людей YOLO. Обе лежат в папке `detection`.
   - Её выход `model` ко входу `model` ноды **Pose and Face Detection**, кадры ко входу `images`.
   - Выход `pose_data` ноды **Pose and Face Detection** ко входу `pose_data` ноды **Draw ViT Pose**: она рисует позы человечками.

9. **Соберите старт ролика**

   Добавьте ноду **WanVideo Animate Embeds** и подключите к ней:
   - ко входу `vae` выход ноды **WanVideo VAE Loader**;
   - ко входу `ref_images` картинку с героем;
   - ко входу `pose_images` выход ноды **Draw ViT Pose**;
   - ко входу `face_images` выход `face_images` ноды **Pose and Face Detection**;
   - ко входу `clip_embeds` выход ноды **WanVideo ClipVision Encode**.

   Поставьте `num_frames` 81, `width` и `height` как у ролика.

10. **Добавьте сэмплер**

   Добавьте ноду **WanVideo Sampler**. Ко входу `model` подключите модель, ко входу `text_embeds` промпт, ко входу `image_embeds` выход ноды **WanVideo Animate Embeds**.

   Сэмплер здесь один: модель одна, без разделения на два прохода. Числа `steps` и `cfg` возьмите со страницы модели. С ускоряющей LoRA обычно ставят `steps` 6 и `cfg` 1.

11. **Превратите результат в кадры**

   Добавьте ноду **WanVideo Decode**. Ко входу `samples` подключите выход сэмплера, ко входу `vae` выход ноды **WanVideo VAE Loader**.

12. **Сохраните ролик**

   Добавьте ноды **Create Video** и **Save Video**, кадры в `images`, ролик в `video`. В поле `fps` поставьте 16.

13. **Если результат не тот** (чтение)

   Что менять в ноде **WanVideo Animate Embeds**:
   - герой повторяет позу слишком жёстко или ломается: снизьте `pose_strength` до 0.8;
   - мимика чужая или застывшая: поменяйте `face_strength`;
   - от куска к куску меняется цвет: поставьте в `colormatch` значение `mkl`;
   - ролик длиннее 77 кадров модель делает кусками: поле `frame_window_size` задаёт их длину.

   Пропорции картинки, ролика и видео-образца лучше держать одинаковыми.

14. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Первый запуск долгий: кроме самой модели загружаются модели позы.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Загрузите модель Animate**:
  - нода **WanVideo Model Loader**.
  - в поле `model` ноды **WanVideo Model Loader** стоит файл такого вида: модель Wan 2.2 Animate; такой файл лежит в `models/diffusion_models`, например `Wan2_2-Animate-14B_fp8_e4m3fn_scaled_KJ.safetensors`.
- Шаг 3, **Чтение текста и VAE**:
  - нода **WanVideo T5 Text Encoder Loader**.
  - нода **WanVideo VAE Loader**.
  - в поле `model_name` ноды **WanVideo T5 Text Encoder Loader** стоит файл такого вида: чтение текста Wan, umt5-xxl; такой файл лежит в `models/text_encoders`, например `umt5_xxl_fp8_e4m3fn_scaled.safetensors`.
  - в поле `model_name` ноды **WanVideo VAE Loader** стоит файл такого вида: VAE от Wan 2.1 (wan_2.1_vae); такой файл лежит в `models/vae`, например `wan_2.1_vae.safetensors`.
- Шаг 4, **Коротко опишите сцену**:
  - нода **WanVideo TextEncode**.
  - `wan_t5_model` ноды **WanVideo T5 Text Encoder Loader** во вход `t5` ноды **WanVideo TextEncode**.
  - `positive_prompt` ноды **WanVideo TextEncode**: не меньше 3 знаков и 2 настоящих слов.
- Шаг 5, **Загрузите картинку с героем**:
  - нода **Load Image**.
  - `image` ноды **Load Image**: значение выбрано.
- Шаг 6, **Покажите картинку модели**:
  - нода **Load CLIP Vision**.
  - нода **WanVideo ClipVision Encode**.
  - `CLIP_VISION` ноды **Load CLIP Vision** во вход `clip_vision` ноды **WanVideo ClipVision Encode**.
  - `IMAGE` ноды **Load Image** во вход `image_1` ноды **WanVideo ClipVision Encode**.
  - в поле `clip_name` ноды **Load CLIP Vision** стоит файл такого вида: файл clip_vision_h; такой файл лежит в `models/clip_vision`, например `clip_vision_h.safetensors`.
- Шаг 7, **Загрузите видео с движением**:
  - нода **Load Video**.
  - нода **Get Video Components**.
  - `VIDEO` ноды **Load Video** во вход `video` ноды **Get Video Components**.
  - `file` ноды **Load Video**: значение выбрано.
- Шаг 8, **Выньте позу и лицо**:
  - нода **ONNX Detection Model Loader**.
  - нода **Pose and Face Detection**.
  - нода **Draw ViT Pose**.
  - `model` ноды **ONNX Detection Model Loader** во вход `model` ноды **Pose and Face Detection**.
  - `images` ноды **Get Video Components** во вход `images` ноды **Pose and Face Detection**.
  - `pose_data` ноды **Pose and Face Detection** во вход `pose_data` ноды **Draw ViT Pose**.
  - в поле `vitpose_model` ноды **ONNX Detection Model Loader** стоит файл такого вида: модель позы ViTPose; такой файл лежит в `models/detection`, например `vitpose-l-wholebody.onnx`.
  - в поле `yolo_model` ноды **ONNX Detection Model Loader** стоит файл такого вида: модель поиска людей YOLO; такой файл лежит в `models/detection`, например `yolov10m.onnx`.
- Шаг 9, **Соберите старт ролика**:
  - нода **WanVideo Animate Embeds**.
  - `vae` ноды **WanVideo VAE Loader** во вход `vae` ноды **WanVideo Animate Embeds**.
  - `IMAGE` ноды **Load Image** во вход `ref_images` ноды **WanVideo Animate Embeds**.
  - `pose_images` ноды **Draw ViT Pose** во вход `pose_images` ноды **WanVideo Animate Embeds**.
  - `face_images` ноды **Pose and Face Detection** во вход `face_images` ноды **WanVideo Animate Embeds**.
  - `WANVIDIMAGE_CLIPEMBEDS` ноды **WanVideo ClipVision Encode** во вход `clip_embeds` ноды **WanVideo Animate Embeds**.
  - `num_frames` ноды **WanVideo Animate Embeds**: от 49 до 121, число кадров вида 4n + 1; «Сделать за меня» ставит 81. Почему: wan берёт число кадров вида 4n + 1: 49, 81, 121. 81 кадр при 16 в секунду даёт пять секунд.
- Шаг 10, **Добавьте сэмплер**:
  - нода **WanVideo Sampler**.
  - `model` ноды **WanVideo Model Loader** во вход `model` ноды **WanVideo Sampler**.
  - `text_embeds` ноды **WanVideo TextEncode** во вход `text_embeds` ноды **WanVideo Sampler**.
  - `WANVIDIMAGE_EMBEDS` ноды **WanVideo Animate Embeds** во вход `image_embeds` ноды **WanVideo Sampler**.
- Шаг 11, **Превратите результат в кадры**:
  - нода **WanVideo Decode**.
  - `samples` ноды **WanVideo Sampler** во вход `samples` ноды **WanVideo Decode**.
  - `vae` ноды **WanVideo VAE Loader** во вход `vae` ноды **WanVideo Decode**.
- Шаг 12, **Сохраните ролик**:
  - нода **Create Video**.
  - нода **Save Video**.
  - `IMAGE` ноды **WanVideo Decode** во вход `images` ноды **Create Video**.
  - `VIDEO` ноды **Create Video** во вход `video` ноды **Save Video**.
  - `fps` ноды **Create Video**: `16`. Почему: wan рисует 16 кадров в секунду. С другим числом ролик пойдёт быстрее или медленнее, чем задумано.

## Частые ошибки
- Разные пропорции у картинки, ролика и ведущего видео.
- Ведущее видео с другой частотой кадров: движение слишком быстрое или медленное.
- Несколько людей в ведущем видео: распознавание их путает.

## См. также
- [Правила содержимого](../trust/Content-Rules.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
- [Анимация по позе](../concepts/Pose-Animation.ru.md)
- [Видео из видео](../concepts/Video-To-Video.ru.md)
