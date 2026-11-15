[English](Wrapper-Ovi.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Видео со звуком: Ovi

<!-- lesson: wrapper-ovi -->
Урок «wrapper-ovi» в группе **WanVideoWrapper** списка уроков. Шагов: 16.

## Сначала согласие
Правило остаётся: не вкладывайте слова в уста настоящих людей без их согласия. См. [Правила содержимого](../trust/Content-Rules.ru.md).

## Чему вы научитесь
Один запуск рисует ролик и сразу его звук: речь героя, шаги, шум улицы.

## Что понадобится
- Файлы моделей, которые урок проверяет:
  - видео-модель Ovi: `models/diffusion_models`, например `Wan2_2-Ovi-960x960-10s_fp8_e4m3fn_scaled_KJ.safetensors`;
  - звуковая модель Ovi: `models/diffusion_models`, например `Wan2_2-Ovi-audio_model_bf16.safetensors`;
  - чтение текста Wan, umt5-xxl: `models/text_encoders`, например `umt5_xxl_fp8_e4m3fn_scaled.safetensors`;
  - VAE от Wan 2.2 (Wan2_2_VAE): `models/vae`, например `Wan2_2_VAE_bf16.safetensors`;
  - файл VAE для MMAudio: `models/mmaudio`, например `mmaudio_vae_16k_fp32.safetensors`;
  - вокодер MMAudio: `models/mmaudio`, например `mmaudio_vocoder_bigvgan_best_netG_fp32.safetensors`.
- Ноды: WanVideo Model Loader, WanVideo Extra Model Select, WanVideo T5 Text Encoder Loader, WanVideo VAE Loader, WanVideo TextEncode, WanVideo Ovi CFG, WanVideo Empty Embeds, WanVideo Empty MMAudio Latents, WanVideo Sampler, WanVideo Decode, Ovi MMAudio VAE Loader, WanVideo Decode Ovi Audio, Create Video, Save Video.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что делает Ovi** (чтение)

   Ovi состоит из двух моделей, которые работают вместе: одна рисует ролик, другая в то же время создаёт для него звук. Речь героя вы пишете прямо в промпте, и губы попадают в слова.

   Длина ролика всегда одна: 121 кадр, это пять секунд при 24 кадрах в секунду.

   Голос модель придумывает сама. Правило остаётся: не вкладывайте слова в уста настоящих людей без их согласия.

   Урок собирает граф с пустого холста: «Файл ▸ Новый проект».

2. **Загрузите две модели**

   Добавьте ноды **WanVideo Model Loader** и **WanVideo Extra Model Select**.
   - В **WanVideo Model Loader** выберите в поле `model` видео-модель Ovi.
   - В **WanVideo Extra Model Select** выберите в поле `extra_model` звуковую модель Ovi. Это другой файл.
   - Выход ноды **WanVideo Extra Model Select** подключите ко входу `extra_model` ноды **WanVideo Model Loader**.
   - В ноде **WanVideo Model Loader** поле `base_precision` оставьте `bf16`. С `fp16` эта модель может выдать чёрный экран.

   Если нужного файла в списке нет, значит, его нет в вашем ComfyUI. Приложение ничего не скачивает. Проще всего открыть в самом ComfyUI пример графа Ovi из папки `example_workflows` пака WanVideoWrapper: он покажет, каких файлов не хватает и куда их положить. Потом выберите здесь в меню «Синхронизация ▸ Синхронизировать сейчас», и файлы появятся в списках.

3. **Чтение текста и VAE**

   Добавьте ноды **WanVideo T5 Text Encoder Loader** и **WanVideo VAE Loader**. В поле `model_name` первой выберите файл `umt5-xxl-enc`. Во второй нужен VAE от Wan 2.2, файл `Wan2_2_VAE`: VAE от Wan 2.1 сюда не подходит.

4. **Опишите кадр**

   Добавьте ноду **WanVideo TextEncode** и подключите ко входу `t5` выход ноды **WanVideo T5 Text Encoder Loader**. В поле `positive_prompt` опишите по-английски, кто в кадре, где и что делает.

5. **Впишите речь**

   Слова, которые произносит герой, ставят в поле `positive_prompt` между метками `<S>` и `<E>`. Например: A man in a kitchen says `<S>Good morning, the coffee is ready.<E>`

   Без этих меток Ovi не работает.

   Что ещё слышно в ролике, можно описать между `<AUDCAP>` и `<ENDAUDCAP>`: голос, шум, музыку. Это по желанию.

6. **Подключите настройку звука**

   Добавьте ноду **WanVideo Ovi CFG** и подключите ко входу `original_text_embeds` выход ноды **WanVideo TextEncode**.

   Поле `ovi_audio_cfg` оставьте 3. Оно говорит, насколько строго звук следует промпту.

7. **Скажите, каким звук быть не должен**

   Добавьте вторую ноду **WanVideo TextEncode** и подключите ко входу `t5` выход ноды **WanVideo T5 Text Encoder Loader**. В её поле `positive_prompt` впишите, чего в звуке быть не должно: robotic, muffled, echo, distorted.

   Выход этой ноды подключите ко входу `ovi_negative_text_embeds` ноды **WanVideo Ovi CFG**.

   Здесь нет ошибки: слова пишут в верхнее поле, нода **WanVideo Ovi CFG** берёт именно его. Если эту ноду не подключить, вместо неё подставится сам промпт, и настройка `ovi_audio_cfg` почти перестанет действовать.

8. **Задайте размер и длину**

   Добавьте ноду **WanVideo Empty Embeds**. В поле `num_frames` поставьте 121: на другую длину Ovi не рассчитан.

   В полях `width` и `height` поставьте 992 и 512 для горизонтального ролика.

9. **Добавьте заготовку звука**

   Добавьте ноду **WanVideo Empty MMAudio Latents** и оставьте в поле `length` 157. Это длина звука для ролика из 121 кадра.

   Из этой заготовки модель делает звук, так же как ролик она делает из шума.

10. **Добавьте сэмплер**

   Добавьте ноду **WanVideo Sampler** и подключите к ней:
   - ко входу `model` модель;
   - ко входу `text_embeds` выход ноды **WanVideo Ovi CFG**, а не ноды **WanVideo TextEncode**;
   - ко входу `image_embeds` выход ноды **WanVideo Empty Embeds**;
   - ко входу `samples` выход ноды **WanVideo Empty MMAudio Latents**.

   Поставьте `steps` 50 и `cfg` 4.

11. **Превратите результат в кадры**

   Добавьте ноду **WanVideo Decode**. Ко входу `samples` подключите выход сэмплера, ко входу `vae` выход ноды **WanVideo VAE Loader**.

12. **Превратите результат в звук**

   Добавьте ноды **Ovi MMAudio VAE Loader** и **WanVideo Decode Ovi Audio**.
   - В **Ovi MMAudio VAE Loader** выберите в поле `vae` файл `mmaudio_vae`, в поле `vocoder` файл `mmaudio_vocoder`. Это два разных файла.
   - Её выход подключите ко входу `mmaudio_vae` ноды **WanVideo Decode Ovi Audio**.
   - Ко входу `samples` ноды **WanVideo Decode Ovi Audio** подключите выход сэмплера, тот же, что идёт в ноду **WanVideo Decode**.

13. **Соберите ролик со звуком**

   Добавьте ноды **Create Video** и **Save Video**. Кадры подключите ко входу `images`, выход ноды **WanVideo Decode Ovi Audio** ко входу `audio`, ролик ко входу `video`. В поле `fps` поставьте 24.

14. **Если нужен старт с картинки** (чтение)

   Ovi умеет начинать ролик с вашей картинки. Её загружают, приводят к размеру ролика и переводят в сжатый вид нодой WanVideo Encode. Выход этой ноды подключают ко входу `extra_latents` ноды **WanVideo Empty Embeds**.

   Этот шаг урок не проверяет: без картинки граф тоже работает.

15. **Если звук или речь не получились** (чтение)

   Что проверить:
   - героя не слышно: слова должны стоять между `<S>` и `<E>`, лучше по-английски;
   - речь обрывается: в пять секунд входит одна-две короткие фразы;
   - звук глухой или с эхом: допишите в ноду **WanVideo TextEncode** то, что слышите: muffled, echo, noise;
   - чёрный экран: проверьте `base_precision`, нужно `bf16`.

16. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Ovi считает долго: 50 шагов сразу для двух моделей. Для пробы поставьте 30.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Загрузите две модели**:
  - нода **WanVideo Model Loader**.
  - нода **WanVideo Extra Model Select**.
  - `extra_model` ноды **WanVideo Extra Model Select** во вход `extra_model` ноды **WanVideo Model Loader**.
  - в поле `model` ноды **WanVideo Model Loader** стоит файл такого вида: видео-модель Ovi; такой файл лежит в `models/diffusion_models`, например `Wan2_2-Ovi-960x960-10s_fp8_e4m3fn_scaled_KJ.safetensors`.
  - `extra_model` ноды **WanVideo Extra Model Select**: не тот же файл, что в поле `model` ноды **WanVideo Model Loader**.
  - в поле `extra_model` ноды **WanVideo Extra Model Select** стоит файл такого вида: звуковая модель Ovi; такой файл лежит в `models/diffusion_models`, например `Wan2_2-Ovi-audio_model_bf16.safetensors`.
  - `base_precision` ноды **WanVideo Model Loader**: `bf16`. Почему: с `fp16` эта модель может выдать чёрный экран.
- Шаг 3, **Чтение текста и VAE**:
  - нода **WanVideo T5 Text Encoder Loader**.
  - нода **WanVideo VAE Loader**.
  - в поле `model_name` ноды **WanVideo T5 Text Encoder Loader** стоит файл такого вида: чтение текста Wan, umt5-xxl; такой файл лежит в `models/text_encoders`, например `umt5_xxl_fp8_e4m3fn_scaled.safetensors`.
  - в поле `model_name` ноды **WanVideo VAE Loader** стоит файл такого вида: VAE от Wan 2.2 (Wan2_2_VAE); такой файл лежит в `models/vae`, например `Wan2_2_VAE_bf16.safetensors`.
- Шаг 4, **Опишите кадр**:
  - нода **WanVideo TextEncode**.
  - `wan_t5_model` ноды **WanVideo T5 Text Encoder Loader** во вход `t5` ноды **WanVideo TextEncode** (промпт).
  - `positive_prompt` ноды **WanVideo TextEncode** (промпт): не меньше 3 знаков и 2 настоящих слов.
- Шаг 5, **Впишите речь**:
  - `positive_prompt` ноды **WanVideo TextEncode** (промпт): не меньше 3 знаков, есть `<S>` и `<E>`.
- Шаг 6, **Подключите настройку звука**:
  - нода **WanVideo Ovi CFG**.
  - `text_embeds` ноды **WanVideo TextEncode** (промпт) во вход `original_text_embeds` ноды **WanVideo Ovi CFG**.
  - `ovi_audio_cfg` ноды **WanVideo Ovi CFG**: от 2 до 4; «Сделать за меня» ставит 3. Почему: это строгость, с которой звук следует промпту. 3 дают звук без искажений.
- Шаг 7, **Скажите, каким звук быть не должен**:
  - нода **WanVideo TextEncode**.
  - `wan_t5_model` ноды **WanVideo T5 Text Encoder Loader** во вход `t5` ноды **WanVideo TextEncode** (каким звук быть не должен).
  - `text_embeds` ноды **WanVideo TextEncode** (каким звук быть не должен) во вход `ovi_negative_text_embeds` ноды **WanVideo Ovi CFG**.
  - `positive_prompt` ноды **WanVideo TextEncode** (каким звук быть не должен): не меньше 3 знаков.
- Шаг 8, **Задайте размер и длину**:
  - нода **WanVideo Empty Embeds**.
  - `num_frames` ноды **WanVideo Empty Embeds**: `121`. Почему: ovi рассчитан ровно на 121 кадр, пять секунд.
- Шаг 9, **Добавьте заготовку звука**:
  - нода **WanVideo Empty MMAudio Latents**.
  - `length` ноды **WanVideo Empty MMAudio Latents**: `157`. Почему: это длина звука для ролика из 121 кадра.
- Шаг 10, **Добавьте сэмплер**:
  - нода **WanVideo Sampler**.
  - `model` ноды **WanVideo Model Loader** во вход `model` ноды **WanVideo Sampler**.
  - `text_embeds` ноды **WanVideo Ovi CFG** во вход `text_embeds` ноды **WanVideo Sampler**.
  - `WANVIDIMAGE_EMBEDS` ноды **WanVideo Empty Embeds** во вход `image_embeds` ноды **WanVideo Sampler**.
  - `samples` ноды **WanVideo Empty MMAudio Latents** во вход `samples` ноды **WanVideo Sampler**.
  - `steps` ноды **WanVideo Sampler**: от 30 до 50; «Сделать за меня» ставит 50. Почему: ovi считает звук и картинку вместе, для этого ему нужно 50 шагов.
  - `cfg` ноды **WanVideo Sampler**: от 3 до 5; «Сделать за меня» ставит 4. Почему: шаблон Ovi ставит cfg 4: сильнее ролик выгорает, слабее хуже слушает промпт.
- Шаг 11, **Превратите результат в кадры**:
  - нода **WanVideo Decode**.
  - `samples` ноды **WanVideo Sampler** во вход `samples` ноды **WanVideo Decode**.
  - `vae` ноды **WanVideo VAE Loader** во вход `vae` ноды **WanVideo Decode**.
- Шаг 12, **Превратите результат в звук**:
  - нода **Ovi MMAudio VAE Loader**.
  - нода **WanVideo Decode Ovi Audio**.
  - `mmaudio_vae` ноды **Ovi MMAudio VAE Loader** во вход `mmaudio_vae` ноды **WanVideo Decode Ovi Audio**.
  - `samples` ноды **WanVideo Sampler** во вход `samples` ноды **WanVideo Decode Ovi Audio**.
  - в поле `vae` ноды **Ovi MMAudio VAE Loader** стоит файл такого вида: файл VAE для MMAudio; такой файл лежит в `models/mmaudio`, например `mmaudio_vae_16k_fp32.safetensors`.
  - в поле `vocoder` ноды **Ovi MMAudio VAE Loader** стоит файл такого вида: вокодер MMAudio; такой файл лежит в `models/mmaudio`, например `mmaudio_vocoder_bigvgan_best_netG_fp32.safetensors`.
- Шаг 13, **Соберите ролик со звуком**:
  - нода **Create Video**.
  - нода **Save Video**.
  - `IMAGE` ноды **WanVideo Decode** во вход `images` ноды **Create Video**.
  - `audio` ноды **WanVideo Decode Ovi Audio** во вход `audio` ноды **Create Video**.
  - `VIDEO` ноды **Create Video** во вход `video` ноды **Save Video**.
  - `fps` ноды **Create Video**: `24`. Почему: ovi делает ролик в 24 кадра в секунду, и звук рассчитан на них.

## Частые ошибки
- Писать нежелательный звук в `negative_prompt` второй ноды: нода Ovi читает её положительное поле.
- Слишком много речи на пять секунд: помещаются одна-две короткие фразы.
- Точность `fp16`: чёрный экран.

## См. также
- [Правила содержимого](../trust/Content-Rules.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
- [Звук](../concepts/Audio.ru.md)
- [Говорящие портреты](../concepts/Talking-Portraits.ru.md)
- [Модели для видео](../concepts/Video-Models.ru.md)
