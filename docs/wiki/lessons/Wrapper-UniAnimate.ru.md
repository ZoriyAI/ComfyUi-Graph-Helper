[English](Wrapper-UniAnimate.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Анимация по позе: UniAnimate

<!-- lesson: wrapper-unianimate -->
Урок «wrapper-unianimate» в группе **WanVideoWrapper** списка уроков. Шагов: 16.

## Сначала согласие
Оживлять так можно только того, кто на это согласен: себя, придуманного героя или человека, который разрешил. Получите разрешение на исходные материалы и учитывайте местные законы. См. [Правила содержимого](../trust/Content-Rules.ru.md).

## Чему вы научитесь
Герой с картинки повторит движения человека из видео. Хватит модели Wan 2.1 и одной LoRA.

## Что понадобится
- Файлы моделей, которые урок проверяет:
  - модель Wan 2.1 «картинка в видео» (i2v) 14B: `models/diffusion_models`, например `wan2.1_i2v_480p_14B_fp8_scaled.safetensors`;
  - чтение текста Wan, umt5-xxl: `models/text_encoders`, например `umt5_xxl_fp8_e4m3fn_scaled.safetensors`;
  - VAE от Wan 2.1 (wan_2.1_vae): `models/vae`, например `wan_2.1_vae.safetensors`;
  - файл clip_vision_h: `models/clip_vision`, например `clip_vision_h.safetensors`;
  - файл LoRA для UniAnimate: `models/loras`, например `UniAnimate-Wan2.1-14B-Lora-12000-fp16.safetensors`.
- Ноды: WanVideo Model Loader, WanVideo T5 Text Encoder Loader, WanVideo VAE Loader, WanVideo TextEncode, Load Image, Load CLIP Vision, WanVideo ClipVision Encode, WanVideo Lora Select, Load Video, Get Video Components, WanVideo UniAnimate DWPose Detector, WanVideo UniAnimate Pose Input, WanVideo ImageToVideo Encode, WanVideo Sampler, WanVideo Decode, Create Video, Save Video.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что делает UniAnimate** (чтение)

   UniAnimate устроен как LoRA для модели Wan 2.1 «картинка в видео». С ней модель слушается скелета: из видео с движущимся человеком вынимается поза в каждом кадре, и герой с вашей картинки повторяет эти движения.

   В отличие от Wan Animate, лицо и мимику она не переносит, только тело. Зато отдельная модель не нужна.

   Оживлять так можно только того, кто на это согласен: себя, придуманного героя или человека, который разрешил. Получите разрешение на исходные материалы и учитывайте местные законы.

   Урок собирает граф с пустого холста: «Файл ▸ Новый проект».

2. **Загрузите модель**

   Добавьте ноду **WanVideo Model Loader** и выберите в поле `model` модель Wan 2.1 `i2v` 14B, вариант 480p или 720p.

   Если нужного файла в списке нет, значит, его нет в вашем ComfyUI. Приложение ничего не скачивает. Проще всего открыть в самом ComfyUI любой пример графа Wan 2.1 I2V из папки `example_workflows` пака WanVideoWrapper: он покажет, каких файлов не хватает и куда их положить. Потом выберите здесь в меню «Синхронизация ▸ Синхронизировать сейчас», и файлы появятся в списках.

3. **Чтение текста и VAE**

   Добавьте ноды **WanVideo T5 Text Encoder Loader** и **WanVideo VAE Loader**. В поле `model_name` первой выберите файл `umt5-xxl-enc`, второй файл `wan_2.1_vae`.

4. **Опишите героя и место**

   Добавьте ноду **WanVideo TextEncode** и подключите ко входу `t5` выход ноды **WanVideo T5 Text Encoder Loader**. В поле `positive_prompt` опишите, кто в кадре, во что одет и где находится.

   Движение описывать не нужно: его задаст видео.

5. **Загрузите героя**

   Добавьте ноду **Load Image** и выберите в поле `image` картинку с героем. Лучше всего в полный рост и в позе, похожей на первую позу из видео.

6. **Покажите картинку модели**

   Добавьте ноды **Load CLIP Vision** и **WanVideo ClipVision Encode**. В поле `clip_name` первой выберите файл `clip_vision_h`. Её выход подключите ко входу `clip_vision` второй, картинку ко входу `image_1`.

   Модели Wan 2.1 «картинка в видео» без этого не обходятся.

7. **Добавьте LoRA UniAnimate**

   Добавьте ноду **WanVideo Lora Select** и выберите в поле `lora` файл UniAnimate для Wan 2.1 14B. Её выход подключите ко входу `lora` загрузчика модели.

   Без этой LoRA скелет подключить нельзя: запуск остановится с ошибкой.

8. **Загрузите видео с движением**

   Добавьте ноды **Load Video** и **Get Video Components**. В поле `file` первой выберите видео из папки `input`, её выход подключите ко входу `video` второй.

   Берите видео, где человек один в кадре и виден целиком.

9. **Выньте позу**

   Добавьте ноду **WanVideo UniAnimate DWPose Detector**. Ко входу `pose_images` подключите выход `images` ноды **Get Video Components**, ко входу `reference_pose_image` картинку с героем.

   Нода рисует скелет для каждого кадра и отдельно скелет героя с картинки. По второму модель понимает, чем сложение героя отличается от человека в видео.

   Две небольшие модели для поиска позы эта нода скачивает сама, когда граф первый раз запускают в ComfyUI. Само приложение ничего не скачивает.

10. **Передайте скелет модели**

   Добавьте ноду **WanVideo UniAnimate Pose Input**. Выход `poses` ноды **WanVideo UniAnimate DWPose Detector** подключите ко входу `pose_images`, выход `reference_pose` ко входу `reference_pose_image`.

   Поле `strength` оставьте 1: это сила, с которой скелет ведёт героя.

11. **Подготовьте старт**

   Добавьте ноду **WanVideo ImageToVideo Encode**. Ко входу `vae` подключите выход ноды **WanVideo VAE Loader**, ко входу `start_image` картинку, ко входу `clip_embeds` выход ноды **WanVideo ClipVision Encode**.

   В поле `num_frames` оставьте 81, это пять секунд. Размер ролика задают поля `width` и `height`.

12. **Добавьте сэмплер**

   Добавьте ноду **WanVideo Sampler** и подключите к ней:
   - ко входу `model` модель;
   - ко входу `text_embeds` промпт;
   - ко входу `image_embeds` выход ноды **WanVideo ImageToVideo Encode**;
   - ко входу `unianimate_poses` выход ноды **WanVideo UniAnimate Pose Input**.

13. **Превратите результат в кадры**

   Добавьте ноду **WanVideo Decode**. Ко входу `samples` подключите выход сэмплера, ко входу `vae` выход ноды **WanVideo VAE Loader**.

14. **Соберите ролик**

   Добавьте ноды **Create Video** и **Save Video**, кадры в `images`, ролик в `video`. В поле `fps` поставьте 16.

15. **Если герой двигается не так** (чтение)

   Что проверить:
   - кадры видео другого размера, чем ролик: поставьте между **Get Video Components** и **WanVideo UniAnimate DWPose Detector** ноду изменения размера и задайте те же `width` и `height`, что в ноде **WanVideo ImageToVideo Encode**;
   - видео длиннее ролика: лишние позы отбрасываются. Если оно короче, уменьшите `num_frames`;
   - скелет пропадает или появляется где не надо: меняйте `score_threshold` в ноде **WanVideo UniAnimate DWPose Detector**;
   - герой меняет телосложение: проверьте, что ко входу `reference_pose_image` подключена картинка с героем.

16. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Первый запуск будет дольше обычного: нода **WanVideo UniAnimate DWPose Detector** скачает свои модели.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Загрузите модель**:
  - нода **WanVideo Model Loader**.
  - в поле `model` ноды **WanVideo Model Loader** стоит файл такого вида: модель Wan 2.1 «картинка в видео» (i2v) 14B; такой файл лежит в `models/diffusion_models`, например `wan2.1_i2v_480p_14B_fp8_scaled.safetensors`.
- Шаг 3, **Чтение текста и VAE**:
  - нода **WanVideo T5 Text Encoder Loader**.
  - нода **WanVideo VAE Loader**.
  - в поле `model_name` ноды **WanVideo T5 Text Encoder Loader** стоит файл такого вида: чтение текста Wan, umt5-xxl; такой файл лежит в `models/text_encoders`, например `umt5_xxl_fp8_e4m3fn_scaled.safetensors`.
  - в поле `model_name` ноды **WanVideo VAE Loader** стоит файл такого вида: VAE от Wan 2.1 (wan_2.1_vae); такой файл лежит в `models/vae`, например `wan_2.1_vae.safetensors`.
- Шаг 4, **Опишите героя и место**:
  - нода **WanVideo TextEncode**.
  - `wan_t5_model` ноды **WanVideo T5 Text Encoder Loader** во вход `t5` ноды **WanVideo TextEncode**.
  - `positive_prompt` ноды **WanVideo TextEncode**: не меньше 3 знаков и 2 настоящих слов.
- Шаг 5, **Загрузите героя**:
  - нода **Load Image**.
  - `image` ноды **Load Image**: значение выбрано.
- Шаг 6, **Покажите картинку модели**:
  - нода **Load CLIP Vision**.
  - нода **WanVideo ClipVision Encode**.
  - `CLIP_VISION` ноды **Load CLIP Vision** во вход `clip_vision` ноды **WanVideo ClipVision Encode**.
  - `IMAGE` ноды **Load Image** во вход `image_1` ноды **WanVideo ClipVision Encode**.
  - в поле `clip_name` ноды **Load CLIP Vision** стоит файл такого вида: файл clip_vision_h; такой файл лежит в `models/clip_vision`, например `clip_vision_h.safetensors`.
- Шаг 7, **Добавьте LoRA UniAnimate**:
  - нода **WanVideo Lora Select**.
  - `lora` ноды **WanVideo Lora Select** во вход `lora` ноды **WanVideo Model Loader**.
  - в поле `lora` ноды **WanVideo Lora Select** стоит файл такого вида: файл LoRA для UniAnimate; такой файл лежит в `models/loras`, например `UniAnimate-Wan2.1-14B-Lora-12000-fp16.safetensors`.
- Шаг 8, **Загрузите видео с движением**:
  - нода **Load Video**.
  - нода **Get Video Components**.
  - `VIDEO` ноды **Load Video** во вход `video` ноды **Get Video Components**.
  - `file` ноды **Load Video**: значение выбрано.
- Шаг 9, **Выньте позу**:
  - нода **WanVideo UniAnimate DWPose Detector**.
  - `images` ноды **Get Video Components** во вход `pose_images` ноды **WanVideo UniAnimate DWPose Detector** (можно через Upscale Image или Resize Image или ImageResizeKJv2 или ImageFromBatch или GetImageRangeFromBatch).
  - `IMAGE` ноды **Load Image** во вход `reference_pose_image` ноды **WanVideo UniAnimate DWPose Detector** (можно через Upscale Image или Resize Image или ImageResizeKJv2 или ImageFromBatch или GetImageRangeFromBatch).
- Шаг 10, **Передайте скелет модели**:
  - нода **WanVideo UniAnimate Pose Input**.
  - `poses` ноды **WanVideo UniAnimate DWPose Detector** во вход `pose_images` ноды **WanVideo UniAnimate Pose Input**.
  - `reference_pose` ноды **WanVideo UniAnimate DWPose Detector** во вход `reference_pose_image` ноды **WanVideo UniAnimate Pose Input**.
  - `strength` ноды **WanVideo UniAnimate Pose Input**: от 0.5 до 1; «Сделать за меня» ставит 1. Почему: это сила, с которой скелет ведёт героя. С 1 герой повторяет позы полностью.
- Шаг 11, **Подготовьте старт**:
  - нода **WanVideo ImageToVideo Encode**.
  - `vae` ноды **WanVideo VAE Loader** во вход `vae` ноды **WanVideo ImageToVideo Encode**.
  - `IMAGE` ноды **Load Image** во вход `start_image` ноды **WanVideo ImageToVideo Encode**.
  - `WANVIDIMAGE_CLIPEMBEDS` ноды **WanVideo ClipVision Encode** во вход `clip_embeds` ноды **WanVideo ImageToVideo Encode**.
  - `num_frames` ноды **WanVideo ImageToVideo Encode**: от 49 до 121, число кадров вида 4n + 1; «Сделать за меня» ставит 81. Почему: wan берёт число кадров вида 4n + 1: 49, 81, 121. 81 кадр при 16 в секунду даёт пять секунд.
- Шаг 12, **Добавьте сэмплер**:
  - нода **WanVideo Sampler**.
  - `model` ноды **WanVideo Model Loader** во вход `model` ноды **WanVideo Sampler**.
  - `text_embeds` ноды **WanVideo TextEncode** во вход `text_embeds` ноды **WanVideo Sampler**.
  - `WANVIDIMAGE_EMBEDS` ноды **WanVideo ImageToVideo Encode** во вход `image_embeds` ноды **WanVideo Sampler**.
  - `unianimate_poses` ноды **WanVideo UniAnimate Pose Input** во вход `unianimate_poses` ноды **WanVideo Sampler**.
- Шаг 13, **Превратите результат в кадры**:
  - нода **WanVideo Decode**.
  - `samples` ноды **WanVideo Sampler** во вход `samples` ноды **WanVideo Decode**.
  - `vae` ноды **WanVideo VAE Loader** во вход `vae` ноды **WanVideo Decode**.
- Шаг 14, **Соберите ролик**:
  - нода **Create Video**.
  - нода **Save Video**.
  - `IMAGE` ноды **WanVideo Decode** во вход `images` ноды **Create Video**.
  - `VIDEO` ноды **Create Video** во вход `video` ноды **Save Video**.
  - `fps` ноды **Create Video**: `16`. Почему: wan рисует 16 кадров в секунду. С другим числом ролик пойдёт быстрее или медленнее, чем задумано.

## Частые ошибки
- Кадры видео другого размера, чем ролик: поставьте ноду изменения размера с теми же шириной и высотой.
- Картинка героя не подключена к `reference_pose_image`: герой принимает телосложение человека из видео.

## См. также
- [Правила содержимого](../trust/Content-Rules.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
- [Анимация по позе](../concepts/Pose-Animation.ru.md)
- [Урок: Анимация по позе: Wan Animate](Wrapper-Animate.ru.md)
- [LoRA](../concepts/LoRA.ru.md)
