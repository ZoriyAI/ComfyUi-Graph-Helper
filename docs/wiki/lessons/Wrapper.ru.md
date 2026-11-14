[English](Wrapper.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Видео на WanVideoWrapper

<!-- lesson: wrapper -->
Урок «wrapper»: двухпроходный граф Wan 2.2 на нодах пака WanVideoWrapper и его отличия от встроенного.

## Чему вы научитесь
Собирать тот же ролик, что в уроке [Видео из текста](Video-Text.ru.md), на нодах пака; помнить, что ноды пака и встроенные не соединяются; экономить память подкачкой блоков; добавлять LoRA так, как это принято в паке.

## Что понадобится
- Пак нод **ComfyUI-WanVideoWrapper** (автор Kijai), установленный в ComfyUI. Ставите вы сами, например через ComfyUI Manager, потом **Синхронизация ▸ Синхронизировать сейчас**. См. [Паки нод](../concepts/Node-Packs.ru.md).
- Модели Wan 2.2 `t2v` `high_noise` и `low_noise`, `umt5-xxl-enc` из набора автора пака (Kijai/WanVideo_comfy на Hugging Face) и `wan_2.1_vae`. Файлы называет папка `example_workflows` пака.
- Ноды: WanVideoModelLoader (×2), LoadWanVideoT5TextEncoder, WanVideoVAELoader, WanVideoTextEncode, WanVideoEmptyEmbeds, WanVideoSampler (×2), WanVideoDecode и встроенные Create Video и Save Video.

## Шаги
1. **Что такое WanVideoWrapper** (чтение): те же модели, свой путь; его выход `model` не подходит встроенному сэмплеру.
2. **Загрузите две модели**: `high_noise` и `low_noise`; `quantization` disabled; `load_device` offload_device, если модель больше памяти видеокарты.
3. **Загрузите чтение текста**: `umt5-xxl-enc`; файл из шаблона ComfyUI может не подойти.
4. **Загрузите VAE**: `wan_2.1_vae`.
5. **Напишите описание**: одна WanVideoTextEncode держит `positive_prompt` и `negative_prompt`.
6. **Задайте размер и длину**: WanVideoEmptyEmbeds, 832×480, `num_frames` 81.
7. **Первый проход**: WanVideoSampler с моделью `high_noise`, `text_embeds`, `image_embeds`. Поле `shift` самого сэмплера заменяет ModelSamplingSD3.
8. **Второй проход**: модель `low_noise`, те же embeds, `samples` от первого.
9. **Поделите шаги**: `steps` 20 у обоих, `end_step` 10 у первого, `start_step` 10 у второго.
10. **Строгость и сдвиг шума**: `cfg` 3.5, `shift` 8 у обоих (cfg 6 по умолчанию в паке слишком строг для Wan 2.2).
11. **Превратите результат в кадры**: WanVideoDecode.
12. **Соберите и сохраните ролик**: встроенные Create Video (`fps` 16) и Save Video.
13. **Когда не хватает памяти видеокарты** (чтение): WanVideo BlockSwap во вход `block_swap_args`, `blocks_to_swap` от 20 и выше; файлы fp8 и `quantization` fp8_e4m3fn.
14. **LoRA в этом паке** (чтение): WanVideo Lora Select во вход `lora` загрузчика; цепочка через `prev_lora`.
15. **Слова LoRA в описании.**
16. **Быстро за четыре шага** (чтение): lightx2v работает и здесь; 4 шага, раздел на 2, cfg 1.
17. **Граф готов** (чтение).

## Что проверяет урок
Два разных файла моделей; выбраны файлы текстового энкодера и VAE; в промпте не меньше 3 знаков; `num_frames` от 49 до 121; связи; `steps` от 4 до 40 и одинаковые у обоих; `end_step` от 1 до 20 и `start_step`, равный ему; `cfg` от 1 до 4 и `shift` от 5 до 8 у обоих; `fps` 16; слова-триггеры любой ноды выбора LoRA на холсте в `positive_prompt`.

## Частые ошибки
- Подключить загрузчик пака к встроенному сэмплеру: связь не цепляется (`WANVIDEOMODEL` это не `MODEL`).
- Оставить `end_step` -1: первый сэмплер делает всё сам.
- Файл `umt5_xxl` из ComfyUI в загрузчике T5 пака: ошибка при запуске.
- Оставить cfg 6 по умолчанию: выгоревший ролик.

## Что дальше
[Видео из картинки на WanVideoWrapper](Wrapper-Image.ru.md), [VACE: движение из другого видео](Wrapper-VACE.ru.md).

## См. также
- [Паки нод](../concepts/Node-Packs.ru.md)
- [Память видеокарты](../concepts/Graphics-Card-Memory.ru.md)
- [Два прохода Wan 2.2](../concepts/Wan-Two-Passes.ru.md)
- [Урок: Видео из текста](Video-Text.ru.md)
