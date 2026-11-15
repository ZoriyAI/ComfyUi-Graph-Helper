[English](Video-Speech.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Портрет, который говорит: HuMo

<!-- lesson: video-speech -->
Урок «video-speech» в группе **Видео** списка уроков. Шагов: 16.

## Сначала согласие
Озвучивать так можно только того, кто на это согласен, и его собственным голосом или голосом, на который у вас есть разрешение. Получите разрешение на исходные материалы и учитывайте местные законы. Для взрослого (18+) содержимого получите согласие участников и учитывайте местные законы. См. [Правила содержимого](../trust/Content-Rules.ru.md).

## Чему вы научитесь
Человек с картинки произносит слова из звукового файла, на нодах самого ComfyUI, без пака.

## Что понадобится
- Урок продолжает [Видео из картинки](Video-Image.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Файлы моделей, которые урок проверяет:
  - для поля `unet_name` ноды **Load Diffusion Model**: файл, в имени которого есть `humo`;
  - для поля `lora_name` ноды **LoraLoaderModelOnly**: файл, в имени которого есть `lightx2v`;
  - для поля `clip_name` ноды **Load CLIP**: файл, в имени которого есть `umt5`;
  - для поля `vae_name` ноды **Load VAE**: файл, в имени которого есть `wan_2.1_vae`;
  - для поля `audio_encoder_name` ноды **Audio Encoder Loader**: файл, в имени которого есть `whisper`.
- Ноды: Load Diffusion Model, LoraLoaderModelOnly, ModelSamplingSD3, Load CLIP, Load VAE, CLIP Text Encode (Prompt), Load Audio, Audio Encoder Loader, Audio Encoder Encode, Load Image, WanHuMoImageToVideo, KSampler, VAE Decode / VAE Decode (Tiled), Create Video, Save Video.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Прежде чем начать** (чтение)

   Озвучивать так можно только того, кто на это согласен, и его собственным голосом или голосом, на который у вас есть разрешение. Получите разрешение на исходные материалы и учитывайте местные законы. Для взрослого (18+) содержимого получите согласие участников и учитывайте местные законы. Исключайте тех, кто младше 18 лет или так выглядит; обозначайте синтетические изображения, чтобы не вводить людей в заблуждение. Уроки учат технике без откровенных подробностей.

   HuMo рисует человека с картинки-образца и двигает губы под звук. Звук идёт в ролик дорожкой.

   Цена: модель HuMo 17B, около 17 ГБ в `fp8`, в `models/diffusion_models`; LoRA для ускорения lightx2v в `models/loras`; аудиоэнкодер Whisper в `models/audio_encoders`; `umt5_xxl` и `wan_2.1_vae`. Рассчитывайте на карту от 16 ГБ или на долгий запуск с переносом частей в оперативную память. Ролик около четырёх секунд.

   Если на холсте уже есть другой граф, начните с пустого: «Файл ▸ Новый проект».

2. **Загрузите модель**

   Добавьте ноду **Load Diffusion Model** и выберите в `unet_name` файл `humo_17B`.

   Если нужного файла в списке нет, значит, его нет в вашем ComfyUI. Приложение ничего не скачивает. Проще всего открыть в самом ComfyUI шаблон «HuMo Video Generation»: он покажет, каких файлов не хватает и куда их положить. Потом выберите здесь в меню «Синхронизация ▸ Синхронизировать сейчас», и файлы появятся в списках.

3. **Добавьте LoRA для ускорения**

   Добавьте ноду **LoraLoaderModelOnly** и подключите выход `MODEL` ноды **Load Diffusion Model** к её входу `model`. В `lora_name` выберите файл `lightx2v` и оставьте `strength_model` 1.

   С ней хватает 6 шагов и `cfg` 1, как в шаблоне; без неё модели нужно намного больше шагов.

4. **Задайте сдвиг**

   Добавьте ноду **ModelSamplingSD3** и подключите выход **LoraLoaderModelOnly** к её входу `model`. В поле `shift` поставьте 8.

5. **Загрузите текстовый энкодер**

   Добавьте ноду **Load CLIP**. В `clip_name` выберите файл `umt5_xxl`, в `type` поставьте `wan`.

   Текстовый энкодер превращает промпт в то, что читает модель. Версия файла `fp8` занимает вдвое меньше памяти, чем полная, и её берут официальные шаблоны.

6. **Загрузите VAE**

   Добавьте ноду **Load VAE** и выберите в `vae_name` файл `wan_2.1_vae`. HuMo построена на Wan 2.1 и берёт её VAE.

7. **Опишите сцену**

   Добавьте две ноды **CLIP Text Encode (Prompt)** и подключите выход `CLIP` ноды **Load CLIP** ко входу `clip` каждой. В поле `text` одной опишите, кто говорит, где и как: спокойно, улыбаясь, глядя в камеру. Что именно сказано, модель берёт из звука, а не из промпта.

8. **Загрузите голос**

   Добавьте три ноды: **Load Audio**, **Audio Encoder Loader** и **Audio Encoder Encode**.
   - В **Load Audio** выберите звуковой файл из папки `input`.
   - В `audio_encoder_name` ноды **Audio Encoder Loader** выберите файл Whisper (`whisper_large_v3`).
   - Выход **Audio Encoder Loader** подключите ко входу `audio_encoder` ноды **Audio Encoder Encode**, а звук к её входу `audio`.

   Лучше всего работает чистая запись одного голоса без музыки.

9. **Загрузите портрет**

   Добавьте ноду **Load Image** и выберите в `image` картинку с человеком. Лицо анфас, хороший свет, рот закрыт или чуть приоткрыт.

10. **Сведите всё вместе**

   Добавьте ноду **WanHuMoImageToVideo** и подключите к ней два промпта, VAE, выход **Audio Encoder Encode** ко входу `audio_encoder_output` и портрет ко входу `ref_image`.

   Поставьте `width` и `height` 640, `length` 97: при 25 кадрах в секунду это около четырёх секунд.

11. **Добавьте сэмплер**

   Добавьте ноду **KSampler**. Её вход `model` берёт выход ноды **ModelSamplingSD3**; `positive`, `negative` и `latent_image` берут три выхода ноды **WanHuMoImageToVideo**.

12. **Настройте сэмплер**

   Поставьте `steps` 6 и `cfg` 1. LoRA для ускорения сделана под эти числа; `cfg` выше с ней пережигает картинку.

13. **Превратите результат в кадры**

   Добавьте ноду **VAE Decode**. Ко входу `samples` подключите выход сэмплера, ко входу `vae` выход ноды **Load VAE**.

   Сэмплер выдаёт ролик в сжатом виде, латенте. Эта нода разворачивает его в кадры.

14. **Соберите ролик со звуком**

   Добавьте ноды **Create Video** и **Save Video**. Кадры идут во вход `images`, выход ноды **Load Audio** во вход `audio`, ролик во вход `video` ноды **Save Video**. В поле `fps` поставьте 25.

   HuMo рисует 25 кадров в секунду; с другим числом губы не попадут в слова.

15. **Если губы не попадают в слова** (чтение)

   - Звук длиннее ролика: проговорятся только первые четыре секунды. Обрежьте звук или удлините ролик, по 97 кадров на четыре секунды.
   - Лицо меняется: возьмите портрет чётче и крупнее.
   - Рот почти не двигается: голос тихий или под ним музыка.

16. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Загрузите модель**:
  - нода **Load Diffusion Model**.
  - в поле `unet_name` ноды **Load Diffusion Model** стоит файл, в имени которого есть `humo` (заглавные буквы, точки и дефисы не важны).
- Шаг 3, **Добавьте LoRA для ускорения**:
  - нода **LoraLoaderModelOnly**.
  - `MODEL` ноды **Load Diffusion Model** во вход `model` ноды **LoraLoaderModelOnly**.
  - в поле `lora_name` ноды **LoraLoaderModelOnly** стоит файл, в имени которого есть `lightx2v` (заглавные буквы, точки и дефисы не важны).
  - `strength_model` ноды **LoraLoaderModelOnly**: от 0.5 до 1; «Сделать за меня» ставит 1.
- Шаг 4, **Задайте сдвиг**:
  - нода **ModelSamplingSD3**.
  - `MODEL` ноды **LoraLoaderModelOnly** во вход `model` ноды **ModelSamplingSD3** (можно через LoraLoaderModelOnly или EasyCache).
  - `shift` ноды **ModelSamplingSD3**: от 5 до 8; «Сделать за меня» ставит 8.
- Шаг 5, **Загрузите текстовый энкодер**:
  - нода **Load CLIP**.
  - в поле `clip_name` ноды **Load CLIP** стоит файл, в имени которого есть `umt5` (заглавные буквы, точки и дефисы не важны).
  - `type` ноды **Load CLIP**: `wan`.
- Шаг 6, **Загрузите VAE**:
  - нода **Load VAE**.
  - в поле `vae_name` ноды **Load VAE** стоит файл, в имени которого есть `wan_2.1_vae` (заглавные буквы, точки и дефисы не важны).
- Шаг 7, **Опишите сцену**:
  - нода **CLIP Text Encode (Prompt)**.
  - нода **CLIP Text Encode (Prompt)**.
  - `CLIP` ноды **Load CLIP** во вход `clip` ноды **CLIP Text Encode (Prompt)** (промпт).
  - `CLIP` ноды **Load CLIP** во вход `clip` ноды **CLIP Text Encode (Prompt)** (негатив).
  - `text` ноды **CLIP Text Encode (Prompt)** (промпт): не меньше 3 знаков.
- Шаг 8, **Загрузите голос**:
  - нода **Load Audio**.
  - нода **Audio Encoder Loader**.
  - нода **Audio Encoder Encode**.
  - `AUDIO_ENCODER` ноды **Audio Encoder Loader** во вход `audio_encoder` ноды **Audio Encoder Encode**.
  - `AUDIO` ноды **Load Audio** во вход `audio` ноды **Audio Encoder Encode**.
  - `audio` ноды **Load Audio**: значение выбрано.
  - в поле `audio_encoder_name` ноды **Audio Encoder Loader** стоит файл, в имени которого есть `whisper` (заглавные буквы, точки и дефисы не важны).
- Шаг 9, **Загрузите портрет**:
  - нода **Load Image**.
  - `image` ноды **Load Image**: значение выбрано.
- Шаг 10, **Сведите всё вместе**:
  - нода **WanHuMoImageToVideo**.
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (промпт) во вход `positive` ноды **WanHuMoImageToVideo**.
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (негатив) во вход `negative` ноды **WanHuMoImageToVideo**.
  - `VAE` ноды **Load VAE** во вход `vae` ноды **WanHuMoImageToVideo**.
  - `AUDIO_ENCODER_OUTPUT` ноды **Audio Encoder Encode** во вход `audio_encoder_output` ноды **WanHuMoImageToVideo**.
  - `IMAGE` ноды **Load Image** во вход `ref_image` ноды **WanHuMoImageToVideo** (можно через Upscale Image или Upscale Image By или ImageFromBatch или ImageResizeKJv2 или Resize Image или GetImageRangeFromBatch или ResizeImageMaskNode).
  - `width` ноды **WanHuMoImageToVideo**: от 480 до 1280; «Сделать за меня» ставит 640.
  - `height` ноды **WanHuMoImageToVideo**: от 480 до 1280; «Сделать за меня» ставит 640.
  - `length` ноды **WanHuMoImageToVideo**: от 25 до 97; «Сделать за меня» ставит 97.
- Шаг 11, **Добавьте сэмплер**:
  - нода **KSampler**.
  - `MODEL` ноды **ModelSamplingSD3** во вход `model` ноды **KSampler** (можно через LoraLoaderModelOnly или EasyCache).
  - `positive` ноды **WanHuMoImageToVideo** во вход `positive` ноды **KSampler**.
  - `negative` ноды **WanHuMoImageToVideo** во вход `negative` ноды **KSampler**.
  - `latent` ноды **WanHuMoImageToVideo** во вход `latent_image` ноды **KSampler**.
- Шаг 12, **Настройте сэмплер**:
  - `steps` ноды **KSampler**: от 4 до 10; «Сделать за меня» ставит 6.
  - `cfg` ноды **KSampler**: `1`.
- Шаг 13, **Превратите результат в кадры**:
  - нода **VAE Decode** или **VAE Decode (Tiled)**.
  - `LATENT` ноды **KSampler** во вход `samples` ноды **VAE Decode** или **VAE Decode (Tiled)**.
  - `VAE` ноды **Load VAE** во вход `vae` ноды **VAE Decode** или **VAE Decode (Tiled)**.
- Шаг 14, **Соберите ролик со звуком**:
  - нода **Create Video**.
  - нода **Save Video**.
  - `IMAGE` ноды **VAE Decode** или **VAE Decode (Tiled)** во вход `images` ноды **Create Video**.
  - `AUDIO` ноды **Load Audio** во вход `audio` ноды **Create Video**.
  - `VIDEO` ноды **Create Video** во вход `video` ноды **Save Video**.
  - `fps` ноды **Create Video**: `25`.

## См. также
- [Говорящие портреты](../concepts/Talking-Portraits.ru.md)
- [Звук](../concepts/Audio.ru.md)
- [Правила содержимого](../trust/Content-Rules.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
