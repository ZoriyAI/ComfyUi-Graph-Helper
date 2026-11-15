[English](Wrapper-ReCam.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Другая камера: ReCamMaster

<!-- lesson: wrapper-recam -->
Урок «wrapper-recam» в группе **WanVideoWrapper** списка уроков. Шагов: 13.

## Чему вы научитесь
Готовое видео перерисуется так, будто камера двигалась по-другому.

## Что понадобится
- Файлы моделей, которые урок проверяет:
  - модель ReCamMaster: `models/diffusion_models`, например `Wan2_1_kwai_recammaster_1_3B_step20000_bf16.safetensors`;
  - чтение текста Wan, umt5-xxl: `models/text_encoders`, например `umt5_xxl_fp8_e4m3fn_scaled.safetensors`;
  - VAE от Wan 2.1 (wan_2.1_vae): `models/vae`, например `wan_2.1_vae.safetensors`.
- Ноды: WanVideo Model Loader, WanVideo T5 Text Encoder Loader, WanVideo VAE Loader, WanVideo TextEncode, Load Video, Get Video Components, WanVideo Encode, WanVideo ReCamMaster Default Camera, WanVideo ReCamMaster Camera Embed, WanVideo Sampler, WanVideo Decode, Create Video, Save Video.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что делает ReCamMaster** (чтение)

   ReCamMaster берёт готовое видео и рисует ту же сцену заново, но с другим движением камеры: с облётом, наездом или поворотом. То, что происходит в сцене, остаётся.

   Модель небольшая, на основе Wan 2.1 1.3B. Она обучена на роликах из 81 кадра размером 832 на 480 и с ними работает лучше всего.

   Берите своё видео или то, на которое у вас есть права.

   Урок собирает граф с пустого холста: «Файл ▸ Новый проект».

2. **Загрузите модель**

   Добавьте ноду **WanVideo Model Loader** и выберите в поле `model` модель ReCamMaster.

   Если нужного файла в списке нет, значит, его нет в вашем ComfyUI. Приложение ничего не скачивает. Проще всего открыть в самом ComfyUI пример графа ReCamMaster из папки `example_workflows` пака WanVideoWrapper: он покажет, каких файлов не хватает и куда их положить. Потом выберите здесь в меню «Синхронизация ▸ Синхронизировать сейчас», и файлы появятся в списках.

3. **Чтение текста и VAE**

   Добавьте ноды **WanVideo T5 Text Encoder Loader** и **WanVideo VAE Loader**. В поле `model_name` первой выберите файл `umt5-xxl-enc`, второй файл `wan_2.1_vae`.

4. **Опишите, что в видео**

   Добавьте ноду **WanVideo TextEncode** и подключите ко входу `t5` выход ноды **WanVideo T5 Text Encoder Loader**. В поле `positive_prompt` опишите, что происходит в видео: кто, где, что делает.

   Камеру описывать не нужно, её вы зададите отдельно.

5. **Загрузите видео**

   Добавьте ноды **Load Video** и **Get Video Components**. В поле `file` первой выберите видео из папки `input`, её выход подключите ко входу `video` второй.

6. **Переведите видео в сжатый вид**

   Добавьте ноду **WanVideo Encode**. Ко входу `vae` подключите выход ноды **WanVideo VAE Loader**, ко входу `image` выход `images` ноды **Get Video Components**.

   Если видео длиннее 81 кадра или другого размера, поставьте между ними ноды `ImageFromBatch` и `ImageScale`. Первая оставит 81 кадр, вторая приведёт размер к 832 на 480.

7. **Выберите движение камеры**

   Добавьте ноду **WanVideo ReCamMaster Default Camera** и подключите ко входу `latents` выход ноды **WanVideo Encode**.

   В поле `camera_type` выберите движение:
   - `pan_right`, `pan_left`: поворот вправо и влево;
   - `tilt_up`, `tilt_down`: наклон вверх и вниз;
   - `zoom_in`, `zoom_out`: наезд и отъезд;
   - `translate_up`, `translate_down`: подъём и спуск;
   - `arc_left`, `arc_right`: облёт слева и справа.

8. **Соедините камеру и видео**

   Добавьте ноду **WanVideo ReCamMaster Camera Embed**. Ко входу `camera_poses` подключите выход ноды **WanVideo ReCamMaster Default Camera**, ко входу `latents` выход ноды **WanVideo Encode**.

   Видео приходит сюда второй раз: по нему модель рисует сцену, а по пути камеры поворачивает её.

9. **Добавьте сэмплер**

   Добавьте ноду **WanVideo Sampler** и подключите к ней:
   - ко входу `model` модель;
   - ко входу `text_embeds` промпт;
   - ко входу `image_embeds` выход `camera_embeds` ноды **WanVideo ReCamMaster Camera Embed**.

   Поставьте `steps` 20.

10. **Превратите результат в кадры**

   Добавьте ноду **WanVideo Decode**. Ко входу `samples` подключите выход сэмплера, ко входу `vae` выход ноды **WanVideo VAE Loader**.

11. **Соберите ролик**

   Добавьте ноды **Create Video** и **Save Video**, кадры в `images`, ролик в `video`. В поле `fps` поставьте 16.

12. **Если сцена изменилась** (чтение)

   Что проверить:
   - в ролике другая сцена: промпт не подходит к видео. Опишите то, что в нём на самом деле;
   - картинка мутная: видео не того размера. Приведите его к 832 на 480;
   - нужен облёт на заданный угол: для него в паке есть отдельная нода, WanVideo ReCamMaster Generate Orbit Camera. Её ставят вместо ноды **WanVideo ReCamMaster Default Camera**.

13. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Один запуск даёт одно движение камеры. Чтобы сравнить два движения, запустите граф дважды.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Загрузите модель**:
  - нода **WanVideo Model Loader**.
  - в поле `model` ноды **WanVideo Model Loader** стоит файл такого вида: модель ReCamMaster; такой файл лежит в `models/diffusion_models`, например `Wan2_1_kwai_recammaster_1_3B_step20000_bf16.safetensors`.
- Шаг 3, **Чтение текста и VAE**:
  - нода **WanVideo T5 Text Encoder Loader**.
  - нода **WanVideo VAE Loader**.
  - в поле `model_name` ноды **WanVideo T5 Text Encoder Loader** стоит файл такого вида: чтение текста Wan, umt5-xxl; такой файл лежит в `models/text_encoders`, например `umt5_xxl_fp8_e4m3fn_scaled.safetensors`.
  - в поле `model_name` ноды **WanVideo VAE Loader** стоит файл такого вида: VAE от Wan 2.1 (wan_2.1_vae); такой файл лежит в `models/vae`, например `wan_2.1_vae.safetensors`.
- Шаг 4, **Опишите, что в видео**:
  - нода **WanVideo TextEncode**.
  - `wan_t5_model` ноды **WanVideo T5 Text Encoder Loader** во вход `t5` ноды **WanVideo TextEncode**.
  - `positive_prompt` ноды **WanVideo TextEncode**: не меньше 3 знаков и 2 настоящих слов.
- Шаг 5, **Загрузите видео**:
  - нода **Load Video**.
  - нода **Get Video Components**.
  - `VIDEO` ноды **Load Video** во вход `video` ноды **Get Video Components**.
  - `file` ноды **Load Video**: значение выбрано.
- Шаг 6, **Переведите видео в сжатый вид**:
  - нода **WanVideo Encode**.
  - `vae` ноды **WanVideo VAE Loader** во вход `vae` ноды **WanVideo Encode**.
  - `images` ноды **Get Video Components** во вход `image` ноды **WanVideo Encode** (можно через Upscale Image или Resize Image или ImageResizeKJv2 или ImageFromBatch или GetImageRangeFromBatch).
- Шаг 7, **Выберите движение камеры**:
  - нода **WanVideo ReCamMaster Default Camera**.
  - `samples` ноды **WanVideo Encode** во вход `latents` ноды **WanVideo ReCamMaster Default Camera**.
- Шаг 8, **Соедините камеру и видео**:
  - нода **WanVideo ReCamMaster Camera Embed**.
  - `camera_poses` ноды **WanVideo ReCamMaster Default Camera** во вход `camera_poses` ноды **WanVideo ReCamMaster Camera Embed**.
  - `samples` ноды **WanVideo Encode** во вход `latents` ноды **WanVideo ReCamMaster Camera Embed**.
- Шаг 9, **Добавьте сэмплер**:
  - нода **WanVideo Sampler**.
  - `model` ноды **WanVideo Model Loader** во вход `model` ноды **WanVideo Sampler**.
  - `text_embeds` ноды **WanVideo TextEncode** во вход `text_embeds` ноды **WanVideo Sampler**.
  - `WANVIDIMAGE_EMBEDS` ноды **WanVideo ReCamMaster Camera Embed** во вход `image_embeds` ноды **WanVideo Sampler**.
  - `steps` ноды **WanVideo Sampler**: от 20 до 30; «Сделать за меня» ставит 20. Почему: reCamMaster обучен на двадцати шагах.
- Шаг 10, **Превратите результат в кадры**:
  - нода **WanVideo Decode**.
  - `samples` ноды **WanVideo Sampler** во вход `samples` ноды **WanVideo Decode**.
  - `vae` ноды **WanVideo VAE Loader** во вход `vae` ноды **WanVideo Decode**.
- Шаг 11, **Соберите ролик**:
  - нода **Create Video**.
  - нода **Save Video**.
  - `IMAGE` ноды **WanVideo Decode** во вход `images` ноды **Create Video**.
  - `VIDEO` ноды **Create Video** во вход `video` ноды **Save Video**.
  - `fps` ноды **Create Video**: `16`. Почему: wan рисует 16 кадров в секунду. С другим числом ролик пойдёт быстрее или медленнее, чем задумано.

## Частые ошибки
- Промпт не совпадает с видео: появляется другая сцена.
- Видео другого размера: размытый результат.

## См. также
- [Как устроены уроки](How-Lessons-Work.ru.md)
- [Видео из видео](../concepts/Video-To-Video.ru.md)
- [Модели для видео](../concepts/Video-Models.ru.md)
- [Правила содержания](../trust/Content-Rules.ru.md)
