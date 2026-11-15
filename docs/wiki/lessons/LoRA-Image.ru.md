[English](LoRA-Image.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# LoRA для картинок

<!-- lesson: lora-image -->
Урок «lora-image» в группе **Картинки: приёмы** списка уроков. Шагов: 8.

## Чему вы научитесь
Две LoRA цепочкой меняют стиль и предмет у модели для картинок, каждая со своей силой.

## Что понадобится
- Урок продолжает [Первая картинка из текста](Image.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Ноды: Load Checkpoint, CLIP Text Encode (Prompt), KSampler, VAE Decode, Save Image / Preview Image, Load LoRA.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что такое LoRA** (чтение)

   LoRA это небольшой файл, обученный поверх модели: стиль, персонаж, вид предметов. Она не заменяет модель, а подгибает её, и их можно ставить цепочкой.

   Для картинок загрузчик LoRA меняет две части: рисующую модель и читателя текста. Поэтому у него две силы. Урок добавляет два загрузчика к графу из урока «Первая картинка из текста».

2. **Нужен граф с картинкой**

   Этот урок продолжает граф из урока «Первая картинка из текста». На холсте должны быть **Load Checkpoint**, два текста **CLIP Text Encode (Prompt)** и **CLIP Text Encode (Prompt)**, **KSampler**, **VAE Decode** и **Save Image** со связями между ними.

   Если их нет, сначала пройдите тот урок.

3. **Поставьте первую LoRA**

   Добавьте ноду **Load LoRA**. Подключите выходы `MODEL` и `CLIP` ноды **Load Checkpoint** к её входам `model` и `clip`. Её выход `MODEL` идёт затем в `model` ноды **KSampler**, выход `CLIP` в `clip` обоих текстов. Выберите файл в `lora_name`; ComfyUI ищет их в `models/loras`.

   Всё, что брало модель, теперь берёт модель с LoRA.

4. **Задайте силы**

   Поставьте `strength_model` ноды **Load LoRA** на 0.8. `strength_clip` оставьте на 1.

   `strength_model` говорит, насколько LoRA меняет рисование, `strength_clip`, насколько она меняет чтение слов. Выше 1 LoRA обычно ломает картинку: выжженные цвета, двоящиеся формы. Лучшее значение автор часто пишет на её странице.

5. **Добавьте вторую LoRA цепочкой**

   Добавьте вторую ноду **Load LoRA** после **Load LoRA**: выходы `MODEL` и `CLIP` ноды **Load LoRA** в её входы, её выходы туда, куда шли выходы **Load LoRA**. Выберите в `lora_name` другой файл и поставьте `strength_model` на 0.6.

   Действия двух LoRA складываются. Давайте каждой чуть меньше, чем дали бы одной; когда они спорят, опустите ту, что важна меньше.

6. **Впишите их слова**

   Допишите слова-триггеры обеих LoRA в `text` ноды **CLIP Text Encode (Prompt)**.

   Многие LoRA работают только на своих словах. Приложение сверяет описание со словами, записанными в самих файлах и в заметках ComfyUI-Lora-Manager, если он установлен. Файл без слов ничего не требует, и шаг засчитывается сам.

7. **Какая LoRA подходит** (чтение)

   LoRA работает только с тем семейством, для которого её обучили: LoRA для SD 1.5 на SDXL ничего не делает или портит картинку. Pony и Illustrious выросли из SDXL, но у них свои LoRA; друг на друге они действуют слабее или странно.

   У Flux, Qwen-Image и Z-Image нет читателя текста внутри чекпойнта: их LoRA ставят в LoraLoaderModelOnly, у которой есть только `strength_model`. Семейство файла показывает его карточка на вкладке «Модели».

8. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Что попробовать: один `seed` с каждой LoRA отдельно и с обеими; `strength_clip` 0, чтобы увидеть, что делают слова LoRA.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Нужен граф с картинкой**:
  - нода **Load Checkpoint**.
  - нода **CLIP Text Encode (Prompt)**.
  - нода **CLIP Text Encode (Prompt)**.
  - нода **KSampler**.
  - нода **VAE Decode**.
  - нода **Save Image** или **Preview Image**.
  - `CLIP` ноды **Load Checkpoint** во вход `clip` ноды **CLIP Text Encode (Prompt)** (промпт) (можно через Load LoRA или CLIP Set Last Layer).
  - `CLIP` ноды **Load Checkpoint** во вход `clip` ноды **CLIP Text Encode (Prompt)** (негатив) (можно через Load LoRA или CLIP Set Last Layer).
  - `MODEL` ноды **Load Checkpoint** во вход `model` ноды **KSampler** (можно через Load LoRA или LoraLoaderModelOnly или DifferentialDiffusion или ModelSamplingAuraFlow или ModelSamplingFlux или CFGNorm или IPAdapter Unified Loader или IPAdapter или IPAdapterAdvanced или IPAdapterStyleComposition).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (промпт) во вход `positive` ноды **KSampler** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `CONDITIONING` ноды **CLIP Text Encode (Prompt)** (негатив) во вход `negative` ноды **KSampler** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - `LATENT` ноды **KSampler** во вход `samples` ноды **VAE Decode**.
  - `VAE` ноды **Load Checkpoint** во вход `vae` ноды **VAE Decode**.
  - `IMAGE` ноды **VAE Decode** во вход `images` ноды **Save Image** или **Preview Image**.
- Шаг 3, **Поставьте первую LoRA**:
  - нода **Load LoRA**.
  - `MODEL` ноды **Load Checkpoint** во вход `model` ноды **Load LoRA** (первая LoRA).
  - `CLIP` ноды **Load Checkpoint** во вход `clip` ноды **Load LoRA** (первая LoRA) (можно через CLIP Set Last Layer).
  - `MODEL` ноды **Load LoRA** (первая LoRA) во вход `model` ноды **KSampler** (можно через Load LoRA или LoraLoaderModelOnly или DifferentialDiffusion или ModelSamplingAuraFlow или ModelSamplingFlux или CFGNorm или IPAdapter Unified Loader или IPAdapter или IPAdapterAdvanced или IPAdapterStyleComposition).
  - `CLIP` ноды **Load LoRA** (первая LoRA) во вход `clip` ноды **CLIP Text Encode (Prompt)** (промпт) (можно через Load LoRA или CLIP Set Last Layer).
  - `CLIP` ноды **Load LoRA** (первая LoRA) во вход `clip` ноды **CLIP Text Encode (Prompt)** (негатив) (можно через Load LoRA или CLIP Set Last Layer).
  - `lora_name` ноды **Load LoRA** (первая LoRA): значение выбрано.
  - файл в поле `lora_name` ноды **Load LoRA** (первая LoRA) сделан для семейства файла из поля `ckpt_name` ноды **Load Checkpoint**. Почему: loRA и ControlNet работают только с тем семейством моделей, для которого сделаны; с другим они ничего не дают или портят картинку.
- Шаг 4, **Задайте силы**:
  - `strength_model` ноды **Load LoRA** (первая LoRA): от 0.3 до 0.9; «Сделать за меня» ставит 0.8.
- Шаг 5, **Добавьте вторую LoRA цепочкой**:
  - нода **Load LoRA**.
  - `MODEL` ноды **Load LoRA** (первая LoRA) во вход `model` ноды **Load LoRA** (вторая LoRA).
  - `CLIP` ноды **Load LoRA** (первая LoRA) во вход `clip` ноды **Load LoRA** (вторая LoRA).
  - `MODEL` ноды **Load LoRA** (вторая LoRA) во вход `model` ноды **KSampler** (можно через Load LoRA или LoraLoaderModelOnly или DifferentialDiffusion или ModelSamplingAuraFlow или ModelSamplingFlux или CFGNorm или IPAdapter Unified Loader или IPAdapter или IPAdapterAdvanced или IPAdapterStyleComposition).
  - `CLIP` ноды **Load LoRA** (вторая LoRA) во вход `clip` ноды **CLIP Text Encode (Prompt)** (промпт) (можно через Load LoRA или CLIP Set Last Layer).
  - `CLIP` ноды **Load LoRA** (вторая LoRA) во вход `clip` ноды **CLIP Text Encode (Prompt)** (негатив) (можно через Load LoRA или CLIP Set Last Layer).
  - `lora_name` ноды **Load LoRA** (вторая LoRA): не тот же файл, что в поле `lora_name` ноды **Load LoRA** (первая LoRA).
  - `strength_model` ноды **Load LoRA** (вторая LoRA): от 0.3 до 0.8; «Сделать за меня» ставит 0.6.
  - файл в поле `lora_name` ноды **Load LoRA** (вторая LoRA) сделан для семейства файла из поля `ckpt_name` ноды **Load Checkpoint**. Почему: loRA и ControlNet работают только с тем семейством моделей, для которого сделаны; с другим они ничего не дают или портят картинку.
- Шаг 6, **Впишите их слова**:
  - `text` ноды **CLIP Text Encode (Prompt)** (промпт): есть слово-триггер файла из поля `lora_name` ноды **Load LoRA** (первая LoRA) или `lora_name` ноды **Load LoRA** (вторая LoRA), если описание файла их называет.

## Что дальше
Этот урок продолжают: [Картинка-образец через IP-Adapter](IP-Adapter.ru.md), [LoRA для персонажа: лицо, тело, одежда, поза](LoRA-Character.ru.md).

## См. также
- [LoRA](../concepts/LoRA.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
