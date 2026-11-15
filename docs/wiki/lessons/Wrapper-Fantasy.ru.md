[English](Wrapper-Fantasy.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Говорящий портрет: FantasyTalking

<!-- lesson: wrapper-fantasy -->
Урок «wrapper-fantasy» в группе **WanVideoWrapper** списка уроков. Шагов: 15.

## Сначала согласие
Озвучивать так можно только того, кто на это согласен, и его собственным голосом или голосом, на который у вас есть разрешение. Получите разрешение на исходные материалы и учитывайте местные законы. См. [Правила содержимого](../trust/Content-Rules.ru.md).

## Чему вы научитесь
Портрет произнесёт короткую запись голоса. Граф проще, чем у InfiniteTalk, ролик короче.

## Что понадобится
- Файлы моделей, которые урок проверяет:
  - модель Wan 2.1 «картинка в видео» (i2v) 14B: `models/diffusion_models`, например `wan2.1_i2v_480p_14B_fp8_scaled.safetensors`;
  - чтение текста Wan, umt5-xxl: `models/text_encoders`, например `umt5_xxl_fp8_e4m3fn_scaled.safetensors`;
  - VAE от Wan 2.1 (wan_2.1_vae): `models/vae`, например `wan_2.1_vae.safetensors`;
  - файл clip_vision_h: `models/clip_vision`, например `clip_vision_h.safetensors`;
  - модуль FantasyTalking: `models/diffusion_models`, например `fantasytalking_fp16.safetensors`.
- Ноды: WanVideo Model Loader, WanVideo T5 Text Encoder Loader, WanVideo VAE Loader, WanVideo TextEncode, Load Image, Load CLIP Vision, WanVideo ClipVision Encode, FantasyTalking Model Loader, WanVideo ImageToVideo Encode, Load Audio, (Down)load Wav2Vec Model, FantasyTalking Wav2Vec Embeds, WanVideo Sampler, WanVideo Decode, Create Video, Save Video.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что делает FantasyTalking** (чтение)

   FantasyTalking тоже учит модель Wan 2.1 «картинка в видео» слушать звук, но устроен проще, чем InfiniteTalk: обычный старт из картинки, без склейки кусков. Ролик выходит коротким, зато граф понятен с первого взгляда.

   Озвучивать так можно только того, кто на это согласен, и его собственным голосом или голосом, на который у вас есть разрешение. Получите разрешение на исходные материалы и учитывайте местные законы.

   Урок собирает граф с пустого холста: «Файл ▸ Новый проект».

2. **Загрузите модель**

   Добавьте ноду **WanVideo Model Loader** и выберите в поле `model` модель Wan 2.1 `i2v` 14B, лучше вариант 720p.

   Если нужного файла в списке нет, значит, его нет в вашем ComfyUI. Приложение ничего не скачивает. Проще всего открыть в самом ComfyUI пример графа FantasyTalking из папки `example_workflows` пака WanVideoWrapper: он покажет, каких файлов не хватает и куда их положить. Потом выберите здесь в меню «Синхронизация ▸ Синхронизировать сейчас», и файлы появятся в списках.

3. **Чтение текста и VAE**

   Добавьте ноды **WanVideo T5 Text Encoder Loader** и **WanVideo VAE Loader**. В поле `model_name` первой выберите файл `umt5-xxl-enc`, второй файл `wan_2.1_vae`.

4. **Коротко опишите кадр**

   Добавьте ноду **WanVideo TextEncode** и подключите ко входу `t5` выход ноды **WanVideo T5 Text Encoder Loader**. В поле `positive_prompt` опишите, кто говорит и как: спокойно, с улыбкой, жестикулируя.

   Что именно говорится, модель берёт из звука, а не из текста.

5. **Загрузите портрет**

   Добавьте ноду **Load Image** и выберите в поле `image` портрет. Лучше всего подходит лицо крупно, анфас.

6. **Покажите портрет модели**

   Добавьте ноды **Load CLIP Vision** и **WanVideo ClipVision Encode**. В поле `clip_name` первой выберите файл `clip_vision_h`. Её выход подключите ко входу `clip_vision` второй, портрет ко входу `image_1`.

7. **Добавьте модуль FantasyTalking**

   Добавьте ноду **FantasyTalking Model Loader** и выберите в поле `model` файл модуля FantasyTalking. Её выход подключите ко входу `fantasytalking_model` загрузчика модели.

8. **Подготовьте старт**

   Добавьте ноду **WanVideo ImageToVideo Encode**. Ко входу `vae` подключите выход ноды **WanVideo VAE Loader**, ко входу `start_image` портрет, ко входу `clip_embeds` выход ноды **WanVideo ClipVision Encode**.

   В поле `num_frames` оставьте 81. При 23 кадрах в секунду это три с половиной секунды речи.

9. **Загрузите голос**

   Добавьте три ноды: **Load Audio**, **(Down)load Wav2Vec Model** и **FantasyTalking Wav2Vec Embeds**.
   - В **Load Audio** выберите в поле `audio` звуковой файл из папки `input`.
   - В **(Down)load Wav2Vec Model** поставьте в поле `model` значение `facebook/wav2vec2-base-960h`: FantasyTalking обучен с ним. Эту модель нода скачивает сама, когда граф первый раз запускают в ComfyUI.
   - В ноду **FantasyTalking Wav2Vec Embeds** приходят три связи: `wav2vec_model` от ноды **(Down)load Wav2Vec Model**, `fantasytalking_model` от ноды **FantasyTalking Model Loader** и звук.
   - В ноде **FantasyTalking Wav2Vec Embeds** поставьте `fps` 23, а в `num_frames` то же число, что в ноде **WanVideo ImageToVideo Encode**.

10. **Добавьте сэмплер**

   Добавьте ноду **WanVideo Sampler** и подключите к ней:
   - ко входу `model` модель;
   - ко входу `text_embeds` промпт;
   - ко входу `image_embeds` выход ноды **WanVideo ImageToVideo Encode**;
   - ко входу `fantasytalking_embeds` выход ноды **FantasyTalking Wav2Vec Embeds**.

11. **Превратите результат в кадры**

   Добавьте ноду **WanVideo Decode**. Ко входу `samples` подключите выход сэмплера, ко входу `vae` выход ноды **WanVideo VAE Loader**.

12. **Соберите ролик**

   Добавьте ноды **Create Video** и **Save Video**, кадры в `images`, ролик в `video`. В поле `fps` поставьте 23, как у звука.

13. **Добавьте звук в ролик**

   Выход ноды **Load Audio** подключите ко входу `audio` ноды **Create Video**.

   Без этого ролик сохранится немым, хотя губы будут двигаться.

14. **Если губы не попадают в слова** (чтение)

   Что менять в ноде **FantasyTalking Wav2Vec Embeds**:
   - губы двигаются слабо: поднимите `audio_scale` до 1.2;
   - лицо застывшее, двигаются только губы: поставьте `audio_cfg_scale` 2, ролик будет считаться дольше;
   - запись длиннее ролика: в дело идёт только её начало. Обрежьте запись заранее или увеличьте `num_frames` в обеих нодах.

   Для длинной речи берите InfiniteTalk: он сшивает ролик из кусков.

15. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Первый запуск будет дольше обычного: нода **(Down)load Wav2Vec Model** скачает модель распознавания речи.

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
- Шаг 7, **Добавьте модуль FantasyTalking**:
  - нода **FantasyTalking Model Loader**.
  - `model` ноды **FantasyTalking Model Loader** во вход `fantasytalking_model` ноды **WanVideo Model Loader**.
  - в поле `model` ноды **FantasyTalking Model Loader** стоит файл такого вида: модуль FantasyTalking; такой файл лежит в `models/diffusion_models`, например `fantasytalking_fp16.safetensors`.
- Шаг 8, **Подготовьте старт**:
  - нода **WanVideo ImageToVideo Encode**.
  - `vae` ноды **WanVideo VAE Loader** во вход `vae` ноды **WanVideo ImageToVideo Encode**.
  - `IMAGE` ноды **Load Image** во вход `start_image` ноды **WanVideo ImageToVideo Encode**.
  - `WANVIDIMAGE_CLIPEMBEDS` ноды **WanVideo ClipVision Encode** во вход `clip_embeds` ноды **WanVideo ImageToVideo Encode**.
  - `num_frames` ноды **WanVideo ImageToVideo Encode**: от 49 до 121, число кадров вида 4n + 1; «Сделать за меня» ставит 81. Почему: wan берёт число кадров вида 4n + 1: 49, 81, 121. 81 кадр при 16 в секунду даёт пять секунд.
- Шаг 9, **Загрузите голос**:
  - нода **Load Audio**.
  - нода **(Down)load Wav2Vec Model**.
  - нода **FantasyTalking Wav2Vec Embeds**.
  - `wav2vec_model` ноды **(Down)load Wav2Vec Model** во вход `wav2vec_model` ноды **FantasyTalking Wav2Vec Embeds**.
  - `model` ноды **FantasyTalking Model Loader** во вход `fantasytalking_model` ноды **FantasyTalking Wav2Vec Embeds**.
  - `AUDIO` ноды **Load Audio** во вход `audio` ноды **FantasyTalking Wav2Vec Embeds**.
  - `audio` ноды **Load Audio**: значение выбрано.
  - `model` ноды **(Down)load Wav2Vec Model**: `facebook/wav2vec2-base-960h`. Почему: fantasyTalking обучен с этой моделью чтения речи; с другой губы не попадут в слова.
  - `fps` ноды **FantasyTalking Wav2Vec Embeds**: `23`. Почему: fantasyTalking обучен на 23 кадрах в секунду; с другим числом губы разойдутся со словами.
  - `num_frames` ноды **FantasyTalking Wav2Vec Embeds** равно полю `num_frames` ноды **WanVideo ImageToVideo Encode**. Почему: звук раскладывается на столько же кадров, сколько в ролике, иначе губы разойдутся со словами.
- Шаг 10, **Добавьте сэмплер**:
  - нода **WanVideo Sampler**.
  - `model` ноды **WanVideo Model Loader** во вход `model` ноды **WanVideo Sampler**.
  - `text_embeds` ноды **WanVideo TextEncode** во вход `text_embeds` ноды **WanVideo Sampler**.
  - `WANVIDIMAGE_EMBEDS` ноды **WanVideo ImageToVideo Encode** во вход `image_embeds` ноды **WanVideo Sampler**.
  - `fantasytalking_embeds` ноды **FantasyTalking Wav2Vec Embeds** во вход `fantasytalking_embeds` ноды **WanVideo Sampler**.
- Шаг 11, **Превратите результат в кадры**:
  - нода **WanVideo Decode**.
  - `samples` ноды **WanVideo Sampler** во вход `samples` ноды **WanVideo Decode**.
  - `vae` ноды **WanVideo VAE Loader** во вход `vae` ноды **WanVideo Decode**.
- Шаг 12, **Соберите ролик**:
  - нода **Create Video**.
  - нода **Save Video**.
  - `IMAGE` ноды **WanVideo Decode** во вход `images` ноды **Create Video**.
  - `VIDEO` ноды **Create Video** во вход `video` ноды **Save Video**.
  - `fps` ноды **Create Video**: `23`. Почему: fantasyTalking обучен на 23 кадрах в секунду; с другим числом губы разойдутся со словами.
- Шаг 13, **Добавьте звук в ролик**:
  - `AUDIO` ноды **Load Audio** во вход `audio` ноды **Create Video**.

## Частые ошибки
- Разные `num_frames` у ноды начала и ноды звука.
- Запись длиннее ролика: берётся только её начало.
- Для долгой речи берите InfiniteTalk.

## См. также
- [Правила содержимого](../trust/Content-Rules.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
- [Говорящие портреты](../concepts/Talking-Portraits.ru.md)
- [Урок: Говорящее видео: InfiniteTalk](Wrapper-Talk.ru.md)
