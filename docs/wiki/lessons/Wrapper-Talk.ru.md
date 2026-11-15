[English](Wrapper-Talk.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Говорящее видео: InfiniteTalk

<!-- lesson: wrapper-talk -->
Урок «wrapper-talk» в группе **WanVideoWrapper** списка уроков. Шагов: 15.

## Сначала согласие
Озвучивать так можно только того, кто на это согласен, и его собственным голосом или голосом, на который у вас есть разрешение. Получите разрешение на исходные материалы и учитывайте местные законы. См. [Правила содержимого](../trust/Content-Rules.ru.md).

## Чему вы научитесь
Портрет произнесёт текст из звукового файла, губы в такт словам.

## Что понадобится
- Файлы моделей, которые урок проверяет:
  - модель Wan 2.1 «картинка в видео» (i2v) 14B: `models/diffusion_models`, например `wan2.1_i2v_480p_14B_fp8_scaled.safetensors`;
  - чтение текста Wan, umt5-xxl: `models/text_encoders`, например `umt5_xxl_fp8_e4m3fn_scaled.safetensors`;
  - VAE от Wan 2.1 (wan_2.1_vae): `models/vae`, например `wan_2.1_vae.safetensors`;
  - файл clip_vision_h: `models/clip_vision`, например `clip_vision_h.safetensors`;
  - модуль InfiniteTalk или MultiTalk: `models/diffusion_models`, например `Wan2_1-InfiniteTalk_Single_fp8_e4m3fn_scaled_KJ.safetensors`;
  - модель речи wav2vec: `models/wav2vec2`, например `chinese-wav2vec2-base-fp16.safetensors`.
- Ноды: WanVideo Model Loader, WanVideo T5 Text Encoder Loader, WanVideo VAE Loader, WanVideo TextEncode, Load Image, Load CLIP Vision, WanVideo ClipVision Encode, Multi/InfiniteTalk Model Loader, Load Audio, Wav2vec2 Model Loader, Multi/InfiniteTalk Wav2vec2 Embeds, WanVideo Long I2V Multi/InfiniteTalk, WanVideo Sampler, WanVideo Decode, Create Video, Save Video.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что делает InfiniteTalk** (чтение)

   InfiniteTalk добавляет к модели Wan 2.1 «картинка в видео» умение слушать звук. Вы даёте портрет и запись голоса, а модель рисует, как человек с портрета говорит эти слова. Звук идёт в ролик дорожкой.

   Озвучивать так можно только того, кто на это согласен, и его собственным голосом или голосом, на который у вас есть разрешение. Получите разрешение на исходные материалы и учитывайте местные законы.

   Это граф на одной модели Wan 2.1, не на паре Wan 2.2. Урок собирает его с пустого холста: «Файл ▸ Новый проект».

2. **Загрузите модель**

   Добавьте ноду **WanVideo Model Loader** и выберите в поле `model` модель Wan 2.1 `i2v` 14B, лучше вариант 480p.

   Если нужного файла в списке нет, значит, его нет в вашем ComfyUI. Приложение ничего не скачивает. Проще всего открыть в самом ComfyUI пример графа InfiniteTalk из папки `example_workflows` пака WanVideoWrapper: он покажет, каких файлов не хватает и куда их положить. Потом выберите здесь в меню «Синхронизация ▸ Синхронизировать сейчас», и файлы появятся в списках.

3. **Чтение текста и VAE**

   Добавьте ноды **WanVideo T5 Text Encoder Loader** и **WanVideo VAE Loader**. В поле `model_name` первой выберите файл `umt5-xxl-enc`, второй файл `wan_2.1_vae`.

4. **Коротко опишите кадр**

   Добавьте ноду **WanVideo TextEncode** и подключите ко входу `t5` выход ноды **WanVideo T5 Text Encoder Loader**. В поле `positive_prompt` опишите, кто говорит и как: спокойно, с улыбкой, жестикулируя.

   Что именно говорится, модель берёт из звука, а не из текста.

5. **Загрузите портрет**

   Добавьте ноду **Load Image** и выберите в поле `image` портрет. Лучше всего подходит лицо крупно, анфас, с закрытым или слегка открытым ртом.

6. **Покажите портрет модели**

   Добавьте ноды **Load CLIP Vision** и **WanVideo ClipVision Encode**. В поле `clip_name` первой выберите файл `clip_vision_h`. Её выход подключите ко входу `clip_vision` второй, портрет ко входу `image_1`.

   Модели Wan 2.1 «картинка в видео» без этого не обходятся.

7. **Добавьте модуль InfiniteTalk**

   Добавьте ноду **Multi/InfiniteTalk Model Loader** и выберите в поле `model` файл модуля InfiniteTalk. Её выход подключите ко входу `multitalk_model` загрузчика модели.

   Для одного говорящего берут модуль single, для двух multi.

8. **Загрузите голос**

   Добавьте три ноды: **Load Audio**, **Wav2vec2 Model Loader** и **Multi/InfiniteTalk Wav2vec2 Embeds**.
   - В **Load Audio** выберите в поле `audio` звуковой файл из папки `input`.
   - В **Wav2vec2 Model Loader** выберите в поле `model` модель распознавания речи wav2vec, обычно chinese-wav2vec2-base. Она лежит в папке `wav2vec2`.
   - Выход `wav2vec_model` ко входу `wav2vec_model` ноды **Multi/InfiniteTalk Wav2vec2 Embeds**, звук ко входу `audio_1`.

   В ноде **Multi/InfiniteTalk Wav2vec2 Embeds** оставьте `fps` 25: InfiniteTalk рисует 25 кадров в секунду.

9. **Подготовьте старт**

   Добавьте ноду **WanVideo Long I2V Multi/InfiniteTalk**. Ко входу `vae` подключите выход ноды **WanVideo VAE Loader**, ко входу `start_image` портрет, ко входу `clip_embeds` выход ноды **WanVideo ClipVision Encode**.

   Эта нода делает длинный ролик кусками и сшивает их, поэтому говорить он может дольше пяти секунд.

10. **Добавьте сэмплер**

   Добавьте ноду **WanVideo Sampler** и подключите к ней:
   - ко входу `model` модель;
   - ко входу `text_embeds` промпт;
   - ко входу `image_embeds` выход ноды **WanVideo Long I2V Multi/InfiniteTalk**;
   - ко входу `multitalk_embeds` выход `multitalk_embeds` ноды **Multi/InfiniteTalk Wav2vec2 Embeds**.

11. **Превратите результат в кадры**

   Добавьте ноду **WanVideo Decode**. Ко входу `samples` подключите выход сэмплера, ко входу `vae` выход ноды **WanVideo VAE Loader**.

12. **Соберите ролик**

   Добавьте ноды **Create Video** и **Save Video**, кадры в `images`, ролик в `video`. В поле `fps` поставьте 25, как у звука.

13. **Добавьте звук в ролик**

   Выход `audio` ноды **Multi/InfiniteTalk Wav2vec2 Embeds** подключите ко входу `audio` ноды **Create Video**.

   Без этого ролик сохранится немым, хотя губы будут двигаться.

14. **Если губы не попадают в слова** (чтение)

   Что менять в ноде **Multi/InfiniteTalk Wav2vec2 Embeds**:
   - губы двигаются слабо: поднимите `audio_scale` до 1.2;
   - лицо застывшее, двигаются только губы: поставьте `audio_cfg_scale` 2, ролик будет считаться дольше;
   - длина ролика: нода сама считает число кадров по длине звука.

   Чистая запись голоса без музыки и шума работает намного лучше.

15. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Минута речи считается долго. Пока подбираете настройки, берите отрывок на пять-десять секунд.

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
- Шаг 4, **Коротко опишите кадр**:
  - нода **WanVideo TextEncode**.
  - `wan_t5_model` ноды **WanVideo T5 Text Encoder Loader** во вход `t5` ноды **WanVideo TextEncode**.
  - `positive_prompt` ноды **WanVideo TextEncode**: не меньше 3 знаков и 2 настоящих слов.
- Шаг 5, **Загрузите портрет**:
  - нода **Load Image**.
  - `image` ноды **Load Image**: значение выбрано.
- Шаг 6, **Покажите портрет модели**:
  - нода **Load CLIP Vision**.
  - нода **WanVideo ClipVision Encode**.
  - `CLIP_VISION` ноды **Load CLIP Vision** во вход `clip_vision` ноды **WanVideo ClipVision Encode**.
  - `IMAGE` ноды **Load Image** во вход `image_1` ноды **WanVideo ClipVision Encode**.
  - в поле `clip_name` ноды **Load CLIP Vision** стоит файл такого вида: файл clip_vision_h; такой файл лежит в `models/clip_vision`, например `clip_vision_h.safetensors`.
- Шаг 7, **Добавьте модуль InfiniteTalk**:
  - нода **Multi/InfiniteTalk Model Loader**.
  - `model` ноды **Multi/InfiniteTalk Model Loader** во вход `multitalk_model` ноды **WanVideo Model Loader**.
  - в поле `model` ноды **Multi/InfiniteTalk Model Loader** стоит файл такого вида: модуль InfiniteTalk или MultiTalk; такой файл лежит в `models/diffusion_models`, например `Wan2_1-InfiniteTalk_Single_fp8_e4m3fn_scaled_KJ.safetensors`.
- Шаг 8, **Загрузите голос**:
  - нода **Load Audio**.
  - нода **Wav2vec2 Model Loader**.
  - нода **Multi/InfiniteTalk Wav2vec2 Embeds**.
  - `wav2vec_model` ноды **Wav2vec2 Model Loader** во вход `wav2vec_model` ноды **Multi/InfiniteTalk Wav2vec2 Embeds**.
  - `AUDIO` ноды **Load Audio** во вход `audio_1` ноды **Multi/InfiniteTalk Wav2vec2 Embeds**.
  - `audio` ноды **Load Audio**: значение выбрано.
  - в поле `model` ноды **Wav2vec2 Model Loader** стоит файл такого вида: модель речи wav2vec; такой файл лежит в `models/wav2vec2`, например `chinese-wav2vec2-base-fp16.safetensors`.
  - `fps` ноды **Multi/InfiniteTalk Wav2vec2 Embeds**: `25`. Почему: infiniteTalk рисует 25 кадров в секунду, и звук разложен на те же 25.
- Шаг 9, **Подготовьте старт**:
  - нода **WanVideo Long I2V Multi/InfiniteTalk**.
  - `vae` ноды **WanVideo VAE Loader** во вход `vae` ноды **WanVideo Long I2V Multi/InfiniteTalk**.
  - `IMAGE` ноды **Load Image** во вход `start_image` ноды **WanVideo Long I2V Multi/InfiniteTalk**.
  - `WANVIDIMAGE_CLIPEMBEDS` ноды **WanVideo ClipVision Encode** во вход `clip_embeds` ноды **WanVideo Long I2V Multi/InfiniteTalk**.
- Шаг 10, **Добавьте сэмплер**:
  - нода **WanVideo Sampler**.
  - `model` ноды **WanVideo Model Loader** во вход `model` ноды **WanVideo Sampler**.
  - `text_embeds` ноды **WanVideo TextEncode** во вход `text_embeds` ноды **WanVideo Sampler**.
  - `WANVIDIMAGE_EMBEDS` ноды **WanVideo Long I2V Multi/InfiniteTalk** во вход `image_embeds` ноды **WanVideo Sampler**.
  - `multitalk_embeds` ноды **Multi/InfiniteTalk Wav2vec2 Embeds** во вход `multitalk_embeds` ноды **WanVideo Sampler**.
- Шаг 11, **Превратите результат в кадры**:
  - нода **WanVideo Decode**.
  - `samples` ноды **WanVideo Sampler** во вход `samples` ноды **WanVideo Decode**.
  - `vae` ноды **WanVideo VAE Loader** во вход `vae` ноды **WanVideo Decode**.
- Шаг 12, **Соберите ролик**:
  - нода **Create Video**.
  - нода **Save Video**.
  - `IMAGE` ноды **WanVideo Decode** во вход `images` ноды **Create Video**.
  - `VIDEO` ноды **Create Video** во вход `video` ноды **Save Video**.
  - `fps` ноды **Create Video**: `25`. Почему: infiniteTalk рисует 25 кадров в секунду, и звук разложен на те же 25.
- Шаг 13, **Добавьте звук в ролик**:
  - `audio` ноды **Multi/InfiniteTalk Wav2vec2 Embeds** во вход `audio` ноды **Create Video**.

## Частые ошибки
- Музыка или шум под голосом: губы плохо попадают.
- `fps` 16 (как обычно у Wan) вместо 25: губы уплывают.
- Забыть связь со звуком: немой ролик с двигающимися губами.

## Что дальше
Этот урок продолжают: [Разговор двоих: InfiniteTalk](Wrapper-Duo.ru.md).

## См. также
- [Правила содержимого](../trust/Content-Rules.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
- [Говорящие портреты](../concepts/Talking-Portraits.ru.md)
- [Звук](../concepts/Audio.ru.md)
