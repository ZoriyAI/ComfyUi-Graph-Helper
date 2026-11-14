[English](Video-Text.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Видео из текста

<!-- lesson: video-text -->
Урок «video-text»: граф Wan 2.2 на встроенных нодах, который делает пятисекундный ролик по промпту.

## Чему вы научитесь
Собирать двухпроходный граф Wan 2.2 14B: две модели, один текстовый энкодер, один VAE, сдвиг шума для каждой модели, два сэмплера, которые делят шаги, и ноды, которые собирают из кадров ролик.

## Что понадобится
- Встроенные ноды: Load Diffusion Model (×2), Load CLIP, Load VAE, CLIP Text Encode (×2), ModelSamplingSD3 (×2), EmptyHunyuanLatentVideo, KSampler (Advanced) (×2), VAE Decode, Create Video, Save Video. В свежем ComfyUI есть все.
- Файлы: `wan2.2_t2v_high_noise_14B` и `wan2.2_t2v_low_noise_14B` (любой точности, fp8 легче) в `models/diffusion_models`; `umt5_xxl` в `models/text_encoders`; `wan_2.1_vae` в `models/vae`. Приложение ничего не скачивает: готовый шаблон ComfyUI Wan 2.2 «text to video» называет недостающие файлы и их папки.
- Видеокарта с большим объёмом памяти: модели 14B большие. См. [Память видеокарты](../concepts/Graphics-Card-Memory.ru.md).
- Пустой холст: **Файл ▸ Новый проект**.

## Шаги
1. **Что такое видео для модели** (чтение): стопка кадров, нарисованная сразу; `high_noise` раскладывает, `low_noise` доделывает.
2. **Загрузите две модели**: две Load Diffusion Model с файлами `t2v` `high_noise` и `low_noise`. Это две половины одной модели, один файл дважды не годится.
3. **Загрузите чтение текста**: Load CLIP с `umt5_xxl`, `type` `wan`.
4. **Загрузите VAE**: `wan_2.1_vae` (большие модели Wan 2.2 берут VAE версии 2.1, а `wan2.2_vae` только для модели 5B).
5. **Напишите описание**: две текстовые ноды от Load CLIP; опишите действие и камеру.
6. **Задайте сдвиг шума**: ModelSamplingSD3 после каждой модели, `shift` 8 (принимается от 5 до 8).
7. **Задайте размер и длину**: EmptyHunyuanLatentVideo, 832×480, `length` 81 (принимается от 49 до 121; Wan хочет 4n + 1).
8. **Первый проход**: KSampler (Advanced) с моделью `high_noise`, оба текста, пустой латент.
9. **Второй проход**: KSampler (Advanced) с моделью `low_noise`, оба текста, выход первого сэмплера.
10. **Настройте первый сэмплер**: `add_noise` enable, `steps` 20, `cfg` 3.5, `start_at_step` 0, `end_at_step` 10, `return_with_leftover_noise` enable.
11. **Настройте второй сэмплер**: `add_noise` disable, те же `steps` и `cfg`, `start_at_step` 10, `return_with_leftover_noise` disable.
12. **Превратите результат в кадры**: VAE Decode с VAE Wan.
13. **Соберите и сохраните ролик**: Create Video с `fps` 16, потом Save Video.
14. **Граф готов** (чтение): первый запуск долгий; если не хватает памяти, уменьшите размер или длину.

## Что проверяет урок
В двух загрузчиках разные файлы; в Load CLIP выбран файл и `type` `wan`; выбран файл VAE; в промпте не меньше 3 знаков; `shift` от 5 до 8 у обеих; `length` от 49 до 121; все связи; у первого сэмплера `add_noise` enable, `cfg` от 1 до 4, `start_at_step` 0, `end_at_step` от 1 до 15, остаточный шум enable; у второго `add_noise` disable, те же `steps`, `cfg` от 1 до 4, `start_at_step` равен `end_at_step` первого, остаточный шум disable; `fps` 16. LoraLoaderModelOnly в любом месте пути модели засчитывается.

Урок пока не проверяет, что файлы именно `t2v`, а не `i2v`, и что текстовый энкодер и VAE от Wan. Сверяйте имена сами.
<!-- verify: the check of file families in lessons (learning report, P0) -->

## Частые ошибки
- Файлы `i2v` в графе видео из текста или один файл в обоих загрузчиках.
- Забыть `return_with_leftover_noise` у первого сэмплера: второй получит чистый ролик, и ему нечего доделывать.
- `start_at_step` второго не равен `end_at_step` первого: шаги теряются или делаются дважды.
- `fps` не 16: ролик идёт слишком быстро или медленно.
- **Сделать за меня** может поставить значение на краю допустимого, а не число из текста (например `shift` 5 вместо 8). Сверяйте с текстом.
<!-- verify: "Do this for me" uses the numbers of the text (learning report, P0) -->

## Что дальше
[Описание для видео](Prompt-Video.ru.md), [Видео из картинки](Video-Image.ru.md), [LoRA: добавить стиль или тему](LoRA.ru.md), потом [Быстрое видео за четыре шага](Video-Fast.ru.md).

## См. также
- [Модели для видео](../concepts/Video-Models.ru.md)
- [Два прохода Wan 2.2](../concepts/Wan-Two-Passes.ru.md)
- [Длина видео и частота кадров](../concepts/Video-Length-And-Frame-Rate.ru.md)
- [Wan 2.2](../concepts/Family-Wan22.ru.md)
- [Планировщик](../concepts/Scheduler.ru.md)
