[English](Video-Fast.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Быстрое видео за четыре шага

<!-- lesson: video-fast -->
Урок «video-fast» в группе **Видео** списка уроков. Шагов: 8.

## Чему вы научитесь
Сократите двадцать шагов до четырёх с помощью ускоряющей LoRA.

## Что понадобится
- Урок продолжает [LoRA: добавить стиль или тему](LoRA.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Файлы моделей, которые урок проверяет:
  - половина high_noise модели Wan 2.2: `models/diffusion_models`, например `Wan2_2-T2V-A14B-HIGH_fp8_e4m3fn_scaled_KJ.safetensors`;
  - половина low_noise модели Wan 2.2: `models/diffusion_models`, например `Wan2_2-T2V-A14B-LOW_fp8_e4m3fn_scaled_KJ.safetensors`;
  - ускоряющая LoRA для Wan (lightx2v или похожая), файл high: `models/loras`, например `wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors`;
  - ускоряющая LoRA для Wan (lightx2v или похожая), файл low: `models/loras`, например `wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors`.
- Ноды: Load Diffusion Model, ModelSamplingSD3, LoraLoaderModelOnly, KSampler (Advanced).
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Откуда берётся скорость** (чтение)

   Ускоряющая LoRA учит модель делать за четыре шага то, на что обычно уходит двадцать. Самая известная для Wan называется `lightx2v`.

   Цена: меньше разнообразия и чуть грубее движение. Для проб и подбора промпта это почти всегда выгодно: ролик готов в несколько раз быстрее.

2. **Нужен граф для видео**

   Этот урок продолжает граф из урока «Видео из текста» или «Видео из картинки». На холсте должны быть две ноды **Load Diffusion Model** и две ноды **ModelSamplingSD3**.

   Если их нет, сначала пройдите один из этих уроков.

3. **Поставьте LoRA в обе модели**

   Нужны две ноды **LoraLoaderModelOnly**, каждая между своей нодой **Load Diffusion Model** и нодой **ModelSamplingSD3**. Как их вставить, показано в уроке «LoRA: добавить стиль или тему».

4. **Выберите ускоряющие файлы**

   В ноде на пути модели `high_noise` выберите в поле `lora_name` файл `lightx2v` со словом `high`, на пути `low_noise` файл со словом `low`.

   Для моделей `t2v` и `i2v` файлы разные: берите те, что подходят к вашим моделям. Силу `strength_model` оставьте 1.

5. **Два сэмплера**

   Нужны два сэмплера из урока о видео: первый получает модель `high_noise`, второй получает модель `low_noise` и результат первого.

6. **Поставьте четыре шага**

   В обоих сэмплерах поставьте `steps` 4. В первом `end_at_step` 2, во втором `start_at_step` 2.

   Четыре шага делятся пополам: два делает первая модель, два вторая.

7. **Поставьте cfg 1**

   В обоих сэмплерах поставьте `cfg` 1.

   Ускоряющая LoRA обучена работать без усиления текста. С большим значением ролик выгорает и покрывается артефактами. При `cfg` 1 текст из входа `negative` перестаёт действовать.

8. **Теперь быстро** (чтение)

   Ролик считается в несколько раз быстрее.

   Когда промпт подобран, можно вернуться к двадцати шагам ради качества: уберите ускоряющие LoRA, верните `steps` 20, `cfg` 3.5 и границу на шаге 10.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Нужен граф для видео**:
  - нода **Load Diffusion Model**.
  - нода **Load Diffusion Model**.
  - нода **ModelSamplingSD3**.
  - нода **ModelSamplingSD3**.
  - в поле `unet_name` ноды **Load Diffusion Model** (первый проход) стоит файл такого вида: половина high_noise модели Wan 2.2; такой файл лежит в `models/diffusion_models`, например `Wan2_2-T2V-A14B-HIGH_fp8_e4m3fn_scaled_KJ.safetensors`.
  - в поле `unet_name` ноды **Load Diffusion Model** (второй проход) стоит файл такого вида: половина low_noise модели Wan 2.2; такой файл лежит в `models/diffusion_models`, например `Wan2_2-T2V-A14B-LOW_fp8_e4m3fn_scaled_KJ.safetensors`.
- Шаг 3, **Поставьте LoRA в обе модели**:
  - нода **LoraLoaderModelOnly**.
  - нода **LoraLoaderModelOnly**.
  - `MODEL` ноды **Load Diffusion Model** (первый проход) во вход `model` ноды **LoraLoaderModelOnly** (LoRA первого прохода) (можно через LoraLoaderModelOnly или ModelSamplingSD3).
  - `MODEL` ноды **LoraLoaderModelOnly** (LoRA первого прохода) во вход `model` ноды **ModelSamplingSD3** (сдвиг первого прохода) (можно через LoraLoaderModelOnly); или `MODEL` ноды **ModelSamplingSD3** (сдвиг первого прохода) во вход `model` ноды **LoraLoaderModelOnly** (LoRA первого прохода) (можно через LoraLoaderModelOnly).
  - `MODEL` ноды **Load Diffusion Model** (второй проход) во вход `model` ноды **LoraLoaderModelOnly** (LoRA второго прохода) (можно через LoraLoaderModelOnly или ModelSamplingSD3).
  - `MODEL` ноды **LoraLoaderModelOnly** (LoRA второго прохода) во вход `model` ноды **ModelSamplingSD3** (сдвиг второго прохода) (можно через LoraLoaderModelOnly); или `MODEL` ноды **ModelSamplingSD3** (сдвиг второго прохода) во вход `model` ноды **LoraLoaderModelOnly** (LoRA второго прохода) (можно через LoraLoaderModelOnly).
- Шаг 4, **Выберите ускоряющие файлы**:
  - в поле `lora_name` ноды **LoraLoaderModelOnly** (LoRA первого прохода) стоит файл такого вида: ускоряющая LoRA для Wan (lightx2v или похожая), файл high; такой файл лежит в `models/loras`, например `wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors`.
  - в поле `lora_name` ноды **LoraLoaderModelOnly** (LoRA второго прохода) стоит файл такого вида: ускоряющая LoRA для Wan (lightx2v или похожая), файл low; такой файл лежит в `models/loras`, например `wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors`.
- Шаг 5, **Два сэмплера**:
  - нода **KSampler (Advanced)**.
  - нода **KSampler (Advanced)**.
  - `MODEL` ноды **ModelSamplingSD3** (сдвиг первого прохода) во вход `model` ноды **KSampler (Advanced)** (первый проход) (можно через LoraLoaderModelOnly).
  - `MODEL` ноды **ModelSamplingSD3** (сдвиг второго прохода) во вход `model` ноды **KSampler (Advanced)** (второй проход) (можно через LoraLoaderModelOnly).
  - `LATENT` ноды **KSampler (Advanced)** (первый проход) во вход `latent_image` ноды **KSampler (Advanced)** (второй проход).
- Шаг 6, **Поставьте четыре шага**:
  - `steps` ноды **KSampler (Advanced)** (первый проход): `4`. Почему: ускоряющая LoRA обучена делать всё за четыре шага.
  - `steps` ноды **KSampler (Advanced)** (второй проход): `4`. Почему: ускоряющая LoRA обучена делать всё за четыре шага.
  - `end_at_step` ноды **KSampler (Advanced)** (первый проход): `2`. Почему: четыре шага делятся пополам: два делает первая модель, два вторая.
  - `start_at_step` ноды **KSampler (Advanced)** (второй проход): `2`. Почему: четыре шага делятся пополам: два делает первая модель, два вторая.
- Шаг 7, **Поставьте cfg 1**:
  - `cfg` ноды **KSampler (Advanced)** (первый проход): `1`. Почему: ускоряющая LoRA обучена без усиления текста. С большим cfg ролик выгорает.
  - `cfg` ноды **KSampler (Advanced)** (второй проход): `1`. Почему: ускоряющая LoRA обучена без усиления текста. С большим cfg ролик выгорает.

## Частые ошибки
- cfg остался 3.5: выгоревший, шумный ролик.
- Файлы ускорителя `t2v` с моделями `i2v` или наоборот.
- Оставить 20 шагов: скорости нет, результат часто пережжён.
- Рассчитывать на негативный промпт: при cfg 1 он ничего не делает.

## См. также
- [Как устроены уроки](How-Lessons-Work.ru.md)
- [LoRA-ускорители](../concepts/Speed-Up-LoRAs.ru.md)
- [CFG и guidance](../concepts/CFG.ru.md)
- [Шаги](../concepts/Steps.ru.md)
- [Два прохода Wan 2.2](../concepts/Wan-Two-Passes.ru.md)
