[English](Character-Kontext.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Тот же персонаж на новой картинке: FLUX.1 Kontext

<!-- lesson: character-kontext -->
Урок «character-kontext» в группе **Лица и персонажи** списка уроков. Шагов: 13.

## Сначала согласие
Получите согласие реального человека на использование его внешности и учитывайте местные законы. Не помещайте внешность реального человека в откровенное содержимое; исключайте тех, кто выглядит несовершеннолетним. См. [Правила содержимого](../trust/Content-Rules.ru.md).

## Чему вы научитесь
Вы соберёте граф, который снова рисует придуманного вами героя, в новом месте или позе, с тем же лицом и одеждой.

## Что понадобится
- Урок продолжает [Первая картинка из текста](Image.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Файлы моделей, которые урок проверяет:
  - для поля `unet_name` ноды **Load Diffusion Model**: файл, в имени которого есть `kontext`;
  - для поля `clip_name1` ноды **DualCLIPLoader**: файл, в имени которого есть `clip_l`;
  - для поля `vae_name` ноды **Load VAE**: файл, в имени которого есть `ae`;
  - для поля `clip_name2` ноды **DualCLIPLoader**: файл, в имени которого есть `t5xxl`.
- Ноды: Load Diffusion Model, DualCLIPLoader, Load VAE, Load Image, FluxKontextImageScale, VAE Encode, CLIP Text Encode (Prompt), ReferenceLatent, FluxGuidance, ConditioningZeroOut, KSampler, VAE Decode, Save Image / Preview Image.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Сначала о лицах** (чтение)

   FLUX.1 Kontext берёт картинку и фразу о том, что изменить, и сохраняет остальное: то же лицо, ту же одежду, тот же стиль. Так один герой проходит через целую серию картинок.

   В примере этого урока придуманный герой или вы сами. Получите согласие реального человека на использование его внешности и учитывайте местные законы. Не помещайте внешность реального человека в откровенное содержимое; исключайте тех, кто выглядит несовершеннолетним.

   Урок собирает граф с пустого холста: «Файл ▸ Новый проект».

2. **Загрузите модель**

   Добавьте ноду **Load Diffusion Model** и выберите файл Kontext в `unet_name`. Шаблон берёт `flux1-dev-kontext_fp8_scaled.safetensors` из models/diffusion_models.

   Так умеет только модель Kontext. Обычный FLUX.1 dev картинку не замечает.

   Если нужного файла в списке нет, значит, его нет в вашем ComfyUI. Приложение ничего не скачивает. Проще всего открыть в самом ComfyUI шаблон «Flux Kontext Dev Image Edit»: он покажет, каких файлов не хватает и куда их положить. Потом выберите здесь в меню «Синхронизация ▸ Синхронизировать сейчас», и файлы появятся в списках.

3. **Загрузите чтение текста и декодер**

   Добавьте ноду **DualCLIPLoader**. Выберите `clip_l.safetensors` в `clip_name1`, `t5xxl_fp8_e4m3fn_scaled.safetensors` в `clip_name2`, а `type` поставьте `flux`.

   Добавьте ноду **Load VAE** и выберите `ae.safetensors` в `vae_name`.

   Это те же файлы, что FLUX.1 берёт для картинок из текста.

4. **Загрузите картинку с героем**

   Добавьте ноду **Load Image** и выберите картинку с вашим героем в её поле `image`.

   Лицо должно быть ясным и достаточно крупным. Эта картинка служит образцом: всё, что модель сохранит, берётся из неё.

5. **Подготовьте картинку**

   Добавьте ноду **FluxKontextImageScale** и соедините картинку от **Load Image** с её входом `image`. Потом добавьте ноду **VAE Encode**: вход `pixels` от **FluxKontextImageScale**, вход `vae` от **Load VAE**.

   Первая нода приводит картинку к размеру, на котором учился Kontext. Вторая превращает её в сжатый вид, в котором работает модель.

6. **Скажите, что меняется**

   Добавьте ноду **CLIP Text Encode (Prompt)** и соедините выход `CLIP` ноды **DualCLIPLoader** с её входом `clip`. В `text` напишите, что нового и что остаётся. Например: the same woman with short red hair and a green coat, now standing on a rainy street at night, keep her face and clothes.

   Называйте героя по тому, что видно («женщина с рыжими волосами»), а не местоимением: так модель знает, кого сохранить.

7. **Отдайте картинку описанию**

   Добавьте ноду **ReferenceLatent**. Соедините выход **CLIP Text Encode (Prompt)** с её входом `conditioning`, а выход **VAE Encode** с её входом `latent`.

   Потом добавьте ноду **FluxGuidance**, соедините **ReferenceLatent** с её входом `conditioning` и поставьте `guidance` равным 2.5.

   Первая нода прикрепляет картинку к описанию. Вторая говорит, насколько сильно модель им следует: шаблон ставит 2.5.

8. **Пустой негатив**

   Добавьте ноду **ConditioningZeroOut** и соедините выход **CLIP Text Encode (Prompt)** с её входом `conditioning`.

   Kontext не говорят, чего избегать. Эта нода даёт входу `negative` сэмплера то же описание, обнулённое.

9. **Добавьте сэмплер**

   Добавьте ноду **KSampler** и подключите четыре входа:
   - `model` от **Load Diffusion Model**;
   - `positive` от **FluxGuidance**;
   - `negative` от **ConditioningZeroOut**;
   - `latent_image` от **VAE Encode**.

   Поставьте `steps` равным 20 и `cfg` равным 1. Модели FLUX берут силу следования от **FluxGuidance**, поэтому `cfg` остаётся 1.

10. **Превратите результат в картинку и сохраните**

   Добавьте ноду **VAE Decode**: `samples` от **KSampler**, `vae` от **Load VAE**. Потом добавьте ноду **Save Image** и соедините картинку **VAE Decode** с её входом `images`.

11. **Серия с одним героем** (чтение)

   Чтобы удержать героя через серию:
   - начинайте каждую новую картинку с того же образца, а не с последнего результата: мелкие изменения накапливаются;
   - меняйте по одному: место, потом позу, потом свет;
   - повторяйте в каждом описании черты, которые делают героя: волосы, одежду, примету;
   - закрепите `seed` в ноде **KSampler**, пока ищете хорошее описание.

   Если лицо уплывает, чуть уменьшите `guidance` или скажите в описании «keep the face».

12. **Другие способы удержать героя** (чтение)

   Другим способам нужно больше файлов, и работают они только со своим семейством моделей:
   - IP-Adapter FaceID (пак ComfyUI_IPAdapter_plus): SD 1.5 и SDXL, нужен InsightFace в models/insightface и свои файлы в models/ipadapter;
   - PhotoMaker (ноды самого ComfyUI): SDXL, файл в models/photomaker, несколько картинок одного лица;
   - InfiniteYou (пак ComfyUI_InfiniteYou): FLUX, файлы в models/infinite_you и InsightFace, много видеопамяти;
   - LoRA, обученная на герое: самый устойчивый способ, но её сначала надо обучить.

   Для всех них правило то же: придуманный герой или вы сами, или человек, который дал согласие.

13. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Загрузите модель**:
  - нода **Load Diffusion Model**.
  - в поле `unet_name` ноды **Load Diffusion Model** стоит файл, в имени которого есть `kontext` (заглавные буквы, точки и дефисы не важны).
- Шаг 3, **Загрузите чтение текста и декодер**:
  - нода **DualCLIPLoader**.
  - нода **Load VAE**.
  - в поле `clip_name1` ноды **DualCLIPLoader** стоит файл, в имени которого есть `clip_l` (заглавные буквы, точки и дефисы не важны).
  - `clip_name2` ноды **DualCLIPLoader**: не тот же файл, что в поле `clip_name1` ноды **DualCLIPLoader**.
  - `type` ноды **DualCLIPLoader**: `flux`.
  - в поле `vae_name` ноды **Load VAE** стоит файл, в имени которого есть `ae` и нет `sdxl`, `wan`, `qwen`, `flux2`, `taesd` (заглавные буквы, точки и дефисы не важны).
  - в поле `clip_name2` ноды **DualCLIPLoader** стоит файл, в имени которого есть `t5xxl` (заглавные буквы, точки и дефисы не важны).
- Шаг 4, **Загрузите картинку с героем**:
  - нода **Load Image**.
  - `image` ноды **Load Image**: значение выбрано.
- Шаг 5, **Подготовьте картинку**:
  - нода **FluxKontextImageScale**.
  - нода **VAE Encode**.
  - `IMAGE` ноды **Load Image** во вход `image` ноды **FluxKontextImageScale** (можно через ImageStitch).
  - `IMAGE` ноды **FluxKontextImageScale** во вход `pixels` ноды **VAE Encode**.
  - `VAE` ноды **Load VAE** во вход `vae` ноды **VAE Encode**.
- Шаг 6, **Скажите, что меняется**:
  - нода **CLIP Text Encode (Prompt)**.
  - `CLIP` ноды **DualCLIPLoader** во вход `clip` ноды **CLIP Text Encode (Prompt)**.
  - `text` ноды **CLIP Text Encode (Prompt)**: не меньше 20 знаков.
- Шаг 7, **Отдайте картинку описанию**:
  - нода **ReferenceLatent**.
  - нода **FluxGuidance**.
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** во вход `conditioning` ноды **ReferenceLatent**.
  - `LATENT` ноды **VAE Encode** во вход `latent` ноды **ReferenceLatent**.
  - `CONDITIONING` ноды **ReferenceLatent** во вход `conditioning` ноды **FluxGuidance**.
  - `guidance` ноды **FluxGuidance**: от 2 до 3.5; «Сделать за меня» ставит 2.5.
- Шаг 8, **Пустой негатив**:
  - нода **ConditioningZeroOut**.
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** во вход `conditioning` ноды **ConditioningZeroOut**.
- Шаг 9, **Добавьте сэмплер**:
  - нода **KSampler**.
  - `MODEL` ноды **Load Diffusion Model** во вход `model` ноды **KSampler**.
  - `CONDITIONING` ноды **FluxGuidance** во вход `positive` ноды **KSampler**.
  - `CONDITIONING` ноды **ConditioningZeroOut** во вход `negative` ноды **KSampler**.
  - `LATENT` ноды **VAE Encode** во вход `latent_image` ноды **KSampler**.
  - `steps` ноды **KSampler**: от 20 до 30; «Сделать за меня» ставит 20.
  - `cfg` ноды **KSampler**: `1`.
- Шаг 10, **Превратите результат в картинку и сохраните**:
  - нода **VAE Decode**.
  - нода **Save Image** или **Preview Image**.
  - `LATENT` ноды **KSampler** во вход `samples` ноды **VAE Decode**.
  - `VAE` ноды **Load VAE** во вход `vae` ноды **VAE Decode**.
  - `IMAGE` ноды **VAE Decode** во вход `images` ноды **Save Image** или **Preview Image**.

## Что дальше
Этот урок продолжают: [Один персонаж на многих картинках](Character-Series.ru.md).

## См. также
- [Картинки-образцы: IP-Adapter, Redux, модели правки](../concepts/Reference-Images.ru.md)
- [Flux.1](../concepts/Family-Flux1.ru.md)
- [Правила содержимого](../trust/Content-Rules.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
