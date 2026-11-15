[English](Edit-By-Words.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Правка картинки словами

<!-- lesson: edit-words -->
Урок «edit-words» в группе **Картинки: приёмы** списка уроков. Шагов: 13.

## Чему вы научитесь
Модель для правки меняет картинку так, как сказано в указании: «сделай диван зелёным», «убери чашку».

## Что понадобится
- Урок продолжает [Qwen-Image: надписи на картинке](Qwen-Image.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Ноды: Load Diffusion Model, Load CLIP, Load VAE, ModelSamplingAuraFlow, Load Image, FluxKontextImageScale, Text Encode Qwen Image Edit Plus, VAE Encode, KSampler, VAE Decode, Save Image / Preview Image.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что делает модель для правки** (чтение)

   Модель для правки получает картинку и указание и меняет только то, о чём указание. В отличие от инпейнтинга, маски нет: модель сама понимает, что менять.

   Этот урок собирает Qwen-Image-Edit 2511 так, как это делает официальный шаблон ComfyUI, с пустого холста: «Файл ▸ Новый проект». Модель большая: файл bf16 около 40 ГБ, файл fp8 около 20 ГБ.

2. **Загрузите три части**

   Добавьте **Load Diffusion Model**, **Load CLIP** и **Load VAE**.
   - В `unet_name` ноды **Load Diffusion Model**: файл qwen_image_edit_2511 из `models/diffusion_models`.
   - В `clip_name` ноды **Load CLIP**: qwen_2.5_vl_7b из `models/text_encoders`. В `type` поставьте `qwen_image`.
   - В `vae_name` ноды **Load VAE**: qwen_image_vae.

   Читатель текста у этой модели сам модель, которая видит картинки: так он понимает указание о картинке.

   Если нужного файла в списке нет, значит, его нет в вашем ComfyUI. Приложение ничего не скачивает. Проще всего открыть в самом ComfyUI официальный шаблон Qwen-Image-Edit: он покажет, каких файлов не хватает и куда их положить. Потом выберите здесь в меню «Синхронизация ▸ Синхронизировать сейчас», и файлы появятся в списках.

3. **Задайте сдвиг шума**

   Добавьте ноду **ModelSamplingAuraFlow** и пропустите через неё модель: выход ноды **Load Diffusion Model** в её вход `model`. В поле `shift` поставьте 3.1, как в шаблоне.

   Это число меняет, сколько шума остаётся на каждом шаге; это семейство настраивают этой нодой.

4. **Загрузите картинку для правки**

   Добавьте **Load Image** и **FluxKontextImageScale**. Выберите картинку в `image` ноды **Load Image** и подключите её выход к `image` ноды **FluxKontextImageScale**.

   **FluxKontextImageScale** приводит картинку примерно к одному мегапикселю со сторонами, которые принимает модель. Картинку другого размера обрезало бы или исказило.

5. **Напишите указание**

   Добавьте ноду **Text Encode Qwen Image Edit Plus** и подключите к ней: `clip` от **Load CLIP**, `vae` от **Load VAE**, `image1` от **FluxKontextImageScale**. Напишите указание в её поле `prompt`, по-английски или по-китайски: «Change the color of the sofa to dark green.»

   Нода показывает картинку читателю текста и модели вместе со словами.

6. **Второй текст**

   Добавьте вторую ноду **Text Encode Qwen Image Edit Plus** с теми же тремя связями и оставьте её `prompt` пустым.

   Сэмплер ждёт два описания. Пустое с той же картинкой значит «ничего особенного», как в шаблоне.

7. **Начальный латент**

   Добавьте ноду **VAE Encode**: выход ноды **FluxKontextImageScale** в `pixels`, выход ноды **Load VAE** в `vae`.

   Сэмплер начинает с вашей картинки, поэтому результат сохраняет её размер.

8. **Сэмплер**

   Добавьте ноду **KSampler** и подключите: `model` от **ModelSamplingAuraFlow**, `positive` от **Text Encode Qwen Image Edit Plus**, `negative` от **Text Encode Qwen Image Edit Plus**, `latent_image` от **VAE Encode**. Поставьте `steps` на 40 и `cfg` на 4, а `denoise` оставьте на 1.

   Картинка сохраняется через тексты, которые её несут; поэтому `denoise` остаётся 1.

9. **Раскодируйте и сохраните**

   Добавьте **VAE Decode** и **Save Image**: выход ноды **KSampler** в `samples`, выход ноды **Load VAE** в `vae`, картинку в `images`.

10. **Как писать указания** (чтение)

   - Одна правка за раз: «replace the cup with a vase of tulips». Несколько правок сразу часто теряют часть.
   - Назовите, что должно остаться: «keep the face and the pose unchanged».
   - Слова на вывеске пишут в кавычках: change the sign to "OPEN".
   - `image2` и `image3` принимают ещё картинки: «put the jacket from image 2 on the man in image 1».

11. **Быстрее: четыре шага** (чтение)

   Lightning LoRA этой модели, Qwen-Image-Edit-2511-Lightning-4steps, сокращает работу до 4 шагов. Поставьте её в ноду LoraLoaderModelOnly между **Load Diffusion Model** и **ModelSamplingAuraFlow**, затем `steps` на 4 и `cfg` на 1. В шаблоне оба пути стоят за одним переключателем.

12. **Другие модели для правки** (чтение)

   Шаблоны ComfyUI показывают несколько семейств:
   - Flux.1 Kontext dev: картинка идёт как опорный латент;
   - Flux.2 Klein: маленькая и быстрая, правит по одной или нескольким картинкам;
   - Qwen Image 2.1: новейшая в семействе Qwen, со своей нодой текста.
   У каждой свои ноды; откройте её шаблон в ComfyUI, чтобы увидеть граф.

   В шаблонах есть и платные ноды API для правки. Они стоят денег и отправляют вашу картинку и ваши слова в облачный сервис.

13. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Что попробовать: одно указание с двумя разными `seed`; указание, которое называет, что должно остаться.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Загрузите три части**:
  - нода **Load Diffusion Model**.
  - нода **Load CLIP**.
  - нода **Load VAE**.
  - `unet_name` ноды **Load Diffusion Model**: значение выбрано.
  - `clip_name` ноды **Load CLIP**: значение выбрано.
  - `type` ноды **Load CLIP**: `qwen_image`.
  - `vae_name` ноды **Load VAE**: значение выбрано.
- Шаг 3, **Задайте сдвиг шума**:
  - нода **ModelSamplingAuraFlow**.
  - `MODEL` ноды **Load Diffusion Model** во вход `model` ноды **ModelSamplingAuraFlow** (можно через LoraLoaderModelOnly).
  - `shift` ноды **ModelSamplingAuraFlow**: от 2 до 4; «Сделать за меня» ставит 3.1.
- Шаг 4, **Загрузите картинку для правки**:
  - нода **Load Image**.
  - нода **FluxKontextImageScale**.
  - `IMAGE` ноды **Load Image** во вход `image` ноды **FluxKontextImageScale**.
  - `image` ноды **Load Image**: значение выбрано.
- Шаг 5, **Напишите указание**:
  - нода **Text Encode Qwen Image Edit Plus**.
  - `CLIP` ноды **Load CLIP** во вход `clip` ноды **Text Encode Qwen Image Edit Plus** (промпт).
  - `VAE` ноды **Load VAE** во вход `vae` ноды **Text Encode Qwen Image Edit Plus** (промпт).
  - `IMAGE` ноды **FluxKontextImageScale** во вход `image1` ноды **Text Encode Qwen Image Edit Plus** (промпт).
  - `prompt` ноды **Text Encode Qwen Image Edit Plus** (промпт): не меньше 5 знаков.
- Шаг 6, **Второй текст**:
  - нода **Text Encode Qwen Image Edit Plus**.
  - `CLIP` ноды **Load CLIP** во вход `clip` ноды **Text Encode Qwen Image Edit Plus** (негатив).
  - `VAE` ноды **Load VAE** во вход `vae` ноды **Text Encode Qwen Image Edit Plus** (негатив).
  - `IMAGE` ноды **FluxKontextImageScale** во вход `image1` ноды **Text Encode Qwen Image Edit Plus** (негатив).
- Шаг 7, **Начальный латент**:
  - нода **VAE Encode**.
  - `IMAGE` ноды **FluxKontextImageScale** во вход `pixels` ноды **VAE Encode**.
  - `VAE` ноды **Load VAE** во вход `vae` ноды **VAE Encode**.
- Шаг 8, **Сэмплер**:
  - нода **KSampler**.
  - `MODEL` ноды **ModelSamplingAuraFlow** во вход `model` ноды **KSampler** (можно через CFGNorm или LoraLoaderModelOnly).
  - `CONDITIONING` ноды **Text Encode Qwen Image Edit Plus** (промпт) во вход `positive` ноды **KSampler** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `CONDITIONING` ноды **Text Encode Qwen Image Edit Plus** (негатив) во вход `negative` ноды **KSampler** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `LATENT` ноды **VAE Encode** во вход `latent_image` ноды **KSampler**.
  - `steps` ноды **KSampler**: от 4 до 50; «Сделать за меня» ставит 40.
  - `cfg` ноды **KSampler**: от 1 до 5; «Сделать за меня» ставит 4.
- Шаг 9, **Раскодируйте и сохраните**:
  - нода **VAE Decode**.
  - нода **Save Image** или **Preview Image**.
  - `LATENT` ноды **KSampler** во вход `samples` ноды **VAE Decode**.
  - `VAE` ноды **Load VAE** во вход `vae` ноды **VAE Decode**.
  - `IMAGE` ноды **VAE Decode** во вход `images` ноды **Save Image** или **Preview Image**.

## См. также
- [Qwen-Image](../concepts/Family-Qwen-Image.ru.md)
- [Платные API-ноды (Partner Nodes)](../concepts/Paid-API-Nodes.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
