[English](LoRA.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# LoRA: добавить стиль или тему

<!-- lesson: lora -->
Урок «lora» в группе **Видео** списка уроков. Шагов: 8.

## Чему вы научитесь
Подключите LoRA к обеим моделям и впишете её слова в промпт.

## Что понадобится
- Урок продолжает [Видео из текста](Video-Text.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Файлы моделей, которые урок проверяет:
  - половина high_noise модели Wan 2.2: `models/diffusion_models`, например `Wan2_2-T2V-A14B-HIGH_fp8_e4m3fn_scaled_KJ.safetensors`;
  - половина low_noise модели Wan 2.2: `models/diffusion_models`, например `Wan2_2-T2V-A14B-LOW_fp8_e4m3fn_scaled_KJ.safetensors`;
  - LoRA для Wan: файл high из пары или одиночная LoRA: `models/loras`, например `my_style_wan22_high_noise.safetensors`;
  - LoRA для Wan: файл low из пары или одиночная LoRA: `models/loras`, например `my_style_wan22_low_noise.safetensors`.
- Ноды: Load Diffusion Model, ModelSamplingSD3, LoraLoaderModelOnly, CLIP Text Encode (Prompt), WanImageToVideo / KSampler (Advanced) / KSampler.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что такое LoRA** (чтение)

   LoRA называют небольшую добавку к модели. Она учит модель одной вещи: стилю, персонажу, предмету, виду движения.

   LoRA сделана под свою модель. LoRA для Wan не работает с SDXL, и наоборот. Во вкладке «Модели» слева карточка файла показывает, к какой модели он относится.

   У Wan 2.2 две модели, поэтому LoRA часто идёт парой файлов: `high` и `low`.

2. **Нужен граф для видео**

   Этот урок продолжает граф из урока «Видео из текста» или «Видео из картинки». На холсте должны быть две ноды **Load Diffusion Model** и две ноды **ModelSamplingSD3**.

   Если их нет, сначала пройдите один из этих уроков.

3. **Добавьте две ноды LoRA**

   Добавьте две ноды **LoraLoaderModelOnly**: по одной на каждую модель.

4. **Вставьте их в путь модели**

   Каждая нода LoRA встаёт между загрузкой модели и нодой **ModelSamplingSD3**:
   - выход `MODEL` ноды **Load Diffusion Model** ко входу `model` ноды LoRA;
   - выход `MODEL` ноды LoRA ко входу `model` ноды **ModelSamplingSD3**.

   Сделайте так для обеих моделей. Модель проходит через LoRA и выходит уже изменённой.

5. **Выберите файлы и силу**

   В поле `lora_name` выберите файл. В ноде на пути модели `high_noise` файл `high`, на пути `low_noise` файл `low`. Если LoRA одна, без пары, поставьте её в обе ноды.

   Поле `strength_model` задаёт силу. 1 значит в полную силу. Если LoRA перебивает всё остальное или портит картинку, снизьте до 0.6-0.8.

   Несколько LoRA ставят цепочкой: выход одной ноды LoRA ко входу следующей.

6. **Слова, которые включают LoRA** (чтение)

   Многие LoRA срабатывают, только когда в промпте есть их слова. Их называют словами-триггерами.

   Откройте карточку файла во вкладке «Модели»: если автор записал эти слова в файл, они там показаны. Если их там нет, смотрите страницу, с которой вы брали LoRA.

7. **Впишите слова LoRA в промпт**

   Допишите слова вашей LoRA в поле `text` той ноды **CLIP Text Encode (Prompt)**, выход которой идёт во вход `positive`.

   Приложение сверяет промпт со словами, записанными в самом файле LoRA. Если автор их туда не записал, сверять не с чем, и шаг засчитывается сам.

8. **LoRA подключена** (чтение)

   Запустите граф в ComfyUI и сравните с роликом без LoRA.

   Если ничего не изменилось, проверьте три вещи: файл подходит к модели, слова-триггеры есть в промпте, сила не слишком мала.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Нужен граф для видео**:
  - нода **Load Diffusion Model**.
  - нода **Load Diffusion Model**.
  - нода **ModelSamplingSD3**.
  - нода **ModelSamplingSD3**.
  - в поле `unet_name` ноды **Load Diffusion Model** (первый проход) стоит файл такого вида: половина high_noise модели Wan 2.2; такой файл лежит в `models/diffusion_models`, например `Wan2_2-T2V-A14B-HIGH_fp8_e4m3fn_scaled_KJ.safetensors`.
  - в поле `unet_name` ноды **Load Diffusion Model** (второй проход) стоит файл такого вида: половина low_noise модели Wan 2.2; такой файл лежит в `models/diffusion_models`, например `Wan2_2-T2V-A14B-LOW_fp8_e4m3fn_scaled_KJ.safetensors`.
- Шаг 3, **Добавьте две ноды LoRA**:
  - нода **LoraLoaderModelOnly**.
  - нода **LoraLoaderModelOnly**.
- Шаг 4, **Вставьте их в путь модели**:
  - `MODEL` ноды **Load Diffusion Model** (первый проход) во вход `model` ноды **LoraLoaderModelOnly** (LoRA первого прохода) (можно через LoraLoaderModelOnly или ModelSamplingSD3).
  - `MODEL` ноды **LoraLoaderModelOnly** (LoRA первого прохода) во вход `model` ноды **ModelSamplingSD3** (сдвиг первого прохода) (можно через LoraLoaderModelOnly); или `MODEL` ноды **ModelSamplingSD3** (сдвиг первого прохода) во вход `model` ноды **LoraLoaderModelOnly** (LoRA первого прохода) (можно через LoraLoaderModelOnly).
  - `MODEL` ноды **Load Diffusion Model** (второй проход) во вход `model` ноды **LoraLoaderModelOnly** (LoRA второго прохода) (можно через LoraLoaderModelOnly или ModelSamplingSD3).
  - `MODEL` ноды **LoraLoaderModelOnly** (LoRA второго прохода) во вход `model` ноды **ModelSamplingSD3** (сдвиг второго прохода) (можно через LoraLoaderModelOnly); или `MODEL` ноды **ModelSamplingSD3** (сдвиг второго прохода) во вход `model` ноды **LoraLoaderModelOnly** (LoRA второго прохода) (можно через LoraLoaderModelOnly).
- Шаг 5, **Выберите файлы и силу**:
  - в поле `lora_name` ноды **LoraLoaderModelOnly** (LoRA первого прохода) стоит файл такого вида: LoRA для Wan: файл high из пары или одиночная LoRA; такой файл лежит в `models/loras`, например `my_style_wan22_high_noise.safetensors`.
  - в поле `lora_name` ноды **LoraLoaderModelOnly** (LoRA второго прохода) стоит файл такого вида: LoRA для Wan: файл low из пары или одиночная LoRA; такой файл лежит в `models/loras`, например `my_style_wan22_low_noise.safetensors`.
- Шаг 7, **Впишите слова LoRA в промпт**:
  - нода **CLIP Text Encode (Prompt)**.
  - нода **WanImageToVideo** или **KSampler (Advanced)** или **KSampler**.
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** во вход `positive` ноды **WanImageToVideo** или **KSampler (Advanced)** или **KSampler**.
  - `text` ноды **CLIP Text Encode (Prompt)**: есть слово-триггер файла из поля `lora_name` ноды **LoraLoaderModelOnly** (LoRA первого прохода) или `lora_name` ноды **LoraLoaderModelOnly** (LoRA второго прохода), если описание файла их называет.

## Частые ошибки
- LoRA для другого семейства или размера (SDXL или Wan 1.3B к модели 14B): ничего не происходит, ComfyUI только пишет предупреждения в журнал.
- Файл `low` в пути `high_noise`.
- Сила 1.5 и больше: картинка ломается.
- Забыть слова-триггеры.

## Что дальше
Этот урок продолжают: [Быстрое видео за четыре шага](Video-Fast.ru.md).

## См. также
- [Как устроены уроки](How-Lessons-Work.ru.md)
- [LoRA](../concepts/LoRA.ru.md)
- [LoRA-ускорители](../concepts/Speed-Up-LoRAs.ru.md)
- [Почему семейства не смешиваются](../concepts/Why-Families-Do-Not-Mix.ru.md)
- [Карточка модели](../interface/Model-Card.ru.md)
